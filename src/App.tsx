import { useCallback, useMemo, useRef, useState } from 'react'
import { MapContainer } from '@components/Map/MapContainer'
import type { MapContainerHandle } from '@components/Map/MapContainer'
import { SpeciesListPanel } from '@components/SpeciesList/SpeciesListPanel'
import { TaxonSelectionModal } from '@components/TaxonSelectionModal/TaxonSelectionModal'
import { SpeciesPopup } from '@components/SpeciesPopup/SpeciesPopup'
import type { Feature, Polygon } from '@t/map'
import { useAppStore } from '@store/appStore'
import { buildTaxonomyTree, getSelectedSpeciesIds } from '@services/taxonomyUtils'
import './styles/App.css'

function App() {
  const mapRef = useRef<MapContainerHandle>(null);
  const [popupSpeciesId, setPopupSpeciesId] = useState<number | null>(null);

  const {
    setPolygon,
    fetchInitialSpecies,
    enrichWithWikipedia,
    clearSpecies,
    cancelSelection,
    allSpecies,
    species,
    isLoading,
    error,
    progress,
    showTaxonModal,
    currentPolygon,
  } = useAppStore()

  const popupSpecies = useMemo(
    () => species.find((s) => s.id === popupSpeciesId) ?? null,
    [species, popupSpeciesId]
  );

  // 分類群ツリーを生成
  const taxonomyTree = useMemo(() => {
    if (allSpecies.length > 0) {
      return buildTaxonomyTree(allSpecies)
    }
    return []
  }, [allSpecies])

  const handlePolygonCreated = useCallback(
    async (polygon: Feature<Polygon>) => {
      console.log('App: Polygon created', polygon)
      setPolygon(polygon)
      await fetchInitialSpecies(polygon) // Step 1: iNaturalistのみ取得
    },
    [setPolygon, fetchInitialSpecies]
  )

  const handlePolygonUpdated = useCallback(
    async (polygon: Feature<Polygon>) => {
      console.log('App: Polygon updated', polygon)
      setPolygon(polygon)
      await fetchInitialSpecies(polygon)
    },
    [setPolygon, fetchInitialSpecies]
  )

  const handlePolygonDeleted = useCallback(() => {
    console.log('App: Polygon deleted')
    // ポリゴンを削除しても図鑑・POI は残す（clearSpecies は呼ばない）
  }, [])

  const handleTaxonSelectionConfirm = useCallback(
    async (selection: Record<string, boolean>) => {
      console.log('Taxon selection confirmed:', selection)
      const selectedIds = getSelectedSpeciesIds(taxonomyTree, selection)
      console.log(`Selected ${selectedIds.size} species`)
      await enrichWithWikipedia(selectedIds)
      // 図鑑確定後にポリゴンを削除
      mapRef.current?.deletePolygon()
    },
    [taxonomyTree, enrichWithWikipedia]
  )

  const handleTaxonSelectionCancel = useCallback(() => {
    console.log('Taxon selection cancelled')
    cancelSelection()
  }, [cancelSelection])

  const handleReset = useCallback(() => {
    clearSpecies()
    mapRef.current?.deletePolygon()
  }, [clearSpecies])

  return (
    <div className="app">
      <header className="app-header">
        <h1>FieldNote - 野外観察図鑑生成</h1>
        <p>地図上でポリゴンを描画し、その範囲の生物を観察しましょう</p>
        {error && <div className="error-message">エラー: {error}</div>}
      </header>
      <main className="app-main">
        <MapContainer
          ref={mapRef}
          onPolygonCreated={handlePolygonCreated}
          onPolygonUpdated={handlePolygonUpdated}
          onPolygonDeleted={handlePolygonDeleted}
          onSpeciesMarkerClick={(id) => setPopupSpeciesId(id)}
          drawLocked={species.length > 0}
        />
        <SpeciesListPanel />
      </main>

      {(species.length > 0 || (currentPolygon !== null && !showTaxonModal && !isLoading)) && (
        <button className="reset-float-btn" onClick={handleReset}>やり直す</button>
      )}
      {popupSpecies && (
        <SpeciesPopup species={popupSpecies} onClose={() => setPopupSpeciesId(null)} />
      )}

      <TaxonSelectionModal
        isOpen={showTaxonModal}
        taxonomyTree={taxonomyTree}
        onConfirm={handleTaxonSelectionConfirm}
        onCancel={handleTaxonSelectionCancel}
        isLoading={isLoading}
        progress={progress}
      />
    </div>
  )
}

export default App
