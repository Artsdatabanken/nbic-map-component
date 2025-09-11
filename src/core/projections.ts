// src/core/projections.ts
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';

// Minimal defs (same idea as your Angular code)
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs +type=crs');
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs +type=crs');
proj4.defs('EPSG:25835', '+proj=utm +zone=35 +ellps=GRS80 +units=m +no_defs +type=crs');

register(proj4);

// your old extents:
const extent32: [number, number, number, number] = [-2000000, 3500000, 3545984, 9045984];
const extent33: [number, number, number, number] = [-2500000, 3500000, 3045984, 9045984];
const extent35: [number, number, number, number] = [-3500000, 3500000, 2045984, 9045984];
export const extentGeographic = [-180, -90, 180, 90];
export const extentGoogle = [
    -20037508.34, -20037508.34, 20037508.34, 20037508.34
];

const byEpsg: Record<string, [number, number, number, number]> = {
    'EPSG:25832': extent32,
    'EPSG:25833': extent33,
    'EPSG:25835': extent35,
    'EPSG:3857': [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
};

export function ensureProjectionExtent(epsg: string, custom?: [number, number, number, number]) {
    const p = getProjection(epsg);
    if (!p) return;
    if (custom) { p.setExtent(custom); return; }
    if (!p.getExtent() && byEpsg[epsg]) p.setExtent(byEpsg[epsg]);
}

export const mapBounds = [
    {
        epsg: 'EPSG:25832',
        extent: extent32
    },
    {
        epsg: 'EPSG:25833',
        extent: extent33
    },
    {
        epsg: 'EPSG:25835',
        extent: extent35
    },
    {
        epsg: 'EPSG:32632',
        extent: extent32
    },
    {
        epsg: 'EPSG:32633',
        extent: extent33
    },
    {
        epsg: 'EPSG:32635',
        extent: extent35
    },
    {
        epsg: 'EPSG:4326',
        extent: extentGeographic
    },
    {
        epsg: 'EPSG:3857',
        extent: extentGoogle
    },
    {
        epsg: 'EPSG:900913',
        extent: extentGoogle
    }
];