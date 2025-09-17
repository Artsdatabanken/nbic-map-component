// src/core/MapEngine.ts
import type { MapInit, MapCoord, CameraState, LayerDef, HitResult, HoverInfoOptions, DrawImportOptions, DrawExportOptions, DrawOptions } from '../api/types';
import type { MapEventMap } from '../api/events';
import type { Emitter } from '../core/state/store';
import type { Extent } from 'ol/extent';

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
    setLayerVisibility(layerId: string, visible: boolean): void;
    reorderLayers(order: string[]): void;

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
}

export type MapEngineFactory = (events: Emitter<MapEventMap>) => MapEngine;