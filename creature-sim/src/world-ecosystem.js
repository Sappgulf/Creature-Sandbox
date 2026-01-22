/**
 * World Ecosystem System - Manages food, balancing, and ecological dynamics
 */
import { rand, clamp, dist2 } from './utils.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';

export class WorldEcosystem {
  constructor(world) {
    this.world = world;
    this.initialize();
  }

  initialize() {
    // Vegetation diversity system
    this.vegetationTypes = {
      grass: {
        energy: 3,
        color: '#7FDB6A',
        size: 2,
        growthRate: 1.0, // Base growth rate
        spawnChance: 0.6, // 60% of food is grass
        respawnTime: 5 // Seconds to respawn
      },
      berries: {
        energy: 8,
        color: '#FF6B9D',
        size: 3,
        growthRate: 0.3, // Slower growth
        spawnChance: 0.3, // 30% berries
        respawnTime: 15
      },
      fruit: {
        energy: 15,
        color: '#FFA500',
        size: 4,
        growthRate: 0.1, // Rare
        spawnChance: 0.1, // 10% fruit trees
        respawnTime: 30
      }
    };

    this.maxFood = Math.floor((this.world.width * this.world.height) / 180);
    this.foodGrowthMultiplier = 1.0;

    // Auto-balancing system
    this.balanceTimer = 0;
    this.balanceCheckInterval = 60; // Check every minute
    this.lastEcoStats = null;

    this.seedRestZones();

    console.debug('🌱 World ecosystem system initialized');
  }

  seedRestZones() {
    if (!this.world) return;
    this.world.restZones = [];

    const count = CreatureAgentTuning.REST_ZONES.COUNT;
    const radius = CreatureAgentTuning.REST_ZONES.RADIUS;

    for (let i = 0; i < count; i++) {
      const zone = {
        id: `rest-${i}-${Math.floor(Math.random() * 10000)}`,
        x: rand(80, this.world.width - 80),
        y: rand(80, this.world.height - 80),
        radius,
        calmBoost: CreatureAgentTuning.REST_ZONES.STRESS_RECOVERY
      };
      this.world.restZones.push(zone);
    }

    if (this.world.restGrid) {
      this.world.restGrid.clear();
      for (const zone of this.world.restZones) {
        this.world.restGrid.add(zone);
      }
      this.world.restGrid.buildIndex?.();
      this.world.restGridDirty = false;
    }
  }

  update(dt) {
    this.updateEcoStats();
    this.autoBalanceEcosystem(dt);
  }

  // Food growth rate calculation
  foodGrowthRate() {
    const seasonMultiplier = this.world.environment ?
      this.world.environment.getSeasonModifier('food') : 1.0;

    const weatherMultiplier = 1.0 + (this.world.environment?.weatherIntensity || 0) * 0.2;

    return seasonMultiplier * weatherMultiplier * this.foodGrowthMultiplier;
  }

  // Add food to the world
  addFood(x, y, r = 1.5, type = null) {
    // Determine food type if not specified
    if (!type) {
      const roll = rand();
      let cumulative = 0;
      for (const [foodType, config] of Object.entries(this.vegetationTypes)) {
        cumulative += config.spawnChance;
        if (roll <= cumulative) {
          type = foodType;
          break;
        }
      }
      type = type || 'grass'; // Fallback
    }

    const config = this.vegetationTypes[type];
    if (!config) return null;

    const bites = Math.max(1, Math.round(config.energy / CreatureAgentTuning.FOOD.BITE_ENERGY));
    const biteEnergy = config.energy / bites;
    const food = {
      x, y, r,
      type,
      energy: config.energy,
      bites,
      biteEnergy,
      scentRadius: CreatureAgentTuning.FOOD.SCENT_RADIUS,
      color: config.color,
      size: config.size,
      respawnTime: config.respawnTime,
      t: 0 // Age timer
    };

    this.world.food.push(food);
    this.world.foodGrid.add(food);
    this.world.foodGridDirty = true;
    return food;
  }

  // Find nearby food
  nearbyFood(x, y, radius) {
    return this.world.foodGrid.nearby(x, y, radius);
  }

  // Attempt to eat food at position
  tryEatFoodAt(x, y, reach = 8, biteSize = 1) {
    const foods = this.nearbyFood(x, y, reach);
    for (const food of foods) {
      if (dist2(x, y, food.x, food.y) <= reach * reach) {
        const bites = Math.max(1, biteSize);
        const biteEnergy = food.biteEnergy ?? (food.energy ?? 1);
        const consumedBites = Math.min(food.bites ?? 1, bites);
        const consumedEnergy = biteEnergy * consumedBites;
        food.bites = (food.bites ?? 1) - consumedBites;
        if (food.energy !== undefined) {
          food.energy = Math.max(0, food.energy - consumedEnergy);
        }

        if (food.bites <= 0) {
          const index = this.world.food.indexOf(food);
          if (index >= 0) {
            this.world.food.splice(index, 1);
            this.world.foodGrid.remove(food);
            this.world.foodGridDirty = true;
          }
        }

        return {
          food,
          energy: consumedEnergy,
          depleted: food.bites <= 0,
          bitesLeft: food.bites
        };
      }
    }
    return null;
  }

