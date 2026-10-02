import { TOKEN_STORAGE_KEY } from './constants.js'

// Everything that reads the access token goes through getToken() below, so
// where the token lives is a one-file decision. In order of preference:
// 1. setToken() — in-memory, so a session can be swapped without a reload
// 2. localStorage — survives the reload, the usual shape for a stored session
// 3. VITE_DEV_TOKEN — dev-only fallback for trying out a token from the backend
// Nothing here builds, refreshes or validates a session: that is the auth
// team's job, and an expired/invalid token simply fails here and at the API.

let tokenInMemory = null
const listeners = new Set()

function emitChange() {
  listeners.forEach((listener) => listener())
}

function readStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null // private mode / storage blocked — not a reason to break the app
  }
}

function readDevToken() {
  const devToken = import.meta.env.VITE_DEV_TOKEN
  return typeof devToken === 'string' && devToken.trim() ? devToken.trim() : null
}

function normalize(token) {
  return typeof token === 'string' && token.trim() ? token.trim() : null
}

/**
 * @returns {string | null} The raw access token, or null when there is none.
 */
export function getToken() {
  return normalize(tokenInMemory ?? readStoredToken() ?? readDevToken())
}

/**
 * @param {string | null} token - Token to use from now on, or null to forget it.
 */
export function setToken(token) {
  const nextToken = normalize(token)
  if (nextToken === tokenInMemory) return
  tokenInMemory = nextToken
  emitChange()
}

/**
 * Keeps localStorage and the in-memory token in sync with each other so a
 * reload doesn't resurrect a token that was just cleared.
 */
export function persistToken(token) {
  const nextToken = normalize(token)
  try {
    if (nextToken) window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Storage is unavailable; the in-memory copy still works for this page.
  }
  setToken(nextToken)
}

export function subscribeToToken(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
