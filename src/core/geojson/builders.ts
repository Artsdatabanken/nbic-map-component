// src/core/geojson/builders.ts
import type {
    Feature, FeatureCollection, GeoJsonProperties, Geometry, Point, LineString, Polygon, Position
} from 'geojson';

export type IdGetter<T> = (item: T, index: number) => string | number | undefined;
export type PropsGetter<T> = (item: T, index: number) => GeoJsonProperties | undefined;

export type PointGetter<T> = (item: T, index: number) => { lon: number; lat: number } | null;
export type LineGetter<T> = (item: T, index: number) => Position[] | null;
export type PolyGetter<T> = (item: T, index: number) => Position[][] | null;

export type GeometryKind = 'Point' | 'LineString' | 'Polygon';

export interface CommonOptions<T> {
    id?: IdGetter<T>;
    props?: PropsGetter<T>;
    skipInvalid?: boolean;  // default true
    filterNull?: boolean;   // default true
}

export interface PointBuildOptions<T> extends CommonOptions<T> {
    kind: 'Point';
    getPoint: PointGetter<T>;
}
export interface LineBuildOptions<T> extends CommonOptions<T> {
    kind: 'LineString';
    getLine: LineGetter<T>;
}
export interface PolyBuildOptions<T> extends CommonOptions<T> {
    kind: 'Polygon';
    getPolygon: PolyGetter<T>;
}
export type BuildOptions<T> = PointBuildOptions<T> | LineBuildOptions<T> | PolyBuildOptions<T>;

function isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}
function validLonLat(lon: unknown, lat: unknown): lon is number {
    return isFiniteNumber(lon) && isFiniteNumber(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

export function toFeature<T>(item: T, index: number, opts: BuildOptions<T>): Feature<Geometry, GeoJsonProperties> | null {
    const skipInvalid = opts.skipInvalid ?? true;
    let geometry: Geometry | null = null;

    if (opts.kind === 'Point') {
        const p = opts.getPoint(item, index);
        if (!p || !validLonLat(p.lon, p.lat)) {
        // if (!p) {
            if (skipInvalid) return null;
            geometry = { type: 'Point', coordinates: [0, 0] } as Point;
        } else {
            geometry = { type: 'Point', coordinates: [p.lon, p.lat] } as Point;
        }
    } else if (opts.kind === 'LineString') {
        const coords = opts.getLine(item, index);
        if (!coords || coords.length < 2) {
            if (skipInvalid) return null;
            geometry = { type: 'LineString', coordinates: [] } as LineString;
        } else {
            geometry = { type: 'LineString', coordinates: coords } as LineString;
        }
    } else {
        const rings = opts.getPolygon(item, index);
        if (!rings || !rings.length || !rings[0]?.length) {
            if (skipInvalid) return null;
            geometry = { type: 'Polygon', coordinates: [] } as Polygon;
        } else {
            geometry = { type: 'Polygon', coordinates: rings } as Polygon;
        }
    }

    const properties = opts.props?.(item, index) ?? {};
    const f: Feature<Geometry, GeoJsonProperties> = { type: 'Feature', properties, geometry };
    const id = opts.id?.(item, index);
    if (id !== undefined) f.id = id;
    return f;
}

export function toFeatureCollection<T>(items: T[], opts: BuildOptions<T>): FeatureCollection {
    const filterNull = opts.filterNull ?? true;
    const features = items
        .map((item, i) => toFeature(item, i, opts))
        .filter((f): f is Feature<Geometry, GeoJsonProperties> => (filterNull ? !!f : true));
    return { type: 'FeatureCollection', features };
}

/** Handy for cluster label totals (supports your `countField` behavior) */
export function sumProperty(features: Feature[], field = 'count'): number {
    let total = 0;
    for (const f of features) {
        const v = (f.properties as Record<string, unknown> | null | undefined)?.[field];
        const n = Number(v);
        total += Number.isFinite(n) ? n : 1;
    }
    return total;
}
