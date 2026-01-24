# Creature Sandbox Smoke Tests

## Manual Core Loop Checks

1. **Load the game**
   - Run a local server (see README) and open the app in a browser.
   - Confirm the home screen renders and buttons are clickable.

2. **Create or edit a creature**
   - Click **⋯ More Actions** in the top HUD, then choose **🧬 Gene Editor**.
   - Adjust at least one gene slider and close the panel.
   - Spawn a creature via the quick actions or tools to ensure gene edits apply.

3. **Spawn a creature into the sandbox**
   - Press **S** to enable the spawn tool.
   - Click on the canvas to spawn a creature.
   - Verify the creature appears and begins moving.

4. **Interact/play**
   - Press **F** and paint food into the world.
   - Use **E** to erase a creature.
   - Press **P** to switch to Props and drop a bounce pad, spring pad, wind fan, and conveyor belt.
   - Drag a creature onto each prop and confirm it reacts (bounce/spring, wind push, conveyor glide).
   - Place a Launch Button and confirm it catapults a creature with a playful impact.
   - Hover a creature in Inspect mode and confirm a subtle white outline appears to show it's grabbable.
   - Drag a creature quickly and release to throw it.
   - Confirm grabbed creatures show a warm grab outline and a brief grab/drop reaction.
   - Toggle pause/resume with **Space** and confirm the sim halts/continues.
   - Tap or click a creature and confirm a glow outline + reaction animation plays.
   - Open **Features** and adjust the Chaos Dial; confirm bounce strength, wobble, and gravity drift change without breaking control.
   - Let the simulation run for 60–120 seconds while occasionally bumping/throwing a creature.
   - Confirm small bumps do not cause damage and creatures do not die accidentally.
   - Confirm hard impacts cause small, readable damage spikes rather than instant deaths.
   - Observe that creatures settle (less jitter) when left alone and show more wobble after repeated impacts.

5. **Ecosystem agent loop**
   - Spawn at least two herbivores and one omnivore.
   - Paint a small food patch and confirm nearby creatures path toward it.
   - Observe a creature eating multiple bites (short pauses between bites).
   - Confirm hunger eases (less frantic wandering) after eating.
   - Let a creature idle in a calm area; confirm it slows down and recovers energy.
   - Optional: run `debug.goals()` in the console and confirm goal labels + target lines appear.
   - Watch two adults with high social drive approach and perform a brief bonding interaction.
   - Confirm an offspring spawns and population growth slows if the world is overcrowded.

6. **Memory + life-cycle loop**
   - With `debug.observe()` enabled, watch a creature eat and note a green memory marker at that spot.
   - Move food away and confirm a hungry creature later drifts back toward the remembered area.
   - Trigger a high-stress event (hard impact or overcrowding) and confirm a red danger marker appears.
   - Observe stressed creatures bias away from the danger marker over time.
   - Let a creature rest calmly; confirm a blue calm marker appears near the rest zone.
   - Speed up the sim (`debug.speed(5)`), wait for baby → adult → elder transitions, and confirm elders move slower and begin to fade.
   - Confirm offspring inherit visible traits (color/size variance) with small mutations.

7. **Nest + territory + migration**
   - Let a creature rest in a calm zone until a nest marker appears nearby.
   - Confirm babies and elders bias toward the nest when resting.
   - Crowd the nest with several creatures and watch stress rise slightly.
   - Let a region become crowded and observe some creatures drift to calmer regions.
   - Confirm “Nest established,” “Nest overcrowded,” “Migration started,” and “Migration settled” moments appear.

8. **Environmental rhythm + food cycles**
   - Let the simulation run for at least 2–3 minutes.
   - Confirm the ambient lighting shifts (day → dusk → night → dawn).
   - Observe creature behavior: higher activity/exploration during day and more resting at night.
   - Watch food patches slowly regrow over time, even without player input.
   - Overconsume a local patch and confirm nearby food thins out temporarily before regrowing.

9. **Top menu navigation**
   - Click **🎛️ Modes & Goals** and confirm the Game Mode + Session Goals card toggles.
   - Open **⋯ More Actions** and verify every item opens its respective panel or toggle.

10. **God mode (optional)**
    - Open **⋯ More Actions** and toggle **✨ God Mode** (or long-press the world).
    - Place a food source, a calm zone, and a chaos nudge; confirm clear visual previews.
    - Spawn and remove a creature; confirm population guardrails prevent overpopulation.
    - Exit god mode and confirm creatures resume autonomous behavior with normal time flow.

11. **Save/load roundtrip**
    - Use **Ctrl+S** to save the game.
    - Refresh the page.
    - Use **Ctrl+O** to load the save.
    - Confirm creatures, food counts, sandbox props, and time of day restore correctly.
    - Confirm loaded creatures retain reasonable ecosystem state (no immediate panic spiral, no zeroed energy).
    - Confirm hunger/energy/social/stress values load without NaNs (inspect a creature).
    - Confirm food patches keep remaining bites after reload.
    - With `debug.observe()` enabled, confirm life-stage labels and memory markers persist after reload.
    - Optional: use **Ctrl/⌘ + S** to download a save file and **Ctrl/⌘ + O** to load it back.
    - Confirm diet roles and moments summary still load without errors.

12. **Help section**
    - Open **⋯ More Actions**.
    - Confirm the Help section lists controls, shortcuts, and where features live.

13. **Session goals**
    - Open **🎛️ Modes & Goals**.
    - Confirm a goal appears for manual creature spawns and progresses when you spawn creatures.

14. **Balance pass: grab/throw consistency**
    - Switch to **Inspect** mode and grab a creature with a short drag.
    - Confirm gentle drags release without huge launches.
    - Flick a longer drag and confirm throws feel capped and predictable (no extreme launches).

