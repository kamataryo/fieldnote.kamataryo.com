import { create } from 'zustand';
import type { Feature, Polygon } from '@types/map';
import type { Species } from '@types/species';
import { INaturalistAPI } from '@services/api/iNaturalistAPI';

interface AppState {
  // 地図状態
  currentPolygon: Feature<Polygon> | null;

  // 生物データ
  species: Species[];
  allSpecies: Species[]; // iNaturalistから取得した全種（選択前）
  isLoading: boolean;
  error: string | null;
  progress: {
    current: number;
    total: number;
    message: string;
  } | null;

  // モーダル状態
  showTaxonModal: boolean;

  // 地図で選択された種
  selectedSpeciesId: number | null;

  // アクション
  setPolygon: (polygon: Feature<Polygon>) => void;
  fetchInitialSpecies: (polygon: Feature<Polygon>) => Promise<void>;
  enrichWithWikipedia: (selectedSpeciesIds: Set<number>) => void;
  clearSpecies: () => void;
  cancelSelection: () => void;
  setShowTaxonModal: (show: boolean) => void;
  setSelectedSpeciesId: (id: number | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初期状態
  currentPolygon: null,
  species: [],
  allSpecies: [],
  isLoading: false,
  error: null,
  progress: null,
  showTaxonModal: false,
  selectedSpeciesId: null,

  // ポリゴン設定
  setPolygon: (polygon) => {
    set({ currentPolygon: polygon });
  },

  // モーダル表示設定
  setShowTaxonModal: (show) => {
    set({ showTaxonModal: show });
  },

  // Step 1: iNaturalistから初期データ取得
  fetchInitialSpecies: async (polygon) => {
    set({
      isLoading: true,
      error: null,
      progress: { current: 0, total: 0, message: 'iNaturalistから観察データを取得中...' },
      showTaxonModal: true,
      allSpecies: [],
      species: [],
    });

    try {
      const iNaturalistAPI = new INaturalistAPI();
      const species = await iNaturalistAPI.getObservationsInPolygon(
        polygon,
        (current, total, message) => {
          set({ progress: { current, total, message } });
        }
      );

      console.log(`Fetched ${species.length} species from iNaturalist`);

      if (species.length === 0) {
        set({
          allSpecies: [],
          species: [],
          isLoading: false,
          progress: null,
          showTaxonModal: false,
          error: 'この範囲に観察記録がありませんでした',
        });
        return;
      }

      set({
        allSpecies: species,
        species: [],
        isLoading: false,
        progress: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      console.error('Error fetching species:', error);
      set({
        error: errorMessage,
        isLoading: false,
        progress: null,
        showTaxonModal: false,
      });
    }
  },

  // Step 2: 選択された種を即時確定
  enrichWithWikipedia: (selectedSpeciesIds) => {
    const { allSpecies } = get();
    const selectedSpecies = allSpecies.filter((s) => selectedSpeciesIds.has(s.id));
    set({
      species: selectedSpecies,
      showTaxonModal: false,
    });
  },

  // データクリア（currentPolygon も含めて完全リセット）
  clearSpecies: () => {
    set({
      species: [],
      allSpecies: [],
      currentPolygon: null,
      error: null,
      progress: null,
      showTaxonModal: false,
      selectedSpeciesId: null,
    });
  },

  // モーダルキャンセル時のリセット（currentPolygon は残す → やり直すボタンを維持）
  cancelSelection: () => {
    set({
      species: [],
      allSpecies: [],
      error: null,
      progress: null,
      showTaxonModal: false,
      selectedSpeciesId: null,
    });
  },

  setSelectedSpeciesId: (id) => set({ selectedSpeciesId: id }),
}));
