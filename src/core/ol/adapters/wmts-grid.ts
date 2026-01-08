// src/core/ol/adapters/wmts-grid.ts
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { getTopLeft, getWidth, Extent } from 'ol/extent';

export function makeGridFromExtent(extent: Extent, tileSize = 256, levels = 19): WMTSTileGrid {
    const size = getWidth(extent) / tileSize;
    const resolutions = Array.from({ length: levels }, (_, z) => size / Math.pow(2, z));
    const matrixIds = Array.from({ length: levels }, (_, z) => z.toString());
    return new WMTSTileGrid({
        origin: getTopLeft(extent),
        resolutions,
        matrixIds,
        tileSize,
        extent,
    });
}