15. **Balance pass: camera stability**
    - Pan and zoom quickly, then release.
    - Confirm the camera settles without lingering jitter and overlays reappear after it stops.

16. **Balance pass: creature reactions**
    - Trigger a bounce pad or spinner on a creature.
    - Drop a creature from a height and confirm a squish/landing reaction.
    - Poke a creature repeatedly and confirm an overreaction triggers but resets quickly.
    - Confirm collision reactions are readable but not rapid-fire flashing.

17. **Watch mode + auto-director**
    - Toggle **Watch Mode** from **⋯ More Actions**.
    - Confirm the watch strip appears and quick actions hide.
    - Use the watch strip to **Pause/Play**, **Follow**, and cycle speed **0.5×/1×/2×**.
    - Trigger a birth/eat/mating interaction and confirm the camera gently recenters.
    - Drag to pan; confirm auto-director pauses, then use **Re-center** to resume.

18. **Moments log + session summary**
    - Tap **Moments** in the watch strip to open the log.
    - Confirm entries appear for birth/eat/panic/food scarcity, nest creation, and migration.
    - Tap a moment and confirm the camera jumps to that location.
    - Confirm the session summary shows peak population, births, end-of-life count, stress peak, and biggest migration.

19. **Ecosystem tension roles**
    - Observe herbivore, scavenger, and predator-lite behaviors over 1–2 minutes.
    - Confirm predator-lite chases cause stress + scattering without rapid deaths.
    - Confirm food scarcity events nudge movement without collapsing the population.

20. **Individuality (Temperaments + Quirks)**
    - Spawn 5+ creatures; observe varied wander/approach speeds (bold/curious vs cautious).
    - Toggle quirks display (press `Q`); selected creature shows quirks when enabled.
    - Quirk effects are bounded: no runaway speed/stress; homebody stays near anchor; wanderer roams further.
    - Offspring inherit blended temperaments; quirks carry over or roll new defaults.

21. **Seasons + Events**
    - Run through at least one season transition; food and reproduction stay stable (no collapse in winter).
    - Seasonal tint/particle cues visible but not distracting.
    - Rare event triggers (or manual wait): food bloom/dry spell/storm/calm night/migration wave adjusts biases then recovers.
    - Event banner text appears in stats strip; timer counts down; state returns to baseline after end.

22. **Persistence (Individuality)**
    - Save/Load preserves temperament, quirks, and active event state (if mid-event).
    - Old save (pre-2.0) loads with safe temperament defaults and empty quirks.

## Mobile-Specific Checks

1. **Touch controls + safe areas**
   - Open on a mobile device or emulator.
   - Pan with one finger, pinch to zoom, and double-tap to zoom.
   - Tap **Props** in the mobile bar to cycle prop types, then tap the canvas to place one.
   - Confirm HUD and mobile quick actions clear the notch/home indicator areas.
   - Open **Features** and adjust the Chaos Dial slider to confirm it remains touch-friendly.
   - Toggle **Regions** and **Nest Markers** in the Features panel and confirm overlays appear.

2. **Spawn selection + play loop**
   - Tap **Spawn** in the mobile bar to open the creature sheet.
   - Select **Herbivore**, then tap **Spawn Selected** and confirm a herbivore spawns.
   - Reopen the sheet, select **Predator**, spawn again, and confirm a predator spawns.
   - Tap **Food** and confirm nearby creatures react and move toward it.
   - Let the sim run for 60–120 seconds and confirm creatures remain alive during gentle play.
   - Observe at least one creature slow down to rest and another take multiple food bites.
   - Spawn two adults and confirm a short mating interaction can happen without runaway growth.
   - Long-press the world to enter god mode and place a calm zone; confirm the overlay is touch-friendly.
   - Exit god mode and confirm touch controls return to normal.
   - Toggle Watch Mode and confirm the watch strip respects safe areas and tap targets.

3. **Help / hints lifecycle**
   - Trigger the spawn tool or open **⋯ More Actions** → **Help**.
   - Confirm hints auto-dismiss within a few seconds and can be dismissed by tapping outside or the close button.
   - Confirm dismissing a hint keeps it hidden until another help trigger happens.

4. **Save/load roundtrip (mobile)**
   - Use the save button or keyboard shortcut (if available).
   - Reload and confirm the save restores creatures, food, props, and time of day.

5. **On-screen keyboard**
   - Open Scenario Lab or Gene Editor and focus a text input.
   - Confirm panels stay visible and inputs remain reachable with the keyboard open.

6. **Tap targets**
   - Tap top HUD buttons and the **⋯ More Actions** sheet items.
   - Confirm no tiny targets block touch usage.
   - Confirm the sheet respects safe-area padding.

7. **Balance pass: touch drag + throw**
   - In Inspect mode, press-and-drag a creature slowly.
   - Confirm the grab doesn’t trigger instantly and the creature follows smoothly.
   - Release after a short drag and confirm it doesn’t rocket off-screen.

## Accessibility Checks

1. **Keyboard navigation**
   - Use **Tab** to reach top HUD buttons and panel controls.
   - Confirm visible focus rings appear.
   - Open **⋯ More Actions** and use **Arrow keys / Enter / Escape** to navigate.

2. **Reduced motion**
   - Toggle Reduced Motion in the Features panel.
   - Confirm UI animations/transitions are minimized.

3. **Screen-reader labels**
   - Inspect icon-only buttons (HUD, quick actions, panel close buttons).
   - Confirm `aria-label` values are present.

## Automated / Scripted Checks

- **Save/load serialization test**
  - `npm test`
  - Validates save-system serialization/deserialization stability.
