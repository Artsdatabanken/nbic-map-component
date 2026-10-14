// src/core/place-search/geonorge.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchGeonorgePlaces } from './geonorge';
import { metersPerPixelForType } from './place-zoom';

const tromso = {
    stedsnummer: 503295,
    skrivemåte: 'Tromsø',
    språk: 'Norsk',
    navneobjekttype: 'By',
    representasjonspunkt: { nord: 69.65, øst: 18.96 },
    kommuner: [{ kommunenavn: 'Tromsø', kommunenummer: '5501' }],
    fylker: [{ fylkesnavn: 'Troms - Romsa - Tromssa', fylkesnummer: '55' }],
};
const romsa = { ...tromso, skrivemåte: 'Romsa', språk: 'Nordsamisk' };
const oslofjorden = {
    stedsnummer: 77777,
    skrivemåte: 'Oslofjorden',
    språk: 'Norsk',
    navneobjekttype: 'Fjord',
    representasjonspunkt: { nord: 59.5, øst: 10.6 },
    kommuner: [
        { kommunenavn: 'Oslo', kommunenummer: '0301' },
        { kommunenavn: 'Nesodden', kommunenummer: '3212' },
    ],
    fylker: [
        { fylkesnavn: 'Oslo', fylkesnummer: '03' },
        { fylkesnavn: 'Akershus', fylkesnummer: '32' },
    ],
};
const seaBank = {
    stedsnummer: 466575,
    skrivemåte: 'Tromsøflaket',
    språk: 'Norsk',
    navneobjekttype: 'Banke ',
    representasjonspunkt: { nord: 70.5, øst: 18.0 },
};

function mockFetch(navn: unknown[], init: ResponseInit = { status: 200 }) {
    const fetchMock = vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>(
        async () => new Response(JSON.stringify({ navn }), init),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof mockFetch>): URL {
    const url = fetchMock.mock.calls[0]?.[0];
    if (!url) throw new Error('fetch was not called');
    return url;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('searchGeonorgePlaces', () => {
    it('makes a prefix search in WGS84', async () => {
        const fetchMock = mockFetch([]);
        await searchGeonorgePlaces(' Troms ');

        const params = requestedUrl(fetchMock).searchParams;
        expect(params.get('sok')).toBe('Troms*');
        expect(params.get('utkoordsys')).toBe('4326');
        expect(params.get('treffPerSide')).toBe('10');
        expect(params.has('fuzzy')).toBe(false);
    });

    it('keeps an existing wildcard and passes options', async () => {
        const fetchMock = mockFetch([]);
        await searchGeonorgePlaces('Troms*', {
            limit: 25,
            fuzzy: true,
            municipalityNumbers: ['5501', '5601'],
            countyNumbers: ['55'],
        });

        const params = requestedUrl(fetchMock).searchParams;
        expect(params.get('sok')).toBe('Troms*');
        expect(params.get('treffPerSide')).toBe('25');
        expect(params.get('fuzzy')).toBe('true');
        expect(params.getAll('knr')).toEqual(['5501', '5601']);
        expect(params.getAll('fnr')).toEqual(['55']);
    });

    it('keeps the limit within what Geonorge accepts', async () => {
        const fetchMock = mockFetch([]);
        await searchGeonorgePlaces('Oslo', { limit: 1000 });
        await searchGeonorgePlaces('Oslo', { limit: 0 });

        expect(fetchMock.mock.calls.map(([url]) => url.searchParams.get('treffPerSide'))).toEqual([
            '500',
            '1',
        ]);
    });

    it('strips characters Geonorge rejects', async () => {
        const fetchMock = mockFetch([]);
        await searchGeonorgePlaces('Oslo?"');

        expect(requestedUrl(fetchMock).searchParams.get('sok')).toBe('Oslo*');
    });

    it.each(['', '   ', '*', '?'])('returns nothing without calling Geonorge for %j', async (query) => {
        const fetchMock = mockFetch([tromso]);

        await expect(searchGeonorgePlaces(query)).resolves.toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns one result per spelling', async () => {
        mockFetch([tromso, romsa]);
        const places = await searchGeonorgePlaces('Troms');

        expect(places).toEqual([
            {
                id: '503295-Norsk-Tromsø',
                placeId: '503295',
                name: 'Tromsø',
                language: 'Norsk',
                type: 'By',
                municipalities: ['Tromsø'],
                counties: ['Troms - Romsa - Tromssa'],
                coordinates: { lat: 69.65, lon: 18.96 },
                targetMetersPerPixel: metersPerPixelForType('By'),
            },
            expect.objectContaining({ id: '503295-Nordsamisk-Romsa', placeId: '503295', name: 'Romsa' }),
        ]);
    });

    it('lists every municipality and county, and none for places outside them', async () => {
        mockFetch([oslofjorden, seaBank]);
        const [fjord, bank] = await searchGeonorgePlaces('O');

        expect(fjord?.municipalities).toEqual(['Oslo', 'Nesodden']);
        expect(fjord?.counties).toEqual(['Oslo', 'Akershus']);
        expect(bank?.municipalities).toEqual([]);
        expect(bank?.counties).toEqual([]);
        expect(bank?.type).toBe('Banke');
    });

    it('passes the abort signal to fetch', async () => {
        const fetchMock = mockFetch([]);
        const controller = new AbortController();
        await searchGeonorgePlaces('Oslo', { signal: controller.signal });

        expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    });

    it('rejects with an AbortError when already aborted', async () => {
        const fetchMock = mockFetch([]);
        const controller = new AbortController();
        controller.abort();

        await expect(searchGeonorgePlaces('Oslo', { signal: controller.signal })).rejects.toMatchObject({
            name: 'AbortError',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects when Geonorge answers with an error', async () => {
        mockFetch([], { status: 400, statusText: 'Bad Request' });

        await expect(searchGeonorgePlaces('Oslo')).rejects.toThrow('400 Bad Request');
    });
});
