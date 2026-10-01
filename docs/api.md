# API Reference

This document outlines the API Venue contracts consumed by `venues-front` and Events contracts available for frontend integration.

## Overview

The shared frontend integrates with `venue-service` and `dsaster-event-management`, directly or through the platform gateway. Events frontend integration is pending; `VITE_API_BASE_URL` currently configures only the Venue client.

- OpenAPI Specification: Maintained in the `venue-service` repository and published as `openapi.yml` with backend releases.

- Events Specification: `openapi.yml` in [dsaster-event-management](https://github.com/hjanssena/dsaster-event-management), generated with `cargo run --bin generate_openapi`. Contracts below were inspected on local `testing` at `10fba4d`, including its OpenAPI working-tree updates.
- Authentication is mocked for this stage; production JWT integration is deferred.

---

## Endpoints

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
  - `x-mock-user: <userId>` (current frontend mock); `Authorization: Bearer <jwt-token>` for future JWT integration

#### Request Body

```json
{
  "name": "Teatro Metropolitan",
  "description": "Historic theater with tiered seating.",
  "location": "Calle Independencia 90, CDMX"
}
```

> [!NOTE]
> `ownerId` and user roles are not accepted in the request payload. The current frontend sends mock identity in the `x-mock-user` header. The Venue backend has not been inspected; verified JWT attribution is the future contract.

#### Responses

- `201 Created`: Returns the persisted venue entity.
- `400 Bad Request`: Missing or invalid fields (`name`, `description`, `location`).
- `401 Unauthorized`: Missing, expired, or invalid authentication token under the future JWT contract.
- `403 Forbidden`: Authenticated user does not have the `VENUE_OWNER` role.

---

### 3. Register Event

- Method: `POST`
- Path: `/api/v1/events` (runtime alias: `/events`)
- Headers: `Content-Type: application/json`, `Accept: application/json`

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

The backend currently accepts optional `organizer_id` (`organizerId` alias), or defaults to `00000000-0000-0000-0000-000000000001`. It does not verify auth. Identity must not be entered in the form; align it with the agreed backend mock provider.

#### Responses

- `201 Created`: Event and schedule are stored atomically. Confirmation includes `id`, `message`, `name`, `artist`, `date`, `venue_id`, `status` (`Scheduled`), and `created_at`.
- `400 Bad Request`: Service validation failure or nonexistent venue, with `{ "error": "..." }`.
- `500 Internal Server Error`: Server/database failure.

Missing fields or malformed date/UUID values are rejected by Axum extraction; their response format needs alignment with the documented JSON errors. The PRD requires a valid calendar date, so the additional future-timestamp restriction also needs alignment.

### 4. List Events

- Method: `GET`
- Path: `/api/v1/events` (runtime alias: `/events`)
- Query: `page` (default 1), `per_page` (default 10, clamped to 1–100), `status`, `venue_id`, `organizer_id`, `id`.
- Response: `200` with `{ "items": [], "page": 1, "per_page": 10, "total_items": 0, "total_pages": 0 }` for an empty catalogue.

Items contain `id`, `organizer_id`, `venue_id`, `name`, `event_type`, `status`, nullable `artist`, `schedules`, and nullable `min_price`. Filters combine and results are ordered by creation time descending. This endpoint does not support name search.

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
