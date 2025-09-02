// src/api/config.ts
export type Size = 'Large' | 'Small';

export type PolygonTool = 'box' | 'custom';

export interface MapControlsConfig {
    zoom: boolean;
    scaleBar: boolean;
    attribution: boolean;
    rotate?: boolean;
    fullscreen?: boolean;
    mousePosition?: boolean;
    draw?: {
        enabled: boolean;
        polygonType?: PolygonTool;
    };
}

export interface WMTSOptions {
    id: string;
    title?: string;
    url: string;
    layer: string;
    matrixSet: string;          // e.g. 'EPSG:3857'
    format?: string;            // e.g. 'image/png'
    style?: string;             // e.g. 'default'
    tileSize?: number;          // 256, 512
    origin?: [number, number];  // optional, else auto
    resolutions?: number[];     // optional, else auto
}

export interface WFSOptions {
    id: string;
    title?: string;
    url: string;
    typeName: string;           // e.g. 'my:layer'
    srsName?: string;           // default inherits projection
    outputFormat?: string;      // e.g. 'application/json'
    strategy?: 'all' | 'bbox';  // default 'bbox'
    maxFeatures?: number;
    styleId?: string;           // hook into StyleRegistry/style defs
}

export interface MapConfig {
    // housekeeping
    version: 1;
    id: string;

    // map view
    projection?: string;         // default 'EPSG:3857'
    center: [number, number];    // in 'projection' coords
    zoom: number;
    minZoom?: number;
    maxZoom: number;

    // UI
    size?: Size;                 // visual hints to host (optional)
    tabIndex?: number;
    controls: Partial<MapControlsConfig>;

    // data sources
    wmts?: WMTSOptions[];
    wfs?: WFSOptions[];

    // optional initial layers (if you want to add them declaratively)
    layers?: Array<{
        id: string;
        kind: 'tile' | 'vector' | 'raster';
        source: { type: 'wmts' | 'wfs' | 'osm' | 'xyz'; ref?: string; options?: Record<string, unknown> };
        style?: { type: string; options?: Record<string, unknown> } | string;
        visible?: boolean;
        zIndex?: number;
    }>;
}