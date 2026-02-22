import type { Map as MaplibreMap, IControl } from 'maplibre-gl';

// GeoJSON types (inline to avoid @types/geojson dependency)
export type Polygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type Feature<G = { type: string; coordinates: unknown }> = {
  type: 'Feature';
  geometry: G;
  properties: Record<string, unknown> | null;
  id?: string | number;
};

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

export interface BasemapControlOptions {
  initialBasemap?: BasemapType;
  onBasemapChange?: (basemapId: BasemapType) => void;
}

export interface DrawEvent {
  type: string;
  features: Feature[];
}

export type { MaplibreMap, IControl };
