import type { SortBy } from '@types/species';
import './SpeciesFilter.css';

interface SpeciesFilterProps {
  searchTerm: string;
  hasPhoto: boolean;
  sortBy: SortBy;
  onSearchChange: (value: string) => void;
  onHasPhotoChange: (value: boolean) => void;
  onSortChange: (value: SortBy) => void;
}

export function SpeciesFilter({
  searchTerm,
  hasPhoto,
  sortBy,
  onSearchChange,
  onHasPhotoChange,
  onSortChange,
}: SpeciesFilterProps) {
  return (
    <div className="species-filter">
      <div className="filter-group">
        <input
          type="text"
          placeholder="種名で検索..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="filter-input"
        />
      </div>

      <div className="filter-group filter-group--row">
        <label className="filter-label">
          <input
            type="checkbox"
            checked={hasPhoto}
            onChange={(e) => onHasPhotoChange(e.target.checked)}
          />
          <span>写真ありのみ</span>
        </label>

        <select value={sortBy} onChange={(e) => onSortChange(e.target.value as SortBy)} className="filter-select">
          <option value="observationCount">観察数順</option>
          <option value="name">名前順</option>
          <option value="rank">分類階級順</option>
        </select>
      </div>
    </div>
  );
}
