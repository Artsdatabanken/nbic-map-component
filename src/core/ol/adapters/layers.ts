// src/core/ol/adapters/layers.ts
import type { LayerDef, SourceInput, StyleDef } from '../../../api/types';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import type BaseLayer from 'ol/layer/Base';
import VectorSource from 'ol/source/Vector';
import { resolveOlSource } from './sources';
import { toOlStyle } from './styles';

export function toOlLayer(
    def: LayerDef,
    sourceResolver = resolveOlSource,
    styleFn = toOlStyle
): BaseLayer {
    const source = sourceResolver(def.source as SourceInput);

    switch (def.kind) {
        case 'tile':
        case 'raster':
            // expect a tile-compatible source here (OSM/XYZ/WMTS)
            return new TileLayer({ source: source as import('ol/source/Tile').default, visible: def.visible ?? true });

        case 'vector': {
            if (!(source instanceof VectorSource)) {
                // until you implement vector sources, be explicit
                throw new Error(
                    `Layer '${def.id}' is 'vector' but source is not a VectorSource. ` +
                    `Add a vector source adapter (e.g., GeoJSON/WFS) first.`
                );
            }
            return new VectorLayer({
                source,
                style: def.style ? styleFn(def.style as StyleDef) : undefined,
                visible: def.visible ?? true,
            });
        }

        default:
            throw new Error(`Unknown layer kind: ${def.kind as string}`);
    }
}