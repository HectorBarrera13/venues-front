import { ROLES } from './constants.js'

export function getRouteRole(path) {
  if (path === '/' || path === '/venues' || path.startsWith('/venues/')) return ROLES.VENUE_OWNER
  if (path === '/events' || path.startsWith('/events/')) return ROLES.ORGANIZER
  return null
}

export function canAccessRoute(session, path) {
  const role = getRouteRole(path)
  return role !== null && session?.role === role
}

const ACTION_ROLES = Object.freeze({
  'venues.create': ROLES.VENUE_OWNER,
  'venues.update': ROLES.VENUE_OWNER,
  'venues.delete': ROLES.VENUE_OWNER,
  'events.create': ROLES.ORGANIZER,
  'events.update': ROLES.ORGANIZER,
})

// UI permissions only; owning services still authorize every request.
export function canPerformAction(session, action) {
  return Object.hasOwn(ACTION_ROLES, action) && session?.role === ACTION_ROLES[action]
}

export function canManageVenue(session, venue) {
  return canPerformAction(session, 'venues.update') && Boolean(session.userId)
    && session.userId === venue?.ownerId
}

export function canManageEvent(session, event) {
  return canPerformAction(session, 'events.update') && Boolean(session?.userId)
    && session.userId === event?.organizer_id
}
