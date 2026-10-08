/* global global */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authenticateMockPartner, getMockSession, getPartnerHome } from '../src/auth/mockAuth.js'
import { getSession } from '../src/auth/session.js'
import { getToken, persistToken, setToken, subscribeToToken } from '../src/auth/token.js'
import { TOKEN_STORAGE_KEY } from '../src/auth/constants.js'

const storage = new Map()
global.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}

test('mock sign-in derives role and destination from the account', () => {
  const organizer = getMockSession(authenticateMockPartner(' Organizer@Example.com ', 'Backstage123!'))
  assert.equal(organizer.userId, '11111111-1111-1111-1111-111111111111')
  assert.equal(organizer.role, 'ORGANIZER')
  assert.equal(getPartnerHome(organizer), '/events')
  const owner = getMockSession(authenticateMockPartner('owner@example.com', 'Backstage123!'))
  assert.equal(owner.role, 'VENUE_OWNER')
  assert.equal(getPartnerHome(owner), '/')
  assert.equal(getPartnerHome(null), '/login')
})

test('unknown credentials and unknown mock identities cannot establish a session', () => {
  assert.throws(() => authenticateMockPartner('organizer@example.com', 'wrong'))
  assert.throws(() => authenticateMockPartner('unknown@example.com', 'Backstage123!'))
  assert.throws(() => authenticateMockPartner('', ''))
  assert.equal(getMockSession('mock:33333333-3333-3333-3333-333333333333'), null)
})

test('persisted sign-in survives reload and sign-out clears all token sources', async () => {
  const token = authenticateMockPartner('organizer@example.com', 'Backstage123!')
  let notifications = 0
  const unsubscribe = subscribeToToken(() => { notifications += 1 })
  persistToken(token)
  assert.equal(getSession().role, 'ORGANIZER')
  assert.equal(storage.get(TOKEN_STORAGE_KEY), token)
  const reloaded = await import('../src/auth/token.js?reload')
  assert.equal(reloaded.getToken(), token)
  persistToken(null)
  assert.equal(getToken(), null)
  assert.equal(getSession(), null)
  assert.equal(storage.has(TOKEN_STORAGE_KEY), false)
  assert.equal((await import('../src/auth/token.js?logout')).getToken(), null)
  assert.equal(notifications, 2)
  unsubscribe()
})

test('sessions still support valid JWTs and reject expired JWTs', () => {
  const jwt = (claims) => `header.${btoa(JSON.stringify(claims))}.signature`
  setToken(jwt({ sub: 'existing-owner', role: 'VENUE_OWNER', name: 'Existing owner', exp: Date.now() / 1000 + 60 }))
  assert.equal(getSession().userId, 'existing-owner')
  setToken(jwt({ sub: 'existing-owner', role: 'VENUE_OWNER', exp: 1 }))
  assert.equal(getSession(), null)
  setToken(jwt({ sub: 'existing-owner', role: 'UNKNOWN' }))
  assert.equal(getSession(), null)
  setToken(jwt({ role: 'VENUE_OWNER' }))
  assert.equal(getSession(), null)
  persistToken(null)
})

test('blocked browser storage still permits in-memory sign-in and sign-out', () => {
  const originalStorage = window.localStorage
  window.localStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }
  try {
    persistToken(authenticateMockPartner('owner@example.com', 'Backstage123!'))
    assert.equal(getSession().role, 'VENUE_OWNER')
    persistToken(null)
    assert.equal(getSession(), null)
  } finally {
    window.localStorage = originalStorage
  }
})
