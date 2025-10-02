// src/core/ol/adapters/sources.ts
import type { SourceDef, SourceInput, WMTSDefOptions, XYZDefOptions, WFSDefOptions, GeoJSONDefOptions } from '../../../api/types';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import WMTS from 'ol/source/WMTS';
// import type { Options as WMTSOptions } from 'ol/source/WMTS';
// import WMTSTileGrid from 'ol/tilegrid/WMTS';
import VectorSource from 'ol/source/Vector';
import type { Feature } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
// import { get as getProjection } from 'ol/proj';
import { makeGridFromExtent } from './wmts-grid';
import { createWfsVectorSource } from './wfs-loader';
import {mapBounds } from '../../projections';
import type { Geometry } from 'ol/geom';
// import type { Projection } from 'ol/proj';
import { get as getProj } from 'ol/proj';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { getTopLeft, getWidth, Extent } from 'ol/extent';
import { wmtsPreset, WMTSPresetKey } from './wmts-presets';

// import TileLayer from 'ol/layer/Tile';
// import { getWidth } from 'ol/extent';


export type OlTileSource = OSM | XYZ | WMTS;
export type OlVectorSource = VectorSource<Feature>;
export type OlSource = OlTileSource | OlVectorSource;

// Resolve an inline source or a {ref} using a provided resolver.
// By default, ref resolution throws until you wire a registry.
export function resolveOlSource(
    input: SourceInput,
    resolveRef: (id: string) => OlSource = (id) => {
        throw new Error(`Source ref '${id}' cannot be resolved (no registry wired).`);
    }
): OlSource {
    if ('ref' in input) {
        return resolveRef(input.ref);
    }
    return toOlSource(input);
}

// Inline-only mapping (no refs here)
export function toOlSource(def: SourceDef): OlSource {
    switch (def.type) {
        case 'osm':
            return new OSM();

        case 'xyz': {
            const opts: XYZDefOptions = def.options;
            return new XYZ({
                url: opts.url,
                minZoom: opts.minZoom,
                maxZoom: opts.maxZoom,
                attributions: opts.attributions,
                tileSize: opts.tileSize,
            });
        }

        case 'wmts': {                      
            const o = def.options as WMTSDefOptions;
            const tileSize = o.tileSize ?? 256;
            const levels = o.levels ?? 18;

            let tileGrid: WMTSTileGrid | undefined;            

            // 1) Svalbard/Jan Mayen preset (NP ‘default028mm’ matrix) – origin/res from matrixExtent
            function buildGridFromPreset(
                p: { matrixIds: string[]; extent?: Extent; matrixExtent?: Extent; layerExtent?: Extent },
                tileSize: number,
                levels: number
            ) {
                const matrixExtent = p.matrixExtent ?? p.extent!;
                const layerExtent = p.layerExtent ?? p.extent!;
                return new WMTSTileGrid({
                    origin: getTopLeft(matrixExtent),
                    resolutions: Array.from({ length: levels }, (_, z) =>
                        (getWidth(matrixExtent) / tileSize) / Math.pow(2, z)
                    ),
                    matrixIds: p.matrixIds,
                    tileSize,
                    extent: layerExtent, // clip to visible data
                });
            }            

            // Only try presets when the server expects the special ArcGIS set id
            const wantsDefault028 =
                o.matrixSetId === 'default028mm' || o.matrixSet === 'default028mm';

            if (!tileGrid && wantsDefault028) {
                // Map projection → preset key
                const presetKeyByProj: Record<string, WMTSPresetKey> = {
                    'EPSG:32633': 'npolar-svalbard-32633',
                    'EPSG:25833': 'npolar-janmayen-25833',
                };
                const key = o.projection ? presetKeyByProj[o.projection] : undefined;

                if (key) {
                    const p = wmtsPreset(key);
                    tileGrid = buildGridFromPreset(p, tileSize, levels);
                }
            }
            // 3) Generic: derive grid from projection/layer extent (old behavior)
            if (!tileGrid) {
                const proj = o.projection ? getProj(o.projection) : undefined;

                const extent: Extent | undefined =
                    o.extent
                    ?? (proj?.getExtent() as Extent | undefined)
                    ?? (o.projection ? mapBounds.find(m => m.epsg === o.projection)?.extent as Extent | undefined : undefined);

                if (!extent) {
                    throw new Error(
                        `WMTS ${o.layer}: missing projection extent; set options.extent or ensure projection is registered with an extent.`
                    );
                }
                tileGrid = makeGridFromExtent(extent, tileSize, levels);
            }

            // REST vs KVP detection (keep what worked for you before)
            const isRest = /\/1\.0\.0\/?$/i.test(o.url) || /\/wmts\/1\.0\.0\//i.test(o.url);
            const baseUrl = o.url.replace(/\/?$/, '/');

            const src = new WMTS({
                layer: o.layer,
                matrixSet: o.matrixSetId ?? o.matrixSet ?? 'EPSG:3857',
                format: o.format ?? 'image/png',
                style: o.style ?? 'default',
                tileGrid,
                wrapX: o.wrapX ?? false,                // UTM usually false
                transition: 0,
                attributions: o.attribution,
                ...(o.projection ? { projection: getProj(o.projection)! } : {}),
                ...(isRest
                    ? { urls: [baseUrl], requestEncoding: 'REST' as const }
                    : { url: o.url, requestEncoding: 'KVP' as const }),
                crossOrigin: 'anonymous',
            });

            // Optional param overrides (e.g., force tilematrixset)
            if (o.urlParamOverrides && Object.keys(o.urlParamOverrides).length) {
                const orig = src.getTileUrlFunction();
                src.setTileUrlFunction((coord, pr, pj) => {
                    const u = new URL(String(orig(coord, pr, pj)), window.location.origin);
                    for (const [k, v] of Object.entries(o.urlParamOverrides!)) u.searchParams.set(k, v);
                    return u.toString();
                });
            }

            return src;
        }

        case 'geojson': {
            const opts = def.options as GeoJSONDefOptions;

            // Inline string (opts.text) → create an empty source and inject features
            if (opts.text && opts.text.trim().length) {                
                const fmt = new GeoJSON({ dataProjection: opts.dataProjection, featureProjection: opts.featureProjection });
                const features = fmt.readFeatures(opts.text);
                const src = new VectorSource<Feature<Geometry>>();
                if (features.length) src.addFeatures(features);
                return src;
            }

            // URL → let OL load for us
            if (opts.url) {                
                return new VectorSource<Feature<Geometry>>({
                    url: opts.url,
                    format: new GeoJSON({ dataProjection: opts.dataProjection, featureProjection: opts.featureProjection }),
                });
            }

            throw new Error('geojson source: provide either options.url or options.text');
        }

        case 'wfs': {
            const o = def.options as WFSDefOptions;

            // Choose the target projection for features (match the map’s view)
            // If your engine always creates the view first, you can pass it down instead; here we default to srsName or EPSG:3857.
            const viewProj = o.srsName ?? 'EPSG:3857';

            return createWfsVectorSource(o, viewProj);
        }

        case 'memory': {
            // empty, in-memory vector source for markers/graphics
            return new VectorSource<Feature>();
        }
        
        default: {
            const type = (def as { type?: string }).type;
            throw new Error(`Unknown source type: ${type}`);
        }
    }
}