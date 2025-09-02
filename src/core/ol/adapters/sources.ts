// src/core/ol/adapters/sources.ts
import type { SourceDef, SourceInput, WMTSDefOptions, XYZDefOptions } from '../../../api/types';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import WMTS from 'ol/source/WMTS';
import type { Options as WMTSOptions } from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import VectorSource from 'ol/source/Vector';
import type { Feature } from 'ol';

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
            const opts: WMTSDefOptions = def.options;
            if (!opts.url || !opts.layer || !opts.matrixSet) {
                throw new Error('WMTS source requires url, layer, matrixSet');
            }

            const grid: WMTSTileGrid | undefined =
                (opts.tileGrid as WMTSTileGrid | undefined) ??
                (opts.resolutions && opts.origin
                    ? new WMTSTileGrid({
                        matrixIds: opts.matrixIds ?? [],
                        resolutions: opts.resolutions,
                        origin: opts.origin,
                        tileSize: opts.tileSize ?? 256,
                    })
                    : undefined);

            if (!grid) {
                throw new Error('WMTS source requires a valid tileGrid (either provided or constructed from resolutions and origin)');
            }
            const init: WMTSOptions = {
                url: opts.url,
                layer: opts.layer,
                matrixSet: opts.matrixSet,
                format: opts.format ?? 'image/png',
                style: opts.style ?? 'default',
                tileGrid: grid,
            };

            return new WMTS(init);
        }

        case 'wfs': {
            throw new Error('WFS source type is not supported in this adapter.');
        }
        default: {
            const type = (def as { type?: string }).type;
            throw new Error(`Unknown source type: ${type}`);
        }
    }
}