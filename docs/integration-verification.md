# Venue & Events Integration Verification (T-151)

Verified on 2026-11-25 against running instances of `HectorBarrera13/venues` (`venue-service`), `hjanssena/dsaster-event-management` (`feat_T-149_event_update_patch` + `fix_T-151_venue_client_integration`), and `venues-front`.

## Service URLs & Environment Configuration

| Service | Origin / Port | Backing Store | Required Configuration |
|---|---|---|---|
| **Venue Service** (`HectorBarrera13/venues`) | `http://localhost:3001` | MongoDB 7.0 (`venues-mongo:27017`, replica set `rs0`) | `PORT=3001`, `DATABASE_URL="mongodb://127.0.0.1:27017/venue_db?replicaSet=rs0&directConnection=true"`, `JWT_SECRET="<shared-hs256-secret>"` |
| **Events Service** (`dsaster-event-management`) | `http://localhost:3000` | PostgreSQL 15 (`event-db:5432`) | `SERVER_ADDR=0.0.0.0:3000`, `DATABASE_URL=postgres://usuario:password@host.docker.internal:5432/event_store`, `MOCK_AUTH=true`, `MOCK_VENUE_SERVICE=false`, `VENUE_SERVICE_URL=http://host.docker.internal:3001`, `VENUE_SERVICE_TOKEN=<organizer-or-owner-hs256-jwt>` |
| **Backstage Frontend** (`venues-front`) | `http://localhost:5173` | — (proxies `/events-api/*` to `http://localhost:3000/*`) | `VITE_API_BASE_URL="http://localhost:3001"`, `VITE_EVENTS_API_BASE_URL=""`, `VITE_USE_MOCK="false"`, `VITE_DEV_TOKEN="<venue-owner-hs256-jwt>"` |

---

## 1. Recorded Venue Token-Validation Behavior

Live HTTP probes against `GET http://localhost:3001/venues` and `POST http://localhost:3001/venues`:

| Request Credential | Endpoint | Observed Status | Observed Body |
|---|---|---|---|
| None | `GET /venues` | `401 Unauthorized` | `{"error":"Missing Authorization header"}` |
| Events mock token (`Bearer mock:11111111-1111-1111-1111-111111111111`) | `GET /venues` | `401 Unauthorized` | `{"error":"Invalid or expired token"}` |
| Unsigned `.mock` JWT (`alg: "none"`) | `GET /venues` | `401 Unauthorized` | `{"error":"Invalid or expired token"}` |
| Expired HS256 JWT | `GET /venues` | `401 Unauthorized` | `{"error":"Invalid or expired token"}` |
| Valid `ORGANIZER` HS256 JWT (`sub: 11111111-...`) | `POST /venues` | `403 Forbidden` | `{"error":"Role \"ORGANIZER\" is not allowed to access this resource"}` |
| Valid `ORGANIZER` HS256 JWT (`sub: 11111111-...`) | `GET /venues` | `200 OK` | `{"data":[...],"pagination":{...}}` |
| Valid `VENUE_OWNER` HS256 JWT (`sub: 22222222-...`) | `GET /venues` | `200 OK` | `{"data":[...],"pagination":{...}}` |

**Key contract findings:**
- `venue-service` mounts routes at `/venues` and `/api/venues` (not `/api/v1/venues`).
- Every `/venues` endpoint strictly enforces `HS256` JWT signature verification (`JWT_SECRET`) and requires both `sub` and `role` (`VENUE_OWNER` or `ORGANIZER`).
- `GET /venues` returns **only** venues that have at least one published seat map (`latestMapVersion >= 1`), whereas `GET /venues/{id}` returns any registered venue regardless of `latestMapVersion`.

---

## 2. Organizer Venue Catalogue Retrieval

1. Registered `Auditorio Live A` (`e319a562-d3f7-4502-8536-dd63592bf1d0`) as `VENUE_OWNER` `22222222-2222-2222-2222-222222222222` and published seat map v1 (`201 Created`).
2. Registered `Foro Live B` (`40e246ff-a087-4cff-97f6-3802f070567d`) as a second `VENUE_OWNER` `33333333-3333-3333-3333-333333333333` and published seat map v1 (`201 Created`).
3. Queried `GET http://localhost:3001/venues` using the `ORGANIZER` HS256 JWT and verified CORS preflight `OPTIONS /venues` from `Origin: http://localhost:5173`:
   - `OPTIONS /venues` returned `204 No Content` with `Access-Control-Allow-Origin: http://localhost:5173`.
   - `GET /venues` returned `200 OK` with `"total": 2` containing both `Auditorio Live A` and `Foro Live B` across different owners (not owner-filtered).

---

## 3. Separate Credential Verification

- Verified Vite dev server module `/src/auth/token.js` resolved `VITE_API_BASE_URL="http://localhost:3001"`, `VITE_EVENTS_API_BASE_URL=""`, `VITE_USE_MOCK="false"`, and `VITE_DEV_TOKEN=<HS256 JWT>`.
- `getVenueToken()` (`src/auth/token.js`) selects only valid JWT credentials for Venue requests and never sends `mock:<uuid>`.
- `getEventsToken()` (`src/auth/token.js`) sends `Bearer mock:11111111-1111-1111-1111-111111111111` to `/events-api/*` (proxied to `http://localhost:3000/*`) and never substitutes the Venue JWT for an organizer mock session.

