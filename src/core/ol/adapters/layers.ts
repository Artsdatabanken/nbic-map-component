// src/core/ol/adapters/layers.ts
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/Tile';
import TileSource from 'ol/source/Tile';
import type BaseLayer from 'ol/layer/Base';
import { resolveOlSource } from './sources';
import type { LayerDef, SourceDef } from '../../../api/types';
import { toOlStyle } from './styles';
import { makeDrawStyle } from './draw-style';
import { createDefaultStyle } from 'ol/style/Style';
import type { StyleLike } from 'ol/style/Style';
// import type Style from 'ol/style/Style';
import FeatureLike from 'ol/Feature';
// import TileSource from 'ol/source/Tile';
// import type VectorSource  from 'ol/source/Vector';

// function styleKey(v: unknown) {
//     try { return JSON.stringify(v); } catch { return String(v); }
// }

function styleFromFeature(feature: FeatureLike, resolution: number): StyleLike {
    const anyFeat = feature;
    const nbic =
        typeof anyFeat.get === 'function' ? anyFeat.get('nbic:style') : undefined;

    if (nbic) {
        return makeDrawStyle(nbic); // your helper that returns a Style/Style[]
    }
    return createDefaultStyle(feature, resolution); // OL’s safe default
}

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
                // const src = resolveOlSource(def.source, resolveRef) as OlVectorSource;
                const styleFunction = (feature: FeatureLike, resolution: number): StyleLike =>
                    styleFromFeature(feature, resolution);

                const style = def.style ? styleFn(def.style) : styleFunction;

                layer = new VectorLayer({
                    source: src,
                    visible: def.visible !== false,
                    zIndex: def.zIndex,
                    style: style as StyleLike, //styleFn as unknown as StyleLike,
                    properties: { id: def.id },
                });

                // let style = def.style ? styleFn(def.style as StyleDef) : undefined;

                // // If no style was provided, fall back to reading nbic:style per-feature
                // if (!style) {
                //     console.log('No style for layer', def.id, '- falling back to nbic:style per feature');
                //     style = (feature) => {
                //         const opts = feature.get('nbic:style');                                                
                //         return opts ? makeDrawStyle(opts) : undefined; // OL default if undefined
                //     };
                // }

                // console.log('Style for layer', def.id, ':', style);

                // layer = new VectorLayer({
                //     source: src,
                //     visible: def.visible !== false,
                //     zIndex: def.zIndex,
                //     style,
                //     properties: { id: def.id },
                // });
                // src is a VectorSource
                // layer = new VectorLayer({
                //     source: src as VectorSource,
                //     style: def.style ? styleFn(def.style as StyleDef) : undefined,
                //     visible: def.visible ?? true,
                // });
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