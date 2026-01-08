// src/api/types.ts
import type { Extent } from 'ol/extent';
export type MapCoord = [number, number];         // EPSG:3857 by default (configurable)
export type DrawKind = 'Point' | 'LineString' | 'Polygon' | 'Circle' | 'Text' | 'Box';

export interface ControlInit {
    fullscreen?: boolean;       // show FullScreen button
    scaleLine?: boolean;        // show ScaleLine
    geolocation?: boolean;      // prepare geolocation plumbing
    geolocationFollow?: boolean;// start in follow mode
    zoom?: boolean;
    attribution?: boolean;     // show attribution control
}

export type BufferUnits = 'meters' | 'kilometers' | 'miles' | 'feet';

export type InteractiveBuffer =
    | boolean
    | ({
        interactive?: boolean;     // true → pick distance on-map
        distance?: number;         // used if not interactive
        units?: BufferUnits;       // default 'meters'
        steps?: number;            // default 48
        style?: DrawStyleOptions;  // style for final buffer
        replaceOriginal?: boolean; // default false
        /** Line cap style for line buffers (turf): 'round' | 'flat' | 'square' */
        cap?: 'round' | 'flat' | 'square';
        /** Line join style for polygons (turf): 'round' | 'mitre' | 'bevel' */
        join?: 'round' | 'mitre' | 'bevel';
    });

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
    icon?: {
        src: string;
        scale?: number;
        size?: [number, number];
        anchor?: [number, number];
        anchorXUnits?: 'fraction' | 'pixels';
        anchorYUnits?: 'fraction' | 'pixels';
        rotation?: number;
        opacity?: number;
        color?: string; // optional tint
    };    
}

export interface DrawOptions {
    kind: DrawKind;
    style?: DrawStyleOptions;
    snap?: boolean;           // default: true
    buffer?: InteractiveBuffer;
}

export interface DrawExportOptions {
    pretty?: boolean;
}

export interface DrawImportOptions {
    clearExisting?: boolean;  // default: false
}

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
    format?: string;              // e.g. 'image/png', 'image/jpgpng'
    style?: string;               // default 'default'
    matrixSet?: string;           // e.g. 'EPSG:25833' (classic)
    /** When WMTS server uses non-EPSG matrix set ids (e.g. 'default028mm') */
    matrixSetId?: string;         // raw string for tilematrixset param

    projection?: string;          // e.g. 'EPSG:32633'
    tileSize?: number;            // default 256
    levels?: number;              // number of zoom levels
    wrapX?: boolean;
    opacity?: number;
    attribution?: string;
    extent?: Extent;          // full extent of the matrix set (map units)

    /** Provide a full custom WMTS tile grid (overrides auto-build) */
    // customTileGrid?: {
    //     extent: [number, number, number, number];
    //     origin?: [number, number];            // default top-left of extent
    //     matrixIds?: (string | number)[];
    //     resolutions?: number[];
    // };

    /** KVP URL param override hook (rarely needed) */
    urlParamOverrides?: Record<string, string>;
}

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

export interface ThumbnailMarkerOptions {
    /** property name on the feature holding image url */
    property?: string;                 // default: 'thumbnail'
    /** used when no thumbnail is present */
    fallbackMaterialIcon?: string;      // optional if you want a fallback text-icon marker later
    /** image size (source pixel size) */
    imageSize?: [number, number];       // default: [100, 100]
    /** icon scale for the image */
    imageScale?: number;                // default: 0.26
    /** square "frame" radius */
    frameRadius?: number;               // default: 22
    /** frame border width */
    frameBorderWidth?: number;          // default: 3
    /** frame border color */
    frameBorderColor?: string;          // default: 'rgba(255,255,255,1)'
    /** frame fill color */
    frameFillColor?: string;            // default: '#ffffff'
    /** frame displacement */
    frameDisplacement?: [number, number]; // default: [-1, 13]
    /** triangle radius */
    pinRadius?: number;                 // default: 10
    /** pin fill color */
    pinFillColor?: string;              // default: '#ffffff'
    /** triangle rotation */
    pinRotation?: number;               // default: Math.PI / 3
    /** crossOrigin for thumbnails */
    crossOrigin?: '' | 'anonymous' | 'use-credentials'; // default: 'anonymous'
}

