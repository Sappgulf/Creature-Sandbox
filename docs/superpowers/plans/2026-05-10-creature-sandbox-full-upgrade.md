# Creature Sandbox Full Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the 38 approved Creature Sandbox upgrade ideas as a stable, testable improvement pass across player clarity, mobile play, verification truth, documentation, and maintainability.

**Architecture:** Work in small lanes that preserve the current static Vite/canvas architecture. Prefer wiring existing systems more clearly over adding new mechanics; refactors should be shallow and behavior-preserving unless a checklist item explicitly requires player-facing behavior.

**Tech Stack:** Vite static app in `creature-sim/`, vanilla ES modules, canvas renderer, Playwright browser smoke via `scripts/browser-smoke.mjs`, unit checks in `scripts/*test.mjs`.

---

## Approved 38-Item Todo

### Player Clarity + Game Feel

- [x] 1. Surface life-stage visibility in selected creature cards, smoke text, and small in-world/nameplate cues.
- [x] 2. Add an ecosystem story layer that explains why major events matter.
- [x] 3. Upgrade follow camera modes: youngest, most stressed, alpha, hunter, lineage founder.
- [x] 4. Add sandbox recipe presets: Peaceful Meadow, Predator Stress Test, Migration Lab, Tiny Toybox.
- [x] 5. Add scenario medal/result screen with survival, food stability, stress, discoveries, and replay seed.
- [x] 6. Improve mobile drawer hierarchy so More feels compact and task-oriented.
- [x] 7. Add a compact live objective rail to reduce heavy floating goal/toast weight.
- [x] 8. Add readable creature emotion cues for hungry, scared, curious, bonded, tired.
- [x] 9. Add a lineage-focused scenario: protect a family line for 5 generations.
- [x] 10. Improve nests/territory/migration UI surfacing when relevant.

### UI Polish + Presentation

- [x] 11. Make the home screen preview creature-forward with actual game sprites/scene state.
- [x] 12. Improve the first 30 seconds with one obvious creature cluster, food, and a watch cue.
- [x] 13. Add event action cards that offer context-specific actions such as Paint Food, Calm Zone, and Watch Herd.
- [x] 14. Clean up toast priority so repeated XP/goal messages do not stack heavily.
- [x] 15. Give food/calm/chaos/remove tools distinct brush previews.
- [x] 16. Add world readability modes: Normal, Cozy, High Contrast, Analytics, Minimal.
- [x] 17. Improve selection feedback with pulse, soft centering, and a short why-it-moved line.
- [x] 18. Improve sound defaults so ambience is subtle and only ramps after user interaction.
- [x] 19. Make the desktop inspector denser and tabbed: Stats, Memory, Family, Genes.
- [x] 20. Add save-slot screenshot thumbnails.

### Gameplay Depth

- [x] 21. Add a Discovery Journal for first mutation, birth, elder, migration, hunt, and similar milestones.
- [x] 22. Add a creature bonds screen for friends, rivals, parent/child, and mate candidates.
- [x] 23. Add a season challenge chain across Spring, Summer, Autumn, Winter.
- [x] 24. Add tool mastery goals for bounce pad, fan, gravity well, and calm zone.
- [x] 25. Add mutation showcase mode for controlled rare variant inspection.
- [x] 26. Give Watch Mode a nature-guide style director voice.
- [x] 27. Add a local seed gallery for favorite worlds and scenario results.
- [x] 28. Add deterministic long-run balance test mode.
- [x] 29. Add creature nicknames for pinned/favorite creatures.
- [x] 30. Add world postcards: screenshot plus seed, population, season, strongest event.

### Engineering + Release Confidence

- [x] 31. Patch dependencies and clear the PostCSS audit warning.
- [x] 32. Fix perf metric truth so browser smoke reports real rendered/culled counters.
- [x] 33. Split `app-bootstrap.js` responsibilities without changing behavior.
- [x] 34. Add browser smoke screenshots for clean gameplay, selected creature, drawer, watch, god, and home states.
- [x] 35. Fix README truth: live demo URL and stale `world.js`/`main.js` architecture references.
- [x] 36. Resolve simulation-proxy attachment stubs by either implementing a real contract or retiring the dead path.
- [x] 37. Add scenario/runtime metadata save regression tests.
- [x] 38. Formalize a real-device touch checklist for manual QA.

---

## Phase Map

