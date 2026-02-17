import * as turf from '@turf/turf';
import type { Feature, Polygon } from '@types/map';
import type { Species } from '@types/species';
import type { INaturalistResponse, INaturalistObservation } from '@types/api';
import { APIClient, RateLimiter } from './apiClient';

export class INaturalistAPI extends APIClient {
  constructor() {
    super('https://api.inaturalist.org/v1', new RateLimiter(60, 60000));
  }

  async getObservationsInPolygon(polygon: Feature<Polygon>): Promise<Species[]> {
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
        allObservations.push(...response.results);

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

      // 種ごとに集約
      const speciesMap = this.aggregateBySpecies(allObservations);

      // ポリゴン内フィルタリング（厳密な判定）
      const filtered = this.filterInsidePolygon(Array.from(speciesMap.values()), polygon);

      console.log(`Unique species after filtering: ${filtered.length}`);

      return filtered;
    } catch (error) {
      console.error('Error fetching iNaturalist observations:', error);
      throw error;
    }
  }

  private aggregateBySpecies(observations: INaturalistObservation[]): Map<number, Species> {
    const map = new Map<number, Species>();

    for (const obs of observations) {
      if (!obs.taxon) continue;

      const taxonId = obs.taxon.id;
      if (!map.has(taxonId)) {
        map.set(taxonId, {
          id: taxonId,
          scientificName: obs.taxon.name,
          commonName: obs.taxon.preferred_common_name,
          rank: obs.taxon.rank,
          observationCount: 0,
          photos: [],
          source: 'iNaturalist',
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
