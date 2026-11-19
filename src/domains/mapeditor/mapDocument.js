// In-memory seat map state for the editor (VEN-501). This module is the internal
// contract between the editor UI and the tests: pure JavaScript, no React and no
// DOM. Shapes, ranges and ids follow the seat map contract (docs/map-format.md);
// every committed coordinate is normalized to [0, 1] with 4 decimals.

export const COORDINATE_DECIMALS = 4
export const MAX_ZONES = 200
export const MAX_SEATS = 50_000
export const OUTLINE_MIN_POINTS = 3
export const OUTLINE_MAX_POINTS = 200
export const MAX_LABEL_LENGTH = 32
export const MAX_ZONE_NAME_LENGTH = 100
export const MAX_STAGE_LABEL_LENGTH = 100

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const UNDO_LIMIT = 100

/** Half away from zero, matching `roundCoordinate` in the backend contract source. Never returns -0. */
export function roundCoordinate(value) {
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 10 ** COORDINATE_DECIMALS)) / 10 ** COORDINATE_DECIMALS
  return rounded === 0 ? 0 : rounded
}

export class MapDocumentError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'MapDocumentError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new MapDocumentError(code, message)
}

const clone = (value) => structuredClone(value)

function requirePoint(value, field) {
  if (typeof value !== 'object' || value === null) fail('INVALID_POINT', `Field "${field}" must be a point`)
  for (const axis of ['x', 'y']) {
    const coordinate = value[axis]
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || coordinate < 0 || coordinate > 1) {
      fail('POINT_OUT_OF_BOUNDS', `Field "${field}.${axis}" must be a number between 0 and 1`)
    }
  }
  return { x: roundCoordinate(value.x), y: roundCoordinate(value.y) }
}

function requireOutline(value, field) {
  if (!Array.isArray(value) || value.length < OUTLINE_MIN_POINTS || value.length > OUTLINE_MAX_POINTS) {
    fail('INVALID_OUTLINE', `Field "${field}" must be a list of ${OUTLINE_MIN_POINTS} to ${OUTLINE_MAX_POINTS} points`)
  }
  return value.map((entry, index) => requirePoint(entry, `${field}[${index}]`))
}

function requireText(value, max, field) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_TEXT', `Field "${field}" must be a non-blank string`)
  if (value.length > max) fail('INVALID_TEXT', `Field "${field}" must be at most ${max} characters`)
  return value
}

/** Row names follow spreadsheet order: A..Z, then AA..AZ, BA.. */
export function rowName(index) {
  let name = ''
  let rest = index
  while (rest >= 0) {
    name = String.fromCharCode((rest % 26) + 65) + name
    rest = Math.floor(rest / 26) - 1
  }
  return name
}

function nextRowName(name) {
  let value = 0
  for (const character of name.toUpperCase()) {
    if (character < 'A' || character > 'Z') fail('INVALID_ROW', `Row names must be letters, got "${name}"`)
    value = value * 26 + (character.charCodeAt(0) - 64)
  }
  return rowName(value)
}

function normalizeRotation(value, field) {
  if (value === undefined || value === null) return 0
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 360) {
    fail('INVALID_ROTATION', `Field "${field}" must be a number in [0, 360)`)
  }
  return value
}

/**
 * Raw grid for a block: positions before rounding, in seat order (row by row),
 * rotated clockwise around `origin`. Shared by `addBlock` and the editor's
 * live preview so the ghost and the committed seats can never drift apart.
 */
export function computeBlockPositions({
  origin,
  rows = 1,
  seatsPerRow = 1,
  spacing,
  rowSpacing = spacing,
  rotation = 0,
} = {}) {
  const angle = (rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const layout = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < seatsPerRow; column += 1) {
      const along = column * spacing
      const across = row * rowSpacing
      layout.push({
        row,
        column,
        position: {
          x: origin.x + along * cos - across * sin,
          y: origin.y + along * sin + across * cos,
        },
      })
    }
  }
  return layout
}

/**
 * Creates an empty document, or one seeded with `content` (already-validated
 * `{ stage, zones, seats }`). Use `loadMapDocument` to parse an unknown payload.
 */
