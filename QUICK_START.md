# ⚡ Quick Start - New Features

## 🎮 How to Use the Features

### 1. Vision Cones 👁️

**How to activate:**
1. Press `V` key (you'll see 👁️ icon in stats bar)
2. **IMPORTANT**: Click on a creature to select it
3. You'll now see the vision cone for that creature!

**What you see:**
- Dotted circle = sense radius
- Filled triangle = field of view (FOV)
- 🟢 Green = herbivore found food
- 🔴 Red = predator found prey  
- 🟡 Yellow = searching

**Why it's not showing:**
- You need to SELECT a creature first (click on one)
- Or PIN a creature (click Pin button in inspector)
- Only selected/pinned creatures show vision

---

### 2. Genetic Clustering 🧬

**How to activate:**
1. Press `C` key (you'll see 🧬 icon in stats bar)
2. All creatures will instantly change colors!

**What you see:**
- Creatures grouped into 5 "species" by genes
- Similar genetics = same color
- Colors: Red, Orange, Green, Cyan, Purple, Magenta

**If not working:**
- Make sure population > 5 creatures
- Look for the 🧬 emoji in stats bar
- All creatures should change color immediately

---

### 3. Biomes 🌍

**Always visible!**
- Top third = Forest (dark green) - lots of food
- Middle = Grassland (light green) - normal
- Bottom = Desert (tan) - scarce food

Watch creatures migrate to better biomes!

---

### 4. Disasters 💥

**Happens automatically every 2-4 minutes:**
- You'll see: `⚠️ Disaster Name (30s)` in stats
- Also logged in "Lineage Stories" panel

**Types:**
- ☄️ Meteor Storm - creatures die randomly
- ❄️ Ice Age - cold + no food
- 🦠 Plague - spreads disease
- 🌵 Drought - food stops spawning

---

## 🐛 Troubleshooting

### "V key does nothing"
✅ **Solution**: Click a creature first, THEN press V

### "C key does nothing"  
✅ **Check console** (F12 → Console tab)
- Should say: "Genetic clustering: ON"
- Should see 🧬 in stats bar
- All creatures change color

### "No biomes showing"
✅ **They're subtle** - look for faint color bands:
- Green tint at top
- Tan tint at bottom

### "No disasters"
✅ **They're random** - wait 2-4 minutes
- Only triggers if population > 10
- 0.05% chance per frame

---

## 📋 Quick Test Checklist

1. **Open game in browser**
2. **Press `V`** → See 👁️ in stats bar
3. **Click a creature** → See vision cone appear!
4. **Press `C`** → See 🧬 in stats bar + all creatures change color
5. **Look at screen** → See biome color bands
6. **Wait 3 minutes** → Disaster should trigger

---

## 🔧 Debug Mode

**Open browser console (F12) and:**
```javascript
// Check if features are loaded
console.log(renderer.enableVision);      // should be true/false
console.log(renderer.enableClustering);  // should be true/false

// Force enable features
renderer.enableVision = true;
renderer.enableClustering = true;

// Trigger a disaster manually
world.triggerRandomDisaster();

// Check biomes
console.log(world.biomes);
```

---

## ✅ Expected Behavior

### When `V` is pressed:
- Console: "Vision cones: ON (click a creature to see)"
- Stats bar shows: 👁️
- Vision cones appear on SELECTED creatures

### When `C` is pressed:
- Console: "Genetic clustering: ON"
- Stats bar shows: 🧬
- ALL creatures change to cluster colors

### Visual indicators in stats:
```
Pop: 75 (H:69 P:6)  Food: 180  t=45.2s  60 FPS  HP:85%  👁️ 🧬  Tool: INSPECT
```

---

## 🎯 Pro Tips

1. **Select multiple**: Pin one creature, then vision stays on it
2. **Watch predators**: Their red vision cone shows hunting
3. **Species diversity**: More colors in clustering = healthier ecosystem
4. **Biome migration**: Forest fills with herbivores over time
5. **Disaster survival**: Watch which genes survive catastrophes

---

**If features still not working, check:**
- JavaScript console for errors (F12)
- Make sure you accepted all file changes
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

Need help? Open browser console and look for error messages!

