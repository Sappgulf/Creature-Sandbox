# 🧬 Creature Sandbox

**A massively expanded evolution simulator with advanced AI, personality system, family bonds, seasonal events, and god powers!**

An advanced evolutionary simulation featuring autonomous creatures with genetic inheritance, deep personalities, sophisticated AI, memory & learning, family relationships, and emergent behaviors in a living, breathing ecosystem.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Sappgulf/Creature-Sandbox)

## 🎮 [Live Demo](#) 
*Deploy your own instance with the button above!*

---

## ✨ What's New in v2.0.0

### 🎭 **Advanced Systems**
- **Personality System**: 7 core traits (boldness, curiosity, sociability, etc.), 15+ unique quirks, 5 temperaments
- **Advanced Genetics**: 15 rare mutations (bioluminescence, regeneration, chameleon, etc.) with 5 rarity tiers
- **Family Bonds**: Track parents, siblings, mates, friends, and rivals with bond strength and behaviors
- **Memory & Learning**: Creatures remember food locations, danger zones, learn from experience, and observe others
- **Seasonal Events**: 4 seasons (Spring→Summer→Autumn→Winter) with 10+ dynamic events and migrations
- **God Powers**: 13 powers across 4 tiers (bless, lightning, time warp, apocalypse, etc.)

### 🧠 **Sophisticated AI**
- **5 Hunting Strategies**: Ambush, chase, intercept, herd, patience
- **5 Evasion Tactics**: Zigzag, hide, group flee, freeze
- **Dynamic Strategy Selection**: AI adapts based on creature stats and situation
- **Hunt Success Probability**: Realistic calculation based on speed, sense, defenses, and fatigue

### 🎵 **Immersive Audio**
- **Procedural Sound System**: Web Audio API with tone/sweep/noise generators
- **ADSR Envelopes**: Natural attack, decay, sustain, release for every sound
- **10+ Sound Events**: Birth, death, eating, mating, attack, movement, biome ambience, weather

### 🌍 **Rich Environments**
- **8 Unique Biomes**: Forest, desert, tundra, swamp, ocean, mountain, jungle, savanna
- **Biome Adaptation System**: Creatures adapt over time, unlocking special bonuses
- **Biome-Specific Effects**: Energy costs, stress levels, movement, detection, food preferences

### 🏆 **Progression Systems**
- **30+ Achievements**: Unlock new biomes, creatures, tools, features, challenges, skins, particles, sounds
- **8 Achievement Categories**: Population, genetics, survival, ecosystem, behavior, biome, special, mastery
- **Campaign Mode**: Structured challenges with star ratings and progression
- **Session Goals**: Dynamic micro-challenges that encourage experimentation

---

## ✨ Core Features

### 🧬 Genetic Evolution
- **Hereditary traits**: Speed, field of view, sense radius, metabolism
- **Mutation system**: Random variations create genetic diversity
- **Natural selection**: Better-adapted creatures survive and reproduce
- **Lineage tracking**: Follow family trees across generations

### 🌍 Dynamic Ecosystem
- **Predator-prey dynamics**: Herbivores graze, predators hunt
- **Seasonal variations**: Environmental changes affect food availability
- **Day/night rhythm**: Activity, rest biasing, and ambient lighting shift across the cycle
- **Temperature zones**: Comfort-based energy penalties
- **Pheromone trails**: Creatures leave chemical signals for food sources
- **Internal state loop**: Stress, curiosity, energy, and stability shift with impacts, crowding, and rest
- **Social contagion**: Calm and panicked states subtly influence nearby creatures
- **Needs-driven goals**: Hunger, energy, social drive, and stress select goals (eat/rest/mate/wander)
- **Rest zones**: Calm pockets where tired creatures recover energy and reduce stress
- **Bite-based food**: Food patches deplete in bites with scent detection
- **Food regrowth cycles**: Patches replenish over time with time-of-day and population pressure
- **Weather moods**: Short wind/calm phases shift the ecosystem’s tone without hard rules
- **Population guardrails**: Mating slows down above soft caps to prevent runaway growth
- **Place memory + learning**: Creatures remember food, calm, danger, and nest locations with reinforcement/decay
- **Life stages**: Babies explore fast, adults stabilize, elders slow down and fade gently
- **Nests + home regions**: Creatures establish homes, settle around nests, and build territory preference
- **Territory pressure**: Crowded regions add stress, reduce comfort, and increase migration pull
- **Migration flows**: Populations relocate based on food, pressure, and stress, then resettle

### 📊 Real-Time Analytics
- **Population tracking**: Monitor herbivore/predator ratios
- **Trait evolution**: Watch speed, metabolism, and sense evolve over time
- **Variance analysis**: Track genetic diversity
- **Responsive dashboard**: Scales analytics panels to fit the viewport
- **Export data**: Download simulation snapshots as JSON

