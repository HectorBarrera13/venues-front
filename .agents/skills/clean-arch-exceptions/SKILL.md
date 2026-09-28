---
name: clean-arch-exceptions
description: >-
  Enforces exception-based error handling conventions in Clean Architecture projects. ALWAYS apply when writing or reviewing use cases, domain logic, repositories, controllers, or any layer boundary in a clean arch context that uses exceptions for error flow. Trigger on keywords: exception, throw, catch, try/catch, error handling, domain exception, application exception, unchecked, checked, error propagation, clean arch errors. Apply automatically — do not wait for explicit user request.
---

# Error Handling — Exception Strategy (Clean Architecture)

Apply ALL rules below whenever writing or reviewing error handling code. No exceptions to the rules about exceptions.

---

## LANGUAGE CONTEXT — Read this first

Code examples in this skill use TypeScript as illustration. Before generating code, detect the active language and apply the equivalent construct from this table. The rules are identical across all languages — only the syntax differs.

| Concept               | TypeScript                                | Java / Kotlin                              | Python                                | C#                               | Go                                    |
| --------------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------------- | -------------------------------- | ------------------------------------- |
| Base domain exception | `class X extends DomainException {}`      | `class X extends RuntimeException`         | `class X(DomainException): pass`      | `class X : DomainException`      | `type X struct{ msg string }`         |
| Base app exception    | `class X extends ApplicationException {}` | `class X extends RuntimeException`         | `class X(ApplicationException): pass` | `class X : ApplicationException` | `type X struct{ msg string }`         |
| Unchecked exception   | All exceptions are unchecked              | Extend `RuntimeException`, NOT `Exception` | All exceptions are unchecked          | All exceptions are unchecked     | Errors are values — see Go note below |
| Throw                 | `throw new X()`                           | `throw new X()`                            | `raise X()`                           | `throw new X()`                  | `return nil, X{}`                     |
| Catch at boundary     | `catch (e)` + `instanceof`                | `catch (X e)` per type                     | `except X as e:` per type             | `catch (X e)` per type           | `if errors.As(err, &x)`               |
| Typed context fields  | constructor properties                    | constructor + final fields                 | `__init__` attributes                 | constructor properties           | struct fields                         |

**Go note:** Go has no exceptions. Apply the spirit of these rules using Go's error interface: define named error types per layer, translate infra errors at the adapter boundary, and never return raw `errors.New("...")` strings from domain or application code. Use `errors.As` for type-based dispatch at the boundary.

**Java note:** Java has checked exceptions — they exist at the infrastructure layer only. Domain and application exceptions MUST extend `RuntimeException` to stay unchecked. Never declare `throws` on use case or domain methods.

---

## RULE 1 — Exception hierarchy by layer

Each layer owns its exception types. NEVER throw an exception from an inner layer that leaks infrastructure or framework details to an outer layer.

```text
Domain exceptions       → pure business rule violations, no deps
Application exceptions  → use case pre/post condition failures
Infrastructure exceptions → translated INTO domain/application before crossing the boundary
```

**Domain exceptions — business language only:**

```ts
// TypeScript
class OrderAlreadyCancelled extends DomainException {}
class InsufficientStock extends DomainException {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super();
  }
}
```

```python
# Python equivalent
class OrderAlreadyCancelled(DomainException): pass

class InsufficientStock(DomainException):
    def __init__(self, requested: int, available: int):
        self.requested = requested
        self.available = available
```

**Infrastructure exceptions MUST be caught and translated at the adapter boundary — never let them leak:**

```ts
// TypeScript — VIOLATION: leaking DB error into use case
catch (e: PrismaClientKnownRequestError) { throw e }

// TypeScript — CORRECT: translate at the adapter
catch (e: PrismaClientKnownRequestError) {
  if (e.code === 'P2025') throw new OrderNotFound(id)
  throw new RepositoryUnavailable()
}
```

```java
// Java equivalent
catch (JpaObjectRetrievalFailureException e) {
    throw new OrderNotFoundException(id);
}
```

