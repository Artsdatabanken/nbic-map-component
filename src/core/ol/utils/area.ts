// src/core/ol/utils/area.ts (or similar)
import type { Polygon as GJPolygon, Feature } from 'geojson';
import area from '@turf/area';

/**
 * Compute area (m²) from a lon/lat ring (EPSG:4326).
 * `ring` is an array of [lon, lat] coordinates.
 */

export function areaFromLonLatRing(ring: number[][]): number {
    if (!ring.length) return 0;

    // ensure ring is closed
    const first = ring[0];
    const last = ring[ring.length - 1];
    const isClosed = first![0] === last![0] && first![1] === last![1];
    const coords = isClosed ? ring : [...ring, first] as number[][];

    const poly: Feature<GJPolygon> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [coords],
        },
    };

    return area(poly); // m²
}

export function areaToString(m2: number): string {    
    if (m2 > 10000) {
        return Math.round((m2 / 1000000) * 100) / 100 + ' km\xB2';
    } else {
        return Math.round(m2 * 100) / 100 + ' m\xB2';
    }
}