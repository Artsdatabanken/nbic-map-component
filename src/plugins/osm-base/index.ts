import { SourceRegistry } from '../../core/registry/SourceRegistry';
export function registerOsm() {
    // Store a definition; the OL adapter will turn this into new OSM()
    SourceRegistry.register('osm', () => ({ type: 'osm' }));
}