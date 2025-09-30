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
    LayerDef,        
    DrawStyleOptions,
    InsertGeomOptions
} from '../../api/types';
import { Feature, View } from 'ol';
import { toOlLayer } from './adapters/layers';
import { HoverInfoController } from './interactions/HoverInfo';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import GeoJSON from 'ol/format/GeoJSON';
// import type { Geometry } from 'ol/geom';
// import type Feature from 'ol/Feature';
import { makeDrawStyle } from './adapters/draw-style';

import FullScreen from 'ol/control/FullScreen';
import ScaleLine from 'ol/control/ScaleLine';
import Geolocation from 'ol/Geolocation';

import { Circle as CircleGeom, Point } from 'ol/geom';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import Zoom from 'ol/control/Zoom';
import Collection from 'ol/Collection';
import type Control from 'ol/control/Control';
import Attribution from 'ol/control/Attribution';
import { transform } from 'ol/proj';

export function createOlEngine(events: Emitter<MapEventMap>): MapEngine {
    let map: OlMap | undefined;                    // <- use the aliased OL Map
    const layerIndex = new Map<string, BaseLayer>(); // <- this is the built-in Map<K,V>
    const baseIds = new Set<string>();
    const BASE_BAND = -10000; // zIndex range for base layers (below overlays)
    let activeBaseId: string | null = null;
    let hover: HoverInfoController | null = null;
    let drawSource: VectorSource<Feature<Geometry>> | null = null;
    let drawLayer: VectorLayer<VectorSource<Feature<Geometry>>> | null = null;

    let drawInteraction: Draw | null = null;
    let modifyInteraction: Modify | null = null;
    let snapInteraction: Snap | null = null;
    

    let currentDrawStyle = makeDrawStyle(undefined);

    // Controls
    let ctrlFull: FullScreen | null = null;
    let ctrlScale: ScaleLine | null = null;
    let ctrlZoom: Zoom | null = null;
    let ctrlAttribution: Attribution | null = null;

    // Geolocation
    let geo: Geolocation | null = null;
    let geoLayer: VectorLayer<VectorSource> | null = null;
    let geoSource: VectorSource | null = null;
    let geoFollow = false;

    function ensureZoom() {
        if (!map || ctrlZoom) return;
        ctrlZoom = new Zoom();              // You can pass options here (duration, className, target)
        map.addControl(ctrlZoom);
        events.emit('controls:zoom', { visible: true });
    }

    function removeZoom() {        
        if (!map || !ctrlZoom) return;
        map.removeControl(ctrlZoom);
        ctrlZoom = null;
        events.emit('controls:zoom', { visible: false });
    }

    function ensureAttribution() {
        if (!map || ctrlAttribution) return;
        ctrlAttribution = new Attribution({
            collapsible: true,          // set to false if you always want it visible
            collapsed: false,           // start expanded if you prefer
        });
        map.addControl(ctrlAttribution);
        events.emit('controls:attribution', { visible: true });
    }

    function removeAttribution() {
        if (!map || !ctrlAttribution) return;
        map.removeControl(ctrlAttribution);
        ctrlAttribution = null;
        events.emit('controls:attribution', { visible: false });
    }

    function ensureScaleLine() {
        if (!map || ctrlScale) return;
        ctrlScale = new ScaleLine();
        map.addControl(ctrlScale);
        events.emit('controls:scaleline', { visible: true });
    }

    function removeScaleLine() {
        if (!map || !ctrlScale) return;
        map.removeControl(ctrlScale);
        ctrlScale = null;
        events.emit('controls:scaleline', { visible: false });
    }

    function ensureFullScreen() {
        if (!map || ctrlFull) return;
        ctrlFull = new FullScreen();
        map.addControl(ctrlFull);
    }

    function ensureGeo() {
        if (!map || geo) return;

        geo = new Geolocation({
            projection: map.getView().getProjection(),
            tracking: false,
            trackingOptions: { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 },
        });        

        geo.on('change:position', () => {
            if (!geo || !map) return;
            const p = geo.getPosition() as [number, number] | null;
            const acc = geo.getAccuracy();
            if (!p) {
                events.emit('geo:position', null);
                return;
            }
            // draw marker & accuracy
            ensureGeoLayer();
            geoSource!.clear();
            const accGeom = new CircleGeom(p, acc || 0);
            const ptGeom = new Point(p);
            geoSource!.addFeatures([
                new Feature({ geometry: accGeom }),
                new Feature({ geometry: ptGeom }),
            ]);

            if (geoFollow) {
                map.getView().setCenter(p);
            }
            events.emit('geo:position', { coordinate: p, accuracy: acc ?? undefined });
        });

        geo.on('error', (e) => {
            events.emit('geo:error', { message: ((e as unknown) as Error).message ?? 'Geolocation error' });
        });
    }

    function ensureGeoLayer() {
        if (!map || geoLayer) return;
        geoSource = new VectorSource();
        geoLayer = new VectorLayer({
            source: geoSource,
            properties: { 'nbic:role': 'geolocation' },
            zIndex: 9998,
            style: (f) => {
                const g = f.getGeometry();
                if (g instanceof CircleGeom) {
                    return new Style({
                        fill: new Fill({ color: 'rgba(33, 150, 243, 0.15)' }),
                        stroke: new Stroke({ color: '#2196f3', width: 1 }),
                    });
                }
                return new Style({
                    image: new CircleStyle({
                        radius: 6,
                        fill: new Fill({ color: '#2196f3' }),
                        stroke: new Stroke({ color: '#ffffff', width: 2 }),
                    }),
                });
            },
        });
        map.addLayer(geoLayer);
    }

    function removeGeo() {
        if (!map) return;
        if (geo) {
            geo.setTracking(false);
            geo.un('change:position', () => { });
            geo = null;
        }
        if (geoLayer) { map.removeLayer(geoLayer); geoLayer = null; }
        geoSource = null;
    }

    function ensureDrawLayer() {
        if (!map || drawLayer) return;
        drawSource = new VectorSource<Feature<Geometry>>();
        drawLayer = new VectorLayer({
            source: drawSource,
            style: currentDrawStyle,
            properties: { 'nbic:role': 'draw' },
            zIndex: 9000,
            updateWhileInteracting: true,
        });
        map.addLayer(drawLayer);
    }

    function removeDrawInteractions() {
        if (!map) return;
        if (drawInteraction) { map.removeInteraction(drawInteraction); drawInteraction = null; }
        if (modifyInteraction) { map.removeInteraction(modifyInteraction); modifyInteraction = null; }
        if (snapInteraction) { map.removeInteraction(snapInteraction); snapInteraction = null; }
    }

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

    function isPickableLayer(l: unknown): boolean {
        // guard null/undefined
        if (!l || typeof (l as BaseLayer).get !== 'function') return false;
        const get = (l as BaseLayer).get.bind(l);
        // skip temporary layers
        const role = get('nbic:role');
        if (role === 'hover') return false;   // and optionally: if (role === 'draw') return false;
        // respect visibility if available
        const vis = (l as BaseLayer).getVisible?.();
        if (vis === false) return false;
        return true;
    }

    function toViewCoord(map: OlMap, coord: [number, number], from?: string): [number, number] {        
        const viewProj = String(map.getView().getProjection().getCode());        
        if (!from || from === viewProj) return coord;
        return transform(coord, from, viewProj) as [number, number];
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
                controls: new Collection<Control>([]),
                interactions: undefined,
            });

            // Controls requested at init
            if (init.controls?.fullscreen) ensureFullScreen();
            if (init.controls?.scaleLine) ensureScaleLine();
            if (init.controls?.zoom) ensureZoom();
            if (init.controls?.attribution) ensureAttribution();
            if (init.controls?.geolocation) {
                ensureGeo();
                if (init.controls?.geolocationFollow) {
                    geoFollow = true;
                    geo!.setTracking(true);
                }
            }

            // Fullscreen event (listen to native Fullscreen API)
            const targetEl = map.getTargetElement();
            if (targetEl) {
                targetEl.addEventListener('fullscreenchange', () => {
                    const active = document.fullscreenElement === targetEl;
                    events.emit('fullscreen:change', { active });
                });
            }

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
                        if (!isPickableLayer(l)) return undefined;
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
            // return map.forEachFeatureAtPixel(pixel, (feature, layer) => ({
            //     layerId: (layer && 'get' in layer && typeof layer.get === 'function' ? layer.get('id') : undefined) ?? '',
            //     featureId: feature.getId() as string,
            //     properties: feature.getProperties(),
            //     coordinate: coordinate,
            // })) ?? null;
            return (
                map.forEachFeatureAtPixel(
                    pixel,
                    (feature, layer) => {
                        if (!isPickableLayer(layer)) return undefined;
                        return {
                            layerId:
                                (layer && 'get' in layer && typeof layer.get === 'function' ? layer.get('id') : undefined) ?? '',
                            featureId: (feature as Feature).getId() as string | number | undefined,
                            properties: (feature as Feature).getProperties(),
                            coordinate: coordinate,
                        };
                    },
                    { hitTolerance: 5, layerFilter: isPickableLayer }
                ) ?? null
            );
        },

        // Drawing methods
        startDrawing(opts) {
            if (!map) return;
            ensureDrawLayer();
            removeDrawInteractions(); // remove any old draw/modify/snap

            currentDrawStyle = makeDrawStyle(opts.style);
            const olType = opts.kind === 'Text' ? 'Point' : opts.kind;

            // 1) Ensure a Modify exists, but DISABLE IT NOW
            if (!modifyInteraction) {
                modifyInteraction = new Modify({ source: drawSource! });
                map.addInteraction(modifyInteraction);
            }
            modifyInteraction.setActive(false); // ← critical: before first click

            // 2) Create Draw
            drawInteraction = new Draw({
                source: drawSource!,
                type: olType as 'Point' | 'LineString' | 'Polygon' | 'Circle',
                style: currentDrawStyle,
            });

            drawInteraction.on('drawstart', () => {
                events.emit('draw:start', { kind: opts.kind });
            });

            drawInteraction.on('drawend', (e) => {
                const f = e.feature as Feature<Geometry>;
                const styleOptions = opts.style;
                f.set('nbic:style', styleOptions);
                f.setStyle(makeDrawStyle(styleOptions));
                // Re-enable modify AFTER finishing the new feature
                modifyInteraction?.setActive(true);
                events.emit('draw:end', { feature: f });
            });

            map.addInteraction(drawInteraction);

            // 3) Snap (keeps the vertex exactly on edge/vertex)
            const snapTolerance = Math.max(2, Math.min(25, 10));
            if (opts.snap ?? true) {
                snapInteraction = new Snap({ source: drawSource!, pixelTolerance: snapTolerance });
                map.addInteraction(snapInteraction);
            }
        },

        stopDrawing() {
            removeDrawInteractions();
        },

        enableDrawEditing() {
            if (!map) return;
            ensureDrawLayer();
            if (!modifyInteraction) {
                modifyInteraction = new Modify({ source: drawSource! });
                map.addInteraction(modifyInteraction);
                modifyInteraction.on('modifyend', (e) => {
                    events.emit('edit:modified', { count: e.features.getLength() });
                });
            }
            if (!snapInteraction) {
                snapInteraction = new Snap({ source: drawSource! });
                map.addInteraction(snapInteraction);
            }
        },

        disableDrawEditing() {
            if (!map) return;
            if (modifyInteraction) { map.removeInteraction(modifyInteraction); modifyInteraction = null; }
            if (snapInteraction) { map.removeInteraction(snapInteraction); snapInteraction = null; }
        },

        clearDrawn() {
            const count = drawSource?.getFeatures().length ?? 0;
            drawSource?.clear(true);
            events.emit('draw:cleared', { count });
        },

        exportDrawnGeoJSON(opts) {
            // serialize using view projection
            const fmt = new GeoJSON();
            const json = fmt.writeFeatures(drawSource?.getFeatures() ?? [], {
                featureProjection: String(map?.getView().getProjection() ?? 'EPSG:3857'),
            });
            return opts?.pretty ? JSON.stringify(JSON.parse(json), null, 2) : json;
        },

        importDrawnGeoJSON(geojson, opts) {
            if (!map) return;
            ensureDrawLayer();

            const fmt = new GeoJSON();
            const features = fmt.readFeatures(geojson, {
                featureProjection: String(map.getView().getProjection()),
            });

            if (opts?.clearExisting) drawSource!.clear(true);
            for (const f of features) {
                const styleOpts = f.get('nbic:style') as DrawStyleOptions | undefined;
                if (styleOpts) {
                    f.setStyle(makeDrawStyle(styleOpts)); // ← persist style after import
                }
                // for text points, if you store a 'label' property:
                const label = f.get('label') as string | undefined;
                if (label && styleOpts?.text) {
                    // ensure text label is applied (makeDrawStyle reads text.label)
                    f.setStyle(makeDrawStyle({ ...styleOpts, text: { ...styleOpts.text, label } }));
                }
            }
            drawSource!.addFeatures(features);
            events.emit('draw:imported', { count: features.length });
        },

        enterFullScreen() {
            if (!map) return;
            const el = map.getTargetElement();
            if (el && !document.fullscreenElement) {
                void el.requestFullscreen().catch(() => {/* ignore */ });
            }
        },

        leaveFullScreen() {
            if (document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {/* ignore */ });
            }
        },

        showScaleLine() { ensureScaleLine(); },
        hideScaleLine() { removeScaleLine(); },

        showZoomControl() { ensureZoom(); },
        hideZoomControl() { removeZoom(); },

        showAttribution() { ensureAttribution(); },
        hideAttribution() { removeAttribution(); },

        activateGeolocation(follow?: boolean) {
            if (!map) return;
            ensureGeo();
            geoFollow = !!follow;
            geo!.setTracking(true);
        },

        deactivateGeolocation() {
            geoFollow = false;
            if (geo) geo.setTracking(false);
            // keep layer so last position remains visible; remove if you prefer:
            geoSource?.clear(); 
            removeGeo();
        },
        async zoomToGeolocation(maxZoom = 14): Promise<boolean> {
            if (!map) return false;
            ensureGeo();
            geo!.setTracking(true);

            return new Promise<boolean>((resolve) => {
                const once = () => {
                    const p = geo!.getPosition() as [number, number] | null;
                    if (p) {
                        ensureGeoLayer();
                        if (map) {
                            map.getView().animate({ center: p, zoom: Math.max(map.getView().getZoom() ?? 0, maxZoom), duration: 300 });
                        }
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                    geo!.un('change:position', once);
                    // stop tracking if you don’t want continuous updates:
                    geo!.setTracking(false);
                };
                geo!.on('change:position', once);
            });
        },

        getVectorLayerSource(layerId: string): VectorSource<Feature<Geometry>> | null {
            const l = layerIndex.get(layerId) as VectorLayer<VectorSource<Feature<Geometry>>> | undefined;
            if (!l || typeof l.getSource !== 'function') return null;
            return l.getSource() as VectorSource<Feature<Geometry>> | null;
        },

        addPoint(layerId: string, coordinate: MapCoord, props?: Record<string, unknown>, style?: DrawStyleOptions, opts?: InsertGeomOptions) {
            if (!map) return false;
            const src = this.getVectorLayerSource(layerId);
            if (!src) return false;
            const viewCoord = toViewCoord(map, coordinate, opts?.dataProjection);
            const f = new Feature({ geometry: new Point(viewCoord) });
            if (props) for (const [k, v] of Object.entries(props)) f.set(k, v);
            if (style) {
                f.set('nbic:style', style);
                f.setStyle(makeDrawStyle(style));
            }
            src.addFeature(f);
            return true;
        },

        removeAllFromLayer(layerId: string) {
            const src = this.getVectorLayerSource(layerId);
            if (!src) return false;
            src.clear(true);
            return true;
        },
    };
}