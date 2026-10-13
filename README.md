# nbic-map-component

Shared, framework-agnostic map component built on OpenLayers, designed to be used by host applications (Angular, React, Lit, plain TS/JS) through a stable API.

The library separates what the host application wants to do (MapApi) from how it is rendered (MapEngine / OpenLayers), making it easier to maintain, test, and extend.

---

## Architecture
```bash
The architecture is intentionally layered:

Host app (Angular/React/Lit/vanilla)
   |
   |  calls methods + subscribes to events
   v
MapApi (public facade)
   |
   |  delegates 1:1 to an engine, keeps public types stable
   v
MapEngine (interface)
   |
   |  concrete implementation chosen at runtime (or build-time)
   v
OlMapEngine (OpenLayers implementation)
   |
   +--> LayerRegistry (indexes layers/sources)
   +--> Adapters (LayerDef -> OL layer, StyleDef -> OL style, SourceDef -> OL source)
   +--> Controllers (Draw / Hover / Select / Geo / Controls / Zoom)
   |
   v
OpenLayers (ol/Map, ol/layer, ol/source, ol/interaction, ol/style)
```

### Design description
```bash
The host application (Angular, React, Lit, etc.):
	•	Owns application state
	•	Decides when and what to draw (layers, features, interactions)
	•	Talks only to MapApi

It never accesses OpenLayers directly.

MapApi
	•	Public API exposed by nbic-map-component
	•	Stable contract for host applications
	•	Methods like:
	•	adding/removing layers
	•	starting/stopping drawing
	•	selecting features
	•	controlling interactions

MapEngine
	•	Internal orchestration layer
	•	Translates MapApi calls into engine actions
	•	No OpenLayers imports
	•	Makes it possible to swap rendering engines in the future

OlMapEngine
	•	Concrete implementation using OpenLayers
	•	Owns:
	•	ol/Map
	•	layers, sources, interactions
	•	OpenLayers-specific logic (cluster, hover, select, draw)

Why this design?
	•	Clear separation of concerns
	•	Host apps stay simple and future-proof
	•	OpenLayers complexity is fully encapsulated
	•	Easier testing and playground setup
````
---

## Internal structure
```bash
src/
├─ api/                 # Public types & events (no OpenLayers imports)
│  ├─ types.ts
│  ├─ events.ts
│
├─ core/
│  ├─ MapApi.ts         # Public facade
│  ├─ MapEngine.ts     # Internal engine interface
│
│  └─ ol/
│     ├─ OlMapEngine.ts
│     ├─ adapters/     # Layer / source / style adapters
│     ├─ interactions/ # Draw, Hover, Select controllers
│     ├─ layers/       # LayerRegistry, base-layer logic
│     ├─ utils/        # Geometry, extent, projection helpers
│
├─ presets/             # Predefined layers & sources (WMTS, base maps)
│
└─ index.ts             # Public entry point
```

---

## 🚀 Getting started

### Install dependencies

```bash
npm install
```
### Build the library
```bash
npm run build
```
### Run tests
```bash
npm run test
npm run test:watch
```
### Lint and format
```bash
npm run lint
```

## 🧪 Playground (local testing)
This repo includes a small Vite-powered playground to test the component in the browser.

### Start it
```bash
npm run dev
```

## 📖 Usage
### Install via npm (once published):
```bash
npm install nbic-map-component
```
### Basic usage in Angular
```bash
import { NbicMapComponent, MapEvents } from 'nbic-map-component';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

export class AppComponent implements AfterViewInit {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  private map!: InstanceType<typeof NbicMapComponent>;

  ngAfterViewInit(): void {
    this.map = new NbicMapComponent({
          target: this.mapEl.nativeElement,
          projection: 'EPSG:3857',          // View must match WMTS projection
          center: [1157722.7042500454, 9208962.278247332],
          zoom: 4,
          minZoom: 1,
          maxZoom: 18,
          controls: { scaleLine: true, fullscreen: true, geolocation: true, zoom: true, attribution: true },
        });

    this.map.on(MapEvents.Ready, () => {
          this.mapReadyAction.next(true);
          this.map.activateHoverInfo();
        });
  }
}
```
### html
```bash
<div #mapEl class="map"></div>
```
### css
```bash
.map {
    height: 60vh;
    width: 100%;
}
```

### Place search
`map.searchPlaces(query, options?)` does a prefix search in [Geonorge stedsnavn](https://ws.geonorge.no/stedsnavn/v1/#/default/get_navn) straight from the browser and returns one `PlaceSearchResult` per spelling (Tromsø, Romsa and Tromssa are three results with the same `placeId`).

- `zoomLevel` suits the place type (a church gets closer than a fjord) and is computed for this map's view, so it can be passed straight to `setZoom`.
- `coordinates` are WGS84 `{ lat, lon }`.
- Options: `signal`, `limit` (default 10, max 500), `fuzzy`, `municipalityNumbers`, `countyNumbers`.
- Abort `signal` to cancel. The promise then rejects with an `AbortError`.

The zoom per type lives in `src/core/place-search/place-zoom.ts`.

Debounced search with RxJS:
```ts
const places$ = term$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap((term) => new Observable<PlaceSearchResult[]>((subscriber) => {
    const controller = new AbortController();
    map.searchPlaces(term, { signal: controller.signal })
      .then((places) => { subscriber.next(places); subscriber.complete(); }, (err) => subscriber.error(err));
    return () => controller.abort();
  })),
);

// on select
map.setCenter(map.transformCoordsFrom([place.coordinates.lon, place.coordinates.lat], 'EPSG:4326', 'EPSG:25833'));
map.setZoom(place.zoomLevel);
```