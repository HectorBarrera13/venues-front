# Surgical editor task

## Only writable target

- `backend/src/services/VenueService.js`
- `backend/tests/VenueService.test.js`

Do not modify AGENTS.md, .gitignore, or any file under .agents/**.

## Instructions

1. **Modify `backend/src/services/VenueService.js`**:
   - In `registerVenue(data, currentUser)`:
     - Remove the check `if (currentUser?.role !== 'venue_owner') { throw new ApiError(403, 'Only venue owners can register venues'); }`.
     - Retain field validation for `name`, `description`, and `location` (throws `ApiError(400, 'Field "${field}" is required')` when missing or blank).
     - Resolve `ownerId`:
       ```javascript
       const ownerId = currentUser?.userId || currentUser?.id || data?.ownerId || 'venue-owner-1';
       ```
     - Create and save the venue:
       ```javascript
       const { name, description, location } = data;
       const venue = new Venue(name.trim(), description.trim(), location.trim(), ownerId);
       return this.venueRepository.save(venue);
       ```
     - Update JSDoc to reflect that `currentUser` is optional and remove the `@throws {ApiError} 403` annotation.

2. **Modify `backend/tests/VenueService.test.js`**:
   - Import `ApiError` from `../src/errors/ApiError` and `Venue` from `../src/entities/Venue`.
   - Add a `describe('registerVenue', () => { ... })` suite alongside the existing `describe('VenueService', ...)` (or within it):
     - Test registering a venue without `currentUser` (e.g. `registerVenue(data)`):
       - Sets `ownerId` to `'venue-owner-1'`.
       - Calls `venueRepository.save` with the Venue instance.
       - Returns the saved venue.
     - Test registering a venue with `currentUser`:
       - Sets `ownerId` to `currentUser.userId`.
     - Test registering a venue with `data.ownerId` when no `currentUser` is present:
       - Sets `ownerId` to `data.ownerId`.
     - Test validation failures:
       - Missing `name` throws `ApiError` with status 400.
       - Missing `description` throws `ApiError` with status 400.
       - Missing `location` throws `ApiError` with status 400.
     - Test that non-owner user (e.g. `{ role: 'organizer', userId: 'org-1' }`) does NOT throw 403 and successfully registers the venue.

## Mandatory behavior

1. Verify that `backend/src/services/VenueService.js` does not throw 403 for missing or non-owner user in `registerVenue`.
2. Verify that `backend/tests/VenueService.test.js` contains tests for `registerVenue`.
3. Verify that `backend/src/controllers/VenueController.js` remains intact.
4. Verify that `backend/tests/venues.routes.test.js` remains intact.
5. Do not perform any tests or verifications.
