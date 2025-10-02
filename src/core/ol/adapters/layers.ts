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
import type { FeatureLike } from 'ol/Feature';
import ClusterSource from 'ol/source/Cluster';
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import type { StyleFunction } from 'ol/style/Style';
// import TileSource from 'ol/source/Tile';
// import type VectorSource  from 'ol/source/Vector';

// function styleKey(v: unknown) {
//     try { return JSON.stringify(v); } catch { return String(v); }
// }

function styleFromFeature(feature: FeatureLike, resolution: number): Style | Style[] | void { 
    const nbic =
        typeof feature.get === 'function' ? feature.get('nbic:style') : undefined;

    return nbic ? makeDrawStyle(nbic) : createDefaultStyle(feature, resolution);
}

function defaultClusterStyle(size: number) {
    return new Style({
        image: new CircleStyle({
            radius: 12,
            fill: new Fill({ color: '#3399CC' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
        text: new Text({
            text: size.toString(),
            fill: new Fill({ color: '#fff' }),
        }),
    });
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
                layer = new TileLayer({ source: src, visible: def.visible ?? true, opacity: def.opacity ?? 1 });
            } else {
                throw new Error('Source for tile/raster layer must be a TileSource');
            }
            break;
        case 'vector':
            if (src instanceof VectorSource) {
                // const src = resolveOlSource(def.source, resolveRef) as OlVectorSource;
                // const styleFunction = (feature: FeatureLike, resolution: number): StyleLike =>
                //     styleFromFeature(feature, resolution);

                // const style = def.style ? styleFn(def.style) : styleFunction;

                // layer = new VectorLayer({
                //     source: src,
                //     visible: def.visible !== false,
                //     zIndex: def.zIndex,
                //     style: style as StyleLike, //styleFn as unknown as StyleLike,
                //     properties: { id: def.id },
                // });
                
                // let finalSource = src;
                // // 🔑 Cluster wrap
                // if (def.cluster?.enabled) {
                //     finalSource = new ClusterSource({
                //         distance: def.cluster.distance ?? 40,
                //         minDistance: def.cluster.minDistance,
                //         source: src as VectorSource,
                //     });
                // }

                // const style =
                //     def.cluster?.enabled
                //         ? (feature: FeatureLike) => {
                //             const features = feature.get('features');
                //             const size = features ? features.length : 1;
                //             // use provided cluster style or default
                //             return def.cluster?.style
                //                 ? styleFn(def.cluster.style)
                //                 : defaultClusterStyle(size);
                //         }
                //         : def.style
                //             ? styleFn(def.style)
                //             : (f: FeatureLike, r: number) => styleFromFeature(f, r);

                const finalSource = def.cluster?.enabled
                    ? new ClusterSource({
                        distance: def.cluster.distance ?? 40,
                        minDistance: def.cluster.minDistance,
                        source: src,
                    })
                    : src;

                // Pre-resolve explicit layer style (might be Style | Style[] | StyleFunction)
                const explicitLayerStyle = def.style ? styleFn(def.style) : undefined;
                const explicitClusterStyle = def.cluster?.enabled && def.cluster.style ? styleFn(def.cluster.style) : undefined;

                // Style function that handles both clustered and non-clustered cases
                const style: StyleFunction = (feature: FeatureLike, resolution: number): Style | Style[] | void => {
                    // If this is a clustered feature, it will have 'features' array
                    const members: FeatureLike[] | undefined = (feature).get?.('features');
                    const size = members?.length ?? 0;

                    if (def.cluster?.enabled && members) {
                        if (size === 1) {
                            // Render as original feature style
                            const inner = members[0];

                            if (inner && typeof explicitLayerStyle === 'function') {
                                return explicitLayerStyle(inner, resolution);
                            }
                            if (explicitLayerStyle) {
                                // If explicitLayerStyle is a function, call it, else return as Style/Style[]
                                if (typeof explicitLayerStyle === 'function' && inner) {
                                    return explicitLayerStyle(inner, resolution);
                                }
                                return typeof explicitLayerStyle === 'function'
                                    ? (inner ? explicitLayerStyle(inner, resolution) : undefined)
                                    : explicitLayerStyle;
                            }
                            if (inner) {
                                return styleFromFeature(inner, resolution) as Style;
                            }
                            // fallback: return undefined if inner is not defined
                            return undefined;
                        }
                        // size >= 2 → cluster bubble
                        if (typeof explicitClusterStyle === 'function') {
                            // Let caller vary cluster style by size/resolution if they want
                            // (they can read size via feature.get('features').length)                            
                            return explicitClusterStyle(feature, resolution);
                        }
                        if (explicitClusterStyle) {                            
                            if (def.cluster.style) {
                                return styleFn(def.cluster.style, size) as Style;
                            } else {
                                return explicitClusterStyle;
                            }
                            
                        }
                        return defaultClusterStyle(size);
                    }

                    // Non-clustered case: use explicit style if any, else per-feature fallback
                    if (typeof explicitLayerStyle === 'function') {
                        return explicitLayerStyle(feature, resolution);
                    }
                    if (explicitLayerStyle) {
                        return explicitLayerStyle;
                    }
                    return styleFromFeature(feature, resolution);
                };

                layer = new VectorLayer({
                    source: finalSource as VectorSource,
                    visible: def.visible !== false,
                    zIndex: def.zIndex,
                    style: style as StyleLike, // styleFn as unknown as StyleLike,
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