// src/core/ol/adapters/wfs-loader.ts
import type { WFSDefOptions } from '../../../api/types';
import type { Extent } from 'ol/extent';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import GML32 from 'ol/format/GML32';
import GML3 from 'ol/format/GML3';
import type { ProjectionLike } from 'ol/proj';
import { get as getProjection } from 'ol/proj';
import { getWidth } from 'ol/extent';

/** Optional loader gating (no `any`) */
type ZoomGateOptions = {
    /** Only load when zoom >= this (e.g. 14). If omitted, always load. */
    minZoomToLoad?: number;
    /** (Optional) Do not load when zoom > this. */
    maxZoomToLoad?: number;
    /** Default page size for WFS 2.0.0 when maxFeatures is not provided (count) */
    pageSizeDefault?: number; // e.g. 2000
};

/** Compute zoom from resolution for the given projection (no `any`). */
function zoomFromResolution(resolution: number, projectionLike: ProjectionLike): number {
    const proj = getProjection(projectionLike) || undefined;
    const baseRes = proj?.getExtent() ? getWidth(proj.getExtent()!) / 256 : 156543.03392804097; // EPSG:3857 fallback
    const res = resolution > 0 ? resolution : baseRes;
    const zoom = Math.log2(baseRes / res);
    return Number.isFinite(zoom) ? zoom : 0;
}

/** Strategy that returns [] until zoom >= minZoom, then delegates to bboxStrategy */
function zoomGatedBboxStrategy(minZoom?: number) {
    return (extent: Extent, resolution: number, projection: ProjectionLike): Extent[] => {
        if (typeof minZoom === 'number') {
            const z = zoomFromResolution(resolution, projection);
            if (z < minZoom) return [];
        }
        return bboxStrategy(extent, resolution);
    };
}

/** Build a GetFeature URL for either JSON or GML */
function buildGetFeatureUrl(
    o: WFSDefOptions & ZoomGateOptions,
    extent: Extent,
    srsName: string,
    format: 'json' | 'gml'
): string {
    const version = o.version ?? '2.0.0';
    const is20 = version === '2.0.0';
    const qp = new URLSearchParams({
        service: 'WFS',
        request: 'GetFeature',
        version,
        [is20 ? 'typenames' : 'typename']: o.typeName,
        srsName,
    } as Record<string, string>);

    // BBOX=minx,miny,maxx,maxy,CRS
    qp.set('bbox', `${extent.join(',')},${srsName}`);

    if (format === 'json') {
        qp.set('outputFormat', o.outputFormat ?? 'application/json');
    } else {
        qp.set('outputFormat', o.outputFormat ?? 'text/xml; subtype=gml/3.2.1');
    }

    // If caller didn’t pass maxFeatures, still provide a reasonable count for WFS 2.0.0
    if (is20) {
        const count = o.maxFeatures ?? o.pageSizeDefault ?? 2000;
        qp.set('count', String(count));
    } else if (o.maxFeatures) {
        qp.set('maxFeatures', String(o.maxFeatures));
    }

    if (o.params) Object.entries(o.params).forEach(([k, v]) => qp.set(k, String(v)));

    const sep = o.url.includes('?') ? '&' : '?';
    return `${o.url}${sep}${qp.toString()}`;
}

/** Quick XML normalizer for common MapServer GML 3.2.1 quirks */
function normalizeGmlXml(xmlText: string): Document {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const serializer = new XMLSerializer();
    const normalized = serializer
        .serializeToString(xmlDoc)
        .replace(/srsdimension/g, 'srsDimension')
        .replace(/wfs:member/g, 'wfs:featureMember');

    return parser.parseFromString(normalized, 'text/xml');
}

/** One-time DescribeFeatureType reader (cached) to get featureNS/featureType/geometryName */
type DFTInfo = { featureNS: string; featureType: string; geometryName?: string };
const dftCache = new Map<string, DFTInfo>();

