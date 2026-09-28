---
name: shrine-platform-deployment
description: Author, validate, and deploy Shrine Application and Resource manifests to the homelab platform (malevolent-shrine). Covers datastore provisioning (Postgres, MariaDB, Redis), environment variable injection via valueFrom, network attachment, and app-server CLI operations (shrine deploy --dry-run). Use when onboarding a service to production/dev environments or debugging platform deployment issues.
---

# Shrine Platform Deployment Skill

This skill guides engineers and coding agents through the end-to-end deployment of microservices and backing resources on the **Shrine** homelab container platform.

---

## 1. The Shrine Deployment Model

- **Platform Manifest Repo**: The single source of truth for all deployed infrastructure:  
  `https://github.com/CarlosHPlata/malevolent-shrine`
- **Architecture**:
  ```text
  manifests/
  ├── teams/
  │   └── <team>.yml              # Team quota and registration
  └── apps/
      └── <team>/
          ├── <app>.yml           # Application manifests
          └── <resource>.yml      # Backing resources (Redis, Postgres, MariaDB)
  ```
- **Deployment Cycle**:
  1. Image built and pushed to `gateway.tail9a6ddb.ts.net:5000` (or `192.168.1.206:5000` on the app-server).
  2. Manifest files committed to `malevolent-shrine` via Pull Request.
  3. Manifests pulled onto the app-server and applied using `shrine deploy`.

---

## 2. Manifest Authoring Guide

### 2.1 Team Registration (`kind: Team`)
Before any app or resource can be deployed, the team must exist in `manifests/teams/<team>.yml`:
```yaml
apiVersion: shrine/v1
kind: Team
metadata:
  name: sap-atitos
spec:
  displayName: "Sap-atitos Booking Team"
  contact: lead@example.com
  quotas:
    maxApps: 5
    maxResources: 5
```

### 2.2 Declaring Backing Resources (`kind: Resource`)
Do not run embedded databases inside your application container. Declare them as Shrine Resources:
- **Redis**: Ideal for atomic holds and caches (see `examples/application-manifest.yml`).
- **Postgres**: Supports generated passwords and URL templating (see `examples/resource-postgres.yml`).
- **MariaDB**: Custom env var outputs for container bootstrapping (see `examples/resource-mariadb.yml`).

### 2.3 Application Manifest (`kind: Application`)
Crucial fields that must be configured correctly:
- `image`: The exact registry tag (e.g. `192.168.1.206:5000/<team>-<service>:latest`).
- `port`: The internal listening port of your container process (e.g. 8080 for Spring, 3000 for Node).
- `networking.exposeToPlatform: true`: **MANDATORY**. Connects the container to the platform network so Traefik can reach it.
- `routing.domain`: Primary convention `<team>.<app>.internal`.
- `routing.aliases`: Host `gateway.tail9a6ddb.ts.net`, unique `pathPrefix: /<app>`, `stripPrefix: true`, and `tls: true`.
- `dependencies`: Lists required resources. Shrine ensures dependencies start first, attaches them to a shared private network, and resolves `valueFrom` variables.
- `env.valueFrom`: Dynamic binding syntax `resource.<resource-name>.<output-name>`.

---

## 3. Deployment Procedure on the App-Server

Once manifest PR is merged to `main` on GitHub:

```bash
# 1. SSH into the app-server
ssh root@<app-server>

# 2. Pull the latest manifests
cd ~/manifests
git pull

# 3. Always run a dry run first to inspect the execution plan
shrine deploy --dry-run

# 4. If plan is clean, execute deployment
shrine deploy
```

---

## 4. Post-Deployment Verification

Verify the deployment in three strict phases:

```bash
# Phase 1: Container status
docker ps --filter "name=<team>.<app>"

# Phase 2: Application startup logs (look for initialization confirmation)
docker logs <team>.<app> --tail 50

# Phase 3: Traefik dynamic route loading
docker logs platform.traefik --tail 30
```

Test reachability from your local workstation (connected to Tailnet):
```bash
curl -i https://gateway.tail9a6ddb.ts.net/<app>/health
```
Must return HTTP 200 OK.

---

## 5. Iteration Workflows

- **Pushing code updates with same tag (`:latest`)**: Run `shrine deploy` on the app-server. Shrine detects the new image digest in the registry, pulls it, and restarts the container.
- **Manifest configuration changes (env vars, ports, resources)**: Edit manifest -> PR -> merge -> `git pull` on app-server -> `shrine deploy`.
- **Routing modifications (`pathPrefix`, `domain`)**: Note that the generated dynamic Traefik file at `~/manifests/traefik/dynamic/<team>-<app>.yml` is **operator-owned**. If you modify routing in the manifest, delete the dynamic Traefik file and redeploy:
  ```bash
  rm ~/manifests/traefik/dynamic/<team>-<app>.yml
  shrine apply -f ~/manifests/apps/<team>/<app>.yml
  ```
