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
  // 完成済みポリゴンが存在するかを追跡するフラグ
  // （draw.deleteAll() は silent=true でイベントを発火しないため、手動で管理する）
  const hasCompletedPolygonRef = useRef(false);

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

    // トラッシュボタンの乗っ取り
    // MapboxDraw 既定の trash 動作:
    //   - draw_polygon 中 → 描画中の未完成ポリゴンのみ消去して simple_select へ（完成済みは残る）
    //   - simple_select 中 → 選択中のフィーチャーのみ消去（未選択なら何もしない）
    // → キャプチャフェーズで stopImmediatePropagation() し、「完成済みを即時全削除して draw_polygon に戻る」に上書き
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

    // デフォルトでポリゴン描画モードを有効化
    map.once('load', () => {
      draw.changeMode('draw_polygon');
    });

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
      const newId = feature.id as string;

      // 新しく完成したポリゴン以外（以前の完成済みポリゴン）を削除する。
      // draw.getAll() は store 内の全フィーチャーを返す。
      // 削除は API 経由なので silent=true のため draw.delete イベントは発火しない。
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

    // draw.delete イベントは API 経由の削除では発火しない（silent=true）。
    // ただし、キーボードの Delete/Backspace キーで選択削除した場合など、
    // 内部処理が silent=false で走るケースに備えて残しておく。
    map.on('draw.delete', () => {
      hasCompletedPolygonRef.current = false;
      onPolygonDeleted?.();
    });

    // クリーンアップ
    // map.remove() は内部で Hash.remove() -> _removeHash() を呼び、URLハッシュを消してしまう。
    // React Strict Mode でエフェクトが2回実行される際に2回目の初期化でハッシュが失われる問題を防ぐため、
    // map.remove() の前後でハッシュを保存・復元する。
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
}
