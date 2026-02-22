import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapType } from '@t/map';
import { basemaps } from '@constants/mapConfig';

export function getMapStyle(basemapId: BasemapType): StyleSpecification {
  const basemap = basemaps[basemapId];

  return {
    version: 8,
    name: `Style with ${basemap.name}`,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: basemap.type,
        tiles: basemap.tiles,
        tileSize: basemap.tileSize,
        attribution: basemap.attribution,
        maxzoom: basemap.maxzoom,
      },
    },
    layers: [
      {
        id: 'basemap-layer',
        type: 'raster',
        source: 'basemap',
      },
    ],
  };
}
