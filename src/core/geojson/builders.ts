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

// import type {
//     Feature, FeatureCollection, GeoJsonProperties, Geometry, Point, LineString, Polygon, Position
// } from 'geojson';
// import { transform } from 'ol/proj';

// export type IdGetter<T> = (item: T, index: number) => string | number | undefined;
// export type PropsGetter<T> = (item: T, index: number) => GeoJsonProperties | undefined;

// export type PointGetter<T> = (item: T, index: number) => { x: number; y: number } | { lon: number; lat: number } | null;
// export type LineGetter<T> = (item: T, index: number) => Position[] | null;
// export type PolyGetter<T> = (item: T, index: number) => Position[][] | null;

// export interface ReprojectOpts {
//     /** CRS of your INPUT coordinates (e.g. 'EPSG:25833', 'EPSG:4326') */
//     from: string;
//     /** CRS to write into the output GeoJSON. Default 'EPSG:4326'. */
//     to?: string;
// }

// export interface CommonOptions<T> {
//     id?: IdGetter<T>;
//     props?: PropsGetter<T>;
//     skipInvalid?: boolean;  // default true
//     filterNull?: boolean;   // default true
//     /** If provided, reproject geometry coordinates while building */
//     reproject?: ReprojectOpts;
// }

// export interface PointBuildOptions<T> extends CommonOptions<T> {
//     kind: 'Point';
//     getPoint: PointGetter<T>;
// }
// export interface LineBuildOptions<T> extends CommonOptions<T> {
//     kind: 'LineString';
//     getLine: LineGetter<T>;
// }
// export interface PolyBuildOptions<T> extends CommonOptions<T> {
//     kind: 'Polygon';
//     getPolygon: PolyGetter<T>;
// }
// export type BuildOptions<T> = PointBuildOptions<T> | LineBuildOptions<T> | PolyBuildOptions<T>;

// // ---------- helpers ----------
// // function isFiniteNumber(n: unknown): n is number {
// //     return typeof n === 'number' && Number.isFinite(n);
// // }

// function normLonLat(p: { x: number; y: number } | { lon: number; lat: number }) {
//     const lon = 'lon' in p ? p.lon : p.x;
//     const lat = 'lat' in p ? p.lat : p.y;
//     return [lon, lat] as [number, number];
// }

// // function validLonLat(lon: unknown, lat: unknown): lon is number {
// //     return isFiniteNumber(lon) && isFiniteNumber(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
// // }

// function reprojectPosition(pos: Position, from: string, to: string): Position {
//     // pos = [x,y,(z?)] ; transform ignores z, we’ll preserve it if present
//     const x = pos[0];
//     const y = pos[1];
//     if (x === undefined || y === undefined) return pos; // guard for incomplete coordinate
//     const z = pos.length > 2 ? pos[2] : undefined;
//     const [X, Y] = transform([x, y], from, to);
//     if (typeof z === 'number') {
//         return [X!, Y!, z!];
//     }
//     return [X!, Y!];
// }

// function reprojectLine(coords: Position[], from: string, to: string): Position[] {
//     return coords.map(c => reprojectPosition(c, from, to));
// }

// function reprojectPoly(rings: Position[][], from: string, to: string): Position[][] {
//     return rings.map(r => reprojectLine(r, from, to));
// }

// // ---------- main builders ----------
// export function toFeature<T>(item: T, index: number, opts: BuildOptions<T>): Feature<Geometry, GeoJsonProperties> | null {
//     const skipInvalid = opts.skipInvalid ?? true;
//     const repro = opts.reproject;
//     const outCRS = repro?.to ?? 'EPSG:4326';

//     let geometry: Geometry | null = null;

//     if (opts.kind === 'Point') {
//         const p = opts.getPoint(item, index);
//         if (!p) {
//             if (skipInvalid) return null;
//             geometry = { type: 'Point', coordinates: [0, 0] } as Point;
//         } else {
//             const [lon, lat] = normLonLat(p);
//         // If we have reprojection and input isn’t the same as output, transform now
//         if (repro && repro.from && repro.from !== outCRS) {
//                 if (skipInvalid) return null;
//             }
//             geometry = { type: 'Point', coordinates: [lon, lat] } as Point;
//         }    
//     } else if (opts.kind === 'LineString') {
//         const coords = opts.getLine(item, index);
//         if (!coords || coords.length < 2) {
//             if (skipInvalid) return null;
//             geometry = { type: 'LineString', coordinates: [] } as LineString;
//         } else {
//             const projected = repro && repro.from && repro.from !== outCRS
//                 ? reprojectLine(coords, repro.from, outCRS)
//                 : coords;

//             geometry = { type: 'LineString', coordinates: projected } as LineString;
//         }
//     } else {
//         const rings = opts.getPolygon(item, index);
//         if (!rings || !rings.length || !rings[0]?.length) {
//             if (skipInvalid) return null;
//             geometry = { type: 'Polygon', coordinates: [] } as Polygon;
//         } else {
//             const projected = repro && repro.from && repro.from !== outCRS
//                 ? reprojectPoly(rings, repro.from, outCRS)
//                 : rings;

//             geometry = { type: 'Polygon', coordinates: projected } as Polygon;
//         }
//     }

//     const properties = opts.props?.(item, index) ?? {};
//     const f: Feature<Geometry, GeoJsonProperties> = { type: 'Feature', properties, geometry };
//     const id = opts.id?.(item, index);
//     if (id !== undefined) f.id = id;
//     return f;
// }

// export function toFeatureCollection<T>(items: T[], opts: BuildOptions<T>): FeatureCollection {
//     const filterNull = opts.filterNull ?? true;
//     const features = items
//         .map((item, i) => toFeature(item, i, opts))
//         .filter((f): f is Feature<Geometry, GeoJsonProperties> => (filterNull ? !!f : true));
//     return { type: 'FeatureCollection', features };
// }

// /** Optional utility to reproject a whole FeatureCollection post-hoc. */
// export function reprojectFeatureCollection(fc: FeatureCollection, from: string, to = 'EPSG:4326'): FeatureCollection {
//     const out: FeatureCollection = { type: 'FeatureCollection', features: [] };
//     for (const f of fc.features) {
//         if (!f.geometry) { out.features.push(f); continue; }
//         const g = f.geometry;
//         let geom: Geometry = g;

//         if (g.type === 'Point') {
//             geom = { type: 'Point', coordinates: reprojectPosition(g.coordinates, from, to) } as Point;
//         } else if (g.type === 'LineString') {
//             geom = { type: 'LineString', coordinates: reprojectLine(g.coordinates, from, to) } as LineString;
//         } else if (g.type === 'Polygon') {
//             geom = { type: 'Polygon', coordinates: reprojectPoly(g.coordinates, from, to) } as Polygon;
//         } else {
//             // add Multi* / GeometryCollection later if you need
//             geom = g;
//         }
//         out.features.push({ ...f, geometry: geom });
//     }
//     return out;
// }

// /** Sums a numeric property across features (useful for cluster labels with countField). */
// export function sumProperty(features: Feature[], field = 'count'): number {
//     let total = 0;
//     for (const f of features) {
//         const v = (f.properties as Record<string, unknown> | null | undefined)?.[field];
//         const n = Number(v);
//         total += Number.isFinite(n) ? n : 1;
//     }
//     return total;
// }