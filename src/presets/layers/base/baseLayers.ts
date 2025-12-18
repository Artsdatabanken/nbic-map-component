import type { LayerDef } from '../../../api/types';

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