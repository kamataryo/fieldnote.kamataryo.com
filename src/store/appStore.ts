import { create } from 'zustand';
import type { Feature, Polygon } from '@types/map';
import type { Species, SpeciesFilters, SortBy } from '@types/species';
import { INaturalistAPI } from '@services/api/iNaturalistAPI';
import { WikipediaAPI } from '@services/api/wikipediaAPI';

interface AppState {
  // 地図状態
  currentPolygon: Feature<Polygon> | null;

  // 生物データ
  species: Species[];
  isLoading: boolean;
  error: string | null;
  progress: {
    current: number;
    total: number;
    message: string;
  } | null;

  // フィルタ・ソート
  filters: SpeciesFilters;
  sortBy: SortBy;

  // アクション
  setPolygon: (polygon: Feature<Polygon>) => void;
  fetchSpecies: (polygon: Feature<Polygon>) => Promise<void>;
  updateFilters: (filters: Partial<SpeciesFilters>) => void;
  setSortBy: (sortBy: SortBy) => void;
  clearSpecies: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初期状態
  currentPolygon: null,
  species: [],
  isLoading: false,
  error: null,
  progress: null,
  filters: {
    hasPhoto: false,
    searchTerm: '',
  },
  sortBy: 'observationCount',

  // ポリゴン設定
  setPolygon: (polygon) => {
    set({ currentPolygon: polygon });
  },

  // 生物データ取得
  fetchSpecies: async (polygon) => {
    set({ isLoading: true, error: null, progress: { current: 0, total: 0, message: '観察データを取得中...' } });

    try {
      // 1. iNaturalist APIから観察データ取得
      const iNaturalistAPI = new INaturalistAPI();
      let species = await iNaturalistAPI.getObservationsInPolygon(polygon);

      console.log(`Fetched ${species.length} species from iNaturalist`);

      set({
        species,
        progress: { current: species.length, total: species.length, message: 'Wikipedia情報を取得中...' },
      });

      // 2. Wikipedia情報付加（並列処理、10並列まで）
      const wikipediaAPI = new WikipediaAPI();
      const chunkSize = 10;
      const enrichedSpecies: Species[] = [];

      for (let i = 0; i < species.length; i += chunkSize) {
        const chunk = species.slice(i, i + chunkSize);
        const enrichedChunk = await Promise.allSettled(
          chunk.map((s) => wikipediaAPI.enrichSpeciesWithWikipedia(s))
        );

        enrichedChunk.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            enrichedSpecies.push(result.value);
          } else {
            // エラー時は元のデータを使用
            enrichedSpecies.push(chunk[index]);
          }
        });

        set({
          progress: {
            current: enrichedSpecies.length,
            total: species.length,
            message: `Wikipedia情報を取得中... (${enrichedSpecies.length}/${species.length})`,
          },
        });
      }

      console.log(`Wikipedia enrichment completed: ${enrichedSpecies.length} species`);

      set({
        species: enrichedSpecies,
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
      });
    }
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
      currentPolygon: null,
      error: null,
      progress: null,
    });
  },
}));
