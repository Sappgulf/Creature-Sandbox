#!/usr/bin/env bash
# GOD Shadow / CI Simulation
# Usage: ./god-shadow.sh
# Locally simulates the main parts of the GitHub release-smoke workflow.

set -euo pipefail

echo "=== GOD Shadow: Local release-smoke simulation ==="
git diff --check
node --check scripts/browser-smoke.mjs || true
npm run lint
npm test
npm run build
npm run check:bundle
echo "Shadow run complete. Review output/ for artifacts."
