// src/core/ol/utils/coords.ts
import { transform, transformExtent } from 'ol/proj';
import type OlMap from 'ol/Map';
import { Extent, getCenter } from 'ol/extent';
import { MapCoord } from '../../../api/types';

/** 
 * Transforms a coordinate from a given projection into the map's view projection.
 * If `from` is not specified or already matches the view projection, it returns the same coord.
 */
export function toViewCoord(
    map: OlMap,
    coord: [number, number],
    from?: string
): [number, number] {
    const viewProj = String(map.getView().getProjection().getCode());
    if (!from || from === viewProj) return coord;
    return transform(coord, from, viewProj) as [number, number];
}

/**
 * Transforms a coordinate from map view projection to another projection (default: WGS84).
 */
export function toDataCoord(
    map: OlMap,
    coord: [number, number],
    to = 'EPSG:4326'
): [number, number] {
    const viewProj = String(map.getView().getProjection().getCode());
    if (to === viewProj) return coord;
    return transform(coord, viewProj, to) as [number, number];
}

export function transformCoordsArrayFrom(coords: number[][], from: string, to: string): number[][] {
    return coords.map((c) => transform(c, from, to));
}

export function transformCoordsFrom(coords: [number, number], from: string, to: string): [number, number] {
    return transform(coords, from, to) as [number, number];
}

export function transformExtentFrom(extent: Extent, from: string, to: string): number[] | null {                
    return transformExtent(extent, from, to);    
}
    
export function getCenterFromExtent(extent: number[]): MapCoord {    
    return getCenter(extent) as MapCoord;            
}