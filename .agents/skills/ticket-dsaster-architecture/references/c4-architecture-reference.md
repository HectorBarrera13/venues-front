# C4 Container Architecture & Team Interaction Reference

This document details the microservice containers, network topologies, and cross-service communication contracts across all 5 engineering teams.

---

## 1. Team Responsibilities & Service Contracts

### Team 1: `Sap-atitos` (Core Domain: Booking & Sales)
- **Service**: `booking-service`
- **Inbound Endpoints**:
  - `POST /tickets/holds`: Atomically lock a seat for 300 seconds.
  - `GET /tickets/holds/{token}`: Inspect active hold session and get authoritative remaining TTL.
  - `POST /tickets/checkout`: Authorize payment and convert hold into an issued ticket.
- **Outbound Integrations**:
  - `Ninjava` (`Payment Service`): Synchronous HTTP `POST /payments/charges` with `Idempotency-Key`.
  - `Email System`: Asynchronous dispatch of confirmation emails containing ticket QR codes.
- **Data Store**: `Tickets Store` (PostgreSQL + Redis).

---

### Team 2: `Error200` (Generic Domain: Search)
- **Service**: `search-service`
- **Inbound Endpoints**:
  - `GET /events?query=...&venue=...&date=...&location=...`: Fast multi-filter indexed queries.
- **Latency Requirement**: p95 $\le 500\text{ ms}$ under heavy load.
- **Data Store**: `Events Store` (Elasticsearch or PostgreSQL with Trigram / GIN indexes).

---

### Team 3: `Ninjava` (Supporting Domain: Auth & Payments)
- **Services**:
  - `auth-service`: JWT token issuance, login, registration for Fans, Organizers, and Venue Owners.
  - `payment-service`: Payment processor adapter. Interacts with Stripe / External Payment Gateways.
- **Security & Integrity**: Exactly-once payment processing via idempotency tokens; audit logging.

---

### Team 4: `Aura` (Generic Domain: Event Management)
- **Service**: `event-service`
- **Front-end**: Co-owns `Backstage` front-end.
- **Inbound Endpoints**:
  - `POST /events`: Create event instance.
  - `PUT /events/{id}/pricing`: Define ticket classes, categories, and prices on top of venue seat map.
  - `POST /events/{id}/publish`: Schedule on-sale date and trigger cross-service catalog synchronization.
- **Data Store**: `Event Store`.

---

### Team 5: `SubAgentes` (Generic Domain: Venue Management)
- **Service**: `venue-service`
- **Front-end**: Co-owns `Backstage` front-end.
- **Inbound Endpoints**:
  - `POST /venues`: Register physical building layout.
  - `PUT /venues/{id}/seatmap`: Update section, row, and physical seat layout geometries.
  - `GET /venues/{id}/seatmap`: Authoritative physical layout.
- **Data Store**: `Venue Store`.

---

## 2. Cross-Service Event Storming Flow (Publishing & On-Sale)

1. **Venue Registration**: Venue Owner draws seat map in `Backstage` -> `Venue Service` saves layout in `Venue Store`.
2. **Event Creation**: Organizer selects venue, configures tiered prices -> `Event Service` saves event in `Event Store`.
3. **On-Sale Drop Scheduled**: At designated instant $T_{\text{drop}}$, `Event Service` emits event published signal:
   - Synchronizes searchable metadata into `Events Store` (`Error200`).
   - Synchronizes seat map inventory into `Tickets Store` (`Sap-atitos`).
4. **Fan Discovery**: Fan searches show via `D-Saster Front` (`Error200`) -> views live seats.
5. **Purchase Execution**: Fan holds seat -> 300s timer begins (`Sap-atitos`) -> Payment charged (`Ninjava`) -> Ticket QR emitted.
