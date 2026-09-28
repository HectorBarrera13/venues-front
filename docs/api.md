# API Reference

This document outlines the API contracts consumed by `venues-front`.

## Overview

The application communicates with the `venue-service` backend or the platform reverse proxy gateway.

- Default local target: `http://localhost:8080` (or `http://quieroqueue:2000` via `.env`)
- Platform Gateway: `https://gateway.tail9a6ddb.ts.net/venues`
- OpenAPI Specification: Maintained in the `venue-service` repository and published as `openapi.yml` with backend releases.

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
  - `Authorization: Bearer <jwt-token>` (or `x-mock-user: <userId>` during local development)

#### Request Body

```json
{
  "name": "Teatro Metropolitan",
  "description": "Historic theater with tiered seating.",
  "location": "Calle Independencia 90, CDMX"
}
```

> [!NOTE]
> `ownerId` and user roles are not accepted in the request payload. The backend securely extracts owner identity from verified JWT claims (`sub`).

#### Responses

- `201 Created`: Returns the persisted venue entity.
- `400 Bad Request`: Missing or invalid fields (`name`, `description`, `location`).
- `401 Unauthorized`: Missing, expired, or invalid authentication token.
- `403 Forbidden`: Authenticated user does not have the `VENUE_OWNER` role.

---

## Error Handling

Client-side requests are managed by `VenueApiClient` (`src/services/VenueApiClient.js`). Server error responses map into typed `ApiClientError` instances containing the HTTP status code and message.
