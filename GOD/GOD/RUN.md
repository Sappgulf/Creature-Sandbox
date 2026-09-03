# RUN

INTAKE → PLAN → PATCH → VERIFY → REPORT

1. Reproduce the issue with the smallest reliable steps.
2. Instrument with explicit logs/metrics or a debug overlay to isolate cause.
3. Fix with the smallest change that addresses the root cause.
4. Verify via tests, smoke checks, or manual steps with documented results.
5. Document in CHANGELOG.md and any affected docs.
   Intake: restate scope; refuse collateral edits outside it.
   Plan: name root cause and invariant before touching code.
   Patch: minimal diff; no permanent diagnostic noise.
   Verify: record commands run and evidence produced.
   Report: summary of changes with file references.
