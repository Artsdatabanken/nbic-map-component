// src/core/ol/adapters/styles.ts
import type { StyleDef } from '../../../api/types';
import { Style, Fill, Stroke, Circle as CircleStyle, Text, Icon, RegularShape } from 'ol/style';
import type { StyleLike } from 'ol/style/Style';
import { Circle as CircleGeom } from 'ol/geom';
import type { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import * as olColor from 'ol/color';
import { makeGradientRenderer } from './gradient';

/** fallback for unknown / missing style */
const fallback = new Style({
    fill: new Fill({ color: 'rgba(0,0,0,0.1)' }),
    stroke: new Stroke({ color: '#666', width: 1 }),
});

// Cache styles per thumbnail URL
const thumbCache = new Map<string, Style[]>();

function getInnerFeatureFromCluster(feature: FeatureLike): FeatureLike {
    const members = feature.get?.('features') as FeatureLike[] | undefined;
    if (members && members.length === 1) {
        const m0 = members[0];
        return m0 ?? feature;
    }
    return feature;
}

function getClusterSize(feature: FeatureLike): number {
    const members = feature.get?.('features') as FeatureLike[] | undefined;
    return members?.length ?? 0;
}

function makeThumbnailMarkerStyle(thumbnail: string, opts: {
    frameRadius: number;
    frameBorderWidth: number;
    frameBorderColor: string;
    frameFillColor: string;
    frameDisplacement: [number, number];
    pinRadius: number;
    pinFillColor: string;
    pinRotation: number;
    imageSize: [number, number];
    imageScale: number;
    crossOrigin: '' | 'anonymous' | 'use-credentials';
}): Style[] {
    const cached = thumbCache.get(thumbnail);
    if (cached) return cached;

    const styles: Style[] = [
        new Style({
            image: new RegularShape({
                stroke: new Stroke({ color: opts.frameBorderColor, width: opts.frameBorderWidth }),
                fill: new Fill({ color: opts.frameFillColor }),
                points: 4,
                radius: opts.frameRadius,
                angle: Math.PI / 4,
                displacement: opts.frameDisplacement,
            }),
        }),
        new Style({
            image: new RegularShape({
                fill: new Fill({ color: opts.pinFillColor }),
                points: 3,
                radius: opts.pinRadius,
                rotation: opts.pinRotation,
                angle: 0,
            }),
        }),
        new Style({
            image: new Icon({
                anchor: [0.52, 1],
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
                src: thumbnail,
                opacity: 1,
                scale: opts.imageScale,
                offsetOrigin: 'top-left',
                offset: [0, 0],
                size: opts.imageSize,
                crossOrigin: opts.crossOrigin,
            }),
        }),
    ];

    thumbCache.set(thumbnail, styles);
    return styles;
}

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

    if (opts.thumbnailMarker) {
        const t = opts.thumbnailMarker;

        const property = t.property ?? 'thumbnail';
        const imageSize: [number, number] = t.imageSize ?? [100, 100];
        const imageScale = t.imageScale ?? 0.26;

        const frameRadius = t.frameRadius ?? 22;
        const frameBorderWidth = t.frameBorderWidth ?? 3;
        const frameBorderColor = t.frameBorderColor ?? 'rgba(255,255,255,1)';
        const frameFillColor = t.frameFillColor ?? '#ffffff';
        const frameDisplacement: [number, number] = t.frameDisplacement ?? [-1, 13];

        const pinRadius = t.pinRadius ?? 10;
        const pinFillColor = t.pinFillColor ?? '#ffffff';
        const pinRotation = t.pinRotation ?? Math.PI / 3;

        const crossOrigin = t.crossOrigin ?? 'anonymous';
        const fill = new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' });
        const stroke = new Stroke({ color: opts.strokeColor ?? '#333', width: opts.strokeWidth ?? 1 });

        const image = opts.circle
            ? new CircleStyle({
                radius: opts.circle.radius ?? 4,
                fill: new Fill({ color: opts.circle.fillColor ?? '#3388ff' }),
                stroke: new Stroke({ color: opts.circle.strokeColor ?? '#222', width: opts.circle.strokeWidth ?? 1 }),
            })
            : undefined;

        return (feature: FeatureLike) => {
            // If it’s a cluster with >1, let your cluster style handle it (return undefined here)
            const size = getClusterSize(feature);
            if (size > 1) return undefined;

            // If cluster with single: unwrap to inner feature
            const inner = getInnerFeatureFromCluster(feature);

            const thumb = inner.get?.(property);
            const url = typeof thumb === 'string' ? thumb : '';

            if (!url) {
                // fallback to whatever your “simple” would do (circle or icon etc.)
                return new Style({ fill, stroke, image, text });
            }

            return makeThumbnailMarkerStyle(url, {
                frameRadius,
                frameBorderWidth,
                frameBorderColor,
                frameFillColor,
                frameDisplacement,
                pinRadius,
                pinFillColor,
                pinRotation,
                imageSize,
                imageScale,
                crossOrigin,
            });
        };
    }

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
