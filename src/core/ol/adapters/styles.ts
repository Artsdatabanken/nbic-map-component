// src/core/ol/adapters/styles.ts
import type { StyleDef } from '../../../api/types';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import type { StyleLike } from 'ol/style/Style';

const fallback = new Style({
    fill: new Fill({ color: 'rgba(0,0,0,0.1)' }),
    stroke: new Stroke({ color: '#666', width: 1 }),
});

export function toOlStyle(def: StyleDef, label?: number): StyleLike {
    if ('ref' in def) {
        // Not wired yet: style registry
        throw new Error(`Style ref '${def.ref}' cannot be resolved (no StyleRegistry wired).`);
    }

    if (def.type === 'raw') {
        const inst = def.options?.instance as StyleLike | undefined;
        if (!inst) {
            // Either throw a clear error, or fall back. Pick ONE behavior:
            // throw new Error('Style type "raw" requires options.instance (an OL StyleLike/function)');
            return fallback;
        }
        return inst;
    }

    if (def.type === 'simple') {
        const opts = def.options ?? {};
        const fill = new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' });
        const stroke = new Stroke({ color: opts.strokeColor ?? '#333', width: opts.strokeWidth ?? 1 });
        const image = opts.circle
            ? new CircleStyle({
                radius: opts.circle.radius ?? 4,
                fill: new Fill({ color: opts.circle.fillColor ?? '#3388ff' }),
                stroke: new Stroke({ color: opts.circle.strokeColor ?? '#222', width: opts.circle.strokeWidth ?? 1 }),
            })
            : undefined;            
        const text = opts.text || label !== undefined
            ? new Text({
                text: opts.text?.label ?? label?.toString() ?? '',
                font: opts.text?.font ?? '14px sans-serif',
                fill: new Fill({ color: opts.text?.fillColor ?? '#fff' }),
                stroke: opts.text?.strokeColor
                    ? new Stroke({
                        color: opts.text.strokeColor,
                        width: opts.text.strokeWidth ?? 2,
                    })
                    : undefined,
                offsetX: opts.text?.offsetX ?? 0,
                offsetY: opts.text?.offsetY ?? 0,
            })
            : undefined;
        return new Style({ fill, stroke, image, text });
    }

    return fallback;
}