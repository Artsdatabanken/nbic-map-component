// src/core/ol/interactions/HoverInfo.ts
import type OlMap from 'ol/Map';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type { Pixel } from 'ol/pixel';

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import type { Geometry } from 'ol/geom';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';

import type { Emitter } from '../../state/store';
import { MapEventMap, MapEvents } from '../../../api/events';
import type { MapCoord, HoverInfoOptions, DrawStyleOptions } from '../../../api/types';

type ReqHoverOpts = Required<HoverInfoOptions> & { fillColor: string };

const DEFAULTS: ReqHoverOpts = {
    hitTolerance: 5,
    outlineColor: '#ffcc00',
    outlineWidth: 3,
    fillColor: 'rgba(255,204,0,0.15)',
};

export class HoverInfoController {
    private map: OlMap;
    private events: Emitter<MapEventMap>;
    private opts: ReqHoverOpts = { ...DEFAULTS };

    private hoverLayer: VectorLayer | null = null;
    private hoverSource: VectorSource | null = null;
    private pointerMoveKey: EventsKey | null = null;
    private lastHoverId: unknown = null;

    constructor(map: OlMap, events: Emitter<MapEventMap>) {
        this.map = map;
        this.events = events;
    }

    activate(options?: HoverInfoOptions) {
        if (options) this.opts = { ...this.opts, ...options };
        this.ensureLayer();
        this.bindPointerMove();
    }

    deactivate() {
        this.unbindPointerMove();
        this.destroyLayer();
    }

    setOptions(options: HoverInfoOptions) {
        this.opts = { ...this.opts, ...options };
    }

    destroy() {
        this.deactivate();
    }

    // ---- internals ----

    // private ensureLayer() {
    //     if (this.hoverLayer) return;
    //     this.hoverSource = new VectorSource();
    //     this.hoverLayer = new VectorLayer({
    //         source: this.hoverSource,
    //         style: () =>
    //             new Style({
    //                 stroke: new Stroke({ color: this.opts.outlineColor, width: this.opts.outlineWidth }),
    //                 fill: new Fill({ color: this.opts.fillColor }),
    //             }),
    //         properties: { 'nbic:role': 'hover' },
    //         zIndex: 9_999,
    //         updateWhileInteracting: true,
    //     });
    //     this.map.addLayer(this.hoverLayer);
    // }

    private ensureLayer() {
        console.log('HoverInfoController.ensureLayer: ', this.hoverLayer);
        if (this.hoverLayer) return;
        this.hoverSource = new VectorSource();
        this.hoverLayer = new VectorLayer({
            source: this.hoverSource,
            properties: { 'nbic:role': 'hover' },
            zIndex: 9_999,
            updateWhileInteracting: true,
            style: (f) => {
                const s = f.get('nbic:hoverStyle') as DrawStyleOptions | undefined;

                const stroke = new Stroke({
                    color: s?.strokeColor ?? this.opts.outlineColor,
                    width: s?.strokeWidth ?? this.opts.outlineWidth,
                });
                const fill = new Fill({
                    color: s?.fillColor ?? this.opts.fillColor,
                });

                const g = f.getGeometry();
                const type = g?.getType();

                // Points (and cluster bubbles) need an image to render
                if (type === 'Point' || type === 'MultiPoint') {
                    const radius =
                        // let a per-layer hover style override radius if you add it to DrawStyleOptions later
                        s?.pointRadius ?? 8;
                    return new Style({
                        image: new CircleStyle({ radius, fill, stroke }),
                    });
                }

                // Lines/Polygons
                return new Style({ stroke, fill });
            },
        });
        this.map.addLayer(this.hoverLayer);
    }

    private clearHover() {
        this.lastHoverId = null;
        this.hoverSource?.clear(true);
        this.events.emit('hover:info', null);
    }

    private destroyLayer() {
        if (this.hoverLayer) this.map.removeLayer(this.hoverLayer);
        this.hoverLayer = null;
        this.hoverSource = null;
        this.lastHoverId = null;
    }

    // private bindPointerMove() {
    //     if (this.pointerMoveKey) return;

    //     this.pointerMoveKey = this.map.on('pointermove', (evt) => {
    //         const pixel = evt.pixel as Pixel;

