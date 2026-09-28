---
name: repository-setup
description: Verify, configure, and maintain repository compliance with the 11 mandatory team prerequisites (README, AGENTS.md, lint, test, git hooks, branch protection, headless OpenAPI generation, CI/CD pipelines, bump script, and /health endpoint). Use when onboarding a new service repository or auditing existing projects.
---

# Repository Setup & Prerequisites Skill

This skill provides step-by-step workflows and automated tooling to configure and audit any service repository within the Ticket D-Saster ecosystem to ensure 100% compliance with organizational prerequisites.

---

## 1. The 11 Mandatory Prerequisites Checklist

Every service repository in the organization must satisfy all 11 items. A failure in any single prerequisite prevents pull requests from being merged and blocks access to the container registry and deployment platform.

| # | Prerequisite | Verification Criteria | Stack Command Example |
|---|---|---|---|
| **1** | **`README.md`** | Explains service domain responsibility and step-by-step fresh clone setup. | N/A (Documentation) |
| **2** | **`AGENTS.md`** | Dedicated agent instructions with stack commands, conventions, and skill pointers. | N/A (Documentation) |
| **3** | **Linting Command** | Single command for static analysis & linting. Must return exit code 0 on clean code. | `npm run lint` / `ruff check .` / `./gradlew checkstyleMain` |
| **4** | **Unit Test Command** | Single command that runs isolated unit tests without external network dependencies. | `npm test` / `pytest` / `./gradlew test` |
| **5** | **Conventional Commits Hook** | Enforces format `<type>(<scope>): <summary> (<TICKET-ID>)`. Rejects non-conforming messages. | `.githooks/commit-msg` or husky |
| **6** | **Protected `main` Branch** | Direct pushes disabled in GitHub repository settings; PR review and green CI required. | GitHub Branch Protection Rule |
| **7** | **Headless OpenAPI Generation** | Backend only: produces `openapi.json` or `openapi.yaml` without opening a browser or server. | `npm run openapi:generate` / `./gradlew generateOpenApiDocs` |
| **8** | **PR Pipeline (`on_pr.yml`)** | GitHub Actions workflow executing lint and unit tests on every pull request. | `.github/workflows/on_pr.yml` |
| **9** | **Release Pipeline (`release.yml`)** | GitHub Actions workflow triggered by `v*.*.*` tags that builds Docker image, pushes to registry, and releases. | `.github/workflows/release.yml` |
| **10** | **Bump Version Script** | Executable script validating clean working tree, green CI, and running unit tests before tagging. | `scripts/bump.sh` |
| **11** | **Health Check Endpoint** | Backend only: returns HTTP 200 `{ "status": "ok" }` on unauthenticated `GET /health`. | `GET /health` |

---

## 2. Step-by-Step Setup Workflow

### Step 1: Install Git Hooks for Conventional Commits
Ensure teammates and agents cannot commit invalid commit messages:
1. Place the portable hook at `.githooks/commit-msg` (see `scripts/commit-msg`).
2. Make it executable:
   ```bash
   chmod +x .githooks/commit-msg
   git update-index --chmod=+x .githooks/commit-msg   # For Windows git environments
   ```
3. Configure git to use `.githooks` directory:
   ```bash
   git config core.hooksPath .githooks
   ```
4. If using Node.js, configure Husky:
   ```bash
   npx husky init
   echo 'bash .githooks/commit-msg "$1"' > .husky/commit-msg
   ```

### Step 2: Establish Single-Command Linting & Testing
Define standard scripts in your project manifest:
- **Node (`package.json`)**:
  ```json
  "scripts": {
    "lint": "eslint . && prettier --check .",
    "test": "jest --coverage"
  }
  ```
- **Java / Gradle (`build.gradle`)**:
  Expose `./gradlew checkstyleMain` (or Spotless) and `./gradlew test`.
- **Python (`pyproject.toml`)**:
  Configure `ruff check .` and `pytest`.

### Step 3: Implement Headless OpenAPI Generation (Backends)
Do not rely on Swagger UI. Configure code-first or schema-first generators that emit a versioned file to disk:
- **NestJS**: Use `scripts/export-openapi.ts` via `npm run openapi:generate`.
- **Spring Boot**: Use `springdoc-openapi-gradle-plugin` and run `./gradlew generateOpenApiDocs`.
- **FastAPI**: Run `python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json`.

### Step 4: Configure GitHub Actions PR Pipeline
Create `.github/workflows/on_pr.yml`:
- Trigger on `pull_request` to `main` and `push` to `main`.
- Install dependencies with lockfile (`npm ci`, `poetry install --no-root`, `./gradlew --no-daemon`).
- Run the lint command.
- Run the unit test suite.
- (See `examples/on_pr.yml` for reference implementation).

### Step 5: Implement Health Check Endpoint
Add route `GET /health`:
- Must return HTTP 200.
- Payload: `{"status": "ok"}` or `{"status": "UP"}`.
- Keep liveness `/health` independent from heavy external database connection pools to prevent cascade container restarts during database blips.

---

## 3. Repository Audit Procedure

When evaluating a repository for compliance, execute the following audit checklist:

1. **Verify git hook**:
   ```bash
   git commit -m "bad commit without type or ticket"   # Must FAIL
   git commit -m "feat(auth): valid commit message (AZ-101)"  # Must PASS
   ```
2. **Verify lint command**:
   Run the project's documented lint command; exit code must be `0`.
3. **Verify test suite**:
   Run the test command; must execute all tests without requiring external cloud/database connections.
4. **Verify headless OpenAPI generation**:
   Execute the openapi generation command; inspect that `openapi.json` or `openapi.yaml` is generated in the target directory without launching an HTTP listener.
5. **Verify `/health` endpoint**:
   Start the service locally and run:
   ```bash
   curl -i http://localhost:<port>/health
   ```
   Confirm status code is `200 OK` with JSON body.
