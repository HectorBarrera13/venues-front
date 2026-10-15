/* global global */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSessionRedirect } from '../src/auth/redirects.js'
import { authenticateMockPartner, getMockSession } from '../src/auth/mockAuth.js'
import { getSession, goToSignIn } from '../src/auth/session.js'
import { getSessionSnapshot, subscribeToSession } from '../src/auth/sessionStore.js'
import { getToken, persistToken, setToken } from '../src/auth/token.js'
import { TOKEN_STORAGE_KEY } from '../src/auth/constants.js'

const storage = new Map()
const history = []
let notifications = 0
global.PopStateEvent = class { constructor(type) { this.type = type } }
global.window = {
  location: { pathname: '/events' },
  history: { replaceState(_state, _title, path) {
    history.push(path)
    window.location.pathname = path
  } },
  dispatchEvent(event) { assert.equal(event.type, 'popstate'); notifications += 1 },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}

test('direct links and history navigation require login without a session', () => {
  for (const path of ['/', '/events', '/events/register', '/events/123/edit', '/venues/register', '/unknown']) {
    assert.equal(getSessionRedirect(path, null), '/login')
  }
  assert.equal(getSessionRedirect('/login', null), null)
})

test('malformed, unknown and expired credentials redirect to login', () => {
  for (const token of ['bad-token', 'mock:unknown', `header.${btoa(JSON.stringify({ sub: 'owner', role: 'VENUE_OWNER', exp: 1 }))}.signature`]) {
    setToken(token)
    assert.equal(getSessionRedirect('/events', getSession()), '/login')
  }
  persistToken(null)
})

test('authenticated login redirects to the account home without a loop', () => {
  for (const email of ['organizer@example.com', 'owner@example.com']) {
    const session = getMockSession(authenticateMockPartner(email, 'Backstage123!'))
    const destination = email.startsWith('organizer') ? '/events' : '/'
    assert.equal(getSessionRedirect('/login', session), destination)
    assert.equal(getSessionRedirect(destination, session), null)
  }
})

test('server-rejected sessions are cleared and history is replaced only once', () => {
  persistToken(authenticateMockPartner('organizer@example.com', 'Backstage123!'))
  assert.equal(goToSignIn(), true)
  assert.equal(getToken(), null)
  assert.equal(storage.has(TOKEN_STORAGE_KEY), false)
  assert.equal(getSessionRedirect('/login', getSession()), null)
  assert.equal(goToSignIn(), false)
  assert.deepEqual(history, ['/login'])
  assert.equal(notifications, 1)
})

test('an active JWT session notifies subscribers at expiration', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 })
  const claims = { sub: 'owner', role: 'VENUE_OWNER', exp: (Date.now() + 40) / 1000 }
  setToken(`header.${btoa(JSON.stringify(claims))}.signature`)
  const before = getSessionSnapshot()
  assert.ok(before)
  assert.equal(getSessionSnapshot(), before)
  let notifications = 0
  const unsubscribe = subscribeToSession(() => { notifications += 1 })
  try {
    context.mock.timers.tick(39)
    assert.equal(notifications, 0)
    assert.equal(getSessionSnapshot(), before)
    context.mock.timers.tick(1)
    assert.equal(notifications, 1)
    assert.equal(getSessionSnapshot(), null)
    assert.equal(getSessionRedirect('/venues/register', getSessionSnapshot()), '/login')
  } finally {
    unsubscribe()
    persistToken(null)
  }
})
