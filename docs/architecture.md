# Architecture & Domain Design

This document details the architectural principles, container boundaries, and source code organization of `venues-front`.

---

## 1. Domain Overview

The `venues-front` application is the partner-facing client for the **Venues and Events Domains** within the Ticket D-Saster platform:
- Serves as the web frontend for Venue Owners and Organizers integrated into the partner administration portal (`Backstage`).
- Enables Venue Owners to register physical spaces, maintain metadata, edit venue profiles, and select geographical coordinates on an interactive map.
- Consumes the venue catalogue and registration endpoints exposed by `venue-service` (Team SubAgentes).

- Will consume registration, listing, and detail endpoints from `dsaster-event-management` (Team Aura); Events frontend integration is pending.
- Uses mocked authentication for the current MVP. See [active requirements](../context/product/now.md).

### Layer Responsibilities

- **Presentation Layer (`src/components/`, `src/App.jsx`)**:
  Contains functional React components, modal dialogs, and visual cards. Responsible exclusively for rendering views, handling user interactions, accessibility, and client-side routing via native `popstate` events. Includes role-based guard wrappers (`VenueOwnerOnly`) and interactive map pickers (`LocationMapPicker` with Leaflet). Venue backend calls go through the API client; the map picker calls Nominatim directly.

- **Application Logic & State Layer (`src/hooks/`)**:
  Encapsulates use case workflows and asynchronous UI state machines. Custom hooks like `useCreateVenue` coordinate API execution, manage reactive state flags (`isLoading`, `isSuccess`, `isError`), and guard against race conditions using sequential request IDs (`requestIdRef`). `useCurrentUser` provides seamless subscription to session identity.

- **Infrastructure & API Services (`src/services/`)**:
  Encapsulates network communication and external HTTP endpoints (`VenueApiClient`). Maps REST responses and status codes into typed domain errors (`ApiClientError` differentiating 400 validation vs 403 authorization). Manages client-side session state via reactive in-memory stores (`CurrentUserService` using the Observer pattern).

## 2. Events Integration

Reuse the shared header and mock identity store, and add an Events API client under `src/services/` with event workflow hooks under `src/hooks/`.

- Registration collects name, artist, date, and a venue from **all registered venues**, refreshed when the form opens. Do not use the owner-filtered “Mis recintos” list.
- Submit to `POST /api/v1/events` and show the returned confirmation. Events requires UUID references, snake_case fields, and a future RFC 3339 timestamp; agree date/timezone conversion for the calendar-date input.
- Event reads return dates in `schedules` and only a `venue_id`; resolve venue name/location from the catalogue when needed.
- The current Events backend uses a fixed organizer ID if omitted. Keep identity out of form inputs and align the backend mock provider with the shared mock identity.
- Configure separate service URLs or gateway routes. Real venue validation requires disabling the Events permissive venue mock and verifying its Venue API path.

Seat maps, pricing, on-sale scheduling, editing/deletion, media, and analytics are outside the registration MVP. Public name search and ticket issuance belong to Search and Booking; their contracts have not been inspected here.