export function createMapDocument(content = {}) {
  let state = {
    stage: content.stage ?? null,
    zones: clone(content.zones ?? []),
    seats: clone(content.seats ?? []),
  }
  const undoStack = []
  const redoStack = []
  /** Ids ever seen in this document; never reused, not even after undo or removal. */
  const seenIds = new Set()
  let sequence = 0

  for (const element of [...state.zones, ...state.seats]) seenIds.add(element.id)

  const nextId = (prefix) => {
    let id
    do {
      sequence += 1
      id = `${prefix}-${sequence.toString(36)}`
    } while (seenIds.has(id))
    seenIds.add(id)
    return id
  }

  const pushHistory = () => {
    undoStack.push(clone(state))
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    redoStack.length = 0
  }

  /** Runs `mutate(state)` on a draft; the change is committed or thrown away whole. */
  const transact = (mutate) => {
    const draft = clone(state)
    const result = mutate(draft)
    pushHistory()
    state = draft
    return result
  }

  const findSeat = (stateToSearch, id) => stateToSearch.seats.find((seat) => seat.id === id)
  const findZone = (stateToSearch, id) => stateToSearch.zones.find((zone) => zone.id === id)

  const requireSeat = (draft, id) => findSeat(draft, id) ?? fail('UNKNOWN_SEAT', `There is no seat "${id}"`)
  const requireZone = (draft, id) => findZone(draft, id) ?? fail('UNKNOWN_ZONE', `There is no zone "${id}"`)

  const makeSeat = (draft, input) => {
    if (draft.seats.length >= MAX_SEATS) fail('SEAT_LIMIT', `A map holds at most ${MAX_SEATS} seats`)
    const seat = {
      id: input.id ?? nextId('s'),
      label: requireText(input.label, MAX_LABEL_LENGTH, 'seat.label'),
      row: input.row ?? null,
      zone: input.zone ?? null,
      position: requirePoint(input.position, 'seat.position'),
      rotation: normalizeRotation(input.rotation, 'seat.rotation'),
    }
    if (seat.row !== null) requireText(seat.row, MAX_LABEL_LENGTH, 'seat.row')
    if (seat.zone !== null && !findZone(draft, seat.zone)) fail('UNKNOWN_ZONE', `There is no zone "${seat.zone}"`)
    if (input.id !== undefined && (seenIds.has(seat.id) || !ID_PATTERN.test(seat.id))) {
      fail('DUPLICATE_ID', `Id "${seat.id}" is not available in this map`)
    }
    seenIds.add(seat.id)
    return seat
  }

  const doc = {
    getStage: () => clone(state.stage),
    getZones: () => clone(state.zones),
    getSeats: () => clone(state.seats),
    getSeat: (id) => clone(findSeat(state, id) ?? null),

    /** Draws or replaces the stage. Accepts `{ outline, label }` or a bare outline. */
    setStage(stage) {
      const outline = Array.isArray(stage) ? stage : stage?.outline
      const label = Array.isArray(stage) ? null : stage?.label ?? null
      if (label !== null && label !== undefined) requireText(label, MAX_STAGE_LABEL_LENGTH, 'stage.label')
      return transact((draft) => {
        draft.stage = { label: label ?? null, outline: requireOutline(outline, 'stage.outline') }
        return doc.getStage()
      })
    },

    clearStage() {
      return transact((draft) => {
        draft.stage = null
        return null
      })
    },

    addSeat(input = {}) {
      return transact((draft) => {
        const seat = makeSeat(draft, input)
        draft.seats.push(seat)
        return clone(seat)
      })
    },

    /**
     * Generates a `rows × seatsPerRow` grid rotated `rotation` degrees clockwise
     * around `origin`, and commits it as ONE undoable action. Spacing between
     * columns is `spacing` and between rows `rowSpacing` (defaults to `spacing`),
     * all in normalized units. Throws POINT_OUT_OF_BOUNDS without committing if
     * any generated seat would leave [0, 1].
     */
    addBlock({
      origin,
      rows = 1,
      seatsPerRow = 1,
      spacing,
      rowSpacing = spacing,
      rotation = 0,
      zone = null,
      firstRow = 'A',
      firstNumber = 1,
    } = {}) {
      if (!Number.isInteger(rows) || rows < 1) fail('INVALID_BLOCK', '"rows" must be a positive integer')
      if (!Number.isInteger(seatsPerRow) || seatsPerRow < 1) fail('INVALID_BLOCK', '"seatsPerRow" must be a positive integer')
      if (rows * seatsPerRow > MAX_SEATS) fail('SEAT_LIMIT', `A block may not exceed ${MAX_SEATS} seats`)
      for (const [name, value] of [['spacing', spacing], ['rowSpacing', rowSpacing]]) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
          fail('INVALID_BLOCK', `"${name}" must be a positive number in normalized units`)
        }
      }
      const angle = normalizeRotation(rotation, 'block.rotation')
      const start = requirePoint(origin ?? {}, 'block.origin')
      if (zone !== null && !findZone(state, zone)) fail('UNKNOWN_ZONE', `There is no zone "${zone}"`)
      const layout = computeBlockPositions({
        origin: start, rows, seatsPerRow, spacing, rowSpacing, rotation: angle,
      })

      return transact((draft) => {
        const created = []
        let name = firstRow
        let lastRow = -1
        for (const item of layout) {
          if (item.row !== lastRow) {
            if (lastRow !== -1) name = nextRowName(name)
            lastRow = item.row
          }
          const position = requirePoint(item.position, `block.seats[${created.length}].position`)
          const seat = makeSeat(draft, {
            label: String(firstNumber + item.column),
            row: name,
            zone,
            position,
            rotation: angle,
          })
          draft.seats.push(seat)
          created.push(seat)
        }
        return clone(created)
      })
    },

    moveSeat(id, position) {
      return transact((draft) => {
        const seat = requireSeat(draft, id)
        seat.position = requirePoint(position ?? {}, 'seat.position')
        return clone(seat)
      })
    },

    /** Moves several seats by the same delta as ONE undoable action (group drag). */
    nudgeSeats(ids, delta) {
      return transact((draft) => {
        const moved = ids.map((id) => {
          const seat = requireSeat(draft, id)
          seat.position = requirePoint({ x: seat.position.x + delta.x, y: seat.position.y + delta.y }, `seat ${seat.id}`)
          return clone(seat)
        })
        return moved
      })
    },

    /** Edits the human-facing texts of a seat; untouched fields stay as they are. */
    renameSeat(id, { label, row } = {}) {
      return transact((draft) => {
        const seat = requireSeat(draft, id)
        if (label !== undefined) seat.label = requireText(label, MAX_LABEL_LENGTH, 'seat.label')
        if (row !== undefined) seat.row = row === null ? null : requireText(row, MAX_LABEL_LENGTH, 'seat.row')
        return clone(seat)
      })
    },

    rotateSeat(id, rotation) {
      return transact((draft) => {
        const seat = requireSeat(draft, id)
        seat.rotation = normalizeRotation(rotation, 'seat.rotation')
        return clone(seat)
      })
    },

    removeSeat(id) {
      return transact((draft) => {
        requireSeat(draft, id)
        draft.seats = draft.seats.filter((seat) => seat.id !== id)
        return null
      })
    },

    createZone({ name = '', outline, seats = [] } = {}) {
      const zoneOutline = requireOutline(outline, 'zone.outline')
      if (state.zones.length >= MAX_ZONES) fail('ZONE_LIMIT', `A map holds at most ${MAX_ZONES} zones`)
      return transact((draft) => {
        const zone = { id: nextId('z'), name, outline: zoneOutline }
        if (zone.name !== '') requireText(zone.name, MAX_ZONE_NAME_LENGTH, 'zone.name')
        draft.zones.push(zone)
        for (const seatId of seats) {
          requireSeat(draft, seatId).zone = zone.id
        }
        return clone(zone)
      })
    },

    renameZone(id, name) {
      requireText(name, MAX_ZONE_NAME_LENGTH, 'zone.name')
      return transact((draft) => {
        requireZone(draft, id).name = name
        return clone(findZone(draft, id))
      })
    },

    setZoneOutline(id, outline) {
      const nextOutline = requireOutline(outline, 'zone.outline')
      return transact((draft) => {
        requireZone(draft, id).outline = nextOutline
        return clone(findZone(draft, id))
      })
    },

    assignToZone(seatId, zoneId) {
      return doc.moveToZone([seatId], zoneId)
    },

    /** Reassigns seats to another zone (or detaches them with `null`) in one action. */
    moveToZone(seatIds, zoneId) {
      if (zoneId !== null && !findZone(state, zoneId)) fail('UNKNOWN_ZONE', `There is no zone "${zoneId}"`)
      return transact((draft) => {
        for (const seatId of seatIds) requireSeat(draft, seatId).zone = zoneId
        return clone(seatIds)
      })
    },

    /** Deletes a zone. Its seats are detached by default so they become detectable. */
    removeZone(id, { releaseSeats = true } = {}) {
      return transact((draft) => {
        requireZone(draft, id)
        if (!releaseSeats && draft.seats.some((seat) => seat.zone === id)) {
          fail('ZONE_NOT_EMPTY', `Zone "${id}" still has seats; move them first or set releaseSeats`)
        }
        draft.zones = draft.zones.filter((zone) => zone.id !== id)
        for (const seat of draft.seats) if (seat.zone === id) seat.zone = null
        return null
      })
    },

    /** Payload ready for POST /venues/{id}/map (contract shape, 4-decimal coordinates). */
    serialize() {
      return {
        stage: state.stage === null ? null : { label: state.stage.label, outline: clone(state.stage.outline) },
        zones: state.zones.map((zone) => ({
          id: zone.id,
          name: zone.name,
          outline: zone.outline.map((point) => ({ x: roundCoordinate(point.x), y: roundCoordinate(point.y) })),
        })),
        seats: state.seats.map((seat) => {
          const payload = {
            id: seat.id,
            label: seat.label,
            row: seat.row,
            zone: seat.zone,
            position: { x: roundCoordinate(seat.position.x), y: roundCoordinate(seat.position.y) },
          }
          if (seat.rotation !== 0) payload.rotation = seat.rotation
          return payload
        }),
      }
    },

    /** Replaces the whole document with a (re-parsed) payload. Resets history. */
    load(json) {
      const parsed = parsePayload(json)
      for (const element of [...parsed.zones, ...parsed.seats]) seenIds.add(element.id)
      state = parsed
      undoStack.length = 0
      redoStack.length = 0
      return doc
    },

    undo() {
      if (undoStack.length === 0) return false
      redoStack.push(clone(state))
      state = undoStack.pop()
      return true
    },

    redo() {
      if (redoStack.length === 0) return false
      undoStack.push(clone(state))
      state = redoStack.pop()
      return true
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  }

  return doc
}

