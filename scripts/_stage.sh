#!/usr/bin/env bash
set -euo pipefail

# Copy the extension sources into the given staging directory, excluding
# development-only artifacts. Used by the pack scripts so builds never ship
# scripts/, smoketests/, docs or previous build output.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$1"
mkdir -p "$STAGE"

cd "$ROOT"
tar --exclude='./node_modules' \
    --exclude='./dist' \
    --exclude='./scripts' \
    --exclude='./smoketests' \
    --exclude='./.git' \
    --exclude='./eslint.config.js' \
    --exclude='./README.md' \
    --exclude='./AGENTS.md' \
    --exclude='./package.json' \
    --exclude='./package-lock.json' \
    -cf - . | tar -xf - -C "$STAGE"
