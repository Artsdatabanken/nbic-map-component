// src/factory.ts
import { MapAPI } from './api/MapAPI';
import { MapConfigSchema } from './api/config.schema';
import { initMapFromConfig } from './api/config-loader';

export function createMap(target: string | HTMLElement, rawConfig: unknown) {
    const cfg = MapConfigSchema.parse(rawConfig);

    const map = new MapAPI({
        target,
        projection: cfg.projection,
        center: cfg.center,
        zoom: cfg.zoom,
        minZoom: cfg.minZoom,
        maxZoom: cfg.maxZoom,
    });

    // apply the rest (sources/layers/etc.)
    initMapFromConfig(map, cfg);

    return map;
}