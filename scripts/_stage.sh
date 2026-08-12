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

# The repo manifest carries the placeholder version "0.0.0"; the real version
# lives in package.json. Inject it into the staged manifest so pack scripts and
# --manifest-only output the actual version without keeping two copies in sync.
VERSION="$(node -p "require('$ROOT/package.json').version")"
node -e '
  const fs = require("fs");
  const file = process.argv[1];
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
  m.version = process.argv[2];
  fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
' "$STAGE/manifest.json" "$VERSION"
