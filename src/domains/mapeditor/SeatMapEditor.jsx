// The seat map editor module (P5). Grows ticket by ticket: this first shell
// only renders the saved document through MapCanvas (VEN-502).

import { useMemo } from 'react'
import MapCanvas from './MapCanvas.jsx'

function SeatMapEditor({ venue, document: doc, savedVersion = 0 }) {
  const snapshot = useMemo(() => doc.serialize(), [doc])

  return (
    <section className="map-editor" aria-label="Editor de mapa de asientos">
      <header className="map-editor__header">
        <div>
          <p className="eyebrow">Mapa de asientos</p>
          <h1>{venue?.name ?? 'Recinto'}</h1>
        </div>
        <span className="spacer" />
        <span className="event-status">{savedVersion > 0 ? `v${savedVersion}` : 'sin mapa'}</span>
      </header>
      <div className="map-editor__canvas-frame">
        <MapCanvas readOnly stage={snapshot.stage} zones={snapshot.zones} seats={snapshot.seats} />
      </div>
    </section>
  )
}

export default SeatMapEditor
