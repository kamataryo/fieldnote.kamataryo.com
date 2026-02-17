import type { Feature, Polygon } from 'geojson';
import type { Map as MaplibreMap, IControl } from 'maplibre-gl';

export type BasemapType = 'gsi-standard' | 'gsi-photo';

export interface BasemapConfig {
  id: BasemapType;
  name: string;
  type: 'raster';
  tiles: string[];
  tileSize: number;
  attribution: string;
  maxzoom: number;
}

export interface MapStyle {
  version: 8;
  name: string;
  glyphs: string;
  sources: {
    basemap: {
      type: 'raster';
      tiles: string[];
      tileSize: number;
      attribution: string;
      maxzoom: number;
    };
  };
  layers: Array<{
    id: string;
    type: string;
    source: string;
    paint?: Record<string, unknown>;
  }>;
}

export interface BasemapControlOptions {
  initialBasemap?: BasemapType;
  onBasemapChange?: (basemapId: BasemapType) => void;
}

export interface DrawEvent {
  type: string;
  features: Feature[];
}

export type { Feature, Polygon, MaplibreMap, IControl };
