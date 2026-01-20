import { createMap, nbicMapPresets, type LayerDef } from '../src/index';
import { buildSamples } from './samples';
import { wireUi } from './ui';
import 'ol/ol.css';

const mapEl = document.getElementById('map');
if (!mapEl) throw new Error('Missing #map element');

// NOTE: ids live in playground/index.html
const eventsEl = document.getElementById('eventLog');
const featuresEl = document.getElementById('featuresJson');

const map = createMap('map',{
  id: 'demo',
  version: 1,
  target: 'map',
    projection: 'EPSG:3857',
  center: [1140000, 8360000],
  zoom: 6,
  minZoom: 0,
  maxZoom: 18,    
//   enableDefaults: true,
  controls: { zoom: true, fullscreen: true, attribution: true, scaleLine: true },
});

// Expose for quick debugging in devtools
(window as unknown as { nbicMap?: unknown }).nbicMap = map;

// OSM base (super)
map.addLayer(nbicMapPresets.osm); // temporarily add OSM for initial view
// --- Layers ---
const topo = nbicMapPresets.topografiskBaseLayer;

// if you want to use UTM33N for topo instead of WebMercator, uncomment this:
// if (topo.source.type === 'wmts' ) {
//     topo.source.options.projection = 'EPSG:25833';
//     topo.source.options.matrixSet = 'utm33n';
// }

const baseLayers: LayerDef[] = [
  // Kartverket Topo (regional sheet)
  {
    ...topo,
    id: 'kv_topo',
    base: 'regional',    
  },
  {
    ...nbicMapPresets.topo4graatoneBaseLayer,
  },
  {
        ...nbicMapPresets.svalbardBaseLayer,
    },
    {
        ...nbicMapPresets.janmayenBaseLayer,
    }
];

for (const l of baseLayers) map.addLayer(l);

const { clusterPoints, polygon, accuracyCircles } = buildSamples();

map.addLayer(clusterPoints);
map.addLayer(polygon);
map.addLayer(accuracyCircles);

// Keep polygon above points by default
map.reorderLayers(['osm', 'kv_topo', 'accuracyCircles', 'clusterPoints', 'polygon']);

// --- Event log ---
const log = (msg: string) => {
    if (!eventsEl) return;
    const ts = new Date().toLocaleTimeString();
    eventsEl.textContent = `[${ts}] ${msg}\n` + (eventsEl.textContent ?? '');
};

