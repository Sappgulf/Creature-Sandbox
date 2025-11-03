# 🗺️ **ORGANIC BIOME SYSTEM 2.0**

## 🎨 **What's New?**

The old 3-stripe horizontal biome system has been completely replaced with a **Perlin noise-based organic terrain generator**!

---

## 🌍 **Six Unique Biomes:**

### **1. 🌲 Forest (Dense)**
- **Characteristics:** High moisture, low temperature
- **Color:** Deep green (`#065f46`)
- **Food Rate:** 1.2x (Rich resources)
- **Movement Speed:** 0.8x (Dense vegetation slows movement)
- **Decorations:** Trees
- **Strategy:** Great for herbivores, provides cover from predators

### **2. 🌾 Grassland (Balanced)**
- **Characteristics:** Moderate moisture & temperature
- **Color:** Olive green (`#4d7c0f`)
- **Food Rate:** 1.0x (Baseline)
- **Movement Speed:** 1.0x (Normal)
- **Strategy:** Jack-of-all-trades, good for generalists

### **3. 🏜️ Desert (Harsh)**
- **Characteristics:** High temperature, low moisture
- **Color:** Sandy orange (`#d97706`)
- **Food Rate:** 0.3x (Very scarce)
- **Movement Speed:** 1.0x (Open terrain)
- **Decorations:** Cacti
- **Strategy:** Only the toughest survive, low competition

### **4. ⛰️ Mountain (Elevated)**
- **Characteristics:** High elevation
- **Color:** Rocky gray (`#6b7280`)
- **Food Rate:** 0.4x (Limited resources)
- **Movement Speed:** 0.85x (Rough terrain)
- **Decorations:** Rocks
- **Strategy:** Predator advantage (elevation), isolated populations

### **5. 🌊 Wetland (Fertile)**
- **Characteristics:** Low elevation, high moisture
- **Color:** Rich green (`#059669`)
- **Food Rate:** 0.9x (Abundant water plants)
- **Movement Speed:** 0.75x (Swampy terrain)
- **Decorations:** Reeds
- **Strategy:** High food but slow movement, vulnerable to ambush

### **6. 🌸 Meadow (Paradise)**
- **Characteristics:** High temperature & moisture
- **Color:** Bright lime (`#84cc16`)
- **Food Rate:** 1.4x (BEST food production)
- **Movement Speed:** 1.05x (Slightly faster)
- **Decorations:** Flowers
- **Strategy:** Hotspot for all creatures, high competition

---

## 🎲 **Perlin Noise Generation**

### **How It Works:**
The biome system uses **3 layers of Perlin noise**:

1. **Moisture Map** - Controls water availability
2. **Temperature Map** - Controls climate zones
3. **Elevation Map** - Controls terrain height

### **Classification Algorithm:**
```
if (elevation > 0.7) → Mountain
else if (elevation < 0.35 && moisture > 0.6) → Wetland
else if (temperature > 0.65 && moisture < 0.35) → Desert
else if (temperature < 0.4 && moisture > 0.5) → Dense Forest
else if (temperature > 0.55 && moisture > 0.5) → Meadow
else → Grassland (default)
```

---

## 🌳 **Environmental Decorations**

Each biome has unique visual decorations:

- **Forest**: Large trees (60% spawn rate)
- **Mountain**: Jagged rocks (40% spawn rate)
- **Desert**: Cacti (20% spawn rate)
- **Wetland**: Reeds (30% spawn rate)
- **Meadow**: Colorful flowers (50% spawn rate)

**Performance:** Decorations are:
- Generated once at world creation
- Frustum culled (only drawn when visible)
- Hidden when zoomed out (zoom < 0.3)

---

## 🗺️ **Mini-Map**

### **Location:** Bottom-right corner (always visible)

### **Features:**
- **Full world overview** - See the entire 4000x2800 world at once
- **Biome visualization** - Color-coded terrain
- **Creature population** - White dots show creature locations
- **Camera viewport** - Blue rectangle shows your current view
- **Click to navigate** (coming soon!)

