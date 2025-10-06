// src/core/ol/geo/GeoController.ts
import Geolocation from 'ol/Geolocation';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import CircleGeom from 'ol/geom/Circle';
import Point from 'ol/geom/Point';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import type OlMap from 'ol/Map';
import type { Emitter } from '../../state/store';
import type { MapEventMap } from '../../../api/events';
import { Feature } from 'ol';

export class GeoController {
    private map?: OlMap;
    private geo?: Geolocation;
    private src?: VectorSource;
    private layer?: VectorLayer<VectorSource>;
    private follow = false;

    constructor(private events: Emitter<MapEventMap>) { }

    attach(map: OlMap) { this.map = map; }
    detach() { this.deactivate(); this.map = undefined; }

    private ensureLayer() {
        if (!this.map || this.layer) return;
        this.src = new VectorSource();
        this.layer = new VectorLayer({
            source: this.src,
            properties: { 'nbic:role': 'geolocation' },
            zIndex: 9998,
            style: (f) => {
                const g = f.getGeometry();
                if (g instanceof CircleGeom) {
                    return new Style({
                        fill: new Fill({ color: 'rgba(33,150,243,0.15)' }),
                        stroke: new Stroke({ color: '#2196f3', width: 1 }),
                    });
                }
                return new Style({
                    image: new CircleStyle({
                        radius: 6,
                        fill: new Fill({ color: '#2196f3' }),
                        stroke: new Stroke({ color: '#fff', width: 2 }),
                    }),
                });
            },
        });
        this.map.addLayer(this.layer);
    }

    activate(follow?: boolean) {
        if (!this.map) return;
        if (!this.geo) {
            this.geo = new Geolocation({
                projection: this.map.getView().getProjection(),
                tracking: false,
                trackingOptions: { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 },
            });
            this.geo.on('change:position', () => {
                const p = this.geo!.getPosition() as [number, number] | null;
                const acc = this.geo!.getAccuracy();
                if (!p) { this.events.emit('geo:position', null); return; }

                this.ensureLayer();
                this.src!.clear();
                this.src!.addFeatures([
                    new Feature({ geometry: new CircleGeom(p, acc || 0) }),
                    new Feature({ geometry: new Point(p) }),
                ]);

                if (this.follow) this.map!.getView().setCenter(p);
                this.events.emit('geo:position', { coordinate: p, accuracy: acc ?? undefined });
            });
            this.geo.on('error', (e) => {
                this.events.emit('geo:error', { message: ((e as unknown) as Error).message ?? 'Geolocation error' });
            });
        }
        this.follow = !!follow;
        this.geo!.setTracking(true);
    }

    deactivate() {
        if (this.geo) this.geo.setTracking(false);
        if (this.layer && this.map) this.map.removeLayer(this.layer);
        this.geo = undefined; this.src = undefined; this.layer = undefined;
    }

    async zoomToGeolocation(maxZoom = 14): Promise<boolean> {
        if (!this.map) return false;
        this.activate(true);
        return new Promise<boolean>((resolve) => {
            const once = () => {
                const p = this.geo!.getPosition() as [number, number] | null;
                if (p) {
                    this.ensureLayer();
                    this.map!.getView().animate({ center: p, zoom: Math.max(this.map!.getView().getZoom() ?? 0, maxZoom), duration: 300 });
                    resolve(true);
                } else resolve(false);
                this.geo!.un('change:position', once);
                this.geo!.setTracking(false);
            };
            this.geo!.on('change:position', once);
        });
    }
}