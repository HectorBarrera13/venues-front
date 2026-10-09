import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPasswordError, validatePartnerPasswords } from '../src/auth/passwordPolicy.js'
import { createPartnerRegistrationPayload } from '../src/auth/partnerRegistration.js'
import { registerMockPartner } from '../src/auth/mockRegistration.js'
import { getMockSession, signInMockPartner } from '../src/auth/mockAuth.js'

test('password validation rejects missing/short values and accepts eight characters', () => {
  for (const value of [undefined, null, 12345678, '', '1234567']) assert.equal(typeof getPasswordError(value), 'string')
  for (const value of ['12345678', 'abcdefgh', 'ABCDEFGH', 'longer password']) assert.equal(getPasswordError(value), undefined)
})

test('confirmation errors update when either password field changes', () => {
  assert.ok(validatePartnerPasswords('abcdefgh', '').confirmPassword)
  assert.ok(validatePartnerPasswords('abcdefgh', 'abcdefgH').confirmPassword)
  assert.deepEqual(validatePartnerPasswords('abcdefgh', 'abcdefgh'), {})
  assert.ok(validatePartnerPasswords('changed-password', 'abcdefgh').confirmPassword)
  assert.deepEqual(validatePartnerPasswords('changed-password', 'changed-password'), {})
})

test('registration preserves whitespace/case and excludes confirmation from its payload', () => {
  const password = ' Abcdef '
  const payload = createPartnerRegistrationPayload({
    username: 'partner', password, confirmPassword: password, invitationCode: 'K7PX-3MZQ-9HTA',
  })
  assert.equal(payload.password, password)
  assert.equal(Object.hasOwn(payload, 'confirmPassword'), false)
  assert.throws(() => createPartnerRegistrationPayload({
    username: 'partner', password, confirmPassword: password.trim(), invitationCode: 'K7PX-3MZQ-9HTA',
  }), (error) => Boolean(error.fields.confirmPassword))
})

test('invalid passwords block direct mock registration without consuming the invitation', async () => {
  const base = { username: 'length_boundary', invitationCode: 'K7PX-3MZQ-9HTA' }
  for (const password of [undefined, null, 12345678, '1234567']) {
    await assert.rejects(registerMockPartner({ ...base, password }), (error) => error.status === 400 && Boolean(error.fields.password))
  }
  const result = await registerMockPartner({ ...base, password: 'abcdefgh' })
  assert.equal(result.username, base.username)
  assert.equal(getMockSession(await signInMockPartner(base.username, 'abcdefgh')).role, 'ORGANIZER')
})
