import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatVenueLocation, mapEditorPath } from '../src/services/venueFormat.js'

test('formats address, city and country of the venue contract', () => {
  assert.equal(
    formatVenueLocation({ address: 'Paseo de la Reforma 50', city: 'Ciudad de Mexico', country: 'MX', location: { lat: 19.4, lng: -99.1 } }),
    'Paseo de la Reforma 50, Ciudad de Mexico, MX',
  )
})

test('skips missing parts and keeps a locally edited text location', () => {
  assert.equal(formatVenueLocation({ city: 'Lima', country: 'PE' }), 'Lima, PE')
  assert.equal(formatVenueLocation({ location: ' Centro ' }), 'Centro')
  assert.equal(formatVenueLocation(null), '')
})

test('map editor path encodes the venue id', () => {
  assert.equal(mapEditorPath('abc123'), '/venues/abc123/map')
  assert.equal(mapEditorPath('a/b'), '/venues/a%2Fb/map')
})
