# Creature Sandbox - Development Plan

## Active

- [ ] Evaluate tool favorites / quick swap UX (post-brush-size update)
- [ ] Audit save/load UX for surfaced feedback (non-intrusive)
- [ ] Expand sandbox interactions with props, drag/throw, and micro-goals
- [ ] Balance pass: tune grab/throw, camera smoothing, prop forces, and mobile touch sensitivity
- [ ] Ship watch mode UI, auto-director, and moments log for observer-first sessions
- [ ] Add lightweight ecosystem role tension + migration storytelling cues

## Session Audit (2026-02-04)

### Focus
1. Environmental rhythm (day/night + food cycles) with subtle behavior biasing.
2. Lightweight weather mood (wind/calm) for ambient variation.
3. Optional god mode tools with minimal UI + save/load safety.

### Integration Points (pre-change)
- World update loop: `World.step()` → `WorldEnvironment.update()` + `WorldEcosystem.update()` + `World.updateFood()` in `creature-sim/src/world-core.js`.
- Creature needs + goals: `_updateNeeds()` and `_selectGoal()` in `creature-sim/src/creature.js`; movement speed in `creature-sim/src/creature-behavior.js`.
- Rendering overlays: day/night + season tint in `creature-sim/src/renderer.js`.
- UI toggle entry: HUD overflow menu (`creature-sim/src/menu-model.js`, `creature-sim/src/hud-menu.js`) and quick action area (`creature-sim/index.html`).
- Save/load: environment fields in `creature-sim/src/save-system.js`.

### Planned Actions
- Add cached day/night phase + influence values in `WorldEnvironment`.
- Wire day/night bias into needs decay, goal scoring, and movement speed.
- Implement food regrowth patches with time-of-day + population pressure influences.
- Add lightweight wind/calm mood loop with clear visual tint.
- Add optional god mode toggle + minimal tool bar (food source, calm zone, chaos nudge, spawn/remove).
- Persist time-of-day + environment state; god mode does not persist.
- Update README, smoke tests, and changelog entries.

## Session Audit (2026-02-06)

### Focus
1. Add nests, territory pressure, and home-region preference for creatures.
2. Implement migration scoring + settlement with group bias and cooldowns.
3. Integrate moments/auto-director hooks, save/load persistence, and observer UI toggles.

### Integration Points (pre-change)
- World state + spatial partitioning: `World` in `creature-sim/src/world-core.js`.
- Creature needs, memory, and goals: `creature-sim/src/creature.js` + `creature-sim/src/creature-features.js`.
- Ecosystem food patches/rest zones: `creature-sim/src/world-ecosystem.js`.
- Moments + auto-director: `creature-sim/src/moments-system.js`, `creature-sim/src/auto-director.js`.
- Rendering overlays + feature toggles: `creature-sim/src/renderer.js`, `creature-sim/src/renderer-features.js`, `creature-sim/index.html`.
- Save/load migrations: `creature-sim/src/save-system.js`.

### Planned Actions
- Add region partitioning with pressure/food stats and nest tracking on a throttled cadence.
- Introduce nest entities with comfort, occupancy, and overcrowding penalties.
- Add home nest/region preferences, migration scoring, and settlement memory.
- Hook nests/regions/migration into moments and auto-director (throttled).
- Update save/load schema + docs/smoke tests for new behaviors.

## Session Audit (2026-02-05)

### Focus
1. Watch mode (observer-first UI + auto-camera) with minimal overlays.
2. Moments log + session summary for emergent storytelling.
3. Light ecosystem role tension (herbivore/scavenger/predator-lite) with migration cues.

### Integration Points (pre-change)
- Event hooks: `eventSystem` and existing creature/world emitters (`creature-sim/src/event-system.js`, `creature-sim/src/world-core.js`).
- Camera follow + travel: `creature-sim/src/camera.js` with input overrides (`creature-sim/src/input-manager.js`).
- UI overlays: HUD/menu in `creature-sim/index.html`, `creature-sim/styles.css`, `creature-sim/src/ui-controller.js`.
- Save/load: `creature-sim/src/save-system.js` metadata for lightweight session summaries.

### Planned Actions
- Add watch mode control strip with follow toggle, speed, moments, and god mode shortcut.
- Implement auto-director (event-driven) with smooth travel + user override.
- Add moments log + session summary panel with camera jump targets.
- Add diet roles + predator-lite chase behavior and soft crowd/stress catalysts.
- Add migration detector + scarcity and predator-lite events for storytelling.
- Update docs and smoke tests with watch mode + moments checks.

