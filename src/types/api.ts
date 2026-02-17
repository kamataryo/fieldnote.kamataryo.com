// iNaturalist API型定義
export interface INaturalistTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  rank: string;
  iconic_taxon_name?: string;
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

// Wikipedia API型定義
export interface WikipediaSearchResult {
  pageid: number;
  title: string;
  snippet: string;
}

export interface WikipediaPage {
  pageid: number;
  title: string;
  extract?: string;
}

export interface WikipediaImageInfo {
  url: string;
  descriptionurl: string;
  extmetadata?: {
    License?: { value: string };
    Artist?: { value: string };
    Attribution?: { value: string };
  };
}
