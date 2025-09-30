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
} from './types';
import type { MapEngine } from '../core/MapEngine';
import { createEmitter } from '../core/state/store';
import { createOlEngine } from '../core/ol/OlMapEngine';
import type { MapEventMap } from './events';
import type { Extent } from 'ol/extent';
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
    getBaseLayers(): LayerDef[] {
        return Array.from(this.layerDefs.values()).filter(l => !!l.base);
    }

    /** Return all layers that are not base (overlays). */
    getOverlayLayers(): LayerDef[] {
        return Array.from(this.layerDefs.values()).filter(l => !l.base);
    }

    /** Convenience if you just need IDs */
    getBaseLayerIds(): string[] {
        return this.getBaseLayers().map(l => l.id);
    }
    getOverlayLayerIds(): string[] {
        return this.getOverlayLayers().map(l => l.id);
    }

    setCenter(center: MapCoord) { this.engine.setCenter(center); }
    setZoom(zoom: number) { this.engine.setZoom(zoom); }
    fitExtent(extent: Extent, padding = 16) { this.engine.fitExtent(extent, padding); }

    addLayer(layer: LayerDef) { this.layerDefs.set(layer.id, layer); this.engine.addLayer(layer); this.events.emit('layer:added', { layerId: layer.id }); }
    removeLayer(layerId: string) { this.layerDefs.delete(layerId); this.engine.removeLayer(layerId); this.events.emit('layer:removed', { layerId }); }
    setLayerVisibility(layerId: string, visible: boolean) { this.engine.setLayerVisibility(layerId, visible); }
    reorderLayers(order: string[]) { this.engine.reorderLayers(order); }

    addPoint(layerId: string, coord: MapCoord, properties?: Record<string, unknown>, style?: DrawStyleOptions, opts?: InsertGeomOptions): boolean { return this.engine.addPoint(layerId, coord, properties, style, opts); }
    removeAllFromLayer(layerId: string): boolean { return this.engine.removeAllFromLayer(layerId); }

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
}