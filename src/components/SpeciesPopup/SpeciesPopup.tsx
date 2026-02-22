import { useEffect } from 'react';
import type { Species } from '@types/species';
import { SpeciesCard } from '@components/SpeciesList/SpeciesCard';
import './SpeciesPopup.css';

interface SpeciesPopupProps {
  species: Species;
  onClose: () => void;
}

export function SpeciesPopup({ species, onClose }: SpeciesPopupProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="species-popup-overlay" onClick={onClose}>
      <div className="species-popup" onClick={(e) => e.stopPropagation()}>
        <button className="species-popup__close" onClick={onClose} aria-label="閉じる">✕</button>
        <SpeciesCard species={species} />
      </div>
    </div>
  );
}
