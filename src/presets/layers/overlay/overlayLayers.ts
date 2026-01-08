// src/presets/layers/overlay/overlayLayers.ts
import type { LayerDef } from '../../../api/types';

export const norwayCoordinate = [10.4, 63.44];

export const administrativeEnheterKommune: LayerDef = {
    id: 'kommune',
    kind: 'vector',
    visible: true,
    base: false,
    source: {
        type: 'wfs',
        options: {
            url: 'https://wfs.geonorge.no/skwms1/wfs.administrative_enheter',
            outputFormat: 'application/gml+xml; version=3.2', // or 'text/xml; subtype=gml/3.1.1'
            typeName: 'app:Kommune',
            srsName: 'EPSG:3857',
            minZoomToLoad: 1,
            strategy: 'bbox',
        },
    },
    pickable: false,
    maxZoom: 14,
    minZoom: 7,
    zIndex: -2,
    zIndexPinned: true,
    hover: {
        style: { strokeColor: 'transparent', fillColor: 'transparent' },
    },
    style: { type: 'simple', options: { strokeColor: '#6d6099', strokeWidth: 0.5, fillColor: 'transparent' } },
};

export const administrativeEnheterFylke: LayerDef = {
    id: 'fylker',
    kind: 'vector',
    visible: true,
    base: false,
    source: {
        type: 'wfs',
        options: {
            url: 'https://wfs.geonorge.no/skwms1/wfs.administrative_enheter',
            outputFormat: 'application/gml+xml; version=3.2', // or 'text/xml; subtype=gml/3.1.1'
            typeName: 'app:Fylke',
            srsName: 'EPSG:3857',
            minZoomToLoad: 1,
            strategy: 'bbox',
        },
    },
    pickable: false,
    maxZoom: 14,
    minZoom: 1,
    zIndex: -1,
    zIndexPinned: true,
    hover: {
        style: { strokeColor: 'transparent', fillColor: 'transparent' },
    },
    style: { type: 'simple', options: { strokeColor: '#9e7795', strokeWidth: 1.5, fillColor: 'transparent' } },
};