// --- style option bags ---
export interface SimpleStyleOptions {
    thumbnailMarker?: ThumbnailMarkerOptions;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    circle?: {
        radius?: number;
        fillColor?: string;
        strokeColor?: string;
        strokeWidth?: number;
        units?: 'px' | 'map';             // NEW: default 'px'
        radiusProperty?: string;          // NEW: per-feature override (e.g. 'accuracy' in meters)
        segments?: number;                // NEW: polygon smoothness (default 64)
        gradient?: {
            color: string;                  // CSS (e.g. '#ff0000' or 'rgba(...)')
            outerScale?: number;            // default 1.4
            // array of [stop, alpha] (0..1)
            stops?: Array<[number, number]>;// default [[0,0],[0.6,0.2],[1,0.8]]
        };
    };
    text?: {
        label?: string;         // used for “Text” draw; default empty (you can set later)
        font?: string;          // e.g. '14px Inter'
        fillColor?: string;     // text fill
        strokeColor?: string;   // text halo
        strokeWidth?: number;
        offsetX?: number;
        offsetY?: number;
    };

    icon?: {
        /** e.g. '/assets/icons/marker.svg' */
        src: string;
        /** 1 = 100% */
        scale?: number;
        /** 0..1 if using fraction; or pixels if using 'pixels' units */
        anchor?: [number, number];
        anchorXUnits?: 'fraction' | 'pixels';
        anchorYUnits?: 'fraction' | 'pixels';
        /** [w, h] of the source image (optional, but helps layout) */
        size?: [number, number];
        rotation?: number;   // radians
        opacity?: number;    // 0..1
        /** Optional tint for SVGs (works for inline-colorable SVGs) */
        color?: string;
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

export interface GeoJSONDefOptions {
    url?: string;
    /** Inline GeoJSON string (Feature or FeatureCollection) */
    text?: string;
    /** CRS of the GeoJSON data if different from the map (no reprojection if omitted) */
    dataProjection?: string;
    // default featureProjection is map projection (EPSG:3857)
    featureProjection?: string;
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
// export type SourceRef = { ref: string };

export type SourceInput = SourceDef //| SourceRef;

export interface AdoptLayerOptions {
    base?: 'regional' | 'super';     // if you ever want to adopt a base
    zIndex?: number;                 // optional explicit zIndex
    pickable?: boolean;              // default true (respected by isPickableLayer)
    role?: 'overlay' | 'hover' | 'draw'; // default 'overlay'
}

export interface EnableEditingOptions {
    showVertices?: boolean;            // default true
    showVerticesPersistent?: boolean;
    vertexStyle?: DrawStyleOptions;    // optional custom style for the handles
}

// ---- layer def ----
export interface LayerDef {
    id: string;
    name?: string;
    kind: 'tile' | 'raster' | 'vector';
    source: SourceInput;
    style?: StyleDef;
    visible?: boolean;
    zIndex?: number;
    zIndexPinned?: boolean;
    base?: boolean | 'super' | 'regional';
    background?: string;
    minZoom?: number;
    maxZoom?: number;
    opacity?: number;
    pickable?: boolean;              // default true (respected by isPickableLayer)
    hover?: {
        cursor?: string;          // CSS cursor when hovering this layer
        hitTolerance?: number;

        // how hover resolves clustered features
        clusterBehavior?: 'bubble' | 'unwrapSingle';

        // hover style for normal (non-cluster) features OR for unwrapped members
        style?: DrawStyleOptions;

        // hover style specifically for the cluster bubble (size >= 2)
        clusterStyle?: DrawStyleOptions;

        // optional: hover style specifically for the single-member “bubble” case
        // (when keepSingleAsCluster=true and you hover that bubble)
        singleClusterStyle?: DrawStyleOptions;
    };    
    cluster?: {
        enabled: boolean;
        distance?: number;      // px distance between points
        minDistance?: number;   // minimum distance
        style?: StyleDef;       // cluster style (circle + text etc.)
        keepSingleAsCluster?: boolean; // default false
        countField?: string; // <-- default 'count'
        maxClusterPoints?: number; // optional max points per cluster for example 99 (will show '99+')
    };
}

export interface UpdateGeoJSONLayerOptions {
    mode?: 'replace' | 'merge';          // default: 'replace'
    dataProjection?: string;             // default: 'EPSG:4326'
    keepStyles?: boolean;                // keep existing nbic:style if same id
    idProperty?: string;
}

export interface HoverInfoOptions {
    /** Pixel tolerance for hit-testing. Default: 5 */
    hitTolerance?: number;
    /** Outline color. Default: '#ffcc00' */
    outlineColor?: string;
    /** Outline width in px. Default: 3 */
    outlineWidth?: number;
}

export interface InsertGeomOptions {
    /** CRS of the incoming coordinates. If omitted, assume map/view projection. */
    dataProjection?: string; // e.g. 'EPSG:4326' or 'EPSG:25833'
}