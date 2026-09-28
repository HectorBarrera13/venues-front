# Framework Subpath Configuration Cheat Sheet

When running behind the gateway with `stripPrefix: true`, web applications and frontend SPAs must be instructed where they live so they render links and static asset tags with the proper path prefix (`/<app>`).

---

## 1. Next.js (`next.config.js` or `next.config.mjs`)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/d-saster',
  assetPrefix: '/d-saster',
  trailingSlash: false,
};
export default nextConfig;
```

---

## 2. Java Spring Boot (`application.yml` / Env Vars)
Configure context path via environment variables or YAML:
```yaml
server:
  servlet:
    context-path: /booking
```
Or with `stripPrefix: true`, tell Spring Boot about forwarded proxy headers:
```yaml
server:
  forward-headers-strategy: framework
```
Environment variables:
- `SERVER_SERVLET_CONTEXT_PATH=/booking`

---

## 3. Python: Flask
Run behind `ProxyFix` from Werkzeug:
```python
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.config['APPLICATION_ROOT'] = '/events'
```

---

## 4. Python: FastAPI
Set root path when initializing FastAPI:
```python
from fastapi import FastAPI

app = FastAPI(root_path="/events")
```

---

## 5. Python: Django (`settings.py`)
```python
FORCE_SCRIPT_NAME = '/venues'
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

---

## 6. PHP: Laravel (`.env`)
```ini
APP_URL=https://gateway.tail9a6ddb.ts.net/auth
ASSET_URL=https://gateway.tail9a6ddb.ts.net/auth
```

---

## 7. Node / Express / Fastify
Mount routers under the base prefix or use reverse-proxy prefix resolution:
```javascript
// Express
app.use('/search', router);

// Fastify
fastify.register(routes, { prefix: '/search' });
```
