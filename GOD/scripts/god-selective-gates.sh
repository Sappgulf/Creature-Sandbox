#!/usr/bin/env bash
# GOD Selective Gates
# Usage: ./god-selective-gates.sh [lint|test|build|smoke]
# Runs only the requested verification lane(s). Great for focused GOD iterations.

set -euo pipefail

LANES=${*:-lint test build}

echo "=== GOD Selective Gates: $LANES ==="

for lane in $LANES; do
  case "$lane" in
    lint)  echo "→ Running lint..." && npm run lint ;;
    test)  echo "→ Running tests..." && npm test ;;
    build) echo "→ Building..." && npm run build && npm run check:bundle ;;
    smoke) echo "→ Running browser smoke..." && npm run smoke:browser ;;
    *) echo "Unknown lane: $lane (valid: lint test build smoke)" ;;
  esac
done

echo "=== Selective gates complete ==="
