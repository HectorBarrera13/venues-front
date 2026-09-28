---
name: spec-driven-development
description: Guide and execute feature development using Spec-Driven Development (SDD) via Spec Kit or OpenSpec. Enforces the strict lifecycle of specify -> plan -> tasks -> test-first implementation -> review -> PR -> archive. Use whenever implementing a ticket, user story, or substantial code change.
---

# Spec-Driven Development (SDD) Skill

This skill governs how AI coding agents and human engineers collaborate on tickets using **Spec-Driven Development**. The core ironclad rule is:

> **No code before an approved specification.**  
> Every phase terminates in a Markdown document you inspect and approve before proceeding to implementation. Correct the plan in markdown when it is cheap, not in a 2,000-line diff.

---

## 1. Tool Selection: Spec Kit vs. OpenSpec

Each repository chooses **exactly one** tool during initial setup. Do not mix both tools within the same repository.

| Dimension | Spec Kit (`github/spec-kit`) | OpenSpec (`Fission-AI/OpenSpec`) |
|---|---|---|
| **Best suited for** | Brand new services, massive greenfield subsystems. | Fast iterative feature work, existing services, deltas. |
| **Unit of work** | Complete feature specification (`specs/NNN-feature/`). | Delta change set (`openspec/changes/<ticket>/`). |
| **Governance** | Project Constitution (`.specify/` / `/speckit-constitution`). | Project conventions & `AGENTS.md` rules. |
| **Installation** | Python (`uv tool install specify-cli`). | Node.js (`npm install -g @fission-ai/openspec@latest`). |
| **Language Support** | **Language-agnostic** (works on Java, .NET, TS, Python, Go). | **Language-agnostic** (works on any codebase). |

---

## 2. End-to-End Workflow: Spec Kit

### Step 1: Branch from Ticket
Always start by checking out a branch carrying the ticket identifier:
```bash
git switch -c feature/AZ-142-seat-hold-expiry
```

### Step 2: Establish Constitution (Once per repository)
Run `/speckit-constitution` to declare the immutable project invariants:
- Clean architecture / Ports & Adapters rules.
- Test commands and lint commands.
- Conventional commit conventions ending with `(TICKET)`.
- Zero undocumented third-party dependencies.
*(See `templates/spec-kit-constitution.md`)*.

### Step 3: Specify (`/speckit-specify`)
Provide the ticket requirements and acceptance scenarios to the agent:
- Agent generates `specs/<id>-<name>/spec.md`.
- Inspect the file: Ensure it specifies **what** and **why** without premature technical lock-in. Ensure all boundary edge cases and failure modes are explicitly detailed.

### Step 4: Plan (`/speckit-plan`)
The agent translates `spec.md` into `plan.md`:
- Data structures and schemas.
- Contract signatures (OpenAPI endpoints).
- Concurrency controls and idempotency guarantees.
- *Any architectural trade-off involving alternatives must be documented as an Architecture Decision Record (ADR).*

### Step 5: Tasks (`/speckit-tasks`)
The agent generates `tasks.md`:
- Breakdown into small, sequential tasks.
- Each task should represent **one atomic commit** and a reviewable unit.
- If a task looks like a week-long epic, instruct the agent to decompose it further.

### Step 6: Test-First Implementation (`/speckit-implement`)
Iterate task by task:
1. Write failing unit/integration tests matching the task acceptance scenarios.
2. Implement code until tests turn green.
3. Run project linter and formatters.
4. Commit: `feat(booking): expire seat holds after 5 minutes (AZ-142)`.

### Step 7: Open PR & Review
Open PR containing the code, tests, and the `specs/<id>-<name>/` folder. The PR title matches the conventional commit format.

---

## 3. End-to-End Workflow: OpenSpec

### Step 1: Branch
```bash
git switch -c feature/AZ-142-seat-hold-expiry
```

### Step 2: Propose Delta (`/opsx:propose`)
Run:
```bash
/opsx:propose "AZ-142: Expire seat holds after 5 minutes"
```
The agent produces `openspec/changes/az-142-seat-hold-expiry/` containing:
- `proposal.md`: Summary, motivation, and scope.
- Delta specs declaring:
  - `ADDED Requirements`: New functionality with WHEN/THEN scenarios.
  - `MODIFIED Requirements`: Alterations to existing behaviors.
  - `REMOVED Requirements`: Deprecated behaviors.
- `tasks.md`: Ordered implementation steps.
*(See `templates/openspec-proposal.md`)*.

### Step 3: Apply Changes (`/opsx:apply`)
Execute tasks sequentially following test-driven development:
- The agent writes tests, writes implementation, verifies linting, and commits per task.

### Step 4: Open PR
Submit PR including the `openspec/changes/<ticket>/` directory. Reviewers verify both the diff and the delta specification.

### Step 5: Archive Post-Merge (`/opsx:archive`)
**Crucial Step:** Once merged into `main`, run:
```bash
/opsx:archive
```
This migrates the change to `openspec/changes/archive/` and merges the deltas into the living specifications at `openspec/specs/`. **Never skip archiving**, as un-archived changes cause spec drift across future agent sessions.

---

## 4. Failure Modes & How to Recover

- **Agent writes code before spec approval**: Immediately halt execution. Delete unapproved files and reset HEAD. Re-run specify or propose.
- **Specification changed mid-implementation**: Never negotiate architectural changes verbally in chat without updating the spec. Update `spec.md` or delta specs first, prompt the agent to re-plan, and then continue coding.
- **Flaky or omitted tests**: Reject any task where the commit does not introduce automated tests verifying the acceptance scenarios.
