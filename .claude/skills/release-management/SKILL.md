---
name: release-management
description: Manage semantic versioning, automate changelog generation from Conventional Commits, execute safe version bumps via scripts/bump.sh, and coordinate multi-environment release promotions. Use when cutting releases, auditing SemVer tags, or implementing prerequisites 9 and 10.
---

# Release Management & Version Bumping Skill

This skill governs the end-to-end release process across all Ticket D-Saster repositories, connecting git tags, automated changelog generation, and cluster deployment triggers.

---

## 1. Core Release Philosophy

1. **Releases are Git Tags**: A release is created solely by pushing an annotated git tag matching `v*.*.*` (e.g. `v1.2.0`).
2. **Immutable Releases**: A pushed tag represents an immutable published release. Never delete, move, or overwrite a published tag on the remote repository. If an issue is discovered, cut a new patch release.
3. **Automated Changelog Generation**: Release notes are dynamically compiled from commit messages since the previous stable tag using `scripts/changelog.sh`. This is why Conventional Commits are strictly enforced.

---

## 2. Version Triggers & Deployment Destinations

| Bump Level | Format | Published Artifacts | Homelab Dev Deploy | Production Deploy | Usage Rationale |
|---|---|---|---|---|---|
| **Major** | `v2.0.0` | Container Image + OpenAPI + Notes | ✅ Auto | ✅ Auto | Breaking API changes, major architectural redesigns. |
| **Minor** | `v1.5.0` | Container Image + OpenAPI + Notes | ✅ Auto | ❌ No | Backward-compatible features, domain additions. |
| **Patch** | `v1.4.3` | Container Image + OpenAPI + Notes | ❌ No | ❌ No | Bug fixes, internal refactoring, local testing builds. |
| **Pre-Release** | `v1.5.0-alpha` | Container Image + OpenAPI + Notes | ❌ No | ❌ No | Experimental features and early testing. |

---

## 3. Safe Bumping Workflow with `scripts/bump.sh`

The canonical script `scripts/bump.sh` performs automated preflight checks to guarantee that only clean, verified, and passing code can be released.

### Prerequisites:
- Git installed.
- GitHub CLI (`gh`) installed and authenticated (`gh auth login`).
- Node modules / dependencies installed (`npm ci`).

### Usage:
```bash
# Interactive menu with preflight validation
scripts/bump.sh

# Direct non-interactive bumps
scripts/bump.sh --minor -y
scripts/bump.sh --patch -y
scripts/bump.sh --major

# Dry-run to preview next version without tagging or pushing
scripts/bump.sh --dry-run
```

### Preflight Validations Performed by `bump.sh`:
1. **Branch check**: Current branch must be `main`.
2. **Clean working tree**: Rejects uncommitted, staged, or untracked changes.
3. **Origin alignment**: Local `main` must match `origin/main` (unpushed commits must pass PR).
4. **Green PR CI**: Evaluates GitHub Actions (`on_pr.yml`) on HEAD commit via `gh run list`. Fails if CI is failing, running, or missing.
5. **Local test execution**: Executes the unit test suite locally.
6. **No duplicate releases**: Asserts HEAD does not already have an existing stable tag.
7. **Collision check**: Asserts target tag does not exist.
8. **Rollback trap**: If `git push` fails, the local tag is automatically deleted to prevent tag pollution.

---

## 4. Manual Tagging (Fallback Procedure)

If `bump.sh` cannot be used in an emergency, create and push an annotated tag manually:

```bash
git switch main
git pull origin main
git tag --list 'v*' --sort=-v:refname | head -n 5     # Inspect latest versions
git tag --annotate v1.5.0 -m "Release v1.5.0"
git push origin v1.5.0                               # Triggers release.yml
```
