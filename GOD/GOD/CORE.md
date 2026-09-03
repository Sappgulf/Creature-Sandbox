# GOD CORE

Scope-minimal. Diff-first. Correctness > style > perf.
No silent behavior change. Handle errors. No secrets.
Stability first: never compromise determinism or simulation integrity.
No silent failure: errors surface clearly and recover safely.
Minimum change surface: change only what the task requires.
Required workflow: Reproduce → Instrument → Fix → Verify → Document.
Never guess: confirm root cause before editing.
Diagnostics are temporary and toggleable, gated behind a flag or dev-only switch.
Check invariants (NaN, Infinity, invalid positions, negative sizes).
No engine swaps, speculative refactors, or silent behavior changes.
Every behavioral or perf change requires verification evidence.
Document in CHANGELOG.md and affected docs.