  nearestRestZone(x, y, radius) {
    const zones = this.world.restGrid?.nearby ? this.world.restGrid.nearby(x, y, radius) : this.world.restZones;
    if (!zones || zones.length === 0) return null;

    let best = null;
    let bestD2 = radius * radius;
    for (const zone of zones) {
      const d2 = dist2(x, y, zone.x, zone.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = zone;
      }
    }
    return best;
  }

  // Update ecosystem statistics
  updateEcoStats() {
    const creatures = this.world.creatures;
    const food = this.world.food;
    const corpses = this.world.corpses;

    let herbivoreCount = 0;
    let predatorCount = 0;
    let omnivoreCount = 0;
    let totalEnergy = 0;
    let totalHealth = 0;
    let totalAge = 0;

    for (const c of creatures) {
      if (!c.alive) continue;

      totalEnergy += c.energy;
      totalHealth += c.health;
      totalAge += c.age;

      const diet = c.genes.diet ?? (c.genes.predator ? 1.0 : 0.0);
      if (diet < 0.3) {
        herbivoreCount++;
      } else if (diet > 0.7) {
        predatorCount++;
      } else {
        omnivoreCount++;
      }
    }

    this.lastEcoStats = {
      population: creatures.length,
      herbivores: herbivoreCount,
      predators: predatorCount,
      omnivores: omnivoreCount,
      foodCount: food.length,
      corpseCount: corpses.length,
      avgEnergy: creatures.length > 0 ? totalEnergy / creatures.length : 0,
      avgHealth: creatures.length > 0 ? totalHealth / creatures.length : 0,
      avgAge: creatures.length > 0 ? totalAge / creatures.length : 0,
      diversityIndex: this.calculateDiversityIndex(creatures),
      timestamp: this.world.t
    };
  }

  // Calculate biodiversity index
  calculateDiversityIndex(creatures) {
    if (creatures.length === 0) return 0;

    const species = new Map();
    for (const c of creatures) {
      const speciesKey = this.getCreatureSpeciesKey(c);
      species.set(speciesKey, (species.get(speciesKey) || 0) + 1);
    }

    const total = creatures.length;
    let diversity = 0;
    for (const count of species.values()) {
      const proportion = count / total;
      diversity -= proportion * Math.log2(proportion);
    }

    return diversity;
  }

  // Simple species classification
  getCreatureSpeciesKey(creature) {
    const diet = creature.genes.diet ?? (creature.genes.predator ? 1.0 : 0.0);
    const speed = creature.genes.speed || 1;
    const size = creature.genes.size || 1;

    // Classify based on primary traits
    if (diet < 0.3) return 'herbivore';
    if (diet > 0.7) return 'predator';
    return 'omnivore';
  }

  // Auto-balance ecosystem
  autoBalanceEcosystem(dt) {
    this.balanceTimer += dt;
    if (this.balanceTimer < this.balanceCheckInterval) return;

    this.balanceTimer = 0;

    const stats = this.lastEcoStats;
    if (!stats) return;

    const { herbivores, predators, omnivores, foodCount } = stats;
    const total = herbivores + predators + omnivores;

    // Skip balancing if ecosystem is too young or empty
    if (total < 5 || this.world.t < 60) return;

    const actions = [];

    // Predator imbalance
    if (predators === 0 && total > 10) {
      actions.push('add_predator');
    } else if (predators > herbivores * 0.3) {
      actions.push('reduce_predators');
    }

    // Food scarcity
    if (foodCount < total * 0.5) {
      actions.push('add_food');
    }

    // Overcrowding
    if (total > 50) {
      actions.push('reduce_population');
    }

    // Execute balancing actions
    this.executeBalancingActions(actions);
  }

  executeBalancingActions(actions) {
    for (const action of actions) {
      switch (action) {
        case 'add_predator':
          this.spawnBalancingPredator();
          break;
        case 'reduce_predators':
          this.cullExcessPredators();
          break;
        case 'add_food':
          this.addEmergencyFood();
          break;
        case 'reduce_population':
          this.cullExcessPopulation();
          break;
      }
    }
  }

  spawnBalancingPredator() {
    const x = rand() * this.world.width;
    const y = rand() * this.world.height;
    return this.world.creatureManager?.spawnManual(x, y, true);
  }

  cullExcessPredators() {
    const predators = this.world.creatures.filter(c =>
      c.alive && (c.genes.diet ?? (c.genes.predator ? 1.0 : 0.0)) > 0.7
    );

    if (predators.length > 0) {
      const toCull = predators[Math.floor(rand() * predators.length)];
      toCull.alive = false;
      this.world.creatures.splice(this.world.creatures.indexOf(toCull), 1);
    }
  }

  addEmergencyFood() {
    for (let i = 0; i < 10; i++) {
      const x = rand() * this.world.width;
      const y = rand() * this.world.height;
      this.addFood(x, y);
    }
  }

  cullExcessPopulation() {
    // Remove weakest creatures
    const sorted = [...this.world.creatures].sort((a, b) => a.energy - b.energy);
    const toRemove = Math.floor(sorted.length * 0.1); // Remove 10%

    for (let i = 0; i < toRemove; i++) {
      const creature = sorted[i];
      if (creature.alive) {
        creature.alive = false;
        this.world.creatures.splice(this.world.creatures.indexOf(creature), 1);
      }
    }
  }

  getStats() {
    return this.lastEcoStats;
  }
}
