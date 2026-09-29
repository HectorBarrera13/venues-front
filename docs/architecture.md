# Architecture & Domain Design

This document details the architectural principles, container boundaries, and source code organization of `venues-front`.

---

## 1. Domain Overview

The `venues-front` application is the partner-facing client for the **Venues Domain** within the Ticket D-Saster platform:
- Serves as the web frontend for Venue Owners integrated into the partner administration portal (`Backstage`).
- Enables Venue Owners to register physical spaces, maintain metadata, edit venue profiles, and select geographical coordinates on an interactive map.
- Consumes the venue catalogue and registration endpoints exposed by `venue-service` (Team SubAgentes).

### Layer Responsibilities

- **Presentation Layer (`src/components/`, `src/App.jsx`)**:
  Contains functional React components, modal dialogs, and visual cards. Responsible exclusively for rendering views, handling user interactions, accessibility, and client-side routing via native `popstate` events. Includes role-based guard wrappers (`VenueOwnerOnly`) and interactive map pickers (`LocationMapPicker` with Leaflet). Does not perform direct `fetch` calls.

- **Application Logic & State Layer (`src/hooks/`)**:
  Encapsulates use case workflows and asynchronous UI state machines. Custom hooks like `useCreateVenue` coordinate API execution, manage reactive state flags (`isLoading`, `isSuccess`, `isError`), and guard against race conditions using sequential request IDs (`requestIdRef`). `useCurrentUser` provides seamless subscription to session identity.

- **Infrastructure & API Services (`src/services/`)**:
  Encapsulates network communication and external HTTP endpoints (`VenueApiClient`). Maps REST responses and status codes into typed domain errors (`ApiClientError` differentiating 400 validation vs 403 authorization). Manages client-side session state via reactive in-memory stores (`CurrentUserService` using the Observer pattern).

