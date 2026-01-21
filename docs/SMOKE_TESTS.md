# Creature Sandbox Smoke Tests

## Manual Core Loop Checks

1. **Load the game**
   - Run a local server (see README) and open the app in a browser.
   - Confirm the home screen renders and buttons are clickable.

2. **Create or edit a creature**
   - Click **🧬 Gene Editor** in the top HUD.
   - Adjust at least one gene slider and close the panel.
   - Spawn a creature via the quick actions or tools to ensure gene edits apply.

3. **Spawn a creature into the sandbox**
   - Press **S** to enable the spawn tool.
   - Click on the canvas to spawn a creature.
   - Verify the creature appears and begins moving.

4. **Interact/play**
   - Press **F** and paint food into the world.
   - Use **E** to erase a creature.
   - Toggle pause/resume with **Space** and confirm the sim halts/continues.

5. **Save/load roundtrip**
   - Use **Ctrl+S** to save the game.
   - Refresh the page.
   - Use **Ctrl+O** to load the save.
   - Confirm creatures, food counts, and time of day restore correctly.

## Mobile-Specific Checks

1. **Touch controls + safe areas**
   - Open on a mobile device or emulator.
   - Pan with one finger, pinch to zoom, and double-tap to zoom.
   - Confirm HUD and mobile quick actions clear the notch/home indicator areas.

2. **On-screen keyboard**
   - Open Scenario Lab or Gene Editor and focus a text input.
   - Confirm panels stay visible and inputs remain reachable with the keyboard open.

3. **Tap targets**
   - Tap top HUD buttons and mobile quick actions.
   - Confirm no tiny targets block touch usage.

## Accessibility Checks

1. **Keyboard navigation**
   - Use **Tab** to reach top HUD buttons and panel controls.
   - Confirm visible focus rings appear.

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
