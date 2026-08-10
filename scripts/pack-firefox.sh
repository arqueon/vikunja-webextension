#!/usr/bin/env bash
set -euo pipefail

# Pack the extension for Mozilla Firefox into dist/vikunja-firefox-<version>.xpi.
# The canonical manifest.json already targets Firefox (event page via "scripts"),
# so no manifest changes are required here.
#
# Usage:
#   scripts/pack-firefox.sh                # build dist/vikunja-firefox-<version>.xpi
#   scripts/pack-firefox.sh --manifest-only  # print the Firefox manifest to stdout

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [[ "${1:-}" == "--manifest-only" ]]; then
  if [[ -f "$ROOT/.manifest-firefox.json" ]]; then
    cat "$ROOT/.manifest-firefox.json"
  else
    cat "$ROOT/manifest.json"
  fi
  exit 0
fi

"$ROOT/scripts/_stage.sh" "$STAGE"

VERSION="$(node -p "require('$STAGE/manifest.json').version")"
OUT="$OUT_DIR/vikunja-firefox-$VERSION.xpi"
mkdir -p "$OUT_DIR"
rm -f "$OUT"
cd "$STAGE"
zip -qr "$OUT" . -x '.*'
echo "Wrote $OUT"