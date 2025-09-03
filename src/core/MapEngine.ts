// src/core/MapEngine.ts
import type { MapInit, MapCoord, CameraState, LayerDef, Extent, HitResult } from '../api/types';
import type { MapEventMap } from '../api/events';
import type { Emitter } from '../core/state/store';

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
}

export type MapEngineFactory = (events: Emitter<MapEventMap>) => MapEngine;