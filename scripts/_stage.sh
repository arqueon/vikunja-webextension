#!/usr/bin/env bash
set -euo pipefail

# Copy the extension sources into the given staging directory, excluding
# development-only artifacts. Used by the pack scripts so builds never ship
# scripts/, smoketests/, docs or previous build output.
#
# The canonical Firefox manifest.json is restored into the stage even when a
# Thunderbird dev manifest is currently swapped in at the repo root.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$1"
mkdir -p "$STAGE"

cd "$ROOT"
tar --exclude='./node_modules' \
    --exclude='./dist' \
    --exclude='./scripts' \
    --exclude='./smoketests' \
    --exclude='./.git' \
    --exclude='./.manifest-firefox.json' \
    --exclude='./*.xpi' \
    --exclude='./eslint.config.js' \
    --exclude='./README.md' \
    --exclude='./AGENTS.md' \
    --exclude='./package.json' \
    --exclude='./package-lock.json' \
    -cf - . | tar -xf - -C "$STAGE"

if [[ -f "$ROOT/.manifest-firefox.json" ]]; then
  cp "$ROOT/.manifest-firefox.json" "$STAGE/manifest.json"
else
  cp "$ROOT/manifest.json" "$STAGE/manifest.json"
fi
