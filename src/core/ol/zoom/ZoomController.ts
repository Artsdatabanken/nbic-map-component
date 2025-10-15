// src/core/ol/zoom/ZoomController.ts
import type Map from 'ol/Map';
import type BaseLayer from 'ol/layer/Base';
import type VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import type { Geometry } from 'ol/geom';
import type { Feature } from 'ol';
import type { Extent } from 'ol/extent';
import { getCenter } from 'ol/extent';
import type { FeatureLike } from 'ol/Feature';

export type ZoomOpts = {
    paddingPx?: number;   // padding on each side in px
    minSizePx?: number;   // minimum on-screen width/height for tiny extents
    durationMs?: number;  // animation duration
    maxZoom?: number;     // optional cap
};

export interface LayerLookup {
    get(id: string): BaseLayer | undefined;                       // your LayerRegistry.get
    getVectorSource(id: string): VectorSource<FeatureLike> | null;
}

export class ZoomController {
    private map: Map | null = null;

    attach(map: Map) { this.map = map; }
    detach() { this.map = null; }

    private fitExtent(ext: Extent, opts?: ZoomOpts) {
        if (!this.map) return false;
        const view = this.map.getView();
        const size = this.map.getSize();
        if (!view || !size) return false;

        const paddingPx = opts?.paddingPx ?? 40;
        const durationMs = opts?.durationMs ?? 250;

        const fitOpts = {
            padding: [paddingPx, paddingPx, paddingPx, paddingPx],
            duration: durationMs,
            maxZoom: Infinity,
        };
        if (typeof opts?.maxZoom === 'number') fitOpts.maxZoom = opts.maxZoom;

        // Inflate degenerate extents to a minimum on-screen size
        const minSizePx = opts?.minSizePx ?? 64;
        const res = view.getResolution() ?? 1;
        const minMapUnits = res * minSizePx;

        const e: Extent = ext.slice() as Extent;
        if (e[0] === e[2] || e[1] === e[3]) {
            const [cx, cy] = getCenter(e);
            e[0] = cx ?? 0 - minMapUnits / 2;
            e[2] = cx ?? 0 + minMapUnits / 2;
            e[1] = cy ?? 0 - minMapUnits / 2;
            e[3] = cy ?? 0 + minMapUnits / 2;
        }

        view.fit(e, fitOpts);
        return true;
    }

    fitGeometry(geom: Geometry, opts?: ZoomOpts) {
        return this.fitExtent(geom.getExtent(), opts);
    }

    zoomToFeature(layer: VectorLayer<VectorSource<Feature<Geometry>>>, featureId: string, opts?: ZoomOpts) {
        const src = layer.getSource();
        if (!src) return false;
        const feat = src.getFeatureById(featureId) as Feature<Geometry> | null;
        const geom = feat?.getGeometry();
        return geom ? this.fitGeometry(geom, opts) : false;
    }

    zoomToLayer(layer: VectorLayer<VectorSource<Feature<Geometry>>>, opts?: ZoomOpts) {
        const src = layer.getSource();
        if (!src) return false;        
        if (!(src instanceof VectorSource)) return console.warn('zoomToLayer: not a vector source'), false;
        const feats = src.getFeatures() as Feature<Geometry>[];
        if (!feats.length) return false;

        // union extents
        let ext = feats[0]?.getGeometry()?.getExtent()?.slice() as Extent | undefined;
        for (let i = 1; i < feats.length; i++) {
            const g = feats[i]?.getGeometry();
            if (!g) continue;
            const e = g.getExtent();
            if (!ext) ext = e.slice() as Extent;
            else {
                ext[0] = Math.min(ext[0] ?? Infinity, e[0] ?? Infinity);
                ext[1] = Math.min(ext[1] ?? Infinity, e[1] ?? Infinity);
                ext[2] = Math.max(ext[2] ?? -Infinity, e[2] ?? -Infinity);
                ext[3] = Math.max(ext[3] ?? -Infinity, e[3] ?? -Infinity);
            }
        }
        return ext ? this.fitExtent(ext, opts) : false;
    }

    // Convenience by id (uses your registry/lookup)
    zoomToFeatureById(reg: LayerLookup, layerId: string, featureId: string, opts?: ZoomOpts) {
        const l = reg.get(layerId) as VectorLayer<VectorSource<Feature<Geometry>>> | undefined;
        if (!l) return false;
        return this.zoomToFeature(l, featureId, opts);
    }

    zoomToLayerById(reg: LayerLookup, layerId: string, opts?: ZoomOpts) {
        const l = reg.get(layerId) as VectorLayer<VectorSource<Feature<Geometry>>> | null;
        if (!l) return false;
        return this.zoomToLayer(l, opts);
    }

    zoomToExtent(ext: Extent, opts?: ZoomOpts) {
        return this.fitExtent(ext, opts);
    }
}