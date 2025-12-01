// src/core/ol/utils/area.ts (or similar)
import type { Polygon as GJPolygon, Feature as GJFeature } from 'geojson';
import area from '@turf/area';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { MapCoord } from '../../../api/types';
import { getCenter } from 'ol/extent';

function ensureClosedRing(ring: number[][]): number[][] {
    const first = ring[0];
    const last = ring[ring.length - 1];
    const isClosed = first![0] === last![0] && first![1] === last![1];
    return isClosed ? ring : [...ring, first] as number[][];
}

/**
 * Compute area (m²) from a lon/lat ring (EPSG:4326).
 * `ring` is an array of [lon, lat] coordinates.
 */

export function areaFromLonLatRing(ring: number[][]): number {
    if (!ring.length) return 0;

    // ensure ring is closed
    // const first = ring[0];
    // const last = ring[ring.length - 1];
    // const isClosed = first![0] === last![0] && first![1] === last![1];
    // const coords = isClosed ? ring : [...ring, first] as number[][];
    const coords = ensureClosedRing(ring);

    const poly: GJFeature<GJPolygon> = {
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

export function getCenterFromPolygon(polygonCoordinates: number[][]): MapCoord | null {
    const closedRing = ensureClosedRing(polygonCoordinates);
    const polygon = new Feature<Polygon>({
        geometry: new Polygon([closedRing])
    });
    if (polygon) {
        const extent = polygon.getGeometry()?.getExtent();
        if (extent) {
            const coordinate = getCenter(extent);
            return coordinate as MapCoord;
        }
    }
    return null;        
}