## Session Audit (2026-02-03)

### Focus
1. Creature memory + place learning with lightweight reinforcement/decay.
2. Life stages + elder fade-out tuning for smoother generational pacing.
3. Save/load migration + observer debug overlays for validation.

### Planned Actions
- Add memory slots with decay, reinforcement, and danger/calm tagging.
- Bias goals with remembered food/calm/nest locations and danger avoidance.
- Add life-stage tuning (baby/adult/elder), elder fade, and reproduction throttles.
- Extend save/load schema to v2.3 with backward-compatible defaults.
- Update smoke tests, README, and changelog entries.

## Session Audit (2026-01-29)

### Phase 1 Gameplay Audit (code inspection)
**Interactions too strong / inconsistent**
- Throw impulses use raw drag velocity with a high cap (420), leading to extreme launches.
- Bounce/spinner props and creature bump impulses stack high forces without weight scaling.
- External impulses ignore creature size, so larger creatures feel too light.

**Actions that dominate play**
- Rapid drag/throw can override normal locomotion, making props feel secondary.

**Systems lacking feedback or consequence**
- Collision reactions can trigger in rapid succession on bumps, reducing readability.
- Camera movement never fully settles due to tiny residual interpolation.

**Chaos: fun vs frustrating**
- Physics chaos is playful, but extreme launches and jittery camera transitions can feel unfair.

**Primary imbalance sources**
- Physics values: throw caps, prop strength, bump forces, impulse decay.
- Camera smoothing and movement thresholds.
- Touch thresholds for grab activation and pan sensitivity.

## Session Audit (2026-01-30)

### Focus
1. Health/damage tuning pass to reduce accidental deaths.
2. Ecosystem internal state loop (stress/energy/curiosity/stability) with emergent signals.
3. Save/load migration support for new creature state fields.

### Planned Actions
- Add tuning constants for health + damage thresholds/i-frames.
- Smooth combat damage and add attack cooldowns.
- Implement lightweight ecosystem state updates with crowd pressure + social contagion.
- Update save schema + smoke tests + docs.

## Session Audit (2026-02-01)

### Focus
1. Needs-driven creature agents (hunger/energy/social/stress) with utility goals.
2. Rest zones + food bite consumption with scent-based sensing.
3. Mating loop with cooldowns, population guardrails, and save/load support.

### Planned Actions
- Add centralized agent tuning constants and per-creature needs/goal state.
- Add rest zones and bite-based food consumption (local scent sensing).
- Update mating logic with controlled offspring + population caps.
- Extend save/load schema + docs + smoke tests for new agent loop.

## Session Audit (2026-01-26)

### Phase 1 Gameplay Audit (code inspection)
**What the player can do**
- Spawn, inspect, and erase creatures; paint food; pause/resume; adjust speeds.
- Toggle simulation features, pan/zoom camera, follow selected creature.
- Use gene editor, scenario lab, campaigns, and goals for longer-term play.

**World reactions**
- Creatures move, hunt, eat, reproduce, and die with visual/audio feedback.
- Selection glow, poke/drop reactions, and particle effects on events.
- Environmental seasons/weather, disasters, and ecosystem balancing.

**Choices that matter**
- Spawn/food placement affects population health and predator-prey balance.
- Gene edits affect traits and emergent survival.
- Tool usage (erase/spawn) and goal selection guide session direction.

### Gameplay dead zones
- Creature interaction is mostly observational after spawn (limited direct manipulation).
- Many UI actions (feature toggles) provide little immediate causal feedback.
- Sandbox lacks tactile props or environment rules for quick experiments.

### Missing affordances
- Drag/throw creatures or objects to test physics outcomes.
- Placeable props/zones (bounce, gravity, spinner) for emergent play.
- Clear contextual prompts for what to try next in the sandbox.

## Session Audit (2026-01-24)

### 10 most visible rough edges (inspection)
1. Overflow menu lacked in-context help after condensation.
2. Save/load hotkeys documented but not implemented for file downloads.
3. Selected creature card disappeared entirely when nothing was selected.
4. Icon-only quick actions relied on hover tooltips (not visible on mobile).
5. Mobile pan/zoom felt overly sensitive and jittery.
6. Mobile keyboard could cover inputs in panels.
7. Ecosystem health updated every frame (overkill on mobile).
8. Pointer move path created new objects each event.
9. Export actions had no confirmation feedback.
10. Menu mapping for condensed HUD was not visible in-app.

### Top 3 performance hotspots (inspection)
1. Per-frame ecosystem health recalculation in `GameLoop.updateSubsystems`.
2. Frequent UI updates for stats/selected info even when unchanged.
3. Pointer move allocations during continuous panning.

