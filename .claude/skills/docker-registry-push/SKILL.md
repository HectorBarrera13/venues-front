---
name: docker-registry-push
description: Configure GitHub Actions CI/CD workflows and local environments to securely build and push multi-tag SemVer Docker images to the platform container registry (gateway.tail9a6ddb.ts.net:5000) over Tailscale OIDC. Use when setting up or debugging release pipelines, Docker daemon allowlists, or registry authentication.
---

# Docker Registry Push & Tailscale CI Skill

This skill provides comprehensive instructions for integrating GitHub Actions repositories with the homelab container registry hosted behind Tailscale.

---

## 1. Registry Architecture & Security Rules

- **Registry Host & Port**: `gateway.tail9a6ddb.ts.net:5000`
- **Encryption Model**: WireGuard encrypts all packet traffic across the Tailscale mesh (tailnet). Therefore, the internal registry server operates over plain **HTTP**.
- **Docker Client Behavior**: Because the registry uses plain HTTP, Docker daemons will reject pushes and pulls with `http: server gave HTTP response to HTTPS client` unless explicitly configured with an insecure registry allowlist.
- **Image Namespacing Rule**: The registry is shared across all teams without write boundaries. To prevent namespace collisions or accidental image overwrites, **every image MUST be prefixed with `<team-name>-<service-name>`** (e.g. `gateway.tail9a6ddb.ts.net:5000/sap-atitos-booking:1.2.0`).

---

## 2. Onboarding Workflow (Team Lead & Repo Setup)

### Step 1: Obtain OIDC Subject Claim Prefix
In GitHub repository settings:
1. Navigate to **Settings → Actions → General → OpenID Connect (OIDC)**.
2. Locate and copy the **Default subject claim prefix**.

### Step 2: Request Registry Access via Discord
Open a **Repo registry access** ticket in the course Discord server. Submit:
- Repository URL.
- OIDC subject claim prefix.
- Designated team name.  
*(Must be requested by the Team Lead).*

### Step 3: Populate Repository Secrets
Once approved, configure the following repository secrets under **Settings → Secrets and variables → Actions**:
- `REGISTRY_USER`: Provided registry username.
- `REGISTRY_PASS`: Provided registry password.
- `TS_OAUTH_CLIENT_ID`: Tailscale OAuth Client ID.
- `TS_OAUTH_AUDIENCE`: Tailscale OAuth Audience.

---

## 3. GitHub Actions Pipeline Implementation

### Crucial Pipeline Principles:
1. **Trigger on Version Tags**: Only run on tags matching `v*.*.*`.
2. **Build Before Joining Tailnet**: Build the Docker image *before* establishing the Tailscale connection. During `docker build`, dependency managers (`npm ci`, `mvn`, `gradle`) run install scripts; untrusted third-party code must **not** have access to the private homelab network.
3. **Use the `docker` Driver for Buildx**: The default `docker-container` driver runs BuildKit in an isolated container that ignores `/etc/docker/daemon.json`. You must specify `driver: docker`.
4. **SemVer Tagging Strategy**:
   - `v1.2.3` pushes tags: `1.2.3`, `1.2`, `1`, and `latest`.
   - Versions below `1.0.0` (e.g. `v0.2.1`) do **not** publish major-only tags (`0`) to prevent breaking change aliasing.

*(See `examples/release-docker.yml` for complete workflow).*

---

## 4. Local Development: Pulling & Pushing Images

To interact with the registry from a local developer machine, the local Docker daemon must be configured with the insecure registry allowlist:

```json
{
  "insecure-registries": ["gateway.tail9a6ddb.ts.net:5000"]
}
```

### Quick Verification Steps:
1. Confirm daemon loaded config:
   ```bash
   docker info | grep -A3 "Insecure Registries"
   ```
2. Login to the registry:
   ```bash
   docker login gateway.tail9a6ddb.ts.net:5000
   ```
3. Verify connectivity without pushing unnecessary test images:
   ```bash
   curl -s -u <USER>:<PASS> http://gateway.tail9a6ddb.ts.net:5000/v2/_catalog
   ```

*(See `references/docker-daemon-configs.md` for OS-specific daemon file locations for Windows, Mac, Linux, WSL2, Colima, and OrbStack).*
