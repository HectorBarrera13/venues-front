# OpenAPI Headless Generators by Technology Stack

Use this reference to satisfy **Prerequisite 7** across all engineering stacks.

---

## 1. Node.js & TypeScript
| Framework | Recommended Library | Export Method | Output Location |
|---|---|---|---|
| **NestJS** | `@nestjs/swagger` | Standalone script (`scripts/export-openapi.ts`) | `openapi.json` |
| **Fastify** | `@fastify/swagger` | Standalone script (`scripts/export-openapi.js`) | `openapi.yaml` |
| **Express / Any**| `tsoa` | `npx tsoa spec` | Configured in `tsoa.json` |

---

## 2. Java (Spring Boot)
| Tool | Build Tool | Execution Command | Output Location |
|---|---|---|---|
| `springdoc-openapi-gradle-plugin` | Gradle | `./gradlew generateOpenApiDocs` | `build/openapi.json` |
| `springdoc-openapi-maven-plugin` | Maven | `mvn verify` | `target/openapi.json` |

*Note: Never use SpringFox — it is dead and incompatible with Spring Boot 3+.*

---

## 3. Python
| Framework | Library / Tool | Execution Command | Output File |
|---|---|---|---|
| **FastAPI** | Built-in | `python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json` | `openapi.json` |
| **Django REST**| `drf-spectacular` | `python manage.py spectacular --file openapi.yaml` | `openapi.yaml` |
| **Flask** | `flask-smorest` | `flask openapi write openapi.json` | `openapi.json` |

---

## 4. .NET
| Tool | Mechanism | Command | Output File |
|---|---|---|---|
| `Microsoft.AspNetCore.OpenApi` (.NET 9+) | `Microsoft.Extensions.ApiDescription.Server` | `dotnet build` | `<Project>.json` |
| `Swashbuckle.AspNetCore.Cli` | CLI tool | `dotnet swagger tofile --output openapi.json <path-to-dll> v1` | `openapi.json` |
| `NSwag` | NSwag CLI | `nswag run nswag.json` | As specified in `nswag.json` |

---

## 5. PHP
| Framework | Library | Command | Output File |
|---|---|---|---|
| Any | `zircote/swagger-php` | `vendor/bin/openapi src -o openapi.yaml` | `openapi.yaml` |
| Laravel | `L5-Swagger` | `php artisan l5-swagger:generate` | `storage/api-docs/api-docs.json` |
| Laravel | `Scramble` | `php artisan scramble:export` | `api.json` |
| Symfony | `NelmioApiDocBundle` | `bin/console nelmio:apidoc:dump --format=yaml > openapi.yaml` | `openapi.yaml` |
