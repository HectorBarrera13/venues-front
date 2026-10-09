<div align="center">

# Ticket D-Saster - Venues & Events Frontend

[![React](https://img.shields.io/badge/React-19.2-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v22.14.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?style=flat-square&logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![Team](https://img.shields.io/badge/Team-SubAgentes-0052CC?style=flat-square)](https://github.com/HectorBarrera13/venues-front)

Shared Backstage frontend for venue owners and event organizers in the **Ticket D-Saster** platform. It provides an administrative interface within the Backstage portal to register physical spaces, inspect venue catalogs, edit information, and pick geographical coordinates via an interactive map.

The Venues domain is maintained by **Team SubAgentes** and the Events domain by **Team Aura**.

</div>

---

## Features

- **Venue Catalog**: View owned venues with loading skeletons, empty states, and deletion support.
- **Interactive Map Picker**: Leaflet and OpenStreetMap integration for bidirectional geocoding (click-to-pin and debounced search via Nominatim).
- **Registration & Editing**: Form validation for venue details with in-place modal editing.
- **Role-Based Guards**: UI boundaries restricting venue mutations to the `venue_owner` role.
- **Event Registration**: Organizers register events with name, artist, a future date/time, and a venue selected from the refreshed catalogue. Events listing, details, and update screens remain pending.
- **Resilient API Handling**: Typed client errors separating validation (400) and authorization (403) failures.

---

The current MVP uses mocked authentication. See [context/product/now.md](context/product/now.md) for requirements and exclusions. Existing venue edit/delete actions affect local state only.

### Mock partner sign-in (T-098)

Open `/login`. Use `organizer@example.com` or `owner@example.com`, with password
`Backstage123!` for either account. The account determines the role; there is no
role selector. Organizers land on `/events` (a placeholder until Events integration)
and owners land on the existing Venue screen at `/`.

The session survives reloads. **Cerrar sesión** clears it and returns to login.
No Auth service requests are made. These frontend fixtures produce `mock:<uuid>`
credentials matching the Events backend's development partners. Venue calls use
a supplied JWT instead; mock credentials are never sent to Venue. Existing
persisted JWT sessions remain readable.

### Venue credential compatibility (T-098 follow-up)

The original `VITE_DEV_TOKEN` JWT fallback is restored. Session credentials still
prefer an explicit in-memory token, then `ds-aster.access-token` in localStorage,
then the development token. Venue calls preserve a supplied JWT independently of
an organizer's Events mock session. Venue URLs and request bodies are unchanged.

Set `VITE_DEV_TOKEN` in `.env` to the JWT supplied by the existing Venue/Auth
workflow, then restart Vite. When logging in as the owner demo, a supplied
`VENUE_OWNER` JWT is used as the active session so venue filtering uses its original
`sub`, not the fixed demo UUID. If you were already logged in as the owner demo,
sign out and log in again after configuring the token. Organizer demo login
continues using the Events mock credential, including when a Venue JWT is configured.

Signing out clears stored credentials and suppresses development-token fallback
across reloads. An explicit login re-enables it. Without a supplied JWT, owner demo
screens remain available but Venue calls omit Authorization; no JWT is fabricated.
The frontend only decodes claims for selection and display. Venue is responsible
for checking the supplied token; live backend acceptance remains unverified.

### Invitation registration (T-095)

Choose **Registrarme con invitación** on login, or open `/register`. Enter a
username, password (at least eight characters), confirmation, and invitation code.
There is no role selector: the invitation determines the role. The current
Ninjava contract uses usernames, not email addresses; the original email-shaped
demo usernames still work on login.

Demo invitations: `K7PX-3MZQ-9HTA` for an organizer, `V7PX-3MZQ-9HTA` for an owner.
After registration, use the form's **Iniciar sesión** link and sign in with the new
credentials. Each invitation can be used once per page lifetime. Duplicate usernames
and invalid/used codes show errors without consuming valid codes on failure.

This remains frontend-only authentication. Accounts reuse the existing backend
fixture identities; credentials and invitation-use state reset on page reload.
No Auth API is called and new passwords are not persisted. See
[the Ninjava contract reference](context/product/mvp-03-partner-access.md).

### Unauthenticated redirects (T-094)

Without a valid session, opening any protected Backstage path redirects to `/login` before
protected views mount or issue requests. Malformed credentials, unknown mock IDs,
and expired JWTs are treated as signed out. Active JWT expiry updates the UI;
mock sessions have no expiration. An API `401` clears the rejected credential
before returning to login. Redirects replace browser history and avoid repeating
the same navigation. `/login` and invitation registration at `/register` are public.

To check manually, sign out and open `/events`, `/venues/register`, and `/` directly.
Each should show login at `/login`. Sign in, sign out, and press Back: protected
content must stay unavailable. To test an invalid session, set
`ds-aster.access-token` to `mock:unknown` in browser localStorage, then reload a
protected URL.

### Partner role guards (T-092)

Organizers can open Events views; venue owners can open Venue views. Direct links
to the other role's section display an access-denied panel with a link back to the
partner's panel. Unknown pages display a not-found panel. Denied views do not mount
or start API requests. Venue actions are hidden for other roles; existing local
edit/delete handlers also check ownership. Event create/update permissions are
defined for the upcoming integration, with deletion excluded.

To check manually, sign in as the organizer and open `/` and `/venues/register`.
Both should show access denied. Sign in as the owner and open `/events`; it should
also show access denied. `/unknown` should show page not found for either account.
The organizer header must not show **Registrar recinto**. Switching accounts
resets view state so the previous partner's data cannot remain on screen.

### Event registration (T-091)

Sign in as `organizer@example.com` and choose **Registrar evento**, or open
`/events/register`. The form requests the existing Venue catalogue each time it
opens, without applying the owner filter used by “Mis recintos”. The Venue service
must expose the complete catalogue to the organizer; that backend behavior and
acceptance of the supplied Venue JWT are still unverified. Catalogue errors and
empty results disable submission instead of supplying fake venue records.

Enter a future date/time in the displayed browser timezone. The frontend converts
it to UTC and sends `POST /api/v1/events`, with the session bearer token and no
organizer identity in the body. Venue IDs must be UUIDs. Success displays the
server's `201` confirmation; errors preserve the form and allow retry. Repeated
clicks while a request is pending are blocked. The API has no idempotency key, so
this does not guarantee deduplication after an interrupted response or manual retry.

For local testing, run Events on port 3000 and configure `VITE_API_BASE_URL` for
your Venue service. Leave `VITE_EVENTS_API_BASE_URL` empty to use the separate
`/events-api` development proxy, or set it to the Events service origin.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19** | Component-driven user interface |
| **Vite 8** | Development server and build bundler |
| **Leaflet & React-Leaflet** | Interactive map and spatial picker |
| **ESLint 10** | Static code analysis and linting |
| **Husky** | Git commit-msg hook validation |

---

## Getting Started

### Prerequisites

- **Node.js**: `v22.14.0` (specified in `.nvmrc`)
- **npm**: `v10+`

```bash
nvm use
```

### Installation

```bash
git clone https://github.com/HectorBarrera13/venues-front.git
cd venues-front
npm install
```

### Environment Configuration

Create a local environment file based on the example:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL for the venue-service API or gateway | `/api` |
| `VITE_EVENTS_API_BASE_URL` | Events service origin (without `/api/v1/events`) | `/events-api` |
| `VITE_DEV_TOKEN` | Existing Venue/Auth JWT for the development credential workflow | Empty |

`VITE_API_BASE_URL` configures the existing Venue client. Events uses a separate
client and `/events-api` development proxy that preserves `/api/v1/events`.
Production hosting must configure that proxy or supply an Events origin with CORS.

### Running Locally

```bash
# Start development server with HMR
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Development | `npm run dev` | Starts Vite dev server (default: `http://localhost:5173`) |
| Build | `npm run build` | Compiles production assets into `dist/` |
| Preview | `npm run preview` | Serves the production build locally |
| Lint | `npm run lint` | Runs ESLint across all source files |
| Test | `npm test` | Runs authentication tests with the built-in Node.js test runner |

---

## Project Structure

```text
src/
├── assets/          # Static images and svg assets
├── components/      # React UI components (Map picker, forms, cards, modals)
├── hooks/           # Custom React hooks (useCreateVenue, useCurrentUser)
├── services/        # API client and user state service
├── App.css          # Design tokens and global application styles
├── App.jsx          # Root component and view router
└── main.jsx         # Application entry point
```

---

## Documentation & API

- **API Reference & Contracts**: See [docs/api.md](docs/api.md) for Venue and Events endpoints, payloads, and backend OpenAPI details.
- **Platform Architecture**: See [docs/architecture.md](docs/architecture.md) for system context, team domains, and C4 references.
- **Operational Standards**: See [`AGENTS.md`](./AGENTS.md) for repository rules and CI/CD policies.
