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

5. **Top menu navigation**
   - Click **🎛️ Modes & Goals** and confirm the Game Mode + Session Goals card toggles.
   - Open **⋯ More Actions** and verify every item opens its respective panel or toggle.

6. **Save/load roundtrip**
   - Use **Ctrl+S** to save the game.
   - Refresh the page.
   - Use **Ctrl+O** to load the save.
   - Confirm creatures, food counts, sandbox props, and time of day restore correctly.
   - Optional: use **Ctrl/⌘ + S** to download a save file and **Ctrl/⌘ + O** to load it back.

7. **Help section**
   - Open **⋯ More Actions**.
   - Confirm the Help section lists controls, shortcuts, and where features live.

8. **Session goals**
   - Open **🎛️ Modes & Goals**.
   - Confirm a goal appears for manual creature spawns and progresses when you spawn creatures.

9. **Balance pass: grab/throw consistency**
   - Switch to **Inspect** mode and grab a creature with a short drag.
   - Confirm gentle drags release without huge launches.
   - Flick a longer drag and confirm throws feel capped and predictable (no extreme launches).

10. **Balance pass: camera stability**
    - Pan and zoom quickly, then release.
    - Confirm the camera settles without lingering jitter and overlays reappear after it stops.

11. **Balance pass: creature reactions**
    - Trigger a bounce pad or spinner on a creature.
    - Drop a creature from a height and confirm a squish/landing reaction.
    - Poke a creature repeatedly and confirm an overreaction triggers but resets quickly.
    - Confirm collision reactions are readable but not rapid-fire flashing.

## Mobile-Specific Checks

1. **Touch controls + safe areas**
   - Open on a mobile device or emulator.
   - Pan with one finger, pinch to zoom, and double-tap to zoom.
   - Tap **Props** in the mobile bar to cycle prop types, then tap the canvas to place one.
   - Confirm HUD and mobile quick actions clear the notch/home indicator areas.
   - Open **Features** and adjust the Chaos Dial slider to confirm it remains touch-friendly.

2. **Spawn selection + play loop**
   - Tap **Spawn** in the mobile bar to open the creature sheet.
   - Select **Herbivore**, then tap **Spawn Selected** and confirm a herbivore spawns.
   - Reopen the sheet, select **Predator**, spawn again, and confirm a predator spawns.
   - Tap **Food** and confirm nearby creatures react and move toward it.

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
