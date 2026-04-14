# Performance Contract

## Performance Philosophy
Smooth, consistent frame pacing is more important than peak FPS. Optimization must be measured, justified, and documented.

## Required Metrics
- Frame time (ms)
- Update time (ms)
- Render time (ms)
- Memory trend (resident usage over time)

## Performance Baselines
- Baselines must be recorded as the project evolves.
- When setting baselines, capture device/browser, build version, and scenario.

## Common Performance Traps
- Per-frame allocations or object churn.
- Deep clones in hot paths.
- Unbounded loops or unchecked recursion.
- Excessive redraws or redundant state recalculations.

## Approved Optimization Techniques
- Buffer/object reuse.
- Early exits on no-op or idle states.
- Batching work across entities or render passes.
- Delta-time (dt) clamping to avoid spikes.

## Rules for Performance Changes
- Measure before and after.
- Document results in CHANGELOG.md with metrics.
- No speculative micro-optimizations.
