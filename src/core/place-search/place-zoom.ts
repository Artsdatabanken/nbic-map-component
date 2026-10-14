// src/core/place-search/place-zoom.ts

// Zoom levels on the standard web-map grid (156 543 m/px at zoom 0). Artskart3's EPSG:25833 view uses
// practically the same grid. The map converts them for its own view, so hosts with other projections
// get the same on-screen scale. Widths assume a 1000 px wide map.
const METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03392804097;

export const PLACE_ZOOM = {
    point: 17, // ~1.2 km across: buildings, single structures
    small: 15, // ~5 km: small natural features, farms' surroundings, neighbourhoods
    medium: 13, // ~19 km: lakes, mountains, valleys, towns
    large: 11.5, // ~54 km: fjords, mountain areas, municipalities
    region: 9, // ~300 km: counties, sea areas
    country: 6, // ~2 400 km
} as const;

export type ZoomClass = keyof typeof PLACE_ZOOM;

const DEFAULT_ZOOM_CLASS: ZoomClass = 'small';

/** Every navneobjekttype from https://ws.geonorge.no/stedsnavn/v1/navneobjekttyper, grouped by zoom class. */
export const TYPES_BY_CLASS: Record<ZoomClass, readonly string[]> = {
    point: [
        'Adressetilleggsnavn', 'Annen bygning for religionsutøvelse', 'Annen industri- og lagerbygning',
        'Annen kulturdetalj', 'Badeplass', 'Barnehage', 'Boinstitusjon', 'Boligblokk', 'Bomstasjon',
        'Borettslag', 'Bru', 'Bruk', 'Brygge', 'Busstasjon', 'Busstopp', 'Bygg for jordbruk, fiske og fangst',
        'Båke', 'Campingplass', 'Dam', 'Eiendom', 'Eiendomsteig', 'Enebolig/mindre boligbygg', 'Fabrikk',
        'Fengsel', 'Ferjekai', 'Fjell i dagen', 'Fjellheis', 'Fløtningsanlegg', 'Fornøyelsespark',
        'Forretningsbygg', 'Forsamlingshus/kulturhus', 'Forskningsstasjon', 'Foss', 'Fritidsbolig',
        'Fyllplass', 'Fyrlykt', 'Fyrstasjon', 'Gammel bosettingsplass', 'Garasje/hangarbygg', 'Gard',
        'Gjerde', 'Gravplass', 'Grensemerke', 'Grind', 'Grotte', 'Grustak/steinbrudd', 'Grøft',
        'Helikopterlandingsplass', 'Heller', 'Helseinstitusjon', 'Historisk bosetting', 'Holdeplass',
        'Hotell', 'Høl', 'Idrettsanlegg', 'Idrettshall', 'Jernbanebru', 'Jernstang', 'Jorde', 'Kai',
        'Kilde', 'Kirke', 'Klopp', 'Kraftstasjon', 'Kultur-/messehall', 'Landingsplass', 'Lanterne',
        'Lysbøye', 'Matrikkeladressenavn', 'Melkeplass', 'Militært bygg/anlegg', 'Mindre brukonstruksjon',
        'Molo', 'Museum/galleri/bibliotek', 'Navnegard', 'Offersted', 'Oppdrettsanlegg', 'Overbygg',
        'Overett', 'Park', 'Parkeringsplass', 'Pensjonat', 'Pytt', 'Rasteplass', 'Rådhus', 'Serveringssted',
        'Seter/støl', 'Setervoll', 'Severdighet', 'Sjømerke med indirekte belysning', 'Sjøvarde', 'Skiheis',
        'Skogholt', 'Skole', 'Skytebane', 'Sluse', 'Småbåthavn', 'Stake', 'Stasjon', 'Stein', 'Stryk', 'Stø',
        'Støls-/setereiendom', 'Sva', 'Sykehus', 'Torg', 'Torvtak', 'Tuft', 'Turisthytte',
        'TV-/radio- eller mobiltelefontårn', 'Tømmervelte', 'Universitet/høgskole', 'Utsiktspunkt',
        'Utstikker', 'Vad', 'Vaktstasjon/beredsskapsbygning', 'Vannstandsmåler', 'Vannverk', 'Varde',
        'Vegbom', 'Vegkryss', 'Vegsving', 'Øyr',
    ],
    small: [
        'Administrativ bydel', 'Adressenavn', 'Alpinanlegg', 'Ankringsplass', 'Annen terrengdetalj',
        'Annen vanndetalj', 'Bakke', 'Bakke (Veg)', 'Bakke i sjø', 'Bakketopp i sjø', 'Bekk', 'Berg',
        'Bergverk', 'Boligfelt', 'Botn', 'Bydel', 'Båe', 'Båe i sjø', 'Del av innsjø', 'Del av vann', 'Egg',
        'Eid', 'Eid i sjø', 'Elvemel', 'Elvesving', 'Eng', 'Fiskeplass i sjø', 'Fjellkant', 'Fjellside',
        'Fjelltopp i sjø', 'Fjellvegg', 'Flyplass', 'Fonn', 'Friluftsområde', 'Grend', 'Grunne',
        'Grunne i sjø', 'Grunnkrets', 'Gruppe av tjern', 'Hammar', 'Haug', 'Havn', 'Havnehage', 'Holme',
        'Holme i sjø', 'Holmegruppe i sjø', 'Hylle', 'Hyttefelt', 'Høyde', 'Industriområde',
        'Jernbanetunnel', 'Juv', 'Kabel', 'Kanal', 'Klakk i sjø', 'Korallrev', 'Kraftgate (rørgate)',
        'Krater', 'Li', 'Lon', 'Mo', 'Myr', 'Nes', 'Nes i sjø', 'Nes ved elver', 'Oljeinstallasjon', 'Os',
        'Rev i sjø', 'Rygg', 'Sand', 'Senkning', 'Sjødetalj', 'Skar', 'Skjær', 'Skjær i sjø', 'Skog',
        'Skredområde', 'Slette', 'Sti', 'Strand', 'Strand i sjø', 'Stup', 'Sund', 'Sund i sjø', 'Søkk',
        'Taubane', 'Tettbebyggelse', 'Tettsteddel', 'Tjern', 'Topp', 'Traktorveg', 'Tunnel', 'Ur', 'Utmark',
        'Vann', 'Vik', 'Vik i sjø', 'Våg i sjø', 'Våtmarksområde', 'Øy', 'Ås',
    ],
    medium: [
        'Allmenning', 'Annen administrativ inndeling', 'Banestrekning', 'Banke', 'By', 'Bygdelag (bygd)',
        'Dal', 'Egg i sjø', 'Elv', 'Farled/skipslei', 'Ferjestrekning', 'Fjell', 'Fjellovergang',
        'Fjordmunning', 'Gass-/oljefelt i sjø', 'Gruppe av vann', 'Halvøy', 'Halvøy i sjø', 'Hei',
        'Hylle i sjø', 'Innsjø', 'Isbre', 'Kraftledning', 'Landskapsområde', 'Morenerygg i sjø', 'Poststed',
        'Ras i sjø', 'Renne/Kløft i sjø', 'Rygg i sjø', 'Rørledning', 'Sadel i sjø', 'Sjøstykke',
        'Skogområde', 'Skolekrets', 'Skytefelt', 'Sokn', 'Statistisk tettsted', 'Søkk i sjø', 'Tettsted',
        'Undersjøisk vegg', 'Valgkrets', 'Vegstrekning', 'Verneområde', 'Vulkan i sjø', 'Øy i sjø',
        'Øygruppe',
    ],
    large: [
        'Banke i sjø', 'Basseng i sjø', 'Dalføre', 'Fjellkjede i sjø', 'Fjellområde', 'Fjord',
        'Geologisk struktur', 'Havdyp', 'Iskuppel', 'Kommune', 'Platå i sjø', 'Reinbeitedistrikt',
        'Sokkel i sjø', 'Vidde', 'Øygruppe i sjø',
    ],
    region: ['Fylke', 'Havområde', 'Havstrøm', 'Kontinentalsokkel', 'Soneinndeling til havs'],
    country: ['Nasjon'],
};

const CLASS_BY_TYPE = new Map<string, ZoomClass>(
    (Object.entries(TYPES_BY_CLASS) as [ZoomClass, readonly string[]][]).flatMap(([cls, types]) =>
        types.map((t): [string, ZoomClass] => [t, cls]),
    ),
);

/** Geonorge sends some type names with trailing spaces ("Banke ", "Båe "), so trim before lookup. */
export function zoomClassForType(type: string): ZoomClass {
    return CLASS_BY_TYPE.get(type.trim()) ?? DEFAULT_ZOOM_CLASS;
}

/** Ground meters per pixel that suit a place of this type. */
export function metersPerPixelForType(type: string): number {
    return METERS_PER_PIXEL_AT_ZOOM_0 / 2 ** PLACE_ZOOM[zoomClassForType(type)];
}
