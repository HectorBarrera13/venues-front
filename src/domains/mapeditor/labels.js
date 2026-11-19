// Seat label helpers (VEN-505). Auto-generation only ever touches seats whose
// label was never edited by hand: every manual `renameSeat` is recorded in the
// editor's manual-label set, and the renumber helpers skip those ids unless the
// caller opts in explicitly.

const NUMERIC = /^\d+$/

/** Next number for a loose (row-less) seat: one after the highest numeric label. */
export function nextLooseLabel(seats, zone = null) {
  let highest = 0
  for (const seat of seats) {
    if (seat.row === null && (zone === null || seat.zone === zone) && NUMERIC.test(seat.label)) {
      highest = Math.max(highest, Number(seat.label))
    }
  }
  return String(highest + 1)
}

/** Next letter after the highest single/double-letter row (A..Z, AA..). */
export function nextRowName(seats) {
  let highest = -1
  for (const seat of seats) {
    if (seat.row === null || !/^[A-Z]+$/i.test(seat.row.trim())) continue
    let value = 0
    for (const character of seat.row.trim().toUpperCase()) value = value * 26 + (character.charCodeAt(0) - 64)
    highest = Math.max(highest, value)
  }
  let rest = highest
  let name = ''
  while (rest >= 0) {
    name = String.fromCharCode((rest % 26) + 65) + name
    rest = Math.floor(rest / 26) - 1
  }
  return name || 'A'
}

/**
 * Renumber one row within one zone: 1..n in the seats' current payload order
 * (block rows are inserted in logical left-to-right order, rotation included).
 * Returns the list of {id, label} changes; ids in `manualIds` are skipped.
 */
export function renumberRow(seats, { row, zone = null, manualIds = new Set(), from = 1 } = {}) {
  const inRow = seats.filter((seat) => {
    const sameRow = row === null ? seat.row === null : (seat.row ?? '').trim().toUpperCase() === row.trim().toUpperCase()
    return sameRow && (zone === null || seat.zone === zone)
  })
  const changes = []
  inRow.forEach((seat, index) => {
    const label = String(from + index)
    if (seat.label !== label && !manualIds.has(seat.id)) changes.push({ id: seat.id, label })
  })
  return changes
}

/**
 * Renumber every row of every zone (rows are per zone+row pairs). Loose seats
 * (row null) keep their labels — they are placed by hand.
 */
export function renumberAllRows(seats, { manualIds = new Set() } = {}) {
  const groups = new Map()
  for (const seat of seats) {
    if (seat.row === null) continue
    const key = `${seat.zone}\u0000${seat.row.trim().toUpperCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(seat)
  }
  const changes = []
  for (const members of groups.values()) {
    for (const seat of members) {
      const index = members.indexOf(seat) + 1
      if (seat.label !== String(index) && !manualIds.has(seat.id)) changes.push({ id: seat.id, label: String(index) })
    }
  }
  return changes
}
