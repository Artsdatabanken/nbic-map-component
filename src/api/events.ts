// src/api/events.ts
import type { CameraState, MapCoord } from './types';
import type Feature from 'ol/Feature';
import type BaseLayer from 'ol/layer/Base';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';

export type MapEventMap = {
    ready: void;
    destroy: void;
    'camera:changed': CameraState;
    'layer:added': { layerId: string };
    'layer:removed': { layerId: string };
    'pointer:move': { coordinate: MapCoord };
    'pointer:click': { features: { feature: Feature; layer: BaseLayer }[] } | null;
    'extent:changed': {
        extent: Extent;
    };
    'baselayer:changed': { layerId: string | null };
    'hover:info': {
        coordinate: MapCoord;
        items: { feature: Feature; layer: BaseLayer }[];
    } | null;
    'draw:start': { kind: string };
    'draw:end': { feature: Feature<Geometry> };
    'draw:imported': { count: number };
    'draw:cleared': { count: number };
    'edit:modified': { count: number };
    'geo:position': { coordinate: MapCoord; accuracy?: number } | null;
    'geo:error': { message: string };
    'fullscreen:change': { active: boolean };
    'controls:scaleline': { visible: boolean };
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
    HoverInfo: 'hover:info',
    Error: 'error',
} as const;

// Type helpers
export type MapEventName = keyof MapEventMap;
export type MapEventPayload<K extends MapEventName> = MapEventMap[K];