async function describeFeatureTypeOnce(
    baseUrl: string,
    typeName: string,
    version: '2.0.0' | '1.1.0' = '2.0.0'
): Promise<DFTInfo> {
    const cacheKey = `${baseUrl}::${version}::${typeName}`;
    const existing = dftCache.get(cacheKey);
    if (existing) return existing;

    const is20 = version === '2.0.0';
    const qp = new URLSearchParams({
        service: 'WFS',
        request: 'DescribeFeatureType',
        version,
        [is20 ? 'typenames' : 'typename']: typeName,
        outputFormat: 'application/gml+xml; version=3.2',
    });
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}${qp.toString()}`;

    const res = await fetch(url);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');

    const schemaEl = doc.querySelector('schema, xs\\:schema');
    const featureNS = schemaEl?.getAttribute('targetNamespace') || 'http://mapserver.gis.umn.edu/mapserver';

    const local = typeName.includes(':') ? typeName.split(':')[1] : typeName;

    let geometryName: string | undefined;
    const elDef =
        Array.from(doc.querySelectorAll('element, xs\\:element')).find(e => e.getAttribute('name') === local) || null;

    const typeRef = elDef?.getAttribute('type') || null;
    if (typeRef) {
        const localType = typeRef.includes(':') ? typeRef.split(':')[1] : typeRef;
        const complex = Array.from(doc.querySelectorAll('complexType, xs\\:complexType'))
            .find(ct => ct.getAttribute('name') === localType) as Element | undefined;

        if (complex) {
            const propEls = Array.from(complex.querySelectorAll('element, xs\\:element')) as Element[];
            const geomProp = propEls.find(pe => {
                const t = pe.getAttribute('type') ?? '';
                return /gml:.*(Geometry|Point|LineString|Curve|Surface|Polygon|Multi)/i.test(t);
            });
            if (geomProp) geometryName = geomProp.getAttribute('name') || undefined;
        }
    }

    const info: DFTInfo = { featureNS: featureNS ?? '', featureType: local ?? '', geometryName };
    dftCache.set(cacheKey, info);
    return info;
}

/** Main: JSON→GML fallback + robust GML parsing; now with zoom-gated strategy and default count */
export function createWfsVectorSource(
    opts: WFSDefOptions & ZoomGateOptions,
    viewProjection: ProjectionLike
) {
    const preferJson = !opts.outputFormat || /json/i.test(opts.outputFormat);

    const source = new VectorSource({
        // Gate at the strategy level so OL re-calls the loader automatically when zoom crosses the gate.
        strategy: zoomGatedBboxStrategy(opts.minZoomToLoad),
    });

    source.setLoader(async (extent, _resolution, proj) => {
        const srs = opts.srsName ?? String(proj ?? viewProjection);

        const tryOnce = async (fmt: 'json' | 'gml') => {
            const url = buildGetFeatureUrl(opts, extent, srs, fmt);
            const resp = await fetch(url, { headers: opts.headers });
            const text = await resp.text();
            const ct = resp.headers.get('content-type') ?? '';
            return { ok: resp.ok, text, ct, url };
        };

        try {
            // 1) Try JSON first (if desired)
            if (preferJson) {
                const r = await tryOnce('json');
                const looksXml = r.text.trim().startsWith('<');
                const notJsonCT = !/json/i.test(r.ct);

                if (r.ok && !looksXml && !notJsonCT) {
                    const features = new GeoJSON({
                        dataProjection: srs,
                        featureProjection: String(proj ?? viewProjection),
                    }).readFeatures(r.text);
                    source.addFeatures(features);
                    return;
                }
                // else: fall through to GML
            }

            // 2) GML fallback (MapServer-friendly)
            const r2 = await tryOnce('gml');
            if (!r2.ok) {
                throw new Error(`WFS error ${r2.ct} from ${r2.url}: ${r2.text.slice(0, 200)}`);
            }

            const xmlDoc = normalizeGmlXml(r2.text);

            // DescribeFeatureType (cached)
            const version = (opts.version ?? '2.0.0') as '2.0.0' | '1.1.0';
            const dft = {
                featureNS: opts.featureNS,
                featureType: opts.featureType,
                geometryName: opts.geometryName,
            };
            if (!dft.featureNS || !dft.featureType) {
                const info = await describeFeatureTypeOnce(opts.url, opts.typeName, version);
                dft.featureNS = dft.featureNS ?? info.featureNS;
                dft.featureType = dft.featureType ?? info.featureType;
                dft.geometryName = dft.geometryName ?? info.geometryName;
            }

            // Decide parser flavor
            const isGml32 =
                /gml\/3\.2/i.test(r2.ct) ||
                /version=3\.2/i.test(r2.text) ||
                r2.text.includes('http://www.opengis.net/gml/3.2');

            const gml = isGml32
                ? new GML32({ featureNS: dft.featureNS!, featureType: dft.featureType!, srsName: srs })
                : new GML3({ featureNS: dft.featureNS!, featureType: dft.featureType!, srsName: srs });

            // Optional parser table remap (typed)
            const tbl: Record<string, object> | undefined =
                (gml as unknown as Record<string, Record<string, object>>)['FEATURE_COLLECTION_PARSERS'];
            if (tbl && tbl['http://www.opengis.net/gml/3.2']) {
                tbl['http://www.opengis.net/gml'] = tbl['http://www.opengis.net/gml/3.2'];
                tbl['http://www.opengis.net/wfs/2.0'] = tbl['http://www.opengis.net/gml/3.2'];
            }

            let features = gml.readFeatures(xmlDoc, {
                dataProjection: srs,
                featureProjection: String(proj ?? viewProjection),
                ...(dft.geometryName ? { geometryName: dft.geometryName } : {}),
            });

            if (!features.length) {
                const serialized = new XMLSerializer().serializeToString(xmlDoc);
                features = gml.readFeatures(serialized, {
                    dataProjection: srs,
                    featureProjection: String(proj ?? viewProjection),
                    ...(dft.geometryName ? { geometryName: dft.geometryName } : {}),
                });
            }

            if (features.length) {
                source.addFeatures(features);
            } else {
                // eslint-disable-next-line no-console
                console.warn('[WFS] Parsed 0 features', {
                    url: r2.url,
                    featureNS: dft.featureNS,
                    featureType: dft.featureType,
                    geometryName: dft.geometryName,
                    isGml32,
                });
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('WFS loader error', err);
        }
    });

    return source;
}