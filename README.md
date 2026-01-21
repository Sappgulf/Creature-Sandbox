# 🧬 Creature Sandbox

An advanced evolutionary simulation featuring autonomous creatures with genetic inheritance, predator-prey dynamics, spatial optimization, and real-time analytics.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Sappgulf/Creature-Sandbox)

## 🎮 [Live Demo](#) 
*Deploy your own instance with the button above!*

---

## ✨ Features

### 🧬 Genetic Evolution
- **Hereditary traits**: Speed, field of view, sense radius, metabolism
- **Mutation system**: Random variations create genetic diversity
- **Natural selection**: Better-adapted creatures survive and reproduce
- **Lineage tracking**: Follow family trees across generations

### 🌍 Dynamic Ecosystem
- **Predator-prey dynamics**: Herbivores graze, predators hunt
- **Seasonal variations**: Environmental changes affect food availability
- **Temperature zones**: Comfort-based energy penalties
- **Pheromone trails**: Creatures leave chemical signals for food sources

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
- **Gene sharing**: Copy/import gene codes from the Gene Editor
- **Display toggles**: Nameplates and reduced-motion options in the Features panel

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

### Tool Modes (Keyboard Shortcuts)
- **X**: Inspect mode (default)
- **F**: Food painting mode
- **S**: Spawn creature mode
- **E**: Erase creatures mode
- **[ / ]**: Decrease/increase tool brush size

### Inspector Panel
- **Click creature**: Inspect individual stats and genes
- **Shift+Click creature**: Set as lineage root to explore family tree
- **Pin button**: Keep creature selected even if it moves
- **Parent links**: Navigate through ancestry
- **Export button**: Download simulation data

### Behavior Weights
Adjust how creatures prioritize actions:
- **Forage**: Tendency to seek food
- **Wander**: Random exploration behavior  
- **Rest**: Energy conservation when low on energy

---

## 🧪 Simulation Mechanics

### Creature Lifecycle
1. **Birth**: Spawned with parent's genes + random mutations
2. **Movement**: Steers toward food within sensory range
3. **Feeding**: 
   - Herbivores eat food pellets (+6 energy)
   - Predators hunt herbivores (+18 energy)
4. **Reproduction**: Herbivores reproduce at 36+ energy (costs 50%)
5. **Death**: Starvation (0 energy) or old age (300s)

### Genetic Traits
- **Speed** (0.2-2.0): Movement velocity
- **FOV** (20-160°): Visual field angle
- **Sense** (20-200px): Detection radius
- **Metabolism** (0.4-2.0): Energy consumption rate
- **Predator**: Binary trait (herbivore/predator)

### Energy Economy
- **Base cost**: Metabolism + movement + sensory processing
- **Temperature penalty**: Based on distance from comfort zone
- **Food reward**: 6 energy per pellet (herbivores), 18 per kill (predators)
- **Birth cost**: 50% of parent's energy

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
this.energy = isChild ? 18 : 24;  // Starting energy
// In update():
this.energy += 6;  // Food reward
this.energy += 18;  // Predation reward
```

---

## ♿ Accessibility

- **Reduced motion**: Toggle in the Features panel (persists across sessions).
- **Keyboard support**: Most core actions remain accessible via shortcuts (press `?` for help).

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
