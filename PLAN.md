# Creature Sandbox - Development Plan

## Active

- [ ] Evaluate tool favorites / quick swap UX (post-brush-size update)
- [ ] Audit save/load UX for surfaced feedback (non-intrusive)

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

## Next

- [ ] Expand ECS stub for batch processing if needed
- [ ] Prototype creature presets panel for sandbox quick starts

## Done

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
