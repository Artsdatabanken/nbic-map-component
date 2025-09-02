import { z } from 'zod';

const SourceRefSchema = z.object({ ref: z.string().min(1) });
const InlineSourceSchema = z.object({
    type: z.enum(['wmts', 'wfs', 'osm', 'xyz'] as const),
    options: z.record(z.string(), z.unknown()).optional(),
});

export const MapConfigSchema = z.object({
    version: z.literal(1),
    id: z.string().min(1),
    projection: z.string().default('EPSG:3857'),
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number(),
    minZoom: z.number().optional(),
    maxZoom: z.number(),

    size: z.enum(['Large', 'Small'] as const).optional(),
    tabIndex: z.number().int().optional(),

    controls: z.object({
        zoom: z.boolean().optional(),
        scaleBar: z.boolean().optional(),
        attribution: z.boolean().optional(),
        rotate: z.boolean().optional(),
        fullscreen: z.boolean().optional(),
        mousePosition: z.boolean().optional(),
        draw: z.object({
            enabled: z.boolean(),
            polygonType: z.enum(['box', 'custom'] as const).optional(),
        }).optional(),
    }).default({}),

    wmts: z.array(z.object({
        id: z.string(),
        title: z.string().optional(),
        url: z.string().url(),
        layer: z.string(),
        matrixSet: z.string(),
        format: z.string().optional(),
        style: z.string().optional(),
        tileSize: z.number().optional(),
        origin: z.tuple([z.number(), z.number()]).optional(),
        resolutions: z.array(z.number()).optional(),
    })).optional(),

    wfs: z.array(z.object({
        id: z.string(),
        title: z.string().optional(),
        url: z.string().url(),
        typeName: z.string(),
        srsName: z.string().optional(),
        outputFormat: z.string().optional(),
        strategy: z.enum(['all', 'bbox'] as const).default('bbox').optional(),
        maxFeatures: z.number().int().optional(),
        styleId: z.string().optional(),
    })).optional(),

    layers: z.array(z.object({
        id: z.string(),
        kind: z.enum(['tile', 'vector', 'raster'] as const),
        source: z.union([SourceRefSchema, InlineSourceSchema]),   // ← key bit
        style: z.union([
            z.string(), // style ref id
            z.object({ type: z.string(), options: z.record(z.string(), z.unknown()).optional() })
        ]).optional(),
        visible: z.boolean().optional(),
        zIndex: z.number().optional(),
    })).optional(),
}).refine(v => v.minZoom === undefined || v.minZoom <= v.maxZoom, {
    path: ['minZoom'], message: 'minZoom must be ≤ maxZoom'
});

export type MapConfigDTO = z.infer<typeof MapConfigSchema>;