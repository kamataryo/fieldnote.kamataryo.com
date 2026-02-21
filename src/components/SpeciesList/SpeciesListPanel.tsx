import { useMemo } from 'react';
import { useAppStore } from '@store/appStore';
import { SpeciesCard } from './SpeciesCard';
import { ExportPanel } from '@components/Export/ExportPanel';
import { buildTaxonomyTree } from '@services/taxonomyUtils';
import type { Species } from '@types/species';
import './SpeciesListPanel.css';

export function SpeciesListPanel() {
  const { species } = useAppStore();

  const taxonomyTree = useMemo(() => buildTaxonomyTree(species), [species]);

  const speciesById = useMemo(() => {
    const map = new Map<number, Species>();
    species.forEach((s) => map.set(s.id, s));
    return map;
  }, [species]);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (species.length === 0) {
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
      <div className="species-list-count">{species.length} 種</div>

      <div className="species-list-scroll">
        {/* Sticky 目次 */}
        <div className="taxonomy-toc">
          {taxonomyTree.map((phylum) => (
            <button
              key={phylum.name}
              className="taxonomy-toc__item"
              onClick={() => scrollToSection(`taxon-${phylum.name}`)}
            >
              {phylum.name}
              <span className="taxonomy-toc__count">{phylum.count}</span>
            </button>
          ))}
        </div>

        {/* グループ化リスト */}
        <div className="taxonomy-groups">
          {taxonomyTree.map((phylum) => (
            <section key={phylum.name} id={`taxon-${phylum.name}`} className="taxonomy-phylum">
              <h2 className="taxonomy-phylum__heading">
                {phylum.name}
                <span>{phylum.count}種</span>
              </h2>
              {phylum.children.map((cls) => (
                <div key={cls.name} className="taxonomy-class">
                  <h3 className="taxonomy-class__heading">
                    {cls.name}
                    <span>{cls.count}種</span>
                  </h3>
                  <div className="species-list-grid">
                    {cls.speciesIds
                      .map((id) => speciesById.get(id))
                      .filter((s): s is Species => s !== undefined)
                      .map((s) => (
                        <SpeciesCard key={s.id} species={s} />
                      ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>

      <ExportPanel />
    </div>
  );
}
