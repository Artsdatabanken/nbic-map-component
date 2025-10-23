// src/core/ol/utils/geometry-analysis.ts
import type OlMap from 'ol/Map';
import type { Feature as OlFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import Feature from 'ol/Feature';
import OLGeoJSON from 'ol/format/GeoJSON';
import kinks from '@turf/kinks';
import type {
    Feature as GJFeature,
    Geometry as GJGeometry,
    FeatureCollection,
    Point,
    LineString,
    Polygon,
    MultiLineString,
    MultiPolygon,
} from 'geojson';

export type SelfIntersectionResult = {
    /** true when there are NO self-intersections */
    valid: boolean;
    /** GeoJSON (WGS84) points for intersections, only present when invalid */
    intersections?: FeatureCollection<Point>;
};

const fmt = new OLGeoJSON();

type KinksSupported =
    | LineString
    | Polygon
    | MultiLineString
    | MultiPolygon;

/** Convert an OL geometry or feature (in view projection) to a GeoJSON Feature in EPSG:4326 */
export function toGeoJSONFeature(
    map: OlMap,
    input: Geometry | OlFeature<Geometry>
): GJFeature<GJGeometry> {
    const viewProj = String(map.getView().getProjection().getCode());
    const feature = input instanceof Feature ? input : new Feature<Geometry>({ geometry: input });
    return fmt.writeFeatureObject(feature, {
        dataProjection: 'EPSG:4326',
        featureProjection: viewProj,
    }) as GJFeature<GJGeometry>;
}

/** Check self-intersections using turf.kinks (LineString/Polygon/Multi*). */
export function checkSelfIntersections(
    map: OlMap,
    input: Geometry | OlFeature<Geometry>
): SelfIntersectionResult {
    const gj = toGeoJSONFeature(map, input);
    const type = gj.geometry?.type;

    // Only meaningful for line/polygonal types
    if (!type || !['LineString', 'Polygon', 'MultiLineString', 'MultiPolygon'].includes(type)) {
        return { valid: true };
    }

    const out = kinks(gj as GJFeature<KinksSupported>);
    const count = out?.features?.length ?? 0;

    return count > 0
        ? { valid: false, intersections: out }
        : { valid: true };
}

/** Optional: convert the returned GeoJSON (WGS84) points to OL features in the map’s view projection. */
export function intersectionPointsToOlFeatures(
    map: OlMap,
    points: FeatureCollection<Point>
): OlFeature<Geometry>[] {
    const viewProj = String(map.getView().getProjection().getCode());
    return fmt.readFeatures(points, {
        dataProjection: 'EPSG:4326',
        featureProjection: viewProj,
    }) as OlFeature<Geometry>[];
}