```python
# Python equivalent
except sqlalchemy.exc.NoResultFound:
    raise OrderNotFound(order_id)
```

---

## RULE 2 — Domain exceptions are unchecked

Domain and application exceptions MUST be unchecked. They represent business violations the caller must decide whether to handle — not forced contracts.

- **TypeScript / Python / C#:** All exceptions are unchecked by default. No extra steps needed.
- **Java / Kotlin:** MUST extend `RuntimeException`. Never extend `Exception` directly for domain or application errors.
- **Go:** Return named error types — never raw `fmt.Errorf("...")` strings from domain logic.

---

## RULE 3 — Exception naming

Exception names MUST describe the business fact that occurred, in past tense or noun form. No generic names.

**Allowed:** `OrderAlreadyCancelled`, `InsufficientStock`, `UserNotFound`, `DuplicateEmailAddress`

**Forbidden:**

- `OrderException` — too generic
- `HandleOrderError` — verb form, not a fact
- `OrderServiceException` — leaks layer name
- `Error` / `Exception` — meaningless

---

## RULE 4 — Use cases: throw, don't return errors

Use cases MUST throw domain/application exceptions for failure paths. They MUST NOT return null, error codes, or boolean flags to signal failure.

**Violation:**

```ts
async execute(id: string): Promise<Order | null> {
  const order = await this.repo.find(id)
  if (!order) return null   // caller has no idea why
}
```

**Correct (TypeScript):**

```ts
async execute(id: string): Promise<Order> {
  const order = await this.repo.find(id)
  if (!order) throw new OrderNotFound(id)
  return order
}
```

```python
# Python equivalent
def execute(self, order_id: str) -> Order:
    order = self.repo.find(order_id)
    if not order:
        raise OrderNotFound(order_id)
    return order
```

---

## RULE 5 — Exception handling belongs at the boundary

Catching and handling exceptions MUST happen at the outermost layer (controller, presenter, event handler). Inner layers MUST NOT swallow exceptions silently.

**Correct — controller boundary (TypeScript/Express):**

```ts
try {
  const result = await useCase.execute(cmd);
  return res.status(200).json(result);
} catch (e) {
  if (e instanceof OrderNotFound)
    return res.status(404).json({ error: e.message });
  if (e instanceof InsufficientStock)
    return res.status(422).json({ error: e.message });
  return res.status(500).json({ error: "Internal error" });
}
```

```python
# Python / FastAPI equivalent
try:
    result = use_case.execute(cmd)
    return JSONResponse(result)
except OrderNotFound as e:
    raise HTTPException(status_code=404, detail=str(e))
except InsufficientStock as e:
    raise HTTPException(status_code=422, detail=str(e))
```

```java
// Java / Spring equivalent — use @ExceptionHandler
@ExceptionHandler(OrderNotFoundException.class)
public ResponseEntity<ErrorResponse> handle(OrderNotFoundException e) {
    return ResponseEntity.status(404).body(new ErrorResponse(e.getMessage()));
}
```

---

## RULE 6 — Carry context in exceptions

Exceptions MUST carry enough typed data to diagnose the failure without requiring a stack trace read. No string concatenation.

```ts
// Violation
throw new Error(`Stock error: needed ${qty} but only ${available} left`);

// Correct (TypeScript)
throw new InsufficientStock({ requested: qty, available, sku });
```

```python
# Correct (Python)
raise InsufficientStock(requested=qty, available=available, sku=sku)
```

---

## Pre-output checklist

Before presenting any error-handling code, verify:

- [ ] Language detected — constructs match the language-specific table above
- [ ] Each exception named as a business fact (past tense or noun), no generic names
- [ ] Domain exceptions carry no infrastructure dependencies
- [ ] Infrastructure exceptions translated at the adapter boundary — none leak into use cases
- [ ] Use cases throw on failure — no null returns or error codes
- [ ] No exception swallowed silently inside a use case or domain service
- [ ] Exceptions carry typed context fields, not just a message string
- [ ] Catching and mapping to HTTP codes happens only at the outermost boundary
- [ ] Java: domain/app exceptions extend `RuntimeException` — not `Exception`
