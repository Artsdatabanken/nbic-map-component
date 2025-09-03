// src/api/events.ts
import type { CameraState, MapCoord, HitResult } from './types';
export type MapEventMap = {
    ready: void;
    destroy: void;
    'camera:changed': CameraState;
    'layer:added': { layerId: string };
    'layer:removed': { layerId: string };
    'pointer:move': { coordinate: MapCoord };
    'pointer:click': HitResult | null;
    'extent:changed': {
        extent: [number, number, number, number];
    };
    'baselayer:changed': { layerId: string | null };
    error: { scope: string; message: string; detail?: unknown };
};

export const MapEvents = {
    Ready: 'ready',
    Destroy: 'destroy',
    CameraChanged: 'camera:changed',
    ExtentChanged: 'extent:changed',
    LayerAdded: 'layer:added',
    LayerRemoved: 'layer:removed',
    PointerMove: 'pointer:move',
    PointerClick: 'pointer:click',
    BaselayerChanged: 'baselayer:changed',
    Error: 'error',
} as const;

// Type helpers
export type MapEventName = keyof MapEventMap;
export type MapEventPayload<K extends MapEventName> = MapEventMap[K];