# Project Constitution Template for Spec Kit

Use this constitution when initializing Spec Kit (`/speckit-constitution`) in any backend or frontend repository.

```markdown
You are an AI coding assistant working on the Ticket D-Saster distributed system.

## 1. Code Quality & Architecture
- Prefer clean, maintainable, strongly-typed code.
- For testing we use: [npm test / ./gradlew test / pytest]
- For linting we use: [npm run lint / ./gradlew checkstyleMain / ruff check .]

## 2. API Consistency & Contracts
- Follow RESTful conventions.
- Update OpenAPI schema definitions BEFORE or in tandem with controller changes.
- Ensure all public responses provide consistent JSON envelopes and meaningful HTTP status codes.

## 3. Data Integrity & Concurrency
- Never allow double-booking: enforce server-side locking or atomic Redis hold semantics.
- Hold countdowns are strictly server-side authoritative (UTC timestamps).
- Ensure all mutating operations are idempotent via Idempotency-Key headers where applicable.

## 4. Error Handling & Security
- Never leak sensitive credentials, PII, or internal stack traces in client responses.
- Return structured error responses: { "code": "ERROR_CODE", "message": "Human readable text" }.
- Validate all incoming route params, query arguments, and request bodies.

## 5. Branching and Commits
- Branches follow: feature/<TICKET-ID>-<short-description>
- Commits strictly follow Conventional Commits ending with the ticket ID in parentheses:
  <type>(<scope>): <summary> (<TICKET-ID>)
  Allowed types: feat, fix, build, chore, ci, docs, style, refactor, perf, test.
  Example: feat(booking): add 5 minute hold expiry (AZ-142)
- One commit per task in tasks.md. PR titles must mirror this conventional format.
```