### 🎨 Interactive Interface
- **Inspector panel**: Examine individual creatures in detail
- **Lineage view**: Explore family trees and descendants
- **Behavior tuning**: Adjust forage/wander/rest weights in real-time
- **Tool modes**: Paint food, spawn creatures, or erase with mouse
- **Camera controls**: Pan, zoom, and follow creatures
- **Watch mode**: Observer-first control strip with auto-director camera and moments log
- **Sandbox props**: Drop bounce pads, spinners, gravity wells, and food buttons
- **Micro toys**: Spring pads, launch buttons, see-saws, conveyors, wind fans, sticky zones, and speed slopes
- **Direct manipulation**: Drag, move, and throw creatures for playful experiments
- **Grab affordances**: Hover creatures to see a grab outline and grabbed highlight
- **Creature feedback**: Selection glow, success pulses, and friendly error shakes
- **Chaos dial**: Tune physics wobble, bounce energy, and gravity drift from calm to silly
- **God mode (optional)**: Enter a gentle intervention mode to place food, calm zones, or nudge chaos
- **Gene sharing**: Copy/import gene codes from the Gene Editor
- **Display toggles**: Nameplates, reduced motion, region boundaries, and nest markers in the Features panel
- **Condensed top HUD**: Primary controls plus a ⋯ overflow menu for all panels
- **Moments log**: Tap a moment to jump the camera and review a session summary

### ⚡ Performance Optimized
- **Spatial partitioning**: O(1) proximity queries with grid-based optimization
- **Double-buffering**: Eliminates 60+ allocations per second
- **Intelligent caching**: Memoized lineage computations
- **Optimized loops**: 30-50% CPU reduction vs baseline
- **Efficient BFS**: Index-based queues for O(n) traversal

---

## 🚀 Quick Start

### Deploy to Vercel (Recommended)
1. Click the "Deploy with Vercel" button above
2. Connect your GitHub account
3. Deploy! Your simulation will be live in ~30 seconds

### Run Locally
```bash
# Clone the repository
git clone https://github.com/Sappgulf/Creature-Sandbox.git
cd Creature-Sandbox

# Serve the static files (choose one):
python3 -m http.server 8000 --directory creature-sim
# or
npx serve creature-sim -p 8000

# Open in browser
open http://localhost:8000
```

---

## 🎯 How to Use

### Basic Controls
- **Space**: Pause/Resume simulation
- **I**: Toggle inspector panel
- **+/-**: Adjust simulation speed (1x to 5x)
- **Mouse Wheel**: Zoom camera
- **Middle Click / Alt+Drag**: Pan camera
- **Drag**: Grab, move, and throw creatures (mouse or touch)
- **Throw feel**: Throws are capped for predictable arcs (short drags stay gentle)
- **Hover (mouse/pen)**: See a grab outline on creatures in Inspect mode
- **Ctrl/⌘ + S / Ctrl/⌘ + O**: Save to file / load from file
- **God Mode**: Open **⋯ More Actions** → **✨ God Mode** or long-press the world (touch)
- **Watch Mode**: Use the bottom control strip for pause, follow, speed, moments, and re-center

### Tool Modes (Keyboard Shortcuts)
- **X**: Inspect mode (default)
- **F**: Food painting mode
- **S**: Spawn creature mode
- **E**: Erase creatures mode
- **P**: Sandbox props mode (bounce/spring/spinner/see-saw/conveyor/slope/fan/sticky/gravity/button/launch)
- **[ / ]**: Decrease/increase tool brush size

### Mobile Quick Actions
- **Spawn**: Opens the creature picker sheet. Choose a type and tap **Spawn Selected**.
- **Food**: Drops food clusters near the camera center.
- **Props**: Cycles props, then tap the canvas to place.
- **Pause / Speed**: Toggle pause and cycle simulation speed.
- **Panels**: Side panels start collapsed on mobile; reopen them from the ⋯ menu or the **Show inspector** button.

### God Mode (Optional)
- **Enter/Exit**: Toggle via **⋯ More Actions** or long-press the world.
- **Tools**: Place a food source, create a calm zone, nudge chaos, or spawn/remove a creature.
- **Autonomy-first**: Leaving god mode resumes normal time and creature behavior.

### Inspector Panel
- **Click creature**: Inspect individual stats and genes
- **Shift+Click creature**: Set as lineage root to explore family tree
- **Pin button**: Keep creature selected even if it moves
- **Parent links**: Navigate through ancestry
- **Export button**: Download simulation data

### Developer / Observer Tools (Optional)
- **`debug.goals()`**: Show goal labels and target lines for creatures.
- **`debug.observe()`**: Show life-stage labels and remembered locations (memory markers).

### Behavior Weights
Adjust how creatures prioritize actions:
- **Forage**: Tendency to seek food
- **Wander**: Random exploration behavior  
- **Rest**: Energy conservation when low on energy

---

## 🧪 Simulation Mechanics

### Creature Lifecycle
1. **Birth**: Spawned with parent's genes + random mutations
2. **Needs update**: Hunger/energy/social/stress drift over time and impacts
3. **Goals**: Utility picks eat/rest/mate/wander using local sensing
4. **Memory**: Creatures record food/calm/danger/nest locations with decay + reinforcement
5. **Feeding**:
   - Herbivores and omnivores eat food bites (scent-based detection)
   - Predators hunt herbivores (+14 energy)
