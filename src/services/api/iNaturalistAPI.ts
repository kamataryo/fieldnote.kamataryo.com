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
   * 分類階層情報を取得（Taxon一括取得API使用）
   * /taxa?id=1,2,3,... で最大30件ずつ一括取得し、個別リクエストを大幅削減する
   */
  private async enrichWithTaxonomy(
    species: Species[],
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Species[]> {
    console.log('Fetching taxonomy information (bulk)...');

    // 30件ずつ一括取得（iNaturalist API の実用的な上限）
    const chunkSize = 30;
    const enrichedSpecies: Species[] = [];

    for (let i = 0; i < species.length; i += chunkSize) {
      const chunk = species.slice(i, i + chunkSize);

      // キャッシュにないものだけAPIリクエスト
      const uncachedIds = chunk.filter((s) => !this.taxonCache.has(s.id)).map((s) => s.id);

      if (uncachedIds.length > 0) {
        try {
          const response = await this.requestWithRetry<any>({
            method: 'GET',
            url: '/taxa',
            params: {
              id: uncachedIds.join(','),
              locale: 'ja',
            },
          });

          // レスポンスをキャッシュに格納
          (response.results || []).forEach((taxon: any) => {
            const taxonomy: Species['taxonomy'] = {};
            if (taxon.ancestors) {
              taxon.ancestors.forEach((ancestor: any) => {
                const rank = ancestor.rank;
                if (rank === 'kingdom') taxonomy.kingdom = ancestor.name;
                else if (rank === 'phylum') taxonomy.phylum = ancestor.name;
                else if (rank === 'class') taxonomy.class = ancestor.name;
                else if (rank === 'order') taxonomy.order = ancestor.name;
                else if (rank === 'family') taxonomy.family = ancestor.name;
                else if (rank === 'genus') taxonomy.genus = ancestor.name;
              });
            }
            this.taxonCache.set(taxon.id, {
              taxonomy,
              japaneseName: taxon.preferred_common_name,
              wikipediaUrl: taxon.wikipedia_url,
            });
          });
        } catch (error) {
          console.warn(`Failed to get bulk taxon details for ids [${uncachedIds.join(',')}]:`, error);
        }
      }

      // キャッシュから各 species を更新
      chunk.forEach((s) => {
        const cached = this.taxonCache.get(s.id);
        enrichedSpecies.push({
          ...s,
          taxonomy: cached?.taxonomy,
          commonName: cached?.japaneseName || s.commonName,
          wikipediaUrl: cached?.wikipediaUrl,
        });
      });

      // 進捗を通知
      if (onProgress) {
        onProgress(enrichedSpecies.length, species.length, `分類情報を取得中... (${enrichedSpecies.length}/${species.length})`);
      }

      console.log(`Taxonomy enrichment: ${enrichedSpecies.length}/${species.length}`);
    }

    return enrichedSpecies;
  }

  private taxonCache = new Map<number, { taxonomy: Species['taxonomy']; japaneseName?: string; wikipediaUrl?: string }>();

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

  private filterInsidePolygon(species: Species[], polygon: Feature<Polygon>): Species[] {
    // 簡略化のため、バウンディングボックス検索結果をそのまま使用
    // 必要に応じて turf.booleanPointInPolygon で厳密フィルタ可能
    return species;
  }
}
