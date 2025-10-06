// src/core/ol/controls/ControlsController.ts
import Zoom from 'ol/control/Zoom';
import ScaleLine from 'ol/control/ScaleLine';
import Attribution from 'ol/control/Attribution';
import FullScreen from 'ol/control/FullScreen';
import type OlMap from 'ol/Map';
import type { Emitter } from '../../state/store';
import type { MapEventMap } from '../../../api/events';

type ControlsInit = {
    fullscreen?: boolean;
    scaleLine?: boolean;
    zoom?: boolean;
    attribution?: boolean;
    geolocation?: boolean; // ignored here; handled by GeoController
    geolocationFollow?: boolean;
};

export class ControlsController {
    private map?: OlMap;
    private zoom?: Zoom;
    private scale?: ScaleLine;
    private attr?: Attribution;
    private fs?: FullScreen;

    attach(map: OlMap, events?: Emitter<MapEventMap>, init?: ControlsInit) {
        this.map = map;
        if (init?.zoom) this.ensureZoom(map, events);
        if (init?.scaleLine) this.ensureScaleLine(map, events);
        if (init?.attribution) this.ensureAttribution(map, events);
        if (init?.fullscreen) this.ensureFullScreen(map);
    }
    detach() {
        if (!this.map) return;
        if (this.zoom) this.map.removeControl(this.zoom);
        if (this.scale) this.map.removeControl(this.scale);
        if (this.attr) this.map.removeControl(this.attr);
        if (this.fs) this.map.removeControl(this.fs);
        this.zoom = this.scale = this.attr = this.fs = undefined;
        this.map = undefined;
    }

    ensureZoom(map: OlMap, events?: Emitter<MapEventMap>) {
        if (this.zoom) return;
        this.zoom = new Zoom();
        map.addControl(this.zoom);
        events?.emit('controls:zoom', { visible: true });
    }
    removeZoom(map: OlMap, events?: Emitter<MapEventMap>) {
        if (!this.zoom) return;
        map.removeControl(this.zoom); this.zoom = undefined;
        events?.emit('controls:zoom', { visible: false });
    }

    ensureScaleLine(map: OlMap, events?: Emitter<MapEventMap>) {
        if (this.scale) return;
        this.scale = new ScaleLine();
        map.addControl(this.scale);
        events?.emit('controls:scaleline', { visible: true });
    }
    removeScaleLine(map: OlMap, events?: Emitter<MapEventMap>) {
        if (!this.scale) return;
        map.removeControl(this.scale); this.scale = undefined;
        events?.emit('controls:scaleline', { visible: false });
    }

    ensureAttribution(map: OlMap, events?: Emitter<MapEventMap>) {
        if (this.attr) return;
        this.attr = new Attribution({ collapsible: true, collapsed: false });
        map.addControl(this.attr);
        events?.emit('controls:attribution', { visible: true });
    }
    removeAttribution(map: OlMap, events?: Emitter<MapEventMap>) {
        if (!this.attr) return;
        map.removeControl(this.attr); this.attr = undefined;
        events?.emit('controls:attribution', { visible: false });
    }

    ensureFullScreen(map: OlMap) { if (this.fs) return; this.fs = new FullScreen(); map.addControl(this.fs); }
    removeFullScreen(map: OlMap) { if (!this.fs) return; map.removeControl(this.fs); this.fs = undefined; }
}