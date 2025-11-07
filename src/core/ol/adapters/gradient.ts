// src/core/ol/adapters/gradient.ts
import type { RenderFunction } from 'ol/style/Style';
import type { State as RenderState } from 'ol/render';
import type { Color } from 'ol/color';
import { asArray, asString } from 'ol/color';

export function makeGradientRenderer(
    color: Color,
    outerScale = 1.4,
    stops: [number, number][] = [[0, 0], [0.6, 0.2], [1, 0.8]],
    strokeWidth = 1
): RenderFunction {
    const withAlpha = (c: Color, a: number): string => {
        const arr = asArray(c);
        arr[3] = a;
        return asString(arr);
    };

    const rf: RenderFunction = (
        pixelCoords: number[] | number[][] | number[][][] | number[][][][],
        state: RenderState
    ) => {
        // For circles, OL passes [[x,y],[x1,y1]] (center + point on circumference)
        const coords = pixelCoords as number[][];
        if (!coords || coords.length < 2) return;

        const center = coords[0];
        const edge = coords[1];
        if (!center || !edge || center.length < 2 || edge.length < 2) return;
        const x = center[0];
        const y = center[1];
        const x1 = edge[0];
        const y1 = edge[1];
        const ctx = state.context;

        const dx = x1! - x!, dy = y1! - y!;
        const radius = Math.sqrt(dx * dx + dy * dy);

        const innerRadius = 0;
        const outerRadius = radius * outerScale;

        const gradient = ctx.createRadialGradient(x!, y!, innerRadius, x!, y!, outerRadius);
        for (const [stop, alpha] of stops) {
            gradient.addColorStop(stop, withAlpha(color, alpha));
        }

        ctx.beginPath();
        ctx.arc(x!, y!, radius, 0, 2 * Math.PI, true);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x!, y!, radius, 0, 2 * Math.PI, true);
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = withAlpha(color, 1);
        ctx.stroke();
    };

    return rf;
}