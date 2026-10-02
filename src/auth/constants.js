// Single place where the names this app shares with the backend are declared:
// role values, JWT claim names, where the token lives and where sign-in is.
// Anything that needs to know a role or a claim reads it from here instead of
// hardcoding the string, so a backend rename is a one-file change.

/** Role values the backend puts in the `role` claim. */
export const ROLES = Object.freeze({
  VENUE_OWNER: 'VENUE_OWNER',
  ORGANIZER: 'ORGANIZER',
})

/** JWT claim names read from the access token (decoded, never verified). */
export const CLAIMS = Object.freeze({
  USER_ID: 'sub',
  ROLE: 'role',
  EXPIRES_AT: 'exp',
  DISPLAY_NAME: 'name',
  EMAIL: 'email',
})

/**
 * Provisional token source: nothing stores the token yet (the auth team's work
 * is not in this repo), so until it lands, setToken() / localStorage under this
 * key / VITE_DEV_TOKEN are the only ways a session exists here.
 */
export const TOKEN_STORAGE_KEY = 'ds-aster.access-token'

/**
 * Where the app sends people whose session is missing or expired.
 *
 * Empty on purpose: the sign-in screen belongs to the auth team and does not
 * exist yet, so navigating would dead-end. While it is empty the screens show
 * the "sesión expiró" message instead of redirecting; set it to '/sign-in'
 * (and only that) once that route lands and every redirect starts working.
 */
export const SIGN_IN_PATH = ''
