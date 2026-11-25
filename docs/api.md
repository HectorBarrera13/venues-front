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

### 1. List & Search Venues

Retrieves a paginated page of registered venues that have at least one saved seat map (`latestMapVersion >= 1`), optionally filtered by radius (`lat`, `lng`, `radius_km`), `country`, `city`, or `name`.

- Method: `GET`
- Path: `/venues` (supports `?page=1&limit=20&lat=...&lng=...&radius_km=...&country=MX&city=...&name=...`)
- Headers:
  - `Accept: application/json`
  - `Authorization: Bearer <token>`

#### Response

- Status: `200 OK`
- Body: `{ data, pagination }`

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Auditorio Nacional",
      "description": "Main indoor arena for concerts and sports.",
      "address": "Paseo de la Reforma 50",
      "city": "Ciudad de Mexico",
      "country": "MX",
      "location": { "lat": 19.4245, "lng": -99.1951 },
      "externalId": "123456",
      "externalSource": "nominatim",
      "osmRef": "way:123456",
      "latestMapVersion": 1,
      "ownerId": "venue-owner-1",
      "createdAt": "2026-03-15T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

When `lat`, `lng`, and `radius_km` are provided, items are sorted ascending by distance and include `distance_km`.

---

### 2. Register Venue

Registers a new physical venue under the authenticated partner (`latestMapVersion: 0`).

- Method: `POST`
- Path: `/venues`
- Headers:
  - `Content-Type: application/json`
  - `Accept: application/json`
  - `Authorization: Bearer <token>`

#### Request Body

```json
{
  "name": "Teatro Metropolitan",
  "description": "Historic theater with tiered seating.",
  "address": "Calle Independencia 90",
  "city": "Ciudad de Mexico",
  "country": "MX",
  "location": { "lat": 19.4332, "lng": -99.1469 },
  "externalId": "987654",
  "externalSource": "nominatim",
  "osmRef": "way:987654"
}
```

> [!NOTE]
> The frontend does not submit `ownerId` or roles in the payload. It sends the
> supplied Venue JWT via `getVenueToken()` and never sends an Events mock token.
> Without a supplied JWT it omits Authorization.

#### Responses

- `201 Created`: Returns the persisted venue entity (`latestMapVersion: 0`).
- `400 Bad Request`: Validation error with `{ error, field, message, errors[] }`.
- `401 Unauthorized`: Missing, expired, or invalid authentication token.
- `403 Forbidden`: Authenticated user does not have the `VENUE_OWNER` role.
- `409 Conflict`: Venue already registered (`{ error, existingVenueId }`).

---

### 2b. Venue Detail & Seat Maps

- `GET /venues/{id}` → `200` with full venue metadata (`latestMapVersion`, `ownerId`, no map geometry) or `404`.
- `GET /venues/{id}/map[?version=N]` → `200` with immutable `{ venueId, version, createdAt, stage, zones, seats }`, `400` on invalid `version`, `404` when unmapped or unknown version.
- `POST /venues/{id}/map` → `201` storing immutable version `latestMapVersion + 1`, `403` for non-owners, `422` with `{ error, errors[] }` (`SEAT_WITHOUT_ZONE`, `EMPTY_ZONE`, `OVERLAP`, `UNNAMED_ZONE`, `DUPLICATE_LABEL`, `NO_STAGE`).

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

### 6. Update Event

- Method: `PATCH`
- Path: `/api/v1/events/{id}` (runtime alias: `/events/{id}`)
- Headers: `Content-Type: application/json`, `Accept: application/json`, `Authorization: Bearer mock:<organizer-uuid>`
- Body: Optional subset of `name`, `artist`, `date` (future RFC 3339 timestamp), `schedule_id` (required only when the event has multiple schedules), and `venue_id` (`venueId` alias accepted). Server-owned fields (`id`, `organizer_id`, `status`, `created_at`, `updated_at`, `version`, `published_at`) and unknown fields return `400`.
- Responses:
  - `200 OK`: Updated `EventResponseDto` persisted atomically with refreshed `updated_at`.
  - `400 Bad Request`: Empty payload, invalid/blank text, non-future `date`, server-owned/unknown field, or missing `schedule_id` for multi-schedule events.
  - `401 Unauthorized`: Missing, malformed, or unknown partner bearer token.
  - `403 Forbidden`: Partner is not an organizer or does not own the event.
  - `404 Not Found`: Event does not exist.
  - `422 Unprocessable Entity`: Changed `venue_id` rejected by Venue Service or `schedule_id` does not belong to the event.
  - `500 Internal Server Error`: Persistence or upstream Venue Service error.

> [!NOTE]
> Events defaults to permissive venue mocking (`MOCK_VENUE_SERVICE=true`). With `MOCK_VENUE_SERVICE=false` and `VENUE_SERVICE_URL` configured, `HttpVenueClient` queries `GET /venues/{id}` with an optional `VENUE_SERVICE_TOKEN` bearer JWT. See [the live integration verification runbook](integration-verification.md). Search synchronization and ticket issuance remain separate Search/Booking dependencies.

---

## Error Handling

Client-side requests are managed by `VenueApiClient` (`src/services/VenueApiClient.js`). Server error responses map into typed `ApiClientError` instances containing the HTTP status code and message.