## Session Audit (2026-01-25)

### Focus
1. Creature feel upgrades (personality reactions + selection feedback).
2. Session nudges for manual spawns.
3. Home screen tone polish.

## Next

- [ ] Expand ECS stub for batch processing if needed
- [ ] Prototype creature presets panel for sandbox quick starts

## Done

### 2026-01-29

**Changed:**
- `creature-sim/src/creature.js` — added landing/fall/overreaction reactions, mood icons, eye tracking, silly badges, and recovery poses.
- `creature-sim/src/sandbox-props.js` — added spring/launch/see-saw/conveyor/slope/fan/sticky props with tuned forces and chaos scaling.
- `creature-sim/src/renderer.js` — drew new prop affordances and impact highlights.
- `creature-sim/src/game-loop.js`, `creature-sim/src/ui.js`, `creature-sim/src/ui-controller.js` — added curiosity prompts and chaos dial bindings.
- `creature-sim/index.html`, `creature-sim/styles.css` — added chaos slider UI and new prop entries.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md`, `README.md`, `CHANGELOG.md` — documented playful pass updates.

**Why:**
- Increase tactile feedback, replayable toy interactions, and fun prompts while keeping the core loop intact.

**Verified:**
- `npm test`
- `npm run lint`

### 2026-01-29

**Changed:**
- `creature-sim/src/input-manager.js` — tuned grab/throw thresholds, added throw caps, and scaled impact feedback by throw intensity.
- `creature-sim/src/creature.js` — normalized external impulse by size, added collision reaction cooldown, and made animation timing frame-rate independent.
- `creature-sim/src/sandbox-props.js` — reduced prop strengths and impulse caps for bounce/spinner/gravity.
- `creature-sim/src/world-core.js` — softened creature bump forces.
- `creature-sim/src/camera.js` — smoothed camera interpolation and snap-to-target thresholds.
- `creature-sim/src/mobile-support.js` — reduced pan/zoom sensitivity and increased movement threshold.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md`, `README.md`, `CHANGELOG.md` — documented balance pass checks and notes.

**Why:**
- Improve interaction fairness, reduce extreme launches, and stabilize camera/touch feel without changing the core loop.

**Verified:**
- `npm test`
- `npm run lint` (warnings only)

### 2026-01-28

**Changed:**
- `creature-sim/index.html` — added mobile spawn sheet markup and dismissible interaction hint button.
- `creature-sim/styles.css` — styled mobile spawn sheet, hint close affordance, and selection highlight.
- `creature-sim/src/ui-controller.js` — centralized spawn selection state, mobile spawn sheet handlers, and hint lifecycle clearing.
- `creature-sim/src/ui.js` — updated spawn hint copy and auto-dismiss logic.
- `creature-sim/src/dom-cache.js`, `creature-sim/src/input-manager.js` — cached new UI nodes and escape-to-close for the spawn sheet.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md`, `README.md`, `CHANGELOG.md` — documented mobile spawn selection + help hint lifecycle updates.

**Why:**
- Fix mobile creature selection and ensure help hints dismiss cleanly without blocking touch interactions.

**Verified:**
- `npm test`
- `npm run lint` (warnings only)

### 2026-01-27

**Changed:**
- `creature-sim/src/input-manager.js` — added hover affordance tracking, grab cursor feedback, and grab/drop reactions during drag.
- `creature-sim/src/creature.js` — added grab reaction animation response.
- `creature-sim/src/renderer.js` — added hover/grab outlines for clear interaction affordance.
- `creature-sim/src/game-loop.js` — routed hovered creature state into renderer.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md` — updated verification and shipped notes.
- `README.md`, `CHANGELOG.md` — documented new grab affordances.

**Why:**
- Improve direct manipulation clarity and creature expressiveness without changing the core loop.

**Verified:**
- `npm test`
- `npm run lint`

### 2026-01-24

**Changed:**
- `creature-sim/src/hud-menu.js` — added Help section to overflow menu/sheet.
- `creature-sim/src/ui.js` — added empty-state guidance for selected creature card.
- `creature-sim/src/main.js` — implemented save/load hotkeys, dev-only FPS overlay/timing logs, load helpers.
- `creature-sim/src/game-loop.js` — throttled eco-health updates and wired dev FPS/timing logs.
- `creature-sim/src/mobile-support.js` — tuned gesture sensitivity + keyboard-safe padding updates.
- `creature-sim/src/input-manager.js` — reduced pointer move allocations.
- `creature-sim/src/ui-controller.js` — export toasts.
- `creature-sim/index.html` — tooltip hints and accessibility labels for icon buttons.
- `creature-sim/styles.css` — help/tooltip/keyboard/FPS overlay styles.
- `docs/ROADMAP.md`, `docs/SMOKE_TESTS.md`, `docs/UI_NAVIGATION.md`, `docs/ACCESSIBILITY.md` — updated docs.
- `README.md`, `CHANGELOG.md` — documented save/load hotkeys and help section.

