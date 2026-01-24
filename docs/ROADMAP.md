# Creature Sandbox Roadmap

## Known Quirks (2026-01-29)

1. **Camera can drift far off-world**
   - **Description:** The camera has no world bounds, so heavy panning or travel can move far away from active creatures.
   - **Impact:** Players may need to manually recenter by focusing on a creature or double-tapping a new target.
   - **Owner:** TBD

## Shipped (2026-01-29)

1. **Playful reactions + chaos dial + micro toys**
   - **Description:** Added landing/fall reactions, poke overreactions, impact squeaks, eye tracking, chaos slider, and new props (spring, see-saw, conveyor, fan, sticky, slope, launch).
   - **Likely files:** `creature-sim/src/creature.js`, `creature-sim/src/sandbox-props.js`, `creature-sim/src/renderer.js`, `creature-sim/index.html`, `creature-sim/styles.css`
   - **Risk level:** Medium
   - **Verification:** Use the Features panel to adjust Chaos; drop/throw creatures into props and confirm reactions, props, and prompts feel responsive.

## Shipped (2026-01-30)

1. **Ecosystem internal states + healthier damage tuning**
   - **Description:** Added lightweight internal state updates (stress/energy/curiosity/stability) with social contagion + crowd pressure, plus higher baseline health and smoother damage intake with i-frames and impact thresholds.
   - **Likely files:** `creature-sim/src/creature-ecosystem.js`, `creature-sim/src/creature.js`, `creature-sim/src/world-combat.js`, `creature-sim/src/save-system.js`
   - **Risk level:** Medium
   - **Verification:** Spawn creatures, play for 60–120s, confirm gentle bumps don't kill, stress settles when idle, and impacts feel readable.

2. **Individuality systems + seasonal events**
   - **Description:** Added temperament traits (boldness, sociability, calmness, curiosity), quirks system, and world events with seasonal modifiers.
   - **Likely files:** `creature-sim/src/creature-traits.js`, `creature-sim/src/world-events.js`, `creature-sim/src/creature-features.js`
   - **Risk level:** Medium
   - **Verification:** Spawn creatures and observe varied behaviors; press Q to toggle quirks display; watch for event banners.

## Shipped (2026-01-28)

1. **Mobile spawn picker + hint lifecycle**
   - **Description:** Added a mobile spawn picker sheet with persistent selection plus auto-dismissing, dismissible interaction hints.
   - **Likely files:** `creature-sim/index.html`, `creature-sim/styles.css`, `creature-sim/src/ui-controller.js`, `creature-sim/src/ui.js`
   - **Risk level:** Low
   - **Verification:** Open the mobile spawn sheet, select each creature type, spawn, and confirm the hint banner auto-dismisses and closes on tap.

## Shipped (2026-01-27)

1. **Grab affordance highlights + grab reaction**
   - **Description:** Added hover outlines for grabbable creatures, stronger grabbed outlines, and a grab/drop reaction so direct manipulation feels responsive.
   - **Likely files:** `creature-sim/src/input-manager.js`, `creature-sim/src/renderer.js`, `creature-sim/src/creature.js`, `creature-sim/src/game-loop.js`
   - **Risk level:** Low
   - **Verification:** Hover a creature in Inspect mode to see the outline; grab/drag/release to see the grab highlight and reaction pulse.

## Shipped (2026-01-26)

1. **Sandbox props + drag/throw**
   - **Description:** Added placeable bounce pads, spinners, gravity wells, and food buttons, plus grab/drag/throw creature interactions.
   - **Likely files:** `creature-sim/src/sandbox-props.js`, `creature-sim/src/input-manager.js`, `creature-sim/src/renderer.js`
   - **Risk level:** Medium
   - **Verification:** Place each prop type, drag a creature into it, and confirm visible reactions and movement changes.

2. **Contextual sandbox prompts + goals**
   - **Description:** Added interaction hints and new session goals for prop triggers and creature launches.
   - **Likely files:** `creature-sim/src/ui.js`, `creature-sim/src/session-goals.js`, `creature-sim/src/game-loop.js`
   - **Risk level:** Low
   - **Verification:** Toggle tools and confirm prompts update; complete a throw/prop goal to see progress.

## Shipped (2026-01-25)

