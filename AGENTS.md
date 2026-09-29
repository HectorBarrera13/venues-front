# AGENTS.md — Ticket D-Saster: Venues Microservice (`venue-service`)

Welcome to the **Venues Microservice** repository (`venue-service`), owned and developed by **Team SubAgentes** within the distributed **Ticket D-Saster** platform.

This file is the primary contract and operational guide for AI coding agents (and human engineers) collaborating on this codebase. Before writing or modifying any code in this repository, **you must read and strictly adhere to the standards, workflows, and constraints described here.**

---

## 🏛️ Repository Identity & Service Context

> [!IMPORTANT]
> **THIS REPOSITORY IS THE VENUES MICROSERVICE (`venue-service`)**
> - **Assigned Team**: `SubAgentes`
> - **Bounded Context**: Venues Domain (`Venue Management`)
> - **Core Responsibilities**: Authoritative management of physical venues, sections, rows, seating capacities, and spatial layouts. Exposes venue catalogue endpoints (`GET /venues`) consumed by Team Aura (`event-service`) and Team Error200 (`search-service`). Co-owns the partner administration portal (`Backstage`) for Venue Owners.
> - **Platform Container Image**: `gateway.tail9a6ddb.ts.net:5000/subagentes-venue-service`
> - **Shrine Deployment Domain**: Primary domain `subagentes.venue-service.internal`
> - **Gateway Routing Alias**: `https://gateway.tail9a6ddb.ts.net/venues` (`stripPrefix: true`)
> - **Backing Datastore**: `venue-db` (declared as a Shrine `kind: Resource`)

---

## MANDATORY CONTEXT CONSULTATION (`context/`)

> [!IMPORTANT]
> **BEFORE STARTING ANY TASK OR WORK, YOU MUST CONSULT THE `context/` DIRECTORY.**  
> Foundational system knowledge and evolving product requirements live under `output/context/`:
> 1. **[`context/CONTEXT.md`](./context/CONTEXT.md) — The general context of the Ticket D-Saster platform**
> 2. **[`context/architechture/`](./context/architechture/) — The Static Architecture Baseline**:
>    - Houses [`arch.md`](./context/architechture/arch.md) and authoritative diagrams in [`diagrams/`](./context/architechture/diagrams/) (`Level-1-System.png`, `Level-2-Container.png`, `domain.png`).
>    - This documentation is **more static**: it defines the macro architecture, C4 container topologies, the 5 microservice team boundaries (`Error200`, `Sap-atitos`, `Ninjava`, `Aura`, `SubAgentes`), and DDD subdomains.
>
> 3. **[`context/product/`](./context/product/) — The Dynamic Product Roadmap**:
>    - Houses sequential MVP specifications ([`mvp-01.md`](./context/product/mvp-01.md), [`mvp-02.md`](./context/product/mvp-02.md), [`mvp-03.md`](./context/product/mvp-03.md), etc.).
>    - This documentation is **dynamic and constantly evolving**.
>
> 4. **[`context/product/now.md`](./context/product/now.md) — THE ACTIVE WORK IN FLIGHT**:
>    - **`now.md` is the single source of truth for what is currently being developed** (currently **MVP 03: Partner Access**).
>    - It states the exact active requirements, acceptance criteria, active constraints, and what is explicitly OUT OF SCOPE for the current phase, with dedicated focus on `venue-service`.
>    - **NEVER FORGET TO CHECK `now.md`**: The active phase can change at any moment as new MVPs are unlocked. Never assume that the scope from a previous session remains unchanged. Always re-inspect [`now.md`](./context/product/now.md) at the beginning of any turn, ticket, or task!

---

## 1. Project & System Overview

### 1.1 The Domain: Ticket D-Saster
Ticket D-Saster is a high-concurrency ticket sales and venue management platform. It allows:
- **Venue Owners** (our primary user) to register physical venues, sections, rows, and seats once, maintaining authoritative physical layouts.
- **Organizers** to publish events hosted at registered venues, assign tiered seat categories and pricing, and schedule ticket drops (on-sale dates/times).
- **Fans & Buyers** to search events (by artist, date, venue, location), view live seat maps, hold seats in 5-minute reservations, queue under heavy load, and securely purchase tickets with QR code issuance.
- **Event Staff** to scan and validate tickets at gate checkpoints.

