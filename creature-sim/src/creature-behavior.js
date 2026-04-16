/**
 * Creature Behavior System - AI, decision making, and behavioral logic
 */
import { rand, clamp } from './utils.js';
import { CreatureConfig } from './creature-config.js';
import { TempObjectPool } from './object-pool.js';

export class CreatureBehaviorSystem {
  constructor(creature) {
    this.creature = creature;

    // Cache for expensive calculations
    this._cachedSin = 0;
    this._cachedCos = 1;
    this._lastAngle = 0;
    this._angleCacheThreshold = 0.01; // Only update cache if angle changed significantly

    // Object pool for temporary calculations
    this._tempPool = new TempObjectPool(5);
  }

  /**
   * Main behavior update - decide what to do each frame
   */
  update(dt, world) {
    this.creature._lastWorld = world;
    const dietRole = this.creature.traits?.dietRole ?? 'herbivore';

    // Update target selection and behavior
    this.updateTargeting(world, dt);
    this.updateMovement(world, dt);

    // Handle specific behaviors based on type and state
    if (dietRole === 'predator-lite') {
      this.updatePredatorLiteBehavior(world, dt);
    } else if (this.creature.genes.predator) {
      this.updatePredatorBehavior(world, dt);
    } else {
      this.updateHerbivoreBehavior(world, dt);
    }

    // Handle lifecycle behaviors
    this.updateLifecycleBehavior(dt, world);
  }

  /**
   * Update target selection and tracking
   */
  updateTargeting(world, _dt) {
    // Update existing target validity
    if (this.creature.target) {
      if (this.creature.target.isCorpse && this.creature.target.corpse) {
        // Corpse target - check if still exists
        if (!world.corpses.includes(this.creature.target.corpse)) {
          this.creature.target = null;
        }
      } else if (this.creature.target.creatureId !== undefined) {
        // Creature target - check if still alive
        const targetCreature = world.creatures.find(c => c.id === this.creature.target.creatureId);
        if (!targetCreature || !targetCreature.alive) {
          this.creature.target = null;
        }
      }
    }

    // Find new targets if needed
    if (!this.creature.target) {
      this.selectNewTarget(world);
    }
  }

  /**
   * Select a new target based on creature type and needs
   * Enhanced with priority-based decision making and context awareness
   */
  selectNewTarget(world) {
    const diet = this.creature.genes.diet ?? (this.creature.genes.predator ? 1.0 : 0.0);
    const dietRole = this.creature.traits?.dietRole ?? 'herbivore';
    const energy = this.creature.energy;
    const maxEnergy = this.creature.maxEnergy;
    const energyRatio = energy / maxEnergy;

    // Critical energy - prioritize any food source
    if (energyRatio < 0.2) {
      // Try food first
      this.selectForagingTarget(world);

      // If no food, try scavenging
      if (!this.creature.target) {
        this.selectScavengingTarget(world);
      }

      // Last resort: hunt only if creature is a predator/omnivore and desperate
      if (!this.creature.target && diet > 0.3) {
        this.selectHuntingTarget(world);
      }
      return;
    }

    // Low energy - cautious decisions
    if (energyRatio < 0.4) {
      if (dietRole === 'predator-lite' || diet > 0.7) {
        // Predators prefer hunting but will scavenge if safer
        if (rand() < 0.4) {
          this.selectScavengingTarget(world);
        }
        if (!this.creature.target) {
          this.selectPredatorLiteTarget(world);
        }
        if (!this.creature.target) {
          this.selectHuntingTarget(world);
        }
      } else if (diet > 0.3) {
        // Omnivores prioritize safe food
        this.selectOmnivoreTarget(world);
      } else {
        // Herbivores only forage
        this.selectForagingTarget(world);
      }
      return;
    }

    // Normal energy - follow natural behavior patterns
    if (dietRole === 'predator-lite') {
      this.selectPredatorLiteTarget(world);
    } else if (diet > 0.7) {
      // Pure predators hunt
      this.selectHuntingTarget(world);
    } else if (diet > 0.3) {
      // Omnivores use intelligent mixed strategy
      this.selectOmnivoreTarget(world);
    } else {
      // Herbivores forage
      this.selectForagingTarget(world);
    }

    // Scavenging as fallback or primary strategy
    if (dietRole === 'scavenger') {
      this.selectScavengingTarget(world);
    } else if (!this.creature.target && energy < maxEnergy * 0.5) {
      // No target found and energy below half - try scavenging
      this.selectScavengingTarget(world);
    }
  }

