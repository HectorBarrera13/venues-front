import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyPlaceToForm,
  countryOptions,
  initialVenueForm,
  isIsoCountryCode,
  apiFieldErrorMessage,
  revealRejectedPlaceFields,
  visiblePlaceFields,
  validateVenueForm,
} from '../src/services/venueForm.js'

const completePlace = {
  lat: 20.9694704,
  lng: -89.6222622,
  name: 'Teatro Peón Contreras',
  address: 'Calle 57 A',
  city: 'Mérida',
  country: 'MX',
  externalId: '307145549',
  externalSource: 'nominatim',
  osmRef: 'way:161291004',
  displayName: 'Teatro Peón Contreras, Calle 57 A, Centro, Mérida, Yucatán, 97000, México',
}

const withDescription = (form) => ({ ...form, description: 'Teatro histórico' })

test('a complete place prefills everything and asks for no manual field', () => {
  const form = applyPlaceToForm(initialVenueForm, completePlace)
  assert.equal(form.name, 'Teatro Peón Contreras')
  assert.equal(form.address, 'Calle 57 A')
  assert.equal(form.city, 'Mérida')
  assert.equal(form.country, 'MX')
  assert.equal(form.osmRef, 'way:161291004')
  assert.equal(form.externalId, '307145549')
  assert.equal(form.externalSource, 'nominatim')
  assert.deepEqual([form.lat, form.lng], [20.9694704, -89.6222622])
  assert.deepEqual(form.manualFields, [])
  assert.deepEqual(validateVenueForm(withDescription(form)), {})
})

test('a place without city shows and requires the city input', () => {
  const form = applyPlaceToForm(initialVenueForm, { ...completePlace, city: null })
  assert.deepEqual(form.manualFields, ['city'])
  assert.deepEqual(validateVenueForm(withDescription(form)), { city: 'La ciudad es obligatoria.' })
  assert.deepEqual(validateVenueForm(withDescription({ ...form, city: 'Mérida' })), {})
})

test('a coordinates-only place asks for address, city and country', () => {
  const form = applyPlaceToForm(initialVenueForm, {
    ...completePlace, name: null, address: null, city: null, country: null, osmRef: null, externalId: null, externalSource: null,
  })
  assert.deepEqual(form.manualFields, ['address', 'city', 'country'])
  assert.equal(form.name, '')
  const errors = validateVenueForm(withDescription({ ...form, name: 'Mi foro' }))
  assert.deepEqual(Object.keys(errors).sort(), ['address', 'city', 'country'])
})

test('nothing can be submitted without a picked point', () => {
  const errors = validateVenueForm(initialVenueForm)
  assert.deepEqual(Object.keys(errors).sort(), ['description', 'location', 'name'])
})

test('whitespace-only values count as empty', () => {
  const form = applyPlaceToForm(initialVenueForm, completePlace)
  const errors = validateVenueForm({ ...form, name: '  ', description: ' ', city: '   ' })
  assert.deepEqual(Object.keys(errors).sort(), ['city', 'description', 'name'])
})

test('country must be an ISO alpha-2 code', () => {
  const form = withDescription(applyPlaceToForm(initialVenueForm, completePlace))
  assert.match(validateVenueForm({ ...form, country: 'ESPA' }).country, /ISO/)
  assert.match(validateVenueForm({ ...form, country: 'ZZ' }).country, /ISO/)
  assert.deepEqual(validateVenueForm({ ...form, country: 'es' }), {})
  assert.equal(isIsoCountryCode('MX'), true)
  assert.equal(isIsoCountryCode('EU'), false)
})

test('an invalid country from the map is not prefilled and becomes manual', () => {
  const form = applyPlaceToForm(initialVenueForm, { ...completePlace, country: 'XX' })
  assert.equal(form.country, '')
  assert.deepEqual(form.manualFields, ['country'])
})

test('a name typed by the person is not overwritten by a later pick', () => {
  const picked = applyPlaceToForm(initialVenueForm, completePlace)
  const edited = { ...picked, name: 'Foro Peón' }
  const repicked = applyPlaceToForm(edited, { ...completePlace, name: 'Otro lugar' })
  assert.equal(repicked.name, 'Foro Peón')
})

test('an autofilled name follows the newly picked place', () => {
  const picked = applyPlaceToForm(initialVenueForm, completePlace)
  const repicked = applyPlaceToForm(picked, { ...completePlace, name: 'Gran Museo del Mundo Maya' })
  assert.equal(repicked.name, 'Gran Museo del Mundo Maya')
})

test('picking another place replaces the previous city and country', () => {
  const picked = applyPlaceToForm(initialVenueForm, completePlace)
  const manual = { ...applyPlaceToForm(picked, { ...completePlace, city: null }), city: 'Escrita a mano' }
  const repicked = applyPlaceToForm(manual, { ...completePlace, city: 'Madrid', country: 'ES' })
  assert.equal(repicked.city, 'Madrid')
  assert.equal(repicked.country, 'ES')
  assert.deepEqual(repicked.manualFields, [])
})

test('country options contain real countries sorted by Spanish name', () => {
  const options = countryOptions('es')
  const codes = options.map((option) => option.code)
  assert.ok(codes.includes('MX'))
  assert.ok(codes.includes('ES'))
  assert.ok(!codes.includes('EU'))
  assert.ok(!codes.includes('ZZ'))
  assert.ok(!codes.includes('YU')) // withdrawn
  assert.ok(codes.includes('XK')) // Kosovo, user-assigned but in common use
  assert.equal(options.find((option) => option.code === 'MX').name, 'México')
  const names = options.map((option) => option.name)
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'es')))
})

test('backend 400 messages become the same Spanish wording as the client validation', () => {
  assert.equal(apiFieldErrorMessage('city', 'Field "city" is required'), 'La ciudad es obligatoria.')
  assert.equal(apiFieldErrorMessage('name', 'Field "name" is required'), validateVenueForm(initialVenueForm).name)
  assert.match(apiFieldErrorMessage('country', 'Field "country" must be an ISO 3166-1 alpha-2 country code'), /ISO/)
  assert.equal(
    apiFieldErrorMessage('address', 'Field "address" must be at most 200 characters'),
    'La dirección admite como máximo 200 caracteres.',
  )
  assert.match(apiFieldErrorMessage('location', 'Field "lat" must be a number between -90 and 90'), /mapa/)
  assert.equal(apiFieldErrorMessage('unknown', 'whatever'), 'Revisa este campo.')
})

test('a rejected prefilled place field becomes a visible input', () => {
  const form = applyPlaceToForm(initialVenueForm, completePlace)
  assert.deepEqual(form.manualFields, [])
  const revealed = revealRejectedPlaceFields(form, { country: 'bad', name: 'bad', location: 'bad' })
  assert.deepEqual(revealed.manualFields, []) // the map did provide it
  assert.deepEqual(revealed.revealedFields, ['country'])
  assert.deepEqual(visiblePlaceFields(revealed), ['country'])
  assert.equal(revealed.country, 'MX') // keeps the value so the person can fix it
  assert.equal(revealRejectedPlaceFields(revealed, { country: 'bad' }), revealed) // no-op when already visible
  assert.deepEqual(applyPlaceToForm(revealed, completePlace).revealedFields, []) // a new pick starts over
})
