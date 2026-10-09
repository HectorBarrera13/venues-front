# Active MVP context

## Requirements and session decisions

The supplied product requirements are preserved here:

- [MVP 01 — Venue and Event Registration](mvp-01-venue-and-event-registration.md)
- [MVP 02 — Event Search and Purchase](mvp-02-event-search-and-purchase.md)
- [MVP 03 — Partner Access contract reference](mvp-03-partner-access.md)

Both source documents are marked Draft, version 1.0. Their contents are product requirements; implementation status is recorded below. They narrow the broader long-term scope in `context/CONTEXT.md` and `context/architechture/arch.md`.

**Current user decisions:** Events and Venues share this frontend. Authentication is mocked for this integration stage. The PRDs describe JWT-based partner access; that production integration is deferred rather than considered implemented.

**Current implementation scope:** Events supports create, read, and update (CRU);
deletion is excluded. Frontend login is mocked, with organizers routed to Events
and venue owners routed to the existing Venue screen. Auth Service integration
and Venue backend changes are outside this work.

**T-098:** `/login` now provides fixed mock accounts and persistent sessions,
role-based landing destinations, and sign-out.
**T-098 compatibility follow-up:** The original `VITE_DEV_TOKEN` JWT source is
restored. Venue calls use a supplied JWT independently of the Events mock token;
mock credentials are not sent to Venue. Owner demo login uses the configured
owner JWT's identity when available. Sign-out suppresses the development fallback
across reloads, and explicit login re-enables it. No JWT is generated in the browser.
**T-094:** Protected Backstage paths require a session; `/login` and `/register` are public. Direct links and
history navigation redirect without mounting protected views. Invalid/expired
sessions return to login, and API rejection clears the credential before redirecting
to avoid a login loop. Active JWT expiry notifies the UI automatically; mock
sessions do not expire.
**T-092:** Organizer sessions can access the Events namespace; venue-owner
sessions can access the Venue namespace. Wrong-role direct links show access denied,
and unknown pages no longer fall back to Venue views. Venue create/edit/delete UI
actions are guarded, including handler checks and ownership for existing local
edit/delete actions. Event create/update permissions are defined for the upcoming
integration; no Event delete permission exists. Views reset when identity changes,
and responses from the previous session are discarded. Backend authorization
remains the owning service's responsibility.
**T-095:** `/register` now has username, password/confirmation and invitation code,
with a role-free request and frontend mock registration. Login accepts usernames.
Demo registrations map to existing backend fixture identities and last only until
page reload; production Auth communication is deferred. The current Ninjava
minimum is eight characters, with no documented character-class requirement.
**T-096:** Role-free registration is verified at the UI, payload, and mock adapter
boundaries. Explicit and inherited role/identity fields are excluded from the
payload. Direct mock calls ignore spoofed roles in both directions, and subsequent
login retains the invitation role. No real Auth backend enforcement is claimed;
production authorization remains with Ninjava.
**T-097:** Registration now provides live password/confirmation feedback after
interaction, rechecks confirmation when either value changes, and focuses the
first invalid field on submission. The form and mock adapter share the documented
eight-character minimum. Password values are preserved exactly; no character-class
requirements are added. Invalid registrations do not consume demo invitations.

**T-091:** Organizer event registration now lives at `/events/register`, with
refreshed Venue catalogue loading, required-field/calendar/future-time/UUID
validation, separate Events client configuration, and POST confirmation. Dates
are entered with an explicit time in the displayed browser timezone and sent as
UTC timestamps to match the existing backend. The frontend does not filter the
catalogue by owner. Venue backend catalogue visibility and credential acceptance
remain unverified. Events details/update integration remains pending.

**T-147:** `/events` now lists the current organizer's events with pagination,
metadata/status/date display, independently loaded venue names, and loading/empty/
retry states. Requests are cancelled on navigation/session changes, with old data
hidden while the new request is pending. Cards link to the forthcoming T-148 detail
route. Live browser verification is pending because localhost:5173 was unreachable
and the agent environment could not bind a development-server port.

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

- POST registration, listing and detail retrieval exist; frontend registration and listing are connected, while detail/update screens remain pending.
- Registration creates the event and schedule in a database transaction and returns `201` confirmation.
- Event creation derives organizer identity from `Bearer mock:<partner-uuid>` and rejects non-organizers; there is no request-body identity fallback in the current checkout.
- Real venue validation exists, but permissive mock validation is enabled by default. Verify the actual Venue API path and disable that mock for integration acceptance.
- Name search and synchronization to Search are not implemented in the inspected Events code.
- Reads provide venue IDs, not venue names/locations; enrich from the venue catalogue or agree an upstream projection.
- Backend dates require future RFC 3339 timestamps; the PRD only specifies valid calendar dates. Align semantics and error responses.
- Venue frontend uses a map/read-only address instead of the required free-text input; edit/delete changes are local only.

## Explicitly excluded

Seat maps, sections, rows, seats, capacity, categories, prices, on-sale scheduling, event deletion, venue editing/deletion, media, analytics, payments, queues, holds/countdowns, email delivery, QR codes, fan accounts and ticket recovery after leaving confirmation are outside this implementation. Event updating is explicitly included by the current user decision.

## Next frontend work

Verify live Venue catalogue access and Event registration, then implement organizer
event details and updating. Use [the API reference](../../docs/api.md) for
available backend contracts. Resolve backend integration gaps separately; do not
invent Search or Booking endpoints.
