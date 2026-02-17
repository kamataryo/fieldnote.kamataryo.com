import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { Feature, Polygon } from '@types/map';
import { BasemapControl } from './BasemapControl';
import { getMapStyle } from '@services/mapUtils';
import { DEFAULT_BASEMAP, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, DRAW_STYLES } from '@constants/mapConfig';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';

// MapboxDrawの定数をMapLibre用に上書き
(MapboxDraw as any).constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
(MapboxDraw as any).constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
(MapboxDraw as any).constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

interface MapContainerProps {
  onPolygonCreated?: (polygon: Feature<Polygon>) => void;
  onPolygonUpdated?: (polygon: Feature<Polygon>) => void;
  onPolygonDeleted?: () => void;
}

export function MapContainer({ onPolygonCreated, onPolygonUpdated, onPolygonDeleted }: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // 初期ベースマップ取得（ローカルストレージまたはデフォルト）
    const savedBasemap = localStorage.getItem('preferredBasemap') as any;
    const initialBasemap = savedBasemap || DEFAULT_BASEMAP;

    // マップ初期化
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      style: getMapStyle(initialBasemap),
      hash: true,
      attributionControl: true,
    });

    mapRef.current = map;

    // Draw初期化
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

    // ベースマップ切り替えコントロール追加
    const basemapControl = new BasemapControl({
      initialBasemap: initialBasemap,
      onBasemapChange: (newBasemapId) => {
        // 現在の描画データを保存
        const currentDrawData = draw.getAll();
        const hasDrawData = currentDrawData.features.length > 0;

        // スタイル更新
        map.setStyle(getMapStyle(newBasemapId));

        // スタイル読込後にデータ復元
        map.once('style.load', () => {
          if (hasDrawData) {
            draw.set(currentDrawData);
          }
        });
      },
    });

    map.addControl(basemapControl as any, 'top-right');

    // ナビゲーションコントロール追加
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Drawイベントハンドリング
    map.on('draw.create', (e: any) => {
      const feature = e.features[0] as Feature<Polygon>;

      // 1つのポリゴンのみ保持（新しいポリゴン作成時に古いものを削除）
      const allFeatures = draw.getAll();
      if (allFeatures.features.length > 1) {
        // 最初のフィーチャー以外を削除
        allFeatures.features.slice(1).forEach((f) => {
          draw.delete(f.id as string);
        });
      }

      console.log('Polygon created:', feature);
      onPolygonCreated?.(feature);
    });

    map.on('draw.update', (e: any) => {
      const feature = e.features[0] as Feature<Polygon>;
      console.log('Polygon updated:', feature);
      onPolygonUpdated?.(feature);
    });

    map.on('draw.delete', () => {
      console.log('Polygon deleted');
      onPolygonDeleted?.();
    });

    // クリーンアップ
    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [onPolygonCreated, onPolygonUpdated, onPolygonDeleted]);

  return <div ref={mapContainerRef} className="map-container" />;
}
