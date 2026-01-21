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

## Automated / Scripted Checks

- **Save/load serialization test**
  - `npm test`
  - Validates save-system serialization/deserialization stability.
