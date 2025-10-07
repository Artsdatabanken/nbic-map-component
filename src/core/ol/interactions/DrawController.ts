// src/core/ol/interactions/DrawController.ts
import type OlMap from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import GeoJSON from 'ol/format/GeoJSON';
import type { Feature as OlFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import Point from 'ol/geom/Point';
import type { MapEventMap } from '../../../api/events';
import type { Emitter } from '../../state/store';

import { makeDrawStyle } from '../adapters/draw-style';
import { Feature } from 'ol';
import { unByKey } from 'ol/Observable';
import { listen } from 'ol/events';
import type { EventsKey } from 'ol/events';

import type { DrawOptions, DrawStyleOptions, DrawExportOptions, DrawImportOptions } from '../../../api/types';
import type { Feature as GJFeature, Geometry as GJGeometry } from 'geojson';
import buffer from '@turf/buffer';

export class DrawController {
    private map?: OlMap;
    private source?: VectorSource<OlFeature<Geometry>>;
    private layer?: VectorLayer<VectorSource<OlFeature<Geometry>>>;
    private draw?: Draw;
    private modify?: Modify;
    private snap?: Snap;
    private fmt = new GeoJSON();
    private currentDrawStyle = makeDrawStyle(undefined);

    constructor(private events: Emitter<MapEventMap>) { }

    attach(map: OlMap) { this.map = map; }
    detach() { this.stop(); this.map = undefined; }

    // ————— helpers —————
    private ensureLayer() {
        if (!this.map || this.layer) return;
        this.source = new VectorSource<OlFeature<Geometry>>();
        this.layer = new VectorLayer({
            source: this.source,
            properties: { 'nbic:role': 'draw' },
            zIndex: 9000,
            style: this.currentDrawStyle,
            updateWhileInteracting: true,
        });
        this.map.addLayer(this.layer);
    }

    private setStyle(f: OlFeature<Geometry>, s?: DrawStyleOptions) {
        if (!s) return;
        f.set('nbic:style', s);
        f.setStyle(makeDrawStyle(s));
    }

    createPointFeature(coord: [number, number], props?: Record<string, unknown>, style?: DrawStyleOptions) {
        const f = new Feature<Geometry>({ geometry: new Point(coord) });
        if (props) Object.entries(props).forEach(([k, v]) => f.set(k, v));
        this.setStyle(f, style);
        return f;
    }

    // Turf buffer around any feature (returns OL Feature in view projection)
    private async turfBufferFeature(
        feature: OlFeature<Geometry>,
        opts: { distance: number; units?: 'meters' | 'kilometers' | 'miles' | 'feet'; steps?: number }
    ): Promise<OlFeature<Geometry> | null> {
        if (!this.map) return null;
        const viewProj = String(this.map.getView().getProjection().getCode());
        const gj: GJFeature<GJGeometry> = this.fmt.writeFeatureObject(feature, {
            dataProjection: 'EPSG:4326',
            featureProjection: viewProj,
        });
        const turfOpts = { units: opts.units ?? 'meters', steps: opts.steps ?? 64 } as const;
        const buffered = buffer(gj, opts.distance, turfOpts);
        if (!buffered) return null;
        const out = this.fmt.readFeature(buffered as GJFeature<GJGeometry>, {
            dataProjection: 'EPSG:4326',
            featureProjection: viewProj,
        }) as OlFeature<Geometry>;
        return out;
    }

    // ————— public API —————
    async start(opts: DrawOptions) {        
        if (!this.map) return;
        this.ensureLayer();
        this.stop(); // remove old interactions first

        this.currentDrawStyle = makeDrawStyle(opts.style);
        this.layer!.setStyle(this.currentDrawStyle);

        // 1) Modify (initially disabled)
        this.modify = new Modify({ source: this.source! });
        this.map.addInteraction(this.modify);
        this.modify.setActive(false);

        // 2) Draw
        const olType = opts.kind === 'Text' ? 'Point' : opts.kind;
        this.draw = new Draw({
            source: this.source!,
            type: olType as 'Point' | 'LineString' | 'Polygon' | 'Circle',
            style: this.currentDrawStyle,
        });
        this.map.addInteraction(this.draw);

        // 3) Snap
        const snapTol = Math.max(2, Math.min(25, 10));
        if (opts.snap ?? true) {
            this.snap = new Snap({ source: this.source!, pixelTolerance: snapTol });
            this.map.addInteraction(this.snap);
        }

        // Events
        this.draw.on('drawstart', () => this.events.emit('draw:start', { kind: opts.kind }));

        this.draw.on('drawend', async (e) => {
            const f = e.feature as OlFeature<Geometry>;
            this.setStyle(f, opts.style);
            this.modify?.setActive(true);

            const b = opts.buffer;

            // ——— Interactive buffer (Point | LineString | Polygon) ———
            const wantsInteractive =
                !!b && (b === true || (typeof b === 'object' && b.interactive)) &&
                ['Point', 'LineString', 'Polygon'].includes(f.getGeometry()?.getType() || '');

            if (wantsInteractive && this.map && this.source) {
                const params = (b === true ? {} : b) as {
                    steps?: number;
                    style?: DrawStyleOptions;
                    replaceOriginal?: boolean;
                    units?: 'meters' | 'kilometers' | 'miles' | 'feet';
                };

                const g = f.getGeometry()!;
                const gType = g.getType();
                const previewStyle = params.style ?? { strokeColor: '#0080ff', strokeWidth: 2, fillColor: 'rgba(0,128,255,0.12)' };

                let preview: OlFeature<Geometry> | null = null;
                let lastDist = 0;

                const THROTTLE_MS = 90;
                let lastRun = 0;

                const distanceToGeometry = (px: [number, number]) => {
                    if (gType === 'Point') {
                        const c = (g as Point).getCoordinates() as [number, number];
                        const dx = px[0] - c[0], dy = px[1] - c[1];
                        return Math.sqrt(dx * dx + dy * dy);
                    }
                    const closest = g.getClosestPoint(px) as [number, number];
                    const dx = px[0] - closest[0], dy = px[1] - closest[1];
                    return Math.sqrt(dx * dx + dy * dy);
                };

                // Pause editing while picking
                this.modify?.setActive(false);
                this.snap?.setActive?.(false);
                // this.draw?.setActive(false);

                let moveKey: EventsKey | undefined = this.map.on('pointermove', async (evt) => {
                    const now = performance.now();
                    if (now - lastRun < THROTTLE_MS) return;
                    lastRun = now;
                    const dist = distanceToGeometry(evt.coordinate as [number, number]);
                    if (dist <= 0) return;
                    lastDist = dist;

                    const buffered = await this.turfBufferFeature(f, {
                        distance: dist,
                        units: params.units ?? 'meters',
                        steps: params.steps ?? 64,
                    });
                    if (!buffered) return;

                    buffered.set('nbic:style', previewStyle);
                    buffered.setStyle(makeDrawStyle(previewStyle));

                    if (preview) this.source!.removeFeature(preview);
                    preview = buffered;
                    this.source!.addFeature(preview);
                });
                const pointerDownListener = listen(this.map,'pointerdown', () => finalize());

                const detach = () => {
                    if (moveKey) { unByKey(moveKey); moveKey = undefined; }
                    if (pointerDownListener) { unByKey(pointerDownListener); }
                };

                const finalize = () => {
                    detach();
                    if (preview) {
                        if (params.replaceOriginal) this.source!.removeFeature(f);                        
                        this.events.emit('buffer:created', { baseFeature: f, bufferFeature: preview, distance: lastDist, units: params.units ?? 'meters' });
                        preview = null;
                    }                    
                    this.stop();
                };                                

                // ESC cancels
                const esc = (e: KeyboardEvent) => {
                    if (e.key !== 'Escape') return;
                    if (moveKey) { unByKey(moveKey); moveKey = undefined; }
                    if (preview) { this.source!.removeFeature(preview); preview = null; }
                    window.removeEventListener('keydown', esc);
                    this.modify?.setActive(true);
                    this.snap?.setActive?.(true);
                    this.draw?.setActive(true);
                };
                window.addEventListener('keydown', esc);

                this.events.emit('buffer:interactive:start', { mode: gType });
                return; // interactive manages its own finalize                
            }

            // ——— Non-interactive buffer ———
            const wantsNonInteractive = !!b && typeof b === 'object' && !b.interactive;
            if (wantsNonInteractive && this.map && this.source) {
                const bb = b as { distance?: number; units?: 'meters' | 'kilometers' | 'miles' | 'feet' ; steps?: number; style?: DrawStyleOptions; replaceOriginal?: boolean; };                
                const buffered = await this.turfBufferFeature(f, {
                    distance: bb.distance ?? 50,
                    units: bb.units ?? 'meters',
                    steps: bb.steps ?? 64,
                });
                if (buffered) {
                    const finalStyle = bb.style ?? { strokeColor: '#0057ff', strokeWidth: 2, fillColor: 'rgba(0,87,255,0.16)' };
                    buffered.set('nbic:style', finalStyle);
                    buffered.setStyle(makeDrawStyle(finalStyle));
                    this.source.addFeature(buffered);
                    if (bb.replaceOriginal) this.source.removeFeature(f);
                    this.events.emit('buffer:created', { baseFeature: f, bufferFeature: buffered, distance: bb.distance ?? 0, units: bb.units ?? 'meters' });
                }
            }

            // normal end
            this.events.emit('draw:end', { feature: f });
        });
    }

    stop() {
        if (!this.map) return;
        if (this.draw) {
            this.map.removeInteraction(this.draw);
            this.draw = undefined;
        } 
        if (this.modify) {
            this.map.removeInteraction(this.modify);
            this.modify = undefined;
        }
        if (this.snap) {
            this.map.removeInteraction(this.snap);
            this.snap = undefined;
        }
    }

    enableEditing() {
        if (!this.map) return;
        this.ensureLayer();
        if (!this.modify) {
            this.modify = new Modify({ source: this.source! });
            this.map.addInteraction(this.modify);
            this.modify.on('modifyend', (e) => this.events.emit('edit:modified', { count: e.features.getLength() }));
        }
        if (!this.snap) {
            this.snap = new Snap({ source: this.source! });
            this.map.addInteraction(this.snap);
        }
    }
    disableEditing() {
        if (!this.map) return;
        // if (this.modify) this.map.removeInteraction(this.modify), (this.modify = undefined);
        if (this.modify) {
            this.map.removeInteraction(this.modify);
            this.modify = undefined;
        } 
        if (this.snap) {
            this.map.removeInteraction(this.snap);
            this.snap = undefined;
        }
    }

    clear() {
        const count = this.source?.getFeatures().length ?? 0;
        this.source?.clear(true);
        this.events.emit('draw:cleared', { count });
    }

    exportGeoJSON(map: OlMap, opts?: DrawExportOptions) {
        const json = this.fmt.writeFeatures(this.source?.getFeatures() ?? [], {
            featureProjection: String(map.getView().getProjection() ?? 'EPSG:3857'),
        });
        return opts?.pretty ? JSON.stringify(JSON.parse(json), null, 2) : json;
    }

    importGeoJSON(map: OlMap, geojson: string, opts?: DrawImportOptions) {
        this.ensureLayer();
        const features = this.fmt.readFeatures(geojson, {
            featureProjection: String(map.getView().getProjection()),
        });
        if (opts?.clearExisting) this.source!.clear(true);
        for (const f of features) {
            const styleOpts = f.get('nbic:style') as DrawStyleOptions | undefined;
            if (styleOpts) f.setStyle(makeDrawStyle(styleOpts));
            const label = f.get('label') as string | undefined;
            if (label && styleOpts?.text) f.setStyle(makeDrawStyle({ ...styleOpts, text: { ...styleOpts.text, label } }));
        }
        this.source!.addFeatures(features);
        this.events.emit('draw:imported', { count: features.length });
    }
}