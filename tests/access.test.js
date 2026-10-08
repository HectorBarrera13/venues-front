import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canAccessRoute, canManageVenue, canPerformAction, getRouteRole } from '../src/auth/access.js'
import { authenticateMockPartner, getMockSession } from '../src/auth/mockAuth.js'

const organizer = getMockSession(authenticateMockPartner('organizer@example.com', 'Backstage123!'))
const owner = getMockSession(authenticateMockPartner('owner@example.com', 'Backstage123!'))

test('organizers can access Events paths and cannot access Venue paths', () => {
  for (const path of ['/events', '/events/register', '/events/123/edit']) assert.equal(canAccessRoute(organizer, path), true)
  for (const path of ['/', '/venues', '/venues/register']) assert.equal(canAccessRoute(organizer, path), false)
})

test('owners can access Venue paths and cannot access Events paths', () => {
  for (const path of ['/', '/venues', '/venues/register']) assert.equal(canAccessRoute(owner, path), true)
  for (const path of ['/events', '/events/register', '/events/123/edit']) assert.equal(canAccessRoute(owner, path), false)
})

test('unknown paths and absent/unknown roles fail closed', () => {
  for (const path of ['/events-other', '/venues-other', '/unknown']) {
    assert.equal(getRouteRole(path), null)
    assert.equal(canAccessRoute(owner, path), false)
    assert.equal(canAccessRoute(organizer, path), false)
  }
  for (const session of [null, { role: 'FAN' }, { role: 'organizer' }]) {
    assert.equal(canAccessRoute(session, '/events'), false)
    assert.equal(canAccessRoute(session, '/'), false)
    assert.equal(canPerformAction(session, 'events.create'), false)
    assert.equal(canPerformAction(session, 'venues.create'), false)
  }
})

test('action permissions follow partner role and do not include Events deletion', () => {
  for (const action of ['events.create', 'events.update']) {
    assert.equal(canPerformAction(organizer, action), true)
    assert.equal(canPerformAction(owner, action), false)
  }
  for (const action of ['venues.create', 'venues.update', 'venues.delete']) {
    assert.equal(canPerformAction(owner, action), true)
    assert.equal(canPerformAction(organizer, action), false)
  }
  assert.equal(canPerformAction(organizer, 'events.delete'), false)
  assert.equal(canPerformAction(owner, 'toString'), false)
})

test('venue mutation permissions require the current owning partner', () => {
  const venue = { ownerId: owner.userId }
  assert.equal(canManageVenue(owner, venue), true)
  assert.equal(canManageVenue(organizer, venue), false)
  assert.equal(canManageVenue({ ...owner, userId: 'another-owner' }, venue), false)
  assert.equal(canManageVenue(null, venue), false)
  assert.equal(canManageVenue(owner, {}), false)
})
