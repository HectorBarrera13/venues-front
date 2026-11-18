// The seat map editor (P5). Owns a MapDocument (VEN-501) and drives every
// mutation through the active tool; the canvas (VEN-502) only reports pointer
// events in normalized coordinates.

import { useMemo, useRef, useState } from 'react'
import MapCanvas from './MapCanvas.jsx'
import { TOOLS, toolGate } from './tools.js'
import { rectIsUsable, rectOutline } from './geometry.js'
import { MapDocumentError } from './mapDocument.js'

const TOOL_LABELS = {
  [TOOLS.SELECT]: 'Seleccionar',
  [TOOLS.STAGE]: 'Escenario',
  [TOOLS.SEAT]: 'Asiento',
  [TOOLS.BLOCK]: 'Bloque',
  [TOOLS.ZONE]: 'Zona',
}

function SeatMapEditor({ venue, document: doc, savedVersion = 0 }) {
  const [revision, setRevision] = useState(0)
  const [tool, setTool] = useState(TOOLS.STAGE)
  const [draft, setDraft] = useState(null)
  const [notice, setNotice] = useState(null)
  const dragRef = useRef(null)

  const snapshot = useMemo(() => doc.serialize(), [doc, revision])
  const hasStage = snapshot.stage !== null
  const refresh = () => setRevision((value) => value + 1)

  const run = (action) => {
    try {
      action(doc)
      setNotice(null)
    } catch (error) {
      if (error instanceof MapDocumentError) setNotice(error.message)
      else throw error
    }
    refresh()
  }

  const selectTool = (next) => {
    if (!toolGate(next, hasStage).enabled) return
    setTool(next)
    setDraft(null)
  }

  const handlers = {
    onDown(point) {
      if (tool === TOOLS.STAGE) {
        dragRef.current = point
        setDraft({ kind: 'rect', from: point, to: point })
      }
    },
    onMove(point) {
      if (tool === TOOLS.STAGE && dragRef.current) {
        setDraft({ kind: 'rect', from: dragRef.current, to: point })
      }
    },
    onUp(point) {
      if (tool === TOOLS.STAGE && dragRef.current) {
        const from = dragRef.current
        dragRef.current = null
        setDraft(null)
        if (rectIsUsable(from, point)) run((target) => target.setStage({ outline: rectOutline(from, point) }))
      }
    },
  }

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

      <div className="map-editor__toolbar" role="toolbar" aria-label="Herramientas del editor">
        {Object.values(TOOLS).map((value) => {
          const gate = toolGate(value, hasStage)
          return (
            <button
              key={value}
              type="button"
              className="map-tool"
              aria-pressed={tool === value}
              disabled={!gate.enabled}
              title={gate.reason ?? undefined}
              onClick={() => selectTool(value)}
            >
              {TOOL_LABELS[value]}
            </button>
          )
        })}
        <span className="spacer" style={{ flex: 1 }} />
        <button type="button" className="map-tool" disabled={!doc.canUndo()} onClick={() => run((target) => target.undo())}>Deshacer</button>
        <button type="button" className="map-tool" disabled={!doc.canRedo()} onClick={() => run((target) => target.redo())}>Rehacer</button>
        {hasStage && (
          <button type="button" className="map-tool map-tool--danger" onClick={() => run((target) => target.clearStage())}>
            Borrar escenario
          </button>
        )}
      </div>

      {!hasStage && (
        <div className="map-banner map-banner--info" role="status">
          Empieza dibujando el escenario: arrastra un rectángulo con la herramienta «Escenario».
          Los asientos y las zonas se desbloquean en cuanto exista.
        </div>
      )}
      {notice && <div className="map-banner map-banner--error" role="alert">{notice}</div>}

      <div className="map-editor__canvas-frame">
        <MapCanvas
          tool={tool}
          stage={snapshot.stage}
          zones={snapshot.zones}
          seats={snapshot.seats}
          draft={draft}
          onDown={handlers.onDown}
          onMove={handlers.onMove}
          onUp={handlers.onUp}
        />
      </div>
    </section>
  )
}

export default SeatMapEditor
