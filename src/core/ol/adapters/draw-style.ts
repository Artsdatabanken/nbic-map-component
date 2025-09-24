// src/core/ol/adapters/draw-style.ts
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import type { DrawStyleOptions } from '../../../api/types';

export function makeDrawStyle(opts: DrawStyleOptions | undefined): Style {
    const stroke = new Stroke({
        color: opts?.strokeColor ?? '#1f6feb',
        width: opts?.strokeWidth ?? 2,
    });
    const fill = new Fill({
        color: opts?.fillColor ?? 'rgba(31,111,235,0.15)',
    });
    const image = new CircleStyle({
        radius: opts?.pointRadius ?? 6,
        fill,
        stroke,
    });
    const s = new Style();
    if (!opts?.text) {
        s.setImage(image);
        s.setFill(fill);
        s.setStroke(stroke);
    }
    

    // Text label (optional)
    if (opts?.text) {        
        s.setText(
            new Text({
                text: opts.text.label ?? '',
                font: opts.text.font ?? '14px sans-serif',
                fill: new Fill({ color: opts.text.fillColor ?? '#111' }),
                stroke: opts.text.strokeColor
                    ? new Stroke({
                        color: opts.text.strokeColor,
                        width: opts.text.strokeWidth ?? 2,
                    })
                    : undefined,
                offsetX: opts.text.offsetX ?? 0,
                offsetY: opts.text.offsetY ?? 0,
            })
        );        
    }

    return s;
}