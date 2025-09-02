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
    error: { scope: string; message: string; detail?: unknown };
};