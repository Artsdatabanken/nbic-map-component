import { NbicMapComponent } from '../src/index';

const map = new NbicMapComponent({
    target: 'map',
    center: [0, 0], // EPSG:3857 coordinates
    zoom: 2,
});

(window as Window & { nbicMap?: NbicMapComponent }).nbicMap = map; // makes it accessible in devtools