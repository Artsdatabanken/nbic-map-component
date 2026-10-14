// src/core/ol/zoom/ground-resolution.test.ts
import { describe, it, expect } from 'vitest';
import View from 'ol/View';
import '../../projections';
import { zoomForGroundResolution } from './ground-resolution';

const metersPerPixelAtZoom13 = 156543.03392804097 / 2 ** 13;

describe('zoomForGroundResolution', () => {
    it('gives the grid zoom at the equator in EPSG:3857', () => {
        const view = new View({ projection: 'EPSG:3857' });
        expect(zoomForGroundResolution(view, [0, 0], metersPerPixelAtZoom13)).toBeCloseTo(13, 6);
    });

    it('zooms out at high latitudes in EPSG:3857, where the map is stretched', () => {
        const view = new View({ projection: 'EPSG:3857' });
        const lat = 69.65;
        const expected = 13 + Math.log2(Math.cos((lat * Math.PI) / 180));
        expect(zoomForGroundResolution(view, [18.96, lat], metersPerPixelAtZoom13)).toBeCloseTo(expected, 3);
    });

    it('gives practically the grid zoom in an EPSG:25833 view without extent (Artskart3)', () => {
        const view = new View({ projection: 'EPSG:25833' });
        expect(zoomForGroundResolution(view, [10.75, 59.91], metersPerPixelAtZoom13)).toBeCloseTo(13, 1);
    });

    it("stays within the view's zoom limits", () => {
        const view = new View({ projection: 'EPSG:3857', minZoom: 2, maxZoom: 10 });
        expect(zoomForGroundResolution(view, [10, 60], 0.01)).toBe(10);
        expect(zoomForGroundResolution(view, [10, 60], 1e9)).toBe(2);
    });
});
