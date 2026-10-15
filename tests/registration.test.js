import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPartnerRegistrationPayload, PartnerRegistrationError } from '../src/auth/partnerRegistration.js'
import { registerMockPartner } from '../src/auth/mockRegistration.js'
import { getMockSession, signInMockPartner } from '../src/auth/mockAuth.js'
import { getRegisteredPartners } from '../src/auth/mockPartnerStore.js'
import { getSessionRedirect } from '../src/auth/redirects.js'

const code = 'K7PX-3MZQ-9HTA'
const form = { username: ' invited_partner ', password: 'Demo1234', confirmPassword: 'Demo1234', invitationCode: ` ${code.toLowerCase()} ` }

test('registration builds only the documented request fields', () => {
  assert.deepEqual(createPartnerRegistrationPayload({ ...form, role: 'VENUE_OWNER', email: 'ignored@example.com' }), {
    username: 'invited_partner', password: 'Demo1234', invitationCode: code,
  })
})

test('required fields, password minimum and confirmation are validated', () => {
  for (const field of ['username', 'password', 'invitationCode']) {
    assert.throws(() => createPartnerRegistrationPayload({ ...form, [field]: '' }), (error) => error instanceof PartnerRegistrationError && Boolean(error.fields[field]))
  }
  assert.throws(() => createPartnerRegistrationPayload({ ...form, password: '1234567', confirmPassword: '1234567' }), (error) => Boolean(error.fields.password))
  assert.throws(() => createPartnerRegistrationPayload({ ...form, confirmPassword: 'different' }), (error) => Boolean(error.fields.confirmPassword))
})

test('invalid registration does not consume an invitation or reserve a username', async () => {
  await assert.rejects(registerMockPartner({ username: 'new-user', password: 'short', invitationCode: code }))
  await assert.rejects(registerMockPartner({ username: 'organizer@example.com', password: 'Demo1234', invitationCode: code }), (error) => error.status === 409)
  await assert.rejects(registerMockPartner({ username: 'new-user', password: 'Demo1234', invitationCode: 'unknown' }), (error) => error.status === 400)
  assert.equal(getRegisteredPartners().length, 0)
})

test('registration derives role from invitation and new credentials can sign in', async () => {
  const result = await registerMockPartner({ ...createPartnerRegistrationPayload(form), role: 'VENUE_OWNER' })
  assert.equal(result.role, 'ORGANIZER')
  assert.equal(result.id, '11111111-1111-1111-1111-111111111111')
  assert.deepEqual(Object.keys(result).sort(), ['id', 'role', 'username'])
  const token = await signInMockPartner('invited_partner', 'Demo1234')
  assert.equal(getMockSession(token).role, 'ORGANIZER')
  await assert.rejects(signInMockPartner('invited_partner', 'wrong'))
  assert.equal(Object.hasOwn(getRegisteredPartners()[0], 'password'), false)
  await assert.rejects(registerMockPartner({ username: 'invited_partner', password: 'Demo1234', invitationCode: code }), (error) => error.status === 409)
  await assert.rejects(registerMockPartner({ username: 'another-user', password: 'Demo1234', invitationCode: code }), (error) => error.status === 400)
})

test('concurrent submissions consume an owner invitation only once', async () => {
  const payload = { username: 'invited_owner', password: 'Demo1234', invitationCode: 'V7PX-3MZQ-9HTA' }
  const results = await Promise.allSettled([registerMockPartner(payload), registerMockPartner(payload)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(getMockSession(await signInMockPartner('invited_owner', 'Demo1234')).role, 'VENUE_OWNER')
})

test('registration is public and authenticated partners return to their home', () => {
  assert.equal(getSessionRedirect('/register', null), null)
  assert.equal(getSessionRedirect('/register', { role: 'ORGANIZER' }), '/events')
  assert.equal(getSessionRedirect('/register', { role: 'VENUE_OWNER' }), '/')
  assert.equal(getSessionRedirect('/events', null), '/login')
})