    //         // Single canvas hit-test (avoid double readbacks)
    //         let top: FeatureLike | undefined;
    //         this.map.forEachFeatureAtPixel(
    //             pixel,
    //             (f) => {
    //                 top = f;
    //                 return f;
    //             },
    //             {
    //                 hitTolerance: this.opts.hitTolerance,
    //                 layerFilter: (layer) => layer.get('nbic:role') !== 'hover',  // 👈 skip overlay
    //             }
    //         );

    //         if (!top) {
    //             if (this.lastHoverId != null) this.clearHover();
    //             return;
    //         }

    //         const feat = top as Feature<Geometry>;
    //         const id = feat.getId();

    //         if (id === this.lastHoverId) {
    //             // same feature as last frame — do nothing
    //             return;
    //         }

    //         // update highlight overlay
    //         this.clearHover();
    //         const geom = feat.getGeometry();
    //         if (!geom || !this.hoverSource) return;

    //         const clone = geom.clone();
    //         const f = new Feature<Geometry>({ geometry: clone });
    //         if (id !== undefined) f.setId(id);
    //         this.hoverSource.addFeature(f);
    //         this.lastHoverId = f.getId() ?? id ?? null;

    //         // optional info for consumers
    //         this.events.emit(MapEvents.HoverInfo, {
    //             coordinate: evt.coordinate as MapCoord,
    //             items: [{ feature: feat, layer: this.hoverLayer as VectorLayer }], // layer resolution provided
    //         });
    //     });
    // }

    private bindPointerMove() {
        if (this.pointerMoveKey) return;

        this.pointerMoveKey = this.map.on('pointermove', (evt) => {
            const pixel = evt.pixel as Pixel;

            // pick the top feature + its originating layer
            type LayerWithGet = { get?: (key: string) => unknown };
            let picked: { feature: FeatureLike; layer: LayerWithGet } | null = null;

            this.map.forEachFeatureAtPixel(
                pixel,
                (f, l) => {
                    picked = { feature: f as FeatureLike, layer: l as LayerWithGet };
                    return f;
                },
                {
                    hitTolerance: this.opts.hitTolerance,
                    layerFilter: (layer) => (layer as LayerWithGet).get?.('nbic:role') !== 'hover', // don’t hit the overlay
                }
            );

            if (!picked) {
                if (this.lastHoverId != null) this.clearHover();
                return;
            }

            const { feature: top, layer } = picked;
            const id = (top as Feature<Geometry>).getId?.();

            // if same as last, do nothing
            if (id === this.lastHoverId) return;

            // resolve geometry (unwrap clusters if present and you prefer that behavior)
            const members = (top as Feature<Geometry>).get?.('features') as Feature<Geometry>[] | undefined;
            const layerObj: LayerWithGet = layer;
            const keepSingleAsCluster = !!layerObj.get?.('nbic:keepSingleAsCluster');
            let geom: Geometry | null = null;

            if (members && members.length) {
                if (members.length === 1 && !keepSingleAsCluster) {
                    geom =  members[0] ? members[0].getGeometry()?.clone() ?? null : null; // unwrap single
                } else {
                    geom = (top as Feature<Geometry>).getGeometry()?.clone() ?? null; // highlight cluster bubble
                }
            } else {
                geom = (top as Feature<Geometry>).getGeometry()?.clone() ?? null;
            }

            // update overlay
            this.clearHover();
            if (!geom || !this.hoverSource) return;

            const hf = new Feature<Geometry>({ geometry: geom });
            if (id !== undefined) hf.setId(id);

            // choose style: layer hover style if present, else controller defaults
            const layerHover = (layer as LayerWithGet).get?.('nbic:hoverStyle') as DrawStyleOptions | undefined;
            if (layerHover) hf.set('nbic:hoverStyle', layerHover);

            this.hoverSource.addFeature(hf);
            this.lastHoverId = hf.getId() ?? id ?? null;

            // emit with the ORIGINAL layer (not the hover overlay)
            this.events.emit(MapEvents.HoverInfo, {
                coordinate: evt.coordinate as MapCoord,
                items: [{ feature: top as Feature<Geometry>, layer }], // <- original layer
            });
        });
    }


    private unbindPointerMove() {
        if (this.pointerMoveKey) {
            unByKey(this.pointerMoveKey);
            this.pointerMoveKey = null;
        }
        this.clearHover();
    }
}