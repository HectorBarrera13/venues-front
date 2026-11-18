// Front-side mirror of the seat map business rules (VEN-507 / docs/map-format.md §5).
// It shares only the payload shape with the backend validator (VEN-202): same codes,
// same grouping, same ordering. The backend stays the source of truth on save; this
// module exists to run live on every MapDocument change without freezing the UI.

/** R6a — two seat centres must be at least this far apart (normalized units). */
export const MIN_SEAT_DISTANCE = 0.005

const EPSILON = 1e-12

const lower = (value) => value.trim().toLowerCase()

/** A seat belongs to a zone only if its id exists; a missing zone skips R5 for it. */
const rowKey = (seat) => `${seat.row === null ? '\u0000null' : lower(seat.row)}|${lower(seat.label)}`

// ---------------------------------------------------------------------------
// Geometry on normalized points ({ x, y }).
// ---------------------------------------------------------------------------

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

function onSegment(a, b, point) {
  return Math.abs(cross(a, b, point)) <= EPSILON
    && Math.min(a.x, b.x) - EPSILON <= point.x && point.x <= Math.max(a.x, b.x) + EPSILON
    && Math.min(a.y, b.y) - EPSILON <= point.y && point.y <= Math.max(a.y, b.y) + EPSILON
}

/** Ray casting; the polygon ring is implicitly closed and its boundary counts as inside. */
function pointInPolygon(point, outline) {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]
    const b = outline[j]
    if (onSegment(b, a, point)) return true
    const straddles = (a.y > point.y) !== (b.y > point.y)
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function pointOnPolygonBoundary(point, outline) {
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    if (onSegment(outline[j], outline[i], point)) return true
  }
  return false
}

const pointStrictlyInside = (point, outline) => pointInPolygon(point, outline) && !pointOnPolygonBoundary(point, outline)

/** Two segments whose interiors meet at a single point (a transversal crossing). */
function segmentsProperlyCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON))
    && ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
}

const edges = (outline) => outline.map((point, index) => [point, outline[(index + 1) % outline.length]])

const boundingBox = (outline) => outline.reduce(
  (box, point) => ({
    minX: Math.min(box.minX, point.x), maxX: Math.max(box.maxX, point.x),
    minY: Math.min(box.minY, point.y), maxY: Math.max(box.maxY, point.y),
  }),
  { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
)

const boxesOverlap = (a, b) => !(a.maxX < b.minX - EPSILON || b.maxX < a.minX - EPSILON
  || a.maxY < b.minY - EPSILON || b.maxY < a.minY - EPSILON)

/**
 * R6b predicate: the interiors of two simple polygons intersect. Sharing an edge,
 * a vertex, or any other pure boundary touch is allowed.
 */
export function interiorsIntersect(first, second) {
  for (const [a1, a2] of edges(first)) {
    for (const [b1, b2] of edges(second)) {
      if (segmentsProperlyCross(a1, a2, b1, b2)) return true
    }
  }

  // A sample sitting exactly on the other polygon's boundary (shared/collinear edge):
  // nudge perpendicular to the sample's own edge and ask whether the interior side
  // of this polygon falls strictly inside the other one.
  const boundarySlideOverlaps = (mid, from, to, self, other) => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length < EPSILON) return false
    const perp = { x: -dy / length, y: dx / length }
    const probe = (sign) => ({ x: mid.x + perp.x * sign * 1e-6, y: mid.y + perp.y * sign * 1e-6 })
    return [1, -1].some((sign) => {
      const point = probe(sign)
      return pointInPolygon(point, self) && pointStrictlyInside(point, other)
    })
  }

  const samples = (outline, other) => {
    for (const [a, b] of edges(outline)) {
      for (const t of [0, 1 / 3, 2 / 3]) {
        const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        if (pointStrictlyInside(point, other)) return true
        if (pointOnPolygonBoundary(point, other) && boundarySlideOverlaps(point, a, b, outline, other)) return true
      }
    }
    return false
  }
  return samples(first, second) || samples(second, first)
}

// ---------------------------------------------------------------------------
// Rules. Output items have the shape of MapValidationErrors.errors[]; messages
// are display text and not part of the contract.
// ---------------------------------------------------------------------------

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

