// SVG canvas for the seat map (VEN-502). Renders a serialized MapDocument in
// the fixed 0–1 space scaled to the container, so the layout never depends on
// screen size. Zoom (wheel/pinch) is centered on the pointer, pan follows the
// drag, and every pointer event is reported back in normalized coordinates —
// hit-testing is exact at any zoom/pan because the inverse transform is the
// pure `screenToNormalized` from viewport.js.

import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_VIEW, panBy, screenToNormalized, zoomAt } from './viewport.js'
import { TOOLS } from './tools.js'

const USER = 1000 // the unit square is drawn in 1000×1000 user units
const clamp01 = (value) => Math.min(1, Math.max(0, value))

const seatRadius = (zoom) => Math.max(3.5, 9 / Math.sqrt(zoom))

function polygonPoints(outline) {
  return outline.map((point) => `${point.x * USER},${point.y * USER}`).join(' ')
}

/**
 * @param {object} props
 * @param {'stage'|'seat'|'block'|'zone'|'select'} props.tool
 * @param {{zoom:number,cx:number,cy:number}} [props.view] controlled camera; defaults to internal state
 * @param {(view: object) => void} [props.onViewChange]
 * @param {(point: {x:number,y:number}, event: PointerEvent) => void} [props.onDown]
 * @param {(point: {x:number,y:number}, event: PointerEvent) => void} [props.onMove]
 * @param {(point: {x:number,y:number}, event: PointerEvent) => void} [props.onUp]
 * @param {(seat: object, event: PointerEvent) => void} [props.onSeatDown]
 * @param {(zoneId: string, vertex: number, point: object) => void} [props.onVertexDown]
 * @param {(zoneId: string, event: PointerEvent) => void} [props.onZoneDown]
 */
