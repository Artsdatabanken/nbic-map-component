// src/core/ol/adapters/draw-style.ts

import { Style, Icon, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
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
    
    s.setImage(image);
    s.setFill(fill);
    s.setStroke(stroke);
    
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

    if (opts?.icon?.src) {
        const image = new Icon({
            src: opts.icon.src,
            scale: opts.icon.scale ?? 1,
            size: opts.icon.size,
            anchor: opts.icon.anchor ?? [0.5, 1],
            anchorXUnits: opts.icon.anchorXUnits ?? 'fraction',
            anchorYUnits: opts.icon.anchorYUnits ?? 'fraction',
            rotation: opts.icon.rotation ?? 0,
            opacity: opts.icon.opacity ?? 1,
            color: opts.icon.color,
        });
        return new Style({ image, stroke, fill });
    }
    return s;
}

export function makeUpdatedDrawStyle(opts: DrawStyleOptions | undefined): Style {
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
    
    s.setImage(image);
    s.setFill(fill);
    s.setStroke(stroke);

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