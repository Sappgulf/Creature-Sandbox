# Creature Sandbox Roadmap

## Shipped (2026-01-22)

1. **Gene code sharing + spawn mode feedback**
   - **Description:** Gene editor now supports copy/import code flow and clearer spawn-mode state.
   - **Likely files:** `creature-sim/src/gene-editor.js`, `creature-sim/index.html`, `creature-sim/styles.css`
   - **Risk level:** Low
   - **Verification:** Open Gene Editor, copy code, paste it back, and spawn a custom creature.

2. **Nameplates toggle**
   - **Description:** Added a UI toggle to enable/disable creature nameplates.
   - **Likely files:** `creature-sim/src/main.js`, `creature-sim/index.html`
   - **Risk level:** Low
   - **Verification:** Toggle nameplates in Features panel and confirm labels show/hide.

3. **Reduced motion toggle**
   - **Description:** Added a reduced motion switch that respects OS preference and persists per user.
   - **Likely files:** `creature-sim/src/main.js`, `creature-sim/styles.css`, `creature-sim/index.html`
   - **Risk level:** Low
   - **Verification:** Toggle reduced motion and confirm UI animations are minimized.

## Quick Wins (Low Risk, High Visibility)

1. **Tool mode HUD + brush size controls**
   - **Description:** Surface current tool mode and allow fast brush size adjustments.
   - **Likely files:** `creature-sim/src/input-manager.js`, `creature-sim/src/tools.js`, `creature-sim/src/ui.js`, `creature-sim/src/game-loop.js`, `creature-sim/styles.css`
   - **Risk level:** Low
   - **Verification:** Launch app, switch tools, adjust brush size with `[`/`]`, confirm HUD updates.

2. **Spawn button remembers last creature type**
   - **Description:** Make the quick spawn button use the last selected creature type.
   - **Likely files:** `creature-sim/src/ui-controller.js`
   - **Risk level:** Low
   - **Verification:** Select omnivore/predator in dropdown, click spawn button, confirm icon and spawn type.

3. **Expanded smoke test documentation**
   - **Description:** Keep manual steps and save/load checks up to date.
   - **Likely files:** `docs/SMOKE_TESTS.md`
   - **Risk level:** Low
   - **Verification:** Follow the steps and confirm no blockers.

## Medium Upgrades (Editor, Sandbox, UI)

1. **Creature presets panel**
   - **Description:** Add curated presets for quick sandbox setup.
   - **Likely files:** `creature-sim/index.html`, `creature-sim/src/ui-controller.js`, `creature-sim/styles.css`
   - **Risk level:** Medium
   - **Verification:** Load presets and confirm traits and spawn counts.

2. **Tool favorites + quick swap**
   - **Description:** Allow users to favorite tools and swap via number keys.
   - **Likely files:** `creature-sim/src/input-manager.js`, `creature-sim/src/tools.js`, `creature-sim/src/ui-controller.js`
   - **Risk level:** Medium
   - **Verification:** Favorite a tool, swap with hotkeys, and validate HUD updates.

3. **Sandbox prop interactions**
   - **Description:** Add simple props (rocks, bushes) for creatures to navigate around.
   - **Likely files:** `creature-sim/src/world-core.js`, `creature-sim/src/renderer.js`, `creature-sim/src/world-ecosystem.js`
   - **Risk level:** Medium
   - **Verification:** Spawn props, ensure pathing avoids them, and save/load preserves props.

## Big Rocks (Future Systems, Optional)

1. **Creature emote/idle behaviors**
   - **Description:** Add occasional idle behaviors and emotes for creature expression.
   - **Likely files:** `creature-sim/src/creature.js`, `creature-sim/src/renderer.js`, `creature-sim/src/creature-behavior.js`
   - **Risk level:** Medium-High
   - **Verification:** Observe idle animations and ensure no frame drops.

2. **Progression-lite unlocks**
   - **Description:** Unlock new tools or presets through play milestones.
   - **Likely files:** `creature-sim/src/achievement-system.js`, `creature-sim/src/ui-controller.js`, `creature-sim/index.html`
   - **Risk level:** High
   - **Verification:** Complete milestones, confirm unlock persistence across save/load.

3. **Save schema versioning + migration tooling**
   - **Description:** Formalize migrations and add explicit versioned migrations.
   - **Likely files:** `creature-sim/src/save-system.js`, `scripts/save-system.test.mjs`
   - **Risk level:** High
   - **Verification:** Run migration tests and load older saves without data loss.
