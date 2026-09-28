#!/usr/bin/env bash
#
# scripts/changelog.sh
# Generates formatted Markdown release notes from Conventional Commits
# since the previous stable tag.
#
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

[[ $# -eq 1 ]] || { echo "Usage: changelog.sh <tag or commit-ish>" >&2; exit 2; }
ref="$1"
git rev-parse --quiet --verify "$ref^{commit}" >/dev/null || die "Unknown tag or commit '$ref'"

readonly HEADER='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(([^)]+)\))?(!)?: (.+)$'

prev=$(git describe --tags --abbrev=0 --match 'v*' --exclude '*-*' --exclude "$ref" "$ref" 2>/dev/null || true)
range="${prev:+$prev..}$ref"

breaking="" features="" fixes="" other="" unconventional=""

while IFS= read -r sha; do
  subject=$(git log -1 --format=%s "$sha")
  if [[ "$subject" =~ $HEADER ]]; then
    type="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[3]}"
    bang="${BASH_REMATCH[4]}"
    description="${BASH_REMATCH[5]}"

    if [[ -n "$bang" ]] || git log -1 --format=%b "$sha" | grep -qE '^BREAKING[ -]CHANGE:'; then
      breaking+="- $subject"$'\n'
    elif [[ "$type" == feat ]]; then
      features+="- ${scope:+**$scope:** }$description"$'\n'
    elif [[ "$type" == fix ]]; then
      fixes+="- ${scope:+**$scope:** }$description"$'\n'
    else
      other+="- $subject"$'\n'
    fi
  elif [[ "$subject" == 'Revert "'* ]]; then
    other+="- $subject"$'\n'
  else
    unconventional+="- $subject"$'\n'
  fi
done < <(git log --no-merges --format=%H "$range")

section() {
  [[ -z "$2" ]] || printf '### %s\n\n%s\n' "$1" "$2"
}

if [[ -z "$breaking$features$fixes$other$unconventional" ]]; then
  echo "No changes since ${prev:-the initial commit}."
  exit 0
fi

echo "## Release Notes ($ref)"
echo

section "⚠ Breaking Changes" "$breaking"
section "✨ New Features" "$features"
section "🐛 Bug Fixes" "$fixes"
section "🔧 Maintenance & Other Changes" "$other"
section "Unconventional Commits" "$unconventional"

if [[ -n "$prev" && -n "${GITHUB_REPOSITORY:-}" ]]; then
  echo "---"
  echo "**Full Diff**: ${GITHUB_SERVER_URL:-https://github.com}/$GITHUB_REPOSITORY/compare/$prev...$ref"
fi
