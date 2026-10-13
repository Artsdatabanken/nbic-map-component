// src/core/place-search/place-zoom.test.ts
import { describe, it, expect } from 'vitest';
import { PLACE_ZOOM, TYPES_BY_CLASS, metersPerPixelForType, zoomClassForType } from './place-zoom';

describe('place zoom table', () => {
    it('lists each type in only one class', () => {
        const types = Object.values(TYPES_BY_CLASS).flat();
        const duplicates = types.filter((t, i) => types.indexOf(t) !== i);
        expect(duplicates).toEqual([]);
    });

    it('trims type names before lookup', () => {
        expect(zoomClassForType('Banke ')).toBe('medium');
    });

    it('falls back to small for unknown types', () => {
        expect(zoomClassForType('Ny type fra Geonorge')).toBe('small');
    });

    it('halves the ground resolution per zoom level', () => {
        expect(metersPerPixelForType('Fylke') / metersPerPixelForType('Kommune')).toBeCloseTo(
            2 ** (PLACE_ZOOM.large - PLACE_ZOOM.region),
        );
        expect(metersPerPixelForType('Kirke')).toBeCloseTo(1.194, 3);
    });
});
