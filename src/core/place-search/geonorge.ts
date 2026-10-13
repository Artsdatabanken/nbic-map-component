// src/core/place-search/geonorge.ts
import type { PlaceSearchOptions, PlaceSearchResult } from '../../api/types';
import { metersPerPixelForType } from './place-zoom';

const GEONORGE_NAVN_URL = 'https://ws.geonorge.no/stedsnavn/v1/navn';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 500;
// Geonorge answers 400 "Ugyldig(e) tegn i søkeparameteret" for these.
const REJECTED_CHARACTERS = /["?;%\\]/g;

interface GeonorgeNavn {
    stedsnummer: number;
    skrivemåte: string;
    språk: string;
    navneobjekttype: string;
    representasjonspunkt: { nord: number; øst: number };
    kommuner?: { kommunenavn: string }[];
    fylker?: { fylkesnavn: string }[];
}

interface GeonorgeNavnResponse {
    navn?: GeonorgeNavn[];
}

export type PlaceHit = Omit<PlaceSearchResult, 'zoomLevel'> & { targetMetersPerPixel: number };

/** Prefix search against Geonorge's /navn endpoint, one hit per spelling. */
export async function searchGeonorgePlaces(
    query: string,
    options: PlaceSearchOptions = {},
): Promise<PlaceHit[]> {
    options.signal?.throwIfAborted();

    const term = query.replace(REJECTED_CHARACTERS, '').trim();
    // Geonorge rejects wildcard-only searches
    if (!term.replace(/\*/g, '')) return [];

    const url = new URL(GEONORGE_NAVN_URL);
    const params = url.searchParams;
    params.set('sok', term.endsWith('*') ? term : `${term}*`);
    params.set('utkoordsys', '4326');
    params.set('treffPerSide', String(Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT)));
    if (options.fuzzy) params.set('fuzzy', 'true');
    for (const knr of options.municipalityNumbers ?? []) params.append('knr', knr);
    for (const fnr of options.countyNumbers ?? []) params.append('fnr', fnr);

    const response = await fetch(url, { signal: options.signal });
    if (!response.ok) {
        throw new Error(`Geonorge place search failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as GeonorgeNavnResponse;
    return (body.navn ?? []).map(toPlaceHit);
}

function toPlaceHit(navn: GeonorgeNavn): PlaceHit {
    const type = navn.navneobjekttype.trim();
    return {
        id: `${navn.stedsnummer}-${navn.språk}-${navn.skrivemåte}`,
        placeId: String(navn.stedsnummer),
        name: navn.skrivemåte,
        language: navn.språk,
        type,
        municipalities: navn.kommuner?.map((k) => k.kommunenavn.trim()) ?? [],
        counties: navn.fylker?.map((f) => f.fylkesnavn.trim()) ?? [],
        coordinates: { lat: navn.representasjonspunkt.nord, lon: navn.representasjonspunkt.øst },
        targetMetersPerPixel: metersPerPixelForType(type),
    };
}
