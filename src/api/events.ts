// src/api/events.ts
import type { CameraState, MapCoord } from './types';
import type Feature from 'ol/Feature';
import type BaseLayer from 'ol/layer/Base';
import type { Extent } from 'ol/extent';
import type { Geometry } from 'ol/geom';
import type { Type } from 'ol/geom/Geometry';

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
    'draw:vertex': { kind: string; index: number; coordinate: MapCoord };
    'draw:vertexRemoved': { kind: string; index: number; };
    'edit:modified': { count: number };
    'geo:position': { coordinate: MapCoord; accuracy?: number } | null;
    'geo:error': { message: string };
    'fullscreen:change': { active: boolean };
    'controls:scaleline': { visible: boolean };
    'controls:zoom': { visible: boolean };
    'controls:attribution': { visible: boolean };
    'base:changed': { regional: string | null; super: string | null };
    'buffer:created': { baseFeature: Feature<Geometry>, bufferFeature: Feature<Geometry>, distance: number, units: string };
    'buffer:interactive:start': {mode: Type};
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
    BaseChanged: 'base:changed',
    HoverInfo: 'hover:info',
    Error: 'error',
    DrawStart: 'draw:start',
    DrawEnd: 'draw:end',
    DrawImported: 'draw:imported',
    DrawCleared: 'draw:cleared',
    DrawVertex: 'draw:vertex',
    DrawVertexRemoved: 'draw:vertexRemoved',
    GeoPosition: 'geo:position',
    GeoError: 'geo:error',
    FullscreenChange: 'fullscreen:change',
    ScaleLineControl: 'controls:scaleline',
    ZoomControl: 'controls:zoom',
    AttributionControl: 'controls:attribution',
    BufferCreated: 'buffer:created',
    BufferInteractiveStart: 'buffer:interactive:start',
    EditModified: 'edit:modified',    
} as const;

// Type helpers
export type MapEventName = keyof MapEventMap;
export type MapEventPayload<K extends MapEventName> = MapEventMap[K];