#!/usr/bin/env bash
# GOD Soft Gate
# Usage: ./god-soft-gate.sh <message>
# Prints a soft gate / reminder block. Useful in GOD runs for human checkpoints.

set -euo pipefail
MSG=${1:-"Human review checkpoint"}

cat << EOF
============================================================
GOD SOFT GATE
============================================================
$MSG

Please review the changes, run relevant smokes, and confirm
before the agent continues.

Next typical steps:
  npm run lint && npm run format:check
  npm test
  npm run build && npm run check:bundle

Press Enter when ready to continue, or Ctrl-C to stop the run.
============================================================
EOF

read -r -p "Continue? [y/N] " reply
if [[ ! $reply =~ ^[Yy]$ ]]; then
  echo "Gate not passed. Exiting."
  exit 1
fi
echo "Soft gate passed. Continuing..."
