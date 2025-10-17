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

// function defaultClusterStyle(size: number) {
//     return new Style({
//         image: new CircleStyle({
//             radius: 12,
//             fill: new Fill({ color: '#3399CC' }),
//             stroke: new Stroke({ color: '#fff', width: 2 }),
//         }),
//         text: new Text({
//             text: size.toString(),
//             fill: new Fill({ color: '#fff' }),
//         }),
//     });
// }

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


                function sumCount(members: FeatureLike[] | undefined, field = 'count'): number {
                    if (!members?.length) return 0;
                    let total = 0;
                    for (const m of members) {
                        const v = m.get?.(field);
                        const n = Number(v);
                        total += Number.isFinite(n) ? n : 1; // fallback to 1 if missing/NaN
                    }
                    return total;
                }

                const countField = def.cluster?.countField ?? 'count';

                // Style function that handles both clustered and non-clustered cases
                const style: StyleFunction = (feature: FeatureLike, resolution: number): Style | Style[] | void => {
                    // If this is a clustered feature, it will have 'features' array
                    const members: FeatureLike[] | undefined = (feature).get?.('features');                    

                    if (def.cluster?.enabled && members) {
                        // // total for the bubble (sum of member counts; each member defaults to 1)
                        const total = sumCount(members, countField) || members.length;
                        
                        if (members.length === 1 && !def.cluster.keepSingleAsCluster) {
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
                                return styleFn(def.cluster.style, total) as Style;
                            } else {
                                return explicitClusterStyle;
                            }
                            
                        }
                        // return defaultClusterStyle(size);
                        // const keepSingle = !!def.cluster.keepSingleAsCluster;

                        // // total for bubble: sum of each member’s `count` (fallback 1)
                        // const total = sumCount(members, countField) || members.length;

                        // // expose the total so custom style functions can read it
                        // // feature.set?.('nbic:clusterTotal', total);

                        // if (members.length === 1 && !keepSingle) {
                        //     // Render single member as original feature
                        //     const inner = members[0];
                        //     if (inner && typeof explicitLayerStyle === 'function') return explicitLayerStyle(inner, resolution);
                        //     if (explicitLayerStyle) return explicitLayerStyle;
                        //     return styleFromFeature(inner!, resolution) as Style;
                        // }

                        // // Cluster bubble (or single kept as bubble)
                        // if (typeof explicitClusterStyle === 'function') {
                        //     // Your existing cluster style function can read total via:
                        //     //   feature.get('nbic:clusterTotal')
                        //     return explicitClusterStyle(feature, resolution);
                        // }
                        // if (explicitClusterStyle) {
                        //     // If cluster style was an object (not function) and your styleFn accepts a param,
                        //     // pass `total` so text can be data-driven (your styleFn already supported a second arg).
                        //     if (def.cluster.style) {
                        //         return styleFn(def.cluster.style, total) as Style;
                        //     } else {
                        //         return explicitClusterStyle;
                        //     }
                        // }

                        // Default bubble shows `total` (NOT members.length)
                        return new Style({
                            image: new CircleStyle({
                                radius: 12,
                                fill: new Fill({ color: '#3399CC' }),
                                stroke: new Stroke({ color: '#fff', width: 2 }),
                            }),
                            text: new Text({
                                text: String(total),
                                fill: new Fill({ color: '#fff' }),
                            }),
                        });
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

                if (def.source && typeof def.source === 'object') {
                    const sourceDef = def.source as SourceDef;
                    if (sourceDef.type === 'geojson' && sourceDef.options.dataProjection){
                        layer.set('nbic:dataProjection', sourceDef.options.dataProjection);
                    }
                }
            } else {
                throw new Error('Source for vector layer must be a VectorSource');
            }
            break;
        default:
            throw new Error(`Unknown layer kind: ${def.kind}`);
    }

    layer.set('id', def.id);

    // expose hover config to the controller    
    if (def.hover?.style) layer.set('nbic:hoverStyle', def.hover.style);
    if (def.hover?.hitTolerance != null) layer.set('nbic:hoverHitTol', def.hover.hitTolerance);
    if (def.hover?.clusterBehavior) layer.set('nbic:hoverClusterBehavior', def.hover.clusterBehavior);

    // keepSingleAsCluster you already have:
    if (def.cluster?.keepSingleAsCluster) layer.set('nbic:keepSingleAsCluster', true);

    // ✨ render gates
    if (def.minZoom !== undefined && 'setMinZoom' in layer) (layer as TileLayer | VectorLayer).setMinZoom(def.minZoom);
    if (def.maxZoom !== undefined && 'setMaxZoom' in layer) (layer as TileLayer | VectorLayer).setMaxZoom(def.maxZoom);

    return layer;
}