### 1.2 Core Domain Requirements & Non-Functional Demands (ASRs)
1. **Seat Integrity (At-Most-Once Sale)**: A physical seat for a specific event instance can be sold at most once. Two valid tickets must **never** point to the same seat.
2. **Authoritative Hold Expiry**: When a fan selects a seat, it is reserved with an authoritative **server-side 5-minute countdown**. UI clocks are purely cosmetic. If the window elapses or payment fails, the hold is instantly reclaimed.
3. **High Concurrency & Load Shedding**: The platform must absorb up to **100,000 concurrent fans** at on-sale peaks without crashes or 500 errors. Excess traffic must gracefully degrade into a queued waiting room.
4. **Data Freshness & Search Latency**: Seat availability must reflect across the system in $\le 2\text{ s}$. Search queries must respond in $\le 500\text{ ms}$ at p95.
5. **Session Resilience**: Interrupted checkout sessions (page refresh, network drop) must be resumable with the genuine remaining hold time intact.

### 1.3 Team Topologies & Microservice Architecture (C4 Level 2)
The platform is decoupled into five cross-functional service teams and bounded contexts:

| Domain | Classification | Assigned Team | Responsibilities & Services | Storage / Technology |
|---|---|---|---|---|
| **Venues Domain** | Generic | `SubAgentes`<br>**(THIS REPO / OUR TEAM)** | • `Venue Service`: Physical venue registries, layout geometries, seating maps.<br>• Co-owns `Backstage` partner front-end.<br>• Provides venue catalogue for Team Aura (`event-service`). | `Venue Store` (`venue-db`) |
| **Search Domain** | Generic | `Error200` | • `Search Service`: Fast multi-filter queries (`GET /events?filter=...`).<br>• High read throughput, read-heavy caching. | `Events Store` (indexed querying) |
| **Booking Domain** | Core | `Sap-atitos` | • `Booking Service`: High-contention reservation engine (`POST /tickets`), 5-min locking, queuing.<br>• Coordinates checkout, publishes purchase completion to Email System, invokes Payment via HTTP. | `Tickets Store` (seat inventory state) |
| **Auth & Payments** | Supporting | `Ninjava` | • `Auth Service`: User registration, identity, JWT token issuance for Fans, Organizers, and Owners.<br>• `Payment Service`: Dedicated idempotent payment processing integrating with external payment gateways. | `User Store`, External Payment Service |
| **Events Domain** | Generic | `Aura` | • `Event Service`: Event scheduling, ticket tier pricing, seat categorisation.<br>• Publishes published event state to Booking (`Tickets Store`) and Search (`Events Store`).<br>• Co-owns `Backstage` front-end. | `Event Store` (R/W) |
| **Front-Ends** | Client | Shared / Core | • `D-Saster Front`: Public portal for Fans/Buyers (Discovery & Purchase).<br>• `Backstage`: Administrative portal for Organizers and Venue Owners. | Next.js / Web SPA |

---

## 2. Universal Repository Prerequisites (The 11 Golden Rules)

Every repository across all five teams **must** implement and maintain the following 11 prerequisites:

1. **`README.md`**: Must clearly describe the `venue-service` domain, architecture responsibilities, dependencies, and provide exact, copy-pasteable commands to build, test, and run locally from a fresh clone.
2. **`AGENTS.md`**: Dedicated instructions for AI coding agents detailing stack-specific commands, conventions, architecture patterns, and pointers to active skills.
3. **Linting Command**: A single command exposed to run static analysis (e.g. `npm run lint`, `mvn checkstyle:check`, `./gradlew checkstyleMain`, `ruff check .`, `dotnet format --verify-no-changes`).
4. **Unit Test Command**: A single command exposed to run all unit tests in isolation (e.g. `npm test`, `./gradlew test`, `pytest`, `dotnet test`).
5. **Enforced Conventional Commits**: Every commit message must strictly comply with Conventional Commits, ending with the ticket ID in parentheses:  
   `type(scope): message (TICKET-123)`  
   Allowed types: `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`.  
   Enforced locally via `.githooks/commit-msg` or husky/pre-commit, and remotely via CI.
