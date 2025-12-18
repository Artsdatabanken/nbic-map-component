// src/core/ol/utils/area.ts (or similar)
import type { Polygon as GJPolygon, Feature as GJFeature } from 'geojson';
import area from '@turf/area';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { MapCoord } from '../../../api/types';
import { getCenter } from 'ol/extent';

export function ensureClosedRing(ring: number[][]): number[][] {
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

export function getExtentFromPolygon(
    polygonCoordinates: number[][]
): number[] | null {
    if (!polygonCoordinates?.length) return null;

    const closedRing = ensureClosedRing(polygonCoordinates);

    const polygon = new Feature<Polygon>({
        geometry: new Polygon([closedRing]),
    });

    return polygon.getGeometry()?.getExtent() ?? null;
}

export function isExtentInside(
    inner: number[],
    outer: number[]
): boolean {
    if (inner === undefined || outer === undefined) return false;
    if (inner.length !== 4 || outer.length !== 4) return false;
    return (    
        inner[0]! >= outer[0]! && // minX
        inner[1]! >= outer[1]! && // minY
        inner[2]! <= outer[2]! && // maxX
        inner[3]! <= outer[3]!    // maxY
    );
}

export function isPointInsideExtent(
    coord: MapCoord,
    extent: number[]
): boolean {
    if (coord === undefined || extent === undefined) return false;
    if (extent.length !== 4) return false;
    const [x, y] = coord;
    return (
        x >= extent[0]! && // minX
        y >= extent[1]! && // minY
        x <= extent[2]! && // maxX
        y <= extent[3]!    // maxY
    );
}