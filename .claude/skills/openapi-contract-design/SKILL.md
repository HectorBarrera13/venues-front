---
name: openapi-contract-design
description: Design, generate, and maintain contract-first REST APIs using OpenAPI 3.x. Enforce headless specification exports across backend stacks (.NET, Node/TS, Java Spring Boot, Python, PHP), manage versioned contracts in release pipelines, and apply SemVer breaking change rules. Use when designing API endpoints or implementing prerequisite 7.
---

# OpenAPI Contract Design & Generation Skill

This skill governs API contract design, automated headless specification generation, and contract-first workflows across all backend microservices in Ticket D-Saster.

---

## 1. Contract-First Principles

1. **The Contract is the Authority**: Backend services integrate via published, versioned OpenAPI contracts, not direct code dependencies or database sharing.
2. **Headless Generation Requirement**: Per **Prerequisite 7**, the repo must expose a command that writes `openapi.json` or `openapi.yaml` to disk **without starting a web browser or requiring a running Swagger UI**.
3. **Artifact Publishing**: The GitHub Actions release pipeline automatically generates and attaches `openapi.yml` to the GitHub release on every version tag (`v*.*.*`).
4. **Consumer-Driven Contracts**: Client teams (such as front-end teams or upstream microservices) write contract tests against published specs to verify compatibility without needing live dependencies running in memory.

---

## 2. Breaking vs. Non-Breaking API Changes

When modifying API endpoints or schemas, classify changes strictly according to Semantic Versioning:

### Non-Breaking Changes (Eligible for Minor or Patch releases)
- Adding a new optional request header, query parameter, or JSON property.
- Adding a new response field to existing endpoints.
- Adding a brand-new endpoint (`POST /events/{id}/categories`).
- Relaxing a validation constraint (e.g. extending allowed character length).

### Breaking Changes (Requires a MAJOR version bump, e.g. `v1.x` -> `v2.0`)
- Renaming or removing an endpoint or HTTP method.
- Making a previously optional request parameter mandatory.
- Removing or renaming an existing response attribute.
- Modifying the data type or format of an existing field (e.g. integer ID to UUID string).
- Changing response HTTP status codes for existing scenarios.

---

## 3. Headless Export Implementation by Technology Stack

Inspect `references/openapi-generators-by-stack.md` and use the pre-built scripts in `scripts/`:

### Node / TypeScript:
- **NestJS**: Execute `scripts/export-openapi-nestjs.ts` via `npm run openapi:generate`.
- **Fastify**: Execute `scripts/export-openapi-fastify.js` via `npm run openapi:generate`.
- **tsoa**: Run `npx tsoa spec`.

### Java / Spring Boot:
- Use `springdoc-openapi-gradle-plugin` (`./gradlew generateOpenApiDocs`) or Maven plugin (`mvn verify`).
- **Forbidden**: Do not use `SpringFox` (unmaintained, incompatible with Spring Boot 3+).

### Python:
- **FastAPI**: One-line command:
  ```bash
  python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json
  ```
- **Django REST Framework**: Use `drf-spectacular`:
  ```bash
  python manage.py spectacular --file openapi.yaml
  ```

### .NET 9+:
- Install `Microsoft.Extensions.ApiDescription.Server` and build:
  ```bash
  dotnet build --configuration Release
  ```
  Produces `<Project>.json` automatically.

---

## 4. Verification & Audit Flow

To verify prerequisite 7 in any backend repository:
```bash
# 1. Run the headless generation command
npm run openapi:generate    # (or equivalent stack command)

# 2. Assert the file exists and is valid JSON/YAML
test -f openapi.json -o -f openapi.yaml

# 3. Validate syntax with openapi-cli or spectral
npx @stoplight/spectral-cli lint openapi.json
```
