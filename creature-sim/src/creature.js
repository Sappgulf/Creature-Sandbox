import { clamp, rand, randn, dist2 } from './utils.js';
import { BehaviorConfig } from './behavior.js';
import { getExpressedGenes, applyDisorderEffects } from './genetics.js';
import { CreatureConfig } from './creature-config.js';
import { CreatureStatusSystem } from './creature-status.js';
import { CreatureBehaviorSystem } from './creature-behavior.js';

// Destructure commonly-used constants for cleaner code
const { TRAIL_INTERVAL, TRAIL_MAX, LOG_MAX, TAU } = CreatureConfig;
const NAME_SUGGESTIONS = [
  'Fizz',
  'Pebble',
  'Wiggle',
  'Pip',
  'Bloop',
  'Ziggy',
  'Sprout',
  'Nib',
  'Mochi',
  'Skitter',
  'Jelly',
  'Nimbus',
  'Gizmo',
  'Sprocket',
  'Noodle'
];

function pickNameSuggestion(seed) {
  const idx = Math.abs(Math.floor(seed)) % NAME_SUGGESTIONS.length;
  const tag = Math.abs(Math.floor(seed * 37)) % 99;
  return `${NAME_SUGGESTIONS[idx]}-${tag}`;
}

/**
 * Represents a creature in the simulation with genetic traits and behaviors.
 */
export class Creature {
  /**
   * Creates a new creature with the specified position and genetic makeup.
   * @param {number} x - The x-coordinate of the creature's position
   * @param {number} y - The y-coordinate of the creature's position
   * @param {Object} genes - The creature's genetic traits
   * @param {boolean} isChild - Whether this creature was born (affects starting energy)
   */
  constructor(x, y, genes, isChild = false) {
    // Core properties
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = rand(0, CreatureConfig.TAU);
    this.externalImpulse = { vx: 0, vy: 0, decay: 6, cap: 360 };
    this.isGrabbed = false;
    this.grabTarget = { x, y };
    this.energy = isChild ?
      CreatureConfig.STARTING_ENERGY.baby :
      CreatureConfig.STARTING_ENERGY.adult;
    this.age = 0;
    this.alive = true;

    // OPTIMIZATION: Only process genetics if diploid genes detected
    const hasDiploidGenes = genes.speed && typeof genes.speed === 'object' && 'expressed' in genes.speed;

    if (hasDiploidGenes) {
      // Store original diploid genes
      this.genesRaw = genes;

      // Apply disorder effects and get expressed phenotype
      const modifiedGenes = applyDisorderEffects(genes);
      this.genes = getExpressedGenes(modifiedGenes);

      // Store sex and genetic info
      this.sex = genes.sex || 'female';
      this.disorders = genes.disorders || [];
      this.mutations = genes.mutations || [];
    } else {
      // Old haploid genes - use directly for compatibility
      this.genes = genes;
      this.genesRaw = null;
      this.sex = genes.sex || 'female';
      this.disorders = [];
      this.mutations = [];
    }

    // NEW: Age stages (baby → juvenile → adult → elder)
    this.ageStage = isChild ? 'baby' : 'adult';
    this.baseSize = null; // Will be set below

    // Size based on diet (omnivores are medium-sized)
    const diet = this.genes.diet ?? (this.genes.predator ? 1.0 : 0.0);
    const isOmnivore = diet > CreatureConfig.GENETICS.DIET_THRESHOLDS.HERBIVORE_MAX &&
      diet < CreatureConfig.GENETICS.DIET_THRESHOLDS.OMNIVORE_MAX;
    this.baseSize = isOmnivore ?
      CreatureConfig.GENETICS.SIZE_MODIFIERS.OMNIVORE :
      (CreatureConfig.GENETICS.SIZE_MODIFIERS.HERBIVORE_BASE +
        (this.genes.predator ? CreatureConfig.GENETICS.SIZE_MODIFIERS.PREDATOR_BONUS : 0));
    this.aquaticAffinity = this.genes.aquatic ?? 0;

    // Apply disorder size modifiers
    if (this.genesRaw && this.genesRaw.sizeModifier) {
      this.baseSize *= this.genesRaw.sizeModifier;
    }

    // Age-based size multiplier
    const ageSizeMultiplier = this._getAgeSizeMultiplier();
    this.size = this.baseSize * ageSizeMultiplier;

    // Parent tracking for parental care
    this.children = []; // Track offspring

    this.target = null;
    this.id = null;       // set by World.addCreature
    this.parentId = null; // set by World.addCreature
    this.parents = [];
    this.currentBiomeType = null;

    this.maxHealth = this.genes.predator ?
      CreatureConfig.BASE_HEALTH.predator :
      CreatureConfig.BASE_HEALTH.herbivore;

    // Apply disorder health modifiers
    if (this.genesRaw?.healthModifier) {
      this.maxHealth *= this.genesRaw.healthModifier;
    }

    this.health = this.maxHealth;
    this.stats = { food: 0, kills: 0, births: 0, damageTaken: 0, damageDealt: 0 };
    this.funStats = { hardLandings: 0, goofyFails: 0, propBounces: 0 };
    this.nameSuggestion = pickNameSuggestion(this.x + this.y + Math.random() * 1000);
    this.trail = [{ x, y }];
    this.trailTimer = 0;
    this.log = [];
    this.logVersion = 0;
    this.personality = {
      packInstinct: clamp(this.genes.packInstinct ??
        (this.genes.predator ?
          CreatureConfig.GENETICS.PERSONALITY_DEFAULTS.PACK_INSTINCT.predator :
          CreatureConfig.GENETICS.PERSONALITY_DEFAULTS.PACK_INSTINCT.herbivore), 0, 1),
      ambushDelay: Math.max(0, this.genes.ambushDelay ??
        (this.genes.predator ?
          CreatureConfig.GENETICS.PERSONALITY_DEFAULTS.AMBUSH_DELAY.predator :
          CreatureConfig.GENETICS.PERSONALITY_DEFAULTS.AMBUSH_DELAY.herbivore)),
      aggression: clamp(this.genes.aggression ??
        (this.genes.predator ?
          CreatureConfig.GENETICS.PERSONALITY_DEFAULTS.AGGRESSION.predator :
          CreatureConfig.GENETICS.PERSONALITY_DEFAULTS.AGGRESSION.herbivore), 0.4, 2.2),
      ambushTimer: 0,
      huntCooldown: 0,
      lastSignalAt: -Infinity,
      currentTargetId: null,
      attackCooldown: 0,
      idleTempo: rand(0.7, 1.4),
      idleSway: rand(0.6, 1.3),
      reactivity: clamp(0.35 + rand(-0.1, 0.25) + (this.genes.sense / 200) * 0.25, 0.2, 1.2),
      playfulness: clamp(0.3 + rand(-0.2, 0.4) + (1 - this.genes.metabolism / 2) * 0.2, 0.1, 1.2)
    };
    this.statuses = new Map();
    this.cooldowns = {
      adrenaline: 0,
      familyAid: 0
    };
    this.damageFx = {
      recentDamage: 0,
      hitFlash: 0
    };
    this._lastCollisionReactAt = -Infinity;
    this._lastPokeAt = -Infinity;
    this._pokeCombo = 0;
    this._fallReactCooldown = 0;
    this._lastExternalSpeed = 0;
    this._ragdollCooldown = 0;
    this.recoveryPoseTimer = 0;
    this.mood = {
      icon: null,
      timer: 0
    };
    this.statusTimers = {
      diseaseSpread: rand(0.6, 1.2),
      venomTick: 1.2
    };
    this.lifecycle = {
      playCooldown: rand(6, 12),
      playTimer: 0,
      elderAidCooldown: rand(5, 9),
      familyCheck: rand(2.5, 4.5),
      familyAnchor: null
    };

    // NEW: Animation state for visual feedback
    this.animation = {
      state: 'idle', // idle, walking, running, eating, sleeping
      timer: 0, // Animation cycle timer
      bobPhase: Math.random() * Math.PI * 2, // Random start phase for variety
      lastEat: -Infinity,
      eatDuration: 0.5, // Eating animation lasts 0.5s
      sleepTimer: 0, // Time creature has been idle/resting
      reaction: {
        type: null,
        timer: 0,
        duration: 0,
        intensity: 0
      }
    };

    // Cache expensive calculations
    this._cachedBaseBurn = null;
    this._senseRadius2Cache = null;
    this._halfFovRad = (genes.fov * 0.5) * Math.PI / 180; // Cache FOV in radians

    // FEATURE 2: Learning & Memory
    const memoryCapacity = Math.floor(CreatureConfig.MEMORY.CAPACITY_BASE +
      (genes.sense / CreatureConfig.MEMORY.CAPACITY_SENSE_RATIO));
    this.memory = {
      capacity: memoryCapacity,
      locations: [], // { x, y, type, strength, timestamp }
      decayRate: CreatureConfig.MEMORY.DECAY_RATE
    };

    // FEATURE 4: Social Behaviors
    this.social = {
      herdMates: [], // nearby same-species creatures
      packTarget: null, // shared target for pack hunting
      offspring: [], // child IDs (recent)
      lastReproduction: -Infinity
    };

    // FEATURE 9: Migration
    this.migration = {
      instinct: clamp(genes.herdInstinct ?? 0.5, 0, 1), // how likely to migrate
      targetBiome: null, // which biome to migrate to
      lastMigration: -Infinity,
      settled: false
    };

    // FEATURE 5: Emotional States
    this.emotions = {
      fear: 0,          // 0-1, increases when attacked/near predators
      hunger: 0,        // 0-1, increases when low energy
      confidence: CreatureConfig.EMOTIONS.DEFAULT_CONFIDENCE,
      curiosity: clamp(genes.sense / 150, 0, 1), // exploration drive
      stress: 0,        // 0-1, accumulates from negative events
      contentment: CreatureConfig.EMOTIONS.DEFAULT_CONTENTMENT
    };

    // FEATURE 6: Sensory Specialization
    this.senseType = this._determineSenseType(genes);

    // FEATURE 7: Problem Solving & Intelligence
    this.intelligence = {
      level: clamp((genes.sense / CreatureConfig.INTELLIGENCE.LEVEL_SENSE_RATIO) *
        (genes.metabolism ?? CreatureConfig.INTELLIGENCE.LEVEL_METABOLISM_MULTIPLIER),
      0, CreatureConfig.INTELLIGENCE.LEVEL_MAX),
      patterns: [], // learned successful strategies
      experiencePoints: 0,
      learningRate: CreatureConfig.INTELLIGENCE.PATTERN_LEARNING
    };

    // FEATURE 8: Sexual Selection
    this.sexuality = {
      attractiveness: this._calculateAttractiveness(genes),
      lastMated: -Infinity,
      choosiness: clamp(genes.sense / 120, 0.3, 1), // how picky
      courtshipStyle: Math.random(), // display type
      desiredTraits: this._pickDesiredTraits(genes)
    };

    // Initialize new modular systems
    this.statusSystem = new CreatureStatusSystem(this);
    this.behaviorSystem = new CreatureBehaviorSystem(this);
  }

