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
    projection: 'EPSG:3857',          // View must match WMTS projection
    center: [
        1712134.7297984553, 9680702.807509549],//[385056, 7155942], //[338210.0020499135, 7108618.769365374],//[385056, 7155942],       // pick a reasonable center in EPSG:25833
    zoom: 6,
    minZoom: 0,
    maxZoom: 18,
    controls: { scaleLine: true, fullscreen: true, geolocation: true, zoom: true, attribution: true },
});

map.addLayer(
    { id: 'basemap', base: 'super', kind: 'tile', source: { type: 'osm' }, visible: true }
);

map.addLayer({
    id: 'topografisk',
    kind: 'tile',
    base: 'regional',
    opacity: 1,
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
            attribution: '© Kartverket'
        },        
    },    
    visible: true
});


map.addLayer({
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
});

map.addLayer({
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
});



map.addLayer({
    id: "eco",
    kind: "vector",
    visible: false,
    source: { type: "geojson", options: { url: "https://openlayers.org/data/vector/ecoregions.json" } },
    // you can’t encode a function in JSON; apply style later imperatively
})

map.addLayer({
    id: "eiendom",
    kind: "vector",
    visible: true,
    source: { type: "geojson", options: { dataProjection: 'EPSG:25833', featureProjection: 'EPSG:3857', url: 'https://api.kartverket.no/eiendom/v1/geokoding?matrikkelnummer=5006-290%2F15&omrade=true&utkoordsys=25833' } },
    // you can’t encode a function in JSON; apply style later imperatively
})

// map.addLayer({
//     id: 'ar50',
//     kind: 'vector',
//     visible: false,
//     base: false,
//     source: {
//         type: 'wfs',
//         options: {
//             url: 'https://wfs.nibio.no/cgi-bin/ar50_2',
//             typeName: 'ms:AR50',
//             version: '2.0.0',
//             srsName: 'EPSG:25833',
//             outputFormat: 'application/gml+xml; version=3.2', // or 'text/xml; subtype=gml/3.1.1'
//             strategy: 'bbox',
//             // maxFeatures: 5000,
//             minZoomToLoad: 14,            
//         },
//     },
//     maxZoom: 18,
//     minZoom: 8,
//     style: { type: 'simple', options: { strokeColor: '#9e7795', strokeWidth: 1 } },
// });

map.addLayer({
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
    maxZoom: 18,
    minZoom: 1,
    pickable: false,
    hover: {
        style: { strokeColor: '#ff5a00', strokeWidth: 3, fillColor: 'rgba(255,90,0,0.12)' },
        hitTolerance: 8,
        clusterBehavior: 'unwrapSingle', // or 'bubble'
    },
    style: { type: 'simple', options: { strokeColor: '#9e7795', strokeWidth: 1.5, fillColor: 'rgba(46, 46, 46, 0.1)' } },
})

map.addLayer({
    id: 'markers',
    kind: 'vector',
    source: { type: 'memory' },
    // style: {ref: 'markers'},
    // style: { type: 'simple', options: { circle: { radius: 6, fillColor: '#007aff', strokeColor: '#fff', strokeWidth: 2 } } },
    zIndex: 5000
});

// map.addPoint('markers', [385056, 7155942],
//     { text: 'Danger' }, 
//     { 
//         // fillColor: '#ff3b30', strokeColor: '#fff', strokeWidth: 3, pointRadius: 8, 
//         text: { label: 'DangerX', font: 'bold 16px sans-serif', fillColor: '#fff', strokeColor: '#000', strokeWidth: 3, offsetY: -20 } 
//         // text: { label: 'location_pin', font: 'normal normal 400 30px "Material Icons"', fillColor: 'red', strokeColor: '#000', strokeWidth: 3, offsetY: -20 }
//     },
//     { dataProjection: 'EPSG:25833' }
// );


// GEOJSON with clustering
// Empty at first; populate later
// map.addLayer({
//     id: 'geojsonLayer',
//     kind: 'vector',
//     visible: true,    
//     source: { type: 'geojson', options: { dataProjection: 'EPSG:25833', featureProjection: 'EPSG:3857', text: '{"type":"FeatureCollection","features":[]}'} },
//     cluster: {
//         enabled: true,
//         distance: 50,
//         style: {
//             type: 'simple',
//             options: {          
//             circle: { radius: 14, fillColor: 'blue', strokeColor: 'yellow' },        
//             text: { fillColor: 'yellow', font: 'bold 14px sans-serif' }
//             }
//         },
//     },
// });

map.addLayer({
    id: 'geojsonLayer',
    kind: 'vector',
    visible: true,
    source: { type: 'geojson', options: { dataProjection: 'EPSG:25833', featureProjection: 'EPSG:3857', text: '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[382213.9958160136,7192693.298516899]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[379010.216936343,7194929.561227733]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[385966.8490689363,7195614.040144959]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[380955.9861982096,7196607.205632699]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[385085.8247894216,7197926.356068817]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[400934.4196401772,7149304.194866324]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[404805.37905920955,7149328.949441544]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[409912.57599976804,7151959.794116425]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[400934.4196401772,7153948.212827165]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[403836.96814668947,7156195.21246219]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}}]}' } },
    hover: {
        style: { strokeColor: 'yellow', strokeWidth: 4, fillColor: 'transparent', pointRadius: 14 },
        hitTolerance: 8,
        clusterBehavior: 'unwrapSingle', // or 'bubble'
    },
    cluster: {
        enabled: true,
        distance: 20,
        keepSingleAsCluster: true,
        style: {
            type: 'simple',
            options: {
                circle: { radius: 14, fillColor: 'blue', strokeColor: 'yellow' },
                text: { fillColor: 'yellow', font: 'bold 14px sans-serif' }
            }
        },
    },
});

map.on('pointer:click', (event) => {
    console.log('Map clickedA:', event);
});

map.on('ready', () => {
    console.log('Map ready');
});

map.once('draw:end', (event) => {
    console.log('Draw ended:', event);
    const drawnFeature = event.feature;
    map.setDrawnFeatureStyle(drawnFeature, {
        strokeColor: '#00ff00',
        strokeWidth: 4,
        fillColor: 'rgba(0,255,0,0.2)',
    });
    map.analyzeSelfIntersections(drawnFeature).then((result) => {console.log('Self-intersection analysis:', result); });
});

map.on('draw:vertex', (event) => {
    console.log('Draw vertex:', event);
});
    

// function updateGeojson(): void {    
//     map.updateGeoJSONLayer('geojsonLayer', '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[382213.9958160136,7192693.298516899]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[379010.216936343,7194929.561227733]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[385966.8490689363,7195614.040144959]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[380955.9861982096,7196607.205632699]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[385085.8247894216,7197926.356068817]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[400934.4196401772,7149304.194866324]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[404805.37905920955,7149328.949441544]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[409912.57599976804,7151959.794116425]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[400934.4196401772,7153948.212827165]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}},{"type":"Feature","geometry":{"type":"Point","coordinates":[403836.96814668947,7156195.21246219]},"properties":{"nbic:style":{"strokeColor":"#ff6600","fillColor":"rgba(255,102,0,0.2)","strokeWidth":2}}}]}', 
//         {mode: 'replace', keepStyles: false} )
// }

declare global {
    interface Window {
        nbicMap: ReturnType<typeof createMap>;
    }
}
window.nbicMap = map;
// (window as any).updateGeojson = updateGeojson;

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