### **Size:** 200x200 pixels
### **Update Rate:** Real-time (every frame)

---

## 📐 **World Specifications**

### **Size:**
- **Before:** 1000x700 pixels
- **After:** 4000x2800 pixels (4x larger!)

### **Biome Grid:**
- **Resolution:** 50-pixel samples
- **Total Samples:** ~4,500 biome tiles
- **Caching:** Biome lookups cached in 50px grid for performance

### **Camera:**
- **Min Zoom:** 0.1 (can zoom out 10x more!)
- **Max Zoom:** 3.0 (unchanged)
- **Starting Zoom:** 0.25 (start zoomed out to see terrain)

---

## 🎮 **Gameplay Impact**

### **Migration Becomes Strategic:**
- Creatures can now find optimal biomes
- Distance matters - migration costs energy
- Isolated populations → speciation

### **Biome Specialization:**
- Desert creatures evolve low metabolism
- Forest creatures evolve better camouflage
- Meadow creatures face high competition

### **Territorial Behavior:**
- Mountain predators control high ground
- Wetland ambush predators thrive
- Desert territories are massive due to low food

### **Food Dynamics:**
- Meadows = hot spots (1.4x food)
- Deserts = survival challenge (0.3x food)
- Creates natural boom/bust cycles

---

## ⚙️ **Technical Implementation**

### **Performance Optimizations:**

1. **Biome Caching:**
```javascript
// Cache key: rounded to 50px grid
const cacheKey = `${Math.floor(x/50)},${Math.floor(y/50)}`;
```

2. **Adaptive Rendering:**
```javascript
// Lower resolution when zoomed out
const sampleSize = Math.max(20, 100 / camera.zoom);
```

3. **Frustum Culling:**
```javascript
// Only render biomes in view bounds
if (x < bounds.x1 || x > bounds.x2) continue;
```

### **Memory Usage:**
- **Biome Map:** ~4,500 cached entries × ~200 bytes = ~900 KB
- **Decorations:** ~15,000 objects × ~50 bytes = ~750 KB
- **Total Overhead:** ~1.65 MB (negligible on modern hardware)

---

## 🎯 **Seed System**

Each world has a **deterministic seed** for reproducibility:

```javascript
const seed = Math.random(); // Or provide custom seed
const biomeGenerator = new BiomeGenerator(seed);
```

**Same seed = Same terrain!**

---

## 🚀 **Future Enhancements (Option C)**

### **Planned Features:**
- [ ] Click mini-map to teleport camera
- [ ] Biome-specific weather effects
- [ ] Day/night cycle
- [ ] Seasonal biome changes
- [ ] Water bodies (lakes, rivers)
- [ ] Elevation-based shadows
- [ ] Biome transition zones (ecotones)
- [ ] Procedural world generation UI

---

## 🔧 **Configuration**

### **Adjusting Biome Frequency:**

Edit `perlin-noise.js` → `BiomeGenerator.getBiomeAt()`:

```javascript
const scale = 0.001; // Smaller = larger biomes
const octaves = 3;    // More = more detail
const persistence = 0.5; // Higher = more rough
```

### **Adding New Biomes:**

1. Add classification logic in `_classifyBiome()`
2. Add decoration type in `_generateDecorations()`
3. Add rendering in `_drawDecoration()`

---

## 📊 **Comparison**

| Feature | Old System | New System |
|---------|-----------|------------|
| **Biome Types** | 3 | 6 |
| **Layout** | Horizontal stripes | Organic patches |
| **Generation** | Static | Procedural (Perlin noise) |
| **World Size** | 1000x700 | 4000x2800 |
| **Zoom Range** | 0.4x - 3x | 0.1x - 3x |
| **Mini-Map** | ❌ | ✅ |
| **Decorations** | ❌ | ✅ (5 types) |
| **Performance** | Good | Excellent (cached + culled) |

---

## 🎉 **ENJOY THE NEW TERRAIN!**

**Zoom out and explore!** The world is now 4x bigger with organic, natural-looking biomes that actually affect gameplay strategy!

🌲🌾🏜️⛰️🌊🌸

