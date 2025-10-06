// src/core/ol/layers/BaseLayerController.ts
import type BaseLayer from 'ol/layer/Base';
import type { LayerDef } from '../../../api/types';
import type { Emitter } from '../../state/store';
import type { MapEventMap } from '../../../api/events';

type Role = 'super' | 'regional';

export class BaseLayersController {
    private baseIds = new Set<string>();
    private superBaseIds = new Set<string>();
    private regionalBaseIds = new Set<string>();
    private activeRegional: string | null = null;
    private activeSuper: string | null = null;
    private _findLayer: (id: string) => BaseLayer | null = () => null;
    /** zIndex bands (keep bases below overlays) */
    public readonly baseBand = -10000;
    public readonly superBaseBand = -20000;

    constructor(private events: Emitter<MapEventMap>) { }

    isBase(l: BaseLayer) { return l.get('nbic:role') === 'base'; }
    roleOf(l: BaseLayer): Role | undefined { return l.get('nbic:baseRole'); }

    registerBase(layer: BaseLayer, role: Role, def: LayerDef) {
        const id = layer.get('id') as string;
        layer.set('nbic:role', 'base');
        layer.set('nbic:baseRole', role);
        this.baseIds.add(id);
        if (role === 'super') this.superBaseIds.add(id);
        if (role === 'regional') this.regionalBaseIds.add(id);

        // default z-indexes (unless provided)
        if (def.zIndex === undefined) {
            if (role === 'super') layer.setZIndex(this.superBaseBand + this.superBaseIds.size);
            else layer.setZIndex(this.baseBand + this.regionalBaseIds.size);
        }

        // initial visibility
        if (role === 'super') {
            layer.setVisible(def.visible !== false);
            if (layer.getVisible()) this.activeSuper = id;
        } else {
            const wantsVisible = def.visible ?? layer.getVisible();
            if (wantsVisible) this.setActiveRegional(id);
            else this.ensureOneRegionalVisible();
        }

        this.emitChanged();
    }

    onRemoved(id: string) {
        this.baseIds.delete(id);
        this.superBaseIds.delete(id);
        this.regionalBaseIds.delete(id);
        if (this.activeRegional === id) this.activeRegional = null;
        if (this.activeSuper === id) this.activeSuper = null;
        this.emitChanged();
    }

    setActiveRegional(id: string) {
        if (!this.regionalBaseIds.has(id)) return;        
        for (const rid of this.regionalBaseIds) {
            const lyr = this.findLayer(rid);
            if (!lyr) continue;                        
            lyr.setVisible(rid === id);
        }
        this.activeRegional = id;
        this.emitChanged();
    }

    setVisibility(layer: BaseLayer, visible: boolean) {
        const id = layer.get('id') as string;
        const role = this.roleOf(layer);
        if (role === 'super') {
            layer.setVisible(visible);
            if (visible) this.activeSuper = id;
            this.emitChanged();
            return;
        }
        // regional = exclusive when turning on
        if (visible) this.setActiveRegional(id);
        else {
            layer.setVisible(false);
            this.ensureOneRegionalVisible();
            this.emitChanged();
        }
    }

    /** Bridge: allow LayerRegistry.reorder to query base-ness. */
    isBaseLayer = (l: BaseLayer) => this.isBase(l);

    private ensureOneRegionalVisible() {
        let first: string | null = null;
        for (const id of this.regionalBaseIds) {
            const l = this.findLayer(id);
            if (!l) continue;
            if (l.getVisible() && !first) first = id;
            else l.setVisible(id === first);
        }
        this.activeRegional = first;
    }    

    /** Engine should call this after creation to connect real lookup (e.g. LayerRegistry). */
    bindFind(fn: (id: string) => BaseLayer | null) {
        this._findLayer = fn;
    }

    private findLayer(id: string): BaseLayer | null {
        return this._findLayer(id);
    }    

    clear() {
        this.baseIds.clear();
        this.superBaseIds.clear();
        this.regionalBaseIds.clear();
        this.activeRegional = null;
        this.activeSuper = null;
        // optional: drop the finder to avoid dangling refs after destroy
        this._findLayer = () => null;

        this.emitChanged(); // let listeners know there is no active base anymore
    }

    private emitChanged() {
        this.events.emit('base:changed', { regional: this.activeRegional, super: this.activeSuper });
    }
}