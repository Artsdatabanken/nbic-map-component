// src/core/MapEngine.ts
import type { MapInit, MapCoord, CameraState, LayerDef, HitResult, HoverInfoOptions, DrawImportOptions, DrawExportOptions, DrawOptions, DrawStyleOptions, InsertGeomOptions, UpdateGeoJSONLayerOptions, AdoptLayerOptions } from '../api/types';
import type { MapEventMap } from '../api/events';
import type { Emitter } from '../core/state/store';
import type { Extent } from 'ol/extent';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import type BaseLayer from 'ol/layer/Base';

export interface MapEngine {
    init(init: MapInit): Promise<void>;
    destroy(): void;

    getCamera(): CameraState;
    getExtent(): Extent;
    setCenter(center: MapCoord): void;
    setZoom(zoom: number): void;
    fitExtent(extent: Extent, padding: number): void;

    addLayer(def: LayerDef): void;
    removeLayer(layerId: string): void;    
    updateGeoJSONLayer(layerId: string, geojson: string, opts?: UpdateGeoJSONLayerOptions): void;
    setLayerVisibility(layerId: string, visible: boolean): void;
    reorderLayers(order: string[]): void;
    setActiveBase(layerId: string): void;
    adoptLayer(id: string, layer: BaseLayer, opts?: AdoptLayerOptions): void;

    listLayerIds(): string[];
    listBaseLayerIds(): string[];
    listOverlayLayerIds(): string[];
    getLayerById(id: string): BaseLayer | null;

    ejectLayer(id: string): void;  // alias to removeLayer

    pickAt(pixel: [number, number]): HitResult | null;

    activateHoverInfo(options?: HoverInfoOptions): void;
    deactivateHoverInfo(): void;

    startDrawing(opts: DrawOptions): void;
    stopDrawing(): void;
    enableDrawEditing(): void;
    disableDrawEditing(): void;
    clearDrawn(): void;

    exportDrawnGeoJSON(opts?: DrawExportOptions): string;
    importDrawnGeoJSON(geojson: string, opts?: DrawImportOptions): void;

    enterFullScreen(): void;
    leaveFullScreen(): void;
    showScaleLine(): void;
    hideScaleLine(): void;

    showZoomControl(): void;
    hideZoomControl(): void;

    showAttribution(): void;
    hideAttribution(): void;

    // Geolocation
    activateGeolocation(follow?: boolean): void;
    deactivateGeolocation(): void;  
    zoomToGeolocation(maxZoom?: number): Promise<boolean>;

    getVectorLayerSource(layerId: string): VectorSource<Feature<Geometry>> | null;
    addPoint(layerId: string, coord: MapCoord, properties?: Record<string, unknown>, style?: DrawStyleOptions, opts?: InsertGeomOptions): boolean;
    removeAllFromLayer(layerId: string): boolean;

    // Zoom
    zoomToFeature(layerId: string, featureId: string, opts?: { maxZoom?: number; padding?: number }): boolean;
    zoomToLayer(layerId: string, opts?: { maxZoom?: number; padding?: number }): boolean;
    zoomToExtent(extent: Extent, opts?: { maxZoom?: number; padding?: number }): boolean;
    fitGeometry(geom: Geometry, opts?: { maxZoom?: number; padding?: number }): boolean;
}

export type MapEngineFactory = (events: Emitter<MapEventMap>) => MapEngine;