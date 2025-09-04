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
import { Style, Stroke, Fill } from 'ol/style';

import type { Emitter } from '../../state/store';
import { MapEventMap, MapEvents } from '../../../api/events';
import type { MapCoord, HoverInfoOptions } from '../../../api/types';

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

    private ensureLayer() {
        if (this.hoverLayer) return;
        this.hoverSource = new VectorSource();
        this.hoverLayer = new VectorLayer({
            source: this.hoverSource,
            style: () =>
                new Style({
                    stroke: new Stroke({ color: this.opts.outlineColor, width: this.opts.outlineWidth }),
                    fill: new Fill({ color: this.opts.fillColor }),
                }),
            properties: { 'nbic:role': 'hover' },
            zIndex: 9_999,
            updateWhileInteracting: true,
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

    private bindPointerMove() {
        if (this.pointerMoveKey) return;

        this.pointerMoveKey = this.map.on('pointermove', (evt) => {
            const pixel = evt.pixel as Pixel;

            // Single canvas hit-test (avoid double readbacks)
            let top: FeatureLike | undefined;
            this.map.forEachFeatureAtPixel(
                pixel,
                (f) => {
                    top = f;
                    return f;
                },
                {
                    hitTolerance: this.opts.hitTolerance,
                    layerFilter: (layer) => layer.get('nbic:role') !== 'hover',  // 👈 skip overlay
                }
            );

            if (!top) {
                if (this.lastHoverId != null) this.clearHover();
                return;
            }

            const feat = top as Feature<Geometry>;
            const id = feat.getId();

            if (id === this.lastHoverId) {
                // same feature as last frame — do nothing
                return;
            }

            // update highlight overlay
            this.clearHover();
            const geom = feat.getGeometry();
            if (!geom || !this.hoverSource) return;

            const clone = geom.clone();
            const f = new Feature<Geometry>({ geometry: clone });
            if (id !== undefined) f.setId(id);
            this.hoverSource.addFeature(f);
            this.lastHoverId = f.getId() ?? id ?? null;

            // optional info for consumers
            this.events.emit(MapEvents.HoverInfo, {
                coordinate: evt.coordinate as MapCoord,
                items: [{ feature: feat, layer: this.hoverLayer as VectorLayer }], // layer resolution provided
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