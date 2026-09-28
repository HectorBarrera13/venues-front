---
name: code-documentation
description: >-
  Enforces minimal, high-signal inline code documentation. ALWAYS apply when writing, reviewing, or generating code that includes comments, docstrings, JSDoc, KDoc, or any inline explanation. Also trigger when asked to "add comments", "document this", "explain the code", or "add docs to the code". Trigger on keywords: comment, JSDoc, KDoc, docstring, inline doc, annotate code, explain code, document function. Apply automatically — do not wait for explicit user request.
---

# Code Documentation — Minimal & High-Signal

Apply ALL rules below when writing or reviewing inline documentation. The goal is zero noise, maximum signal.

---

## LANGUAGE CONTEXT — Read this first

Detect the active language and use the correct documentation format. The rules for WHAT to document are identical across all languages — only the syntax differs.

| Language                | Function/method doc format                                   | Inline comment | Block comment    |
| ----------------------- | ------------------------------------------------------------ | -------------- | ---------------- |
| TypeScript / JavaScript | `/** JSDoc */` — use `@param`, `@returns`, `@throws`         | `//`           | `/* */`          |
| Python                  | `"""Docstring"""` — use Google style or NumPy style          | `#`            | `"""` multi-line |
| Java / Kotlin           | `/** Javadoc / KDoc */` — use `@param`, `@return`, `@throws` | `//`           | `/* */`          |
| C#                      | `/// <summary>` XML doc comments                             | `//`           | `/* */`          |
| Go                      | Plain `// FunctionName ...` comment above func (godoc style) | `//`           | `/* */`          |
| Rust                    | `/// Outer doc comment` (rustdoc)                            | `//`           | `/* */`          |
| Swift                   | `/// Swift doc comment`                                      | `//`           | `/* */`          |

**Go note:** Go uses `godoc` conventions — the comment MUST start with the function name and be a plain English sentence. No `@param` tags. Parameter docs go in the description prose.

**Python note:** Docstrings are the only mechanism for function docs — inline `#` above the `def` is NOT the Python convention for function documentation. Always use `"""..."""` inside the function body.

**Rust note:** `///` compiles into documentation. `//!` documents the containing module. Use `///` for public items always; `//` for internal implementation notes.

---

## CORE PRINCIPLE — Comments explain WHY, not WHAT

Code already shows WHAT it does. A comment that restates the code is pure noise and MUST be removed.

**Violation — restating the code (applies to ALL languages):**

```ts
// increment counter by 1
counter++;
```

```python
# check if user is active
if user.is_active:
```

```go
// return the order
return order
```

All of the above should have zero comments.

---

## RULE 1 — When to write a comment

Write a comment ONLY when one or more of these conditions is true:

| Condition                         | Example trigger                                            |
| --------------------------------- | ---------------------------------------------------------- |
| **Non-obvious WHY**               | A business rule that isn't derivable from the code         |
| **Counter-intuitive code**        | Something that looks wrong but is intentional              |
| **Edge case being handled**       | A specific input condition that requires special treatment |
| **Known limitation or tech debt** | A deliberate shortcut with a reason                        |
| **External constraint**           | "API requires X format despite Y being standard"           |

If none of these apply, write NO comment.

---

## RULE 2 — Edge case comments

Edge cases MUST be documented inline, immediately before the guard or branch that handles them. The comment MUST state: (1) what the edge case is, and (2) why it is handled this way.

```ts
// TypeScript
// Orders with zero-quantity items can reach this state when a product
// is discontinued mid-fulfillment. Treat as fulfilled to avoid blocking
// the pipeline — inventory reconciliation handles the delta.
if (order.items.every((i) => i.quantity === 0)) {
  return order.markFulfilled();
}
```

```python
# Python
# Stripe webhooks may deliver the same event more than once.
# Idempotency key check prevents double-charging.
if await self.idempotency.exists(event.id):
    return
```

```go
// Go
// net.Dial returns a non-nil Conn even when err != nil on some platforms.
// Always check err first before using conn to avoid a nil-dereference panic.
conn, err := net.Dial("tcp", addr)
```

**Forbidden edge case comment style (all languages):**

```ts
// handle edge case
if (order.items.every(i => i.quantity === 0)) { ... }
// ↑ says nothing — what edge case? why this handling?
```

---

## RULE 3 — Function/method documentation

Document a function ONLY if its signature alone does not make the contract clear. When documenting, include only what the signature does NOT already say.

- MUST document: non-obvious params, return value semantics, thrown exceptions or returned errors, side effects
- MUST NOT document: params whose names are self-explanatory, the return type (already in signature), what the function does restated in prose

**Violation — noise (TypeScript):**

```ts
/**
 * Gets the user by ID.
 * @param id - the user id
 * @returns the user
 */
async getUser(id: string): Promise<User>
```

**Correct — adds non-obvious contract (TypeScript):**

```ts
/**
 * @param windowMs - rolling window in milliseconds; resets on each call
 * @throws {RateLimitExceeded} if more than `limit` calls occur within the window
 */
async throttle(key: string, limit: number, windowMs: number): Promise<void>
```

**Correct — Python (Google style docstring):**

```python
def throttle(self, key: str, limit: int, window_ms: int) -> None:
    """
    Args:
        window_ms: Rolling window in milliseconds; resets on each call.
    Raises:
        RateLimitExceeded: If more than `limit` calls occur within the window.
    """
```

**Correct — Go (godoc):**

```go
// Throttle enforces a rate limit for the given key.
// windowMs is a rolling window that resets on each call.
// Returns ErrRateLimitExceeded if limit is exceeded within the window.
func (r *Limiter) Throttle(key string, limit int, windowMs int) error
```

**Correct — Java (Javadoc):**

```java
/**
 * @param windowMs rolling window in milliseconds; resets on each call
 * @throws RateLimitExceededException if more than {@code limit} calls occur within the window
 */
void throttle(String key, int limit, int windowMs);
```

---

## RULE 4 — TODO and FIXME format

Tech debt markers MUST include the reason and ideally a ticket reference. Bare markers with no context are forbidden in all languages.

**Violation:** `// TODO: fix this` / `# FIXME` / `// TODO`

**Correct:**

```ts
// TODO(PROJ-412): replace with domain event — currently bypasses the aggregate
```

```python
# FIXME: O(n²) — acceptable for <100 items but must be indexed before launch
```

```go
// TODO(github.com/org/repo/issues/88): replace polling with webhook subscription
```

---

## RULE 5 — Comment placement and length

- Comments MUST be placed immediately above the code they explain — never at end-of-line for multi-word explanations
- End-of-line comments: only for very short labels (≤ 5 words)
- NEVER comment out dead code — delete it; version control preserves history (applies to all languages)

---

## Pre-output checklist

Before presenting any documented code, verify:

- [ ] Language detected — using the correct doc format from the table above
- [ ] Every comment explains WHY or a non-obvious constraint — none restate the code
- [ ] Edge case comments state what the case is AND why it's handled this way
- [ ] Function docs present only when the signature alone is insufficient
- [ ] No param/return docs that just repeat the name or type
- [ ] TODOs include reason and ticket reference
- [ ] No commented-out dead code
- [ ] Go: function comments start with the function name (godoc convention)
- [ ] Python: function docs use docstrings inside the body — not `#` above `def`