6. **Protected `main` Branch**: Direct pushes to `main` are strictly prohibited. All changes must arrive via reviewed, green pull requests.
7. **Headless OpenAPI Generation (Backend Services)**: A command must exist to generate the static OpenAPI specification file (`openapi.json` or `openapi.yaml`) directly from code or schema without launching a browser or requiring a running Swagger UI (e.g., `npm run openapi:generate`, `./gradlew generateOpenApiDocs`, `python export_openapi.py`).
8. **PR Pipeline (`on_pr.yml`)**: A GitHub Actions workflow triggered on every pull request that runs linting, formatting checks, and unit tests. PRs cannot be merged if this pipeline fails.
9. **Release Pipeline (`release.yml`)**: A GitHub Actions workflow triggered exclusively on version tags (`v*.*.*`). It:
   - Builds and tags the Docker image (`gateway.tail9a6ddb.ts.net:5000/subagentes-venue-service`).
   - Joins the Tailscale tailnet using GitHub Actions OIDC tokens.
   - Pushes multi-tag semver images to the homelab registry.
   - Generates release notes from Conventional Commits using `scripts/changelog.sh`.
   - Attaches the versioned OpenAPI definition file (`openapi.yml` / `openapi.json`) to the GitHub release.
10. **Version Bump Script (`scripts/bump.sh`)**: An executable script that verifies local branch health (on `main`, clean tree, in sync with `origin/main`, green CI on HEAD, passing unit tests), prompts for or calculates the next SemVer bump (`--major`, `--minor`, `--patch`), and annotates and pushes the git tag.
11. **Health Check Endpoint (`GET /health`)**: Must expose an unauthenticated health check endpoint:
    - Method: `GET`
    - Path: `/health`
    - Response: `{ "status": "ok" }` (HTTP 200 OK)
    - *Distinction*: Use `/health` or `/live` for process liveness, and separate `/ready` for external dependency readiness (`venue-db`).

---

## 3. Standard Git & Development Workflows

### 3.1 GitHub Flow & Branch Naming
- Branch from the latest `origin/main`:  
  `git switch -c feature/<TICKET-ID>-<short-description>` (e.g. `feature/AZ-104-venue-polygon-coordinates`).
- Work in small, incremental commits matching `tasks.md`.
- Open a Pull Request targeting `main`. Set the PR title to match Conventional Commits:  
  `feat(venues): add polygon coordinates to seat map sections (AZ-104)`.
- Ensure all CI checks (linting, tests, conventional commit validation) pass.
- Squash and merge (or rebase merge as per team policy).

### 3.2 Commit Message Standard
```text
<type>(<optional-scope>): <summary in imperative mood> (<TICKET-ID>)

[optional body with rationale and trade-offs]

[optional footer: BREAKING CHANGE: description]
```
Examples:
- `feat(venues): validate JWT role is VENUE_OWNER on venue registration (PA-09)`
- `fix(venues): attribute ownerId from JWT sub claim instead of body (VE-02)`
- `test(venues): assert 403 Forbidden when organizer attempts venue creation (PA-09)`

---

## 4. Spec-Driven Development (SDD) & Working with AI

When tasked with implementing features, bug fixes, or refactors, **never jump directly into generating large batches of code without an approved specification.** Follow Spec-Driven Development using either **Spec Kit** or **OpenSpec** (one tool per repository):

### 4.1 The SDD Lifecycle
1. **Specify**: Translate user stories and ticket acceptance criteria into a clear functional specification document (`spec.md` or `proposal.md`). Focus on user interactions, boundary conditions, and acceptance scenarios (WHEN/THEN). **Do not lock in technical implementations at this step.**
2. **Plan**: Produce `plan.md` defining technical architecture, entity schemas, API endpoints, contract deltas, and architectural trade-offs. Major architectural decisions must be documented as Architecture Decision Records (ADRs).
3. **Tasks**: Break the plan into sequential, atomic tasks in `tasks.md`. Each task must represent a single reviewable unit and one git commit.
4. **Implement (Test-First)**: For each task:
   - Write failing unit/integration tests covering acceptance criteria.
   - Implement minimal clean code to make tests green.
   - Run stack linters and test suites.
   - Commit with the appropriate conventional message and ticket suffix.
