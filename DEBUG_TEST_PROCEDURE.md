# DEBUG TEST PROCEDURE FOR VISION & CLUSTERING

## 🔴 CRITICAL FIRST STEP: Clear Cache
1. **Hard refresh your browser**: 
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`  
   - Or open DevTools → Right-click refresh → "Empty Cache and Hard Reload"

## Testing Vision Cones (V Key)

### Step 1: Enable Vision
1. Open browser console (F12 or Cmd+Option+I)
2. Press **V** key
3. **Expected console output:**
   ```
   [VISION CONES] ENABLED ✓ (in green)
   ℹ️ Click on a creature to see its vision cone and sense radius
   ```

### Step 2: Select a Creature
1. **Click on any creature** in the game
2. **Expected:** Selected creature should have a yellow ring around it
3. **Expected console output:**
   ```
   [VISION DEBUG] Drawing cone for creature #X (in blue)
   { sense: 100, fov: 90, x: 123, y: 456 }
   ```
4. **Expected visual:**
   - Large circle (sense radius) around creature
   - Cone shape showing field of view
   - Colors change based on if creature has a target

### Step 3: Check Renderer State
1. Wait ~1 second
2. **Expected console output:**
   ```
   [RENDERER STATE] (in purple)
   {
     enableVision: true,
     enableClustering: false,
     enableTrails: true,
     selectedId: <number>,
     pinnedId: null
   }
   ```

## Testing Genetic Clustering (C Key)

### Step 1: Enable Clustering
1. Clear console for easier reading
2. Press **C** key
3. **Expected console output:**
   ```
   [GENETIC CLUSTERING] ENABLED ✓ (in green)
   ℹ️ Creatures are now colored by genetic similarity (updates every second)
   ```

### Step 2: Wait for Computation
1. Wait 1-2 seconds
2. **Expected console output:**
   ```
   [CLUSTERING DEBUG] Frame 0: Computed X clusters from Y creatures. Sample: (in orange)
   [[creatureId, hue], [creatureId, hue], [creatureId, hue]]
   ```

### Step 3: Verify Visual Change
1. **Expected:** ALL creatures should change colors immediately
2. Creatures with similar genes should have similar colors
3. Colors should be: 0° (red), 60° (yellow), 120° (green), 180° (cyan), 240° (blue), 300° (magenta)

### Step 4: Check Renderer State
1. **Expected console output every second:**
   ```
   [RENDERER STATE] (in purple)
   {
     enableVision: false,
     enableClustering: true,
     ...
   }
   ```

## 🔍 Troubleshooting

### If console shows correct state but NO visuals:
- Check if there are any JavaScript errors in console
- Verify canvas is not being cleared or overwritten
- Check browser zoom level (should be 100%)
- Try different creatures (some might have very small sense radius)

### If console shows NOTHING when pressing V/C:
- Hard refresh again (Cmd+Shift+R)
- Check if keyboard focus is on the canvas/window
- Check if another element is capturing keyboard events

### If clustering shows computed but creatures don't change color:
- The hue values should be in the range [0, 300]
- Check if there's a CSS filter or canvas composite mode interfering
- Look for any errors related to "displayHue" or "clusterHue"

## Expected Debug Output (Full Example)

When both features are enabled and a creature is selected:

```
[VISION CONES] ENABLED ✓
ℹ️ Click on a creature to see its vision cone and sense radius
[GENETIC CLUSTERING] ENABLED ✓  
ℹ️ Creatures are now colored by genetic similarity
[CLUSTERING DEBUG] Frame 60: Computed 70 clusters from 70 creatures. Sample: [[1, 0], [2, 120], [3, 240]]
[RENDERER STATE] { enableVision: true, enableClustering: true, enableTrails: true, selectedId: 5, pinnedId: null }
[VISION DEBUG] Drawing cone for creature #5 { sense: 100, fov: 90, x: 345, y: 678 }
```

## 📊 What to Report Back

Please report:
1. ✅ or ❌ Console messages appear as expected
2. ✅ or ❌ Vision cones visible when creature selected
3. ✅ or ❌ Creature colors change with clustering enabled
4. Any JavaScript errors in console (copy full error)
5. Screenshot of console output after enabling both features