### Phase 1: Release Hygiene + Verification Truth

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/browser-smoke.mjs`
- Modify: `creature-sim/src/app-bootstrap.js`
- Modify: `creature-sim/src/game-loop.js`
- Modify: `creature-sim/src/ui-controller.js`
- Modify: `scripts/core-modules.test.mjs`
- Modify: `README.md`
- Modify: `docs/SMOKE_TESTS.md`
- Modify: `docs/FEATURE_MATRIX.md`

- [x] Patch dependencies with `npm update vite eslint globals postcss`.
- [x] Run `npm audit --audit-level=moderate` and confirm the PostCSS advisory is gone.
- [x] Wire smoke perf reporting to live renderer counters instead of stale `gameState` counters.
- [x] Add/adjust smoke screenshots for home, clean gameplay, selected creature, overflow drawer, watch mode, and god mode.
- [x] Add scenario/runtime metadata save regression coverage.
- [x] Fix README and smoke docs truth.

**Verification:** `npm run lint`, `npm test`, `npm run build`, `npm run check:bundle`, `npm run smoke:browser`, screenshot inspection under `output/browser-smoke/`.

### Phase 2: Player Clarity + UI Polish

**Files:**

- Modify: `creature-sim/index.html`
- Modify: `creature-sim/styles.css`
- Modify: `creature-sim/src/ui.js`
- Modify: `creature-sim/src/ui-controller.js`
- Modify: `creature-sim/src/ui-controller-panels.js`
- Modify: `creature-sim/src/control-strip.js`
- Modify: `creature-sim/src/app-bootstrap.js`
- Modify: `creature-sim/src/renderer.js`
- Modify: `creature-sim/src/renderer-creatures.js`
- Modify: `creature-sim/src/game-state.js`
- Modify: `creature-sim/src/audio-system.js`
- Modify: `creature-sim/src/notification-system.js`

- [x] Surface age stage and emotion cues in selected cards, smoke text, and visual renderer cues.
- [x] Add compact objective rail and tune toast priority.
- [x] Improve mobile More hierarchy and desktop inspector organization.
- [x] Add distinct brush previews and world readability modes.
- [x] Make home screen and first 30 seconds more creature-forward.
- [x] Improve selection feedback and sound defaults.

**Verification:** targeted ESLint on touched files, `npm run smoke:browser`, visual inspection of desktop/mobile screenshots.

### Phase 3: Gameplay Systems + Saveable Player Progress

**Files:**

- Modify: `creature-sim/src/playable-scenarios.js`
- Modify: `creature-sim/src/session-goals.js`
- Modify: `creature-sim/src/moments-system.js`
- Modify: `creature-sim/src/auto-director.js`
- Modify: `creature-sim/src/save-system.js`
- Modify: `creature-sim/src/runtime-save-metadata.js`
- Modify: `creature-sim/src/seed-utils.js`
- Modify: `creature-sim/src/lineage-tracker.js`
- Modify: `creature-sim/src/family-bonds.js`
- Create as needed: focused modules for discovery journal, seed gallery, postcards, or preset data.

- [x] Add sandbox recipe presets.
- [x] Add scenario medal/result screen.
- [x] Add lineage, season-chain, tool-mastery, and mutation showcase scenarios.
- [x] Add discovery journal, bonds screen, seed gallery, creature nicknames, and postcards.
- [x] Add deterministic long-run balance test mode.
- [x] Persist new player-facing state through save metadata where appropriate.

**Verification:** `npm test`, new regression coverage for save/restore, browser smoke coverage for at least one new scenario/result path.

### Phase 4: Architecture Cleanup + Worker Contract

**Files:**

- Modify: `creature-sim/src/app-bootstrap.js`
- Modify/Create: focused bootstrap modules under `creature-sim/src/`
- Modify: `creature-sim/src/simulation-proxy.js`
- Modify: `docs/KNOWN_ISSUES.md`
- Modify: `docs/FEATURE_MATRIX.md`
- Modify: `PLAN.md`
- Modify: `progress.md`

- [x] Extract bootstrap smoke hooks, home flow, persistence flow, and feature wiring into focused modules.
- [x] Resolve or retire `simulation-proxy.js` no-op attachment stubs.
- [x] Update known issues, feature matrix, plan, and progress notes.

**Verification:** full gate plus smoke screenshots after refactor.

---

## Execution Notes

- Preserve the existing visual direction: dark readable canvas, compact HUD, sprite-forward creatures.
- Avoid engine/framework rewrites.
- Do not remove the existing deterministic hooks: `window.render_game_to_text`, `window.advanceTime`, and `window.__creatureSmoke`.
- Keep every feature save-aware only when the state matters after reload; ephemeral UI hints should stay local preference/state.
- Keep `asset-polish-mcp-home.png` untouched unless explicitly adopted.
