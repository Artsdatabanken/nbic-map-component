// src/api/MapAPI.ts
import '../core/projections';
import type { Emitter } from '../core/state/store';
import type {
    MapInit, MapCoord, CameraState, LayerDef, HitResult,
    HoverInfoOptions,
    DrawImportOptions,
    DrawExportOptions,
    DrawOptions,
    DrawStyleOptions,
    InsertGeomOptions,
    UpdateGeoJSONLayerOptions,
    AdoptLayerOptions
} from './types';
import type { MapEngine } from '../core/MapEngine';
import { createEmitter } from '../core/state/store';
import { createOlEngine } from '../core/ol/OlMapEngine';
import type { MapEventMap } from './events';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type BaseLayer from 'ol/layer/Base';
import type Control from 'ol/control/Control';
import { Feature } from 'ol';
export class MapAPI {
    private engine: MapEngine;
    private events: Emitter<MapEventMap>;
    private layerDefs = new Map<string, LayerDef>();
    constructor(init: MapInit, engine?: MapEngine) {
        this.events = createEmitter<MapEventMap>();
        this.engine = engine ?? createOlEngine(this.events);

        this.engine.init(init).then(() => {
            this.events.emit('ready', undefined);
        }).catch((err) => {
            this.events.emit('error', { scope: 'init', message: String(err), detail: err });
        });
    }

    // Explicitly typed pass-throughs (avoid binding issues and keep types)
    on<K extends keyof MapEventMap>(type: K, cb: (payload: MapEventMap[K]) => void) {
        return this.events.on(type, cb);
    }
    off<K extends keyof MapEventMap>(type: K, cb: (payload: MapEventMap[K]) => void) {
        return this.events.off(type, cb);
    }    

    destroy() {
        this.engine.destroy();
        this.events.emit('destroy', undefined);
    }

    getCamera(): CameraState {
        return this.engine.getCamera();
    }

    getExtent(): Extent {
        return this.engine.getExtent();
    }

    /** Return all layers marked as base (in insertion order). */
    getBaseLayerIds(): string[] {
        return this.engine.listBaseLayerIds();
    }
    getOverlayLayerIds(): string[] {
        return this.engine.listOverlayLayerIds();
    }

    /** If you still want full LayerDef[] for config-only layers, keep these: */
    getBaseLayers(): LayerDef[] {
        // legacy: only those added through addLayer
        return Array.from(this.layerDefs.values()).filter(l => !!l.base);
    }
    getOverlayLayers(): LayerDef[] {
        return Array.from(this.layerDefs.values()).filter(l => !l.base);
    }

    /** Or add engine-backed variants that return live OL layers: */
    getLayerById(id: string): BaseLayer | null {
        return this.engine.getLayerById(id);
    }    

    adoptControl(control: Control, id?: string) {
        return this.engine.adoptControl(control, id);
    }
    removeControl(id: string) {
        return this.engine.removeControl(id);
    }
    listCustomControlIds() {
        return this.engine.listCustomControlIds();
    }
    getCustomControl(id: string) {
        return this.engine.getCustomControl(id);
    }

    setCenter(center: MapCoord) { this.engine.setCenter(center); }
    setZoom(zoom: number) { this.engine.setZoom(zoom); }
    fitExtent(extent: Extent, padding = 16) { this.engine.fitExtent(extent, padding); }

    addLayer(layer: LayerDef) { this.layerDefs.set(layer.id, layer); this.engine.addLayer(layer); this.events.emit('layer:added', { layerId: layer.id }); }
    removeLayer(layerId: string) { this.layerDefs.delete(layerId); this.engine.removeLayer(layerId); this.events.emit('layer:removed', { layerId }); }
    updateGeoJSONLayer(layerId: string, geojson: string, opts?: UpdateGeoJSONLayerOptions) { this.engine.updateGeoJSONLayer(layerId, geojson, opts); }
    setLayerVisibility(layerId: string, visible: boolean) { this.engine.setLayerVisibility(layerId, visible); }
    reorderLayers(order: string[]) { this.engine.reorderLayers(order); }

    addPoint(layerId: string, coord: MapCoord, properties?: Record<string, unknown>, style?: DrawStyleOptions, opts?: InsertGeomOptions): boolean { return this.engine.addPoint(layerId, coord, properties, style, opts); }
    removeAllFromLayer(layerId: string): boolean { return this.engine.removeAllFromLayer(layerId); }

    adoptLayer(id: string, layer: BaseLayer, opts?: AdoptLayerOptions) { this.engine.adoptLayer(id, layer, opts); }
    ejectLayer(id: string) { this.engine.ejectLayer(id); this.layerDefs.delete(id); this.events.emit('layer:removed', { layerId: id }); }

    getFeatureCount(layerId: string): number {
        return this.engine.getFeatureCount(layerId);
    }

    getFeatures(layerId: string): Feature<Geometry>[] | null {
        return this.engine.getFeatures(layerId);
    }

    activateHoverInfo(options?: HoverInfoOptions) { this.engine.activateHoverInfo(options); }
    deactivateHoverInfo() { this.engine.deactivateHoverInfo(); }

    pickAt(pixel: [number, number]): HitResult | null { return this.engine.pickAt(pixel); }

    startDrawing(opts: DrawOptions) { this.engine.startDrawing(opts); }
    stopDrawing() { this.engine.stopDrawing(); }

    enableDrawEditing() { this.engine.enableDrawEditing(); }
    disableDrawEditing() { this.engine.disableDrawEditing(); }

    clearDrawn() { this.engine.clearDrawn(); }

    exportDrawnGeoJSON(opts?: DrawExportOptions) { return this.engine.exportDrawnGeoJSON(opts); }
    importDrawnGeoJSON(text: string, opts?: DrawImportOptions) { this.engine.importDrawnGeoJSON(text, opts); }

    enterFullScreen() { this.engine.enterFullScreen(); }
    leaveFullScreen() { this.engine.leaveFullScreen(); }
    showScaleLine() { this.engine.showScaleLine(); }
    hideScaleLine() { this.engine.hideScaleLine(); }
    showZoomControl() { this.engine.showZoomControl(); }
    hideZoomControl() { this.engine.hideZoomControl(); }

    showAttribution() { this.engine.showAttribution(); }
    hideAttribution() { this.engine.hideAttribution(); }

    activateGeolocation(follow?: boolean) { this.engine.activateGeolocation(follow); }
    deactivateGeolocation() { this.engine.deactivateGeolocation(); }
    zoomToGeolocation(maxZoom?: number) { return this.engine.zoomToGeolocation(maxZoom); }

    // Zoom
    zoomToFeature(layerId: string, featureId: string, opts?: { maxZoom?: number; padding?: number }): boolean {
        return this.engine.zoomToFeature(layerId, featureId, opts);
    }
    zoomToLayer(layerId: string, opts?: { maxZoom?: number; padding?: number }): boolean {
        return this.engine.zoomToLayer(layerId, opts);
    }
    zoomToExtent(extent: Extent, opts?: { maxZoom?: number; padding?: number }): boolean {
        return this.engine.zoomToExtent(extent, opts);
    }
    fitGeometry(geom: Geometry, opts?: { maxZoom?: number; padding?: number }): boolean {
        return this.engine.fitGeometry(geom, opts);
    }
}