5. **Review & Archive**: Verify that changes adhere to the spec. For OpenSpec, run `/opsx:archive` after merging to prevent living spec drift.

---

## 5. Architectural Principles & Coding Standards

`venue-service` enforces clean separation of concerns:
- **Domain Core**: Pure `Venue`, `Section`, `Row`, `PhysicalSeat` business entities and invariants. **Zero external framework, ORM, or database dependencies.**
- **Ports**: Inbound ports (`CreateVenueUseCase`, `GetVenueSeatMapUseCase`) and Outbound ports (`VenueRepository`, `VenueEventPublisher`).
- **Adapters**:
  - *Primary (Driving)*: REST controllers (`VenueController`), CLI scripts.
  - *Secondary (Driven)*: Database repository adapter (`PostgresVenueRepository`), JWT token validator adapter.

### 5.2 Security & Authentication Guidelines (MVP 03)
- **Token Verification**: Verify bearer JWT tokens emitted by `auth-service` (Team Ninjava).
- **Role Enforcement**: Ensure `role === "VENUE_OWNER"` for mutating operations.
- **Identity Attribution**: Extract `ownerId` directly from the token `sub` claim. Never accept client-supplied owner IDs.

---

## 6. Docker & Container Registry Rules

### 6.1 Homelab Registry Configuration
- **Registry Address**: `gateway.tail9a6ddb.ts.net:5000`
- **Protocol**: Plain HTTP inside the Tailscale network (traffic is encrypted at the WireGuard layer).
- **Daemon Allowlist**: The Docker daemon must explicitly configure `insecure-registries: ["gateway.tail9a6ddb.ts.net:5000"]`.
- **Image Naming**: `gateway.tail9a6ddb.ts.net:5000/subagentes-venue-service:<tag>`.
  - Releases must push: `vM.m.p` -> `M.m.p`, `M.m`, `M` (for $\ge 1.0.0$), and `latest`.

### 6.2 Dockerfile Best Practices
- **Multi-Stage Builds**: Distinct `build` stage (with SDK/compilers) and `runtime` stage (minimal base image: `alpine`, `distroless`, or `slim`).
- **Least Privilege**: Run containers as non-root users (`USER appuser`).
- **Layer Caching**: Copy dependency descriptors and install dependencies *before* copying application source code.

---

## 7. Platform Deployment via Shrine & Traefik Gateway

### 7.1 The Shrine Deployment Model
The homelab runs on **Shrine**, a lightweight declarative container platform:
- **Manifest Source of Truth**: All deployments are declared in YAML manifests housed in the central repository:  
  `https://github.com/CarlosHPlata/malevolent-shrine` (`manifests/apps/subagentes/venue-service.yml`).
- **Team Manifest**: Registered at `manifests/teams/subagentes.yml`.
- **Resources**: Backing database declared as `manifests/apps/subagentes/venue-db.yml` (`kind: Resource`).
- **Deployment Execution**: From the app-server:
  ```bash
  cd ~/manifests
  git pull
  shrine deploy --dry-run   # Inspect planned diff
  shrine deploy             # Apply changes
  ```

