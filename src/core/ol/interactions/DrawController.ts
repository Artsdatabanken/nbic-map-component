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

import { makeDrawStyle, makeUpdatedDrawStyle } from '../adapters/draw-style';
import { Feature } from 'ol';
import { unByKey } from 'ol/Observable';
import { listen } from 'ol/events';
import type { EventsKey } from 'ol/events';

import type { DrawOptions, DrawStyleOptions, DrawExportOptions, DrawImportOptions, EnableEditingOptions } from '../../../api/types';
import type { Feature as GJFeature, Geometry as GJGeometry } from 'geojson';
import buffer from '@turf/buffer';
import type { StyleLike } from 'ol/style/Style';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import { LineString, Polygon, MultiLineString, MultiPolygon } from 'ol/geom';
import type { Coordinate } from 'ol/coordinate';
import { getUid } from 'ol/util';

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

// simple helpers (avoid .flat() to keep TS/lib happy)
function flattenOnce<T>(arr: T[][]): T[] {
    const out: T[] = [];
    for (const a of arr) out.push(...a);
    return out;
}
function flattenTwice<T>(arr: T[][][]): T[] {
    const out: T[] = [];
    for (const a of arr) for (const b of a) out.push(...b);
    return out;
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
    private vertexLayer?: VectorLayer<VectorSource<OlFeature<Point>>>;
    private vertexSrc?: VectorSource<OlFeature<Point>>;

    constructor(private events: Emitter<MapEventMap>) { }

    attach(map: OlMap) { this.map = map;}
    detach() { this.stop(); this.map = undefined; }

    getLayer() { this.ensureLayer(); return this.layer; }

    // --- Modify undo history ---
    private editUndoStack = new Map<string, Geometry[]>(); // key -> snapshots
    private editRedoStack = new Map<string, Geometry[]>(); // optional (keep for future)
    private lastEditedKey: string | null = null;

    private featureKey(f: OlFeature<Geometry>): string {
        const id = f.getId();
        if (typeof id === 'string') return id;
        if (typeof id === 'number') return String(id);
        return String(getUid(f));
    }

    private pushGeometrySnapshot(f: OlFeature<Geometry>) {
        const g = f.getGeometry();
        if (!g) return;

        const key = this.featureKey(f);
        this.lastEditedKey = key;

        const stack = this.editUndoStack.get(key) ?? [];
        // store clone (so it won't mutate)
        stack.push(g.clone());

        // optional: cap history to avoid memory growth
        const MAX = 50;
        if (stack.length > MAX) stack.splice(0, stack.length - MAX);

        this.editUndoStack.set(key, stack);

        // clear redo on new edits
        this.editRedoStack.set(key, []);
    }

    private restoreGeometrySnapshot(f: OlFeature<Geometry>, geom: Geometry) {
        // Set clone to avoid shared refs
        f.setGeometry(geom.clone());
    }

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

    private makeVertexStyle(opts?: DrawStyleOptions): StyleLike {
        const strokeColor = opts?.strokeColor ?? '#1976d2';
        const strokeWidth = opts?.strokeWidth ?? 2;
        const fillColor = opts?.fillColor ?? '#ffffff';
        const radius = opts?.pointRadius ?? 5;

        return new Style({
            image: new CircleStyle({
                radius,
                fill: new Fill({ color: fillColor }),
                stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
            }),
        });
    }

    private ensureVertexLayer(styleOpts?: DrawStyleOptions) {
        if (!this.map || this.vertexLayer) return;
        this.vertexSrc = new VectorSource<OlFeature<Point>>();
        this.vertexLayer = new VectorLayer({
            source: this.vertexSrc,
            properties: { 'nbic:role': 'draw-vertices' },
            zIndex: 9001,
            style: this.makeVertexStyle(styleOpts),
            updateWhileInteracting: true,
        });
        this.map.addLayer(this.vertexLayer);
    }

    private destroyVertexLayer() {
        if (this.vertexLayer && this.map) this.map.removeLayer(this.vertexLayer);
        this.vertexLayer = undefined;
        this.vertexSrc = undefined;
    }

    private verticesOfGeometry(g: Geometry): Coordinate[] {
        if (g instanceof LineString) {
            return g.getCoordinates() as Coordinate[];
        }
        if (g instanceof Polygon) {
            // rings: Coordinate[][]
            const rings = g.getCoordinates() as Coordinate[][];
            return flattenOnce(rings);
        }
        if (g instanceof MultiLineString) {
            // lines: Coordinate[][]
            const lines = g.getCoordinates() as Coordinate[][];
            return flattenOnce(lines);
        }
        if (g instanceof MultiPolygon) {
            // polygons: Coordinate[][][]
            const polys = g.getCoordinates() as Coordinate[][][];
            return flattenTwice(polys);
        }

        // For Point/Circle or unsupported geometries: no vertices (adjust if you want to show center, etc.)
        return [];
    }

    private rebuildVertexOverlay() {
        if (!this.vertexSrc || !this.source) return;
        this.vertexSrc.clear(true);
        const feats = this.source.getFeatures();
        for (const f of feats) {
            const g = f.getGeometry();
            if (!g) continue;
            const verts = this.verticesOfGeometry(g);
            for (let i = 0; i < verts.length; i++) {
                const coord = verts[i];
                if (!coord) continue;
                const v = new Feature<Point>({ geometry: new Point(coord) });
                // optionally carry parent id / index:
                const pid = f.getId();
                if (pid != null) v.set('nbic:parentId', pid);
                v.set('nbic:vertexIndex', i);
                this.vertexSrc.addFeature(v);
            }
        }
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
            if (this.vertexLayer) this.rebuildVertexOverlay();
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

    undoEdit(target?: { feature: OlFeature<Geometry> } | { layerId: string; featureId: string | number }) {
        if (!this.source) return;

        let f: OlFeature<Geometry> | null = null;

        // Resolve feature from argument
        if (target && 'feature' in target) {
            f = target.feature;
        } else if (target && 'featureId' in target) {
            // since this is DrawController, we only know about draw source
            const found = this.source.getFeatureById(target.featureId);
            f = (found as OlFeature<Geometry> | null) ?? null;
        } else {
            // fallback: undo last edited feature
            if (!this.lastEditedKey) return;
            // find feature by key
            const feats = this.source.getFeatures();
            for (const cand of feats) {
                const key = this.featureKey(cand as OlFeature<Geometry>);
                if (key === this.lastEditedKey) {
                    f = cand as OlFeature<Geometry>;
                    break;
                }
            }
        }

        if (!f) return;

        const key = this.featureKey(f);
        const stack = this.editUndoStack.get(key);
        if (!stack || stack.length === 0) return;

        // save current into redo (optional but nice)
        const cur = f.getGeometry();
        if (cur) {
            const redo = this.editRedoStack.get(key) ?? [];
            redo.push(cur.clone());
            this.editRedoStack.set(key, redo);
        }

        // restore previous snapshot
        const prev = stack.pop();
        if (!prev) return;

        this.restoreGeometrySnapshot(f, prev);

        if (this.vertexLayer) this.rebuildVertexOverlay();
        this.events.emit('edit:undo', { feature: f });
    }

    enableEditing(options?: boolean | EnableEditingOptions) {
        if (!this.map) return;
        this.ensureLayer();

        // normalize options
        let showHandles = true;               // Modify hover handles
        let persistent = false;              // persistent markers
        let vertexStyleOpts: DrawStyleOptions | undefined;

        if (typeof options === 'boolean') {
            showHandles = options;
        } else if (options) {
            showHandles = options.showVertices !== false; // default true
            persistent = !!options.showVerticesPersistent;
            vertexStyleOpts = options.vertexStyle;
        }

        // (Re)create Modify with desired handle style (or hidden)
        if (this.modify) {
            this.map.removeInteraction(this.modify);
            this.modify = undefined;
        }
        const modifyStyle: StyleLike | undefined = showHandles ? this.makeVertexStyle(vertexStyleOpts) : () => undefined;
        this.modify = new Modify({ source: this.source!, style: modifyStyle });
        this.map.addInteraction(this.modify);
        this.modify.on('modifystart', (e) => {
            const feats = e.features; // Collection<Feature>
            // Snapshot BEFORE edits
            for (let i = 0; i < feats.getLength(); i++) {
                const f = feats.item(i) as OlFeature<Geometry>;
                this.pushGeometrySnapshot(f);
            }
        });
        this.modify.on('modifyend', (e) => {            
            this.events.emit('edit:modified', {
                count: e.features.getLength(),
                feature: e.features.item(0) as OlFeature<Geometry>,
            });

            if (persistent) this.rebuildVertexOverlay();
        });

        // Snap as before
        if (!this.snap) {
            this.snap = new Snap({ source: this.source! });
            this.map.addInteraction(this.snap);
        }

        // Persistent vertex overlay toggle
        if (persistent) {
            this.ensureVertexLayer(vertexStyleOpts);
            // initial build
            this.rebuildVertexOverlay();
            // keep in sync with basic source-level changes
            this.source!.on('addfeature', () => this.rebuildVertexOverlay());
            this.source!.on('removefeature', () => this.rebuildVertexOverlay());
            this.source!.on('changefeature', () => this.rebuildVertexOverlay());
        } else {
            this.destroyVertexLayer();
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
        this.destroyVertexLayer();
    }

    clear() {
        const count = this.source?.getFeatures().length ?? 0;
        this.source?.clear(true);
        this.events.emit('draw:cleared', { count });
        if (this.vertexLayer) this.rebuildVertexOverlay();
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
        if (!feature) return;
        feature.set('nbic:style', style);          // keep style in properties for export/restore
        feature.setStyle(makeUpdatedDrawStyle(style));     // apply OL Style right away
    }

    clearFeatureStyle(feature: OlFeature<Geometry>): void {
        feature.unset('nbic:style', true);
        feature.setStyle(undefined); // OL will fall back to the layer style function
    }
}