function MapCanvas({
  stage,
  zones = [],
  seats = [],
  selectedSeatIds,
  selectedZoneIds,
  highlightSeatIds,
  highlightZoneIds,
  ghostSeats = [],
  draft = null,
  tool = TOOLS.SELECT,
  readOnly = false,
  view: controlledView,
  onViewChange,
  onDown,
  onMove,
  onUp,
  onSeatDown,
  onVertexDown,
  onZoneDown,
}) {
  const svgRef = useRef(null)
  const [internalView, setInternalView] = useState(DEFAULT_VIEW)
  const view = controlledView ?? internalView
  const setView = useCallback((next) => {
    if (onViewChange) onViewChange(next)
    else setInternalView(next)
  }, [onViewChange])
  const dragRef = useRef(null) // 'pan' | null while the background drag is a pan

  const toNormalized = useCallback((event) => {
    const rect = svgRef.current.getBoundingClientRect()
    return screenToNormalized(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      view,
      { width: rect.width, height: rect.height },
    )
  }, [view])

  // Non-passive wheel listener: pinch/zoom must be able to preventDefault.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const factor = event.ctrlKey
        ? Math.exp(-event.deltaY * 0.01)
        : Math.exp(-event.deltaY * 0.0015)
      setView(zoomAt(
        view,
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        factor,
        { width: rect.width, height: rect.height },
      ))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [view, setView])

  const startPan = (event) => {
    dragRef.current = { last: { x: event.clientX, y: event.clientY } }
    svgRef.current.setPointerCapture(event.pointerId)
  }

  const handlePointerDown = (event) => {
    if (event.button === 1 || event.altKey) { startPan(event); return }
    if (readOnly) return
    const point = toNormalized(event)
    dragRef.current = null
    onDown?.(point, event)
  }

  const handlePointerMove = (event) => {
    if (dragRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      setView(panBy(view, {
        x: event.clientX - dragRef.current.last.x,
        y: event.clientY - dragRef.current.last.y,
      }, { width: rect.width, height: rect.height }))
      dragRef.current.last = { x: event.clientX, y: event.clientY }
      return
    }
    onMove?.(toNormalized(event), event)
  }

  const handlePointerUp = (event) => {
    if (dragRef.current) { dragRef.current = null; return }
    onUp?.(toNormalized(event), event)
  }

  const transform = `translate(${(0.5 - view.cx * view.zoom) * USER} ${(0.5 - view.cy * view.zoom) * USER}) scale(${view.zoom})`
  const selectedSeats = selectedSeatIds ?? new Set()
  const selectedZones = selectedZoneIds ?? new Set()
  const badSeats = highlightSeatIds ?? new Set()
  const badZones = highlightZoneIds ?? new Set()
  const showLabels = view.zoom >= 1.4

  return (
    <svg
      ref={svgRef}
      className="map-canvas"
      viewBox={`0 0 ${USER} ${USER}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Mapa de asientos"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current = null; onUp?.(null) }}
    >
      <rect data-background="1" x="0" y="0" width={USER} height={USER} className="map-canvas__paper" />
      <g transform={transform}>
        <rect data-background="1" x="0" y="0" width={USER} height={USER} className="map-canvas__field" />

        {zones.map((zone) => (
          <polygon
            key={zone.id}
            points={polygonPoints(zone.outline)}
            className={[
              'map-zone',
              selectedZones.has(zone.id) ? 'map-zone--selected' : '',
              badZones.has(zone.id) ? 'map-zone--error' : '',
            ].filter(Boolean).join(' ')}
            onPointerDown={(event) => {
              if (event.button !== 0 || readOnly) return
              event.stopPropagation()
              onZoneDown?.(zone.id, event)
            }}
          />
        ))}

        {zones.map((zone) => (selectedZones.has(zone.id)
          ? zone.outline.map((point, index) => (
            <circle
              key={`${zone.id}-v${index}`}
              cx={point.x * USER}
              cy={point.y * USER}
              r={seatRadius(view.zoom) * 0.8}
              className="map-zone__vertex"
              onPointerDown={(event) => {
                if (event.button !== 0 || readOnly) return
                event.stopPropagation()
                onVertexDown?.(zone.id, index, point)
              }}
            />
          ))
          : null))}

        {stage && (
          <polygon
            points={polygonPoints(stage.outline)}
            className="map-stage"
            aria-label={`Escenario${stage.label ? ` ${stage.label}` : ''}`}
          />
        )}

        {draft?.kind === 'rect' && (
          <rect
            className="map-draft"
            x={Math.min(draft.from.x, draft.to.x) * USER}
            y={Math.min(draft.from.y, draft.to.y) * USER}
            width={Math.abs(draft.to.x - draft.from.x) * USER}
            height={Math.abs(draft.to.y - draft.from.y) * USER}
          />
        )}
        {draft?.kind === 'polygon' && draft.points.length >= 2 && (
          <polyline className="map-draft" points={polygonPoints(draft.points)} />
        )}
        {stage && !readOnly && tool === TOOLS.STAGE && (
          <text x={USER / 2} y={40} className="map-canvas__hint" textAnchor="middle">
            Arrastra para dibujar el escenario
          </text>
        )}

        {seats.map((seat) => (
          <g
            key={seat.id}
            className={[
              'map-seat',
              selectedSeats.has(seat.id) ? 'map-seat--selected' : '',
              badSeats.has(seat.id) ? 'map-seat--error' : '',
            ].filter(Boolean).join(' ')}
            transform={`translate(${seat.position.x * USER} ${seat.position.y * USER}) rotate(${seat.rotation ?? 0})`}
            onPointerDown={(event) => {
              if (event.button !== 0 || readOnly) return
              event.stopPropagation()
              onSeatDown?.(seat, event)
            }}
          >
            <circle r={seatRadius(view.zoom)} className="map-seat__dot" />
            {showLabels && <text className="map-seat__label" y={-seatRadius(view.zoom) - 2} textAnchor="middle">{seat.label}</text>}
          </g>
        ))}

        {ghostSeats.map((seat) => (
          <circle
            key={seat.id ?? `${seat.position.x}-${seat.position.y}`}
            cx={clamp01(seat.position.x) * USER}
            cy={clamp01(seat.position.y) * USER}
            r={seatRadius(view.zoom)}
            className={seat.invalid ? 'map-seat--ghost map-seat--ghost-invalid' : 'map-seat--ghost'}
          />
        ))}
      </g>
    </svg>
  )
}

export default MapCanvas
