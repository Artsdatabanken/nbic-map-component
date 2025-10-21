// src/index.ts
export { MapAPI as NbicMapComponent } from './api/MapAPI';
export type { MapInit, LayerDef } from './api/types';
export { createMap } from './factory';

export { MapEvents } from './api/events';
export type { MapEventName, MapEventPayload } from './api/events';