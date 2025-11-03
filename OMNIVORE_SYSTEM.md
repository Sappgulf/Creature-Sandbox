# 🦡 Omnivore/Scavenger System

## Overview
Added a third creature type: **Omnivores/Scavengers** that can eat both plants and dead creatures (corpses). This creates a more complex and balanced ecosystem!

## Key Features

### 1. Diet Gene System
- **New `diet` gene**: 0-1 scale
  - `0.0-0.3`: Herbivore (plants only)
  - `0.3-0.7`: Omnivore/Scavenger (plants + corpses)
  - `0.7-1.0`: Carnivore (prey + corpses)
- Diet can mutate gradually over generations
- Creatures adapt traits based on diet type

### 2. Corpse System
When creatures die, they leave behind corpses:
- **Energy Value**: Based on creature size
- **Decay**: Corpses slowly decay over time (2% per second)
- **Visual**: Brown (predators) or olive (herbivores) with X marker
- **Spatial Grid**: Efficient corpse lookup using SpatialGrid

### 3. Scavenging Behavior
Omnivores and carnivores can scavenge:
- **Smart Targeting**: 
  - Omnivores prefer corpses when hungry (< 25 energy)
  - Carnivores scavenge when no prey available (< 30 energy)
- **Energy Gain**: Up to 8 energy per corpse feeding
- **Memory**: Creatures remember corpse locations as food sources

### 4. Visual Distinction
- **Size**: Omnivores are medium-sized (4.0 units)
- **Color**: Distinct orange/tan hue (hue = 30)
- **Corpses**: Dark brown/olive with decay alpha and X marker

### 5. Game Balance Impact
Omnivores help stabilize the ecosystem:
- **Buffer During Crashes**: Eat corpses when population dies off
- **Prevent Waste**: Convert dead biomass back into energy
- **Adaptive**: Can survive on plants when prey scarce
- **Fill Niche**: Medium metabolism, good senses

## Usage

### Spawning Omnivores
Click the **"+ Omnivore"** button to spawn a scavenger with:
- Diet: 0.5 (perfect omnivore)
- Speed: 1.0 (balanced)
- Sense: 110 (enhanced for finding corpses)
- Metabolism: 0.9 (efficient)
- Hue: 30 (orange/tan color)

### Stats Display
The HUD now shows:
- 🌿 Herbivores
- 🦡 Omnivores
- 🦁 Carnivores  
- 💀 Corpses (available food for scavengers)

## Technical Implementation

### Files Modified
1. **genetics.js**: Added `diet` gene and mutation logic
2. **creature.js**: 
   - Diet-based behavior switching
   - Corpse targeting logic
   - Scavenging action
3. **world.js**:
   - Corpse tracking array and spatial grid
   - `_createCorpse()`, `_updateCorpses()`, `findNearbyCorpse()`, `tryEatCorpse()`
4. **renderer.js**: `drawCorpses()` method
5. **ui.js**: Updated stats to show diet categories
6. **main.js**: Added omnivore spawn callback
7. **index.html**: Added "+ Omnivore" button

### Performance Considerations
- **Spatial Grid**: O(1) corpse lookup (no linear scans)
- **In-place Compaction**: Corpse array cleanup without allocation
- **Frustum Culling**: Only render visible corpses
- **Efficient Memory**: Corpses auto-remove when fully consumed or decayed

## Evolution & Strategy

### Natural Emergence
Omnivores can naturally evolve from:
- **Herbivores**: Gradually increasing diet gene towards carnivory
- **Carnivores**: Gradually decreasing diet gene towards herbivory
- **Mutations**: Small random changes in diet gene (±0.048 per generation)

### Survival Advantages
- **Flexibility**: Can eat multiple food sources
- **Population Crashes**: Thrive when many creatures die
- **Low Competition**: Don't compete directly with specialists
- **Efficiency**: Lower metabolism = longer survival

## Future Enhancements (Optional)
1. **Disease from Corpses**: Risk of illness when scavenging
2. **Decomposers**: Tiny creatures that only eat corpses
3. **Corpse Quality**: Fresher corpses = more energy
4. **Pack Scavenging**: Omnivores form groups to defend carcasses
5. **Bone Piles**: Long-lasting remains with less energy

## Expected Ecosystem Impact
- **More Stable Populations**: Fewer boom-bust cycles
- **Energy Recycling**: Less wasted biomass
- **Niche Specialization**: Three-way food web (plant → herbivore → carnivore, with omnivores as opportunists)
- **Genetic Diversity**: More strategies for survival

---
*Implemented: November 3, 2025*
*By: Senior Engineer AI Assistant*

