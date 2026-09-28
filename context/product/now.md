# Current Product State: MVP 03 (Partner Access)

> **IMPORTANT NOTICE FOR AI AGENTS & ENGINEERS:**  
> This file is the **dynamic source of truth** for the current development phase of Ticket D-Saster. The product roadmap is iterative and constantly evolving. **Always check this file before picking up any ticket or generating code**, as requirements, priorities, and active MVP scopes change frequently.

---

## 🎯 Our Team & Service Context

> [!IMPORTANT]
> **WE ARE TEAM `SubAgentes` WORKING ON THE VENUES MICROSERVICE (`venue-service`).**  
> Our primary bounded context is the **Venues Domain** (venue registration, physical geometries, section/seat mapping) and the partner venue management views in **`Backstage`**.  
> In every task, consider how changes affect the `venue-service` codebase, its REST contracts, and its interactions with `auth-service` (Team Ninjava) and `event-service` (Team Aura).

---

## 1. Current Phase: MVP 03 — Partner Access

We are currently working on **MVP 03: Partner Access**. This phase unlocks secure, invitation-only account creation, authentication, and role-based access control (RBAC) for the platform's commercial partners (Venue Owners and Organizers).

### 1.1 Relationship to Previous MVPs & Our Service
- **[MVP 01 — Venue and Event Registration](./mvp-01.md)**: We established the baseline catalogue models for venues (`VE-01`, `VE-02`, `VE-03`). Crucially, requirements `VE-02`, `VE-07`, and `VE-08` explicitly mandate that venue registrations require a signed-in partner carrying a verified JWT with the `VENUE_OWNER` role. **MVP 03 fulfills this dependency.**
- **[MVP 02 — Event Search and Purchase](./mvp-02.md)**: Established unauthenticated visitor search and simple ticket issuance. That fan-facing journey remains unauthenticated by design and does not require partner logins.
- **[MVP 03 — Partner Access](./mvp-03.md)**: **ACTIVE NOW**. Enforces that only invited partners can register, sign in, obtain an 8-hour JWT, and access the role-restricted sections of the `Backstage` portal.

---

## 2. Active Requirements & Acceptance Criteria Breakdown

All current engineering tasks must satisfy the following 10 requirements:

| ID | Requirement | Key Acceptance Criteria |
|---|---|---|
| **PA-01** | Staff-generated invitations | • Programmatic endpoint (no UI screen) requiring staff credentials.<br>• Generates a unique, cryptographically random invitation code bound to a specific role (`VENUE_OWNER` or `ORGANIZER`). |
| **PA-02** | Partner registration with code | • Form accepts `username`, `password`, and `invitationCode` (all mandatory).<br>• Rejects invalid or nonexistent codes.<br>• On success, account is created and partner is prompted to sign in. |
| **PA-03** | Single-use invitation codes | • Successful registration consumes the code; subsequent registration attempts with the same code are rejected.<br>• Failed attempts (e.g. username taken) do **not** consume the code. |
| **PA-04** | Role determined by invitation | • Account role is derived exclusively from the invitation record.<br>• No role selection option in registration form.<br>• Exactly one role per account. |
| **PA-05** | Unique usernames | • Usernames must be globally unique across all accounts.<br>• Rejects duplicates with a clear unavailability message. |
| **PA-06** | Password security | • Minimum length $\ge 8$ characters.<br>• Passwords must be hashed using a dedicated one-way cryptographic hashing algorithm (e.g. bcrypt, Argon2). Never store or log plain text. |
| **PA-07** | Partner sign-in | • Valid credentials unlock Backstage access.<br>• Invalid credentials return a generic rejection message (does not disclose whether username or password was wrong). |
| **PA-08** | Verifiable JWT proof of identity | • Successful sign-in emits a signed JSON Web Token (JWT).<br>• Contains partner identity (`sub` or `userId`) and role (`role`).<br>• Tamper-proof signature verifiable by any microservice across the platform.<br>• **Expires in 8 hours**; expired tokens are rejected, requiring re-login. |
| **PA-09** | Role-based Backstage access | • **Venue Owner**: Can access venue registration endpoints only.<br>• **Organizer**: Can access event registration endpoints only.<br>• Enforced server-side at the API gateway / microservice controller level, not just hidden in the UI. |
| **PA-10** | Sign-out | • Clears active token session; subsequent Backstage requests require fresh sign-in. |

---

## 3. Scope for the Venues Microservice (`venue-service`) in MVP 03

As Team **SubAgentes** maintaining `venue-service`, our active responsibilities for MVP 03 are:

1. **JWT Verification in `venue-service` (`PA-08`)**:
   - Intercept incoming HTTP requests on venue endpoints (e.g. `POST /venues`).
   - Validate the signature and 8-hour expiration of the `Authorization: Bearer <token>` header issued by `auth-service` (Team Ninjava).
2. **Server-Side Role Enforcement (`PA-09`, `VE-07`, `VE-08`)**:
   - Enforce that **only users with `role: "VENUE_OWNER"`** can create or modify venues.
   - If an `ORGANIZER` attempts to call `POST /venues`, the service **must reject the request with HTTP 403 Forbidden**.
   - If no token or an invalid/expired token is provided, reject with **HTTP 401 Unauthorized**.
3. **Partner Attribution (`VE-02`)**:
   - The stored venue record must save the `ownerId` extracted directly from the verified JWT claims (`sub` or `userId`).
   - **Never** trust or extract the owner identity from the request body or query parameters.
4. **Venue Catalogue Availability for Organizers (`VE-03`)**:
   - Ensure `GET /venues` is available so that Organizers (Team Aura) can retrieve registered venues when scheduling events.
5. **Backstage Frontend Integration (Shared with Aura)**:
   - Ensure the Venue Owner UI in `Backstage` attaches the JWT bearer token to all calls made to `https://gateway.tail9a6ddb.ts.net/venues`.

---

## 4. Explicitly Out of Scope for Current Phase

Do **not** over-engineer or implement the following capabilities during MVP 03:
- ❌ Complex seat map polygons, sections, rows, or interactive seat geometry (deferred to future MVPs; basic name/description/location only per MVP 01).
- ❌ Fan / buyer accounts (fans remain unauthenticated visitors per MVP 02).
- ❌ Email delivery of invitation codes (staff hand codes directly to partners).
- ❌ Administrative UI screens for staff to manage or revoke invitations.
- ❌ Password reset, "forgot password", or account recovery flows.
- ❌ Multi-role accounts or account editing/deletion.
- ❌ OAuth2 / social login / SSO / Multi-Factor Authentication (MFA).

---

## 5. Technical Directives & Testing Checklist for `venue-service`

1. **Token Transport**: Incoming requests to `venue-service` must carry:  
   `Authorization: Bearer <jwt-token>`
2. **Automated Tests Required**:
   - `test(venues): reject venue creation when authorization header is missing (401 Unauthorized)`
   - `test(venues): reject venue creation when role is ORGANIZER (403 Forbidden)`
   - `test(venues): allow venue creation when role is VENUE_OWNER and attribute ownerId from JWT sub`
   - `test(venues): reject expired JWT (> 8 hours)`
