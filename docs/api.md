# API Reference

This document outlines the API Venue contracts consumed by `venues-front` and Events contracts available for frontend integration.

## Overview

The shared frontend integrates with `venue-service` and `dsaster-event-management`, directly or through the platform gateway. Event registration and organizer listing are connected. `VITE_API_BASE_URL` configures Venue; `VITE_EVENTS_API_BASE_URL` configures the Events origin, with `/api/v1/events` appended by the client.

- OpenAPI Specification: Maintained in the `venue-service` repository and published as `openapi.yml` with backend releases.

- Events Specification: `openapi.yml` in [dsaster-event-management](https://github.com/hjanssena/dsaster-event-management), generated with `cargo run --bin generate_openapi`. Contracts below were inspected on local `testing` at `10fba4d`, including its OpenAPI working-tree updates.
- Authentication is mocked for this stage; production JWT integration is deferred.

---

## Endpoints

### Partner access (frontend mock; future Ninjava integration)

The user-supplied Ninjava document specifies `POST /auth/register` with
`{ username, password, invitationCode }`, returning `{ id, username, role }` on
`201`. Role derives from the invitation; duplicate usernames return `409`, and
invalid/used invitation codes return `400`. Passwords require at least eight
characters. `POST /auth/login` takes `{ username, password }` and returns
`{ accessToken, tokenType, expiresIn }`. These endpoints are documented here for
alignment; the frontend currently uses its mock adapter rather than calling them.
See [the contract reference](../context/product/mvp-03-partner-access.md).

### 1. List Venues

Retrieves all physical venues registered in the system.

- Method: `GET`
- Path: `/venues`
- Headers:
  - `Accept: application/json`

#### Response

- Status: `200 OK`
- Body: Array of venue objects

```json
[
  {
    "id": "venue-101",
    "name": "Arena Ciudad",
    "description": "Main indoor arena for concerts and sports.",
    "location": "Avenida Reforma 100, CDMX",
    "ownerId": "venue-owner-1",
    "createdAt": "2026-03-15T12:00:00Z"
  }
]
```

---

### 2. Register Venue

Registers a new physical venue under the authenticated partner.

- Method: `POST`
- Path: `/venues`
- Headers:
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `Authorization: Bearer <token>` (existing Venue client behavior)

#### Request Body

```json
{
  "name": "Teatro Metropolitan",
  "description": "Historic theater with tiered seating.",
  "location": "Calle Independencia 90, CDMX"
}
```

> [!NOTE]
> The frontend does not submit `ownerId` or roles in the payload. It sends the
> supplied Venue JWT via `getVenueToken()` and never sends an Events mock token.
> Without a supplied JWT it omits Authorization. Venue backend validation and
> token acceptance have not been verified.

#### Responses

- `201 Created`: Returns the persisted venue entity.
- `400 Bad Request`: Missing or invalid fields (`name`, `description`, `location`).
- `401 Unauthorized`: Missing, expired, or invalid authentication token under the future JWT contract.
- `403 Forbidden`: Authenticated user does not have the `VENUE_OWNER` role.

---

### 3. Register Event

- Method: `POST`
- Path: `/api/v1/events` (runtime alias: `/events`)
- Headers: `Content-Type: application/json`, `Accept: application/json`, `Authorization: Bearer mock:<partner-uuid>` for the current Events mock verifier.

#### Request Body

```json
{
  "name": "Muse World Tour",
  "artist": "Muse",
  "date": "2027-12-01T02:00:00Z",
  "venue_id": "11111111-1111-4111-8111-111111111111"
}
```

Name and artist must be nonblank; date must be a future RFC 3339 timestamp; venue must be a UUID (`venueId` is also accepted). Optional fields are `description`, `terms`, `event_type` (default `Concert`), and `age_policy` (default `All ages`).

The backend resolves the organizer from the bearer token and requires the organizer
role. It has no request-body identity fallback. The frontend submits only name,
artist, UTC date/time, and venue ID.

#### Responses

- `201 Created`: Event and schedule are stored atomically. Confirmation includes `id`, `message`, `name`, `artist`, `date`, `venue_id`, `status` (`Scheduled`), and `created_at`.
- `400 Bad Request`: Blank name/artist or a non-future date, with `{ "error": "..." }`.
- `401 Unauthorized`: Missing/invalid token or an unknown partner.
- `403 Forbidden`: Authenticated partner is not an organizer.
- `422 Unprocessable Entity`: Venue is nonexistent/invalid (or payload extraction fails).
- `500 Internal Server Error`: Server/database failure.

Missing fields or malformed date/UUID values are rejected by Axum extraction; their response format needs alignment with the documented JSON errors. The PRD requires a valid calendar date, so the additional future-timestamp restriction also needs alignment.

### 4. List Events

- Method: `GET`
- Path: `/api/v1/events` (runtime alias: `/events`)
- Query: `page` (default 1), `per_page` (default 10, clamped to 1–100), `status`, `venue_id`, `organizer_id`, `id`.
- Response: `200` with `{ "items": [], "page": 1, "per_page": 10, "total_items": 0, "total_pages": 0 }` for an empty catalogue.

Items contain `id`, `organizer_id`, `venue_id`, `name`, `event_type`, `status`, nullable `artist`, `schedules`, and nullable `min_price`. Filters combine and results are ordered by creation time descending. This endpoint does not support name search.

`EventsApiClient.getEvents()` always supplies the current organizer filter for the
management view and validates pagination and response ownership before display.
It does not issue an unfiltered request when organizer identity is missing. The
backend endpoint remains public; frontend filtering is not server authorization.

### 5. Event Details

- Method: `GET`
- Path: `/api/v1/events/{id}` (runtime alias: `/events/{id}`)
- Responses: `200` with full event details; `404` for an unknown UUID; malformed UUIDs are rejected; `500` for server failures.

Details include metadata and arrays of `schedules`, `pricing_tiers`, `sales`, and `media`. Dates are UTC timestamps, prices are decimal strings, and fields use snake_case. Venue name/location are not included; resolve them through the Venue catalogue. Pricing, sales windows, and media are outside the MVP.

> [!NOTE]
> Events defaults to permissive venue mocking. Real validation needs `MOCK_VENUE_SERVICE=false` and `VENUE_SERVICE_URL`; the client expects `/api/v1/venues/{id}`, which must be verified against the actual Venue API. Search synchronization and ticket issuance are separate Search/Booking dependencies.

---

## Error Handling

Client-side requests are managed by `VenueApiClient` (`src/services/VenueApiClient.js`). Server error responses map into typed `ApiClientError` instances containing the HTTP status code and message.
