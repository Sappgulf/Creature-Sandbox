# Creature Sandbox - Development Plan

## Active

- [ ] Consider extracting renderer feature modules (creature drawing, biomes, mini-map)

## Next

- [ ] Expand ECS stub for batch processing if needed

## Done

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
