# Active MVP context

## Requirements and session decisions

The supplied product requirements are preserved here:

- [MVP 01 — Venue and Event Registration](mvp-01-venue-and-event-registration.md)
- [MVP 02 — Event Search and Purchase](mvp-02-event-search-and-purchase.md)

Both source documents are marked Draft, version 1.0. Their contents are product requirements; implementation status is recorded below. They narrow the broader long-term scope in `context/CONTEXT.md` and `context/architechture/arch.md`.

**Current user decisions:** Events and Venues share this frontend. Authentication is mocked for this integration stage. The PRDs describe JWT-based partner access; that production integration is deferred rather than considered implemented.

## MVP 01 — Partner registration

- Owners register a venue with mandatory name, description and free-text location.
- Organizers register an event with mandatory name, artist, valid calendar date and an existing venue selected from the complete venue catalogue.
- Records are attributable to the creating partner. Mock identity should come from the agreed session/provider, not an identity input in a form.
- Success persists the record and displays confirmation. Missing/invalid fields and nonexistent venues must be rejected.
- Role and session behavior uses the agreed mock for now.

## MVP 02 — Public search and purchase

- Unauthenticated visitors search by case-insensitive event-name substring only.
- Results show event name, artist, date and venue name; no matches is a normal empty state.
- Newly registered events become searchable within one minute.
- Details also show venue location and offer purchase.
- A mandatory full-name/email form issues exactly one persisted ticket per successful purchase.
- Repeated submission while processing must not issue duplicate tickets. Separate purchases by the same person remain valid and get different, globally unique codes.
- Confirmation displays event information, holder name and code immediately.

Search is owned by Error200; Booking by Sap-atitos. Their repositories/contracts have not been inspected. Shared partner views do not imply that the public fan journey is implemented here.

## Current implementation and gaps

Reviewed Events backend: `dsaster-event-management`, local `testing` checkout at `10fba4d`, including working-tree OpenAPI updates.

- POST registration, listing and detail retrieval exist; frontend Events integration is pending.
- Registration creates the event and schedule in a database transaction and returns `201` confirmation.
- Organizer identity is currently optional request data with a fixed fallback; align this with a backend mock provider.
- Real venue validation exists, but permissive mock validation is enabled by default. Verify the actual Venue API path and disable that mock for integration acceptance.
- Name search and synchronization to Search are not implemented in the inspected Events code.
- Reads provide venue IDs, not venue names/locations; enrich from the venue catalogue or agree an upstream projection.
- Backend dates require future RFC 3339 timestamps; the PRD only specifies valid calendar dates. Align semantics and error responses.
- Venue frontend uses a map/read-only address instead of the required free-text input; edit/delete changes are local only.

## Explicitly excluded

Seat maps, sections, rows, seats, capacity, categories, prices, on-sale scheduling, editing/deletion, media, analytics, payments, queues, holds/countdowns, email delivery, QR codes, fan accounts and ticket recovery after leaving confirmation are outside these MVPs.

## Next frontend work

Implement shared partner navigation/mock identity, organizer event registration with a fresh complete venue catalogue, Events client configuration and registration confirmation. Use [the API reference](../../docs/api.md) for available backend contracts. Resolve backend integration gaps separately; do not invent Search or Booking endpoints.
