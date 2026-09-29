<div align="center">

# Ticket D-Saster - Venues Frontend

[![React](https://img.shields.io/badge/React-19.2-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v22.14.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?style=flat-square&logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
[![Team](https://img.shields.io/badge/Team-SubAgentes-0052CC?style=flat-square)](https://github.com/HectorBarrera13/venues-front)

Web frontend for venue owners in the **Ticket D-Saster** platform. It provides an administrative interface within the Backstage portal to register physical spaces, inspect venue catalogs, edit information, and pick geographical coordinates via an interactive map.

Developed and maintained by **Team SubAgentes**.

</div>

---

## Features

- **Venue Catalog**: View owned venues with loading skeletons, empty states, and deletion support.
- **Interactive Map Picker**: Leaflet and OpenStreetMap integration for bidirectional geocoding (click-to-pin and debounced search via Nominatim).
- **Registration & Editing**: Form validation for venue details with in-place modal editing.
- **Role-Based Guards**: UI boundaries restricting venue mutations to the `venue_owner` role.
- **Resilient API Handling**: Typed client errors separating validation (400) and authorization (403) failures.

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
| Test | `npm test` | Runs the configured test runner |

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

- **API Reference & Contracts**: See [docs/api.md](docs/api.md) for endpoints (`GET /venues`, `POST /venues`), payloads, and backend Swagger/OpenAPI details.
- **Platform Architecture**: See [docs/architecture.md](docs/architecture.md) for system context, team domains, and C4 references.
- **Operational Standards**: See [`AGENTS.md`](./AGENTS.md) for repository rules and CI/CD policies.

---
