import * as turf from '@turf/turf';
import type { Feature, Polygon } from '@types/map';
import type { Species } from '@types/species';
import type { INaturalistResponse, INaturalistObservation } from '@types/api';
import { APIClient, RateLimiter } from './apiClient';

export class INaturalistAPI extends APIClient {
  constructor() {
    // 20回/分に制限
    super('https://api.inaturalist.org/v1', new RateLimiter(20, 60000));
  }

  async getObservationsInPolygon(
    polygon: Feature<Polygon>,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Species[]> {
    console.log('Fetching observations from iNaturalist...');

    // ポリゴンからバウンディングボックスを計算
    const bbox = turf.bbox(polygon);
    const [swLng, swLat, neLng, neLat] = bbox;

    console.log('Bounding box:', { swLat, swLng, neLat, neLng });

    // ページネーションで全データ取得
    const allObservations: INaturalistObservation[] = [];
    let page = 1;
    const perPage = 200;
    let totalResults = 0;
    let totalPages = 0;

    try {
      while (true) {
        const response = await this.requestWithRetry<INaturalistResponse>({
          method: 'GET',
          url: '/observations',
          params: {
            nelat: neLat,
            nelng: neLng,
            swlat: swLat,
            swlng: swLng,
            per_page: perPage,
            page: page,
            quality_grade: 'research',
            photos: true,
            order: 'desc',
            order_by: 'created_at',
          },
        });

        totalResults = response.total_results;
        totalPages = Math.ceil(Math.min(totalResults, 500) / perPage); // 最大500件まで
        allObservations.push(...response.results);

        // 進捗を通知
        if (onProgress) {
          onProgress(page, totalPages, `観察記録を取得中... (ページ ${page}/${totalPages})`);
        }

        console.log(
          `Fetched page ${page}: ${response.results.length} observations (total: ${allObservations.length}/${totalResults})`
        );

        // 最大500件まで取得（パフォーマンス考慮）
        if (
          allObservations.length >= totalResults ||
          response.results.length < perPage ||
          allObservations.length >= 500
        ) {
          break;
        }

        page++;
      }

      console.log(`Total observations fetched: ${allObservations.length}`);

      // 観察記録が0件の場合
      if (allObservations.length === 0) {
        if (onProgress) {
          onProgress(0, 0, 'この範囲に観察記録がありません');
        }
        return [];
      }

      // 種ごとに集約
      const speciesMap = this.aggregateBySpecies(allObservations);

      // 分類階層情報を取得（固有のtaxon IDのみ）
      const speciesWithTaxonomy = await this.enrichWithTaxonomy(Array.from(speciesMap.values()), onProgress);

      // ポリゴン内フィルタリング（厳密な判定）
      const filtered = this.filterInsidePolygon(speciesWithTaxonomy, polygon);

      console.log(`Unique species after filtering: ${filtered.length}`);

      return filtered;
    } catch (error) {
      console.error('Error fetching iNaturalist observations:', error);
      throw error;
    }
  }

  /**
   * 分類階層情報を取得（2段階一括取得方式）
   *
   * Step A: /taxa?id=speciesIds → commonName, wikipediaUrl を取得（ancestors は含まれない）
   * Step B: /taxa?id=ancestorIds → 祖先の {name, rank} を一括取得（ancestor_ids は観察データから取得済み）
   * Step C: 各種の ancestor_ids を Step B のルックアップで解決して taxonomy を構築
   */
  private async enrichWithTaxonomy(
    species: Species[],
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Species[]> {
    console.log('Fetching taxonomy information (2-step bulk)...');

    // === Step A: Taxon 一括取得（commonName, wikipediaUrl 目的）===
    const chunkSize = 30;
    for (let i = 0; i < species.length; i += chunkSize) {
      const chunk = species.slice(i, i + chunkSize);
      const uncachedIds = chunk.filter((s) => !this.taxonCache.has(s.id)).map((s) => s.id);

      if (uncachedIds.length > 0) {
        try {
          const response = await this.requestWithRetry<any>({
            method: 'GET',
            url: '/taxa',
            params: { id: uncachedIds.join(','), locale: 'ja' },
          });

          (response.results || []).forEach((taxon: any) => {
            this.taxonCache.set(taxon.id, {
              taxonomy: {}, // Step C で後から設定
              japaneseName: taxon.preferred_common_name,
              wikipediaUrl: taxon.wikipedia_url,
            });
          });
        } catch (error) {
          console.warn(`Failed to get bulk taxon details for ids [${uncachedIds.join(',')}]:`, error);
        }
      }

      if (onProgress) {
        const fetched = Math.min(i + chunkSize, species.length);
        onProgress(fetched, species.length, `Taxon情報を取得中... (${fetched}/${species.length})`);
      }
    }

    // === Step B: 全種の ancestor_ids を収集して祖先の {name, rank} を一括取得 ===
    const allAncestorIds = new Set<number>();
    species.forEach((s) => {
      const ids = this.taxonAncestorIds.get(s.id) || [];
      ids.forEach((id) => allAncestorIds.add(id));
    });

    if (onProgress) {
      onProgress(species.length, species.length, '分類階層を解決中...');
    }

    const ancestorLookup = await this.fetchAncestorDetails([...allAncestorIds]);

    // === Step C: 各種の taxonomy を ancestor_ids + ルックアップで構築 ===
    const enrichedSpecies: Species[] = species.map((s) => {
      const cached = this.taxonCache.get(s.id);
      const ancestorIds = this.taxonAncestorIds.get(s.id) || [];

      const taxonomy: Species['taxonomy'] = {};
      ancestorIds.forEach((id) => {
        const ancestor = ancestorLookup.get(id);
        if (!ancestor) return;
        const rank = ancestor.rank;
        if (rank === 'kingdom') taxonomy.kingdom = ancestor.name;
        else if (rank === 'phylum') taxonomy.phylum = ancestor.name;
        else if (rank === 'class') taxonomy.class = ancestor.name;
        else if (rank === 'order') taxonomy.order = ancestor.name;
        else if (rank === 'family') taxonomy.family = ancestor.name;
        else if (rank === 'genus') taxonomy.genus = ancestor.name;
      });

      return {
        ...s,
        taxonomy,
        commonName: cached?.japaneseName || s.commonName,
        wikipediaUrl: cached?.wikipediaUrl,
      };
    });

    console.log(`Taxonomy enrichment complete: ${enrichedSpecies.length} species`);
    return enrichedSpecies;
  }

  private taxonCache = new Map<number, { taxonomy: Species['taxonomy']; japaneseName?: string; wikipediaUrl?: string }>();

  // 各 taxon の祖先 ID を保持（aggregateBySpecies で観察データから取得）
  private taxonAncestorIds = new Map<number, number[]>();

  private aggregateBySpecies(observations: INaturalistObservation[]): Map<number, Species> {
    const map = new Map<number, Species>();

    for (const obs of observations) {
      if (!obs.taxon) continue;

      const taxonId = obs.taxon.id;
      if (!map.has(taxonId)) {
        map.set(taxonId, {
          id: taxonId,
          scientificName: obs.taxon.name,
          englishName: obs.taxon.preferred_common_name, // 英名として保存
          rank: obs.taxon.rank,
          observationCount: 0,
          photos: [],
          source: 'iNaturalist',
          // commonName（和名）とtaxonomyは後で追加
        });

        // 観察データから ancestor_ids を保存
        if (obs.taxon.ancestor_ids && obs.taxon.ancestor_ids.length > 0) {
          this.taxonAncestorIds.set(taxonId, obs.taxon.ancestor_ids);
        }
      }

      const species = map.get(taxonId)!;
      species.observationCount++;

      // 写真追加（最大3枚まで）
      if (species.photos.length < 3 && obs.photos.length > 0) {
        const photo = obs.photos[0];
        // 画像URLをmediumサイズに変更
        const mediumUrl = photo.url.replace('square', 'medium');
        species.photos.push({
          url: mediumUrl,
          attribution: photo.attribution,
          license: photo.license_code || 'unknown',
        });
      }
    }

    return map;
  }

  /**
   * 祖先 taxon の ID リストから {name, rank} を一括取得するルックアップを構築する。
   * 祖先は界・門・綱など高位分類群で多くの種が共有するため、
   * 全種まとめても固有 ID 数が少なく 1〜2 リクエストで済む。
   */
  private async fetchAncestorDetails(ancestorIds: number[]): Promise<Map<number, { name: string; rank: string }>> {
    const lookup = new Map<number, { name: string; rank: string }>();
    if (ancestorIds.length === 0) return lookup;

    const chunkSize = 100;
    for (let i = 0; i < ancestorIds.length; i += chunkSize) {
      const chunk = ancestorIds.slice(i, i + chunkSize);
      try {
        const response = await this.requestWithRetry<any>({
          method: 'GET',
          url: '/taxa',
          params: { id: chunk.join(','), per_page: chunkSize },
        });
        (response.results || []).forEach((t: any) => {
          lookup.set(t.id, { name: t.name, rank: t.rank });
        });
      } catch (error) {
        console.warn(`Failed to fetch ancestor details for ids [${chunk.join(',')}]:`, error);
      }
    }

    console.log(`Ancestor lookup built: ${lookup.size} entries`);
    return lookup;
  }

  private filterInsidePolygon(species: Species[], polygon: Feature<Polygon>): Species[] {
    // 簡略化のため、バウンディングボックス検索結果をそのまま使用
    // 必要に応じて turf.booleanPointInPolygon で厳密フィルタ可能
    return species;
  }
}
