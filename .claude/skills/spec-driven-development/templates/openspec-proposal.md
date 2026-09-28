# OpenSpec Proposal & Delta Specification Template

Use this format when generating or reviewing `proposal.md` and spec changes in `openspec/changes/<ticket>/`.

```markdown
# Change Proposal: AZ-142 Seat Hold Expiry

## 1. Summary
Enforce a server-side authoritative 5-minute hold on seat reservations. If the fan completes payment within 5 minutes, the ticket is issued. If the hold window expires, the seat is automatically returned to the available inventory.

## 2. Motivation
Currently, abandoned checkout carts leave seats locked indefinitely, blocking other fans from purchasing during high-demand on-sale drops.

## 3. Scope
- Affected service: `booking-service`
- Storage: Redis hold keys with 300-second TTL & PostgreSQL reservation records.

---

# Delta Specification

## ADDED Requirements

### Requirement: Authoritative Seat Hold TTL
The system SHALL lock a selected seat for exactly 300 seconds (5 minutes) upon reservation initiation.

#### Scenario: Successful hold acquisition
- **WHEN** an authenticated Fan requests a hold on an available seat in event E
- **THEN** the system generates a reservation token with expiresAt = NOW() + 300s
- **AND** the seat status transitions to HELD.

#### Scenario: Hold timeout release
- **WHEN** 300 seconds elapse without a completed payment confirmation
- **THEN** the hold lock expires automatically
- **AND** the seat becomes selectable by other fans immediately.

#### Scenario: Interrupted session restoration
- **WHEN** a Fan returns to the checkout screen after a page refresh or network blip
- **THEN** the system returns the exact remaining hold seconds calculated as (expiresAt - server_utc_now())
- **AND** does not reset the 5-minute timer.

## MODIFIED Requirements
None.

## REMOVED Requirements
None.

---

# Tasks (`tasks.md`)

- [ ] `test(booking): add unit tests for 300s hold TTL calculation and expiry (AZ-142)`
- [ ] `feat(booking): implement redis-based atomic hold reservation with TTL (AZ-142)`
- [ ] `feat(booking): implement session recovery endpoint returning remaining seconds (AZ-142)`
- [ ] `test(booking): add integration test for concurrent hold collision (AZ-142)`
```
