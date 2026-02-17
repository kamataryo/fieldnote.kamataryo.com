import { useMemo } from 'react';
import { useAppStore } from '@store/appStore';
import { SpeciesCard } from './SpeciesCard';
import { SpeciesFilter } from './SpeciesFilter';
import { ExportPanel } from '@components/Export/ExportPanel';
import type { Species } from '@types/species';
import './SpeciesListPanel.css';

export function SpeciesListPanel() {
  const { species, isLoading, filters, sortBy, updateFilters, setSortBy } = useAppStore();

  // フィルタリング＆ソート
  const filteredAndSortedSpecies = useMemo(() => {
    let result = [...species];

    // フィルタリング
    if (filters.hasPhoto) {
      result = result.filter(
        (s) => s.photos.length > 0 || s.wikipediaImage
      );
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.scientificName.toLowerCase().includes(term) ||
          s.commonName?.toLowerCase().includes(term)
      );
    }

    // ソート
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.commonName || a.scientificName).localeCompare(
            b.commonName || b.scientificName
          );
        case 'observationCount':
          return b.observationCount - a.observationCount;
        case 'rank': {
          const rankOrder = ['species', 'genus', 'family', 'order', 'class', 'phylum', 'kingdom'];
          return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
        }
        default:
          return 0;
      }
    });

    return result;
  }, [species, filters, sortBy]);

  if (species.length === 0 && !isLoading) {
    return (
      <div className="species-list-panel">
        <div className="species-list-empty">
          <p>地図上でポリゴンを描画してください</p>
          <p className="species-list-empty__hint">
            左上のポリゴンボタンをクリックして、観察したいエリアを囲みましょう
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="species-list-panel">
      {species.length > 0 && (
        <>
          <SpeciesFilter
            searchTerm={filters.searchTerm}
            hasPhoto={filters.hasPhoto}
            sortBy={sortBy}
            onSearchChange={(value) => updateFilters({ searchTerm: value })}
            onHasPhotoChange={(value) => updateFilters({ hasPhoto: value })}
            onSortChange={setSortBy}
          />

          <div className="species-list-count">
            {filteredAndSortedSpecies.length} / {species.length} 種
          </div>
        </>
      )}

      <div className="species-list-scroll">
        {isLoading ? (
          <div className="species-list-loading">
            <div className="spinner"></div>
            <p>データを読み込み中...</p>
          </div>
        ) : (
          <div className="species-list-grid">
            {filteredAndSortedSpecies.map((s) => (
              <SpeciesCard key={s.id} species={s} />
            ))}
          </div>
        )}
      </div>

      {species.length > 0 && <ExportPanel />}
    </div>
  );
}
