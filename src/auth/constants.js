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

/** Token persisted by the frontend mock login. */
export const TOKEN_STORAGE_KEY = 'ds-aster.access-token'

/** Entry point for partners without a session. */
export const SIGN_IN_PATH = '/login'
