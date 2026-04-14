# Architecture

## High-Level Overview
Creature Sandbox is structured around a deterministic simulation loop that updates creature and world state, paired with a rendering pipeline that visualizes that state without mutating it. UI and controls orchestrate user intent and feed bounded inputs into the simulation.

## Subsystems
### Simulation Loop
- Advances time, updates entities, applies interactions, and resolves lifecycle changes.
- Owns authoritative state for creatures, props, environment, and goals.

### Render Pipeline
- Reads immutable simulation snapshots or state references per frame.
- Renders entities, effects, overlays, and UI-driven highlights.

### Camera / Viewport
- Owns pan/zoom state and view transforms.
- Converts screen input to world coordinates and exposes view bounds.

### UI / Controls
- Translates user actions into commands (spawn, interact, tool changes).
- Provides debug toggles, status indicators, and overlays.

### State Management
- Maintains global session state (mode, settings, toggles, saved data).
- Bridges simulation, render, and UI without hidden side effects.

## Data Flow: Spawn to Removal
1. **Spawn request** is issued by UI/controls.
2. **Simulation** validates input and instantiates entity with default state.
3. **Update loop** advances entity state each tick.
4. **Render pipeline** visualizes current state per frame.
5. **Removal** occurs when lifecycle conditions are met (death, despawn, cleanup), and entity is removed from simulation state.

## Update Order and Render Order
- **Update order:** input → simulation tick → derived state → debug instrumentation.
- **Render order:** world background → entities/props → effects/overlays → UI.

## Subsystem Invariants
- Rendering must never mutate simulation state.
- Simulation updates must never depend on rendering side effects.
- UI state must not directly mutate entity state without explicit simulation commands.
- Camera transforms must be applied consistently for input and rendering.

## Known Failure Modes and Architectural Guards
- **Silent simulation stalls:** prevented by explicit error surfacing and debug overlays.
- **Render/sim desync:** prevented by single-authority simulation state and read-only render access.
- **Input drift or double-apply:** prevented by per-frame input batching and reset.
- **Entity leaks:** prevented by explicit lifecycle removal and invariant checks.

## Explicit Decoupling Rules
- Simulation code does not import or depend on rendering primitives.
- Rendering code does not own or update simulation data structures.
- UI dispatches commands; simulation validates and applies them.
- Debug instrumentation is opt-in and does not alter normal code paths.