6. **Rest**: Creatures slow down in rest zones to recover energy and calm stress
7. **Reproduction**: Mate-ready creatures bond, then spawn offspring with guardrails
8. **Damage & recovery**: Impacts use gentle thresholds + brief i-frames, so small bumps are safe
9. **Life stages**: Baby → adult → elder with smooth size/speed shifts and elder fade-out
10. **Death**: Starvation (0 energy) or elder fade (≈300s)

### Genetic Traits
- **Speed** (0.2-2.0): Movement velocity
- **FOV** (20-160°): Visual field angle
- **Sense** (20-200px): Detection radius
- **Metabolism** (0.4-2.0): Energy consumption rate
- **Predator**: Binary trait (herbivore/predator)
- **Diet roles**: Herbivore, scavenger, and predator-lite (stress + scatter without instant kills)

### Energy Economy
- **Base cost**: Metabolism + movement + sensory processing
- **Temperature penalty**: Based on distance from comfort zone
- **Food reward**: Bite-based energy per patch, predators gain ~14 per kill
- **Rest recovery**: Rest zones provide steady energy regen
- **Birth cost**: Parents pay energy + social drive during mating

### Badges & Milestones
Creatures earn badges for achievements:
- **Swift**: Speed ≥ 1.45
- **Scout**: Sense ≥ 150
- **Efficient**: Metabolism ≤ 0.6
- **Elder**: Age ≥ 120s
- **Grazer**: 15+ meals eaten
- **Apex**: 3+ successful hunts
- **Charged**: Energy ≥ 35

---

## 📐 Architecture

### Core Systems
- **World** (`world.js`): Main simulation loop, spatial grid, lineage registry
- **Creature** (`creature.js`): Individual behavior, pathfinding, energy management
- **Genetics** (`genetics.js`): Gene generation and mutation
- **Renderer** (`renderer.js`): Canvas drawing with camera transforms
- **Analytics** (`analytics.js`): Time-series data collection and aggregation

### Creature State (Centralized)
- **Memory + learning**: Stored on each creature (`creature.js` + `creature-features.js`) and persisted via `save-system.js`.
- **Life stages**: Age + life-stage state tracked per creature (`creature.js`) and restored in save/load migration.

### Performance Features
- **Spatial Grid**: O(1) average-case proximity queries
- **Double Buffering**: Scalar field updates without allocation
- **BFS Optimization**: Index-based queues (no array.shift)
- **Memoization**: Cached lineage computations
- **Lazy Evaluation**: On-demand calculation with caching

### Data Structures
- **Registry Map**: O(1) creature lookup by ID
- **Children Map**: Parent → Set of child IDs
- **Spatial Hash Grid**: Position-based entity bucketing
- **Float32Array**: Efficient scalar field storage

---

## 🎨 Customization

### Modify Initial Population
Edit `main.js`:
```javascript
world.seed(70, 6, 200);  // (herbivores, predators, food)
```

### Adjust World Parameters
Edit `world.js`:
```javascript
this.seasonSpeed = 0.015;  // Season cycle rate
this.maxFood = Math.floor((width * height) / 320);  // Food cap
```

### Change Mutation Rate
Edit `world.js` in `spawnChild()`:
```javascript
const childGenes = mutateGenes(parent.genes, 0.05);  // Mutation amount
```

### Tune Energy Values
Edit `creature.js`:
```javascript
this.energy = isChild ? 36 : 52;  // Starting energy
```
Edit `creature-agent-constants.js` for food bite rewards:
```javascript
BITE_ENERGY: 4.5, // Energy gained per food bite
```

---

## ♿ Accessibility

- **Reduced motion**: Toggle in the Features panel (persists across sessions).
- **Keyboard support**: Most core actions remain accessible via shortcuts (press `?` for help).
- **Menu navigation**: Overflow menu supports arrow keys, Enter, and Escape.
- **Help section**: The ⋯ menu includes a quick map of controls and shortcuts.

---

## 📊 Performance Metrics

**Optimized Performance:**
- 100 creatures: 60 FPS (stable)
- 200 creatures: 45-50 FPS
- CPU usage: 30-50% reduction vs baseline
- GC pressure: -70%
- Frame variance: -60%

**Complexity:**
- Creature update: O(1) per creature
- Spatial queries: O(1) average case
- Lineage traversal: O(depth) or O(1) cached
- BFS operations: O(n) with index queue

See `OPTIMIZATION_REPORT.md` for detailed analysis.

---

## 🛠️ Tech Stack

- **Vanilla JavaScript** (ES6 modules)
- **HTML5 Canvas** (2D rendering)
- **No dependencies** (zero npm packages)
- **Static hosting** (Vercel, Netlify, GitHub Pages compatible)

---

## 📄 License

MIT License - feel free to fork, modify, and deploy!

---

## 🙏 Credits

Built with performance and evolution simulation best practices.

Optimized for production deployment with comprehensive algorithmic improvements.

---

## 🐛 Issues & Contributing

Found a bug? Have a feature idea? 
- Open an issue on GitHub
- Submit a pull request
- Star the repo if you find it useful! ⭐

---

**Enjoy watching evolution unfold in real-time!** 🧬✨