map.on('draw:start', (e) => log(`draw:start kind=${e.kind}`));
map.on('draw:vertex', (e) => log(`draw:vertex i=${e.index} coord=${e.coordinate[0].toFixed(1)},${e.coordinate[1].toFixed(1)}`));
map.on('draw:vertexRemoved', (e) => log(`draw:vertexRemoved -> index=${e.index}`));
map.on('draw:end', (e) => {
    log(`draw:end id=${String(e.feature.getId?.() ?? 'n/a')} type=${e.feature.getGeometry()?.getType()}`);
    renderFeatures();
});
map.on('edit:modified', (e) => {
    const id = e.feature?.getId?.();
    log(`edit:modified count=${e.count} featureId=${String(id ?? 'n/a')}`);
    renderFeatures();
});
map.on('select:changed', (e) => log(`select:changed ${e ? `${e.layerId}#${String(e.featureId)}` : 'null'}`));
map.on('hover:info', (e) => {
    if (!e) return;
    const f = e.items[0]?.feature;
    const id = f?.getId?.();
    const t = f?.getGeometry()?.getType();
    log(`hover ${t ?? ''} id=${String(id ?? 'n/a')}`);
});

function renderFeatures() {
    if (!featuresEl) return;

    // drawn features live on the internal draw layer (id: draw-layer)
    const geojson = map.exportDrawnGeoJSON({ pretty: true });
    featuresEl.textContent = geojson;
}

renderFeatures();

// --- UI wiring ---
wireUi({
    map,
    log,
    renderFeatures,
    layers: {
        cluster: 'clusterPoints',
        polygon: 'polygon',
        accuracy: 'accuracyCircles',
    },
    baseLayerIds: baseLayers.map((l) => l.id),
    overlayLayerIds: ['clusterPoints', 'polygon', 'accuracyCircles'],
});

// Reasonable defaults
map.enableDrawEditing({ showVertices: true, showVerticesPersistent: true, vertexStyle: { strokeColor: '#1976d2', fillColor: '#ffffff', strokeWidth: 2, pointRadius: 4 } });


// import { createMap, nbicMapPresets, type LayerDef } from '../src/index';
// import { buildSamples } from './samples';
// import { wireUi } from './ui';
// import 'ol/ol.css';

// const mapEl = document.getElementById('map');
// if (!mapEl) throw new Error('Missing #map element');

// const eventsEl = document.getElementById('events');
// const featuresEl = document.getElementById('features');

// const map = createMap('map',{
//   id: 'demo',
//   version: 1,
//   target: 'map',
//     projection: 'EPSG:3857',
//   center: [1140000, 8360000],
//   zoom: 6,
//   minZoom: 0,
//   maxZoom: 18,    
// //   enableDefaults: true,
//   controls: { zoom: true, fullscreen: true, attribution: true, scaleLine: true },
// });

// // Expose for quick debugging in devtools
// (window as unknown as { nbicMap?: unknown }).nbicMap = map;

// // OSM base (super)
// map.addLayer(nbicMapPresets.osm); // temporarily add OSM for initial view
// // --- Layers ---
// const baseLayers: LayerDef[] = [
//   // Kartverket Topo (regional sheet)
//   {
//     ...nbicMapPresets.topografiskBaseLayer,
//     id: 'kv_topo',
//     base: 'regional',
//     visible: true,
//   },
//   {
//     ...nbicMapPresets.topo4graatoneBaseLayer,
//   }
// ];

// for (const l of baseLayers) map.addLayer(l);

// const { clusterPoints, polygon } = buildSamples();

// map.addLayer(clusterPoints);
// map.addLayer(polygon);

// // Keep polygon above points by default
// map.reorderLayers(['osm', 'kv_topo', 'clusterPoints', 'polygon']);

// // --- Event log ---
// const log = (msg: string) => {
//   if (!eventsEl) return;
//   const ts = new Date().toLocaleTimeString();
//   eventsEl.textContent = `[${ts}] ${msg}\n` + (eventsEl.textContent ?? '');
// };

// map.on('draw:start', (e) => log(`draw:start kind=${e.kind}`));
// map.on('draw:vertex', (e) => log(`draw:vertex i=${e.index} coord=${e.coordinate[0].toFixed(1)},${e.coordinate[1].toFixed(1)}`));
// map.on('draw:vertexRemoved', (e) => log(`draw:vertexRemoved -> index=${e.index}`));
// map.on('draw:end', (e) => {
//   log(`draw:end id=${String(e.feature.getId?.() ?? 'n/a')} type=${e.feature.getGeometry()?.getType()}`);
//   renderFeatures();
// });
// map.on('edit:modified', (e) => {
//   const id = e.feature?.getId?.();
//   log(`edit:modified count=${e.count} featureId=${String(id ?? 'n/a')}`);
//   renderFeatures();
// });
// map.on('select:changed', (e) => log(`select:changed ${e ? `${e.layerId}#${String(e.featureId)}` : 'null'}`));
// map.on('hover:info', (e) => {
//   if (!e) return;
//   const f = e.items[0]?.feature;
//   const id = f?.getId?.();
//   const t = f?.getGeometry()?.getType();
//   log(`hover ${t ?? ''} id=${String(id ?? 'n/a')}`);
// });

// function renderFeatures() {
//   if (!featuresEl) return;

//   // drawn features live on the internal draw layer (id: draw-layer)
//   const geojson = map.exportDrawnGeoJSON({ pretty: true });
//   featuresEl.textContent = geojson;
// }

// renderFeatures();

// // --- UI wiring ---
// wireUi({
//   map,
//   baseLayerIds: baseLayers.map((l) => l.id),
//   overlayLayerIds: ['clusterPoints', 'polygon'],
//   overlays: {
//     cluster: clusterPoints,
//     polygon: polygon,    
//   },
//   pushLog: log,
//   renderFeatureList: renderFeatures,
// });

// // Reasonable defaults
// map.enableDrawEditing({ showVertices: true, showVerticesPersistent: true, vertexStyle: { strokeColor: '#1976d2', fillColor: '#ffffff', strokeWidth: 2, pointRadius: 4 } });
