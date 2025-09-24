// src/core/ol/adapters/sources.ts
import type { SourceDef, SourceInput, WMTSDefOptions, XYZDefOptions, WFSDefOptions } from '../../../api/types';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import WMTS from 'ol/source/WMTS';
// import type { Options as WMTSOptions } from 'ol/source/WMTS';
// import WMTSTileGrid from 'ol/tilegrid/WMTS';
import VectorSource from 'ol/source/Vector';
import type { Feature } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import { get as getProjection } from 'ol/proj';
import { makeGridFromExtent } from './wmts-grid';
import { createWfsVectorSource } from './wfs-loader';
import {mapBounds } from '../../projections';
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

            // Resolve projection & extent
            const proj = o.projection ? getProjection(o.projection) : undefined;
            let extent = o.extent ?? (proj?.getExtent() as [number, number, number, number] | undefined);

            // Optional: fallback to known bounds if projection has none (mapBounds)
            if (!extent && o.projection) {
                const b = mapBounds.find(m => m.epsg === o.projection);
                if (b) extent = b.extent as [number, number, number, number];
            }

            if (!extent) {
                throw new Error(
                    `WMTS ${o.layer}: missing projection extent; set options.extent or ensure projection is registered with an extent.`
                );
            }
            
            const grid = makeGridFromExtent(extent, o.tileSize ?? 256, o.levels ?? 19);

            // REST vs KVP – Kartverket product URLs end with /1.0.0/
            const isRest = /\/1\.0\.0\/?$/.test(o.url);
            const baseUrl = o.url.replace(/\/?$/, '/');

            return new WMTS({
                layer: o.layer,
                matrixSet: o.matrixSet,
                format: o.format ?? 'image/png',
                style: o.style ?? 'default',
                tileGrid: grid,
                wrapX: o.wrapX ?? false,      // UTM: usually false
                transition: 0,
                attributions: o.attribution,
                ...(proj ? { projection: proj } : {}), // only include if defined
                ...(isRest
                    ? { urls: [baseUrl], requestEncoding: 'REST' as const }
                    : { url: o.url, requestEncoding: 'KVP' as const }),
            });
        }

        case 'geojson': {
            const { url } = def.options;            
            return new VectorSource({
                url,
                format: new GeoJSON(),  // always reproject to view projection
            });
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