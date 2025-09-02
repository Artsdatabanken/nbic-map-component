// src/index.ts
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

export type NbicMapOptions = {
    target: string | HTMLElement;
    center?: [number, number]; // lon/lat in EPSG:3857 expected by default View; convert if needed
    zoom?: number;
};

export class NbicMapComponent {
    private map: Map;

    constructor(options: NbicMapOptions) {
        const { target, center = [0, 0], zoom = 2 } = options;

        this.map = new Map({
            target,
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
            ],
            view: new View({
                center,
                zoom,
            }),
        });
    }

    get instance(): Map {
        return this.map;
    }

    setCenter(center3857: [number, number]) {
        this.map.getView().setCenter(center3857);
    }

    setZoom(zoom: number) {
        this.map.getView().setZoom(zoom);
    }

    destroy() {
        this.map.setTarget(undefined);
    }
}

export default NbicMapComponent;