function overlappingSeatPairs(seats) {
  // Uniform grid bucketed at the threshold: each seat only meets its 3x3 neighbourhood.
  const cells = new Map()
  const pairs = []
  const cellOf = (value) => Math.floor(value / MIN_SEAT_DISTANCE)
  seats.forEach((seat, index) => {
    const cx = cellOf(seat.position.x)
    const cy = cellOf(seat.position.y)
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = cells.get(`${cx + dx}|${cy + dy}`)
        if (!bucket) continue
        for (const other of bucket) {
          const distance = Math.hypot(seat.position.x - other.seat.position.x, seat.position.y - other.seat.position.y)
          if (distance < MIN_SEAT_DISTANCE - EPSILON) pairs.push([other.index, index])
        }
      }
    }
    const key = `${cx}|${cy}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push({ seat, index })
  })
  return pairs.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
}

/**
 * Evaluates every rule and returns all violations at once (never fail-fast),
 * ordered by code catalogue position and then by payload order, per §4.3.
 */
export function validateMap(payload) {
  const stage = payload?.stage ?? null
  const zones = payload?.zones ?? []
  const seats = payload?.seats ?? []
  const errors = []
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]))

  if (stage === null || stage === undefined) {
    errors.push({ code: 'NO_STAGE', message: 'The map has no stage' })
  }

  const unnamed = zones.filter((zone) => !zone.name || !zone.name.trim())
  if (unnamed.length > 0) {
    errors.push({
      code: 'UNNAMED_ZONE',
      message: plural(unnamed.length, 'zone has', 'zones have') + ' no name',
      zoneIds: unnamed.map((zone) => zone.id),
    })
  }

  const seatCountByZone = new Map(zones.map((zone) => [zone.id, 0]))
  for (const seat of seats) {
    if (seatCountByZone.has(seat.zone)) seatCountByZone.set(seat.zone, seatCountByZone.get(seat.zone) + 1)
  }
  const empty = zones.filter((zone) => seatCountByZone.get(zone.id) === 0)
  if (empty.length > 0) {
    errors.push({
      code: 'EMPTY_ZONE',
      message: plural(empty.length, 'zone has', 'zones have') + ' no seats',
      zoneIds: empty.map((zone) => zone.id),
    })
  }

  const outsideZone = seats.filter((seat) => {
    const zone = zoneById.get(seat.zone)
    if (!zone) return true
    return !pointInPolygon(seat.position, zone.outline)
  })
  if (outsideZone.length > 0) {
    errors.push({
      code: 'SEAT_WITHOUT_ZONE',
      message: plural(outsideZone.length, 'seat is', 'seats are') + ' not inside a zone',
      seatIds: outsideZone.map((seat) => seat.id),
    })
  }

  // R5 only sees seats with an existing zone (a seat without a zone has no pair to clash).
  const byPair = new Map()
  seats.forEach((seat, index) => {
    if (!zoneById.has(seat.zone)) return
    const key = `${seat.zone}\u0000${rowKey(seat)}`
    if (!byPair.has(key)) byPair.set(key, { zone: zoneById.get(seat.zone), seats: [], firstIndex: index })
    byPair.get(key).seats.push(seat)
  })
  const duplicates = [...byPair.values()].filter((group) => group.seats.length > 1).sort((a, b) => a.firstIndex - b.firstIndex)
  for (const group of duplicates) {
    const [sample] = group.seats
    const pair = sample.row === null ? sample.label : `${sample.row}-${sample.label}`
    errors.push({
      code: 'DUPLICATE_LABEL',
      message: `Seat ${pair} appears ${group.seats.length} times in zone ${group.zone.id}`,
      seatIds: group.seats.map((seat) => seat.id),
      zoneIds: [group.zone.id],
    })
  }

  for (const [first, second] of overlappingSeatPairs(seats)) {
    errors.push({
      code: 'OVERLAP',
      message: `Seats ${seats[first].id} and ${seats[second].id} overlap`,
      seatIds: [seats[first].id, seats[second].id],
    })
  }

  for (let i = 0; i < zones.length; i += 1) {
    for (let j = i + 1; j < zones.length; j += 1) {
      if (!boxesOverlap(boundingBox(zones[i].outline), boundingBox(zones[j].outline))) continue
      if (interiorsIntersect(zones[i].outline, zones[j].outline)) {
        errors.push({
          code: 'OVERLAP',
          message: `Zones ${zones[i].id} and ${zones[j].id} overlap`,
          zoneIds: [zones[i].id, zones[j].id],
        })
      }
    }
  }

  return errors
}