  _determineSenseType(genes) {
    // Determine sense type based on genes
    const r = genes.hue / 360; // use hue as determinant
    if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.NORMAL_MAX) return 'normal';
    if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.CHEMICAL_MAX) return 'chemical'; // better pheromone tracking
    if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.THERMAL_MAX) return 'thermal'; // see through obstacles
    return 'echolocation'; // wider detection
  }

  _calculateAttractiveness(genes) {
    // Multi-factor attractiveness
    return (genes.speed * 0.3 +
      genes.sense * 0.002 +
      (2 - genes.metabolism) * 0.2 +
      (genes.predator ? genes.aggression * 0.2 : 1 - genes.metabolism * 0.3));
  }

  _pickDesiredTraits(genes) {
    // What this creature finds attractive
    return {
      speed: genes.speed > 1.2,
      sense: genes.sense > 100,
      health: true,
      predator: genes.predator
    };
  }

  baseBurn() {
    // Cache this expensive calculation since genes don't change
    if (this._cachedBaseBurn === null) {
      const g = this.genes;
      const moveCost = 0.35 * g.speed * g.speed;
      const senseCost = 0.08 * (g.fov / 90) + 0.06 * (g.sense / 100);
      this._cachedBaseBurn = (0.4 * g.metabolism) + moveCost + senseCost;
    }
    return this._cachedBaseBurn;
  }

  seek(foodList, pheromone) {
    let best = null, bestD2 = Infinity;
    const senseRadius = this.genes.sense * (0.7 + BehaviorConfig.forageWeight * 0.6);
    const senseRadius2 = senseRadius * senseRadius;

    // Optimize: pre-compute values outside loop
    const myX = this.x, myY = this.y, myDir = this.dir;
    const halfFov = this._halfFovRad; // Use cached FOV
    const forageWeight = BehaviorConfig.forageWeight;

    for (let i = 0; i < foodList.length; i++) {
      const f = foodList[i];
      const dx = f.x - myX, dy = f.y - myY;
      const d2 = dx * dx + dy * dy; // Inline dist2 to avoid function call
      if (d2 > senseRadius2) continue;

      const ang = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(ang - myDir), Math.cos(ang - myDir));
      if (Math.abs(delta) > halfFov) continue;

      const bias = forageWeight > 0 ? d2 / forageWeight : d2;
      if (bias < bestD2) { bestD2 = bias; best = f; }
    }

    if (!best && pheromone) {
      const gx = Math.floor(myX / pheromone.cell);
      const gy = Math.floor(myY / pheromone.cell);
      const here = pheromone.get(gx, gy);
      let maxVal = here, target = null;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const v = pheromone.get(gx + ox, gy + oy);
          if (v > maxVal) {
            maxVal = v;
            target = { x: (gx + ox + 0.5) * pheromone.cell, y: (gy + oy + 0.5) * pheromone.cell };
          }
        }
      }
      best = target || null;
    }
    this.target = best;
  }

  hunt(world, dt) {
    const persona = this.personality;
    persona.huntCooldown = Math.max(0, persona.huntCooldown - dt);

    const detectionRadius = this.genes.sense * (0.55 + persona.aggression * 0.35);
    const prey = world.findPrey(this, detectionRadius);
    if (prey && prey.alive) {
      if (persona.currentTargetId !== prey.id) {
        persona.currentTargetId = prey.id;
        persona.ambushTimer = persona.ambushDelay;
      }
      this.target = { x: prey.x, y: prey.y, creatureId: prey.id };
      if (persona.packInstinct > 0.35 && persona.huntCooldown <= 0) {
        const strength = clamp(0.45 + persona.packInstinct, 0.45, 1.6);
        world.registerPredatorSignal(prey.x, prey.y, strength, 5.5, this.id);
        persona.huntCooldown = 4.5 - Math.min(persona.packInstinct, 0.9);
        persona.lastSignalAt = world.t;
      }
      return;
    }

    const signal = persona.packInstinct > 0.25
      ? world.samplePredatorSignal(this.x, this.y, detectionRadius * 1.15, this.id)
      : null;
    if (signal) {
      this.target = { x: signal.x, y: signal.y, signal: true, strength: signal.strength };
      persona.currentTargetId = null;
      return;
    }

    this.target = null;
    persona.currentTargetId = null;
  }

  /**
   * Updates the creature's state for one simulation frame.
   * OPTIMIZED: Early exits and reduced per-frame overhead
   * @param {number} dt - Time delta since last update (in seconds)
   * @param {Object} world - The world object containing simulation state
   */
  update(dt, world) {
    // OPTIMIZATION: Fast early exit for dead creatures
    if (!this.alive) return;

    // OPTIMIZATION: Skip validation in production (dev-only checks)
    // if (typeof dt !== 'number' || dt < 0 || !isFinite(dt)) return;
    // if (!world || typeof world !== 'object') return;

    this.age += dt;
    this._lastWorld = world;

    // OPTIMIZATION: Only update age stage every 60 frames (~1s at 60fps)
    // Age stage doesn't change frequently
    if (!this._ageStageFrame || this._ageStageFrame++ > 60) {
      this._updateAgeStage();
      this.size = this.baseSize * this._getAgeSizeMultiplier();
      this._ageStageFrame = 0;
    }

    // Update modular systems
    this.statusSystem.tick(dt);
    this.behaviorSystem.update(dt, world);

    if (this.isGrabbed && this.grabTarget) {
      this.x = clamp(this.grabTarget.x, 0, world.width);
      this.y = clamp(this.grabTarget.y, 0, world.height);
      this.vx = 0;
      this.vy = 0;
      this._updateReaction(dt);
      this._updateMood(dt);
      this.recoveryPoseTimer = Math.max(0, this.recoveryPoseTimer - dt);
      this.updateTrail(dt);
      return;
    }

    // OPTIMIZATION: Only update advanced AI features every few frames
    // These are expensive and don't need per-frame precision
    if (!this._aiUpdateFrame) this._aiUpdateFrame = Math.floor(Math.random() * 10);
    this._aiUpdateFrame++;

    if (this._aiUpdateFrame >= 10) { // Every ~10 frames
      this._aiUpdateFrame = 0;
      if (this._updateMemory) this._updateMemory(dt * 10, world);
      if (this._updateSocialBehavior) this._updateSocialBehavior(world);
      if (this._updateMigration) this._updateMigration(world, dt * 10);
      if (this._updateEmotions) this._updateEmotions(dt * 10, world);
      if (this._updateIntelligence) this._updateIntelligence(dt * 10, world);
    }

    // Legacy status processing (for compatibility with complex effects)
    this._processStatusEffects(dt, world);

    if (this.cooldowns.adrenaline > 0) {
      this.cooldowns.adrenaline = Math.max(0, this.cooldowns.adrenaline - dt);
    }

    if (this.damageFx.hitFlash > 0) {
      this.damageFx.hitFlash = Math.max(0, this.damageFx.hitFlash - dt * 2.6);
    }
    if (this.damageFx.recentDamage > 0) {
      this.damageFx.recentDamage = Math.max(0, this.damageFx.recentDamage - dt);
    }

    // Ongoing bleed damage (if any)
    const bleedStatus = this.getStatus('bleed');
    if (bleedStatus) {
      const stacks = Math.max(1, bleedStatus.stacks ?? 1);
      const severity = clamp(bleedStatus.intensity ?? 1, 0.2, 3);
      const bleedRate = (0.35 + stacks * 0.22) * severity;
      const bleedDamage = bleedRate * dt;
      if (bleedDamage > 0) {
        this.health = Math.max(0, this.health - bleedDamage);
        this.stats.damageTaken += bleedDamage;
        this.energy = Math.max(0, this.energy - bleedDamage * 0.08);
      }
    }

    if (this.health < this.maxHealth) {
      const regenBase = this.genes.predator ? 0.9 : 1.6;
      const energyFactor = clamp(this.energy / 24, 0.3, 1.2);
      const grit = this.genes.grit ?? 0;
      let penalty = 1;
      if (this.damageFx.recentDamage > 0) {
        penalty -= Math.min(0.55, (0.45 - grit * 0.25));
      }
      if (bleedStatus) {
        penalty -= Math.min(0.5, (bleedStatus.stacks ?? 0) * 0.18 * (1 - grit * 0.35));
      }
      if (this.getStatus('elder-aid')) {
        const elderAid = this.getStatus('elder-aid');
        penalty += Math.min(0.18, (elderAid.intensity ?? 0) * 0.2);
      }
      penalty = clamp(penalty, 0.14, 1);
      this.health = Math.min(this.maxHealth, this.health + regenBase * energyFactor * penalty * dt);
    }

    const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
    if (healthRatio < 0.35 && !this.hasStatus('adrenaline') && this.cooldowns.adrenaline <= 0) {
      const herdBuff = this.getStatus('herd-buff');
      const baseBoost = 0.35 + (this.genes.panicPheromone ?? 0) * 0.45 + (herdBuff?.intensity ?? 0) * 0.2;
      this.applyStatus('adrenaline', { duration: 2.6, intensity: baseBoost, metadata: { boost: baseBoost } });
      this.cooldowns.adrenaline = 7;
    }

    this._handleLifecycleBehavior(dt, world);
    const currentBiome = world.getBiomeAt ? world.getBiomeAt(this.x, this.y) : null;
    this.currentBiome = currentBiome;
    this.currentBiomeType = currentBiome?.type ?? this.currentBiomeType ?? null;
    const inWetland = currentBiome?.type === 'wetland';
    const inWater = currentBiome?.type === 'water';
    const waterDepth = currentBiome?.depth || 0;

    // Swimming state tracking
    this.isSwimming = inWater && this.aquaticAffinity > 0.3;

    // Drowning mechanic for non-aquatic creatures in water
    if (inWater && this.aquaticAffinity < 0.4) {
      // Non-aquatic creatures struggle in water
      const drowningRate = (0.4 - this.aquaticAffinity) * waterDepth * 3; // 0-3 damage/sec in deep water
      this.health -= drowningRate * dt;

      // Add drowning visual feedback periodically
      if (!this._drowningTimer) this._drowningTimer = 0;
      this._drowningTimer -= dt;
      if (this._drowningTimer <= 0) {
        this._drowningTimer = 0.5;
        if (world.particles?.addBubbles) {
          world.particles.addBubbles(this.x, this.y);
        }
        // Panic: try to move toward land
        this.emotions.fear = Math.min(1, this.emotions.fear + 0.3);
      }

      if (this.health <= 0) {
        this.alive = false;
        this.logEvent('Drowned', world.t);
        return;
      }
    }

    let wanderScale = 0.05 * BehaviorConfig.wanderWeight;
    const diet = this.genes.diet ?? (this.genes.predator ? 1.0 : 0.0);
    const isOmnivore = diet > 0.3 && diet < 0.7;
    const canScavenge = diet >= 0.3; // Omnivores and carnivores can scavenge
    if (this.aquaticAffinity > 0.45 && (inWetland || inWater)) {
      wanderScale *= 0.8;
    }

    if (this.genes.predator || diet > 0.7) {
      // Carnivores: hunt or scavenge
      this.hunt(world, dt);
      if (this.personality.currentTargetId) {
        const tracked = world.getAnyCreatureById(this.personality.currentTargetId);
        if (tracked && tracked.alive) {
          this.target = { x: tracked.x, y: tracked.y, creatureId: tracked.id };
        }
      }

      // NEW: If no prey found and can scavenge, look for corpses
      if (!this.target && canScavenge && this.energy < 30) {
        const corpse = world.findNearbyCorpse(this.x, this.y, this.genes.sense * 0.8);
        if (corpse) {
          this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
        }
      }

      wanderScale *= clamp(1 - this.personality.aggression * 0.25, 0.25, 1);
    } else if (isOmnivore) {
      // NEW: Omnivores: eat plants, scavenge corpses
      const foodList = world.nearbyFood(this.x, this.y, this.genes.sense);
      const corpse = world.findNearbyCorpse(this.x, this.y, this.genes.sense * 0.9);

      // Prefer corpses when hungry, plants otherwise
      if (corpse && this.energy < 25) {
        this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
      } else {
        this.seek(foodList, world.pheromone);
      }

      // If no food found but corpse available, go for it
      if (!this.target && corpse) {
        this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
      }
    } else {
      // Herbivores: only eat plants
      this.seek(world.nearbyFood(this.x, this.y, this.genes.sense), world.pheromone);
    }

    if (this.genes.predator && this.personality.ambushTimer > 0) {
      this.personality.ambushTimer = Math.max(0, this.personality.ambushTimer - dt);
    }

    let desiredAngle = this.dir + randn(0, wanderScale);
    if (this.target) desiredAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    if (this.lifecycle?.playTimer > 0 && !this.target) {
      desiredAngle += Math.sin(this.lifecycle.playTimer * 12 + (this.id ?? 0)) * 0.4;
    }
    if (this.aquaticAffinity > 0.5 && !inWetland && (!this.target || this.target.family)) {
      const wetDir = this._sampleWetlandDirection(world);
      if (wetDir != null) {
        desiredAngle = desiredAngle * 0.7 + wetDir * 0.3;
      }
    }
    const aggressiveTurn = this.genes.predator && this.target && this.target.creatureId != null && this.personality.ambushTimer <= 0;
    const turnClamp = aggressiveTurn ? 0.22 : 0.15;
    const delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -turnClamp, turnClamp);

    const restFactor = BehaviorConfig.restWeight * clamp(1 - this.energy / 36, 0, 1);
    const aggressionFactor = this.genes.predator ? clamp(this.personality.aggression, 0.4, 2.2) : 1;
    let baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    if (this.genes.predator) baseSpeed *= 0.85 + aggressionFactor * 0.25;

    // Water biome speed modifiers
    if (inWater) {
      if (this.aquaticAffinity > 0.5) {
        // Aquatic creatures are fast in water
        baseSpeed *= currentBiome.aquaticSpeed || (1.2 + this.aquaticAffinity * 0.3);
      } else if (this.aquaticAffinity > 0.2) {
        // Semi-aquatic creatures are okay in water
        baseSpeed *= 0.7 + this.aquaticAffinity * 0.5;
      } else {
        // Non-aquatic creatures struggle badly in water
        baseSpeed *= currentBiome.movementSpeed || 0.3;
      }
    } else if (inWetland) {
      if (this.aquaticAffinity > 0.1) {
        baseSpeed *= 1 + this.aquaticAffinity * 0.32;
      } else {
        baseSpeed *= 0.88;
      }
    } else if (this.aquaticAffinity > 0.5) {
      // Highly aquatic creatures are slower on land
      baseSpeed *= 0.9 - Math.min(0.2, (this.aquaticAffinity - 0.5) * 0.25);
    }

    // NEW: Age stage speed modifiers
    switch (this.ageStage) {
      case 'baby': baseSpeed *= 0.6; break; // Babies slower, learning to walk
      case 'juvenile': baseSpeed *= 0.85; break; // Getting faster
      case 'elder': baseSpeed *= 0.9; break; // Slowing down
      // Adults: no modifier (1.0)
    }
    let speedScalar = clamp(1 - restFactor * 0.6, 0.15, 1);
    let speedBoost = 1;
    const herdBuff = this.getStatus('herd-buff');
    const playBurst = this.getStatus('play-burst');
    const elderAid = this.getStatus('elder-aid');
    if (herdBuff && !this.genes.predator) {
      speedBoost += herdBuff.intensity ?? 0;
    }
    const adrenalineStatus = this.getStatus('adrenaline');
    if (adrenalineStatus) {
      const boost = adrenalineStatus.metadata?.boost ?? adrenalineStatus.intensity ?? 0;
      speedBoost += boost;
    }
    if (bleedStatus) {
      speedBoost -= Math.min(0.3, 0.08 * Math.max(bleedStatus.stacks ?? 1, 0));
    }
    if (playBurst) {
      speedBoost += playBurst.intensity ?? 0.25;
    }
    if (elderAid) {
      speedBoost += (elderAid.intensity ?? 0) * 0.08;
    }
    speedScalar *= clamp(speedBoost, 0.6, 1.9);
    if (this.genes.predator) {
      if (this.personality.ambushTimer > 0 && this.target && this.target.creatureId != null) {
        speedScalar *= 0.25 + 0.15 * aggressionFactor;
      } else if (this.target && this.target.creatureId != null) {
        speedScalar *= 1.05 + aggressionFactor * 0.15;
      } else if (this.target && this.target.signal) {
        speedScalar *= 0.9 + this.personality.packInstinct * 0.35;
      }
    }

    const spd = baseSpeed * speedScalar;
    const chaosGravity = world?.chaos?.gravity ?? 0;
    if (Math.abs(chaosGravity) > 0.1) {
      this.applyImpulse(0, chaosGravity * dt * 60, { decay: 10, cap: 200 });
    }
    this.vx = Math.cos(this.dir) * spd;
    this.vy = Math.sin(this.dir) * spd;
    this.x = this.x + this.vx * dt;
    this.y = this.y + this.vy * dt;
    this._applyExternalImpulse(dt);
    const impulse = this.externalImpulse;
    const externalSpeed = impulse ? Math.hypot(impulse.vx, impulse.vy) : 0;
    const prevExternalSpeed = this._lastExternalSpeed || 0;
    this._lastExternalSpeed = externalSpeed;
    this._fallReactCooldown = Math.max(0, this._fallReactCooldown - dt);

    if (externalSpeed > 120 && this._fallReactCooldown <= 0 && !this.isGrabbed) {
      this._triggerReaction('fall', clamp(externalSpeed / 220, 0.4, 1.2), 0.25);
      this.setMood('😰', 0.6);
      this._fallReactCooldown = 0.4;
    }

    if (prevExternalSpeed > 140 && externalSpeed < 40 && !this.isGrabbed) {
      const landingIntensity = clamp(prevExternalSpeed / 220, 0.4, 1.3);
      this._triggerReaction('landing', landingIntensity, 0.35);
      if (prevExternalSpeed > 180) {
        this.funStats.hardLandings += 1;
        this.setMood('😳', 1.1);
        this.recoveryPoseTimer = Math.max(this.recoveryPoseTimer, 0.8);
        if (Math.random() < 0.12) {
          this._triggerReaction('oops', 1.1, 0.45);
          this.funStats.goofyFails += 1;
        }
      }
    }

    // World boundary handling (configurable via world.boundaryMode)
    const boundaryMode = world.boundaryMode || 'wrap'; // 'wrap', 'clamp', or 'none'
    if (boundaryMode === 'wrap') {
      // Wrap-around (pacman style)
      if (this.x < 0) this.x += world.width;
      else if (this.x >= world.width) this.x -= world.width;
      if (this.y < 0) this.y += world.height;
      else if (this.y >= world.height) this.y -= world.height;
    } else if (boundaryMode === 'clamp') {
      // Hard boundaries (bounce at edge)
      const margin = 10;
      if (this.x < margin) { this.x = margin; this.vx = Math.abs(this.vx); this.dir = Math.atan2(this.vy, this.vx); }
      else if (this.x > world.width - margin) { this.x = world.width - margin; this.vx = -Math.abs(this.vx); this.dir = Math.atan2(this.vy, this.vx); }
      if (this.y < margin) { this.y = margin; this.vy = Math.abs(this.vy); this.dir = Math.atan2(this.vy, this.vx); }
      else if (this.y > world.height - margin) { this.y = world.height - margin; this.vy = -Math.abs(this.vy); this.dir = Math.atan2(this.vy, this.vx); }
    }
    // boundaryMode 'none' = no restrictions (current behavior)

    // NEW: Update animation state based on movement
    this._updateAnimationState(spd, world.t, dt);
    this._updateReaction(dt);
    this._updateMood(dt);
    this._ragdollCooldown = Math.max(0, this._ragdollCooldown - dt);
    this.recoveryPoseTimer = Math.max(0, this.recoveryPoseTimer - dt);

    this.updateTrail(dt);

    if (this.genes.predator || diet > 0.7) {
      // Carnivores: attack prey
      this.personality.attackCooldown = Math.max(0, this.personality.attackCooldown - dt);
      const attackResult = this.personality.attackCooldown <= 0 ? world.tryPredation(this) : null;
      if (attackResult?.victim) {
        if (attackResult.killed) {
          this.energy += 14; // BALANCED: Less OP, need more strategic hunting
          this.stats.kills += 1;
          this.logEvent(attackResult.victim?.id != null ? `Claimed prey #${attackResult.victim.id}` : 'Claimed prey', world.t);
          const victim = attackResult.victim;
          if (victim && typeof victim.logEvent === 'function') {
            victim.logEvent(this.id != null ? `Killed by predator #${this.id}` : 'Killed by predator', world.t);
          }
          if (this.stats.kills === 5) {
            world.lineageTracker?.noteMilestone(world, this, 'claimed 5 hunts');
          }
          this.target = null;
        } else if (attackResult.damage > 0) {
          this.logEvent(`Bit prey for ${attackResult.damage.toFixed(1)}`, world.t);
        }
      }
      if (!this.alive) return;

      // NEW: Try to scavenge corpse if nearby
      if (canScavenge && this.target?.isCorpse && this.target.corpse) {
        if (world.tryEatCorpse(this, this.target.corpse)) {
          this.target = null;
        }
      }
    } else if (isOmnivore) {
      // NEW: Omnivores: eat plants or scavenge
      if (this.target?.isCorpse && this.target.corpse) {
        if (world.tryEatCorpse(this, this.target.corpse)) {
          this.target = null;
        }
      } else {
        const eaten = world.tryEatFoodAt(this.x, this.y, 8);
        if (eaten) {
          // NEW: Use energy from vegetation type!
          const energyGain = eaten.energy || 9;
          this.energy += energyGain;
          this.health = Math.min(this.maxHealth, this.health + energyGain * 0.15);
          this.stats.food += 1;
          this.logEvent(`Foraged ${eaten.type || 'food'}`, world.t);
          world.dropPheromone(this.x, this.y, 0.5);

          // NEW: Trigger eating animation
          this.animation.lastEat = world.t;
          this.animation.state = 'eating';

          // Audio: Eat sound
          if (world.audio && world.audio.ctx) {
            try {
              world.audio.playCreatureSound(this, 'eat');
            } catch (e) {
              // Ignore audio errors (non-critical)
            }
          }

          // Visual: Food absorption particles
          if (world.particles && typeof world.particles.addFoodAbsorption === 'function') {
            world.particles.addFoodAbsorption(eaten.x, eaten.y, this.x, this.y);
          }

          // FEATURE 2: Remember successful food location
          if (this.rememberLocation) {
            this.rememberLocation(this.x, this.y, 'food', 0.8, world.t);
          }

          if (this.stats.food === 20) {
            world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
          }
        }
      }
    } else {
      // Herbivores: only eat plants
      const eaten = world.tryEatFoodAt(this.x, this.y, 8);
      if (eaten) {
        // NEW: Use energy from vegetation type!
        const energyGain = eaten.energy || 9;
        this.energy += energyGain;
        this.health = Math.min(this.maxHealth, this.health + energyGain * 0.15);
        this.stats.food += 1;
        this.logEvent(`Foraged ${eaten.type || 'food'}`, world.t);
        world.dropPheromone(this.x, this.y, 0.5);

        // NEW: Trigger eating animation
        this.animation.lastEat = world.t;
        this.animation.state = 'eating';

        // FEATURE 2: Remember successful food location
        if (this.rememberLocation) {
          this.rememberLocation(this.x, this.y, 'food', 0.8, world.t);
        }

        if (this.stats.food === 20) {
          world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
        }
      }
    }

    const tempPenalty = world.tempPenaltyAt(this.x, this.y);
    let energyDrain = this.baseBurn() + tempPenalty;

    // NEW: Age stage metabolism modifiers
    switch (this.ageStage) {
      case 'baby': energyDrain *= 1.1; break; // Babies need more energy for growth
      case 'juvenile': energyDrain *= 1.05; break; // Still growing
      case 'elder': energyDrain *= 1.15; break; // Elders less efficient
      // Adults: no modifier (1.0)
    }

    if (adrenalineStatus) energyDrain += 2.6 + (adrenalineStatus.metadata?.boost ?? adrenalineStatus.intensity ?? 0) * 2;
    if (herdBuff && !this.genes.predator) energyDrain += (herdBuff.intensity ?? 0) * 0.8;
    if (bleedStatus) energyDrain += 0.35 + (bleedStatus.stacks ?? 0) * 0.4;
    if (playBurst) energyDrain += 0.45;
    if (elderAid) energyDrain *= clamp(1 - (elderAid.intensity ?? 0) * 0.2, 0.7, 1);
    if (this.genes.predator) {
      const aggressionTax = Math.max(0, (aggressionFactor - 1) * 0.18);
      energyDrain += aggressionTax;
    }
    // Water and wetland energy modifiers
    if (inWater) {
      if (this.aquaticAffinity > 0.5) {
        // Aquatic creatures are efficient in water
        energyDrain *= 0.7;
      } else if (this.aquaticAffinity > 0.2) {
        // Semi-aquatic: slight penalty
        energyDrain *= 1.1;
      } else {
        // Non-aquatic: significant energy drain from struggling
        energyDrain *= 1.8;
      }
    } else if (inWetland) {
      energyDrain *= clamp(1 - this.aquaticAffinity * 0.25 + (this.aquaticAffinity < 0.2 ? 0.12 : 0), 0.65, 1.15);
    } else if (this.aquaticAffinity > 0.4) {
      // Aquatic creatures on dry land get tired
      energyDrain += this.aquaticAffinity * 0.35;
    }

    // Day/Night cycle: nocturnal creatures use less energy at night
    if (world.dayNightEnabled && this.genes.nocturnal !== undefined) {
      const hour = world.timeOfDay % 24;
      const isNight = (hour < 6 || hour >= 20);
      const nocturnalPref = this.genes.nocturnal; // 0=diurnal, 1=nocturnal

      if (isNight && nocturnalPref > 0.5) {
        // Nocturnal creatures active at night: bonus efficiency
        energyDrain *= (1.0 - (nocturnalPref - 0.5) * 0.3); // Up to 15% reduction
      } else if (!isNight && nocturnalPref < 0.5) {
        // Diurnal creatures active during day: bonus efficiency
        energyDrain *= (1.0 - (0.5 - nocturnalPref) * 0.3); // Up to 15% reduction
      } else {
        // Active at wrong time: penalty
        const penalty = Math.abs(nocturnalPref - (isNight ? 1 : 0));
        energyDrain *= (1.0 + penalty * 0.2); // Up to 20% increase
      }
    }

    this.energy -= energyDrain * dt;

    if (this.health <= 0) {
      this.alive = false;
      this.logEvent('Bled out', world.t);
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
      return;
    }

    // FEATURE 8: Sexual selection for reproduction
    // NEW: Only adults can reproduce, and elders have menopause (can't reproduce after age 270)
    const canReproduce = this.ageStage === 'adult' || (this.ageStage === 'elder' && this.age < 270);
    if (!this.genes.predator && this.energy > 36 && canReproduce) {
      const fertilityFactor = clamp(world.getSeasonModifier ? world.getSeasonModifier('reproduction') : 1, 0, 1.2);
      const reproductionChance = clamp(fertilityFactor, 0, 1);
      if (Math.random() < reproductionChance) {
        const potentialMates = world.queryCreatures(this.x, this.y, this.genes.sense * 2)
          .filter(c => !c.genes.predator && c.alive && c.id !== this.id && c.energy > 30);

        let selectedMate = null;
        let bestScore = this.sexuality.choosiness;

        for (const mate of potentialMates) {
          if (this.shouldAcceptMate && this.shouldAcceptMate(mate, world.t)) {
            const score = this.evaluateMate(mate);
            if (score > bestScore) {
              bestScore = score;
              selectedMate = mate;
            }
          }
        }

        if (selectedMate || potentialMates.length === 0) {
          const scarcity = Math.max(0, 1 - fertilityFactor);
          const abundance = Math.max(0, fertilityFactor - 1);
          const energyMultiplier = clamp(0.55 + scarcity * 0.12 - abundance * 0.08, 0.42, 0.65);
          this.energy *= energyMultiplier;
          if (selectedMate) {
            this.sexuality.lastMated = world.t;
            selectedMate.sexuality.lastMated = world.t;
            // Log successful mating
            this.emotions.confidence = Math.min(1, this.emotions.confidence + 0.1);
          }
          world.spawnChild(this, selectedMate);
        }
      } else if (fertilityFactor < 0.5 && this.emotions) {
        this.emotions.stress = clamp((this.emotions.stress ?? 0) + 0.02, 0, 1);
      }
    }

    if (this.energy <= 0 || this.age > 300) {
      this.alive = false;
      this.logEvent(this.energy <= 0 ? 'Energy collapse' : 'Old age', world.t);
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
    }
  }

  /**
   * Checks if the creature has a specific status effect.
   * @param {string} key - The status effect key
   * @returns {boolean} Whether the creature has the status
   */
  hasStatus(key) {
    return this.statusSystem.hasStatus(key);
  }

  /**
   * Gets the status effect object for the specified key.
   * @param {string} key - The status effect key
   * @returns {Object|null} The status effect object or null if not found
   */
  getStatus(key) {
    return this.statusSystem.getStatus(key);
  }

  /**
   * Gets the intensity of a status effect.
   * @param {string} key - The status effect key
   * @param {number} fallback - Fallback value if status not found
   * @returns {number} The status intensity
   */
  getStatusIntensity(key, fallback = 0) {
    return this.statusSystem.getStatusIntensity(key, fallback);
  }

  /**
   * Applies a status effect to the creature.
   * @param {string} key - The status effect key
   * @param {Object} opts - Status options (duration, intensity, etc.)
   * @returns {Object} The applied status object
   */
  applyStatus(key, opts = {}) {
    return this.statusSystem.applyStatus(key, opts);
  }

  /**
   * Removes a status effect from the creature.
   * @param {string} key - The status effect key
   */
  removeStatus(key) {
    return this.statusSystem.removeStatus(key);
  }

  _tickStatusSystem(dt) {
    if (!this.statuses.size) return;
    for (const [key, status] of this.statuses) {
      status.elapsed = (status.elapsed ?? 0) + dt;
      if (status.duration !== undefined) {
        status.duration -= dt;
        if (status.duration <= 0) {
          this.statuses.delete(key);
          continue;
        }
      }
    }
  }

  _processStatusEffects(dt, world) {
    const disease = this.getStatus('disease');
    if (disease) {
      const severity = clamp(disease.intensity ?? 0.6, 0.1, 2.2);
      // Increase stress and reduce energy
      this.energy = Math.max(0, this.energy - severity * 0.5 * dt);
      if (this.emotions) {
        this.emotions.stress = clamp((this.emotions.stress ?? 0) + severity * 0.02 * dt, 0, 1);
        this.emotions.confidence = clamp((this.emotions.confidence ?? 0) - severity * 0.015 * dt, 0, 1);
      }
      // Slight fever damage over time
      this.health = Math.max(0, this.health - severity * 0.12 * dt);
      this.statusTimers.diseaseSpread = (this.statusTimers.diseaseSpread ?? rand(0.8, 1.6)) - dt;
      if (this.statusTimers.diseaseSpread <= 0) {
        this._spreadDisease(world, disease);
        this.statusTimers.diseaseSpread = rand(0.9, 1.8);
      }
    }

    const venom = this.getStatus('venom');
    if (venom) {
      const potency = clamp(venom.intensity ?? 1, 0.2, 3);
      this.statusTimers.venomTick = (this.statusTimers.venomTick ?? 1.2) - dt;
      if (this.statusTimers.venomTick <= 0) {
        const burst = 0.8 + potency * 0.6;
        this.health = Math.max(0, this.health - burst);
        this.stats.damageTaken += burst;
        this.energy = Math.max(0, this.energy - burst * 0.2);
        this.statusTimers.venomTick = 1.1;
        if (typeof this.recordDamage === 'function') {
          this.recordDamage(burst * 1.8);
        }
      }
    }
  }

  _handleLifecycleBehavior(dt, world) {
    if (!world) return;
    this.lifecycle = this.lifecycle || {
      playCooldown: rand(6, 12),
      playTimer: 0,
      elderAidCooldown: rand(5, 9),
      familyCheck: rand(2.5, 4.5),
      familyAnchor: null
    };

    // Juvenile play bursts
    if (this.ageStage === 'juvenile' && !this.genes.predator) {
      this.lifecycle.playCooldown -= dt;
      if (this.lifecycle.playCooldown <= 0 && this.energy > 12) {
        this.lifecycle.playTimer = 0.8;
        this.lifecycle.playCooldown = rand(10, 18);
        this.applyStatus('play-burst', { duration: 0.75, intensity: 0.35 });
        this.energy = Math.max(0, this.energy - 0.8);
        if (this.emotions) {
          this.emotions.joy = clamp((this.emotions.joy ?? 0) + 0.2, 0, 1);
          this.emotions.stress = clamp((this.emotions.stress ?? 0) - 0.05, 0, 1);
        }
        if (world.particles && typeof world.particles.addPlayBurst === 'function') {
          world.particles.addPlayBurst(this.x, this.y);
        }
        if (world.audio && world.audio.ctx) {
          try {
            world.audio.playCreatureSound?.(this, 'play');
          } catch (err) {
            // Ignore audio errors
          }
        }
        this.logEvent?.('Playful sprint', world.t);
      } else {
        this.lifecycle.playTimer = Math.max(0, (this.lifecycle.playTimer ?? 0) - dt);
      }
    } else {
      this.lifecycle.playTimer = Math.max(0, (this.lifecycle.playTimer ?? 0) - dt);
    }

    // Elder support aura
    if (this.ageStage === 'elder' && !this.genes.predator) {
      this.lifecycle.elderAidCooldown -= dt;
      if (this.lifecycle.elderAidCooldown <= 0) {
        this.lifecycle.elderAidCooldown = rand(5.5, 8.5);
        this._emitElderSupport(world);
      }
    }

    // Family anchoring
    if (this.children && this.children.length) {
      this.lifecycle.familyCheck -= dt;
      if (this.lifecycle.familyCheck <= 0) {
        this.lifecycle.familyCheck = rand(3, 5);
        this.lifecycle.familyAnchor = this._selectFamilyAnchor(world);
      }
      if (!this.genes.predator && !this.target && this.lifecycle.familyAnchor) {
        const anchor = this.lifecycle.familyAnchor;
        const dx = anchor.x - this.x;
        const dy = anchor.y - this.y;
        if ((dx * dx + dy * dy) > 45 * 45) {
          this.target = { x: anchor.x, y: anchor.y, family: true };
        }
      }
    }
  }

  _emitElderSupport(world) {
    const radius = clamp(this.genes.sense * 0.7, 60, 150);
    const allies = world.queryCreatures(this.x, this.y, radius)
      .filter(c => c !== this && c.alive && !c.genes.predator);
    if (!allies.length) return;
    const bondStrength = clamp((this.genes.herdInstinct ?? 0.4) + (this.genes.grit ?? 0.2), 0.2, 1);
    for (const ally of allies) {
      const closeness = 1 - Math.min(1, dist2(ally.x, ally.y, this.x, this.y) / (radius * radius));
      const intensity = clamp(0.15 + bondStrength * closeness * 0.6, 0.1, 0.5);
      ally.applyStatus?.('elder-aid', { duration: 4.2, intensity });
      ally.energy = Math.min(48, ally.energy + 1.8 * intensity * 3);
      if (ally.emotions) {
        ally.emotions.confidence = clamp((ally.emotions.confidence ?? 0) + intensity * 0.1, 0, 1);
        ally.emotions.stress = clamp((ally.emotions.stress ?? 0) - intensity * 0.08, 0, 1);
      }
      if (world.particles && typeof world.particles.addElderAura === 'function') {
        world.particles.addElderAura(ally.x, ally.y);
      }
    }
    this.logEvent?.('Shared wisdom with the herd', world.t);
  }

  _selectFamilyAnchor(world) {
    if (!this.children || !this.children.length) return null;
    let best = null;
    let bestScore = Infinity;
    for (const childId of this.children) {
      const child = world.getAnyCreatureById(childId);
      if (!child || !child.alive) continue;
      if (child.ageStage === 'adult') continue;
      const score = child.age;
      if (score < bestScore) {
        bestScore = score;
        best = child;
      }
    }
    if (!best) return null;
    return { x: best.x, y: best.y, id: best.id };
  }

  /**
   * Sample direction toward water/wetland for aquatic creatures,
   * or away from water for non-aquatic creatures
   */
  _sampleWetlandDirection(world) {
    if (!world?.getBiomeAt) return null;
    let bestDir = null;
    let bestScore = 0;
    const isAquatic = this.aquaticAffinity > 0.4;
    const radius = 200 + this.aquaticAffinity * 100;

    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const tx = this.x + Math.cos(angle) * radius;
      const ty = this.y + Math.sin(angle) * radius;
      const biome = world.getBiomeAt(tx, ty);
      if (!biome) continue;

      let score = 0;

      if (isAquatic) {
        // Aquatic creatures seek water and wetlands
        if (biome.type === 'water') {
          score = 2.0 + (biome.depth || 0.5) * 0.5; // Prefer deeper water
        } else if (biome.type === 'wetland') {
          score = 1.2;
        } else {
          score = biome.moisture ?? 0;
        }
      } else {
        // Non-aquatic creatures avoid water
        if (biome.type === 'water') {
          score = -2.0; // Strongly avoid
        } else if (biome.type === 'wetland') {
          score = 0.3; // Slightly avoid wetlands too
        } else {
          score = 1.0 + (1 - (biome.moisture ?? 0.5)) * 0.5; // Prefer dry land
        }
      }

      // Slight preference for continuing current direction
      score += (1 - Math.abs(Math.sin(angle - this.dir))) * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestDir = angle;
      }
    }
    return bestScore > 0.4 ? bestDir : null;
  }

  _spreadDisease(world, disease) {
    if (!world || !disease) return;
    const contagion = clamp(disease.metadata?.contagion ?? 0.35, 0.05, 1.0);
    const severity = clamp(disease.intensity ?? 0.6, 0.1, 2.2);
    const radius = clamp(this.genes.sense * 0.6, 40, 140);
    const neighbors = world.queryCreatures(this.x, this.y, radius);
    if (!neighbors || neighbors.length <= 1) return;
    for (const other of neighbors) {
      if (other === this || !other.alive || typeof other.hasStatus !== 'function') continue;
      if (other.hasStatus('disease')) continue;
      const immunity = clamp(other.genes.grit ?? 0, 0, 1);
      const spreadChance = Math.max(0, contagion * 0.3 + severity * 0.05 - immunity * 0.12);
      if (Math.random() < spreadChance) {
        const duration = rand(18, 32);
        const intensity = clamp(severity * rand(0.6, 1.15), 0.25, 2);
        other.applyStatus('disease', {
          duration,
          intensity,
          metadata: {
            contagion: contagion * 0.9
          }
        });
        if (typeof other.logEvent === 'function') {
          other.logEvent('Caught a sickness', world.t);
        }
        if (world.particles && typeof world.particles.addDiseasePulse === 'function') {
          world.particles.addDiseasePulse(other.x, other.y);
        }
      }
    }
  }

  recordDamage(amount) {
    if (!this.damageFx) this.damageFx = { recentDamage: 0, hitFlash: 0 };
    const ratio = clamp(amount / 10, 0.05, 1);
    this.damageFx.recentDamage = Math.min(2.6, (this.damageFx.recentDamage ?? 0) + ratio * 1.5);
    this.damageFx.hitFlash = Math.max(this.damageFx.hitFlash ?? 0, 0.18 + ratio * 0.35);
    this.reactToCollision(amount);
  }

  applyImpulse(vx, vy, { decay = 6, cap = 360 } = {}) {
    if (!this.externalImpulse) {
      this.externalImpulse = { vx: 0, vy: 0, decay, cap };
    }
    const baseSize = this.size ?? 4;
    const weight = clamp(baseSize / 4, 0.7, 1.35);
    const scaledVX = vx / weight;
    const scaledVY = vy / weight;
    const effectiveCap = clamp(cap / weight, 180, 420);
    this.externalImpulse.vx = clamp(this.externalImpulse.vx + scaledVX, -effectiveCap, effectiveCap);
    this.externalImpulse.vy = clamp(this.externalImpulse.vy + scaledVY, -effectiveCap, effectiveCap);
    this.externalImpulse.decay = decay;
    this.externalImpulse.cap = effectiveCap;

    const projected = Math.hypot(this.externalImpulse.vx, this.externalImpulse.vy);
    if (projected > 140 && this._ragdollCooldown <= 0) {
      this._ragdollCooldown = 0.6;
      this._triggerReaction('ragdoll', clamp(projected / 220, 0.6, 1.4), 0.5);
      this.setMood('😵', 0.9);
      this.recoveryPoseTimer = Math.max(this.recoveryPoseTimer, 0.6);
      this.funStats.goofyFails += 1;
    }
  }

  _applyExternalImpulse(dt) {
    const impulse = this.externalImpulse;
    if (!impulse) return;
    if (Math.abs(impulse.vx) < 0.1 && Math.abs(impulse.vy) < 0.1) {
      impulse.vx = 0;
      impulse.vy = 0;
      return;
    }
    this.x += impulse.vx * dt;
    this.y += impulse.vy * dt;
    const decay = impulse.decay ?? 6;
    const decayFactor = Math.max(0, 1 - decay * dt);
    impulse.vx *= decayFactor;
    impulse.vy *= decayFactor;
  }

  reactToPoke({ x = null, y = null } = {}) {
    const intensity = clamp(0.35 + this.personality.reactivity * 0.7, 0.3, 1.3);
    const worldTime = this._lastWorld?.t ?? 0;
    if (worldTime - this._lastPokeAt < 0.75) {
      this._pokeCombo += 1;
    } else {
      this._pokeCombo = 1;
    }
    this._lastPokeAt = worldTime;

    if (this._pokeCombo >= 3) {
      this._triggerReaction('overreact', intensity + 0.4, 0.55);
      this.setMood('😵', 1.1);
      this._pokeCombo = 0;
    } else {
      this._triggerReaction('poke', intensity, 0.35);
    }
    if (this.emotions) {
      this.emotions.curiosity = clamp(this.emotions.curiosity + 0.08, 0, 1);
      this.emotions.confidence = clamp(this.emotions.confidence + 0.03, 0, 1);
    }
    if (x !== null && y !== null) {
      this.dir = Math.atan2(y - this.y, x - this.x);
    }
    if (this._lastWorld) {
      this.logEvent('Poked', this._lastWorld.t, { source: 'player' });
    }
  }

  reactToGrab({ x = null, y = null } = {}) {
    const intensity = clamp(0.3 + this.personality.playfulness * 0.5 + this.personality.reactivity * 0.3, 0.25, 1.2);
    this._triggerReaction('grab', intensity, 0.4);
    this.setMood('😮', 0.6);
    if (this.emotions) {
      this.emotions.curiosity = clamp(this.emotions.curiosity + 0.06, 0, 1);
      this.emotions.stress = clamp(this.emotions.stress + 0.04, 0, 1);
    }
    if (x !== null && y !== null) {
      this.dir = Math.atan2(y - this.y, x - this.x);
    }
  }

  reactToDrop({ x = null, y = null } = {}) {
    const intensity = clamp(0.3 + this.personality.playfulness * 0.7, 0.25, 1.2);
    this._triggerReaction('drop', intensity, 0.45);
    this.setMood('😄', 0.7);
    if (this.emotions) {
      this.emotions.curiosity = clamp(this.emotions.curiosity + 0.12, 0, 1);
    }
    if (x !== null && y !== null) {
      this.dir = Math.atan2(y - this.y, x - this.x);
    }
  }

  reactToCollision(amount = 0.5) {
    const worldTime = this._lastWorld?.t ?? 0;
    if (worldTime - this._lastCollisionReactAt < 0.25) return;
    this._lastCollisionReactAt = worldTime;
    const intensity = clamp(0.25 + amount * 0.08 + this.personality.reactivity * 0.25, 0.2, 1.2);
    this._triggerReaction('collision', intensity, 0.25);
    if (this.emotions) {
      this.emotions.fear = clamp(this.emotions.fear + 0.08, 0, 1);
      this.emotions.stress = clamp(this.emotions.stress + 0.05, 0, 1);
    }
    if (amount > 0.8 && this._lastWorld?.audio?.playCreatureSound) {
      this._lastWorld.audio.playCreatureSound(this, 'impact');
    }
    if (amount > 0.7 && this._lastWorld?.particles?.addImpactRing) {
      this._lastWorld.particles.addImpactRing(this.x, this.y, { color: 'rgba(248, 250, 252, 1)', size: 10 });
    }
    if (amount > 0.9 && this._lastWorld?.particles?.triggerShake) {
      this._lastWorld.particles.triggerShake(2.5);
    }
  }

  _triggerReaction(type, intensity = 0.5, duration = 0.35) {
    const reaction = this.animation?.reaction;
    if (!reaction) return;
    const chaosBoost = this._lastWorld?.chaos?.reactionBoost ?? 1;
    reaction.type = type;
    reaction.timer = duration;
    reaction.duration = duration;
    reaction.intensity = clamp(intensity * chaosBoost, 0.1, 1.6);
  }

  _updateReaction(dt) {
    const reaction = this.animation?.reaction;
    if (!reaction || reaction.timer <= 0) return;
    reaction.timer = Math.max(0, reaction.timer - dt);
    if (reaction.timer <= 0) {
      reaction.type = null;
      reaction.duration = 0;
      reaction.intensity = 0;
    }
  }

  setMood(icon, duration = 0.6) {
    if (!icon) return;
    this.mood.icon = icon;
    this.mood.timer = Math.max(this.mood.timer, duration);
  }

  _updateMood(dt) {
    if (!this.mood || this.mood.timer <= 0) return;
    this.mood.timer = Math.max(0, this.mood.timer - dt);
    if (this.mood.timer <= 0) {
      this.mood.icon = null;
    }
  }

  _getLookOffset() {
    const world = this._lastWorld;
    const pointer = world?.lastPointerWorld;
    if (!pointer) return { x: 0, y: 0 };
    const dx = pointer.x - this.x;
    const dy = pointer.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return { x: 0, y: 0 };
    const influence = clamp(1 - dist / 240, 0, 1);
    const maxOffset = 0.9 * influence;
    return {
      x: (dx / dist) * maxOffset,
      y: (dy / dist) * maxOffset
    };
  }

  updateTrail(dt) {
    this.trailTimer += dt;
    if (this.trailTimer >= TRAIL_INTERVAL) {
      this.trailTimer = 0;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
  }

  logEvent(message, time, meta = null) {
    this.log.push({ message, time, meta });
    if (this.log.length > LOG_MAX) this.log.shift();
    this.logVersion += 1;
  }

  noteBirth(childId, time) {
    this.stats.births += 1;
    this.logEvent(`Spawned child #${childId}`, time);
  }

  // NEW: Get age stage multipliers
  _updateAgeStage() {
    if (this.age < 30) {
      this.ageStage = 'baby';
    } else if (this.age < 60) {
      this.ageStage = 'juvenile';
    } else if (this.age < 240) {
      this.ageStage = 'adult';
    } else {
      this.ageStage = 'elder';
    }
  }

  _getAgeSizeMultiplier() {
    switch (this.ageStage) {
      case 'baby': return clamp(0.3 + (this.age / 30) * 0.4, 0.3, 0.7); // 30% → 70%
      case 'juvenile': return clamp(0.7 + ((this.age - 30) / 30) * 0.3, 0.7, 1.0); // 70% → 100%
      case 'adult': return 1.0; // 100%
      case 'elder': return clamp(1.0 - ((this.age - 240) / 60) * 0.1, 0.9, 1.0); // 100% → 90%
      default: return 1.0;
    }
  }

  _getAgeStageIcon() {
    switch (this.ageStage) {
      case 'baby': return '🍼';
      case 'juvenile': return '🌱';
      case 'adult': return '⭐';
      case 'elder': return '👴';
      default: return '';
    }
  }

  // NEW: Apply visual animation transforms
  _applyAnimationTransform(ctx) {
    const anim = this.animation;
    if (!anim) return;
    const reaction = anim.reaction;
    const chaosWobble = this._lastWorld?.chaos?.wobbleBoost ?? 1;
    if (reaction && reaction.timer > 0) {
      const progress = reaction.duration > 0 ? reaction.timer / reaction.duration : 0;
      const pulse = Math.sin((1 - progress) * Math.PI);
      const intensity = reaction.intensity * chaosWobble;
      switch (reaction.type) {
        case 'poke': {
          ctx.translate(0, -pulse * 1.2 * intensity);
          ctx.scale(1 + pulse * 0.03 * intensity, 1 - pulse * 0.02 * intensity);
          break;
        }
        case 'drop': {
          ctx.scale(1 + pulse * 0.04 * intensity, 1 + pulse * 0.04 * intensity);
          break;
        }
        case 'grab': {
          ctx.translate(0, -pulse * 0.8 * intensity);
          ctx.scale(1 + pulse * 0.05 * intensity, 1 - pulse * 0.03 * intensity);
          break;
        }
        case 'collision': {
          const shake = Math.sin(progress * Math.PI * 12) * 1.1 * intensity;
          ctx.translate(shake, 0);
          break;
        }
        case 'landing': {
          ctx.translate(0, pulse * 0.8 * intensity);
          ctx.scale(1 + pulse * 0.08 * intensity, 1 - pulse * 0.12 * intensity);
          break;
        }
        case 'fall': {
          const wobble = Math.sin(progress * Math.PI * 10) * 0.25 * intensity;
          ctx.rotate(wobble);
          break;
        }
        case 'overreact': {
          ctx.translate(0, -pulse * 1.6 * intensity);
          ctx.scale(1 + pulse * 0.12 * intensity, 1 - pulse * 0.08 * intensity);
          break;
        }
        case 'ragdoll': {
          const flop = Math.sin(progress * Math.PI * 6) * 0.35 * intensity;
          ctx.rotate(flop);
          ctx.scale(1 + pulse * 0.05 * intensity, 1 - pulse * 0.05 * intensity);
          break;
        }
        case 'oops': {
          const dip = Math.sin(progress * Math.PI * 8) * 0.4 * intensity;
          ctx.translate(0, dip);
          ctx.rotate(dip * 0.06);
          break;
        }
        default:
          break;
      }
    }

    switch (anim.state) {
      case 'walking':
        // Gentle bobbing motion
        const walkBob = Math.sin(anim.bobPhase) * 0.8;
        ctx.translate(0, walkBob);
        break;

      case 'running':
        // Faster, more exaggerated bobbing
        const runBob = Math.sin(anim.bobPhase * 1.5) * 1.5;
        const runTilt = Math.sin(anim.bobPhase * 1.5) * 0.05; // Slight tilt
        ctx.translate(0, runBob);
        ctx.rotate(runTilt);
        break;

      case 'eating':
        // Head bob down (pulsing)
        const eatTime = anim.timer % 0.5;
        const eatBob = Math.sin((eatTime / 0.5) * Math.PI) * 2;
        ctx.translate(0, eatBob);
        ctx.scale(1.0 + eatBob * 0.02, 1.0); // Slight stretch
        break;

      case 'sleeping':
        // Slow breathing motion
        const breathe = Math.sin(anim.timer * 0.5) * 0.5;
        ctx.scale(1.0 + breathe * 0.05, 1.0 - breathe * 0.05);
        break;

      case 'idle':
      default:
        // Subtle idle sway
        const tempo = this.personality?.idleTempo ?? 1;
        const sway = this.personality?.idleSway ?? 1;
        const idleSway = Math.sin(anim.timer * 0.3 * tempo) * 0.3 * sway;
        ctx.translate(0, idleSway);
        break;
    }

    if (this.recoveryPoseTimer > 0) {
      const pose = Math.sin(this.recoveryPoseTimer * 6) * 0.06;
      ctx.rotate(pose);
    }
  }

  // NEW: Update animation state based on behavior
  _updateAnimationState(speed, worldTime, dt) {
    const anim = this.animation;
    const step = clamp(dt || 0.016, 0.01, 0.05);

    // Update animation timer (used for bobbing/cycles)
    anim.timer += step; // Frame-rate independent timing
    anim.bobPhase += speed * 0.02 * (step / 0.016); // Speed affects bob rate

    // Check if eating animation is active
    if (worldTime - anim.lastEat < anim.eatDuration) {
      anim.state = 'eating';
      return;
    }

    // Check if sleeping (low energy and stationary)
    if (this.energy < 15 && speed < 5) {
      anim.sleepTimer += step;
      if (anim.sleepTimer > 2.0) { // Sleep after 2 seconds of low energy
        anim.state = 'sleeping';

        // Emit Zzz particles occasionally
        if (Math.random() < 0.02) { // 2% chance per frame
          const world = this._lastWorld; // Will be set in update()
          if (world && world.particles) {
            world.particles.addSleepParticle(this.x, this.y + this.size);
          }
        }
        return;
      }
    } else {
      anim.sleepTimer = 0;
    }

    // Determine walking vs running based on speed
    const baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    const speedRatio = speed / baseSpeed;

    if (speedRatio > 0.8) {
      anim.state = 'running'; // Fast movement
    } else if (speedRatio > 0.1) {
      anim.state = 'walking'; // Normal movement
    } else {
      anim.state = 'idle'; // Stationary or very slow
    }
  }

  getBadges() {
    const badges = [];
    const g = this.genes;

    // Age stage badge (visual indicator)
    badges.push(this._getAgeStageIcon());

    // NEW: Lucky mutation badge!
    if (g._luckyMutation) badges.push('🍀 Lucky');

    if (g.speed >= 1.45) badges.push('Swift');
    if (g.sense >= 150) badges.push('Scout');
    if (g.metabolism <= 0.6) badges.push('Efficient');
    if (this.ageStage === 'elder') badges.push('Elder');
    if (!g.predator && this.stats.food >= 15) badges.push('Grazer');
    if (g.predator && this.stats.kills >= 3) badges.push('Apex');
    if (this.energy >= 35) badges.push('Charged');
    if (this.aquaticAffinity > 0.6) badges.push('Amphibious');
    if (this.hasStatus && this.hasStatus('disease')) badges.push('Sick');
    if (this.hasStatus && this.hasStatus('venom')) badges.push('Poisoned');
    if (this.funStats?.hardLandings >= 2) badges.push('😵 Crash Landed');
    if (this.funStats?.propBounces >= 3) badges.push('🎯 Bounce Star');
    if (this.funStats?.goofyFails >= 2) badges.push('🤹 Goofball');
    return badges;
  }

  draw(ctx, opts = {}) {
    const {
      isSelected = false,
      isPinned = false,
      inLineage = false,
      showTrail = false,
      showVision = false,
      clusterHue = null
    } = opts;
    const damageFx = this.damageFx ?? null;

    if (showTrail && this.trail.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        const pt = this.trail[i];
        ctx.lineTo(pt.x, pt.y);
      }
      const trailColor = inLineage ? 'rgba(123,198,255,0.35)' : (isSelected || isPinned) ? 'rgba(255,240,180,0.35)' : 'rgba(200,210,255,0.18)';
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = inLineage ? 1.4 : 1;
      ctx.stroke();
      ctx.restore();
    }

    // Draw vision cone if enabled
    if (showVision && (isSelected || isPinned)) {
      ctx.save();

      // Sense radius (full circle)
      const senseRadius = this.genes.sense;
      ctx.beginPath();
      ctx.arc(this.x, this.y, senseRadius, 0, TAU);
      const hasTarget = this.target !== null;
      const senseColor = hasTarget
        ? (this.genes.predator ? 'rgba(255,100,100,0.08)' : 'rgba(100,255,100,0.08)')
        : 'rgba(200,200,255,0.05)';
      ctx.fillStyle = senseColor;
      ctx.fill();
      ctx.strokeStyle = hasTarget
        ? (this.genes.predator ? 'rgba(255,100,100,0.25)' : 'rgba(100,255,100,0.25)')
        : 'rgba(200,200,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // FOV cone
      const halfFov = this._halfFovRad;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, senseRadius, this.dir - halfFov, this.dir + halfFov);
      ctx.closePath();
      ctx.fillStyle = hasTarget
        ? (this.genes.predator ? 'rgba(255,80,80,0.12)' : 'rgba(80,255,80,0.12)')
        : 'rgba(255,255,150,0.08)';
      ctx.fill();
      ctx.strokeStyle = hasTarget
        ? (this.genes.predator ? 'rgba(255,80,80,0.4)' : 'rgba(80,255,80,0.4)')
        : 'rgba(255,255,150,0.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // NEW: Draw line to target for better AI intent visualization
      if (this.target && (this.target.x !== undefined && this.target.y !== undefined)) {
        const targetDist = Math.sqrt((this.target.x - this.x) ** 2 + (this.target.y - this.y) ** 2);
        const lineLength = Math.min(targetDist, senseRadius * 0.8);
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

        // Dashed line from creature to target
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(
          this.x + Math.cos(angle) * lineLength,
          this.y + Math.sin(angle) * lineLength
        );
        ctx.strokeStyle = this.target.creatureId !== undefined
          ? 'rgba(255,100,100,0.6)' // Red for prey
          : this.target.isCorpse
            ? 'rgba(180,130,80,0.5)' // Brown for corpse
            : 'rgba(100,220,100,0.5)'; // Green for food
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small dot at target location
        if (targetDist <= senseRadius) {
          ctx.beginPath();
          ctx.arc(this.target.x, this.target.y, 3, 0, TAU);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
      }

      ctx.restore();
    }

    const g = this.genes;
    ctx.save();
    ctx.translate(this.x, this.y);

    // OPTIMIZATION: Only apply animation when zoomed in enough or selected
    const shouldAnimate = isSelected || isPinned || (opts.zoom && opts.zoom > 0.8);
    if (shouldAnimate) {
      this._applyAnimationTransform(ctx);
    }

    ctx.rotate(this.dir);

    // OPTIMIZATION: Cache size calculation
    const energyRatio = clamp(this.energy / 40, 0.2, 1.0);
    const r = energyRatio * (3 + this.size);

    if (damageFx?.recentDamage > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 5, 0, TAU);
      ctx.strokeStyle = `rgba(255,96,96,${clamp(damageFx.recentDamage / 2.6, 0.15, 0.55)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const displayHue = clusterHue !== null ? clusterHue : g.hue;

    if (inLineage) {
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fillStyle = `hsla(${displayHue},100%,70%,0.18)`;
      ctx.fill();
    }

    const baseLight = g.predator ? 45 : 60;
    const flash = damageFx ? damageFx.hitFlash : 0;
    const lightness = Math.min(85, baseLight + flash * 90);
    ctx.fillStyle = `hsl(${displayHue},85%,${lightness}%)`;

    // OPTIMIZATION: Only draw detailed traits when zoomed in significantly
    const showTraitDetails = opts.showTraitVisualization !== false && (isSelected || isPinned || (opts.zoom && opts.zoom > 1.0));

    // NEW: Trait visualization - body shape based on metabolism
    const bodyScale = 0.8 + (2 - g.metabolism) * 0.3; // Low metabolism = chunkier
    ctx.save();
    ctx.scale(1, bodyScale);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 3.5 / bodyScale);
    ctx.lineTo(-4, -3.5 / bodyScale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = `hsla(${displayHue},90%,80%,${0.65 + flash * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();

    // OPTIMIZATION: Only draw detailed trait visualization when zoomed in
    if (showTraitDetails) {
      this._drawTraits(ctx, g, displayHue, r);
    }

    if (isPinned) {
      ctx.strokeStyle = 'rgba(140,200,255,0.9)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, r + 4.5, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,255,220,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, 0, TAU);
      ctx.stroke();
    }

    ctx.restore();

    if (this.maxHealth > 0) {
      const hpRatio = clamp(this.health / this.maxHealth, 0, 1);
      const barWidth = 12;
      const barHeight = 2;
      const x = this.x - barWidth / 2;
      const y = this.y - this.size - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = this.genes.predator ? 'rgba(255,120,120,0.85)' : 'rgba(120,255,160,0.85)';
      ctx.fillRect(x, y, barWidth * hpRatio, barHeight);
    }

    // NEW: Draw behavior state indicator for AI legibility
    if (opts.showBehaviorState !== false && (isSelected || isPinned || (opts.zoom && opts.zoom > 0.8))) {
      this._drawBehaviorState(ctx);
    }
  }

  /**
   * Draw a small icon/indicator showing the creature's current behavior state
   * This makes AI behavior much more legible to players
   */
  _drawBehaviorState(ctx) {
    let stateIcon = null;
    let stateColor = 'rgba(255,255,255,0.8)';

    // Determine current behavior state from various indicators
    if (this.target) {
      if (this.target.creatureId !== undefined) {
        // Hunting prey
        stateIcon = '🎯';
        stateColor = 'rgba(255,80,80,0.9)';
      } else if (this.target.isCorpse) {
        // Scavenging
        stateIcon = '🦴';
        stateColor = 'rgba(180,130,80,0.9)';
      } else if (this.target.food) {
        // Foraging
        stateIcon = '🌿';
        stateColor = 'rgba(120,220,120,0.9)';
      } else if (this.target.family) {
        // Following family
        stateIcon = '❤️';
        stateColor = 'rgba(255,150,200,0.9)';
      } else if (this.target.pheromone) {
        // Following scent trail
        stateIcon = '👃';
        stateColor = 'rgba(200,180,255,0.9)';
      }
    }

    // Status-based overrides
    if (this.hasStatus && this.hasStatus('adrenaline')) {
      stateIcon = '⚡';
      stateColor = 'rgba(255,220,80,0.9)';
    } else if (this.emotions && this.emotions.fear > 0.6) {
      stateIcon = '😰';
      stateColor = 'rgba(255,200,100,0.9)';
    } else if (this.hasStatus && this.hasStatus('disease')) {
      stateIcon = '🤢';
      stateColor = 'rgba(100,220,100,0.9)';
    } else if (this.lifecycle && this.lifecycle.playTimer > 0) {
      stateIcon = '🎮';
      stateColor = 'rgba(255,255,150,0.9)';
    } else if (this.animation && this.animation.state === 'eating') {
      stateIcon = '😋';
      stateColor = 'rgba(255,200,100,0.9)';
    } else if (this.animation && this.animation.state === 'sleeping') {
      stateIcon = '💤';
      stateColor = 'rgba(150,150,220,0.9)';
    }

    if (!stateIcon && this.mood?.icon) {
      stateIcon = this.mood.icon;
      stateColor = 'rgba(255,220,220,0.9)';
    }

    // Age stage indicator (only for babies and elders)
    if (!stateIcon && this.ageStage === 'baby') {
      stateIcon = '🐣';
    } else if (!stateIcon && this.ageStage === 'elder') {
      stateIcon = '👴';
    }

    if (stateIcon) {
      ctx.save();
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = stateColor;
      ctx.fillText(stateIcon, this.x, this.y - this.size - 10);
      ctx.restore();
    }
  }

  _drawTraits(ctx, g, hue, r) {
    // Draw visual traits based on genes

    // 1. EYES - Size based on sense radius (bigger sense = bigger eyes)
    const eyeSize = clamp(g.sense / 100, 0.6, 1.5);
    const look = this._getLookOffset();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, -1.5, eyeSize, 0, TAU);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(2 + look.x, -1.5 + look.y, eyeSize * 0.5, 0, TAU);
    ctx.fill();

    // 2. SPIKES - Defensive herbivores have spikes
    const spineStrength = g.spines ?? 0;
    if (spineStrength > 0.2) {
      ctx.strokeStyle = `hsl(${hue}, 70%, 40%)`;
      ctx.lineWidth = 1.5;
      const spikeCount = Math.floor(spineStrength * 6) + 2;
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * TAU;
        const spikeLength = 2 + spineStrength * 3;
        const x1 = Math.cos(angle + Math.PI * 0.5) * r;
        const y1 = Math.sin(angle + Math.PI * 0.5) * r;
        const x2 = Math.cos(angle + Math.PI * 0.5) * (r + spikeLength);
        const y2 = Math.sin(angle + Math.PI * 0.5) * (r + spikeLength);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // 3. SPEED INDICATOR - Fast creatures have elongated tail/fins
    if (g.speed > 1.2) {
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.6)`;
      ctx.beginPath();
      const tailLength = (g.speed - 1) * 4;
      ctx.moveTo(-4, 0);
      ctx.lineTo(-4 - tailLength, 2);
      ctx.lineTo(-4 - tailLength, -2);
      ctx.closePath();
      ctx.fill();
    }

    // 4. PREDATOR TEETH
    if (g.predator || (g.diet && g.diet > 0.7)) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 0.5;
      // Upper teeth
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(4 - i * 1.5, 0.5);
        ctx.lineTo(5 - i * 1.5, 2);
        ctx.lineTo(3 - i * 1.5, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
