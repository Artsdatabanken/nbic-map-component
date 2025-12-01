// src/core/MapEngine.ts
import type { MapInit, MapCoord, CameraState, LayerDef, HitResult, HoverInfoOptions, DrawImportOptions, DrawExportOptions, DrawOptions, DrawStyleOptions, InsertGeomOptions, UpdateGeoJSONLayerOptions, AdoptLayerOptions, EnableEditingOptions } from '../api/types';
import type { MapEventMap } from '../api/events';
import type { Emitter } from '../core/state/store';
import type { Extent } from 'ol/extent';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import type { Geometry } from 'ol/geom';
import type BaseLayer from 'ol/layer/Base';
import type Control from 'ol/control/Control';
import type { FeatureLike } from 'ol/Feature';

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
    adoptControl(control: Control, id?: string): string;
    removeControl(id: string): boolean;
    listCustomControlIds(): string[];
    getCustomControl(id: string): Control | undefined;
    listLayerIds(): string[];
    listBaseLayerIds(): string[];
    listOverlayLayerIds(): string[];
    getLayerById(id: string): BaseLayer | null;

    ejectLayer(id: string): void;  // alias to removeLayer

    getFeatureCount(layerId: string): number;
    getFeatures(layerId: string): Feature<Geometry>[] | null;

    // geometry analysis
    analyzeSelfIntersections(feature: FeatureLike): Promise<{ valid: boolean; intersections?: unknown }>;

    pickAt(pixel: [number, number]): HitResult | null;

    activateHoverInfo(options?: HoverInfoOptions): void;
    deactivateHoverInfo(): void;

    startDrawing(opts: DrawOptions): void;

    stopDrawing(): void;
    enableDrawEditing(opts?: EnableEditingOptions): void;
    disableDrawEditing(): void;
    undoLastPoint(): void;
    finishCurrent(): void;
    abortCurrent(): void;
    clearDrawn(): void;
    setDrawnFeatureStyle(feature: Feature<Geometry>, style: DrawStyleOptions): void;
    clearDrawnFeatureStyle(feature: Feature<Geometry>): void;
    setFeatureStyle(layerId: string, featureId: string | number, style: DrawStyleOptions): boolean;
    clearFeatureStyle(layerId: string, featureId: string | number): boolean;

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

    getVectorLayerSource(layerId: string): VectorSource<FeatureLike> | null;
    addPoint(layerId: string, coord: MapCoord, properties?: Record<string, unknown>, style?: DrawStyleOptions, opts?: InsertGeomOptions): boolean;
    removeAllFromLayer(layerId: string): boolean;

    // Transform coordinates
    transformCoordsFrom(coord: [number, number], from: string, to: string): [number, number];
    transformCoordsArrayFrom(coords: number[][], from: string, to: string): number[][];
    transformExtentFrom(extent: Extent, from: string, to: string): number[] | null;

    // Zoom
    zoomToFeature(layerId: string, featureId: string, opts?: { maxZoom?: number; padding?: number }): boolean;
    zoomToLayer(layerId: string, opts?: { maxZoom?: number; padding?: number }): boolean;
    zoomToExtent(extent: Extent, opts?: { maxZoom?: number; padding?: number }): boolean;
    fitGeometry(geom: Geometry, opts?: { maxZoom?: number; padding?: number }): boolean;

    // Utils
    getTargetElement(): HTMLElement | null;
    getCenterFromExtent(extent: Extent): MapCoord;
}

export type MapEngineFactory = (events: Emitter<MapEventMap>) => MapEngine;