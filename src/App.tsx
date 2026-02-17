import { useCallback } from 'react'
import { MapContainer } from '@components/Map/MapContainer'
import { SpeciesListPanel } from '@components/SpeciesList/SpeciesListPanel'
import type { Feature, Polygon } from '@types/map'
import { useAppStore } from '@store/appStore'
import './styles/App.css'

function App() {
  const { setPolygon, fetchSpecies, clearSpecies, species, isLoading, error, progress } = useAppStore()

  const handlePolygonCreated = useCallback(async (polygon: Feature<Polygon>) => {
    console.log('App: Polygon created', polygon)
    setPolygon(polygon)
    await fetchSpecies(polygon)
  }, [setPolygon, fetchSpecies])

  const handlePolygonUpdated = useCallback(async (polygon: Feature<Polygon>) => {
    console.log('App: Polygon updated', polygon)
    setPolygon(polygon)
    await fetchSpecies(polygon)
  }, [setPolygon, fetchSpecies])

  const handlePolygonDeleted = useCallback(() => {
    console.log('App: Polygon deleted')
    clearSpecies()
  }, [clearSpecies])

  return (
    <div className="app">
      <header className="app-header">
        <h1>FieldNote - 野外観察図鑑生成</h1>
        <p>地図上でポリゴンを描画し、その範囲の生物を観察しましょう</p>
        {isLoading && progress && (
          <div className="progress-bar">
            <div className="progress-text">{progress.message}</div>
            {progress.total > 0 && (
              <div className="progress-indicator">
                {progress.current} / {progress.total}
              </div>
            )}
          </div>
        )}
        {error && <div className="error-message">エラー: {error}</div>}
        {!isLoading && species.length > 0 && (
          <div className="species-count">
            観察された生物: <strong>{species.length}種</strong>
          </div>
        )}
      </header>
      <main className="app-main">
        <MapContainer
          onPolygonCreated={handlePolygonCreated}
          onPolygonUpdated={handlePolygonUpdated}
          onPolygonDeleted={handlePolygonDeleted}
        />
        <SpeciesListPanel />
      </main>
    </div>
  )
}

export default App
