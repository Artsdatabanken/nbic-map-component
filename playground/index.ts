import 'ol/ol.css';
import { createMap } from '../src';


// const map = createMap('map', {
//     version: 1,
//     id: 'demo',    
//     projection: 'EPSG:3857',
//     center: [0, 0],
//     zoom: 2,
//     maxZoom: 19,
//     controls: { zoom: true, scaleBar: true, attribution: true },
//     layers: [{ id: 'basemap', kind: 'tile', source: { type: 'osm'}, visible: true, base: true }, {
//         id: "eco",
//         kind: "vector",
//         visible: true,
//         source: { type: "geojson", options: { url: "https://openlayers.org/data/vector/ecoregions.json" } },
//         // you can’t encode a function in JSON; apply style later imperatively
//     }]
// });


const map = createMap('map', {
    target: 'map',
    id: 'demo',
    version: 1,
    projection: 'EPSG:25833',          // View must match WMTS projection
    center: [385056, 7155942],       // pick a reasonable center in EPSG:25833
    zoom: 6,
    minZoom: 0,
    maxZoom: 18,
});

map.addLayer({
    id: 'topografisk',
    kind: 'tile',
    base: true,
    source: {
        type: 'wmts',
        options: {
            url: 'https://cache.kartverket.no/v1/service',
            layer: 'topo',
            matrixSet: 'utm33n',            // Kartverket matrix set id
            projection: 'EPSG:25833',   
            tileSize: 256,
            levels: 18,                     // or resolutions if Kartverket documents them
            format: 'image/png',
            style: 'default',
            wrapX: false,                   // UTM – usually false
            opacity: 1,
        },
    },
    visible: true,
});

declare global {
    interface Window {
        nbicMap: ReturnType<typeof createMap>;
    }
}
window.nbicMap = map;

// import { createMap } from '../src';

// const mapA = createMap('mapA', {
//     version: 1, id: 'A',
//     projection: 'EPSG:3857',
//     center: [0, 0], zoom: 3, maxZoom: 19,
//     controls: { zoom: true, scaleBar: true, attribution: true },
//     layers: [{ id: 'basemap', kind: 'tile', source: { type: 'osm' }, visible: true, base: true }]
// });

// const mapB = createMap('mapB', {
//     version: 1, id: 'B',
//     projection: 'EPSG:3857',
//     center: [1_000_000, 7_500_000], zoom: 5, maxZoom: 19,
//     controls: { zoom: true, scaleBar: true, attribution: true },
//     layers: [{ id: 'basemap', kind: 'tile', source: { type: 'osm' }, visible: true, base: true }]
// });

// // Expose for devtools (optional)
// declare global {
//     interface Window {
//         mapA: ReturnType<typeof createMap>;
//         mapB: ReturnType<typeof createMap>;
//     }
// }
// window.mapA = mapA;
// window.mapB = mapB;