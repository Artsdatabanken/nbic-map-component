// src/core/ol/adapters/layers.ts
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import TileSource from 'ol/source/Tile';
import type BaseLayer from 'ol/layer/Base';
import { resolveOlSource } from './sources';
import type { LayerDef, SourceDef, StyleDef } from '../../../api/types';
import { toOlStyle } from './styles';
// import TileSource from 'ol/source/Tile';
// import type VectorSource  from 'ol/source/Vector';

export function toOlLayer(
    def: LayerDef,
    sourceFn = resolveOlSource,
    styleFn = toOlStyle
): BaseLayer {
    const src = typeof def.source === 'string'
        ? sourceFn({ ref: def.source })
        : sourceFn(def.source as SourceDef);

    let layer: BaseLayer;
    switch (def.kind) {
        case 'tile':
        case 'raster':
            if (src instanceof TileSource) {
                // src is a TileSource
                layer = new TileLayer({ source: src, visible: def.visible ?? true });
            } else {
                throw new Error('Source for tile/raster layer must be a TileSource');
            }
            break;
        case 'vector':
            if (src instanceof VectorSource) {
                // src is a VectorSource
                layer = new VectorLayer({
                    source: src as VectorSource,
                    style: def.style ? styleFn(def.style as StyleDef) : undefined,
                    visible: def.visible ?? true,
                });
            } else {
                throw new Error('Source for vector layer must be a VectorSource');
            }
            break;
        default:
            throw new Error(`Unknown layer kind: ${def.kind}`);
    }

    layer.set('id', def.id);

    // ✨ render gates
    if (def.minZoom !== undefined && 'setMinZoom' in layer) (layer as TileLayer | VectorLayer).setMinZoom(def.minZoom);
    if (def.maxZoom !== undefined && 'setMaxZoom' in layer) (layer as TileLayer | VectorLayer).setMaxZoom(def.maxZoom);

    return layer;
}