# Agent Rules of Engagement

## Project Purpose and Scope
Creature Sandbox is an interactive, real-time creature simulation and sandbox game. The codebase must remain stable, understandable, and performant across simulation, rendering, UI, and persistence layers.

## Core Principles
- **Stability first.** No changes that compromise determinism, simulation integrity, or user-facing reliability.
- **No silent failure.** Errors must surface clearly and recover safely.
- **Measurable changes.** Every behavioral or performance change requires verification evidence.
- **Minimum change surface.** Avoid collateral edits; change only what is required.

## Non-Negotiable Guarantees
- The simulation loop must run without uncaught exceptions or hidden error suppression.
- Rendering must not depend on simulation side effects beyond documented data flow.
- Input handling must be deterministic and idempotent per frame.
- Save/load (if used) must preserve compatibility or be explicitly versioned.
- Performance regressions are unacceptable without documented, measured justification.

## Required Workflow (Reproduce → Instrument → Fix → Verify → Document)
1. **Reproduce** the issue or requirement with the smallest reliable steps.
2. **Instrument** with explicit logs/metrics or a debug overlay to isolate cause.
3. **Fix** with the smallest change that addresses the root cause.
4. **Verify** via tests, smoke checks, or manual steps with documented results.
5. **Document** in CHANGELOG.md and any affected docs.

## Debugging Expectations
- Never guess. Confirm root cause before editing.
- Add temporary, toggleable diagnostics rather than permanent noise.
- All debug output must be gated behind an explicit flag or dev-only switch.
- Invariants must be checked (NaN, Infinity, invalid positions, negative sizes).

## Performance Expectations
- Preserve smooth frame pacing over peak FPS.
- Avoid per-frame allocations or deep clones in hot paths.
- Measure before/after for any performance-related change.

## Forbidden Actions
- Engine swaps or framework rewrites.
- Speculative refactors without verified impact.
- Broad dependency changes without explicit justification.
- Silent behavior changes or undocumented fixes.

## Required Outputs for Any Agent Session
- A concise summary of changes with file references.
- Verification results (or explicit note if not run).
- Updated CHANGELOG.md entries for planned and implemented work.
