#!/usr/bin/env bash
#
# scripts/bump.sh
# Tags HEAD with the next release version and pushes the tag to origin.
# Pushing the tag triggers the GitHub Actions release workflow.
#
set -euo pipefail

readonly RELEASE_BRANCH=main
readonly REMOTE=origin
readonly CI_WORKFLOW=on_pr.yml
readonly STABLE_TAG='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
readonly USAGE='usage: bump.sh [--major | --minor | --patch | --alpha | --beta] [-y] [--dry-run]'
LEVELS=(major minor patch alpha beta)

usage() {
  cat <<EOF
$USAGE

Tags HEAD with the next release version and pushes the tag to $REMOTE.
Without a level it shows an interactive menu; before pushing it asks for confirmation.

  --major      v1.1.1 → v2.0.0
  --minor      v1.1.1 → v1.2.0
  --patch      v1.1.1 → v1.1.2
  --alpha      v1.1.1 → v1.1.1-alpha
  --beta       v1.1.1 → v1.1.1-beta
  -y, --yes    push without asking
  --dry-run    only show the next version: no checks, no tag, no push
  -h, --help   show this help
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

check_ok() {
  echo "  ✓ $*"
}

preflight() {
  local branch sha ci status conclusion url
  echo "Executing pre-release validation checks:"

  branch=$(git branch --show-current)
  [[ "$branch" == "$RELEASE_BRANCH" ]] || die "Releases must be tagged from '$RELEASE_BRANCH', currently on '${branch:-detached HEAD}'"
  check_ok "on $RELEASE_BRANCH"

  if [[ -n "$(git status --porcelain)" ]]; then
    git status --short >&2
    die "Working tree contains uncommitted or untracked changes."
  fi
  check_ok "clean working tree"

  sha=$(git rev-parse HEAD)
  [[ "$sha" == "$(git rev-parse "$REMOTE/$RELEASE_BRANCH")" ]] || die "Local $RELEASE_BRANCH differs from $REMOTE/$RELEASE_BRANCH; push unmerged work through a PR first"
  check_ok "up to date with $REMOTE/$RELEASE_BRANCH (${sha:0:7})"

  command -v gh >/dev/null || die "GitHub CLI (gh) is required to inspect CI status. Install it from https://cli.github.com"
  
  ci=$(gh run list --workflow "$CI_WORKFLOW" --commit "$sha" --limit 1 --json status,conclusion,url \
         --jq '.[0] // {} | [.status // "", .conclusion // "", .url // ""] | join("|")') || die "Could not query GitHub CI status (run 'gh auth status')"
  
  IFS='|' read -r status conclusion url <<< "$ci"
  case "$status/$conclusion" in
    completed/success) check_ok "CI passed for ${sha:0:7}" ;;
    /) die "No CI run ($CI_WORKFLOW) found for ${sha:0:7}; release requires green CI run" ;;
    completed/*) die "CI did not pass for ${sha:0:7} ($conclusion): $url" ;;
    *) die "CI is still executing for ${sha:0:7} ($status). Retry once finished: $url" ;;
  esac

  echo "  … running test suite"
  # Support multiple stack test runners
  if [[ -f "package.json" ]]; then
    [[ -d node_modules ]] || die "node_modules missing; run 'npm ci' first"
    npm test >/dev/null 2>&1 || die "npm test failed."
  elif [[ -f "gradlew" ]]; then
    ./gradlew test >/dev/null 2>&1 || die "gradlew test failed."
  elif [[ -f "pyproject.toml" ]]; then
    pytest >/dev/null 2>&1 || die "pytest failed."
  fi
  check_ok "test suite passed"
  echo
}

next_version() {
  case "$1" in
    major) echo "v$((major + 1)).0.0" ;;
    minor) echo "v$major.$((minor + 1)).0" ;;
    patch) echo "v$major.$minor.$((patch + 1))" ;;
    alpha|beta) echo "v$major.$minor.$patch-$1" ;;
  esac
}

choose_level() {
  local i choice
  echo
  for i in 1 2 3 4 5; do
    printf '  %d) %-6s → %s\n' "$i" "${LEVELS[i-1]}" "$(next_version "${LEVELS[i-1]}")"
  done
  echo
  while true; do
    printf 'Select release level [1-5]: '
    read -r choice || { echo; die "Aborted."; }
    case "$choice" in
      [1-5]) level="${LEVELS[choice-1]}"; return ;;
      major|minor|patch|alpha|beta) level="$choice"; return ;;
      *) echo "Please enter a valid choice (1-5)." ;;
    esac
  done
}

confirm() {
  local answer
  printf 'Push %s to %s? This will publish an official release. [y/N]: ' "$next" "$REMOTE"
  read -r answer || { echo; answer=""; }
  case "$answer" in
    y|Y|yes|Yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

level=""
assume_yes=false
dry_run=false
for arg in "$@"; do
  case "$arg" in
    --major|--minor|--patch|--alpha|--beta) level="${arg#--}" ;;
    -y|--yes) assume_yes=true ;;
    --dry-run) dry_run=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option '$arg'" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
git fetch --quiet --tags "$REMOTE"

$dry_run || preflight

latest=$(git tag --list 'v*' --sort=-v:refname | grep -E "$STABLE_TAG" | head -n1 || true)
IFS=. read -r major minor patch <<< "${latest:-v0.0.0}"
major="${major#v}"

echo "Latest stable release: ${latest:-none}"
[[ -n "$level" ]] || choose_level
next=$(next_version "$level")
echo "Next release version:  $next ($level)"

if $dry_run; then
  echo "Dry-run mode: nothing tagged or pushed."
  exit 0
fi

if [[ "$level" != alpha && "$level" != beta ]]; then
  released=$(git tag --points-at HEAD | grep -E "$STABLE_TAG" | head -n1 || true)
  [[ -z "$released" ]] || die "Current commit is already released under tag $released"
fi

if git rev-parse --quiet --verify "refs/tags/$next" >/dev/null; then
  die "Tag $next already exists in repository"
fi

$assume_yes || confirm || { echo "Aborted: nothing tagged."; exit 1; }

trap 'git tag --delete "$next" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT TERM

git tag --annotate "$next" --message "Release $next"
git push --quiet "$REMOTE" "refs/tags/$next" || die "Failed to push tag $next; removed local tag"
trap - EXIT

echo "Successfully pushed $next! Release workflow has commenced."