**Why:**
- Improve UX clarity on mobile/desktop, add feedback for key actions, and tighten mobile performance.

**Verified:**
- `npm test`
- `npm run lint`

### 2026-01-23

**Changed:**
- `creature-sim/index.html` — condensed top HUD markup and added overflow sheet containers.
- `creature-sim/src/menu-model.js` — centralized HUD action model with grouping metadata.
- `creature-sim/src/hud-menu.js` — renders HUD primary/overflow menus with keyboard support.
- `creature-sim/src/ui-controller.js` — wired menu actions, session meta toggle, and ARIA updates.
- `creature-sim/src/dom-cache.js` — cached new HUD/menu elements.
- `creature-sim/src/game-state.js` — added session meta visibility state.
- `creature-sim/styles.css` — styled overflow dropdown and mobile bottom sheet.
- `docs/UI_NAVIGATION.md` — documented audit and mapping for top menu actions.
- `docs/SMOKE_TESTS.md` — added navigation-specific checks.
- `README.md` — documented condensed HUD and overflow navigation.
- `CHANGELOG.md` — noted condensed HUD behavior.

**Why:**
- Reduce top menu clutter while keeping all actions within 1-2 taps and preserving accessibility.

**Verified:**
- `npm test` (pass)
- `npm run lint` (0 errors, 77 warnings)

### 2026-01-22

**Changed:**
- `creature-sim/src/gene-editor.js` — Wired gene editor controls, spawn-mode feedback, and code sharing helpers
- `creature-sim/index.html` — Added gene code share UI, nameplates/reduced motion toggles, and improved button labels
- `creature-sim/styles.css` — Added reduced motion styles, gene code UI styles, larger tap targets, and mobile-safe panel sizing
- `creature-sim/src/main.js` — Wired reduced motion + nameplates toggles and gene editor spawn events
- `creature-sim/src/mobile-support.js` — Use VisualViewport-aware sizing for mobile keyboard safety
- `docs/ACCESSIBILITY.md` — Documented accessibility support, limitations, and quick tests
- `docs/SMOKE_TESTS.md` — Added mobile and accessibility smoke steps
- `docs/ROADMAP.md` — Logged shipped upgrades and verification notes
- `README.md` — Documented gene sharing + accessibility controls
- `CHANGELOG.md` — Added Unreleased notes for this pass

**Why:**
- Improve mobile viewport stability, accessibility affordances, and lightweight sharing features without changing the core loop

**Verified:**
- `npm test` — pass
- `npm run lint` — 0 errors, 80 warnings (unused vars)

### 2026-01-21

**Changed:**
- `creature-sim/src/enhanced-analytics.js` — Made analytics dashboard responsive to viewport sizing and resizable charts
- `README.md` — Documented responsive analytics dashboard behavior
- `CHANGELOG.md` — Added Unreleased note for responsive analytics sizing

**Why:**
- Ensure the analytics dashboard fits smaller screens and scales chart canvases when resizing.

**Verified:**
- `npm test` — pass
- `npm run lint` — 0 errors, 80 warnings (unused vars)

### 2026-01-21

**Changed:**
- `creature-sim/src/input-manager.js` — Added brush size hotkeys for tools
- `creature-sim/src/tools.js` — Added brush size clamping helpers
- `creature-sim/src/ui.js` — Added tool HUD indicator in stats
- `creature-sim/src/game-loop.js` — Routed tool/brush size data into HUD
- `creature-sim/src/ui-controller.js` — Spawn button remembers last creature type
- `creature-sim/styles.css` — Styled tool indicator in stats HUD
- `creature-sim/index.html` — Updated shortcuts overlay with brush size controls
- `docs/SMOKE_TESTS.md` — Added manual core loop checks and save/load smoke steps
- `docs/ROADMAP.md` — Added prioritized roadmap with verification steps
- `AGENT.md` — Added guidance for future Codex sessions
- `CHANGELOG.md` — Added release notes entry
- `README.md` — Documented brush size shortcuts

**Why:**
- Make tool state more visible and editing faster without touching core simulation logic
- Lock the core loop into documented smoke tests and roadmap guidance

