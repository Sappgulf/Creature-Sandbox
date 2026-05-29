#!/usr/bin/env bash
# GOD Report Snippet Helper
# Usage: ./god-report-snippet.sh <session-name> [output-dir]
# Produces a compact Markdown snippet suitable for pasting into CHANGELOG or GOD reports.

set -euo pipefail

SESSION=${1:-"unnamed-session"}
OUT_DIR=${2:-"output/god-snippets"}
mkdir -p "$OUT_DIR"

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SNIPPET="$OUT_DIR/${SESSION}-$(date +%Y%m%d-%H%M).md"

cat > "$SNIPPET" << EOF
### GOD Session: $SESSION — $(date +%Y-%m-%d)

**When:** $TS
**Agent:** (fill in)
**Scope:** (one-line summary)

**Issues:**
-

**Root Causes:**
-

**Fixes:**
-

**Verification:**
- \`npm run proof:release\` (or specific lane)
- Evidence: \`output/...\`

**Artifacts:**
-

EOF

echo "Created $SNIPPET"
cat "$SNIPPET"
