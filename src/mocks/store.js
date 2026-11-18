import { MAP_FIXTURES } from './fixtures.js'
import { haversineKm, normalizeText } from './contract.js'

/** Owner of the demo account in src/auth/mockAuth.js; use it as `sub` of the dev JWT. */
export const MOCK_OWNER_ID = '22222222-2222-2222-2222-222222222222'
export const OTHER_OWNER_ID = 'mock-owner-other'

const CLOCK_START = Date.parse('2026-01-01T09:00:00.000Z')

function seedVenues() {
  return [
    {
      name: 'Auditorio Nacional',
      description: 'Concert hall on Paseo de la Reforma',
      address: 'Paseo de la Reforma 50, Polanco',
      city: 'Ciudad de Mexico',
      country: 'MX',
      location: { lat: 19.4245, lng: -99.1951 },
      externalId: null,
      externalSource: null,
      osmRef: null,
      ownerId: MOCK_OWNER_ID,
      map: MAP_FIXTURES['valid-v1.json'],
    },
    {
      name: 'Estadio Azteca',
      description: 'Multi-purpose stadium',
      address: 'Calzada de Tlalpan 3465, Santa Ursula Coapa',
      city: 'Ciudad de Mexico',
      country: 'MX',
      location: { lat: 19.3029, lng: -99.1505 },
      externalId: '282893735',
      externalSource: 'nominatim',
      osmRef: 'way:24930346',
      ownerId: MOCK_OWNER_ID,
      map: null,
    },
    {
      name: 'Arena Monterrey',
      description: null,
      address: 'Av. Francisco I. Madero 2500',
      city: 'Monterrey',
      country: 'MX',
      location: { lat: 25.6802, lng: -100.2847 },
      externalId: null,
      externalSource: null,
      osmRef: null,
      ownerId: OTHER_OWNER_ID,
      map: null,
    },
  ]
}

/**
 * In-memory venue store. Ids and timestamps are sequential so every run of the
 * mock produces the same responses.
 */
export function createMockStore() {
  let venueCounter = 0
  let tick = 0
  const venues = new Map()
  const maps = new Map() // venueId -> MapVersion[]

  const nextTimestamp = () => new Date(CLOCK_START + (tick++) * 60_000).toISOString()

  function addVenue({ map, ...data }) {
    venueCounter += 1
    const venue = {
      id: `mock-venue-${venueCounter}`,
      ...data,
      description: data.description ?? null,
      latestMapVersion: 0,
      createdAt: nextTimestamp(),
    }
    venues.set(venue.id, venue)
    if (map) addMapVersion(venue.id, map)
    return venue
  }

  function addMapVersion(venueId, payload) {
    const venue = venues.get(venueId)
    const version = venue.latestMapVersion + 1
    const mapVersion = structuredClone({
      venueId,
      version,
      createdAt: nextTimestamp(),
      stage: payload.stage,
      zones: payload.zones,
      seats: payload.seats.map((seat) => ({ ...seat, rotation: seat.rotation ?? 0 })),
    })
    maps.set(venueId, [...(maps.get(venueId) ?? []), mapVersion])
    venue.latestMapVersion = version
    return mapVersion
  }

  function listVenues({ page, limit, filters }) {
    const matching = [...venues.values()].filter((venue) => {
      if (filters.near && haversineKm(filters.near, venue.location) > filters.near.radiusKm) return false
      if (filters.country && venue.country !== filters.country) return false
      if (filters.city && normalizeText(venue.city) !== normalizeText(filters.city)) return false
      if (filters.name && !normalizeText(venue.name).includes(normalizeText(filters.name))) return false
      return true
    })
    return {
      items: matching.slice((page - 1) * limit, page * limit),
      total: matching.length,
    }
  }

  function reset() {
    venueCounter = 0
    tick = 0
    venues.clear()
    maps.clear()
    seedVenues().forEach(addVenue)
  }

  reset()

  return {
    addVenue,
    addMapVersion,
    listVenues,
    reset,
    allVenues: () => [...venues.values()],
    findVenue: (id) => venues.get(id) ?? null,
    findByOsmRef: (osmRef) => [...venues.values()].find((venue) => venue.osmRef === osmRef) ?? null,
    findMap: (venueId, version) => {
      const versions = maps.get(venueId) ?? []
      return (version === undefined ? versions.at(-1) : versions.find((entry) => entry.version === version)) ?? null
    },
  }
}

export const mockStore = createMockStore()
export const resetMockStore = () => mockStore.reset()
