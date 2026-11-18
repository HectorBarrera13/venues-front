// The seat map editor (P5). Owns a MapDocument (VEN-501) and drives every
// mutation through the active tool; the canvas (VEN-502) only reports pointer
// events in normalized coordinates.

import { useEffect, useMemo, useRef, useState } from 'react'
import MapCanvas from './MapCanvas.jsx'
import { TOOLS, toolGate } from './tools.js'
import { blockProblems, rectIsUsable, rectOutline } from './geometry.js'
import { computeBlockPositions, MapDocumentError } from './mapDocument.js'
import { DEFAULT_VIEW } from './viewport.js'
import { nextLooseLabel, renumberRow } from './labels.js'

const TOOL_LABELS = {
  [TOOLS.SELECT]: 'Seleccionar',
  [TOOLS.STAGE]: 'Escenario',
  [TOOLS.SEAT]: 'Asiento',
  [TOOLS.BLOCK]: 'Bloque',
  [TOOLS.ZONE]: 'Zona',
}

const DEFAULT_BLOCK_FORM = {
  rows: 10,
  seatsPerRow: 12,
  spacing: 2, // percentage of the canvas width
  rowSpacing: 2,
  rotation: 0,
}

function numberInput(value, onChange, { min, max, step = 1, suffix = '' } = {}) {
  return (
    <label>
      {suffix || undefined}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

/**
 * Edits one seat's label and row (VEN-505). The changes are committed on blur
 * or Enter — one undo step per edit — and count as a manual edit, so the
 * automatic renumbering skips this seat afterwards.
 */
function SeatInspector({ seat, onCommit, onRenumberRow, onDelete }) {
  const [label, setLabel] = useState(seat?.label ?? '')
  const [row, setRow] = useState(seat?.row ?? '')

  if (!seat) return null
  const commit = () => {
    if (!label.trim()) return
    onCommit({ label, row: row.trim() === '' ? null : row.trim() })
  }

  return (
    <>
      <h2>Asiento {seat.id}</h2>
      <label>
        Label
        <input value={label} onChange={(event) => setLabel(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && commit()} />
      </label>
      <label>
        Fila (vacío = sin fila)
        <input value={row} onChange={(event) => setRow(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && commit()} />
      </label>
      {seat.row !== null && (
        <button type="button" className="map-tool" onClick={onRenumberRow}>Renumerar fila (respeta edits manuales)</button>
      )}
      <button type="button" className="map-tool map-tool--danger" onClick={onDelete}>Eliminar asiento</button>
      <p className="hint">Los labels duplicados dentro de la misma zona se marcan en el panel de problemas.</p>
    </>
  )
}

function SeatMapEditor({ venue, document: doc, savedVersion = 0 }) {
  const [revision, setRevision] = useState(0)
  const [tool, setTool] = useState(TOOLS.STAGE)
  const [draft, setDraft] = useState(null)
  const [notice, setNotice] = useState(null)
  const [view, setView] = useState(DEFAULT_VIEW)
  const [selectedSeatIds, setSelectedSeatIds] = useState(() => new Set())
  const [conflictSeatIds, setConflictSeatIds] = useState(() => new Set())
  const [blockForm, setBlockForm] = useState(DEFAULT_BLOCK_FORM)
  /** Seats whose label/row was edited by hand: automatic renumbering must never overwrite them. */
  const [manualIds, setManualIds] = useState(() => new Set())
  const dragRef = useRef(null)

  const snapshot = useMemo(() => doc.serialize(), [doc, revision]) // eslint-disable-line react-hooks/exhaustive-deps -- revision intentionally invalidates the memo over the mutable document
  const hasStage = snapshot.stage !== null
  const refresh = () => setRevision((value) => value + 1)

  const run = (action) => {
    try {
      action(doc)
      setNotice(null)
      return true
    } catch (error) {
      if (error instanceof MapDocumentError) setNotice(error.message)
      else throw error
      return false
    } finally {
      refresh()
    }
  }

  const selectTool = (next) => {
    if (!toolGate(next, hasStage).enabled) return
    setTool(next)
    setDraft(null)
    setConflictSeatIds(new Set())
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        run((target) => (event.shiftKey ? target.redo() : target.undo()))
        setDraft(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStage])

  const blockPreview = (tool === TOOLS.BLOCK && draft?.origin)
    ? (() => {
      const layout = computeBlockPositions({
        origin: draft.origin,
        rows: Math.max(1, Math.floor(blockForm.rows)),
        seatsPerRow: Math.max(1, Math.floor(blockForm.seatsPerRow)),
        spacing: blockForm.spacing / 100,
        rowSpacing: blockForm.rowSpacing / 100,
        rotation: blockForm.rotation,
      })
      return { layout, problems: blockProblems(layout, snapshot.seats) }
    })()
    : null

  const handlers = {
    onDown(point) {
      if (tool === TOOLS.STAGE) {
        dragRef.current = { kind: 'stage', from: point }
        setDraft({ kind: 'rect', from: point, to: point })
        return
      }
      if (tool === TOOLS.SEAT) {
        run((target) => {
          const created = target.addSeat({ label: nextLooseLabel(target.getSeats()), position: point })
          setSelectedSeatIds(new Set([created.id]))
          return created
        })
        return
      }
      if (tool === TOOLS.BLOCK) {
        commitBlock()
        return
      }
      if (tool === TOOLS.SELECT) {
        // Drag on empty space selects an area (zones land in VEN-506); a plain click clears.
        dragRef.current = { kind: 'maybe-marquee', from: point }
        setDraft(null)
      }
    },
    onMove(point) {
      if (tool === TOOLS.STAGE && dragRef.current?.kind === 'stage') {
        setDraft({ kind: 'rect', from: dragRef.current.from, to: point })
        return
      }
      if (tool === TOOLS.BLOCK) {
        setDraft({ kind: 'block-origin', origin: point })
        return
      }
      if (tool === TOOLS.SELECT && dragRef.current?.kind === 'seat') {
        const delta = { x: point.x - dragRef.current.from.x, y: point.y - dragRef.current.from.y }
        const ghosts = snapshot.seats
          .filter((seat) => selectedSeatIds.has(seat.id))
          .map((seat) => ({ ...seat, position: { x: seat.position.x + delta.x, y: seat.position.y + delta.y } }))
        setDraft({ kind: 'drag', ghosts })
        return
      }
      if (tool === TOOLS.SELECT && dragRef.current?.kind === 'maybe-marquee') {
        dragRef.current = { kind: 'marquee', from: dragRef.current.from }
      }
      if (tool === TOOLS.SELECT && dragRef.current?.kind === 'marquee') {
        setDraft({ kind: 'rect', from: dragRef.current.from, to: point })
      }
    },
    onUp(point) {
      if (tool === TOOLS.STAGE && dragRef.current?.kind === 'stage') {
        const from = dragRef.current.from
        dragRef.current = null
        setDraft(null)
        if (rectIsUsable(from, point)) run((target) => target.setStage({ outline: rectOutline(from, point) }))
        return
      }
      if (tool === TOOLS.SELECT && dragRef.current?.kind === 'seat') {
        const { from, ids } = dragRef.current
        dragRef.current = null
        const delta = point ? { x: point.x - from.x, y: point.y - from.y } : { x: 0, y: 0 }
        setDraft(null)
        if (Math.abs(delta.x) > 1e-9 || Math.abs(delta.y) > 1e-9) run((target) => target.nudgeSeats(ids, delta))
        return
      }
      if (tool === TOOLS.SELECT && dragRef.current) {
        const marquee = dragRef.current
        dragRef.current = null
        if (marquee.kind === 'marquee' && point) {
          // Marquee selection is completed with the zone tool (VEN-506).
          setDraft(null)
        } else if (marquee.kind === 'maybe-marquee') {
          setSelectedSeatIds(new Set())
        }
      }
    },
    onSeatDown(seat, event) {
      if (tool === TOOLS.SEAT) return
      if (event.shiftKey) {
        setSelectedSeatIds((current) => {
          const next = new Set(current)
          if (next.has(seat.id)) next.delete(seat.id)
          else next.add(seat.id)
          return next
        })
        dragRef.current = null
        return
      }
      const ids = selectedSeatIds.has(seat.id) ? [...selectedSeatIds] : [seat.id]
      if (!selectedSeatIds.has(seat.id)) setSelectedSeatIds(new Set([seat.id]))
      dragRef.current = { kind: 'seat', from: seat.position, ids }
    },
  }

  function commitBlock() {
    const preview = blockPreview
    setDraft(null)
    if (!preview) return
    if (!preview.problems.valid) {
      setConflictSeatIds(new Set(preview.problems.overlapSeatIds))
      setNotice(preview.problems.outOfBounds.length > 0
        ? 'La rotación o el espaciado empujan asientos fuera del lienzo: no se añadió ninguno.'
        : 'El bloque solapa asientos existentes: no se añadió ninguno.')
      return
    }
    setConflictSeatIds(new Set())
    run((target) => target.addBlock({
      origin: preview.layout[0].position,
      rows: Math.max(1, Math.floor(blockForm.rows)),
      seatsPerRow: Math.max(1, Math.floor(blockForm.seatsPerRow)),
      spacing: blockForm.spacing / 100,
      rowSpacing: blockForm.rowSpacing / 100,
      rotation: blockForm.rotation,
    }))
  }

  const ghostSeats = useMemo(() => {
    if (blockPreview) {
      return blockPreview.layout.map((item, index) => ({
        id: `ghost-${index}`,
        position: item.position,
        invalid: blockPreview.problems.outOfBounds.includes(item),
      }))
    }
    if (draft?.kind === 'drag') return draft.ghosts
    return []
  }, [blockPreview, draft])

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
        <button type="button" className="map-tool" onClick={() => setView(DEFAULT_VIEW)}>Recentrar</button>
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

      <div className="map-editor__layout">
        <div className="map-editor__canvas-frame">
          <MapCanvas
            tool={tool}
            view={view}
            onViewChange={setView}
            stage={snapshot.stage}
            zones={snapshot.zones}
            seats={snapshot.seats}
            ghostSeats={ghostSeats}
            selectedSeatIds={selectedSeatIds}
            highlightSeatIds={conflictSeatIds}
            draft={draft?.kind === 'rect' || draft?.kind === 'polygon' ? draft : null}
            onDown={handlers.onDown}
            onMove={handlers.onMove}
            onUp={handlers.onUp}
            onSeatDown={handlers.onSeatDown}
          />
        </div>

        <aside className="map-editor__panel" aria-label="Opciones de la herramienta">
          {tool === TOOLS.BLOCK ? (
            <>
              <h2>Generar bloque</h2>
              <p className="hint">Mueve el cursor para previsualizar la retícula y haz clic para generar el bloque. Un bloque se deshace como una sola acción.</p>
              {numberInput(blockForm.rows, (rows) => setBlockForm((form) => ({ ...form, rows })), { min: 1, max: 100, suffix: 'Filas' })}
              {numberInput(blockForm.seatsPerRow, (seatsPerRow) => setBlockForm((form) => ({ ...form, seatsPerRow })), { min: 1, max: 200, suffix: 'Asientos por fila' })}
              <div className="row">
                {numberInput(blockForm.spacing, (spacing) => setBlockForm((form) => ({ ...form, spacing })), { min: 0.5, max: 20, step: 0.1, suffix: 'Espaciado %' })}
                {numberInput(blockForm.rowSpacing, (rowSpacing) => setBlockForm((form) => ({ ...form, rowSpacing })), { min: 0.5, max: 20, step: 0.1, suffix: 'Entre filas %' })}
              </div>
              {numberInput(blockForm.rotation, (rotation) => setBlockForm((form) => ({ ...form, rotation })), { min: 0, max: 359, suffix: 'Rotación °' })}
              <p className="hint" role="status">
                Generará {Math.max(1, Math.floor(blockForm.rows)) * Math.max(1, Math.floor(blockForm.seatsPerRow))} asientos
                {blockPreview && !blockPreview.problems.valid ? ' — posición inválida (rojo).' : '.'}
              </p>
            </>
          ) : selectedSeatIds.size === 1 ? (
            <SeatInspector
              key={[...selectedSeatIds][0]}
              seat={snapshot.seats.find((seat) => selectedSeatIds.has(seat.id))}
              onCommit={({ label, row }) => {
                const id = [...selectedSeatIds][0]
                run((target) => target.renameSeat(id, { label, row }))
                setManualIds((current) => new Set(current).add(id))
              }}
              onRenumberRow={() => {
                const id = [...selectedSeatIds][0]
                const seat = doc.getSeat(id)
                if (!seat || seat.row === null) return
                run((target) => {
                  for (const change of renumberRow(target.getSeats(), { row: seat.row, zone: seat.zone, manualIds })) {
                    target.renameSeat(change.id, { label: change.label })
                  }
                })
              }}
              onDelete={() => run((target) => target.removeSeat([...selectedSeatIds][0]))}
            />
          ) : selectedSeatIds.size > 1 ? (
            <>
              <h2>{`${selectedSeatIds.size} asientos seleccionados`}</h2>
              <p className="hint">Arrastra uno de ellos para mover toda la selección como una sola acción.</p>
              <button
                type="button"
                className="map-tool map-tool--danger"
                onClick={() => run((target) => { for (const id of selectedSeatIds) target.removeSeat(id) })}
              >
                Eliminar selección
              </button>
            </>
          ) : (
            <>
              <h2>{TOOL_LABELS[tool]}</h2>
              <p className="hint">
                {tool === TOOLS.STAGE && 'Arrastra un rectángulo para dibujar o re-dibujar el escenario.'}
                {tool === TOOLS.SEAT && 'Haz clic en el lienzo para colocar un asiento; el label se numera solo.'}
                {tool === TOOLS.ZONE && 'Selecciona asientos y crea la zona (disponible al activar la herramienta zona).'}
                {tool === TOOLS.SELECT && 'Clic para seleccionar, shift-clic para agregar, arrastra para mover.'}
              </p>
              {snapshot.seats.length > 0 && (
                <p className="hint">{snapshot.seats.length} asientos · {snapshot.zones.length} zonas.</p>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

export default SeatMapEditor
