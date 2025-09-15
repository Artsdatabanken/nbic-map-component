// src/core/ol/OlMapEngine.ts
import type BaseLayer from 'ol/layer/Base';
import { Emitter } from '../state/store';
import { MapEventMap } from '../../api/events';
import { MapEngine } from '../MapEngine';
import OlMap from 'ol/Map';  
import type {
    MapInit,
    MapCoord,
    CameraState,
    LayerDef        
} from '../../api/types';
import { Feature, View } from 'ol';
import { toOlLayer } from './adapters/layers';
import { HoverInfoController } from './interactions/HoverInfo';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';

export function createOlEngine(events: Emitter<MapEventMap>): MapEngine {
    let map: OlMap | undefined;                    // <- use the aliased OL Map
    const layerIndex = new Map<string, BaseLayer>(); // <- this is the built-in Map<K,V>
    const baseIds = new Set<string>();
    const BASE_BAND = -10000; // zIndex range for base layers (below overlays)
    let activeBaseId: string | null = null;
    let hover: HoverInfoController | null = null;


    function markLayer(l: BaseLayer, isBase: boolean) {
        l.set('nbic:role', isBase ? 'base' : 'overlay');
    }
    function isBaseLayer(l: BaseLayer) {
        return l.get('nbic:role') === 'base';
    }

    function enforceBaseVisibility(chosenId?: string) {
        // If a chosen base is made visible, hide all other base layers
        if (!map) return;
        if (chosenId && baseIds.has(chosenId)) {
            for (const id of baseIds) {
                const lyr = layerIndex.get(id);
                if (!lyr) continue;
                lyr.setVisible(id === chosenId);
            }
            activeBaseId = chosenId;
            events.emit('layer:added', { layerId: chosenId }); // optional signal (or add a dedicated baselayer event)
        } else {
            // no chosen base; ensure at most one base visible (pick the first visible)
            let firstVisible: string | null = null;
            for (const id of baseIds) {
                const lyr = layerIndex.get(id);
                if (!lyr) continue;
                if (lyr.getVisible() && firstVisible === null) {
                    firstVisible = id;
                } else {
                    lyr.setVisible(false);
                }
            }
            activeBaseId = firstVisible;
        }
    }

    return {
        async init(init: MapInit) {
            const view = new View({
                projection: init.projection ?? 'EPSG:3857',
                center: (init.center ?? [0, 0]) as MapCoord,
                zoom: init.zoom ?? 2,
                minZoom: init.minZoom,
                maxZoom: init.maxZoom,
            });

            map = new OlMap({
                target: init.target,
                view,
                controls: undefined,        // add defaults later if needed
                interactions: undefined,
            });

            map.on('moveend', () => {
                if (!map) return;
                const v = map.getView();

                const payload: CameraState = {
                    center: v.getCenter() as MapCoord,
                    zoom: v.getZoom() ?? 0,
                };
                events.emit('camera:changed', payload);

                const ex = v.calculateExtent(map.getSize() ?? undefined) as Extent;
                events.emit('extent:changed', { extent: ex });
            });

            map.on('singleclick', (evt) => {
                if (!map) return;

                type ClickFeature = { feature: Feature<Geometry>; layer: BaseLayer; featureId: string; layerId: string; properties?: Record<string, unknown> };
                const features: ClickFeature[] = [];

                map.forEachFeatureAtPixel(
                    evt.pixel,
                    (f, l) => {
                        if (!f || typeof (f as Feature<Geometry>).getProperties !== 'function') return undefined;
                        features.push({ feature: f as Feature<Geometry>, layer: l as BaseLayer, featureId: f.getId() as string, layerId: l.get('id') as string, properties: (f as Feature<Geometry>).getProperties() });
                        return undefined; // continue collecting overlaps
                    },
                    {
                        hitTolerance: 5,
                        layerFilter: (l) =>
                            (l as BaseLayer).getVisible?.() !== false &&
                            (l as BaseLayer).get?.('nbic:role') !== 'hover',   // ← ignore hover layer
                    }
                );

                events.emit('pointer:click', features.length ? { features } : null);
            });
        },

        destroy() {
            hover?.destroy();
            hover = null;
            map?.setTarget(undefined);
            map = undefined;
            layerIndex.clear();
            baseIds.clear();
            activeBaseId = null;
        },

        getCamera() {
            const v = map!.getView();
            return {
                center: v.getCenter() as MapCoord,
                zoom: v.getZoom() ?? 0,
            };
        },

        getExtent() {
            const v = map!.getView();
            return v.calculateExtent(map!.getSize() ?? undefined) as Extent;
        },

        setCenter(center: MapCoord) {
            map!.getView().setCenter(center);
        },

        setZoom(zoom: number) {
            map!.getView().setZoom(zoom);
        },

        fitExtent(ext: Extent, padding: number) {
            map!.getView().fit(ext, { padding: [padding, padding, padding, padding] });
        },

        addLayer(def: LayerDef) {
            const layer = toOlLayer(def);
            layer.set('id', def.id);
            const isBase = !!def.base;
            markLayer(layer, isBase);

            map!.addLayer(layer);
            layerIndex.set(def.id, layer);

            if (isBase) {
                baseIds.add(def.id);
                // Put base layers in a low band; keep overlays >= 0
                // If caller provided zIndex, respect it; otherwise assign in band.
                if (def.zIndex === undefined) {
                    // simple stable ordering within base band
                    layer.setZIndex(BASE_BAND + layerIndex.size);
                }
                // If this base is visible, enforce exclusivity
                if (def.visible ?? layer.getVisible()) {
                    enforceBaseVisibility(def.id);
                } else {
                    // ensure not accidentally visible if another base is active
                    if (activeBaseId) layer.setVisible(false);
                }
            } else {
                // overlay default zIndex (respect provided zIndex)
                if (def.zIndex !== undefined) layer.setZIndex(def.zIndex);
            }
        },

        removeLayer(layerId: string) {
            const l = layerIndex.get(layerId);
            if (l) {
                map!.removeLayer(l);
                layerIndex.delete(layerId);
            }
        },        

        setLayerVisibility(layerId: string, visible: boolean) {
            const l = layerIndex.get(layerId);
            if (!l) return;
            const isBase = isBaseLayer(l);
            if (isBase && visible) {
                enforceBaseVisibility(layerId); // show this base, hide others
            } else {
                l.setVisible(visible);
            }
        },

        reorderLayers(order: string[]) {
            // Keep bases in the base band; overlays above.
            let overlayZ = 0;
            let baseZ = BASE_BAND;
            for (const id of order) {
                const l = layerIndex.get(id);
                if (!l) continue;
                if (isBaseLayer(l)) {
                    l.setZIndex(baseZ++);
                } else {
                    l.setZIndex(overlayZ++);
                }
            }
        },
        
        activateHoverInfo(options) {
            if (!map) return;
            if (!hover) hover = new HoverInfoController(map, events);
            hover.activate(options);
        },
        deactivateHoverInfo() {
            hover?.deactivate();
        },

        pickAt(pixel: [number, number]) {
            if (!map) return null;
            const coordinate = map.getCoordinateFromPixel(pixel) as MapCoord | undefined;
            if (!coordinate) return null;
            return map.forEachFeatureAtPixel(pixel, (feature, layer) => ({
                layerId: (layer && 'get' in layer && typeof layer.get === 'function' ? layer.get('id') : undefined) ?? '',
                featureId: feature.getId() as string,
                properties: feature.getProperties(),
                coordinate: coordinate,
            })) ?? null;
        }
    };
}