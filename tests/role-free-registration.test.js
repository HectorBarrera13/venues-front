import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPartnerRegistrationPayload } from '../src/auth/partnerRegistration.js'
import { registerMockPartner } from '../src/auth/mockRegistration.js'
import { getMockSession, signInMockPartner } from '../src/auth/mockAuth.js'
import { canAccessRoute, canPerformAction } from '../src/auth/access.js'

const password = 'Demo1234'
const organizerCode = 'K7PX-3MZQ-9HTA'
const ownerCode = 'V7PX-3MZQ-9HTA'

test('registration payload excludes all caller-supplied role and identity metadata', () => {
  for (const role of ['ORGANIZER', 'VENUE_OWNER', 'FAN', 'ADMIN']) {
    const form = {
      username: 'partner', password, confirmPassword: password, invitationCode: organizerCode,
      role, roles: [role], userId: 'spoofed', id: 'spoofed', isAdmin: true,
      partner: { role }, claims: { role },
    }
    assert.deepEqual(createPartnerRegistrationPayload(form), {
      username: 'partner', password, invitationCode: organizerCode,
    })
  }
})

test('inherited role fields are excluded from the request too', () => {
  const form = Object.assign(Object.create({ role: 'ADMIN', isAdmin: true }), {
    username: 'partner', password, confirmPassword: password, invitationCode: ownerCode,
  })
  const payload = createPartnerRegistrationPayload(form)
  assert.equal(Object.hasOwn(payload, 'role'), false)
  assert.equal(Object.hasOwn(payload, 'isAdmin'), false)
  assert.deepEqual(Object.keys(payload).sort(), ['invitationCode', 'password', 'username'])
})

test('an organizer invitation cannot create an owner, even when bypassing form validation', async () => {
  const registered = await registerMockPartner({
    username: 'spoofed_organizer', password, invitationCode: organizerCode,
    role: 'VENUE_OWNER', userId: '22222222-2222-2222-2222-222222222222',
  })
  assert.equal(registered.role, 'ORGANIZER')
  assert.equal(registered.id, '11111111-1111-1111-1111-111111111111')
  const session = getMockSession(await signInMockPartner('spoofed_organizer', password))
  assert.equal(canAccessRoute(session, '/events'), true)
  assert.equal(canAccessRoute(session, '/venues/register'), false)
  assert.equal(canPerformAction(session, 'events.create'), true)
  assert.equal(canPerformAction(session, 'venues.create'), false)
})

test('an owner invitation cannot create an organizer or admin, even when bypassing the form', async () => {
  const registered = await registerMockPartner({
    username: 'spoofed_owner', password, invitationCode: ownerCode,
    role: 'ORGANIZER', roles: ['ADMIN'], isAdmin: true,
    userId: '11111111-1111-1111-1111-111111111111',
  })
  assert.equal(registered.role, 'VENUE_OWNER')
  assert.equal(registered.id, '22222222-2222-2222-2222-222222222222')
  const session = getMockSession(await signInMockPartner('spoofed_owner', password))
  assert.equal(canAccessRoute(session, '/'), true)
  assert.equal(canAccessRoute(session, '/events'), false)
  assert.equal(canPerformAction(session, 'venues.create'), true)
  assert.equal(canPerformAction(session, 'events.create'), false)
})
