import { ROLES } from './constants.js'
import { getRegisteredPartners, passwordDigest } from './mockPartnerStore.js'

// Frontend fixtures only. Events independently resolves the ID and role.
export const MOCK_ACCOUNTS = Object.freeze([
  Object.freeze({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'organizer@example.com',
    password: 'Backstage123!',
    name: 'Organizador demo',
    role: ROLES.ORGANIZER,
  }),
  Object.freeze({
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'owner@example.com',
    password: 'Backstage123!',
    name: 'Propietario demo',
    role: ROLES.VENUE_OWNER,
  }),
])

export function authenticateMockPartner(email, password) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const account = MOCK_ACCOUNTS.find(
    (candidate) => candidate.email === normalizedEmail && candidate.password === password,
  )
  if (!account) throw new Error('El usuario o la contraseña no son correctos.')
  return `mock:${account.userId}`
}

export async function signInMockPartner(username, password) {
  const normalizedUsername = username.trim().toLowerCase()
  const registered = getRegisteredPartners().find((account) => account.username === normalizedUsername)
  if (!registered) return authenticateMockPartner(username, password)
  if (await passwordDigest(password, registered.salt) !== registered.digest) {
    throw new Error('El usuario o la contraseña no son correctos.')
  }
  return `mock:${registered.userId}`
}

export function getMockSession(token) {
  const account = MOCK_ACCOUNTS.find((candidate) => token === `mock:${candidate.userId}`)
  if (!account) return null
  return Object.freeze({ token, userId: account.userId, role: account.role, name: account.name })
}

export function getPartnerHome(session) {
  if (session?.role === ROLES.ORGANIZER) return '/events'
  if (session?.role === ROLES.VENUE_OWNER) return '/'
  return '/login'
}
