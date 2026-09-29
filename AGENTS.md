# AGENTS.md — Ticket D-Saster: Venues Microservice (`venue-service`)

Welcome to the **Venues Microservice** repository (`venue-service`), owned and developed by **Team SubAgentes** within the distributed **Ticket D-Saster** platform.

This file is the primary contract and operational guide for AI coding agents (and human engineers) collaborating on this codebase. Before writing or modifying any code in this repository, **you must read and strictly adhere to the standards, workflows, and constraints described here.**

---

## 🏛️ Repository Identity & Service Context

## MANDATORY CONTEXT CONSULTATION (`context/`)

> [!IMPORTANT]
> **BEFORE STARTING ANY TASK OR WORK, YOU MUST CONSULT THE `context/` DIRECTORY.**  
> Foundational system knowledge and evolving product requirements live under `output/context/`:
> 1. **[`context/CONTEXT.md`](./context/CONTEXT.md) — The general context of the Ticket D-Saster platform**
> 2. **[`context/architechture/`](./context/architechture/) — The Static Architecture Baseline**:
>    - Houses [`arch.md`](./context/architechture/arch.md) and authoritative diagrams in [`diagrams/`](./context/architechture/diagrams/) (`Level-1-System.png`, `Level-2-Container.png`, `domain.png`).
>    - This documentation is **more static**: it defines the macro architecture, C4 container topologies, the 5 microservice team boundaries (`Error200`, `Sap-atitos`, `Ninjava`, `Aura`, `SubAgentes`), and DDD subdomains.

---

## 1. Project & System Overview

### 1.1 The Domain: Ticket D-Saster
Ticket D-Saster is a high-concurrency ticket sales and venue management platform. It allows:
- **Venue Owners** (our primary user) to register physical venues, sections, rows, and seats once, maintaining authoritative physical layouts.
- **Organizers** to publish events hosted at registered venues, assign tiered seat categories and pricing, and schedule ticket drops (on-sale dates/times).
- **Fans & Buyers** to search events (by artist, date, venue, location), view live seat maps, hold seats in 5-minute reservations, queue under heavy load, and securely purchase tickets with QR code issuance.
- **Event Staff** to scan and validate tickets at gate checkpoints.

### 1.2 Team Topologies & Microservice Architecture (C4 Level 2)
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

## 4. Docker & Container Registry Rules

### 4.1 Homelab Registry Configuration
- **Registry Address**: `gateway.tail9a6ddb.ts.net:5000`
- **Protocol**: Plain HTTP inside the Tailscale network (traffic is encrypted at the WireGuard layer).
- **Daemon Allowlist**: The Docker daemon must explicitly configure `insecure-registries: ["gateway.tail9a6ddb.ts.net:5000"]`.
- **Image Naming**: `gateway.tail9a6ddb.ts.net:5000/subagentes-venue-service:<tag>`.
  - Releases must push: `vM.m.p` -> `M.m.p`, `M.m`, `M` (for $\ge 1.0.0$), and `latest`.

### 4.2 Dockerfile Best Practices
- **Multi-Stage Builds**: Distinct `build` stage (with SDK/compilers) and `runtime` stage (minimal base image: `alpine`, `distroless`, or `slim`).
- **Least Privilege**: Run containers as non-root users (`USER appuser`).
- **Layer Caching**: Copy dependency descriptors and install dependencies *before* copying application source code.

---

## 5. Summary Checklist for Every Task
Before starting and upon concluding any task:
1. **Did you consult [`context/product/now.md`](./context/product/now.md) to verify the active MVP phase and requirements?** (Never assume past scope!)
2. **Did you verify [`context/architechture/arch.md`](./context/architechture/arch.md) to ensure your changes adhere to container and subdomain boundaries for `venue-service`?**
3. Did you verify that your changes satisfy the functional and non-functional requirements?
4. Did you run the stack linter and ensure zero warnings or errors?
5. Did you execute the unit test suite and verify that all tests pass?
6. Are all commit messages formatted as `type(scope): description (TICKET-ID)`?
7. If modifying backend API endpoints, did you regenerate and verify the static OpenAPI definition?
8. If working within an SDD workflow, did you update or archive the specification files?