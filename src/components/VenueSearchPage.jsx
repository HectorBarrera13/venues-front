// Venue search page at /venues/search (VEN-604/605).
// Three search modes: geo (Leaflet map + radius), text (name/country/city),
// and general listing. AbortController cancels in-flight requests when filters change.

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet'
import venueApiClient from '../services/VenueApiClient.js'
import VenueCard from './VenueCard.jsx'
import 'leaflet/dist/leaflet.css'

const PAGE_SIZE = 20
const MODES = { GEO: 'geo', TEXT: 'text', ALL: 'all' }

// Leaflet click handler component (must be inside MapContainer)
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) })
  return null
}

function PaginationControls({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <nav className="pagination-controls" aria-label="Paginación de resultados">
      <button
        type="button"
        className="pagination-btn"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        ← Anterior
      </button>
      <span className="pagination-info">Página {page} de {totalPages}</span>
      <button
        type="button"
        className="pagination-btn"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Siguiente →
      </button>
    </nav>
  )
}

function VenueSearchPage() {
  const [mode, setMode] = useState(MODES.ALL)

  // Geo state
  const [geoCenter, setGeoCenter] = useState(null) // { lat, lng }
  const [radiusKm, setRadiusKm] = useState(10)

  // Text state
  const [nameFilter, setNameFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')

  // Results
  const [results, setResults] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const abortRef = useRef(null)

  const search = useCallback(async (filters, pageNum) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError('')
    try {
      const result = await venueApiClient.searchVenues(
        { ...filters, page: pageNum, limit: PAGE_SIZE },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setResults(result.data)
      setPagination(result.pagination)
    } catch (err) {
      if (err.name === 'AbortError') return
      if (err.status === 400) {
        setError('Coordenadas o radio inválidos. Revisa los valores e inténtalo de nuevo.')
      } else {
        setError(err.message || 'No se pudo realizar la búsqueda.')
      }
      setResults([])
      setPagination(null)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  // Re-run when filters or page change
  useEffect(() => {
    if (mode === MODES.GEO && geoCenter) {
      search({ lat: geoCenter.lat, lng: geoCenter.lng, radius_km: radiusKm }, page)
    } else if (mode === MODES.TEXT) {
      const hasFilters = nameFilter.trim() || countryFilter.trim() || cityFilter.trim()
      if (hasFilters) {
        const filters = {}
        if (nameFilter.trim()) filters.name = nameFilter.trim()
        if (countryFilter.trim()) filters.country = countryFilter.trim().toUpperCase()
        if (cityFilter.trim()) filters.city = cityFilter.trim()
        search(filters, page)
      } else {
        setResults([])
        setPagination(null)
      }
    } else if (mode === MODES.ALL) {
      search({}, page)
    }
  }, [mode, geoCenter, radiusKm, nameFilter, countryFilter, cityFilter, page, search])

  // Reset page when mode or main filters change
  const switchMode = (newMode) => {
    setMode(newMode)
    setPage(1)
    setResults([])
    setPagination(null)
    setError('')
  }

  const handleMapClick = ({ lat, lng }) => {
    setGeoCenter({ lat, lng })
    setPage(1)
  }

  const isGeoSearch = mode === MODES.GEO && Boolean(geoCenter)

  return (
    <div className="venue-search-page">
      <section className="page-intro" aria-labelledby="search-title">
        <div>
          <p className="eyebrow">Explorar</p>
          <h1 id="search-title">Buscar recintos</h1>
          <p className="page-description">
            Encuentra recintos por ubicación, nombre o país.
          </p>
        </div>
      </section>

      {/* Mode selector */}
      <div className="search-mode-tabs" role="tablist" aria-label="Modo de búsqueda">
        <button
          type="button"
          role="tab"
          className={`search-mode-tab${mode === MODES.ALL ? ' search-mode-tab--active' : ''}`}
          aria-selected={mode === MODES.ALL}
          onClick={() => switchMode(MODES.ALL)}
        >
          Todos
        </button>
        <button
          type="button"
          role="tab"
          className={`search-mode-tab${mode === MODES.GEO ? ' search-mode-tab--active' : ''}`}
          aria-selected={mode === MODES.GEO}
          onClick={() => switchMode(MODES.GEO)}
        >
          Por ubicación
        </button>
        <button
          type="button"
          role="tab"
          className={`search-mode-tab${mode === MODES.TEXT ? ' search-mode-tab--active' : ''}`}
          aria-selected={mode === MODES.TEXT}
          onClick={() => switchMode(MODES.TEXT)}
        >
          Por nombre / ciudad
        </button>
      </div>

      {/* Geo filters */}
      {mode === MODES.GEO && (
        <div className="search-filters">
          <p className="search-hint">
            {geoCenter
              ? `Centro: ${geoCenter.lat.toFixed(4)}, ${geoCenter.lng.toFixed(4)}`
              : 'Haz clic en el mapa para elegir el centro de búsqueda.'}
          </p>
          <div className="search-filter-row">
            <label htmlFor="radius-input">
              Radio: <strong>{radiusKm} km</strong>
            </label>
            <input
              id="radius-input"
              type="range"
              min={1}
              max={500}
              value={radiusKm}
              onChange={(e) => { setRadiusKm(Number(e.target.value)); setPage(1) }}
              className="radius-slider"
            />
          </div>
          <div className="search-map-container">
            <MapContainer
              center={geoCenter ?? [19.43, -99.13]}
              zoom={geoCenter ? 10 : 5}
              style={{ height: 320, width: '100%', borderRadius: 8 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <MapClickHandler onMapClick={handleMapClick} />
              {geoCenter && (
                <Circle
                  center={geoCenter}
                  radius={radiusKm * 1000}
                  pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }}
                />
              )}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Text filters */}
      {mode === MODES.TEXT && (
        <div className="search-filters">
          <div className="search-filter-row">
            <label htmlFor="name-input">Nombre</label>
            <input
              id="name-input"
              type="text"
              className="search-input"
              placeholder="Sala Riviera…"
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setPage(1) }}
            />
          </div>
          <div className="search-filter-row">
            <label htmlFor="country-input">País (ISO alpha-2)</label>
            <input
              id="country-input"
              type="text"
              className="search-input search-input--short"
              placeholder="MX"
              maxLength={2}
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
            />
          </div>
          <div className="search-filter-row">
            <label htmlFor="city-input">Ciudad</label>
            <input
              id="city-input"
              type="text"
              className="search-input"
              placeholder="Ciudad de México…"
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setPage(1) }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="search-error" role="alert">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="skeleton-grid" aria-label="Buscando recintos" aria-busy="true">
          <div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" />
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length === 0 && pagination !== null && (
        <div className="state-panel">
          <div className="state-panel-inner">
            <h3>Sin resultados</h3>
            <p>No se encontraron recintos con esos criterios.</p>
          </div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="search-results-count" aria-live="polite">
            {pagination?.total ?? results.length} resultado{pagination?.total !== 1 ? 's' : ''}
          </p>
          <div className="venues-grid">
            {results.map((venue) => (
              <VenueCard key={venue.id} venue={venue} showDistance={isGeoSearch} />
            ))}
          </div>
          {pagination && (
            <PaginationControls
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </>
      )}
    </div>
  )
}

export default VenueSearchPage
