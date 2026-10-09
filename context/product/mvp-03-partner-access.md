# MVP 03 — Partner Access contract reference

Source: the user-supplied `auth-payment-ninjava.md` (Auth & Payment — Ninjava),
reviewed on 2026-10-08. This is a summary of that document, not a live verification
of the Auth backend or a replacement for its OpenAPI definition.

- Partners register by invitation. Current request: `POST /auth/register` with
  `{ username, password, invitationCode }`; there is no email or role field.
- Registration returns `201` with `{ id, username, role }`. Role comes from the
  invitation. A request-body role is ignored by Auth.
- Duplicate usernames return `409`. Invalid or used invitation codes return `400`.
  Failed registration must not consume a code or reserve the username.
- Passwords require at least eight characters. The document specifies no uppercase,
  number, or symbol requirement. Auth stores bcrypt hashes.
- Login accepts `{ username, password }` and returns `{ accessToken, tokenType,
  expiresIn }`. Unknown username and incorrect password share the same `401`.
- Production JWTs use HS256 and contain `sub`, `role`, `iat`, and `exp`, with
  an eight-hour default lifetime. Frontend integration with Auth is deferred.
- The document describes current in-memory backend storage; email, PostgreSQL,
  Redis, and invitation expiry remain pending. Do not treat those as implemented.

## Frontend mock boundary

T-095 provides `/register`, the documented fields plus a local-only password
confirmation, and a frontend invitation adapter. Invitations map to the existing
Events development partner IDs, rather than creating new downstream identities.
They are single-use within the current page lifetime. Registered credentials are
kept only as salted demo digests in memory, never in browser storage. This is not
the production bcrypt/identity implementation. Reloading resets demo registration
and used invitations; the original fixture logins remain available.

T-096 verifies the role-free UI and allowlisted payload, and checks that spoofed
roles cannot override either invitation type in the mock or change the role after
login. T-097 remains for client-side password feedback. T-095 already follows the
basic documented payload and eight-character minimum.
