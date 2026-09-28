---
name: clean-arch-conventions
description: >-
  Enforces project-specific Clean Architecture conventions. ALWAYS apply this skill when the task involves any of the following: designing or scaffolding folder structure, creating or naming ports/interfaces, defining DTOs between layers, creating use cases, entities, or modules in a clean architecture context. Trigger on keywords: port, interface, DTO, use case, application layer, domain layer, repository, clean arch, scaffold, entity structure. Apply automatically — do not wait for explicit user request.
---

# Clean Architecture Conventions

Apply ALL rules below whenever designing, generating, or reviewing architecture. No exceptions.

---

## RULE 1 — Ports (Interfaces)

Ports MUST have descriptive, intent-revealing names. The name must express what the contract does, not what it is.

**Allowed:**

- `UserRepository`
- `SendWelcomeEmail`
- `FindActiveOrders`

**Forbidden:**

- `IUserRepo` — no `I` prefix
- `EmailInterface` — no `Interface` suffix
- `IOrderService` — both violations

**Single-method ports:** A single method CAN and SHOULD be its own interface. Model it as a single-method interface or function type depending on the language.

```ts
// TypeScript — function type as port
type SendWelcomeEmail = (userId: string) => Promise<void>;
```

```kotlin
// Kotlin — single-method interface as port
interface SendWelcomeEmail {
    fun invoke(userId: UserId)
}
```

**Placement:**

- Output ports (driven) → `domain/`
- Input ports (driving) → `application/`

---

## RULE 2 — Inter-layer DTOs

DTOs MUST have at most **7 ± 2 parameters** (acceptable range: 5–9; target ≤ 7).

If a DTO exceeds the limit, **nest related fields into child DTOs**. Never flatten everything into one flat object.

**Violation:**

```ts
CreateOrderDTO(userId, street, city, zip, country, sku, qty, price, coupon);
// 9 flat params — must be restructured
```

**Correct:**

```ts
CreateOrderDTO(
  buyer: BuyerDTO(userId),
  address: AddressDTO(street, city, zip, country),
  item: OrderItemDTO(sku, qty, price),
  coupon?: string
)
```

Rules for nested DTOs:

- Always suffix with `DTO`
- Make them reusable across use cases when they carry independent business meaning
- Nest as deep as needed — there is no nesting depth limit, only a width limit (7 ± 2 per level)

---

## RULE 3 — Folder Structure

### Root organization: by entity

Structure is organized **per entity**, not per technical type.

```text
<entity-name>/
├── application/    ← use cases, input ports, application DTOs
└── domain/         ← entities, value objects, output ports, domain services
```

If the language or framework conflicts with `application/` or `domain/` as folder names, choose the closest semantic alternative:

- `application/` → `app/`
- `domain/` → `core/`

### Scaffold principle: no premature grouping

> **Do NOT create a subfolder until there is more than one file of the same type, or grouping is clearly justified.**

This prevents empty or single-file folders. Apply per layer:

| Files present                | Correct structure                            |
| ---------------------------- | -------------------------------------------- |
| 1 port                       | flat file inside `application/` or `domain/` |
| 2+ ports                     | create `ports/` subfolder                    |
| 1 use case                   | flat file inside `application/`              |
| 2+ use cases                 | create `use-cases/` subfolder                |
| 1 domain entity              | flat file inside `domain/`                   |
| 2+ entities or value objects | create subfolders as needed                  |

**Few files (scaffold — correct):**

```text
order/
├── application/
│   ├── CreateOrder.ts        ← use case (flat, no subfolder yet)
│   ├── CreateOrderDTO.ts     ← DTO (flat)
│   └── OrderRepository.ts   ← port (flat, no /ports yet)
└── domain/
    └── Order.ts              ← entity (flat)
```

**Many files (grouped — correct):**

```text
order/
├── application/
│   ├── ports/
│   │   ├── OrderRepository.ts
│   │   └── SendOrderConfirmation.ts
│   ├── use-cases/
│   │   ├── CreateOrder.ts
│   │   └── CancelOrder.ts
│   └── dtos/
│       ├── CreateOrderDTO.ts
│       └── CancelOrderDTO.ts
└── domain/
    ├── Order.ts
    ├── OrderItem.ts
    └── OrderStatus.ts
```

---

## Pre-output checklist

Before presenting any structure or code, verify:

- [ ] All ports have descriptive names — no `I` prefix, no `Interface`/`Service` suffix used as type marker
- [ ] Single-method ports are modeled as single-method interfaces or function types
- [ ] All DTOs have ≤ 7 direct parameters; exceeded ones are nested
- [ ] Nested DTOs are suffixed with `DTO` and semantically coherent
- [ ] Root structure is organized by entity
- [ ] Scaffold principle applied — no folders created prematurely
- [ ] Alternative folder names used only when there is a real environment constraint
