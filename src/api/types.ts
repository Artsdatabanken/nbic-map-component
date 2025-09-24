// src/api/types.ts
import type { Extent } from 'ol/extent';
export type MapCoord = [number, number];         // EPSG:3857 by default (configurable)
export type DrawKind = 'Point' | 'LineString' | 'Polygon' | 'Circle' | 'Text';

export interface ControlInit {
    fullscreen?: boolean;       // show FullScreen button
    scaleLine?: boolean;        // show ScaleLine
    geolocation?: boolean;      // prepare geolocation plumbing
    geolocationFollow?: boolean;// start in follow mode
    zoom?: boolean;
    attribution?: boolean;     // show attribution control
}

export interface DrawStyleOptions {
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    pointRadius?: number;
    text?: {
        label?: string;         // used for “Text” draw; default empty (you can set later)
        font?: string;          // e.g. '14px Inter'
        fillColor?: string;     // text fill
        strokeColor?: string;   // text halo
        strokeWidth?: number;
        offsetX?: number;
        offsetY?: number;
    };
    // icon?: {
    //     materialIconName: string; // e.g. 'place', 'star', 'circle'
    //     size?: number;            // in px, default 24
    //     color?: string;          // CSS color, default black
    //     rotation?: number;       // degrees clockwise, default 0
    // }
}

export interface DrawOptions {
    kind: DrawKind;
    style?: DrawStyleOptions;
    snap?: boolean;           // default: true
}

export interface DrawExportOptions {
    pretty?: boolean;
}

export interface DrawImportOptions {
    clearExisting?: boolean;  // default: false
}
// export type Extent = [number, number, number, number];

export interface MapInit {
    target: string | HTMLElement;
    center?: MapCoord;
    zoom?: number;
    projection?: string;         // default 'EPSG:3857'
    enableDefaults?: boolean;    // default controls/interactions
    minZoom?: number;
    maxZoom?: number;
    controls?: ControlInit;
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
    matrixSet: string;              // e.g. "utm33n" or "EPSG:25833"
    format?: string;
    style?: string;
    tileSize?: number;              // default 256    
    projection?: string;            // e.g. "EPSG:25833"
    extent?: Extent;                // full extent of the matrix set (map units)
    origin?: [number, number];      // top-left of extent (map units)
    levels?: number;                // how many zoom levels to generate if no resolutions given
    resolutions?: number[];         // explicit resolutions (map units / pixel)
    matrixIds?: string[];           // optional explicit matrix ids
    wrapX?: boolean;
    opacity?: number;
    customExtent?: Extent;
    attribution?: string;
    tileGrid?: unknown;
}

// NEW: basic WFS option bag (implement later)
// export interface WFSDefOptions {
//     url: string;
//     typeName: string;
//     srsName?: string;
//     outputFormat?: string;  // usually 'application/json'
//     strategy?: 'all' | 'bbox';
//     maxFeatures?: number;
//     styleId?: string;
// }
// src/api/types.ts
export interface WFSDefOptions {
    url: string;                // e.g. https://wfs.nibio.no/cgi-bin/ar50_2
    typeName: string;           // WFS 1.1.0: typeName, WFS 2.0.0: typeNames (we’ll map)
    version?: '2.0.0' | '1.1.0';
    srsName?: string;           // desired output CRS from server (default = view projection)
    outputFormat?: string;      // 'application/json' preferred, else GML
    geometryName?: string;      // optional; if unknown, we can infer via DescribeFeatureType later
    maxFeatures?: number;       // per request (server may cap)
    headers?: Record<string, string>; // auth etc.
    params?: Record<string, string | number>; // extra vendor params
    strategy?: 'bbox' | 'all';  // default 'bbox'
    featureNS?: string;
    featureType?: string;
    minZoomToLoad?: number;     // optional min zoom to trigger loading
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

// export interface WMTSDefOptions {
//     url: string;
//     layer: string;
//     matrixSet: string;              // e.g. 'EPSG:3857'
//     format?: string;                // default 'image/png'
//     style?: string;                 // default 'default'
//     tileGrid?: unknown;             // use ol/tilegrid/WMTS in OL adapter
//     matrixIds?: string[];
//     resolutions?: number[];
//     origin?: [number, number];
//     tileSize?: number;              // default 256
// }

export interface GeoJSONDefOptions {
    url: string;
    // (optional) add more later: dataProjection?, strategy?, loader?, etc.
}

export type SourceDef =
    | { type: 'osm' }
    | { type: 'xyz'; options: XYZDefOptions }
    | { type: 'wmts'; options: WMTSDefOptions }
    | { type: 'wfs'; options: WFSDefOptions }
    | { type: 'geojson'; options: GeoJSONDefOptions }
    | { type: 'memory' };
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
    minZoom?: number;
    maxZoom?: number;
}

export interface HoverInfoOptions {
    /** Pixel tolerance for hit-testing. Default: 5 */
    hitTolerance?: number;
    /** Outline color. Default: '#ffcc00' */
    outlineColor?: string;
    /** Outline width in px. Default: 3 */
    outlineWidth?: number;
}