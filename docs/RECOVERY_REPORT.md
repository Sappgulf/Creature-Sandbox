# Creature Sandbox Recovery Report

**Date:** 2026-02-08  
**Status:** Implemented (P0/P1 fixes in progress)

## Root Cause
- Mobile spawn drawer wired to a non-existent `ToolController.setTool()` API, so the spawn tool never activated and tap-to-spawn events were ignored.
- Spawn/debug visibility signals were missing, making it hard to detect whether creatures were created, culled, or rendered.

## Fix Summary
- Corrected control-strip tool activation to use `ToolController.setMode()` and emit tool-change events.
- Added dev-only spawn/render instrumentation (guarded by debug flags) to trace spawn requests, world counts, render counts, and camera bounds.
- Added spawn sanitization and debug-time validation for creature position/size/visibility.
- Added debug fallback labels when sprites fail so invisible spawns surface immediately.

## Files Changed
- `creature-sim/src/control-strip.js`
- `creature-sim/src/debug-flags.js`
- `creature-sim/src/input-manager.js`
- `creature-sim/src/main.js`
- `creature-sim/src/creature.js`
- `creature-sim/src/renderer.js`
- `creature-sim/src/tools.js`
- `creature-sim/src/world-core.js`
- `creature-sim/src/world-creature-manager.js`
- `docs/SMOKE_TESTS.md`

## Verification (Desktop)
1. Run the app locally (see README).
2. Click **New Sandbox**.
3. Press **S**, click the canvas, confirm a creature appears immediately.
4. Optional debug: append `?devtools=1&spawnDebug=1` to the URL and verify spawn logs show:
   - spawn request → world count increment → render counts → camera bounds in view.

## Verification (Mobile)
1. Tap **Spawn** in the control strip.
2. Choose a creature and tap **Tap World to Spawn**.
3. Tap the canvas and confirm the creature appears and moves.
4. Optional: use the same `?devtools=1&spawnDebug=1` URL to inspect logs.
