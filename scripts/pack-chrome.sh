#!/usr/bin/env bash
set -euo pipefail

# Pack the extension for Google Chrome into dist/vikunja-chrome-<version>.zip.
#
# Not implemented yet. Chrome needs the "scripts" key dropped from the
# background section (service worker only), so the transform differs from the
# Thunderbird one.

echo "Chrome packing is not implemented yet." >&2
exit 1