### 7.2 Tailscale Gateway & Path-Prefix Routing
All external traffic arrives through the Tailscale Gateway (`gateway.tail9a6ddb.ts.net`) governed by Traefik:
- **Mandatory Subpath**: `venue-service` is routed under: `https://gateway.tail9a6ddb.ts.net/venues`.
- **Application Routing Block**:
  ```yaml
  apiVersion: shrine/v1
  kind: Application
  metadata:
    name: venue-service
    owner: subagentes
  spec:
    image: 192.168.1.206:5000/subagentes-venue-service:latest
    port: 8080
    routing:
      domain: subagentes.venue-service.internal
      aliases:
        - host: gateway.tail9a6ddb.ts.net
          pathPrefix: /venues
          stripPrefix: true     # Strips /venues prefix before passing to container
          tls: true             # Required for HTTPS termination
    networking:
      exposeToPlatform: true    # CRITICAL: attaches container to platform network
    dependencies:
      - kind: Resource
        name: venue-db
        owner: subagentes
    env:
      - name: BASE_URL
        value: "https://gateway.tail9a6ddb.ts.net/venues"
      - name: DATABASE_URL
        valueFrom: resource.venue-db.url
  ```

---

## 8. Release Tiers & Promotion Policy

Releases are mapped directly to Semantic Versioning tags:

| Version Level | Tag Pattern | Target Environment | Deployment Trigger | Published Artifacts |
|---|---|---|---|---|
| **Major** | `v2.0.0` | **Production & Dev** | Auto-promoted to all platform clusters | Docker image + OpenAPI spec + Release notes |
| **Minor** | `v1.5.0` | **Dev Environment** | Deployed to dev cluster for testing | Docker image + OpenAPI spec + Release notes |
| **Patch** | `v1.4.3` | **Local / Staging** | Not deployed automatically | Docker image + OpenAPI spec + Release notes |

Never alter or delete pushed git tags. If a release is flawed, patch the issue and publish the next incremental tag.

---

## 9. Available Agent Skills & Reference Index

Specialized skills conforming to the Agent Skills standard are located in the `skills/` directory:

| Skill | Directory | Description & Usage Scenario |
|---|---|---|
| **Repository Setup** | `skills/repository-setup/` | Setting up and verifying the 11 repository prerequisites, commit hooks, linters, and baseline pipelines. |
| **Spec-Driven Dev** | `skills/spec-driven-development/` | Executing ticket implementations via Spec Kit and OpenSpec with test-first rigor and spec governance. |
| **Docker Registry Push** | `skills/docker-registry-push/` | Configuring GitHub Actions to build, tag, and push container images to the tailnet registry via OIDC. |
| **Shrine Deployment** | `skills/shrine-platform-deployment/` | Authoring Shrine Application/Resource manifests, datastore provisioning, and executing CLI deployments. |
| **Gateway Routing** | `skills/gateway-routing/` | Configuring Traefik path prefixes, solving subpath asset 404s/502s, and managing reverse proxy rules. |
| **OpenAPI Contract Design** | `skills/openapi-contract-design/` | Designing contract-first APIs, setting up headless spec generator scripts across stacks, and contract tests. |
| **Release Management** | `skills/release-management/` | Managing SemVer tags, using `scripts/bump.sh`, and generating markdown changelogs from commits. |
| **Ticket D-Saster Domain** | `skills/ticket-dsaster-architecture/` | Deep architectural blueprints, C4 container mappings, DDD entities, and high-concurrency seat hold patterns. |
| **Resilience & Observability**| `skills/resilience-and-observability/` | Implementing circuit breakers, exponential backoff, healthchecks (`/health`, `/ready`), and Prometheus/Loki metrics. |
| **Daily Scrum** | `skills/daily-scrum/` | Structuring 15-minute daily standups around the Sprint Goal, ticket progression, and parking lot management. |

---

## 10. Summary Checklist for Every Task
Before starting and upon concluding any task:
1. **Did you consult [`context/product/now.md`](./context/product/now.md) to verify the active MVP phase and requirements?** (Never assume past scope!)
2. **Did you verify [`context/architechture/arch.md`](./context/architechture/arch.md) to ensure your changes adhere to container and subdomain boundaries for `venue-service`?**
3. Did you verify that your changes satisfy the functional and non-functional requirements?
4. Did you run the stack linter and ensure zero warnings or errors?
5. Did you execute the unit test suite and verify that all tests pass?
6. Are all commit messages formatted as `type(scope): description (TICKET-ID)`?
7. If modifying backend API endpoints, did you regenerate and verify the static OpenAPI definition?
8. If working within an SDD workflow, did you update or archive the specification files?