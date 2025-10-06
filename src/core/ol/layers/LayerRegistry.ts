// src/core/ol/layers/LayerRegistry.ts
import type BaseLayer from 'ol/layer/Base';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import type { Geometry } from 'ol/geom';

export class LayerRegistry {
    private index = new Map<string, BaseLayer>();

    add(id: string, layer: BaseLayer) {
        this.index.set(id, layer);
    }
    remove(id: string) { this.index.delete(id); }
    get(id: string) { return this.index.get(id); }
    clear() { this.index.clear(); }

    getVectorSource(id: string): VectorSource | null {
        const lyr = this.index.get(id);
        if (!lyr || !(lyr instanceof VectorLayer)) return null;
        const src = lyr.getSource();
        return (src as VectorSource<import('ol').Feature<Geometry>>) ?? null;
    }

    /** Reorder overlays and bases. You’ll usually call this from BaseLayersController. */
    reorder(order: string[], bases: { isBase: (l: BaseLayer) => boolean; baseBand: number }): void {
        let overlayZ = 0;
        let baseZ = bases.baseBand;
        for (const id of order) {
            const l = this.index.get(id);
            if (!l) continue;
            if (bases.isBase(l)) l.setZIndex(baseZ++);
            else l.setZIndex(overlayZ++);
        }
    }
}