1. **Creature feel + reactions**
   - **Description:** Added lightweight personality-driven idle variation and poke/drop/collision reactions with selection glow feedback.
   - **Likely files:** `creature-sim/src/creature.js`, `creature-sim/src/input-manager.js`, `creature-sim/src/renderer.js`
   - **Risk level:** Low
   - **Verification:** Select a creature to see the glow, poke/tap it to see a reaction, and feed nearby creatures to observe drop reactions.

2. **Session nudges for manual spawns**
   - **Description:** Added a session goal that encourages manual creature spawns.
   - **Likely files:** `creature-sim/src/session-goals.js`
   - **Risk level:** Low
   - **Verification:** Spawn creatures manually and confirm progress increases on the goal card.

3. **Home screen tone polish**
   - **Description:** Updated the home screen copy to emphasize playful sandbox identity.
   - **Likely files:** `creature-sim/index.html`
   - **Risk level:** Low
   - **Verification:** Load the home screen and confirm updated tagline and feature copy.

## Shipped (2026-01-24)

1. **Help section + UX guidance**
   - **Description:** Added an in-menu help section for controls, shortcuts, and menu mapping; added empty-state guidance in the selected creature card.
   - **Likely files:** `creature-sim/src/hud-menu.js`, `creature-sim/src/ui.js`, `creature-sim/styles.css`
   - **Risk level:** Low
   - **Verification:** Open ⋯ menu, verify Help section appears, and confirm selected info shows guidance when nothing is selected.

2. **Save/load hotkeys + export toasts**
   - **Description:** Added Ctrl/⌘+S save to file, Ctrl/⌘+O load from file, and toast confirmations for export actions.
   - **Likely files:** `creature-sim/src/main.js`, `creature-sim/src/ui-controller.js`
   - **Risk level:** Low
   - **Verification:** Press Ctrl/⌘+S to download, Ctrl/⌘+O to load, and export CSV/JSON to confirm toasts.

3. **Mobile input polish + keyboard safety**
   - **Description:** Tuned touch pan/zoom sensitivity, reduced jitter, and added keyboard-safe panel padding on mobile.
   - **Likely files:** `creature-sim/src/mobile-support.js`, `creature-sim/styles.css`
   - **Risk level:** Low
   - **Verification:** On mobile, pan/zoom the camera and open an input to confirm panel stays visible.

4. **Perf + dev instrumentation**
   - **Description:** Throttled ecosystem health updates, reduced pointer allocations, and added dev-only FPS overlay/timing logs.
   - **Likely files:** `creature-sim/src/game-loop.js`, `creature-sim/src/input-manager.js`, `creature-sim/src/main.js`
   - **Risk level:** Low
   - **Verification:** Run with `?devtools=1&fps=1` to see overlay and monitor smooth updates.

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

3. **Prop persistence + presets**
   - **Description:** Add prop presets and save slot previews for quick sandbox setups.
   - **Likely files:** `creature-sim/src/save-system.js`, `creature-sim/src/ui-controller.js`, `creature-sim/src/sandbox-props.js`
   - **Risk level:** Medium
   - **Verification:** Save a prop-heavy sandbox and verify it restores with presets intact.

4. **Ecosystem expansion: comfort actions + zones**
   - **Description:** Add optional calm/rest actions (nesting, breathing) and map-based calm/chaos zones to deepen emergent behaviors without complex AI.
   - **Likely files:** `creature-sim/src/creature-ecosystem.js`, `creature-sim/src/world-environment.js`, `creature-sim/src/renderer.js`
   - **Risk level:** Medium
   - **Verification:** Observe stress reduction in calm zones and faster recovery when resting.

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

## Near-Term Tuning (Post-Individuality)

- Temperament weights: adjust boldness/sociability bounds if jitter observed; tune calmness impact on stress decay.
- Quirk balance: verify night_owl day slowdown not punitive; refine homebody pull vs wanderer push.
- Event cadence: monitor average interval; tighten or loosen `triggerChance` and cooldowns as needed.
- Winter stability: watch food floor (0.8×) with large populations; raise baseline if starvation spikes.

## Optional Expansions

- Regional events: localize blooms/dry spells to camera focus or biome tiles.
- Visual polish: lightweight particles per event type with mobile density clamps.
- Analytics hooks: log temperament/quirk distributions for balancing.
- Player tools: minimal god-mode trigger for one-off event (respect cooldown).
