// src/core/ol/select/SelectController.ts
import type OlMap from 'ol/Map';
import type { Feature as OlFeature } from 'ol';
import type { Geometry } from 'ol/geom';
import type { StyleLike } from 'ol/style/Style';
import Cluster from 'ol/source/Cluster';

import type { Emitter } from '../../state/store';
import type { MapEventMap } from '../../../api/events';
import type { DrawStyleOptions } from '../../../api/types';
import { makeDrawStyle } from '../adapters/draw-style';
import type { LayerRegistry } from '../layers/LayerRegistry';

export type Selection = { layerId: string; featureId: string | number; coordinates?: [number, number] };

export class SelectController {
    private map?: OlMap;

    private selected: Selection | null = null;
    private selectedPrevStyle: StyleLike | undefined = undefined;
    private selectedPrevNbicStyle: unknown = undefined;

    constructor(private events: Emitter<MapEventMap>) { }

    attach(map: OlMap) {
        this.map = map;
    }

    detach() {
        this.clear();
        this.map = undefined;
    }

    getSelection(): Selection | null {
        return this.selected;
    }

    clear(registry?: LayerRegistry) {
        if (!this.selected) return;

        // If registry not provided, we can’t restore the feature style safely.        
        if (registry) {
            const prev = this.findFeatureById(registry, this.selected.layerId, this.selected.featureId, this.selected.coordinates);
            if (prev) this.restoreFeature(prev);
        }

        this.selected = null;
        this.selectedPrevStyle = undefined;
        this.selectedPrevNbicStyle = undefined;
        this.events.emit('select:changed', null);
    }

    /** Select feature by its id (restores previous selection automatically). */
    selectById(
        registry: LayerRegistry,
        layerId: string,
        featureId: string | number,
        style?: DrawStyleOptions,
        coordinates?: [number, number]
    ): boolean {
        if (!this.map) return false;

        // restore previous selection
        if (this.selected) {
            const prev = this.findFeatureById(registry, this.selected.layerId, this.selected.featureId, this.selected.coordinates);
            if (prev) this.restoreFeature(prev);
            this.selected = null;
            this.selectedPrevStyle = undefined;
            this.selectedPrevNbicStyle = undefined;
        }

        const f = this.findFeatureById(registry, layerId, featureId, coordinates);
        if (!f) return false;

        this.selected = { layerId, featureId, coordinates };
        this.selectedPrevStyle = f.getStyle();
        this.selectedPrevNbicStyle = f.get('nbic:style');

        // apply new style
        if (style) {
            f.set('nbic:style', style);
            f.setStyle(makeDrawStyle(style));
        } else {
            // default selection highlight
            f.setStyle(
                makeDrawStyle({
                    strokeColor: '#00c853',
                    strokeWidth: 3,
                    fillColor: 'rgba(0,200,83,0.15)',
                })
            );
        }

        this.events.emit('select:changed', { layerId, featureId });
        return true;
    }

    private restoreFeature(feature: OlFeature<Geometry>) {
        // restore nbic:style marker (so layer style function behaves)
        if (this.selectedPrevNbicStyle === undefined) {
            feature.unset('nbic:style', true); // remove property entirely
        } else {
            feature.set('nbic:style', this.selectedPrevNbicStyle);
        }

        // restore explicit OL style override (null => use layer style)
        feature.setStyle(this.selectedPrevStyle);
    }

    /**
     * If the clicked thing is a cluster output feature, unwrap single-member clusters
     * and return the inner feature id for selection.
     */
    resolveSelectableIdFromClusterFeature(
        feature: OlFeature<Geometry>
    ): string | number | null {
        const members = feature.get('features') as OlFeature<Geometry>[] | undefined;
        if (!members?.length) return null;

        if (members.length === 1) {
            const id = members[0]?.getId();
            return typeof id === 'string' || typeof id === 'number' ? id : null;
        }

        // multiple members -> usually you don’t “select”, you zoom in or open a list
        return null;
    }

    // ---- internals ----

    private findFeatureById(
        registry: LayerRegistry,
        layerId: string,
        featureId: string | number,
        coordinates?: [number, number]
    ): OlFeature<Geometry> | null {
        const src = registry.getVectorSource(layerId);
        if (!src) return null;

        // Cluster: ids live on the INNER vector source, not on clustered output features
        if (src instanceof Cluster) {
            const inner = src.getSource();
            const f = inner?.getFeatureById(featureId);
            return (f as OlFeature<Geometry> | null) ?? null;
        }
        let f = null;
        if (coordinates) {
            const features = src.getFeaturesAtCoordinate(coordinates);
            f = features ? features[0] : null;            
        } else {
            f = src.getFeatureById(featureId);
            if (!f) {
                f = src.getFeatureByUid(featureId.toString());
            }
        }
                 
        return (f as OlFeature<Geometry> | null) ?? null;
    }
}