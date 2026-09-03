#!/usr/bin/env bash
# GOD Shadow / CI Simulation
# Usage: ./god-shadow.sh
# Local shadow lane: covers lint/test/build/bundle ONLY (not the full smoke matrix).
# Canonical release gate is `npm run proof:release` (see docs/RELEASE_CHECKLIST.md).

set -euo pipefail

echo "=== GOD Shadow: Local release-smoke simulation ==="
git diff --check
node --check scripts/browser-smoke.mjs || true
npm run lint
npm test
npm run build
npm run check:bundle
echo "Shadow run complete. Review output/ for artifacts."