  /**
   * Select hunting target for predators
   * Enhanced with memory, learning, and strategic thinking
   */
  selectHuntingTarget(world) {
    if (!world.combat) return;

    // Check memory for successful hunting locations
    let searchRadius = 120;
    let _preferredLocation = null;

    if (world.memoryLearning && this.creature.id) {
      const memory = world.memoryLearning.getMemory(this.creature.id);
      if (memory?.successfulHunts > 3) {
        // Experienced hunter - check remembered hunting grounds
        const huntingSpots = memory.foodLocations.filter(loc => loc.quality > 0.7);
        if (huntingSpots.length > 0) {
          huntingSpots.sort((a, b) => b.quality - a.quality);
          _preferredLocation = huntingSpots[0];
          searchRadius = 180; // Expand search if going to known spot
        }
      }

      // Avoid danger zones
      if (memory?.dangerZones && memory.dangerZones.length > 0) {
        const now = Date.now();
        const recentDangers = memory.dangerZones.filter(zone =>
          now - zone.lastEncounter < 60000 && // Last 60s
          Math.hypot(zone.x - this.creature.x, zone.y - this.creature.y) < 100
        );

        // If in danger zone, flee instead of hunting
        if (recentDangers.length > 0) {
          return; // Skip hunting, prioritize safety
        }
      }
    }

    // Find prey, preferring weak or isolated targets
    const prey = world.combat.findPrey(this.creature, searchRadius);

    if (prey) {
      // Assess prey difficulty
      const preyEnergy = prey.energy ?? 50;
      const preySpeed = prey.genes?.speed ?? 1.0;
      const mySpeed = this.creature.genes?.speed ?? 1.0;

      // Experienced hunters are more selective
      if (world.memoryLearning && this.creature.id) {
        const memory = world.memoryLearning.getMemory(this.creature.id);
        if (memory?.successfulHunts > 5) {
          // Prefer weak or slow prey
          const isFastPrey = preySpeed > mySpeed * 1.2;
          const isHealthyPrey = preyEnergy > 70;

          if (isFastPrey && isHealthyPrey && rand() < 0.7) {
            return; // Skip difficult prey, look for easier target
          }
        }
      }

      this.creature.target = {
        x: prey.x,
        y: prey.y,
        creatureId: prey.id,
        priority: 1.0,
        preyEnergy: preyEnergy,
        preySpeed: preySpeed
      };
      this.creature.personality.currentTargetId = prey.id;

      // Remember this hunting location
      if (world.memoryLearning) {
        world.memoryLearning.rememberFood(this.creature, this.creature.x, this.creature.y, 0.5);
      }
    }
  }

  selectPredatorLiteTarget(world) {
    const prey = world.findPrey?.(this.creature, 140);
    if (prey) {
      this.creature.target = {
        x: prey.x,
        y: prey.y,
        creatureId: prey.id,
        predatorLite: true,
        priority: 0.75
      };
      this.creature.personality.currentTargetId = prey.id;
    }
  }

  /**
   * Select target for omnivores (food first, then prey)
   * Enhanced with intelligent decision-making based on energy levels and environment
   */
  selectOmnivoreTarget(world) {
    const energy = this.creature.energy;
    const maxEnergy = this.creature.maxEnergy;
    const energyRatio = energy / maxEnergy;

    // Smart decision-making based on creature state
    let shouldHunt = false;

    // High energy and confident → more likely to hunt
    if (energyRatio > 0.7 && this.creature.stats.kills > 2) {
      shouldHunt = rand() < 0.6; // 60% chance to hunt
    }
    // Medium energy → balanced approach
    else if (energyRatio > 0.4) {
      shouldHunt = rand() < 0.35; // 35% chance to hunt
    }
    // Low energy → prioritize safe food
    else if (energyRatio > 0.25) {
      shouldHunt = rand() < 0.15; // 15% chance to hunt, mostly forage
    }
    // Critical energy → only forage for safety
    else {
      shouldHunt = false;
    }

    // Check personality - cautious creatures hunt less
    if (this.creature.temperament?.cautiousness > 0.7) {
      shouldHunt = shouldHunt && rand() < 0.5; // 50% reduction
    }

    // Aggressive creatures hunt more
    if (this.creature.temperament?.aggression > 0.7) {
      shouldHunt = shouldHunt || rand() < 0.25; // Boost hunting instinct
    }

    // Execute decision
    if (shouldHunt) {
      // Try hunting first
      this.selectHuntingTarget(world);

      // If no prey found, fall back to food
      if (!this.creature.target) {
        const food = this.seekFood(world);
        if (food) {
          this.creature.target = {
            x: food.x,
            y: food.y,
            food: food,
            priority: 0.85
          };
        }
      }
    } else {
      // Try food first
      const food = this.seekFood(world);
      if (food) {
        this.creature.target = {
          x: food.x,
          y: food.y,
          food: food,
          priority: 0.9
        };
        return;
      }

      // If no food found and energy not critical, can consider hunting
      if (energyRatio > 0.35) {
        this.selectHuntingTarget(world);
      }
    }
  }

