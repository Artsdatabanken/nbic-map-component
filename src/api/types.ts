// src/api/types.ts
export type MapCoord = [number, number];         // EPSG:3857 by default (configurable)
export type Extent = [number, number, number, number];

export interface MapInit {
    target: string | HTMLElement;
    center?: MapCoord;
    zoom?: number;
    projection?: string;         // default 'EPSG:3857'
    enableDefaults?: boolean;    // default controls/interactions
    minZoom?: number;
    maxZoom?: number;

}

export interface XYZDefOptions {
    url: string;
    minZoom?: number;
    maxZoom?: number;
    attributions?: string | string[];
    tileSize?: number;
}

export interface WMTSDefOptions {
    url: string;
    layer: string;
    matrixSet: string;
    format?: string;
    style?: string;
    tileGrid?: unknown;
    matrixIds?: string[];
    resolutions?: number[];
    origin?: [number, number];
    tileSize?: number;
}

// NEW: basic WFS option bag (implement later)
export interface WFSDefOptions {
    url: string;
    typeName: string;
    srsName?: string;
    outputFormat?: string;  // usually 'application/json'
    strategy?: 'all' | 'bbox';
    maxFeatures?: number;
    styleId?: string;
}

// export interface SourceDef {
//     type: string;                // e.g., 'osm', 'wmts', 'vector', 'geojson'
//     id?: string;
//     options?: Record<string, unknown>;
// }

// export interface StyleDef {
//     type: string;                // e.g., 'simple', 'category', 'ol-style'
//     options?: Record<string, unknown>;
// }

// --- style option bags ---
export interface SimpleStyleOptions {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    circle?: {
        radius?: number;
        fillColor?: string;
        strokeColor?: string;
        strokeWidth?: number;
    };
}


// “raw” lets callers pass an OL Style/StyleLike instance directly
export interface RawStyleOptions {
    instance: unknown;                  // will be checked/narrowed in adapter
}

export type StyleRef = { ref: string };

export type StyleDef =
    | { type: 'simple'; options?: SimpleStyleOptions }
    | { type: 'raw'; options: RawStyleOptions }
    | StyleRef;

export interface HitResult {
    layerId: string;
    featureId?: string | number;
    properties?: Record<string, unknown>;
    coordinate: MapCoord;
}

export interface CameraState {
    center: MapCoord;
    zoom: number;
}

export interface XYZDefOptions {
    url: string;
    minZoom?: number;
    maxZoom?: number;
    attributions?: string | string[];
    tileSize?: number;
}

export interface WMTSDefOptions {
    url: string;
    layer: string;
    matrixSet: string;              // e.g. 'EPSG:3857'
    format?: string;                // default 'image/png'
    style?: string;                 // default 'default'
    tileGrid?: unknown;             // use ol/tilegrid/WMTS in OL adapter
    matrixIds?: string[];
    resolutions?: number[];
    origin?: [number, number];
    tileSize?: number;              // default 256
}

export interface GeoJSONDefOptions {
    url: string;
    // (optional) add more later: dataProjection?, strategy?, loader?, etc.
}

export type SourceDef =
    | { type: 'osm' }
    | { type: 'xyz'; options: XYZDefOptions }
    | { type: 'wmts'; options: WMTSDefOptions }
    | { type: 'wfs'; options: WFSDefOptions }
    | { type: 'geojson'; options: GeoJSONDefOptions };
    // add more later:
    // | { type: 'wfs'; options: WFSDefOptions }
    // | { type: 'ref'; id: string }
    ;

// explicit “reference by id”
export type SourceRef = { ref: string };

export type SourceInput = SourceDef | SourceRef;

// ---- layer def ----
export interface LayerDef {
    id: string;
    kind: 'tile' | 'raster' | 'vector';
    source: SourceInput;
    style?: StyleDef;
    visible?: boolean;
    zIndex?: number;
    base?: boolean;
    background?: string;
}