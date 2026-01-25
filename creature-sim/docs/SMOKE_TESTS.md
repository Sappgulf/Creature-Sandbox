# Smoke Tests - Creature Sandbox

**Last Updated:** 2026-01-25
**Status:** Recovery mission - verifying core loop functionality

---

## 🔴 Critical Tests (Must Pass)

### Test 0: App Boots Without Errors
1. Navigate to http://localhost:8000
2. Open browser console (F12)
3. **Expected**:
   - Home page loads
   - No JavaScript syntax errors
   - No 404s for missing files
   - Console shows "🚀 Starting Creature Sandbox..." message

### Test 1: New Game Button Works
1. Click "New Game" on home page
2. **Expected**:
   - Home page hides
   - Canvas appears with creatures and food
   - No console errors
   - Simulation starts automatically

### Test 2: Create/Edit Creature
1. Open ⋯ More → Gene Editor
2. Adjust speed slider
3. Click "Spawn from Editor"
4. **Expected**:
   - Gene editor opens
   - Sliders update values
   - Spawn places creature with edited genes
   - No console errors

### Test 3: Select Creature (Desktop)
1. Click a creature on canvas
2. **Expected**:
   - Creature highlights with selection glow
   - Inspector panel shows creature stats
   - Can view genes, badges, family
   - No console errors

### Test 4: Select Creature (Mobile)
1. Tap a creature on canvas
2. **Expected**:
   - Creature highlights
   - Inspector shows stats
   - Can view details
   - No console errors

### Test 5: Spawn Creature (Desktop)
1. Click Spawn button (🦌) or press S key
2. Select creature type from dropdown
3. Click canvas
4. **Expected**:
   - Spawn mode activates
   - Creature spawns at click location
   - Correct diet type
   - No console errors

### Test 6: Spawn Creature (Mobile)
1. Tap Spawn button (🦌) in control strip
2. Bottom sheet opens with creature cards
3. Tap a creature type (herbivore/omnivore/predator)
4. Tap canvas
5. **Expected**:
   - Bottom sheet slides up
   - Selected type shows checkmark
   - Creature spawns at tap location
   - Sheet dismisses
   - No console errors

### Test 7: Simulation Runs
1. Start new game
2. Watch for 60 seconds
3. **Expected**:
   - Creatures move, eat, reproduce
   - Herbivores eat food patches
   - Predators hunt
   - Pause/resume works (Space key)
   - No crashes or freezes

### Test 8: Save/Load Roundtrip
1. Start new game, let creatures establish
2. Select a creature, note stats
3. Press Ctrl/⌘+S to save
4. Modify world (spawn more creatures)
5. Press Ctrl/⌘+O and load the file
6. **Expected**:
   - Save triggers file download
   - Load restores exact state
   - Selected creature stats match
   - No corruption

---

## Camera Stability

### Test 1: Idle Camera (NO MOVEMENT)
1. Start new sandbox
2. Wait 2 minutes without touching anything
3. **Expected**: Camera DOES NOT move

### Test 2: UI Interaction Camera Isolation
1. Start sandbox with creatures
2. Open spawn drawer → close it
3. Open overflow menu → close it
4. **Expected**: Camera DOES NOT move during any UI interaction

### Test 3: User Override Permanence
1. Pan the camera manually
2. Wait 1 minute
3. **Expected**: Camera stays where you left it (no auto-movement)

### Test 4: Watch Mode Auto-Director
1. Press Watch button (👁️) to enter watch mode
2. Wait with creatures on screen
3. **Expected**: Camera may move to follow events (births, eating, etc.)
4. Pan camera manually while in watch mode
5. **Expected**: Auto-director stops moving camera
6. Press Recenter button (⟳)
7. **Expected**: Auto-director resumes

### Test 5: Mobile Drawer Scroll
1. On mobile device, open spawn drawer
2. Scroll up/down on the drawer content
3. **Expected**: World canvas does NOT pan while scrolling drawer

---

## Spawn System

### Test 6: Spawn Correct Creature
1. Tap Spawn button (🦌)
2. Select "Predator" in drawer
3. Tap "Tap World to Spawn"
4. Tap on canvas
5. **Expected**: Predator creature spawns (not herbivore)

### Test 7: Spawn Type Persistence
1. Complete Test 6
2. Spawn button should now show 🦁 (predator) icon
3. Tap canvas again
4. **Expected**: Another predator spawns

---

## Speed Control

### Test 8: Speed Cycling
1. Note current speed (default: 1×)
2. Tap speed button repeatedly
3. **Expected**: Cycles through 0.5× → 1× → 2× → 4× → 0.5×...
4. Game simulation speed actually changes

---

## Watch Mode

### Test 9: Watch Mode Toggle
1. Press Watch button (👁️)
2. **Expected**: Control strip hides, watch strip appears
3. **Expected**: Auto-director can now move camera (if creatures present)
4. Press Exit button (✕)
5. **Expected**: Returns to normal control strip

### Test 10: Watch Mode Follow
1. Enter watch mode
2. Select a creature
3. Press Follow button (🎯)
4. **Expected**: Camera follows selected creature

---

## God Mode

### Test 11: God Mode Access
1. Press God Mode button (✨)
2. **Expected**: God mode panel appears
3. Can spawn food, delete creatures
4. Press button again
5. **Expected**: God mode deactivates

---

## Save/Load

### Test 12: Save and Load
1. Spawn some creatures, let them live for a bit
2. Open overflow menu → Save Game
3. Close and reopen browser
4. Open overflow menu → Load Game
5. **Expected**: Previous state restored

---

## Mobile Specific

### Test 13: Touch Targets
1. All buttons should be easy to tap (≥44px)
2. No accidental misclicks

### Test 14: Safe Area
1. On iPhone with notch/dynamic island
2. UI should not be hidden by safe areas

---

## Performance

### Test 15: Long Run Stability
1. Run game for 10+ minutes
2. **Expected**: No slowdown, no memory issues
3. **Expected**: No console spam/errors

---

## Survivability

### Test 16: Creatures Don't Die Instantly
1. Spawn 10+ herbivores
2. Let simulation run
3. **Expected**: Creatures live for reasonable time
4. **Expected**: Deaths are gradual, not instant mass die-offs

---

## 🎯 Recovery Status

### Fixed Issues
- ✅ **P0**: Syntax error in main.js:1163 (stray '1' character) - FIXED
- ✅ **Verified**: Button handlers properly attached in showHomePage()
- ✅ **Verified**: Shortcuts close button handler added to ui-controller.js

### Pending Verification
- ⏳ All smoke tests above require manual browser testing
- ⏳ Mobile touch controls
- ⏳ Long-run stability
- ⏳ No console error spam

### Next Steps
1. Run app in browser
2. Execute Critical Tests (Test 0-8)
3. Document any failures in RECOVERY_REPORT.md
4. Fix P0/P1 issues
5. Re-test until all critical tests pass

---

## Test Results Summary

**Date:** 2026-01-25
**Tester:** Pending manual testing

| Test | Status | Notes |
|------|--------|-------|
| Test 0: App Boots | ⏳ | Pending |
| Test 1: New Game | ⏳ | Pending |
| Test 2: Create/Edit | ⏳ | Pending |
| Test 3: Select (Desktop) | ⏳ | Pending |
| Test 4: Select (Mobile) | ⏳ | Pending |
| Test 5: Spawn (Desktop) | ⏳ | Pending |
| Test 6: Spawn (Mobile) | ⏳ | Pending |
| Test 7: Simulation Runs | ⏳ | Pending |
| Test 8: Save/Load | ⏳ | Pending |
