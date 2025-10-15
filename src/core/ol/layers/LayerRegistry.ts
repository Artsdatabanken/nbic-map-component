// src/core/ol/layers/LayerRegistry.ts
import type BaseLayer from 'ol/layer/Base';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import type { FeatureLike } from 'ol/Feature';

type VectorSourceType = VectorSource<FeatureLike>;

function hasGetSource(obj: unknown): obj is { getSource: () => unknown } {
    return !!obj && typeof (obj as { getSource?: unknown }).getSource === 'function';
}

function hasGetFeatures(obj: unknown): obj is { getFeatures: () => unknown[] } {
    return !!obj && typeof (obj as { getFeatures?: unknown }).getFeatures === 'function';
}

export class LayerRegistry {
    private index = new Map<string, BaseLayer | VectorLayer<VectorSource> | VectorLayer<Cluster>>();

    add(id: string, layer: BaseLayer | VectorLayer<VectorSource> | VectorLayer<Cluster>) {
        this.index.set(id, layer);
    }
    remove(id: string) { this.index.delete(id); }
    get(id: string) { return this.index.get(id); }
    clear() { this.index.clear(); }    

    getVectorSource(id: string): VectorSourceType | null {
        const layer = this.index.get(id);
        if (!layer || !hasGetSource(layer)) return null;

        const src0 = layer.getSource();
        if (!src0) return null;

        // Cluster has getSource(): VectorSource; plain VectorSource doesn't.
        const inner = hasGetSource(src0) ? src0.getSource() : src0;
        return hasGetFeatures(inner) ? (inner as VectorSourceType) : null;
    }

    listIds(): string[] { return Array.from(this.index.keys()); }
    
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