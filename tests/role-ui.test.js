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
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props))

test('header follows the active role and hides owner actions from organizers', () => {
  persistToken(authenticateMockPartner('organizer@example.com', 'Backstage123!'))
  const organizerHeader = render(Header, { isRegisterRoute: false })
  assert.match(organizerHeader, /Mis eventos/)
  assert.doesNotMatch(organizerHeader, /Registrar recinto|Mis recintos/)
  persistToken(authenticateMockPartner('owner@example.com', 'Backstage123!'))
  const ownerHeader = render(Header, { isRegisterRoute: false })
  assert.match(ownerHeader, /Mis recintos/)
  assert.match(ownerHeader, /Registrar recinto/)
  assert.doesNotMatch(ownerHeader, /Mis eventos/)
  persistToken(null)
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
