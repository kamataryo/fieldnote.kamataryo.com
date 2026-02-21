import type { Species } from '@types/species';
import './SpeciesCard.css';

interface SpeciesCardProps {
  species: Species;
}

const RANK_TRANSLATIONS: Record<string, string> = {
  species: '種',
  genus: '属',
  family: '科',
  order: '目',
  class: '綱',
  phylum: '門',
  kingdom: '界',
};

export function SpeciesCard({ species }: SpeciesCardProps) {
  const imageUrl = species.photos[0]?.url;
  const rankJa = RANK_TRANSLATIONS[species.rank] || species.rank;

  return (
    <div id={`species-card-${species.id}`} className="species-card">
      {imageUrl && (
        <div className="species-card__image">
          <img src={imageUrl} alt={species.commonName || species.scientificName} loading="lazy" />
        </div>
      )}
      <div className="species-card__content">
        <h3 className="species-card__name">{species.commonName || species.englishName || species.scientificName}</h3>
        {species.englishName && species.commonName && (
          <p className="species-card__english">{species.englishName}</p>
        )}
        <p className="species-card__scientific">{species.scientificName}</p>

        <div className="species-card__meta">
          <span className="badge badge--rank">{rankJa}</span>
          <span className="badge badge--obs">観察数: {species.observationCount}</span>
        </div>

        {species.wikipediaUrl && (
          <a
            href={species.wikipediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="species-card__link"
          >
            Wikipediaで詳細を見る →
          </a>
        )}

        {imageUrl && species.photos[0] && (
          <div className="species-card__attribution">
            <span>出典: {species.photos[0].attribution}</span>
          </div>
        )}
      </div>
    </div>
  );
}
