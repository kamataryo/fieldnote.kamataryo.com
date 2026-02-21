export interface SpeciesPhoto {
  url: string;
  attribution: string;
  license: string;
}

export interface Species {
  id: number;
  scientificName: string;
  commonName?: string; // 和名（日本語）
  englishName?: string; // 英名
  rank: string;
  observationCount: number;
  photos: SpeciesPhoto[];
  source: 'iNaturalist' | 'GBIF';
  // 分類階層情報
  taxonomy?: {
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus?: string;
  };
  wikipediaUrl?: string;
  location?: [number, number]; // [longitude, latitude]
}

