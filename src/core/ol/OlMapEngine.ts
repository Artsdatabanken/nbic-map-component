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
    InsertGeomOptions,    
} from '../../api/types';
import { Feature, View } from 'ol';
import { toOlLayer } from './adapters/layers';
import { HoverInfoController } from './interactions/HoverInfo';
import type { Extent } from 'ol/extent';
import Collection from 'ol/Collection';
import type Control from 'ol/control/Control';
import type { Geometry } from 'ol/geom';
import { LayerRegistry } from './layers/LayerRegistry';
import { BaseLayersController } from './layers/BaseLayerController';
import { DrawController } from './interactions/DrawController';
import { ControlsController } from './controls/ControlsController';
import { GeoController } from './geo/GeoController';
import { ZoomController } from './zoom/ZoomController';

import { isPickableLayer } from './utils/picking';
import { toViewCoord } from './utils/coords';

export function createOlEngine(events: Emitter<MapEventMap>): MapEngine {
    let map: OlMap | undefined;        
    // Composition
    let hover: HoverInfoController | null = null;
    const registry = new LayerRegistry();
    const bases = new BaseLayersController(events);
    const draw = new DrawController(events);
    const controls = new ControlsController();
    const geo = new GeoController(events);
    const zoom = new ZoomController();

    bases.bindFind((id) => registry.get(id) ?? null);

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

            controls.attach(map, events, init.controls);
            draw.attach(map);
            const dl = draw.getLayer();
            if (dl) registry.add('draw-layer', dl);
            geo.attach(map);
            zoom.attach(map);
            
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
                        if (!f || !isPickableLayer(l)) return undefined;
                        features.push({
                            feature: f as Feature<Geometry>,
                            layer: l as BaseLayer,
                            featureId: f.getId() as string,
                            layerId: (l as BaseLayer).get('id') as string,
                            properties: f.getProperties(),
                        });
                        return undefined;
                    },
                    { hitTolerance: 5, layerFilter: isPickableLayer }
                );
                events.emit('pointer:click', features.length ? { features } : null);
            });
        },

        destroy() {            
            draw.detach();
            geo.detach();
            controls.detach();
            map?.setTarget(undefined);
            map = undefined;
            registry.clear();            
            bases.clear(); 
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

        // layers
        addLayer(def: LayerDef) {
            const layer = toOlLayer(def);
            layer.set('id', def.id);
            map!.addLayer(layer);
            registry.add(def.id, layer);

            if (def.base) {
                const role = def.base === 'super' ? 'super' : 'regional';
                bases.registerBase(layer, role, def);
            } else if (def.zIndex !== undefined) {
                layer.setZIndex(def.zIndex);
            }            
        },

        removeLayer(id: string) {            
            const l = registry.get(id);
            if (!l) return;
            map!.removeLayer(l);
            registry.remove(id);
            bases.onRemoved(id);
        },        

        setLayerVisibility(id: string, visible: boolean) {            
            const l = registry.get(id);
            if (!l) return;
            if (!bases.isBase(l)) { l.setVisible(visible); return; }
            bases.setVisibility(l, visible);
        },

        setActiveBase(id: string) {            
            bases.setActiveRegional(id);
        },

        reorderLayers(order: string[]) {            
            registry.reorder(order, bases);
        },
        
        // hover info        
        activateHoverInfo(options) {
            if (!map) return;
            if (!hover) hover = new HoverInfoController(map, events);
            hover.activate(options);
        },
        deactivateHoverInfo() {
            hover?.deactivate();
        },
        
        // picking
        pickAt(pixel: [number, number]) {            
            if (!map) return null;
            const coordinate = map.getCoordinateFromPixel(pixel) as MapCoord | undefined;
            if (!coordinate) return null;
            return map.forEachFeatureAtPixel(
                pixel,
                (feature, layer) => {
                    if (!isPickableLayer(layer)) return undefined;
                    return {
                        layerId: (layer as BaseLayer).get('id') as string,
                        featureId: feature.getId() as string | number | undefined,
                        properties: feature.getProperties(),
                        coordinate,
                    };
                },
                { hitTolerance: 5, layerFilter: isPickableLayer }
            ) ?? null;
        },

        // drawing
        startDrawing: (opts) => draw.start(opts),
        stopDrawing: () => draw.stop(),
        enableDrawEditing: () => draw.enableEditing(),
        disableDrawEditing: () => draw.disableEditing(),
        clearDrawn: () => draw.clear(),
        exportDrawnGeoJSON: (opts) => draw.exportGeoJSON(map!, opts),
        importDrawnGeoJSON: (geojson, opts) => draw.importGeoJSON(map!, geojson, opts),

        // full-screen
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

        // controls
        showScaleLine: () => controls.ensureScaleLine(map!, events),
        hideScaleLine: () => controls.removeScaleLine(map!, events),
        showZoomControl: () => controls.ensureZoom(map!, events),
        hideZoomControl: () => controls.removeZoom(map!, events),
        showAttribution: () => controls.ensureAttribution(map!, events),
        hideAttribution: () => controls.removeAttribution(map!, events),        

        // geolocation
        activateGeolocation: (follow?: boolean) => geo.activate(follow),
        deactivateGeolocation: () => geo.deactivate(),
        zoomToGeolocation: (maxZoom?: number) => geo.zoomToGeolocation(maxZoom),

        // vector layers
        getVectorLayerSource: (layerId) => registry.getVectorSource(layerId),        

        addPoint(layerId: string, coordinate: MapCoord, props?: Record<string, unknown>, style?: DrawStyleOptions, opts?: InsertGeomOptions) {        
            const src = registry.getVectorSource(layerId);
            if (!map || !src) return false;
            const viewCoord = toViewCoord(map, coordinate, opts?.dataProjection);
            const f = draw.createPointFeature(viewCoord, props, style);
            src.addFeature(f);
            return true;
        },

        removeAllFromLayer(layerId: string) {
            const src = registry.getVectorSource(layerId);
            if (!src) return false;
            src.clear(true);
            return true;
        },    
        
        // Zoom
        zoomToFeature: (layerId, featureId, opts) => zoom.zoomToFeatureById(registry, layerId, featureId, opts),
        zoomToLayer: (layerId, opts) => zoom.zoomToLayerById(registry, layerId, opts),
        zoomToExtent: (extent, opts) => zoom.zoomToExtent(extent, opts),
        fitGeometry: (geom, opts) => zoom.fitGeometry(geom, opts),
    };
}