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
import { getUid } from 'ol/util';
import type BaseLayer from 'ol/layer/Base';

type ReqHoverOpts = Required<HoverInfoOptions> & { fillColor: string };

const DEFAULTS: ReqHoverOpts = {
    hitTolerance: 5,
    outlineColor: 'transparent',
    outlineWidth: 0,
    fillColor: 'transparent',
};

export class HoverInfoController {
    private map: OlMap;
    private events: Emitter<MapEventMap>;
    private opts: ReqHoverOpts = { ...DEFAULTS };

    private hoverLayer: VectorLayer | null = null;
    private hoverSource: VectorSource | null = null;
    private pointerMoveKey: EventsKey | null = null;    
    private lastHoverKey: string | number | null = null;
    private viewportLeaveHandler: ((e: Event) => void) | null = null;

    private defaultCursor = '';

    private setCursor(cursor: string | null) {
        const el = this.map.getTargetElement();
        if (!el) return;

        // remember original once
        if (!this.defaultCursor) this.defaultCursor = el.style.cursor || '';

        el.style.cursor = cursor ?? this.defaultCursor;
    }

    constructor(map: OlMap, events: Emitter<MapEventMap>) {
        this.map = map;
        this.events = events;
    }

    activate(options?: HoverInfoOptions) {
        if (options) this.opts = { ...this.opts, ...options };
        this.ensureLayer();
        this.bindPointerMove();
        this.bindViewportLeave();
    }

    deactivate() {
        this.unbindPointerMove();
        this.unbindViewportLeave();
        this.destroyLayer();
    }

    private bindViewportLeave() {        
        if (this.viewportLeaveHandler) return;

        const vp = this.map.getViewport();
        this.viewportLeaveHandler = () => {
            if (this.lastHoverKey != null) this.clearHover();
        };

        // pointerleave is nicest (doesn’t bubble)
        vp.addEventListener('pointerleave', this.viewportLeaveHandler);
        // optional extra safety (some browsers / devices)
        vp.addEventListener('mouseleave', this.viewportLeaveHandler);
    }

    private unbindViewportLeave() {        
        if (!this.viewportLeaveHandler) return;

        const vp = this.map.getViewport();
        vp.removeEventListener('pointerleave', this.viewportLeaveHandler);
        vp.removeEventListener('mouseleave', this.viewportLeaveHandler);

        this.viewportLeaveHandler = null;
    }

    setOptions(options: HoverInfoOptions) {
        this.opts = { ...this.opts, ...options };
    }

    destroy() {
        this.deactivate();
    }

    // ---- internals ----    

    private ensureLayer() {        
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
        this.lastHoverKey = null;
        this.hoverSource?.clear(true);
        this.events.emit('hover:info', null);
    }

    private destroyLayer() {
        if (this.hoverLayer) this.map.removeLayer(this.hoverLayer);
        this.hoverLayer = null;
        this.hoverSource = null;
        this.lastHoverKey = null;
    }

    private bindPointerMove() {
        if (this.pointerMoveKey) return;

        this.pointerMoveKey = this.map.on('pointermove', (evt) => {
            const pixel = evt.pixel as Pixel;

            let picked: { feature: FeatureLike; layer: BaseLayer } | null = null;

            this.map.forEachFeatureAtPixel(
                pixel,
                (f, l) => {
                    if (!l) return undefined;
                    picked = { feature: f as FeatureLike, layer: l as BaseLayer };
                    return f;
                },
                {
                    hitTolerance: this.opts.hitTolerance,
                    layerFilter: (l) => (l as BaseLayer).get('nbic:role') !== 'hover',
                }
            );

            // ✅ clear immediately when nothing is hovered
            if (!picked) {
                if ((this.hoverSource?.getFeatures().length ?? 0) > 0) this.clearHover();
                this.setCursor('default');
                return;
            }

            const { feature: top, layer } = picked;
            const topF = top as Feature<Geometry>;

            const id = topF.getId?.();
            const key: string | number =
                typeof id === 'string' || typeof id === 'number' ? id : getUid(topF);

            if (key === this.lastHoverKey) return;

            // ----- layer config -----
            const keepSingleAsCluster = !!(layer as BaseLayer).get('nbic:keepSingleAsCluster');
            const hoverBehavior = (layer as BaseLayer).get('nbic:hoverClusterBehavior') as
                | 'bubble'
                | 'unwrapSingle'
                | undefined;

            const baseHover = (layer as BaseLayer).get('nbic:hoverStyle') as DrawStyleOptions | undefined;
            const clusterHover = (layer as BaseLayer).get('nbic:hoverClusterStyle') as DrawStyleOptions | undefined;
            const singleClusterHover = (layer as BaseLayer).get('nbic:hoverSingleClusterStyle') as DrawStyleOptions | undefined;
            const cursor = (layer as BaseLayer).get('nbic:hoverCursor') as string | undefined;
            this.setCursor(cursor ?? null);

            // ----- resolve cluster members -----
            const members = topF.get('features') as Feature<Geometry>[] | undefined;

            // ----- resolve geometry + WHICH feature should provide hover style -----
            let geom: Geometry | null = null;
            let hoverStyleToApply: DrawStyleOptions | undefined = baseHover;

            // Per-feature hover style candidates
            const topHover = topF.get('nbic:hoverStyle') as DrawStyleOptions | undefined;

            const isCluster = !!members?.length;

            if (isCluster) {
                if (members.length >= 2) {
                    // Hovering a bubble cluster
                    geom = topF.getGeometry()?.clone() ?? null;
                    hoverStyleToApply = clusterHover ?? baseHover;
                } else {
                    // Single-member cluster
                    const preferBubble = keepSingleAsCluster || hoverBehavior === 'bubble';
                    const inner = members[0];
                    const innerHover = inner?.get('nbic:hoverStyle') as DrawStyleOptions | undefined;

                    if (preferBubble) {
                        // show bubble hover
                        geom = topF.getGeometry()?.clone() ?? null;
                        hoverStyleToApply = singleClusterHover ?? clusterHover ?? baseHover;
                    } else {
                        // unwrap: highlight the inner feature geometry + prefer per-feature hover style
                        geom = inner?.getGeometry()?.clone() ?? null;
                        hoverStyleToApply = innerHover ?? baseHover;
                    }
                }
            } else {
                // Non-clustered feature: highlight itself + prefer per-feature hover style
                geom = topF.getGeometry()?.clone() ?? null;
                hoverStyleToApply = topHover ?? baseHover;
            }

            this.clearHover();
            if (!geom || !this.hoverSource) return;

            const hf = new Feature<Geometry>({ geometry: geom });
            if (hoverStyleToApply) hf.set('nbic:hoverStyle', hoverStyleToApply);

            this.hoverSource.addFeature(hf);
            this.lastHoverKey = key;

            this.events.emit(MapEvents.HoverInfo, {
                coordinate: evt.coordinate as MapCoord,
                items: [{ feature: topF, layer }],
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