/** Structural parse of a MapPayload (the 400 layer of the contract); throws MapDocumentError. */
function parsePayload(json) {
  if (typeof json !== 'object' || json === null) fail('INVALID_PAYLOAD', 'The map must be an object')
  if (!Array.isArray(json.zones)) fail('INVALID_PAYLOAD', 'Field "zones" must be a list')
  if (!Array.isArray(json.seats)) fail('INVALID_PAYLOAD', 'Field "seats" must be a list')

  const ids = new Set()
  const takeId = (value, field) => {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
      fail('INVALID_ID', `Field "${field}" must match ^[A-Za-z0-9_-]{1,64}$`)
    }
    if (ids.has(value)) fail('DUPLICATE_ID', `Id "${value}" is used more than once`)
    ids.add(value)
    return value
  }

  const stage = json.stage === undefined || json.stage === null
    ? null
    : { label: json.stage.label ?? null, outline: requireOutline(json.stage.outline, 'stage.outline') }
  const zones = json.zones.map((zone, index) => ({
    id: takeId(zone?.id, `zones[${index}].id`),
    name: typeof zone?.name === 'string' ? zone.name : '',
    outline: requireOutline(zone?.outline, `zones[${index}].outline`),
  }))
  const seats = json.seats.map((seat, index) => {
    const label = requireText(seat?.label, MAX_LABEL_LENGTH, `seats[${index}].label`)
    return {
      id: takeId(seat?.id, `seats[${index}].id`),
      label,
      row: seat.row ?? null,
      zone: seat.zone ?? null,
      position: requirePoint(seat?.position, `seats[${index}].position`),
      rotation: normalizeRotation(seat?.rotation, `seats[${index}].rotation`),
    }
  })
  return { stage, zones, seats }
}

/** Builds a document from a saved MapPayload (GET /venues/{id}/map response or fixture). */
export function loadMapDocument(json) {
  return createMapDocument(parsePayload(json))
}