  /**
   * Select foraging target for herbivores
   */
  selectForagingTarget(world) {
    const food = this.seekFood(world);
    if (food) {
      this.creature.target = {
        x: food.x,
        y: food.y,
        food: food,
        priority: 0.9
      };
    }
  }

  /**
   * Select scavenging target
   */
  selectScavengingTarget(world) {
    if (!world.findNearbyCorpse) return;
    const corpse = world.findNearbyCorpse(this.creature.x, this.creature.y, 60);

    if (corpse) {
      this.creature.target = {
        x: corpse.x,
        y: corpse.y,
        isCorpse: true,
        corpse: corpse,
        priority: 0.6
      };
    }
  }

  /**
   * Seek food using vision, pheromones, and memory
   * Enhanced with memory of previous food locations
   */
  seekFood(world) {
    if (!world.ecosystem) return null;

    // Check memory for known food locations
    if (world.memoryLearning && this.creature.id) {
      const memory = world.memoryLearning.getMemory(this.creature.id);
      if (memory?.foodLocations && memory.foodLocations.length > 0) {
        // Filter recent and nearby food memories
        const now = Date.now();
        const recentFoodMemories = memory.foodLocations.filter(loc => {
          const age = now - loc.lastSeen;
          const dist = Math.hypot(loc.x - this.creature.x, loc.y - this.creature.y);
          return age < 30000 && dist < 150 && loc.quality > 0.4; // Within 30s and 150px
        });

        if (recentFoodMemories.length > 0) {
          // Sort by quality and distance
          recentFoodMemories.sort((a, b) => {
            const distA = Math.hypot(a.x - this.creature.x, a.y - this.creature.y);
            const distB = Math.hypot(b.x - this.creature.x, b.y - this.creature.y);
            const scoreA = a.quality / (distA + 1);
            const scoreB = b.quality / (distB + 1);
            return scoreB - scoreA;
          });

          // Try remembered location
          const remembered = recentFoodMemories[0];
          const nearbyFood = world.ecosystem.nearbyFood(remembered.x, remembered.y, 40);
          if (nearbyFood.length > 0) {
            // Remember this food again (reinforcement)
            if (world.memoryLearning) {
              world.memoryLearning.rememberFood(this.creature, remembered.x, remembered.y, 0.7);
            }
            return nearbyFood[0];
          }
        }
      }
    }

    // Standard vision-based food search
    const foodList = world.ecosystem.nearbyFood(this.creature.x, this.creature.y, this.creature.genes.sense);
    const pheromone = world.pheromone.getAtWorld(this.creature.x, this.creature.y);

    if (!foodList.length && !pheromone) return null;

    const senseRadius = this.creature.genes.sense;
    const senseRadius2 = senseRadius * senseRadius;
    const halfFov = this.creature._halfFovRad;

    let best = null;
    let bestD2 = Infinity;

    // Check visible food
    for (const food of foodList) {
      const dx = food.x - this.creature.x;
      const dy = food.y - this.creature.y;
      const d2 = dx * dx + dy * dy;

      if (d2 > senseRadius2) continue;

      const angle = Math.atan2(dy, dx);
      const delta = angle - this.creature.dir;
      const normalizedDelta = ((delta + Math.PI) % CreatureConfig.TAU) - Math.PI;

      if (Math.abs(normalizedDelta) > halfFov) continue;

      // Bias toward closer food
      const bias = d2 * (1 + Math.abs(normalizedDelta) / halfFov * 0.5);
      if (bias < bestD2) {
        bestD2 = bias;
        best = food;
      }
    }

    // Follow pheromone trails if no food found
    if (!best && pheromone > 0.1) {
      return this.followPheromoneTrail(world, senseRadius);
    }

    // Remember found food location
    if (best && world.memoryLearning) {
      world.memoryLearning.rememberFood(this.creature, best.x, best.y, 0.6);
    }

    return best;
  }

