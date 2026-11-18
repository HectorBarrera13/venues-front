#!/usr/bin/env bash
# Copies the shared seat-map fixtures (VEN-004) from the venue-service repository,
# pinned to a commit, into src/mocks/fixtures/maps/. The files are the single
# source of truth owned by the backend: never edit the copies by hand, re-run
# this script instead.
#
# Usage: scripts/sync-map-fixtures.sh <git-ref>   (commit SHA preferred)
set -euo pipefail

REF="${1:?usage: scripts/sync-map-fixtures.sh <git-ref>}"
REPO="HectorBarrera13/venues"
SOURCE_DIR="tests/fixtures/maps"
TARGET_DIR="$(cd "$(dirname "$0")/.." && pwd)/src/mocks/fixtures/maps"
BASE_URL="https://raw.githubusercontent.com/${REPO}/${REF}/${SOURCE_DIR}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "${BASE_URL}/manifest.json" -o "${TMP_DIR}/manifest.json"
FILES="$(node -e 'const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(Object.keys(m.fixtures).join("\n"))' "${TMP_DIR}/manifest.json")"

for file in $FILES; do
  curl -fsSL "${BASE_URL}/${file}" -o "${TMP_DIR}/${file}"
done

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp "${TMP_DIR}"/*.json "$TARGET_DIR/"
printf '%s\n' "${REPO}@${REF}:${SOURCE_DIR}" > "${TARGET_DIR}/SOURCE"

echo "Synced $(echo "$FILES" | wc -l | tr -d ' ') fixtures + manifest from ${REPO}@${REF}"
