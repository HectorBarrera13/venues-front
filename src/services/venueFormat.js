/**
 * Human-readable location of a venue: "address, city, COUNTRY".
 *
 * The venue-service contract (VEN-003) exposes the address fields plus
 * `location: { lat, lng }`; the coordinates are not meant for display. A plain
 * string `location` (local edits in VenueEditModal) is returned as is.
 *
 * @param {{ address?: string, city?: string, country?: string, location?: unknown } | null | undefined} venue
 * @returns {string} Empty when the venue has no address data.
 */
export function formatVenueLocation(venue) {
  if (typeof venue?.location === 'string') return venue.location.trim()
  return [venue?.address, venue?.city, venue?.country]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .join(', ')
}
