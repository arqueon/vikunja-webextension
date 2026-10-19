#!/usr/bin/env bash
set -euo pipefail

# Pack the extension for Mozilla Firefox into dist/vikunja-companion-<version>.xpi (and .zip).
# Drops background.service_worker and minimum_chrome_version to ensure 0 AMO warnings.
#
# Usage:
#   scripts/pack-firefox.sh                # build dist/vikunja-companion-<version>.xpi and .zip
#   scripts/pack-firefox.sh --manifest-only  # print the Firefox manifest to stdout
#   scripts/pack-firefox.sh --stage-dir <dir> # stage into existing directory without packaging

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/dist"

firefox_manifest() {
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    delete m.background.service_worker;
    delete m.minimum_chrome_version;
    fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
  ' "$1"
}

if [[ "${1:-}" == "--manifest-only" ]]; then
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
  "$ROOT/scripts/_stage.sh" "$STAGE"
  firefox_manifest "$STAGE/manifest.json"
  cat "$STAGE/manifest.json"
  exit 0
fi

if [[ "${1:-}" == "--stage-dir" ]]; then
  STAGE="${2:?Missing stage directory}"
  "$ROOT/scripts/_stage.sh" "$STAGE"
  firefox_manifest "$STAGE/manifest.json"
  exit 0
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

"$ROOT/scripts/_stage.sh" "$STAGE"
firefox_manifest "$STAGE/manifest.json"

VERSION="$(node -p "require('$STAGE/manifest.json').version")"
OUT_XPI="$OUT_DIR/vikunja-companion-$VERSION.xpi"
OUT_ZIP="$OUT_DIR/vikunja-companion-$VERSION.zip"
mkdir -p "$OUT_DIR"
rm -f "$OUT_XPI" "$OUT_ZIP"
cd "$STAGE"
zip -qr "$OUT_XPI" . -x '.*'
cp "$OUT_XPI" "$OUT_ZIP"
echo "Wrote $OUT_XPI"
echo "Wrote $OUT_ZIP"