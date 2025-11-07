// src/core/ol/adapters/styles.ts
import type { StyleDef } from '../../../api/types';
import { Style, Fill, Stroke, Circle as CircleStyle, Text, Icon } from 'ol/style';
import type { StyleLike } from 'ol/style/Style';
import { Circle as CircleGeom } from 'ol/geom';
import type { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import * as olColor from 'ol/color';
// import type { State as RenderState } from 'ol/render';
import { makeGradientRenderer } from './gradient';

/** fallback for unknown / missing style */
const fallback = new Style({
    fill: new Fill({ color: 'rgba(0,0,0,0.1)' }),
    stroke: new Stroke({ color: '#666', width: 1 }),
});
// type CircleRenderCoords = [[number, number], [number, number]];

/** Build a canvas renderer that draws a radial gradient bubble */
// function makeGradientRenderer(
//     color: string,
//     outerScale = 1.4,
//     stops: Array<[number, number]> = [
//         [0, 0],
//         [0.6, 0.2],
//         [1, 0.8],
//     ],
//     strokeWidth = 1,
// ) {
//     const withAlpha = (c: string, a: number): string => {
//         const arr = olColor.asArray(c); // [r,g,b,a]
//         arr[3] = a;
//         return olColor.asString(arr);   // rgba(...)
//     };

//     // IMPORTANT: typed signature
//     return (coordinates: number[][], state: RenderState): void => {
//         // OL gives [[cx,cy],[cx+radius,cy]] for a Circle geometry
//         const [[x, y], [x1, y1]] = coordinates as CircleRenderCoords;

//         // The ol/render State context is a CanvasRenderingContext2D
//         const ctx = state.context as CanvasRenderingContext2D;

//         const dx = x1 - x;
//         const dy = y1 - y;
//         const radius = Math.sqrt(dx * dx + dy * dy);
//         const outerRadius = radius * outerScale;

//         const grad = ctx.createRadialGradient(x, y, 0, x, y, outerRadius);
//         for (const [stop, alpha] of stops) {
//             grad.addColorStop(stop, withAlpha(color, alpha));
//         }

//         // fill gradient disk
//         ctx.beginPath();
//         ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
//         ctx.fillStyle = grad;
//         ctx.fill();

//         // stroke ring
//         ctx.beginPath();
//         ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
//         ctx.strokeStyle = withAlpha(color, 1);
//         ctx.lineWidth = strokeWidth;
//         ctx.stroke();
//     };
// }

/**
 * Convert our StyleDef to an OpenLayers Style/StyleFunction.
 * Backward-compatible:
 *  - simple + pixel circle: unchanged
 *  - simple + icon: unchanged
 *  - simple + circle.units === 'map': map-unit circle
 *  - simple + circle.units === 'map' + circle.gradient: gradient ring via custom renderer
 */
export function toOlStyle(def: StyleDef, label?: string): StyleLike {
    if ('ref' in def) {
        throw new Error(`Style ref '${def.ref}' cannot be resolved (no StyleRegistry wired).`);
    }

    if (def.type === 'raw') {
        const inst = def.options?.instance as StyleLike | undefined;
        return inst ?? fallback;
    }

    if (def.type !== 'simple') return fallback;

    const opts = def.options ?? {};

    // Base polygon/line paint
    const baseFill = new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' });
    const baseStroke = new Stroke({ color: opts.strokeColor ?? '#333', width: opts.strokeWidth ?? 1 });

    // Optional text
    const text =
        opts.text || label !== undefined
            ? new Text({
                text: opts.text?.label ?? (label != null ? String(label) : ''),
                font: opts.text?.font ?? '14px sans-serif',
                fill: new Fill({ color: opts.text?.fillColor ?? '#fff' }),
                stroke: opts.text?.strokeColor
                    ? new Stroke({ color: opts.text.strokeColor, width: opts.text.strokeWidth ?? 2 })
                    : undefined,
                offsetX: opts.text?.offsetX ?? 0,
                offsetY: opts.text?.offsetY ?? 0,
            })
            : undefined;

    // Icon (highest priority if present)
    if (opts.icon) {
        const i = opts.icon;
        return new Style({
            image: new Icon({
                src: i.src,
                scale: i.scale ?? 1,
                anchor: i.anchor ?? [0.5, 1],
                anchorXUnits: i.anchorXUnits ?? 'fraction',
                anchorYUnits: i.anchorYUnits ?? 'fraction',
                size: i.size,
                rotation: i.rotation ?? 0,
                opacity: i.opacity ?? 1,
                color: i.color,
            }),
            text,
        });
    }

    // Pixel circle (legacy default if circle defined and units !== 'map')
    if (opts.circle && opts.circle.units !== 'map') {
        const c = opts.circle;
        const image = new CircleStyle({
            radius: c.radius ?? 4,
            fill: new Fill({ color: c.fillColor ?? '#3388ff' }),
            stroke: new Stroke({ color: c.strokeColor ?? '#222', width: c.strokeWidth ?? 1 }),
        });
        return new Style({ image, text, fill: baseFill, stroke: baseStroke });
    }

    // Map-units circle (radius in meters), optionally with gradient
    if (opts.circle?.units === 'map') {
        const c = opts.circle;

        // non-gradient fallback paint
        const circleStroke = new Stroke({
            color: c.strokeColor ?? opts.strokeColor ?? '#333',
            width: c.strokeWidth ?? opts.strokeWidth ?? 1,
        });
        const circleFill = new Fill({
            color: c.fillColor ?? opts.fillColor ?? 'rgba(0,0,0,0.2)',
        });

        // const hasGradient = !!c.gradient;

        // StyleFunction so we can read per-feature radius
        return (feature: FeatureLike) => {
            const geom = feature.getGeometry();
            if (!(geom instanceof Point)) {
                return new Style({ stroke: baseStroke, fill: baseFill, text });
            }

            let radius = 0;
            if (c.radiusProperty) {
                const v = feature.get(c.radiusProperty);
                const n = Number(v);
                if (Number.isFinite(n)) radius = n;
            }
            if (!(radius > 0)) radius = c.radius ?? 0;
            if (!(radius > 0)) return new Style({ stroke: baseStroke, fill: baseFill, text });

            const circleGeom = new CircleGeom(geom.getCoordinates(), radius);

            if (c.gradient) {
                const renderer = makeGradientRenderer(
                    olColor.asArray(c.gradient.color),
                    c.gradient.outerScale ?? 1.4,
                    c.gradient.stops ?? [[0, 0], [0.6, 0.2], [1, 0.8]],
                    c.strokeWidth ?? 1
                );
                const s = new Style({ renderer, text });
                (s as unknown as { setGeometry(g: CircleGeom): void }).setGeometry(circleGeom);
                return s;
            }

            const s = new Style({ stroke: circleStroke, fill: circleFill, text });
            (s as unknown as { setGeometry(g: CircleGeom): void }).setGeometry(circleGeom);
            return s;
        };
    }

    // Default polygon/line fallback
    return new Style({ fill: baseFill, stroke: baseStroke, text });
}

// // src/core/ol/adapters/styles.ts
// import type { StyleDef } from '../../../api/types';
// import { Style, Fill, Stroke, Circle as CircleStyle, Text, Icon } from 'ol/style';
// import type { StyleLike } from 'ol/style/Style';
// import { Circle as CircleGeom } from 'ol/geom';
// import type { FeatureLike } from 'ol/Feature';
// import Point from 'ol/geom/Point';
// import Polygon, { fromCircle as polygonFromCircle } from 'ol/geom/Polygon';
// // import { makeGradientRenderer } from './gradient';

// const fallback = new Style({
//     fill: new Fill({ color: 'rgba(0,0,0,0.1)' }),
//     stroke: new Stroke({ color: '#666', width: 1 }),
// });

// export function toOlStyle(def: StyleDef, label?: string): StyleLike {
//     if ('ref' in def) {
//         // Not wired yet: style registry
//         throw new Error(`Style ref '${def.ref}' cannot be resolved (no StyleRegistry wired).`);
//     }

//     if (def.type === 'raw') {
//         const inst = def.options?.instance as StyleLike | undefined;
//         if (!inst) {
//             // Either throw a clear error, or fall back. Pick ONE behavior:
//             // throw new Error('Style type "raw" requires options.instance (an OL StyleLike/function)');
//             return fallback;
//         }
//         return inst;
//     }

//     if (def.type === 'simple') {
//         const opts = def.options ?? {};
//         const fill = new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' });
//         const stroke = new Stroke({ color: opts.strokeColor ?? '#333', width: opts.strokeWidth ?? 1 });
//         const image = opts.circle
//             ? new CircleStyle({
//                 radius: opts.circle.radius ?? 4,
//                 fill: new Fill({ color: opts.circle.fillColor ?? '#3388ff' }),
//                 stroke: new Stroke({ color: opts.circle.strokeColor ?? '#222', width: opts.circle.strokeWidth ?? 1 }),
//             })
//             : undefined;            
//         const text = opts.text || label !== undefined
//             ? new Text({
//                 text: opts.text?.label ?? label?.toString() ?? '',
//                 font: opts.text?.font ?? '14px sans-serif',
//                 fill: new Fill({ color: opts.text?.fillColor ?? '#fff' }),
//                 stroke: opts.text?.strokeColor
//                     ? new Stroke({
//                         color: opts.text.strokeColor,
//                         width: opts.text.strokeWidth ?? 2,
//                     })
//                     : undefined,
//                 offsetX: opts.text?.offsetX ?? 0,
//                 offsetY: opts.text?.offsetY ?? 0,
//             })
//             : undefined;

//         if (opts.icon) {
//             const i = opts.icon;
//             return new Style({
//                 image: new Icon({
//                     src: i.src,
//                     scale: i.scale ?? 1,
//                     anchor: i.anchor ?? [0.5, 1],
//                     anchorXUnits: i.anchorXUnits ?? 'fraction',
//                     anchorYUnits: i.anchorYUnits ?? 'fraction',
//                     size: i.size,
//                     rotation: i.rotation ?? 0,
//                     opacity: i.opacity ?? 1,
//                     color: i.color, // works as tint for compatible SVGs
//                 }),
//                 text,
//             });
//         }

//         // Map-unit circle (NEW): radius in meters (EPSG:3857)
//         if (opts.circle?.units === 'map') {
//             const segs = opts.circle.segments ?? 64;

//             // fallbacks
//             const circleStroke = new Stroke({
//                 color: opts.circle.strokeColor ?? opts.strokeColor ?? '#333',
//                 width: opts.circle.strokeWidth ?? opts.strokeWidth ?? 1,
//             });
//             const circleFill = new Fill({
//                 color: opts.circle.fillColor ?? opts.fillColor ?? 'rgba(0,0,0,0.2)',
//             });

//             // Return StyleFunction so we can read per-feature radius
//             return (feature: FeatureLike) => {
//                 const geom = feature.getGeometry();
//                 // If it's not a point, just style with base stroke/fill (no circle)
//                 if (!(geom instanceof Point)) {
//                     return new Style({
//                         stroke: new Stroke({ color: opts.strokeColor ?? '#333', width: opts.strokeWidth ?? 1 }),
//                         fill: new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' }),
//                         text,
//                     });
//                 }

//                 // Resolve radius (meters): per-feature property overrides fixed radius
//                 let radius = 0;
//                 if (opts.circle?.radiusProperty) {
//                     const v = feature.get(opts.circle.radiusProperty);
//                     const n = Number(v);
//                     if (Number.isFinite(n)) radius = n;
//                 }
//                 if (!(radius > 0)) {
//                     radius = opts.circle?.radius ?? 0;
//                 }

//                 if (!(radius > 0)) {
//                     // No valid radius → fall back to base polygon/line styling
//                     return new Style({
//                         stroke: new Stroke({ color: opts.strokeColor ?? '#333', width: opts.strokeWidth ?? 1 }),
//                         fill: new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' }),
//                         text,
//                     });
//                 }

//                 // Build a polygon from a metric circle around the point
//                 const center = geom.getCoordinates();
//                 const c = new CircleGeom(center, radius);
//                 const poly = polygonFromCircle(c, segs);

//                 const s = new Style({ stroke: circleStroke, fill: circleFill, text });
//                 // IMPORTANT: render the polygon instead of the point
//                 (s as unknown as { setGeometry: (g: Polygon) => void }).setGeometry(poly);
//                 return s;
//             };
//         }

//         return new Style({ fill, stroke, image, text });
//     }

//     return fallback;
// }