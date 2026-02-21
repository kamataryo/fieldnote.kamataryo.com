// iNaturalist API型定義
export interface INaturalistTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  rank: string;
  iconic_taxon_name?: string;
  ancestor_ids?: number[];
  ancestors?: Array<{
    id: number;
    name: string;
    rank: string;
  }>;
}

export interface INaturalistPhoto {
  url: string;
  attribution: string;
  license_code: string;
}

export interface INaturalistObservation {
  id: number;
  taxon?: INaturalistTaxon;
  photos: INaturalistPhoto[];
  location?: string;
  observed_on?: string;
  geojson?: {
    coordinates: [number, number];
  };
}

export interface INaturalistResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: INaturalistObservation[];
}

