import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { Feature, Polygon } from '@types/map';
import type { Species } from '@types/species';
import { BasemapControl } from './BasemapControl';
import { getMapStyle } from '@services/mapUtils';
import { DEFAULT_BASEMAP, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, DRAW_STYLES } from '@constants/mapConfig';
import { useAppStore } from '@store/appStore';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';

// MapboxDrawの定数をMapLibre用に上書き
(MapboxDraw as any).constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
(MapboxDraw as any).constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
(MapboxDraw as any).constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

export interface MapContainerHandle {
  deletePolygon: () => void;
}

interface MapContainerProps {
  onPolygonCreated?: (polygon: Feature<Polygon>) => void;
  onPolygonUpdated?: (polygon: Feature<Polygon>) => void;
  onPolygonDeleted?: () => void;
}

function speciesToGeoJSON(species: Species[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: species
      .filter((s) => s.location)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: s.location! },
        properties: { taxonId: s.id },
      })),
  };
}

export const MapContainer = forwardRef<MapContainerHandle, MapContainerProps>(function MapContainer({ onPolygonCreated, onPolygonUpdated, onPolygonDeleted }, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const hasCompletedPolygonRef = useRef(false);

  useImperativeHandle(ref, () => ({
    deletePolygon: () => {
      const draw = drawRef.current;
      if (!draw) return;
      const hadCompleted = hasCompletedPolygonRef.current;
      draw.deleteAll();
      draw.changeMode('draw_polygon');
      hasCompletedPolygonRef.current = false;
      if (hadCompleted) {
        onPolygonDeleted?.();
      }
    },
  }), [onPolygonDeleted]);

  const { species, setSelectedSpeciesId } = useAppStore();
  const speciesRef = useRef(species);
  const setSelectedSpeciesIdRef = useRef(setSelectedSpeciesId);

  // ref を常に最新の値に保つ
  useEffect(() => { speciesRef.current = species; }, [species]);

  // species 変化時に GeoJSON ソースを更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('species') as maplibregl.GeoJSONSource | undefined;
    source?.setData(speciesToGeoJSON(species));
  }, [species]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const savedBasemap = localStorage.getItem('preferredBasemap') as any;
    const initialBasemap = savedBasemap || DEFAULT_BASEMAP;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      style: getMapStyle(initialBasemap),
      hash: true,
      attributionControl: true,
    });

    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      styles: DRAW_STYLES as any,
    });

    drawRef.current = draw;
    map.addControl(draw as any, 'top-left');

    // species サークルレイヤーのセットアップ（スタイル変更後も再呼び出しできる）
    const setupSpeciesLayer = () => {
      if (map.getSource('species')) return;
      map.addSource('species', {
        type: 'geojson',
        data: speciesToGeoJSON(speciesRef.current),
      });
      map.addLayer({
        id: 'species-circles',
        type: 'circle',
        source: 'species',
        paint: {
          'circle-radius': 8,
          'circle-color': '#3bb2d0',
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
      map.on('mouseenter', 'species-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'species-circles', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'species-circles', (e) => {
        const taxonId = e.features?.[0]?.properties?.taxonId;
        if (taxonId != null) {
          setSelectedSpeciesIdRef.current(Number(taxonId));
        }
      });
    };

    // トラッシュボタンの乗っ取り
    const trashButton = map.getContainer().querySelector('.mapbox-gl-draw_trash') as HTMLElement | null;
    trashButton?.addEventListener('click', (e) => {
      e.stopImmediatePropagation();

      const hadCompleted = hasCompletedPolygonRef.current;
      draw.deleteAll();
      draw.changeMode('draw_polygon');
      hasCompletedPolygonRef.current = false;

      if (hadCompleted) {
        onPolygonDeleted?.();
      }
    }, true);

    map.once('load', () => {
      setupSpeciesLayer();
      draw.changeMode('draw_polygon');
    });

    // ベースマップ切り替えコントロール
    const basemapControl = new BasemapControl({
      initialBasemap: initialBasemap,
      onBasemapChange: (newBasemapId) => {
        const currentDrawData = draw.getAll();
        const hasDrawData = currentDrawData.features.length > 0;

        map.setStyle(getMapStyle(newBasemapId));

        map.once('style.load', () => {
          if (hasDrawData) {
            draw.set(currentDrawData);
          }
          // スタイル変更でカスタムレイヤーが消えるため再追加
          setupSpeciesLayer();
        });
      },
    });

    map.addControl(basemapControl as any, 'top-right');
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('draw.create', (e: any) => {
      const feature = e.features[0] as Feature<Polygon>;
      const newId = feature.id as string;

      draw.getAll().features
        .filter((f) => f.id !== newId)
        .forEach((f) => draw.delete(f.id as string));

      hasCompletedPolygonRef.current = true;
      onPolygonCreated?.(feature);
    });

    map.on('draw.update', (e: any) => {
      const feature = e.features[0] as Feature<Polygon>;
      onPolygonUpdated?.(feature);
    });

    map.on('draw.delete', () => {
      hasCompletedPolygonRef.current = false;
      onPolygonDeleted?.();
    });

    return () => {
      const savedHash = window.location.hash;
      map.remove();
      if (savedHash) {
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search + savedHash,
        );
      }
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [onPolygonCreated, onPolygonUpdated, onPolygonDeleted]);

  return <div ref={mapContainerRef} className="map-container" />;
});