  /**
   * Follow pheromone trails
   */
  followPheromoneTrail(world, _senseRadius) {
    let maxVal = 0;
    let bestDir = null;

    // Sample pheromone in adjacent cells
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;

        const px = this.creature.x + ox * world.pheromone.cell;
        const py = this.creature.y + oy * world.pheromone.cell;
        const v = world.pheromone.getAtWorld(px, py);

        if (v > maxVal) {
          maxVal = v;
          bestDir = { x: px, y: py };
        }
      }
    }

    if (bestDir) {
      return { x: bestDir.x, y: bestDir.y, pheromone: true };
    }

    return null;
  }

  /**
   * Update movement toward target
   */
  updateMovement(world, dt) {
    let desiredAngle = null;

    // Calculate desired movement direction
    if (this.creature.target) {
      desiredAngle = Math.atan2(
        this.creature.target.y - this.creature.y,
        this.creature.target.x - this.creature.x
      );
    } else if (this.creature.lifecycle?.playTimer > 0) {
      // Play behavior - random movement
      desiredAngle = this.creature.dir + (rand() - 0.5) * 2;
    } else {
      // Default wandering
      this.updateWandering(dt);
      return;
    }

    // Aquatic behavior
    if (this.creature.aquaticAffinity > 0.5) {
      desiredAngle = this.updateAquaticMovement(world, desiredAngle);
    }

    // Flying behavior
    if (this.creature.flyingAffinity > 0.4) {
      desiredAngle = this.updateFlyingMovement(world, desiredAngle);
    }

    // Burrowing behavior
    if (this.creature.burrowingAffinity > 0.4) {
      desiredAngle = this.updateBurrowingMovement(world, desiredAngle);
    }

    if (desiredAngle !== null) {
      this.steerToward(desiredAngle, dt);
    }

    this.applyMovement(dt);
  }

  /**
   * Update wandering behavior
   */
  updateWandering(dt) {
    // Gentle random steering
    const temp = this.creature.temperament || {};
    const curiosityBoost = 0.8 + (temp.curiosity ?? 0) * 0.7;
    const quirkBoost = this.creature.getQuirkMultiplier?.('wander') ?? 1;
    const wanderStrength = CreatureConfig.MOVEMENT.WANDER_STRENGTH * curiosityBoost * quirkBoost;
    this.creature.dir += (rand() - 0.5) * wanderStrength * dt;

    // Homebody bias toward anchor
    if (this.creature.getQuirkMultiplier && (this.creature.getQuirkMultiplier('home_pull') > 1.0)) {
      const anchor = this.creature.homeAnchor;
      if (anchor) {
        const dx = anchor.x - this.creature.x;
        const dy = anchor.y - this.creature.y;
        const desired = Math.atan2(dy, dx);
        const pull = 0.15 * dt * this.creature.getQuirkMultiplier('home_pull');
        this.creature.dir += (desired - this.creature.dir) * pull;
      }
    }
  }

  /**
   * Update aquatic movement behavior
   */
  updateAquaticMovement(world, desiredAngle) {
    // Check if in wetland biome
    const inWetland = world.getBiomeAt ?
      world.getBiomeAt(this.creature.x, this.creature.y)?.type === 'wetland' : false;

    if (!inWetland && (!this.creature.target || this.creature.target.family)) {
      // Seek wetland
      const wetDir = this.sampleWetlandDirection(world);
      if (wetDir !== null) {
        return wetDir;
      }
    }

    return desiredAngle;
  }

  /**
   * Update flying movement behavior - prefer high elevation, swooping patterns
   */
  updateFlyingMovement(world, desiredAngle) {
    if (this.creature.flyingAffinity < 0.4) {
      return desiredAngle;
    }

    const biome = world.getBiomeAt ?
      world.getBiomeAt(this.creature.x, this.creature.y) : null;
    const elevation = biome?.elevation ?? 0.5;

    // Flying creatures prefer high elevations
    if (elevation < 0.5 && (!this.creature.target || this.creature.target.family)) {
      const highDir = this.sampleHighElevationDirection(world);
      if (highDir !== null) {
        return highDir;
      }
    }

    // Add swooping/gliding motion when moving
    if (this.creature.target && this.creature.flyingAffinity > 0.6) {
      const time = world.t || 0;
      const swoopAngle = Math.sin(time * 2.5 + this.creature.id) * 0.3 * this.creature.flyingAffinity;
      this.creature.dir += swoopAngle * 0.1;
    }

    // Avoid ground obstacles (detect low elevation directly ahead)
    if (this.creature.flyingAffinity > 0.6) {
      const avoidance = this.sampleGroundObstacles(world);
      if (avoidance !== null) {
        return avoidance;
      }
    }

    return desiredAngle;
  }

  /**
   * Update burrowing movement behavior - prefer underground, slower but protected
   */
  updateBurrowingMovement(world, desiredAngle) {
    if (this.creature.burrowingAffinity < 0.4) {
      return desiredAngle;
    }

    const biome = world.getBiomeAt ?
      world.getBiomeAt(this.creature.x, this.creature.y) : null;
    const isUnderground = biome?.type === 'mountain' || (biome?.elevation ?? 0) > 0.65;

    // Burrowing creatures prefer underground areas
    if (!isUnderground && (!this.creature.target || this.creature.target.family)) {
      const undergroundDir = this.sampleUndergroundDirection(world);
      if (undergroundDir !== null) {
        return undergroundDir;
      }
    }

    // Protected from predators when underground
    if (isUnderground && this.creature.emotions) {
      this.creature.emotions.fear = Math.max(0, this.creature.emotions.fear - 0.01);
    }

    return desiredAngle;
  }

  /**
   * Sample direction toward high elevation for flying creatures
   */
  sampleHighElevationDirection(world) {
    if (!world.getBiomeAt) return null;

    for (let i = 0; i < 5; i++) {
      const angle = rand() * CreatureConfig.TAU;
      const distance = 30 + rand() * 50;
      const testX = this.creature.x + Math.cos(angle) * distance;
      const testY = this.creature.y + Math.sin(angle) * distance;

      const biome = world.getBiomeAt(testX, testY);
      if (biome?.elevation > 0.5) {
        return angle;
      }
    }

    return null;
  }

  /**
   * Sample direction away from ground obstacles for flying creatures
   */
  sampleGroundObstacles(world) {
    if (!world.getBiomeAt) return null;

    const lookAhead = 40;
    const testX = this.creature.x + Math.cos(this.creature.dir) * lookAhead;
    const testY = this.creature.y + Math.sin(this.creature.dir) * lookAhead;
    const biome = world.getBiomeAt(testX, testY);

    if (biome?.elevation < 0.3) {
      // Low elevation ahead - steer upward
      return this.creature.dir - Math.PI * 0.4;
    }

    return null;
  }

  /**
   * Sample direction toward underground for burrowing creatures
   */
  sampleUndergroundDirection(world) {
    if (!world.getBiomeAt) return null;

    for (let i = 0; i < 5; i++) {
      const angle = rand() * CreatureConfig.TAU;
      const distance = 30 + rand() * 50;
      const testX = this.creature.x + Math.cos(angle) * distance;
      const testY = this.creature.y + Math.sin(angle) * distance;

      const biome = world.getBiomeAt(testX, testY);
      if (biome?.type === 'mountain' || (biome?.elevation ?? 0) > 0.65) {
        return angle;
      }
    }

    return null;
  }

  /**
   * Steer toward desired angle
   */
  steerToward(desiredAngle, dt) {
    let delta = desiredAngle - this.creature.dir;

    // Normalize to [-π, π]
    while (delta > Math.PI) delta -= CreatureConfig.TAU;
    while (delta < -Math.PI) delta += CreatureConfig.TAU;

    // Apply turn rate limit
    const maxTurn = CreatureConfig.MOVEMENT.TURN_RATE * dt;
    delta = clamp(delta, -maxTurn, maxTurn);

    this.creature.dir += delta;
  }

  /**
   * Get cached sin/cos values to avoid repeated calculations
   */
  getCachedTrig(angle) {
    if (Math.abs(angle - this._lastAngle) > this._angleCacheThreshold) {
      this._lastAngle = angle;
      this._cachedSin = Math.sin(angle);
      this._cachedCos = Math.cos(angle);
    }
    return { sin: this._cachedSin, cos: this._cachedCos };
  }

  /**
   * Apply movement physics
   */
  applyMovement(dt) {
    // UNIFIED: Use the definitive speed calculation from the creature instance
    const spd = this.creature.calculateCurrentSpeed(dt, this.creature._lastWorld);
    const { cos: dirCos, sin: dirSin } = this.getCachedTrig(this.creature.dir);

    this.creature.x += dirCos * spd * dt;
    this.creature.y += dirSin * spd * dt;

    // Wind effects
    const windX = this.creature._lastWorld?.moodState?.windX ?? 0;
    const windY = this.creature._lastWorld?.moodState?.windY ?? 0;
    if (windX || windY) {
      const windScale = 18;
      this.creature.x += windX * windScale * dt;
      this.creature.y += windY * windScale * dt;
    }

    // Update animation state based on movement speed
    this.creature._updateAnimationState(spd, this.creature._lastWorld?.t || 0);
  }

  /**
   * Get age-based speed multiplier
   */
  getAgeSpeedMultiplier() {
    if (typeof this.creature._getAgeSpeedMultiplier === 'function') {
      return this.creature._getAgeSpeedMultiplier();
    }
    switch (this.creature.ageStage) {
      case 'baby': return 1.0;
      case 'juvenile': return 0.95;
      case 'adult': return 1.0;
      case 'elder': return 0.85;
      default: return 1.0;
    }
  }

  /**
   * Get status-based speed multiplier
   */
  getStatusSpeedMultiplier(temp = null) {
    let multiplier = 1.0;

    // Adrenaline boost
    if (this.creature.hasStatus('adrenaline')) {
      const adrenaline = this.creature.getStatus('adrenaline');
      multiplier *= 1.4 + (adrenaline.intensity || 0);
    }

    // Panic slowdown
    if (this.creature.hasStatus('panic')) {
      const calmness = temp?.calmness ?? 0;
      multiplier *= 0.7 + calmness * 0.2;
    }

    return multiplier;
  }

  /**
   * Update predator-specific behavior
   * Enhanced with pack coordination
   */
  updatePredatorBehavior(world, dt) {
    if (this.creature.traits?.dietRole === 'predator-lite') return;

    // Pack hunting coordination
    if (this.creature.genes.packInstinct > 0.5 && this.creature.personality.currentTargetId) {
      this.updatePackHunting(world, dt);
    }

    // Update ambush timer
    if (this.creature.personality.ambushTimer > 0) {
      this.creature.personality.ambushTimer -= dt;
    }

    // Attempt hunting
    if (this.creature.personality.currentTargetId) {
      world.combat?.tryPredation(this.creature);
    }

    // Pheromone signaling
    if (this.creature.personality.lastSignalAt < world.t - 2) {
      this.creature.personality.lastSignalAt = world.t;
      world.combat?.registerPredatorSignal(
        this.creature.x, this.creature.y,
        0.5, 5, this.creature.id
      );
    }
  }

  /**
   * Pack hunting coordination - predators work together
   */
  updatePackHunting(world, dt) {
    const prey = world.getAnyCreatureById?.(this.creature.personality.currentTargetId);
    if (!prey || !prey.alive) return;

    // Find nearby pack members
    const packRadius = 150;
    const packMembers = world.creatureManager?.queryCreaturesFast(
      this.creature.x,
      this.creature.y,
      packRadius
    ).filter(c =>
      c !== this.creature &&
      c.alive &&
      c.genes.predator &&
      c.genes.packInstinct > 0.5 &&
      Math.abs((c.genes.hue || 0) - (this.creature.genes.hue || 0)) < 0.2
    ) || [];

    if (packMembers.length > 0) {
      // Coordinate attack - surround prey
      const distToPrey = Math.hypot(prey.x - this.creature.x, prey.y - this.creature.y);

      // Check if we're the closest - lead the chase
      const isClosest = packMembers.every(p => {
        const distOther = Math.hypot(prey.x - p.x, prey.y - p.y);
        return distToPrey <= distOther;
      });

      if (!isClosest) {
        // Flanking predator - cut off escape routes
        const closestPack = packMembers.reduce((closest, p) => {
          const d = Math.hypot(prey.x - p.x, prey.y - p.y);
          return !closest || d < Math.hypot(prey.x - closest.x, prey.y - closest.y) ? p : closest;
        }, this.creature);

        const escapeAngle = Math.atan2(prey.y - closestPack.y, prey.x - closestPack.x);
        const interceptDistance = 60;
        const interceptX = prey.x + Math.cos(escapeAngle) * interceptDistance;
        const interceptY = prey.y + Math.sin(escapeAngle) * interceptDistance;

        // Move to intercept position
        if (this.creature.target) {
          this.creature.target.x = interceptX;
          this.creature.target.y = interceptY;
        }
      }

      // Boost confidence when hunting in pack
      if (packMembers.length >= 2 && this.creature.emotions) {
        this.creature.emotions.confidence = Math.min(1.0, this.creature.emotions.confidence + 0.1 * dt);
      }
    }
  }

  updatePredatorLiteBehavior(world, dt) {
    if (this.creature.personality.ambushTimer > 0) {
      this.creature.personality.ambushTimer -= dt;
    }
    if (this.creature.personality.currentTargetId && this.creature.personality.ambushTimer <= 0) {
      const target = world.getAnyCreatureById?.(this.creature.personality.currentTargetId);
      if (target && target.alive) {
        this.creature.target = { x: target.x, y: target.y, creatureId: target.id, predatorLite: true };
      }
    }
  }

  /**
   * Update herbivore-specific behavior
   */
  updateHerbivoreBehavior(world, dt) {
    // Herd behavior
    if (this.creature.genes.herdInstinct > 0.5) {
      this.updateHerdBehavior(world, dt);
    }
  }

  /**
   * Update herd behavior
   */
  updateHerdBehavior(world, dt) {
    const herdMembers = world.creatureManager?.queryCreatures(
      this.creature.x, this.creature.y, 50
    ).filter(c =>
      c !== this.creature &&
      c.alive &&
      !c.genes.predator &&
      c.genes.herdInstinct > 0.3
    ) || [];

    if (herdMembers.length > 0) {
      this.applyHerdForces(herdMembers, dt);
    }
  }

  /**
   * Apply herding forces (separation, alignment, cohesion)
   */
  applyHerdForces(herdMembers, dt) {
    const temp = this.creature.temperament || {};
    const socialPull = 0.8 + (temp.sociability ?? 0) * 0.5;
    const separationScale = 1 - Math.min(0.3, (temp.sociability ?? 0) * 0.25);
    const separationForce = { x: 0, y: 0 };
    const alignmentForce = { x: 0, y: 0 };
    const cohesionForce = { x: 0, y: 0 };

    for (const other of herdMembers) {
      const dx = other.x - this.creature.x;
      const dy = other.y - this.creature.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        // Separation
        if (dist < CreatureConfig.MOVEMENT.HERD_SEPARATION * separationScale) {
          separationForce.x -= dx / dist;
          separationForce.y -= dy / dist;
        }

        // Alignment
        if (dist < CreatureConfig.MOVEMENT.HERD_ALIGNMENT) {
          alignmentForce.x += Math.cos(other.dir);
          alignmentForce.y += Math.sin(other.dir);
        }

        // Cohesion
        cohesionForce.x += dx / dist;
        cohesionForce.y += dy / dist;
      }
    }

    // Apply forces to direction
    const herdStrength = this.creature.genes.herdInstinct;
    const quirkCohesion = this.creature.getQuirkMultiplier?.('cohesion') ?? 1;
    const totalForce = {
      x: separationForce.x * 0.5 + alignmentForce.x * 0.3 * quirkCohesion + cohesionForce.x * 0.2 * socialPull * quirkCohesion,
      y: separationForce.y * 0.5 + alignmentForce.y * 0.3 * quirkCohesion + cohesionForce.y * 0.2 * socialPull * quirkCohesion
    };

    if (totalForce.x !== 0 || totalForce.y !== 0) {
      const forceAngle = Math.atan2(totalForce.y, totalForce.x);
      this.creature.dir += (forceAngle - this.creature.dir) * herdStrength * dt;
    }
  }

  /**
   * Update lifecycle behaviors (play, elder aid, etc.)
   */
  updateLifecycleBehavior(dt, world) {
    // Juvenile play behavior
    if (this.creature.ageStage === 'juvenile' && !this.creature.genes.predator) {
      this.updateJuvenilePlay(dt, world);
    }

    // Elder aid behavior
    if (this.creature.ageStage === 'elder' && !this.creature.genes.predator) {
      this.updateElderAid(dt, world);
    }
  }

  /**
   * Update juvenile play behavior
   */
  updateJuvenilePlay(dt, world) {
    if (this.creature.lifecycle.playCooldown <= 0 && this.creature.energy > 12) {
      if (rand() < 0.005) { // 0.5% chance per frame
        this.creature.lifecycle.playTimer = 3 + rand() * 2; // 3-5 seconds
        this.creature.lifecycle.playCooldown = rand(
          CreatureConfig.SOCIAL.PLAY_COOLDOWN.min,
          CreatureConfig.SOCIAL.PLAY_COOLDOWN.max
        );

        // Emotional response
        if (this.creature.emotions) {
          this.creature.emotions.happiness = Math.min(1.0, this.creature.emotions.happiness + 0.3);
        }

        // Visual effects
        if (world.particles && typeof world.particles.addPlayBurst === 'function') {
          world.particles.addPlayBurst(this.creature.x, this.creature.y);
        }

        // Audio
        if (world.audio) {
          world.audio.playSound('play');
        }
      }
    }

    // Update play timer
    if (this.creature.lifecycle.playTimer > 0) {
      this.creature.lifecycle.playTimer -= dt;
    }

    // Update cooldown
    if (this.creature.lifecycle.playCooldown > 0) {
      this.creature.lifecycle.playCooldown -= dt;
    }
  }

  /**
   * Update elder aid behavior
   */
  updateElderAid(dt, world) {
    if (this.creature.lifecycle.elderAidCooldown <= 0) {
      this.emitElderSupport(world);
      this.creature.lifecycle.elderAidCooldown = rand(
        CreatureConfig.SOCIAL.ELDER_AID_COOLDOWN.min,
        CreatureConfig.SOCIAL.ELDER_AID_COOLDOWN.max
      );
    }

    // Update cooldown
    if (this.creature.lifecycle.elderAidCooldown > 0) {
      this.creature.lifecycle.elderAidCooldown -= dt;
    }

    // Family anchor behavior
    this.updateFamilyAnchor(world, dt);
  }

  /**
   * Emit elder support aura
   */
  emitElderSupport(world) {
    const allies = world.creatureManager?.queryCreatures(
      this.creature.x, this.creature.y, 40
    ).filter(c =>
      c !== this.creature &&
      c.alive &&
      !c.genes.predator &&
      c.ageStage !== 'elder'
    ) || [];

    if (allies.length === 0) return;

    for (const ally of allies) {
      ally.applyStatus('elder_aid', {
        duration: 15,
        intensity: 0.3,
        metadata: { elderId: this.creature.id }
      });

      // Emotional boost
      if (ally.emotions) {
        ally.emotions.security = Math.min(1.0, ally.emotions.security + 0.2);
      }
    }

    // Visual effects
    if (world.particles && typeof world.particles.addElderAura === 'function') {
      world.particles.addElderAura(this.creature.x, this.creature.y);
    }
  }

  /**
   * Update family anchor behavior
   */
  updateFamilyAnchor(world, dt) {
    if (!this.creature.children || this.creature.children.length === 0) return;

    if (this.creature.lifecycle.familyCheck <= 0) {
      this.creature.lifecycle.familyAnchor = this.selectFamilyAnchor(world);
      this.creature.lifecycle.familyCheck = rand(
        CreatureConfig.SOCIAL.FAMILY_CHECK_INTERVAL.min,
        CreatureConfig.SOCIAL.FAMILY_CHECK_INTERVAL.max
      );
    }

    // Update check timer
    if (this.creature.lifecycle.familyCheck > 0) {
      this.creature.lifecycle.familyCheck -= dt;
    }

    // Move toward family anchor if too far
    if (this.creature.lifecycle.familyAnchor && !this.creature.target) {
      const anchor = this.creature.lifecycle.familyAnchor;
      const dx = anchor.x - this.creature.x;
      const dy = anchor.y - this.creature.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 45) {
        this.creature.target = {
          x: anchor.x,
          y: anchor.y,
          family: true,
          priority: 0.3
        };
      }
    }
  }

  /**
   * Select a family member to anchor to
   */
  selectFamilyAnchor(world) {
    if (!this.creature.children) return null;

    let best = null;
    let bestScore = 0;

    for (const childId of this.creature.children) {
      const child = world.creatureManager?.getAnyCreatureById(childId);
      if (!child || !child.alive) continue;

      if (child.ageStage === 'adult') continue; // Adults are independent

      const score = child.ageStage === 'juvenile' ? 2 :
        child.ageStage === 'baby' ? 3 : 1;

      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }

    return best;
  }

  /**
   * Sample direction toward wetland biome
   */
  sampleWetlandDirection(world) {
    if (!world.getBiomeAt) return null;

    for (let i = 0; i < 5; i++) {
      const angle = rand() * CreatureConfig.TAU;
      const distance = 30 + rand() * 50;
      const testX = this.creature.x + Math.cos(angle) * distance;
      const testY = this.creature.y + Math.sin(angle) * distance;

      const biome = world.getBiomeAt(testX, testY);
      if (biome?.type === 'wetland') {
        return angle;
      }
    }

    return null;
  }
}
