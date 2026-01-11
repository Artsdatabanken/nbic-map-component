// src/presets/layers/base/baseLayers.ts
import type { LayerDef } from '../../../api/types';

export const svalbardBaseLayer: LayerDef = {
    id: 'svalbard',
    kind: 'tile',
    base: 'regional',
    visible: false,
    opacity: 1,
    source: {
        type: 'wmts',
        options: {
            url: 'https://geodata.npolar.no/arcgis/rest/services/Basisdata/NP_Basiskart_Svalbard_WMTS_32633/MapServer/WMTS?',
            layer: 'Basisdata_NP_Basiskart_Svalbard_WMTS_32633',
            projection: 'EPSG:32633',
            matrixSetId: 'default028mm',        // critical for ArcGIS service
            format: 'image/jpgpng',
            style: 'default',
            wrapX: true,
            // levels: 17,
            attribution: '© Kartverket / Norsk Polarinstitutt',
        },
    },
};

export const janmayenBaseLayer: LayerDef = {
    id: 'janmayen',
    kind: 'tile',
    base: 'regional',
    visible: false,
    opacity: 1,
    source: {
        type: 'wmts',
        options: {
            url: 'https://geodata.npolar.no/arcgis/rest/services/Basisdata/NP_Basiskart_JanMayen_WMTS_25833/MapServer/WMTS?',
            layer: 'NP_Basiskart_JanMayen_WMTS_25833',
            projection: 'EPSG:25833',
            matrixSetId: 'default028mm',        // critical for ArcGIS service
            format: 'image/jpgpng',
            style: 'default',
            // levels: 17,
            wrapX: true,
            attribution: '© Kartverket / Norsk Polarinstitutt',
        },
    },
};

export const topografiskBaseLayer: LayerDef = {
    id: 'topografisk',
    name: 'Topografisk',
    kind: 'tile',
    base: 'regional',
    visible: true,
    source: {
        type: 'wmts',
        options: {
            url: 'https://cache.kartverket.no/v1/service',
            layer: 'topo',
            format: 'image/png',
            style: 'default',
            matrixSet: 'utm33n',
            projection: 'EPSG:25833',
            wrapX: true,
            opacity: 1,
            attribution: 'Kartverket',
        },
    },
};

export const topo4graatoneBaseLayer: LayerDef = {
    id: 'topo4graatone',
    name: 'Topografisk Gråtone',
    kind: 'tile',
    base: 'regional',
    visible: false,
    source: {
        type: 'wmts',
        options: {
            url: 'https://cache.kartverket.no/v1/service',
            layer: 'topograatone',
            format: 'image/png',
            style: 'default',
            matrixSet: 'utm33n',
            projection: 'EPSG:25833',
            wrapX: true,
            opacity: 1,
            attribution: 'Kartverket',
        },
    },
};

export const nib: LayerDef = {
    id: 'nib',
    name: 'Norge i Bilder',
    kind: 'tile',
    base: 'regional',
    visible: false,
    source: {
        type: 'wmts',
        options: {
            url: 'https://opencache.statkart.no/gatekeeper/gk/gk.open_nib_web_mercator_wmts_v2',
            layer: 'Nibcache_web_mercator_v2',
            format: 'image/png',
            style: 'default',
            matrixSet: 'GoogleMapsCompatible',
            projection: 'EPSG:3857',
            wrapX: true,
            opacity: 1,
            attribution: 'Kartverket',
        },
    },
};

export const osm: LayerDef = {
    id: 'osm',
    name: 'OSM',
    kind: 'tile',
    base: 'super',
    visible: true,
    source: {
        type: 'osm'        
    },
};