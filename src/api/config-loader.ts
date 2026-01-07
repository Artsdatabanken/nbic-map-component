import type { MapAPI } from './MapAPI';
import { MapConfigSchema } from './config.schema';
import { SourceRegistry } from '../core/registry/SourceRegistry';
import type {
    LayerDef,
    SourceInput,    
    WMTSDefOptions,
    XYZDefOptions,
    WFSDefOptions,
    StyleDef,
    GeoJSONDefOptions
} from './types';

export function initMapFromConfig(map: MapAPI, rawJson: unknown) {
    const cfg = MapConfigSchema.parse(rawJson);

    // Top-level registrations (defs, not OL instances)
    cfg.wmts?.forEach(w =>
        SourceRegistry.register(w.id, () => ({ type: 'wmts', options: w as WMTSDefOptions }))
    );
    cfg.wfs?.forEach(w =>
        SourceRegistry.register(w.id, () => ({ type: 'wfs', options: w as WFSDefOptions }))
    );    
    // cfg.controls?.zoom && map.addControl('zoom');

    // Add layers if provided
    cfg.layers?.forEach(layer => {
        // Build SourceInput (either {ref} or inline def)
        const source: SourceInput =
            'ref' in layer.source
                ? { ref: layer.source.ref }
                : (() => {
                    switch (layer.source.type) {
                        case 'osm':
                            return { type: 'osm' } as const;
                        case 'xyz':
                            return { type: 'xyz', options: (layer.source.options ?? {}) as unknown as XYZDefOptions } as const;
                        case 'wmts':
                            return { type: 'wmts', options: (layer.source.options ?? {}) as unknown as WMTSDefOptions } as const;
                        case 'wfs':
                            return { type: 'wfs', options: (layer.source.options ?? {}) as unknown as WFSDefOptions } as const;
                        case 'geojson': // <-- NEW
                            return { type: 'geojson', options: (layer.source.options ?? {}) as unknown as GeoJSONDefOptions } as const;
                        default: {
                            // exhaustive guard
                            const src = layer.source as unknown;
                            const type = typeof src === 'object' && src !== null && 'type' in src ? (src as { type: string }).type : 'undefined';
                            throw new Error(`Unknown source type: ${type}`);
                        }
                    }
                })();

        // Style: string means a style ref id
        const style: StyleDef | undefined =
            typeof layer.style === 'string'
                ? { ref: layer.style }
                : (layer.style as StyleDef | undefined);

        const ld: LayerDef = {
            id: layer.id,
            kind: layer.kind,
            source,
            style,
            visible: layer.visible ?? true,
            zIndex: layer.zIndex,
            base: layer.base ?? false,
        };

        map.addLayer(ld);
    });

    // Controls/min/max: either apply here or ensure you put min/max in MapInit and pass them to the engine.
}