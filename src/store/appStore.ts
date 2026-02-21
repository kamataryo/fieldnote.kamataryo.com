import { create } from 'zustand';
import type { Feature, Polygon } from '@types/map';
import type { Species, SpeciesFilters, SortBy } from '@types/species';
import { INaturalistAPI } from '@services/api/iNaturalistAPI';

interface AppState {
  // 地図状態
  currentPolygon: Feature<Polygon> | null;

  // 生物データ
  species: Species[];
  allSpecies: Species[]; // iNaturalistから取得した全種（フィルタリング前）
  isLoading: boolean;
  error: string | null;
  progress: {
    current: number;
    total: number;
    message: string;
  } | null;

  // モーダル状態
  showTaxonModal: boolean;

  // フィルタ・ソート
  filters: SpeciesFilters;
  sortBy: SortBy;

  // アクション
  setPolygon: (polygon: Feature<Polygon>) => void;
  fetchInitialSpecies: (polygon: Feature<Polygon>) => Promise<void>; // Step 1: iNaturalistのみ
  enrichWithWikipedia: (selectedSpeciesIds: Set<number>) => void; // Step 2: 選択種を即時確定
  updateFilters: (filters: Partial<SpeciesFilters>) => void;
  setSortBy: (sortBy: SortBy) => void;
  clearSpecies: () => void;
  setShowTaxonModal: (show: boolean) => void;
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
  filters: {
    hasPhoto: false,
    searchTerm: '',
  },
  sortBy: 'observationCount',

  // ポリゴン設定
  setPolygon: (polygon) => {
    set({ currentPolygon: polygon });
  },

  // モーダル表示設定
  setShowTaxonModal: (show) => {
    set({ showTaxonModal: show });
  },

  // Step 1: iNaturalistから初期データ取得（Wikipediaは取得しない）
  fetchInitialSpecies: async (polygon) => {
    set({
      isLoading: true,
      error: null,
      progress: { current: 0, total: 0, message: 'iNaturalistから観察データを取得中...' },
      showTaxonModal: true, // 最初からモーダルを表示
      allSpecies: [], // リセット
      species: [],
    });

    try {
      const iNaturalistAPI = new INaturalistAPI();
      const species = await iNaturalistAPI.getObservationsInPolygon(
        polygon,
        (current, total, message) => {
          // 進捗を更新
          set({
            progress: { current, total, message },
          });
        }
      );

      console.log(`Fetched ${species.length} species from iNaturalist`);

      // 観察記録が0件の場合
      if (species.length === 0) {
        set({
          allSpecies: [],
          species: [],
          isLoading: false,
          progress: null, // ローディングを終了
          error: 'この範囲に観察記録がありませんでした',
          // モーダルは開いたまま
        });
        return;
      }

      set({
        allSpecies: species,
        species: [],
        isLoading: false,
        progress: null,
        // showTaxonModal: true は既に設定済み
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      console.error('Error fetching species:', error);
      set({
        error: errorMessage,
        isLoading: false,
        progress: null,
        showTaxonModal: false, // エラー時はモーダルを閉じる
      });
    }
  },

  // Step 2: 選択された種を即時確定（Wikipedia取得なし）
  enrichWithWikipedia: (selectedSpeciesIds) => {
    const { allSpecies } = get();
    const selectedSpecies = allSpecies.filter((s) => selectedSpeciesIds.has(s.id));
    set({
      species: selectedSpecies,
      showTaxonModal: false,
    });
  },

  // フィルタ更新
  updateFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  // ソート順更新
  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  // データクリア
  clearSpecies: () => {
    set({
      species: [],
      allSpecies: [],
      currentPolygon: null,
      error: null,
      progress: null,
      showTaxonModal: false,
    });
  },
}));
