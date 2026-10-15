/* global global */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import { authenticateMockPartner } from '../src/auth/mockAuth.js'
import { persistToken } from '../src/auth/token.js'

// Compile the actual JSX components using the project's existing Vite compiler.
// Absolute imports let Node evaluate the result without writing generated files.
const require = createRequire(import.meta.url)
async function compileComponent(url) {
  const { code } = await transformWithOxc(await readFile(url, 'utf8'), url.pathname, {
    jsx: { runtime: 'automatic' },
  })
  let resolved = code
  for (const match of code.matchAll(/from (['"])([^'"]+)\1/g)) {
    const specifier = match[2]
    let target
    if (specifier.startsWith('.')) {
      const dependency = new URL(specifier, url)
      target = dependency.pathname.endsWith('.jsx') ? await compileComponent(dependency) : dependency.href
    } else target = pathToFileURL(require.resolve(specifier)).href
    resolved = resolved.replace(match[0], `from ${JSON.stringify(target)}`)
  }
  return `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
}

async function loadComponent(name) {
  return (await import(await compileComponent(new URL(`../src/components/${name}.jsx`, import.meta.url)))).default
}

global.window = { localStorage: { setItem() {}, removeItem() {}, getItem() { return null } } }
const Header = await loadComponent('Header')
const VenueCard = await loadComponent('VenueCard')
const EventRegisterForm = await loadComponent('EventRegisterForm')
const PartnerRegister = await loadComponent('PartnerRegister')
const PartnerSignIn = await loadComponent('PartnerSignIn')
const OrganizerEventList = await loadComponent('OrganizerEventList')
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props))

test('event list renders metadata, venue names, pagination and future detail links', () => {
  const props = {
    events: [{ id: 'event-a', name: 'Muse Tour', artist: 'Muse', status: 'Scheduled', venue_id: 'venue-a', schedules: [{ id: 'schedule', starts_at: '2099-12-01T20:00:00Z' }] }],
    venues: [{ id: 'venue-a', name: 'Arena A' }], page: 2, totalPages: 3, totalItems: 25,
  }
  const html = render(OrganizerEventList, props)
  for (const text of ['Muse Tour', 'Muse', 'Programado', 'Arena A', 'Página 2 de 3', '25 eventos']) assert.ok(html.includes(text))
  assert.match(html, /dateTime="2099-12-01T20:00:00Z"/)
  assert.match(html, /href="\/events\/event-a"/)
  assert.match(html, /href="\/events\/register"/)
  assert.doesNotMatch(html, /disabled=""/)
  const firstPage = render(OrganizerEventList, { ...props, page: 1 })
  assert.match(firstPage, /disabled="">Anterior/)
  const lastPage = render(OrganizerEventList, { ...props, page: 3 })
  assert.match(lastPage, /disabled="">Siguiente/)
})

test('list handles loading, failure, empty and missing venue states independently', () => {
  assert.match(render(OrganizerEventList, { loading: true }), /Cargando eventos/)
  assert.match(render(OrganizerEventList, { error: 'Offline' }), /Reintentar/)
  assert.match(render(OrganizerEventList), /Aún no tienes eventos/)
  const props = { events: [{ id: 'event-a', name: 'Concert', status: 'Scheduled', venue_id: 'missing', schedules: [] }], venueError: 'Catálogo no disponible' }
  const html = render(OrganizerEventList, props)
  assert.match(html, /Concert/)
  assert.match(html, /Recinto no disponible/)
  assert.match(html, /Fecha por confirmar/)
  assert.match(html, /Reintentar recintos/)
  assert.doesNotMatch(html, /No pudimos cargar tus eventos/)
  assert.doesNotMatch(render(OrganizerEventList, { ...props, loading: true }), /Concert/)
  assert.doesNotMatch(render(OrganizerEventList, { ...props, error: 'Offline' }), /Concert/)
})

test('registration UI has username, passwords and invitation without a role selector', () => {
  const html = render(PartnerRegister)
  for (const field of ['username', 'password', 'confirmPassword', 'invitationCode']) assert.match(html, new RegExp(`name="${field}"`))
  assert.doesNotMatch(html, /name="role"|name="email"|<select/)
  const inputNames = [...html.matchAll(/<input[^>]*\bname="([^"]+)"/g)].map((match) => match[1]).sort()
  assert.deepEqual(inputNames, ['confirmPassword', 'invitationCode', 'password', 'username'])
  assert.doesNotMatch(html, /type="(?:hidden|radio|checkbox)"/)
  assert.match(html, /El código de invitación determina el tipo de cuenta/)
  assert.match(html, /autoComplete="new-password"/)
  assert.match(html, /minLength="8"/)
  assert.match(html, /aria-describedby="password-minimum"/)
  assert.match(html, /id="password-minimum" aria-live="polite"/)
  assert.doesNotMatch(html, /aria-invalid="true"/)
  const login = render(PartnerSignIn)
  assert.match(login, /name="username"/)
  assert.doesNotMatch(login, /type="email"/)
  assert.match(login, /href="\/register"/)
})

test('header follows the active role and hides owner actions from organizers', () => {
  persistToken(authenticateMockPartner('organizer@example.com', 'Backstage123!'))
  const organizerHeader = render(Header, { isRegisterRoute: false })
  assert.match(organizerHeader, /Mis eventos/)
  assert.match(organizerHeader, /Registrar evento/)
  assert.doesNotMatch(organizerHeader, /Registrar recinto|Mis recintos/)
  persistToken(authenticateMockPartner('owner@example.com', 'Backstage123!'))
  const ownerHeader = render(Header, { isRegisterRoute: false })
  assert.match(ownerHeader, /Mis recintos/)
  assert.match(ownerHeader, /Registrar recinto/)
  assert.doesNotMatch(ownerHeader, /Mis eventos/)
  assert.doesNotMatch(ownerHeader, /Registrar evento/)
  persistToken(null)
})

test('event form shows the complete supplied venue catalogue and handles unavailable states', () => {
  const props = {
    catalogue: { venues: [{ id: 'venue-a', name: 'Arena A', ownerId: 'owner-a' }, { id: 'venue-b', name: 'Arena B', ownerId: 'owner-b' }], loading: false, error: '' },
    submission: { pending: false, fields: {}, error: '', confirmation: null },
    onSubmit() {}, onReload() {},
  }
  const html = render(EventRegisterForm, props)
  assert.match(html, /Arena A/)
  assert.match(html, /Arena B/)
  assert.match(html, /datetime-local/)
  assert.doesNotMatch(html, /name="organizer_id"|name="role"/)
  assert.match(render(EventRegisterForm, { ...props, catalogue: { venues: [], loading: true, error: '' } }), /Cargando recintos/)
  assert.match(render(EventRegisterForm, { ...props, catalogue: { venues: [], loading: false, error: 'Catálogo no disponible' } }), /Reintentar catálogo/)
  assert.match(render(EventRegisterForm, { ...props, catalogue: { venues: [], loading: false, error: '' } }), /Aún no hay recintos/)
  assert.match(render(EventRegisterForm, { ...props, submission: { ...props.submission, pending: true } }), /Registrando/)
  const confirmed = render(EventRegisterForm, { ...props, submission: { ...props.submission, confirmation: { name: 'Stored event', artist: 'Muse', date: '2099-12-01T20:00:00Z', venue_id: 'venue-b' } } })
  assert.match(confirmed, /Evento registrado/)
  assert.match(confirmed, /Stored event/)
  assert.match(confirmed, /Arena B/)
  assert.doesNotMatch(confirmed, /<form/)
})

test('actual venue cards show mutation controls only to their current owner', () => {
  const venue = { name: 'Arena', ownerId: '22222222-2222-2222-2222-222222222222' }
  persistToken(authenticateMockPartner('owner@example.com', 'Backstage123!'))
  assert.match(render(VenueCard, { venue }), /Editar Arena/)
  assert.match(render(VenueCard, { venue }), /Eliminar Arena/)
  assert.doesNotMatch(render(VenueCard, { venue: { ...venue, ownerId: 'another-owner' } }), /Editar Arena|Eliminar Arena/)
  persistToken(authenticateMockPartner('organizer@example.com', 'Backstage123!'))
  assert.doesNotMatch(render(VenueCard, { venue }), /Editar Arena|Eliminar Arena/)
  persistToken(null)
  assert.doesNotMatch(render(VenueCard, { venue }), /Editar Arena|Eliminar Arena/)
})
