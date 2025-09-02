// src/core/ol/adapters/styles.ts
import type { StyleDef, SimpleStyleOptions, RawStyleOptions } from '../../../api/types';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import type { StyleLike } from 'ol/style/Style';

export function toOlStyle(def: StyleDef): StyleLike {
    if ('ref' in def) {
        throw new Error(`Style ref '${def.ref}' cannot be resolved (no StyleRegistry wired).`);
    }
    switch (def.type) {
        case 'simple': {
            const opts: SimpleStyleOptions = def.options ?? {};
            const fill = new Fill({ color: opts.fillColor ?? 'rgba(0,0,0,0.2)' });
            const stroke = new Stroke({
                color: opts.strokeColor ?? '#333',
                width: opts.strokeWidth ?? 1,
            });

            const image = opts.circle
                ? new CircleStyle({
                    radius: opts.circle.radius ?? 4,
                    fill: new Fill({ color: opts.circle.fillColor ?? '#3388ff' }),
                    stroke: new Stroke({
                        color: opts.circle.strokeColor ?? '#222',
                        width: opts.circle.strokeWidth ?? 1,
                    }),
                })
                : undefined;

            return new Style({ fill, stroke, image });
        }

        case 'raw': {
            const { instance } = def.options as RawStyleOptions;
            // Runtime guard so callers get a clean error if they pass the wrong thing
            if (!instance) {
                throw new Error('raw style requires options.instance');
            }
            // We accept any OL StyleLike (Style | StyleFunction | Style[]).
            return instance as StyleLike;
        }

        default: {
            // exhaustive check – if you add a new union member and forget to handle it
            const _never: never = def;
            return _never;
        }
    }
}