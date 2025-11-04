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
    UpdateGeoJSONLayerOptions    
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
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import type { Feature as OlFeature } from 'ol';
import Cluster from 'ol/source/Cluster';
import { makeDrawStyle } from './adapters/draw-style';

import { isPickableLayer } from './utils/picking';
import { toViewCoord, transformCoordsFrom, transformCoordsArrayFrom } from './utils/coords';
import { Coordinate } from 'ol/coordinate';

function resolveVectorSource(layer: VectorLayer<VectorSource<OlFeature<Geometry>>>): VectorSource<OlFeature<Geometry>> | null {
    const src = layer.getSource();
    if (!src) return null;
    if (src instanceof Cluster) {
        const inner = src.getSource();
        return (inner as VectorSource<OlFeature<Geometry>>) ?? null;
    }
    return src as VectorSource<OlFeature<Geometry>>;
}

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
                const clickCoordinate = evt.coordinate as Coordinate;
                events.emit('pointer:click', features.length ? { features, clickCoordinate } : { clickCoordinate, features: null });
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
        listLayerIds: () => registry.listIds(),

        listBaseLayerIds: () => registry
            .listIds()
            .filter(id => {
                const l = registry.get(id);
                return !!l && bases.isBase(l);
            }),

        listOverlayLayerIds: () => registry
            .listIds()
            .filter(id => {
                const l = registry.get(id);
                return !!l && !bases.isBase(l);
            }),

        getLayerById: (id) => registry.get(id) ?? null,
        
        addLayer(def: LayerDef) {
            const layer = toOlLayer(def);
            layer.set('id', def.id);
            layer.set('nbic:pickable', def?.pickable !== false); // default true
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
        
        adoptLayer(id, layer, opts) {
            if (!map || !layer) return;
            // Tag + ID
            layer.set('id', id);
            layer.set('nbic:external', true);
            layer.set('nbic:role', opts?.role ?? 'overlay');
            layer.set('nbic:pickable', opts?.pickable !== false); // default true

            // Add to map + registry
            map.addLayer(layer);
            registry.add(id, layer);

            // Base vs overlay
            if (opts?.base) {
                const role = opts.base === 'super' ? 'super' : 'regional';
                bases.registerBase(layer, role, { id, base: role } as LayerDef);
            } else if (opts?.zIndex !== undefined) {
                layer.setZIndex(opts.zIndex);
            }

            // Optional: emit the same event as addLayer
            // events.emit('layer:added', { layerId: id });
        },

        ejectLayer(id) {
            const l = registry.get(id);
            if (!l) return;
            map!.removeLayer(l);
            registry.remove(id);
            bases.onRemoved(id);
            // events.emit('layer:removed', { layerId: id });
        },

        getFeatureCount(layerId: string) {
            const src = registry.getVectorSource(layerId);            
            if (!src) return 0;            
            // Normal vector source
            const feats = src.getFeatures();
            if (!feats.length) return 0;
            // Cluster source → unwrap
            if (src instanceof Cluster) {
                const maybeCluster = src.getSource?.();
                if (maybeCluster && typeof maybeCluster.getFeatures === 'function') {
                    return maybeCluster.getFeatures().length;
                }
            }
            return feats.length;
        },

        getFeatures(layerId: string) {
            const src = registry.getVectorSource(layerId);
            if (!src) return [];
            if (src instanceof Cluster) {
                const maybeCluster = src.getSource?.();
                if (maybeCluster && typeof maybeCluster.getFeatures === 'function') {
                    return maybeCluster.getFeatures();
                }
            }
            return src.getFeatures();
        },

        adoptControl(control: Control, id?: string): string {
            return controls.adopt(control, id);
        },
        removeControl(id: string): boolean {
            return controls.remove(id);
        },
        listCustomControlIds(): string[] {
            return controls.listIds();
        },
        getCustomControl(id: string): Control | undefined {
            return controls.get(id);
        },

        updateGeoJSONLayer(            
            layerId: string,
            geojson: string | object,
            opts?: UpdateGeoJSONLayerOptions
        ): boolean {
            const layer = registry.get(layerId) as VectorLayer<VectorSource<OlFeature<Geometry>>> | undefined;
            if (!map || !layer) return false;

            // 1) Resolve projections
            const viewProj = String(map.getView().getProjection().getCode());
            const dataProj =
                opts?.dataProjection ??    
                (layer.get('nbic:dataProjection') as string | undefined) // recorded at creation                
                ?? viewProj; // assume same as view if not specified                            
            // 2) Read incoming features            
            const fmt = new GeoJSON();
            const text = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);
            const incoming = fmt.readFeatures(text, {
                dataProjection: dataProj,
                featureProjection: viewProj,
            }) as OlFeature<Geometry>[];

            // Optional: set ids from a property
            const idProp = opts?.idProperty;
            if (idProp) {
                for (const f of incoming) {
                    const id = f.get(idProp) as string | number | undefined;
                    if (id !== undefined) f.setId(id);
                }
            }

            // 3) Figure out clustering
            const currentSrc = layer.getSource();
            const clusterMeta = layer.get('nbic:cluster') as
                | { distance?: number; minDistance?: number }
                | undefined;

            const isClustered = currentSrc instanceof Cluster;
            const curVector = isClustered
                ? (currentSrc as Cluster).getSource()
                : currentSrc;

            const mode = opts?.mode ?? 'replace';

            // 4) Build the next underlying VectorSource (memory only → no loader)
            let nextVector: VectorSource<OlFeature<Geometry>>;

            if (mode === 'replace') {
                nextVector = new VectorSource<OlFeature<Geometry>>({ features: incoming });
            } else {
                // MERGE
                const existing = (curVector?.getFeatures() ?? []) as OlFeature<Geometry>[];
                const byId = new Map<string | number, OlFeature<Geometry>>();
                for (const f of existing) {
                    const id = f.getId();
                    if (id !== undefined && id !== null) byId.set(id as string | number, f);
                }

                const merged: OlFeature<Geometry>[] = [];
                const seen = new Set<string | number>();

                for (const nf of incoming) {
                    const id = nf.getId();
                    if (id === undefined || id === null) {
                        merged.push(nf); // new feature without id
                        continue;
                    }
                    seen.add(id as string | number);
                    const cur = byId.get(id as string | number);
                    if (!cur) {
                        merged.push(nf);
                    } else {
                        // update geometry + properties
                        const g = nf.getGeometry();
                        if (g) cur.setGeometry(g);
                        const props = nf.getProperties(); delete props.geometry;
                        cur.setProperties(props);

                        // styles: keep old if requested, else leave as-is or copy a style marker if you use one
                        if (!opts?.keepStyles) {
                            const s = nf.get('nbic:style');
                            if (s) cur.setStyle(cur.getStyle()); // or your makeDrawStyle(s)
                        }

                        merged.push(cur);
                    }
                }

                // keep unmatched existing without ids
                for (const f of existing) {
                    const id = f.getId();
                    if (id === undefined || id === null) merged.push(f);
                }

                nextVector = new VectorSource<OlFeature<Geometry>>({ features: merged });
            }

            // 5) Wrap with Cluster again if needed (preserve distance/minDistance)
            let nextSource: VectorSource<OlFeature<Geometry>> | Cluster;
            if (isClustered || clusterMeta) {
                const distance = currentSrc instanceof Cluster
                    ? currentSrc.getDistance?.() ?? clusterMeta?.distance ?? 40
                    : clusterMeta?.distance ?? 40;

                const minDistance = currentSrc instanceof Cluster
                    ? currentSrc.getMinDistance?.() ?? clusterMeta?.minDistance ?? 0
                    : clusterMeta?.minDistance ?? 0;

                nextSource = new Cluster({
                    distance,
                    minDistance,
                    source: nextVector,
                });
            } else {
                nextSource = nextVector;
            }

            // 6) Swap the source → this detaches any URL/loader so pans/zooms won’t revert your edits
            layer.setSource(nextSource);
            return true;
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
        enableDrawEditing: (opts) => draw.enableEditing(opts),
        disableDrawEditing: () => draw.disableEditing(),
        undoLastPoint: () => draw.undoLastPoint(),
        finishCurrent: () => draw.finishCurrent(),
        abortCurrent: () => draw.abortCurrent(),
        clearDrawn: () => draw.clear(),
        exportDrawnGeoJSON: (opts) => draw.exportGeoJSON(map!, opts),
        importDrawnGeoJSON: (geojson, opts) => draw.importGeoJSON(map!, geojson, opts),
        setDrawnFeatureStyle: (feature, style) => draw.setFeatureStyle(feature, style),
        clearDrawnFeatureStyle: (feature) => draw.clearFeatureStyle(feature),
        setFeatureStyle(layerId: string, featureId: string | number, style: DrawStyleOptions): boolean {
            const layer = registry.get(layerId) as VectorLayer<VectorSource<OlFeature<Geometry>>> | undefined;
            if (!layer) return false;

            const src = resolveVectorSource(layer);
            if (!src) return false;

            const feat = src.getFeatureById(featureId) as OlFeature<Geometry> | null;
            if (!feat) return false;

            feat.set('nbic:style', style);
            feat.setStyle(makeDrawStyle(style));
            return true;
        },

        clearFeatureStyle(layerId: string, featureId: string | number): boolean {
            const layer = registry.get(layerId) as VectorLayer<VectorSource<OlFeature<Geometry>>> | undefined;
            if (!layer) return false;

            const src = resolveVectorSource(layer);
            if (!src) return false;

            const feat = src.getFeatureById(featureId) as OlFeature<Geometry> | null;
            if (!feat) return false;

            feat.unset('nbic:style', true);
            feat.setStyle(undefined); // fallback to layer style
            return true;
        },

        // geometry analysis
        analyzeSelfIntersections: async (feature: OlFeature<Geometry>) => {
            if (!map) return { valid: true };
            const { checkSelfIntersections } = await import('./utils/geometry-analysis');
            return checkSelfIntersections(map, feature);
        },

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

        // Transform coordinates        
        transformCoordsFrom: (coord: [number, number], from: string, to: string) => {
            return transformCoordsFrom(coord, from, to);
        },

        transformCoordsArrayFrom: (coords: [number, number][], from: string, to: string) => {
            return transformCoordsArrayFrom(coords, from, to);
        },
        
        // Zoom
        zoomToFeature: (layerId, featureId, opts) => zoom.zoomToFeatureById(registry, layerId, featureId, opts),
        zoomToLayer: (layerId, opts) => zoom.zoomToLayerById(registry, layerId, opts),
        zoomToExtent: (extent, opts) => zoom.zoomToExtent(extent, opts),
        fitGeometry: (geom, opts) => zoom.fitGeometry(geom, opts),
    };
}