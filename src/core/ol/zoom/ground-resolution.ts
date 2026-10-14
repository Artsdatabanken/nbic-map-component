// src/core/ol/zoom/ground-resolution.ts
import type View from 'ol/View';
import { fromLonLat, getPointResolution } from 'ol/proj';
import { clamp } from 'ol/math';

/** Zoom at which the view shows `metersPerPixel` on the ground at `lonLat`, within the view's zoom limits. */
export function zoomForGroundResolution(
    view: View,
    lonLat: [number, number],
    metersPerPixel: number,
): number {
    const projection = view.getProjection();
    const groundMetersPerUnit = getPointResolution(projection, 1, fromLonLat(lonLat, projection), 'm');
    const zoom = view.getZoomForResolution(metersPerPixel / groundMetersPerUnit) ?? view.getMinZoom();
    return clamp(zoom, view.getMinZoom(), view.getMaxZoom());
}
