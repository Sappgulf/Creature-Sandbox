# Debugging Discipline

## Philosophy
- No silent failures.
- Visibility over cleverness.
- Debugging changes must be reversible and gated.

## Required Debug Tools
- Toggleable debug overlay.
- Entity counts (simulation vs render).
- Camera state (position, zoom, bounds).
- Frame timing (frame, update, render).

## Logging Rules
- All debug logs are guarded by a DEBUG flag or dev-only toggle.
- No permanent console spam.
- Logs must be actionable (include context and identifiers).

## Invariant Checks
- Guard against NaN/Infinity in positions, velocities, and transforms.
- Validate size/position ranges for world bounds.
- Ensure entity collections do not contain duplicates or null entries.

## Reproducing Bugs Properly
1. Capture exact repro steps (inputs, settings, and timing).
2. Record environment details (browser/device, build, flags).
3. Confirm the issue reproduces at least twice.

## Verifying Fixes
- Re-run the exact repro steps.
- Confirm adjacent systems remain stable.
- Record verification in CHANGELOG.md.

## What Not To Do While Debugging
- Do not bypass invariants to “keep going.”
- Do not silence errors without root cause analysis.
- Do not leave debug instrumentation enabled by default.
