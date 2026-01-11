import type { LayerDef } from '../src/api/types';

/** Minimal helpers for the playground: creates a few demo layers as GeoJSON strings */
export function buildSamples(): {
  clusterPoints: LayerDef;
  polygon: LayerDef;
  accuracyCircles: LayerDef;
} {
  // A few demo points around Trondheim
  const points = [
    { id: 1, lon: 10.3951, lat: 63.4305, icon: 'allmenn-fuglelokalitet.svg', thumbnail: '' },
    { id: 2, lon: 10.4013, lat: 63.4332, icon: 'allmenn-fuglelokalitet.svg', thumbnail: '' },
    { id: 3, lon: 10.3868, lat: 63.4289, icon: 'allmenn-fuglelokalitet.svg', thumbnail: '' },
    { id: 4, lon: 10.4109, lat: 63.4361, icon: 'allmenn-fuglelokalitet.svg', thumbnail: '' },
    { id: 5, lon: 10.4157, lat: 63.4311, icon: 'allmenn-fuglelokalitet.svg', thumbnail: '' },
  ];

  const pointsFc = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      id: p.id,
      properties: {
        id: p.id,
        icon: p.icon,
        thumbnail: p.thumbnail,
        count: 1,
        // Default (per-feature) style: orange outline, transparent fill
        'nbic:style': {
          strokeColor: '#ff6600',
          fillColor: 'rgba(255,102,0,0.15)',
          strokeWidth: 2,
          circle: { radius: 6, fillColor: '#ff6600', strokeColor: '#ffffff', strokeWidth: 2 },
        },
        // Optional per-feature hover (takes precedence if HoverInfoController supports it)
        'nbic:hoverStyle': {
          strokeColor: 'yellow',
          fillColor: 'transparent',
          strokeWidth: 3,
          pointRadius: 12,
        },
      },
      geometry: {
        type: 'Point',
        coordinates: [p.lon, p.lat],
      },
    })),
  };

  const polygonFc = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'poly-1',
        properties: {
          name: 'Demo polygon',
          'nbic:style': {
            strokeColor: 'green',
            strokeWidth: 3,
            fillColor: 'rgba(0,255,0,0.10)',
          },
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [10.370, 63.427],
              [10.425, 63.427],
              [10.425, 63.442],
              [10.370, 63.442],
              [10.370, 63.427],
            ],
          ],
        },
      },
    ],
  };

  // Accuracy circle demo: point with a radius in meters read from `accuracy` property
  const accuracyFc = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'acc-1',
        properties: {
          accuracy: 250,
          'nbic:style': {
            // map-unit circle around point (requires the map-unit circle support in adapters/styles.ts)
            circle: {
              units: 'map',
              radiusProperty: 'accuracy',
              strokeColor: '#ef4444',
              strokeWidth: 2,
              fillColor: 'rgba(239,68,68,0.12)',
              gradient: {
                color: '#ef4444',
                // strong center -> transparent edge
                stops: [
                  [0, 0.85],
                  [0.6, 0.25],
                  [1, 0.0],
                ],
                outerScale: 1.4,
              },
            },
          },
        },
        geometry: {
          type: 'Point',
          coordinates: [10.3951, 63.4305],
        },
      },
    ],
  };

  const clusterPoints: LayerDef = {
    id: 'clusterPoints',
    name: 'Cluster points',
    kind: 'vector',
    visible: true,
    source: {
      type: 'geojson',
      options: {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
        text: JSON.stringify(pointsFc),
      },
    },
    hover: {
      // layer hover fallback (if no per-feature hover)
      style: { strokeColor: 'yellow', strokeWidth: 4, fillColor: 'transparent', pointRadius: 14 },
      clusterBehavior: 'unwrapSingle',
      hitTolerance: 8,
      cursor: 'pointer',
      // optional separate bubble hovers
      clusterStyle: { strokeColor: '#fde047', strokeWidth: 3, fillColor: 'rgba(250,204,21,0.18)', pointRadius: 18 },
      singleClusterStyle: { strokeColor: '#fde047', strokeWidth: 3, fillColor: 'rgba(250,204,21,0.12)', pointRadius: 16 },
    },
    cluster: {
      enabled: true,
      distance: 30,
      keepSingleAsCluster: false,
      countField: 'count',
      style: {
        type: 'simple',
        options: {
          circle: { radius: 14, fillColor: '#005B72', strokeColor: 'white', strokeWidth: 2 },
          text: { fillColor: 'white', font: 'bold 14px sans-serif' },
        },
      },
    },
  };

  const polygon: LayerDef = {
    id: 'polygon',
    name: 'Polygon',
    kind: 'vector',
    visible: true,
    source: {
      type: 'geojson',
      options: {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
        text: JSON.stringify(polygonFc),
      },
    },
    hover: {
      style: { strokeColor: '#22c55e', strokeWidth: 4, fillColor: 'rgba(34,197,94,0.10)' },
      hitTolerance: 6,
      cursor: 'pointer',
    },
  };

  const accuracyCircles: LayerDef = {
    id: 'accuracyCircles',
    name: 'Accuracy (map-unit circle)',
    kind: 'vector',
    visible: true,
    source: {
      type: 'geojson',
      options: {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
        text: JSON.stringify(accuracyFc),
      },
    },
  };

  return { clusterPoints, polygon, accuracyCircles };
}
