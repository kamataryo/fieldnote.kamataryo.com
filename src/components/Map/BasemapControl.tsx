import type { IControl, Map as MaplibreMap } from 'maplibre-gl';
import type { BasemapType, BasemapControlOptions } from '@t/map';
import { basemaps, DEFAULT_BASEMAP } from '@constants/mapConfig';

export class BasemapControl implements IControl {
  private _container?: HTMLDivElement;
  private _currentBasemap: BasemapType;
  private _onBasemapChange: (basemapId: BasemapType) => void;

  constructor(options: BasemapControlOptions = {}) {
    this._currentBasemap = options.initialBasemap || DEFAULT_BASEMAP;
    this._onBasemapChange = options.onBasemapChange || (() => {});
  }

  onAdd(_map: MaplibreMap): HTMLElement {
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const select = document.createElement('select');
    select.className = 'basemap-select';
    select.title = 'ベースマップを選択';
    select.style.cssText = `
      padding: 8px;
      border: none;
      background: white;
      cursor: pointer;
      font-size: 14px;
      min-width: 160px;
    `;

    Object.values(basemaps).forEach((basemap) => {
      const option = document.createElement('option');
      option.value = basemap.id;
      option.textContent = basemap.name;
      option.selected = basemap.id === this._currentBasemap;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const newBasemapId = target.value as BasemapType;
      this._currentBasemap = newBasemapId;
      this._onBasemapChange(newBasemapId);
      localStorage.setItem('preferredBasemap', newBasemapId);
    });

    this._container.appendChild(select);
    return this._container;
  }

  onRemove(): void {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
  }
}
