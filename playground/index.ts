import 'ol/ol.css';
// import { createMap } from '../src';


// const map = createMap('map', {
//     version: 1,
//     id: 'demo',    
//     projection: 'EPSG:3857',
//     center: [0, 0],
//     zoom: 2,
//     maxZoom: 19,
//     controls: { zoom: true, scaleBar: true, attribution: true },
//     layers: [{ id: 'basemap', kind: 'tile', source: { type: 'osm' }, visible: true }]
// });
// declare global {
//     interface Window {
//         nbicMap: ReturnType<typeof createMap>;
//     }
// }
// window.nbicMap = map;

import { createMap } from '../src';

const mapA = createMap('mapA', {
    version: 1, id: 'A',
    projection: 'EPSG:3857',
    center: [0, 0], zoom: 3, maxZoom: 19,
    controls: { zoom: true, scaleBar: true, attribution: true },
    layers: [{ id: 'basemap-a', kind: 'tile', source: { type: 'osm' } }]
});

const mapB = createMap('mapB', {
    version: 1, id: 'B',
    projection: 'EPSG:3857',
    center: [1_000_000, 7_500_000], zoom: 5, maxZoom: 19,
    controls: { zoom: true, scaleBar: true, attribution: true },
    layers: [{ id: 'basemap-b', kind: 'tile', source: { type: 'osm' } }]
});

// Expose for devtools (optional)
declare global {
    interface Window {
        mapA: ReturnType<typeof createMap>;
        mapB: ReturnType<typeof createMap>;
    }
}
window.mapA = mapA;
window.mapB = mapB;