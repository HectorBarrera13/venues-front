# Architecture & Domain Design

This document details the architectural principles, container boundaries, and source code organization of `venues-front`.

---

## 1. Domain Overview

The `venues-front` application is the partner-facing client for the **Venues and Events Domains** within the Ticket D-Saster platform:
- Serves as the web frontend for Venue Owners and Organizers integrated into the partner administration portal (`Backstage`).
- Enables Venue Owners to register physical spaces, maintain metadata, edit venue profiles, and select geographical coordinates on an interactive map.
- Consumes the venue catalogue and registration endpoints exposed by `venue-service` (Team SubAgentes).

- Consumes event registration from `dsaster-event-management` (Team Aura); listing, detail, and updating integration remains pending.
- Uses mocked authentication for the current MVP. See [active requirements](../context/product/now.md).

### Layer Responsibilities

- **Presentation Layer (`src/components/`, `src/App.jsx`)**:
  Contains functional React components, modal dialogs, and visual cards. Responsible exclusively for rendering views, handling user interactions, accessibility, and client-side routing via native `popstate` events. Includes role-based guard wrappers (`VenueOwnerOnly`) and interactive map pickers (`LocationMapPicker` with Leaflet). Venue backend calls go through the API client; the map picker calls Nominatim directly.

- **Application Logic & State Layer (`src/hooks/`)**:
  Encapsulates use case workflows and asynchronous UI state machines. Custom hooks like `useCreateVenue` coordinate API execution, manage reactive state flags (`isLoading`, `isSuccess`, `isError`), and guard against race conditions using sequential request IDs (`requestIdRef`). `useCurrentUser` provides seamless subscription to session identity.

- **Infrastructure & API Services (`src/services/`)**:
  Encapsulates network communication and external HTTP endpoints (`VenueApiClient`). Maps REST responses and status codes into typed domain errors (`ApiClientError` differentiating 400 validation vs 403 authorization). Manages client-side session state via reactive in-memory stores (`CurrentUserService` using the Observer pattern).

## 2. Events Integration

Event registration uses `EventsApiClient` under `src/services/` and
`useEventRegistration` under `src/hooks/`, with a presentational form and page wrapper.

Backstage uses `src/auth/access.js` for route and action permissions. Organizer
sessions can enter the Events namespace, and venue-owner sessions can enter the
Venue namespace. The root route checks access before mounting a view; denied and
unknown paths have dedicated states. View state is keyed to the current credential
and discarded on session changes. These checks control the interface; owning
services continue authorizing every HTTP request.

- Registration collects name, artist, date, and a venue from **all registered venues**, refreshed when the form opens. Do not use the owner-filtered “Mis recintos” list.
- Submit to `POST /api/v1/events` and show the returned confirmation. Events requires UUID references, snake_case fields, and a future RFC 3339 timestamp. The form collects local date/time, displays the browser timezone, and converts to UTC.
- Event reads return dates in `schedules` and only a `venue_id`; resolve venue name/location from the catalogue when needed.
- The Events backend derives organizer identity from its mock bearer credential. Identity is absent from registration form inputs and request bodies.
- Configure separate service URLs or gateway routes. Real venue validation requires disabling the Events permissive venue mock and verifying its Venue API path.

Seat maps, pricing, on-sale scheduling, deletion, media, and analytics are outside
this implementation. Event updating is in the agreed CRU scope and remains pending.
Public name search and ticket issuance belong to Search and Booking; their contracts
have not been inspected here.
