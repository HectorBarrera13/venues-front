---
name: gateway-routing
description: Configure and troubleshoot HTTP and HTTPS reverse proxy routing through the Tailscale Traefik gateway (gateway.tail9a6ddb.ts.net). Handles path prefixes, stripPrefix settings, subpath asset resolution across frameworks (Next.js, Spring Boot, Flask, Django, Laravel), and operator-owned dynamic Traefik configurations. Use when exposing services or diagnosing 404/502 errors and broken web assets.
---

# Gateway & Traefik Routing Skill

This skill provides configuration standards, troubleshooting flows, and framework adaptors for routing applications through the central Tailscale Traefik reverse proxy at `https://gateway.tail9a6ddb.ts.net`.

---

## 1. Gateway Architecture & Core Constraints

1. **Shared Platform Gateway**: All traffic enters via `gateway.tail9a6ddb.ts.net`.
2. **Mandatory Subpath**: There is **no root host escape hatch**. Every service must live under a unique path prefix: `https://gateway.tail9a6ddb.ts.net/<app-name>`.
3. **Network Isolation**: By default, containers cannot communicate with Traefik unless `networking.exposeToPlatform: true` is explicitly declared.
4. **Operator Ownership of Dynamic Routes**: Shrine generates `~/manifests/traefik/dynamic/<team>-<app>.yml` on first deploy. After generation, the file is treated as operator-owned. Shrine will **not** overwrite manual customizations, nor will it automatically update routing parameters changed in the manifest without manual intervention.

---

## 2. Configuration Standards

In your Shrine `Application` manifest:

```yaml
spec:
  networking:
    exposeToPlatform: true     # Required: joins the platform Traefik network
  routing:
    domain: <team>.<app>.internal # Required convention
    aliases:
      - host: gateway.tail9a6ddb.ts.net
        pathPrefix: /<app>        # Must be platform-unique
        stripPrefix: true         # Standard: strips prefix before reaching container
        tls: true                 # Terminates Tailscale TLS
```

### The Rule of Thumb for `stripPrefix`:
- Use `stripPrefix: true` + configure the application's base path setting.
- Use `stripPrefix: false` **only** if the application's internal web server (e.g. custom nginx) is explicitly programmed to listen on and rewrite `/<app>`.

---

## 3. Systematic Troubleshooting Matrix

| Symptom | Probable Root Cause | Resolution Action |
|---|---|---|
| **404 "Page Not Found" (Traefik styled)** | Traefik matched no router. Missing `exposeToPlatform: true`, dynamic route file missing, or wrong path prefix. | 1. Check `ls ~/manifests/traefik/dynamic/`.<br>2. Confirm container is running.<br>3. Inspect `docker logs platform.traefik --tail 50`. |
| **502 Bad Gateway** | Container unreachable or listening on a different port than specified in manifest. | 1. Inspect app logs: `docker logs <team>.<app> --tail 50`.<br>2. Verify port in manifest matches app listening port. |
| **Asset 404s (`.css`, `.js` missing)** | Asset paths rendered without prefix (e.g. `/dist/style.css` instead of `/<app>/dist/style.css`). | Configure the app's `BASE_URL` / `basePath` (see `references/framework-subpath-cheat-sheet.md`). |
| **Login redirects to root** | App emits absolute redirect URLs without knowing its gateway path prefix. | Set `APP_URL=https://gateway.tail9a6ddb.ts.net/<app>` or `BASE_URL`. |
| **Stale routing after manifest edit** | Dynamic Traefik YAML was not regenerated. | `rm ~/manifests/traefik/dynamic/<team>-<app>.yml` and run `shrine apply -f <app>.yml`. |
| **TLS certificate warning in browser** | Tailscale root CA is not installed in OS certificate store. | Import CA from `https://login.tailscale.com/ca` into "Trusted Root Certification Authorities". |

---

## 4. Custom Traefik Middlewares

When rate-limiting, custom headers, or authentication middlewares are required, edit `~/manifests/traefik/dynamic/<team>-<app>.yml` directly. Traefik automatically hot-reloads valid YAML changes within ~1 second without container restarts. (See `examples/traefik-dynamic-route.yml`).
