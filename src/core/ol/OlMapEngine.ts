// src/core/ol/OlMapEngine.ts
import OlMap from 'ol/Map';                      // <- rename to avoid clashing with built-in Map<K,V>
import View from 'ol/View';
import type { MapEngine } from '../MapEngine';
import type {
    MapInit,
    MapCoord,
    CameraState,
    LayerDef,
    Extent,
} from '../../api/types';
import type { Emitter } from '../../core/state/store';
import type { MapEventMap } from '../../api/events';
import type BaseLayer from 'ol/layer/Base';

import { toOlLayer } from './adapters/layers';   // <- only need the layer factory here

export function createOlEngine(events: Emitter<MapEventMap>): MapEngine {
    let map: OlMap | undefined;                    // <- use the aliased OL Map
    const layerIndex = new Map<string, BaseLayer>(); // <- this is the built-in Map<K,V>

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
        },

        destroy() {
            map?.setTarget(undefined);
            map = undefined;
            layerIndex.clear();           // this is the built-in Map<K,V>, so clear() exists
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
            const layer = toOlLayer(def); // toOlLayer resolves sources/styles internally
            map!.addLayer(layer);
            if (def.zIndex !== undefined) layer.setZIndex(def.zIndex);
            layerIndex.set(def.id, layer);
        },

        removeLayer(layerId: string) {
            const l = layerIndex.get(layerId);
            if (l) {
                map!.removeLayer(l);
                layerIndex.delete(layerId);
            }
        },

        setLayerVisibility(layerId: string, visible: boolean) {
            layerIndex.get(layerId)?.setVisible(visible);
        },

        reorderLayers(order: string[]) {
            order.forEach((id, i) => layerIndex.get(id)?.setZIndex(i));
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