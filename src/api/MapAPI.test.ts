// src/api/MapAPI.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MapAPI } from './MapAPI';
import type { MapEngine } from '../core/MapEngine';
import { metersPerPixelForType } from '../core/place-search/place-zoom';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('MapAPI.searchPlaces', () => {
    it('adds the zoom level from the map view', async () => {
        const navn = {
            stedsnummer: 503295,
            skrivemåte: 'Tromsø',
            språk: 'Norsk',
            navneobjekttype: 'By',
            representasjonspunkt: { nord: 69.65, øst: 18.96 },
        };
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ navn: [navn] }))));
        const getZoomForGroundResolution = vi.fn(() => 14.2);
        const engine = { init: () => Promise.resolve(), getZoomForGroundResolution } as unknown as MapEngine;

        const places = await new MapAPI({ target: 'map' }, engine).searchPlaces('Troms');

        expect(places).toStrictEqual([
            {
                id: '503295-Norsk-Tromsø',
                placeId: '503295',
                name: 'Tromsø',
                language: 'Norsk',
                type: 'By',
                municipalities: [],
                counties: [],
                coordinates: { lat: 69.65, lon: 18.96 },
                zoomLevel: 14.2,
            },
        ]);
        expect(getZoomForGroundResolution).toHaveBeenCalledWith([18.96, 69.65], metersPerPixelForType('By'));
    });
});
