// src/core/ol/interactions/DrawController.ts
import type OlMap from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Draw, { createBox, /* createRegularPolygon, */ type GeometryFunction } from 'ol/interaction/Draw';
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
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';

// let featureCounter = 0;
// function nextFeatureId(): string {
//     featureCounter += 1;
//     return `draw-${Date.now()}-${featureCounter}`;
// }

function mapKindToDraw(
    kind: import('../../../api/types').DrawKind
): { type: 'Point' | 'LineString' | 'Polygon' | 'Circle'; geometryFunction?: GeometryFunction } {
    switch (kind) {
        case 'Point': return { type: 'Point' };
        case 'LineString': return { type: 'LineString' };
        case 'Polygon': return { type: 'Polygon' };
        case 'Circle': return { type: 'Circle' };
        case 'Text': return { type: 'Point' };
        case 'Box': return { type: 'Circle', geometryFunction: createBox() };
        // case 'Square':  return { type: 'Circle', geometryFunction: createRegularPolygon(4) };
    }
}

function vertexCount(geom: Geometry): number {
    if (geom instanceof Point) return 1;

    if (geom instanceof LineString) {
        const coords = geom.getCoordinates();              // number[][]
        return coords.length;
    }

    if (geom instanceof Polygon) {
        const rings = geom.getCoordinates();               // number[][][]
        if (rings.length === 0) return 0;
        const firstRing = rings[0];
        if (!firstRing) return 0;
        // first ring; last coord duplicates the first → exclude it
        return Math.max(0, firstRing.length - 1);
    }

    return 0; // other geometry types not counted
}

function lastVertex(geom: Geometry): [number, number] | null {
    if (geom instanceof Point) {
        const c = geom.getCoordinates();                   // number[]
        if (!Array.isArray(c) || c.length < 2) return null;
        return [c[0] as number, c[1] as number];
    }

    if (geom instanceof LineString) {
        const coords = geom.getCoordinates();              // number[][]
        if (!Array.isArray(coords) || coords.length === 0) return null;
        const last = coords[coords.length - 1];
        if (!Array.isArray(last) || last.length < 2) return null;
        return [last[0] as number, last[1] as number];
    }

    if (geom instanceof Polygon) {
        const rings = geom.getCoordinates();               // number[][][]
        if (!Array.isArray(rings) || rings.length === 0) return null;
        const ring = rings[0];
        // exclude the closing point (last is a repeat of the first)
        if (!Array.isArray(ring) || ring.length <= 1) return null;
        const last = ring[ring.length - 2];
        if (!Array.isArray(last) || last.length < 2) return null;
        return [last[0] as number, last[1] as number];
    }

    return null;
}

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

    attach(map: OlMap) { this.map = map;}
    detach() { this.stop(); this.map = undefined; }

    getLayer() { this.ensureLayer(); return this.layer; }

    // ————— helpers —————
    private ensureLayer() {
        if (!this.map || this.layer) return;
        this.source = new VectorSource<OlFeature<Geometry>>();
        this.layer = new VectorLayer({
            source: this.source,
            properties: { 'nbic:role': 'draw', id: 'draw-layer' },
            zIndex: 9000,
            style: this.currentDrawStyle,
            updateWhileInteracting: true,
        });
        this.layer.set('id', 'draw-layer');
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
        const drawParams = mapKindToDraw(opts.kind);
        this.ensureLayer();
        this.stop(); // remove old interactions first

        this.currentDrawStyle = makeDrawStyle(opts.style);
        this.layer!.setStyle(this.currentDrawStyle);

        // 1) Modify (initially disabled)
        this.modify = new Modify({ source: this.source! });
        this.map.addInteraction(this.modify);
        this.modify.setActive(false);

        // 2) Draw        
        this.draw = new Draw({
            source: this.source!,
            type: drawParams.type,
            geometryFunction: drawParams.geometryFunction,
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
        // this.draw.on('drawstart', () => this.events.emit('draw:start', { kind: opts.kind }));
        let keyHandler: ((ev: KeyboardEvent) => void) | null = null;

        this.draw.on('drawstart', (e) => {
            this.events.emit('draw:start', { kind: opts.kind });
            const sketch = e.feature as OlFeature<Geometry>;
            const geom = sketch.getGeometry();
            if (!geom) return;

            // emit vertex on growth
            let lastLen = vertexCount(geom);

            const changeKey: EventsKey = geom.on('change', () => {
                const len = vertexCount(geom);

                if (len > lastLen) {
                    const coord = lastVertex(geom);
                    if (coord) {
                        this.events.emit('draw:vertex', {
                            kind: opts.kind,
                            index: len - 1,                // 0-based, correct for lines/polygons
                            coordinate: coord,             // MapCoord
                        });
                    }
                } else if (len < lastLen) {
                    // optional: notify removals (works with undoLastPoint)
                    this.events.emit('draw:vertexRemoved', {
                        kind: opts.kind,
                        index: len,                      // new last index after removal
                    });
                }

                lastLen = len;                       // keep in sync after both add/remove
            });

            // keyboard helpers while sketching
            keyHandler = (ev: KeyboardEvent) => {
                const ctrlZ = (ev.key === 'z' || ev.key === 'Z') && (ev.ctrlKey || ev.metaKey);
                if (ev.key === 'Backspace' || ctrlZ) {
                    ev.preventDefault();
                    this.draw?.removeLastPoint();
                } else if (ev.key === 'Enter') {
                    ev.preventDefault();
                    this.draw?.finishDrawing();
                } else if (ev.key === 'Escape') {
                    ev.preventDefault();
                    // abort if available; otherwise just finish and undo later
                    (this.draw as Draw).abortDrawing?.();
                }
            };
            window.addEventListener('keydown', keyHandler);

            const detachPerSketch = () => {
                unByKey(changeKey);
                if (keyHandler) {
                    window.removeEventListener('keydown', keyHandler);
                    keyHandler = null;
                }
            };

            this.draw!.once('drawend', detachPerSketch);
            // drawabort exists on OL Draw; if your types don’t include it, you can omit this line safely
            this.draw!.once('drawabort' as unknown as 'drawend', detachPerSketch);
        });

        this.draw.on('drawend', async (e) => {
            const f = e.feature as OlFeature<Geometry>;            
            if (!f.getId()) {
                f.setId(crypto.randomUUID());
            }
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

    undoLastPoint() {
        this.draw?.removeLastPoint();
    }

    finishCurrent() {
        this.draw?.finishDrawing();
    }

    abortCurrent() {
        this.draw?.abortDrawing();
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

    setFeatureStyle(feature: OlFeature<Geometry>, style: DrawStyleOptions): void {
        feature.set('nbic:style', style);          // keep style in properties for export/restore
        feature.setStyle(makeDrawStyle(style));     // apply OL Style right away
    }

    clearFeatureStyle(feature: OlFeature<Geometry>): void {
        feature.unset('nbic:style', true);
        feature.setStyle(undefined); // OL will fall back to the layer style function
    }
}