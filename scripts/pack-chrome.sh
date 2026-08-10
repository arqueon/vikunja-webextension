#!/usr/bin/env bash
set -euo pipefail

# Pack the extension for Google Chrome into dist/vikunja-chrome-<version>.zip.
# The canonical manifest.json is the Firefox form; Chrome only understands the
# "background.service_worker" key, so the event-page "background.scripts" and
# the Firefox-only "browser_specific_settings" are dropped from the staged
# copy. Everything else ships unchanged.
#
# Usage:
#   scripts/pack-chrome.sh                # build dist/vikunja-chrome-<version>.zip
#   scripts/pack-chrome.sh --manifest-only  # print the Chrome manifest to stdout

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/dist"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Rewrite the given manifest.json in place into the Chrome form.
chrome_manifest() {
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    delete m.background.scripts;
    delete m.browser_specific_settings;
    fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
  ' "$1"
}

if [[ "${1:-}" == "--manifest-only" ]]; then
  TMP="$(mktemp)"
  trap 'rm -rf "$STAGE" "$TMP"' EXIT
  cp "$ROOT/manifest.json" "$TMP"
  chrome_manifest "$TMP"
  cat "$TMP"
  exit 0
fi

"$ROOT/scripts/_stage.sh" "$STAGE"
chrome_manifest "$STAGE/manifest.json"

VERSION="$(node -p "require('$STAGE/manifest.json').version")"
OUT="$OUT_DIR/vikunja-chrome-$VERSION.zip"
mkdir -p "$OUT_DIR"
rm -f "$OUT"
cd "$STAGE"
zip -qr "$OUT" . -x '.*'
echo "Wrote $OUT"
