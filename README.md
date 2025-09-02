# nbic-map-component

Shared map component built on [OpenLayers](https://openlayers.org/) in TypeScript.  
Designed to be framework-agnostic, so it can be integrated into Angular, React, Lit, or vanilla JS projects.

---

## ✨ Features

- 🌍 OpenLayers-based map wrapper
- 📦 Distributed as **ESM + CJS** with TypeScript types
- 🔒 Strict TypeScript config
- 🧪 Unit tests with [Vitest](https://vitest.dev)
- 🛠️ Linting with [ESLint 9 flat config](https://eslint.org/)
- 🎨 Formatting with Prettier
- ⚡ Zero-config bundling via [tsup](https://tsup.egoist.dev/)
- 🚀 Playground with [Vite](https://vitejs.dev)

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
npx vite
```

## 📖 Usage
### Install via npm (once published):
```bash
npm install nbic-map-component
```
### Basic usage in your app
```bash
import { NbicMapComponent } from 'nbic-map-component';

// Attach to a DOM element with id="map"
const map = new NbicMapComponent({
  target: 'map',
  center: [0, 0], // EPSG:3857 coordinates
  zoom: 2,
});

// Control from code
map.setZoom(5);
map.setCenter([1000000, 5000000]);
```
