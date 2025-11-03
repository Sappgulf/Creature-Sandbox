# 🎮 Creature Sandbox - Features Guide

## 🎹 Keyboard Controls

| Key | Feature | Description |
|-----|---------|-------------|
| `V` | **Vision Cones** | Shows sense radius & FOV for selected creatures |
| `C` | **Genetic Clustering** | Colors creatures by genetic similarity |
| `T` | **Territories** | Shows predator territories & dominance ranks |
| `M` | **Memory** | Displays memories for selected creature |
| `B` | **Social Bonds** | Shows herding & pack hunting connections |
| `G` | **Migration** | Visualizes migration paths between biomes |
| `Space` | **Pause/Resume** | Pause or resume the simulation |
| `I` | **Inspector** | Toggle inspector panel |
| `+/-` | **Speed** | Increase/decrease simulation speed |

---

## 1️⃣ Territory & Dominance System (T Key)

### How It Works
- **Predators establish territories** after reaching 10 seconds of age and getting their first kill
- Territory size based on **strength** (genes + health + kills + age)
- **Dominance hierarchy** determined by territorial strength
- When territories overlap, conflicts occur:
  - **Dominant** predator gains energy and confidence
  - **Subordinate** predator flees and loses energy

### Visual Indicators
- 🔴 **Red circles** = Alpha territory (#1 ranked)
- 🟡 **Yellow/Orange circles** = Secondary territories (#2-3 ranked)
- 🟤 **Brown circles** = Lower-ranked territories
- 🔥 **Red conflict zones** = Active territorial disputes
- **Numbers** (#1, #2, #3) = Dominance rank

### Evolutionary Impact
- Stronger predators control more space
- Losers must relocate or face starvation
- Natural selection favors dominant traits
- Creates spatial structure in predator populations

---

## 2️⃣ Learning & Memory (M Key)

### How It Works
- Creatures remember significant locations
- **Memory capacity**: 10-14 locations (based on sense gene)
- Memories **decay over time** (5% per second)
- Types of memories:
  - 🟢 **Food** = Successful foraging spots
  - 🔴 **Danger** = Attack locations
  - 🔵 **Safe** = Rest areas

### Visual Indicators
- **Circles at remembered locations**
- **Opacity** indicates memory strength
- Only visible for **selected creature**
- Stronger memories are more opaque

### Behavioral Impact
- Creatures revisit successful food locations
- Avoid areas where they were attacked
- Prefer safe zones when low on energy
- Smarter creatures (high sense) remember more

---

## 4️⃣ Advanced Social Behaviors (B Key)

### Herding (Herbivores)
- Herbivores detect nearby herd mates (within 1.2x sense radius)
- **Group buff**: 2-8 creatures → speed boost
- Buff strength based on **herd instinct gene**
- Visual: 🟢 **Green lines** connect herd members

### Pack Hunting (Predators)
- Predators with high **pack instinct** (>0.3) coordinate
- **Share targets** within detection range
- Multiple predators attack same prey
- Visual: 🔴 **Red dashed lines** show pack coordination

### Evolutionary Advantages
- **Herding**: Safety in numbers, better escape from predators
- **Pack Hunting**: Take down stronger prey, higher success rate
- Both behaviors are genetically controlled
- Social creatures have survival advantage

---

## 9️⃣ Migration Patterns (G Key)

### How It Works
- Creatures migrate between **3 biomes**:
  - 🌲 **Forest** (top) = High food rate
  - 🌾 **Grassland** (middle) = Normal food rate
  - 🏜️ **Desert** (bottom) = Low food rate
- **Migration instinct gene** (0-1) determines likelihood
- Triggered by:
  - Food scarcity in current biome
  - High migration instinct
  - Time since last migration (60s minimum)

### Visual Indicators
- 🟡 **Yellow dashed lines** = Migration path
- **Arrows** point toward target biome
- Only shown for creatures actively migrating
- Disappears when creature reaches destination

### Ecological Impact
- Nomadic creatures explore more territory
- Seasonal food availability drives movement
- Creates dynamic population distribution
- Balances biome populations naturally

---

## 🧬 Genetic Clustering (C Key)

### How It Works
- Groups creatures by genetic similarity using **k-means clustering**
- Analyzes genes: speed, metabolism, sense, aggression
- Creates **5 color groups**:
  - 🔴 Red (0°)
  - 🟡 Yellow (60°)
  - 🟢 Green (120°)
  - 🔵 Cyan (180°)
  - 🟣 Blue (240°)
  - 🟪 Magenta (300°)

### Use Cases
- **Visualize speciation** in real-time
- Identify genetic diversity
- Track lineage branches
- See which traits cluster together

---

## 👁️ Vision Cones (V Key)

### How It Works
- Shows **exactly what a creature can see**
- Only displays for **selected/pinned creatures**
- Click a creature first, then press V

### Visual Components
- **Dashed circle** = Full sense radius
- **Solid cone** = Field of view (FOV)
- **Colors change** based on target:
  - 🟢 Green = Herbivore found food
  - 🔴 Red = Predator tracking prey
  - 🟡 Yellow = No target

### Strategic Use
- Understand why creatures move certain ways
- See blind spots and vulnerabilities
- Observe predator stalking behavior
- Debug creature AI

---

## 🎯 Combined Feature Strategies

### **Research Setup**
1. Enable **Clustering** (C) to see species formation
2. Enable **Territories** (T) to observe predator dynamics
3. Enable **Migration** (G) to track population flow
4. Watch **evolution happen** in real-time!

### **Predator Analysis**
1. Enable **Territories** (T) to see dominance
2. Enable **Social Bonds** (B) to see pack formation
3. Enable **Vision** (V) on alpha predator
4. Observe hunting strategies

### **Creature Psychology**
1. Select a creature
2. Enable **Memory** (M) to see what it remembers
3. Enable **Vision** (V) to see what it perceives
4. Enable **Social Bonds** (B) to see relationships
5. Understand individual behavior!

---

## 📊 Performance Tips

- **Disable unused features** for better FPS
- **Clustering** updates once per second (optimized)
- **Territories** only calculated for mature predators
- **Memory** visualization only for selected creature
- **Social bonds** limited to nearby creatures

---

## 🔬 Scientific Applications

### Study Evolution
- **Genetic Clustering** shows speciation events
- **Territories** reveal selection pressure
- **Migration** demonstrates niche partitioning
- **Memory** shows cognitive evolution

### Ecology Research
- **Predator-prey dynamics** with territories
- **Social structure** emergence
- **Spatial distribution** via migration
- **Behavioral adaptation** through memory

### Game Design
- All features are **toggleable**
- **Visual feedback** for debugging
- **Performance-optimized** for large populations
- **Modular** architecture for extensions

---

## 🚀 Next Steps

Ready for **even more features**? Consider:
- **Camouflage & Mimicry** systems
- **Tool use** and problem-solving
- **Communication** signals between creatures
- **Complex ecosystems** with multiple species
- **AI training** using neural networks

**Your simulation is now a full-featured evolution sandbox!** 🎉

