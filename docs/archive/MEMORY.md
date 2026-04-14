# Institutional Memory

## What This Project Is
Creature Sandbox is a real-time, interactive creature simulation and sandbox experience. It prioritizes emergent behavior, readable interactions, and stable frame pacing.

## What This Project Is Not
- Not a tech demo or throwaway prototype.
- Not a physics-only playground with undefined game rules.
- Not an experimentation ground for engine or framework swaps.

## Design Philosophy
- **Readable simulation.** Players must understand why creatures behave as they do.
- **Stability over novelty.** New features cannot erode the core loop.
- **Explicit feedback.** Actions and errors must be visible.

## System Invariants
- Simulation state updates are deterministic per tick.
- Rendering consumes simulation state and never mutates it.
- Entity lifecycle is explicit: spawn → update → render → remove.
- Input is processed once per frame and produces bounded effects.
- Save/load (when used) must preserve schema compatibility or be versioned.

## Historical Bugs That Must Never Return
- **None recorded yet.** When a critical regression is found, document the date, symptom, root cause, fix, and verification in this section before shipping the fix.

## Expected Debug and Performance Tooling
- Toggleable debug overlay with entity counts, camera state, and frame timing.
- Logging gated behind a DEBUG flag with opt-in verbosity.
- Basic profiling/metrics collection for update vs render time.

## Long-Term Direction (Non-Binding)
- Maintain a clean separation between simulation, rendering, and UI.
- Improve observability and test coverage without inflating runtime cost.
- Preserve backward compatibility for saved sessions when possible.

## Decision Rubric for Accepting Changes
A change is accepted only if it:
1. Preserves core loop stability and determinism.
2. Has a clear, documented user or system benefit.
3. Includes verification evidence.
4. Does not introduce silent failure paths.
5. Has measurable performance impact if it touches hot paths.
