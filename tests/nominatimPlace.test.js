import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  coordinatesOnlyPlace,
  toCountryCode,
  toOsmRef,
  toStreetAddress,
  toVenuePlace,
} from '../src/services/nominatimPlace.js'

// Trimmed real response of /reverse?format=jsonv2&addressdetails=1
const reverseResult = {
  place_id: 297654321,
  osm_type: 'way',
  osm_id: 24930346,
  lat: '20.9668237',
  lon: '-89.6234412',
  name: 'Teatro José Peón Contreras',
  display_name: 'Teatro José Peón Contreras, 545, Calle 60, Centro, Mérida, Yucatán, 97000, México',
  address: {
    theatre: 'Teatro José Peón Contreras',
    house_number: '545',
    road: 'Calle 60',
    neighbourhood: 'Centro',
    city: 'Mérida',
    state: 'Yucatán',
    postcode: '97000',
    country: 'México',
    country_code: 'mx',
  },
}

test('maps a full Nominatim result to the venue contract geography', () => {
  assert.deepEqual(toVenuePlace(reverseResult), {
    lat: 20.9668237,
    lng: -89.6234412,
    name: 'Teatro José Peón Contreras',
    address: 'Calle 60 545',
    city: 'Mérida',
    country: 'MX',
    externalId: '297654321',
    externalSource: 'nominatim',
    osmRef: 'way:24930346',
    displayName: reverseResult.display_name,
  })
})

test('osmRef uses the node:ID / way:ID / relation:ID format', () => {
  assert.equal(toOsmRef('node', 123), 'node:123')
  assert.equal(toOsmRef('way', '456'), 'way:456')
  assert.equal(toOsmRef('relation', 789), 'relation:789')
  assert.equal(toOsmRef('N', 1), 'node:1') // format=json letters
  assert.equal(toOsmRef('R', 2), 'relation:2')
})

test('missing osm_id or place_id stays null instead of being invented', () => {
  const place = toVenuePlace({ ...reverseResult, osm_id: undefined, place_id: undefined })
  assert.equal(place.osmRef, null)
  assert.equal(place.externalId, null)
  assert.equal(place.externalSource, null)
  assert.equal(toOsmRef('way', null), null)
  assert.equal(toOsmRef(undefined, 12), null)
  assert.equal(toOsmRef('area', 12), null)
  assert.equal(toOsmRef('node', 0), null)
})

test('city falls back through town, village and municipality', () => {
  const withTown = toVenuePlace({ address: { town: 'Progreso', country_code: 'mx' } })
  assert.equal(withTown.city, 'Progreso')
  const withVillage = toVenuePlace({ address: { village: 'Dzityá' } })
  assert.equal(withVillage.city, 'Dzityá')
  const withMunicipality = toVenuePlace({ address: { municipality: 'Umán' } })
  assert.equal(withMunicipality.city, 'Umán')
})

test('incomplete place leaves missing city, country and address as null', () => {
  const place = toVenuePlace({ lat: '19.4', lon: '-99.1', address: { state: 'CDMX' } })
  assert.equal(place.city, null)
  assert.equal(place.country, null)
  assert.equal(place.address, null)
  assert.equal(place.name, null)
  assert.equal(place.lat, 19.4)
  assert.equal(place.lng, -99.1)
})

test('street address works without a house number and with other way types', () => {
  assert.equal(toStreetAddress({ road: 'Paseo de Montejo' }), 'Paseo de Montejo')
  assert.equal(toStreetAddress({ pedestrian: 'Pasaje Revolución', house_number: '3' }), 'Pasaje Revolución 3')
  assert.equal(toStreetAddress({ house_number: '12' }), null)
  assert.equal(toStreetAddress(undefined), null)
})

test('country code is normalized to upper-case ISO alpha-2', () => {
  assert.equal(toCountryCode('es'), 'ES')
  assert.equal(toCountryCode('ESP'), null)
  assert.equal(toCountryCode(''), null)
  assert.equal(toCountryCode(undefined), null)
})

test('fallback coordinates are used when the result has none', () => {
  assert.deepEqual(coordinatesOnlyPlace(20.97, -89.59), {
    lat: 20.97,
    lng: -89.59,
    name: null,
    address: null,
    city: null,
    country: null,
    externalId: null,
    externalSource: null,
    osmRef: null,
    displayName: null,
  })
  const place = toVenuePlace({ lat: 'bad', lon: null }, { lat: 1, lng: 2 })
  assert.equal(place.lat, 1)
  assert.equal(place.lng, 2)
})