**Verified:**
- `npm test` — pass
- `npm run lint` — 0 errors, 80 warnings (unused vars)

### 2026-01-21

**Changed:**
- `creature-sim/src/batch-renderer.js` — Created stub to fix missing import (P0 blocker)
- `creature-sim/src/ecs.js` — Created stub to fix missing import (P0 blocker)
- `creature-sim/src/renderer.js` — Removed duplicate `timeOfDay`/`dayNightSpeed` assignment (lines 44-46)
- `creature-sim/src/world-core.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-environment.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-ecosystem.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-creature-manager.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-combat.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-disaster.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/index.html` — Added keyboard shortcuts help overlay (press `?` to show)
- `creature-sim/styles.css` — Added styles for shortcuts overlay modal
- `creature-sim/src/input-manager.js` — Added `?` key handler and escape-to-close
- `creature-sim/src/main.js` — Added close button and click-outside-to-close handlers
- `creature-sim/src/mobile-support.js` — Fixed high-DPI coordinate bug, changed `console.log` to `console.debug`
- `creature-sim/src/game-loop.js` — Fixed duplicate import, changed startup logs to `console.debug`
- `eslint.config.js` — Created ESLint 9.x flat config (replaces legacy `.eslintrc.json`)
- `package.json` — Updated ESLint to ^9.0.0, added globals ^15.0.0, updated lint scripts
- `.eslintrc.json` — Removed (replaced by flat config)
- All source files — Auto-fixed trailing whitespace and formatting issues
- `creature-sim/src/tools.js` — Added undo/redo stacks for food/spawn/erase with action history tracking
- `creature-sim/src/world-creature-manager.js` — Added gene-aware manual spawn helper and registry cleanup on removal
- `creature-sim/src/world-core.js` — Proxied gene-aware manual spawn to creature manager
- `creature-sim/src/input-manager.js` — Routed paint/spawn/erase through ToolController and wired Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z to undo/redo

**Why:**
- App would fail to load due to missing ES module imports (`batch-renderer.js`, `ecs.js`)
- Duplicate property assignments shadowed config values from RendererConfig
- Startup logs cluttered browser console; now use `console.debug` (hidden by default)
- Keyboard shortcuts were undiscoverable; help overlay improves UX
- Mobile double-tap zoom was misaligned on high-DPI screens (used canvas buffer size instead of CSS size)
- ESLint 9.x uses flat config format; legacy `.eslintrc.json` no longer supported
- Added undo/redo so accidental spawns/erases/food paints can be reversed safely

**Verified:**
- `npm test` — Save system tests pass
- `npm run lint` — 0 errors, 80 warnings (unused vars only)
- HTTP 200 from local server
- Mobile audit: touch handling, responsive CSS, coordinate conversion all good
- `npm test` — Save system tests pass after undo/redo changes

**Performance Audit:**
- Renderer has frustum culling (creatures outside view are skipped)
- Zoom-based detail reduction (shadows, trails, names disabled when zoomed out)
- Clustering throttled to ~4Hz, skipped when zoomed out
- Analytics throttled to every 5 frames
- World updates throttled to every 30 frames
- No performance issues identified for 500+ creatures

**Notes:**
- PLAN.md created as per CLAUDE.md requirements
- Full codebase audit complete (see invariants below)
- Keyboard help accessible via `?` key (mentioned in home page footer)

---

## Invariants (DO NOT BREAK)

1. Save format v2.0 and backwards migration from v1.x
2. Creature lifecycle: birth → genetics → behavior → reproduction → death
3. Predator/herbivore/omnivore diet and combat system
4. Spatial grid queries (`ensureSpatial`, `gridDirty`)
5. Home screen flow: New Game / Continue / Load
6. Campaign level loading from `campaigns/` directory
7. Auto-save to localStorage every 60s
8. Mini-map click-to-travel and camera follow modes

## Architecture Notes

| Layer | Key Files |
|-------|-----------|
| Entry | `index.html`, `main.js` |
| World | `world-core.js` + `world-environment.js`, `world-ecosystem.js`, `creature-manager.js`, `combat-system.js`, `disaster-system.js` |
| Creature | `creature.js`, `genetics.js`, `behavior.js` |
| Render | `renderer.js`, `renderer-config.js`, `renderer-features.js`, `renderer-performance.js` |
| Loop | `game-loop.js`, `game-state.js` |
| Persistence | `save-system.js`, `config-manager.js` |
| UI | `ui-controller.js`, `ui.js`, `dom-cache.js` |