---

## 4. Real `HttpVenueClient` Alignment (`MOCK_VENUE_SERVICE=false`)

Running unpatched `HttpVenueClient` against `http://localhost:3001` initially rejected valid venue `e319a562-...` with `422 Venue does not exist or is invalid` because it requested `GET /api/v1/venues/{id}` (receiving `404`) and omitted `Authorization`.

The `fix_T-151_venue_client_integration` branch in `dsaster-event-management` resolves this by:
- Querying `GET {base_url}/venues/{id}`.
- Attaching `Authorization: Bearer <VENUE_SERVICE_TOKEN>` when configured.
- Returning `Ok(false)` (`422`) strictly on `404`, and raising `500 Internal Server Error` on `401`, `403`, `5xx`, or transport failures.

---

## 5. End-to-End Verification Steps & Observed Results

### Startup Steps

```bash
# 1. Start Venue MongoDB + Venue Service on port 3001
cd venues
docker compose up -d mongo
npm ci && npm run db:generate && npm run db:push
OWNER1_JWT=$(npm run --silent token:make -- --role VENUE_OWNER --sub 22222222-2222-2222-2222-222222222222 --name "Owner Demo")
ORG_JWT=$(npm run --silent token:make -- --role ORGANIZER --sub 11111111-1111-1111-1111-111111111111 --name "Organizer Demo")
PORT=3001 npm run dev

# 2. Start Events PostgreSQL + Event Service on port 3000 with real Venue validation
cd ../dsaster-event-management
docker compose up -d event-db
MOCK_AUTH=true MOCK_VENUE_SERVICE=false VENUE_SERVICE_URL=http://localhost:3001 VENUE_SERVICE_TOKEN="$ORG_JWT" cargo run
```

### Observed Registration, Update, Ownership, Missing-Venue & Reload Persistence Checks

1. **Create with real mapped venue + spoofed `organizer_id` in body (`POST /api/v1/events`)**:
   - Observed **`201 Created`** (`id: 71536d1b-9f66-4d10-95d0-53384102cf83`).
   - Subsequent `GET /api/v1/events/71536d1b-9f66-4d10-95d0-53384102cf83` returned **`200 OK`** with `organizer_id: "11111111-1111-1111-1111-111111111111"` (attributed from Bearer token, ignoring spoofed `99999999-...`).
2. **Create with missing venue UUID (`POST /api/v1/events`)**:
   - Observed **`422 Unprocessable Entity`** (`{"error":"Venue does not exist or is invalid"}`) via real `HttpVenueClient` `404` lookup on `http://localhost:3001/venues/99999999-9999-4999-8999-999999999999`.
3. **Update as owning organizer (`PATCH /api/v1/events/71536d1b-...`)** with new `name`, `artist`, future `date`, and `venue_id` pointing to `Foro Live B` (`40e246ff-...`):
   - Observed **`200 OK`**, `updated_at` advanced, and `created_at`/`id`/`organizer_id`/`status` preserved.
4. **Update with missing venue (`PATCH /api/v1/events/71536d1b-...`)**:
   - Observed **`422 Unprocessable Entity`** (`{"error":"Venue does not exist or is invalid"}`); event state remained `"Updated Live Show"`.
5. **Update with non-organizer role (`Bearer mock:22222222-...`)**:
   - Observed **`403 Forbidden`** (`{"error":"Only organizers can update events"}`).
6. **Update with server-owned field (`{"organizer_id": "..."}`)**:
   - Observed **`400 Bad Request`** (`{"error":"Server-owned field 'organizer_id' cannot be modified"}`).
7. **Reload / Proxy Persistence Check (`GET http://localhost:5173/events-api/api/v1/events?organizer_id=11111111-1111-1111-1111-111111111111&page=1&per_page=10`)**:
   - Observed **`200 OK`** returning the persisted updated event `"Updated Live Show"` hosted at `"40e246ff-a087-4cff-97f6-3802f070567d"` directly from PostgreSQL via Vite's dev proxy.

---

## Remaining Limitations & Manual UI Note

- Automated Chrome DevTools browser driving (`chrome_devtools` MCP) could not attach to local Chrome due to macOS `EPERM` on `~/Library/Application Support/Google/Chrome/DevToolsActivePort`. Frontend UI behavior, state preservation, date timezone handling, and role guards remain verified by the 206 automated Node/MSW/SSR tests (`npm test`), and the live Vite proxy (`/events-api`) + CORS layer (`localhost:5173` -> `localhost:3001` / `localhost:3000`) was verified over HTTP.
- Partners in `dsaster-event-management` still authenticate with `MOCK_AUTH=true` (`Bearer mock:<uuid>`) because live Ninjava Auth Service integration is deferred; `VENUE_SERVICE_TOKEN` supplies the HS256 JWT required by `venue-service`.
