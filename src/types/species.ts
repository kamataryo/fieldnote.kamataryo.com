export interface SpeciesPhoto {
  url: string;
  attribution: string;
  license: string;
}

export interface Species {
  id: number;
  scientificName: string;
  commonName?: string;
  rank: string;
  observationCount: number;
  photos: SpeciesPhoto[];
  source: 'iNaturalist' | 'GBIF';
  wikipediaUrl?: string;
  description?: string;
  wikipediaImage?: {
    url: string;
    attribution: string;
    license: string;
    author: string;
  };
}

export interface SpeciesFilters {
  rank?: string;
  hasPhoto: boolean;
  searchTerm: string;
}

export type SortBy = 'name' | 'observationCount' | 'rank';
