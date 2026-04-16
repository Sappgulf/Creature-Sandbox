import { clamp, rand, randn, dist2 } from './utils.js';
import { BehaviorConfig } from './behavior.js';
import { getExpressedGenes, applyDisorderEffects } from './genetics.js';
import { CreatureConfig } from './creature-config.js';
import { CreatureTuning } from './creature-tuning.js';
import { createEcosystemState, ECOSYSTEM_STATES } from './creature-ecosystem.js';
import { CreatureStatusSystem } from './creature-status.js';
import { CreatureBehaviorSystem } from './creature-behavior.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';
import { updateAgentState, applyRestRecovery, updateRestHome, updateMatingBond, applyHungerRelief, getHomeBias } from './creature-agent-needs.js';
import { eventSystem, GameEvents } from './event-system.js';
import { generateTemperament } from './creature-traits.js';
import { pickNameSuggestion, determineSenseType, resolveDietRole, calculateAttractiveness, pickDesiredTraits } from './creature-genetics-helpers.js';
import { updateAgeStage, getAgeSizeMultiplier, getAgeSpeedMultiplier, getAgeMetabolismMultiplier } from './creature-age.js';
import { getBadges as _getBadges, drawCreature as _drawCreature, getCachedSpriteFrame as _getCachedSpriteFrame, updateCachedCanvas as _updateCachedCanvas, drawBehaviorState as _drawBehaviorState, drawTraits as _drawTraits } from './creature-render.js';

// Destructure commonly-used constants for cleaner code
const { TRAIL_INTERVAL, TRAIL_MAX, LOG_MAX } = CreatureConfig;

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
    this.homeAnchor = { x, y };
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
    this.lifeStage = isChild ? 'baby' : 'adult';
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
    this.flyingAffinity = this.genes.flying ?? 0;
    this.burrowingAffinity = this.genes.burrowing ?? 0;

    // Apply disorder size modifiers
    if (this.genesRaw && this.genesRaw.sizeModifier) {
      this.baseSize *= this.genesRaw.sizeModifier;
    }

    // Age-based size multiplier
    const ageSizeMultiplier = getAgeSizeMultiplier(this.age, this.ageStage);
    this.size = this.baseSize * ageSizeMultiplier;

    // Parent tracking for parental care
    this.children = []; // Track offspring

    this.target = null;
    this.id = null;       // set by World.addCreature
    this.parentId = null; // set by World.addCreature
    this.parents = [];
    this.currentBiomeType = null;

    // NEW: SVG asset rendering cache
    this._cachedCanvas = null;
    this._cachedColor = null;
    this._cachedAssetType = null;
    this._cachedSpriteSet = null;

    const baseMaxHealth = this.genes.predator ?
      CreatureTuning.DEFAULT_MAX_HEALTH * 1.25 :
      CreatureTuning.DEFAULT_MAX_HEALTH;
    this.maxHealth = baseMaxHealth;

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
    this.temperament = generateTemperament(genes.temperament || {});
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
    const dietRole = resolveDietRole(this.genes);
    this.traits = {
      bounce: clamp(0.95 + rand(-0.08, 0.08), 0.75, 1.25),
      temperament: clamp(0.5 + rand(-0.18, 0.18), 0, 1),
      dietRole
    };
    this.temperamentTimers = {
      stressEase: 0,
      quirkCooldown: 0
    };
    this.quirks = [];
    this.statuses = new Map();
    this.cooldowns = {
      adrenaline: 0,
      familyAid: 0,
      predatorLite: 0
    };
    this._wasOvercrowded = false;
    this.damageFx = {
      recentDamage: 0,
      hitFlash: 0,
      iframesUntil: -Infinity,
      lastDamageTime: -Infinity
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
      speedRatio: 0,
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

    this.spawnTime = 0;
    this.spawnScale = 0;

    // Cache expensive calculations
    this._cachedBaseBurn = null;
    this._senseRadius2Cache = null;
    this._halfFovRad = (genes.fov * 0.5) * Math.PI / 180; // Cache FOV in radians

    // FEATURE 2: Learning & Memory
    const memoryCapacity = clamp(
      CreatureConfig.MEMORY.SLOTS_MIN + Math.floor(genes.sense / CreatureConfig.MEMORY.SLOTS_SENSE_RATIO),
      CreatureConfig.MEMORY.SLOTS_MIN,
      CreatureConfig.MEMORY.SLOTS_MAX
    );
    this.memory = {
      capacity: memoryCapacity,
      locations: [], // { x, y, type, strength, timestamp }
      decayRate: CreatureConfig.MEMORY.DECAY_RATE,
      nextId: 1,
      focus: null,
      lastCalmAt: -Infinity,
      lastDangerAt: -Infinity,
      lastNestAt: -Infinity
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
      targetRegionId: null,
      target: null,
      lastMigration: -Infinity,
      settled: true,
      active: false,
      cooldownUntil: -Infinity,
      recentUntil: -Infinity,
      settleTimer: 0,
      nextCheckAt: rand(0.4, 1.4)
    };
    this.homeNestId = null;
    this.homeRegionId = null;
    this.territoryAffinity = clamp(0.25 + (genes.herdInstinct ?? 0.5) * 0.6, 0.1, 0.95);
    this._restNestTimer = 0;
    this._returnHomeUntil = -Infinity;

    // FEATURE 5: Emotional States
    this.emotions = {
      fear: 0,          // 0-1, increases when attacked/near predators
      hunger: 0,        // 0-1, increases when low energy
      confidence: CreatureConfig.EMOTIONS.DEFAULT_CONFIDENCE,
      curiosity: clamp(genes.sense / 150, 0, 1), // exploration drive
      stress: 0,        // 0-1, accumulates from negative events
      contentment: CreatureConfig.EMOTIONS.DEFAULT_CONTENTMENT
    };

    // NEW: Needs-driven agent state
    this.needs = {
      hunger: CreatureAgentTuning.NEEDS.START.hunger,
      energy: CreatureAgentTuning.NEEDS.START.energy,
      socialDrive: CreatureAgentTuning.NEEDS.START.socialDrive,
      stress: CreatureAgentTuning.NEEDS.START.stress,
      lastEatAt: -Infinity
    };
    this.goal = {
      current: 'WANDER',
      lastChange: 0,
      cooldown: 0,
      mateCooldown: 0,
      bondingWith: null,
      bondTimer: 0,
      bondAnnounced: false,
      score: 0
    };
    this.senses = {
      food: null,
      restZone: null,
      nest: null,
      homeNest: null,
      mate: null,
      overcrowded: false,
      corpse: null
    };
    this._needsTimer = rand(0, CreatureAgentTuning.NEEDS.UPDATE_INTERVAL);
    this._goalTimer = rand(0, CreatureAgentTuning.GOALS.UPDATE_INTERVAL);
    this._steeringTimer = rand(0, CreatureAgentTuning.MOVEMENT.STEERING_INTERVAL);
    this._eatTimer = 0;
    this._separation = { x: 0, y: 0 };
    this._edgeAvoid = { x: 0, y: 0 };

    this.ecosystem = createEcosystemState({
      stress: 16,
      energy: clamp(68 + rand(-6, 8), 40, 90),
      curiosity: clamp(45 + (genes.sense / 2), 30, 90),
      stability: clamp(70 + rand(-8, 8), 45, 90)
    });

    // FEATURE 6: Sensory Specialization
    this.senseType = determineSenseType(genes);

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
      attractiveness: calculateAttractiveness(genes),
      lastMated: -Infinity,
      choosiness: clamp(genes.sense / 120, 0.3, 1), // how picky
      courtshipStyle: Math.random(), // display type
      desiredTraits: pickDesiredTraits(genes)
    };

    // Initialize new modular systems
    this.statusSystem = new CreatureStatusSystem(this);
    this.behaviorSystem = new CreatureBehaviorSystem(this);
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

  hasQuirk(id) {
    return Array.isArray(this.quirks) && this.quirks.includes(id);
  }

  getQuirkMultiplier(kind) {
    if (!this.quirks || !this.quirks.length) return 1;
    let mult = 1;
    for (const q of this.quirks) {
      switch (kind) {
        case 'wander':
          if (q === 'wanderer') mult *= 1.25;
          if (q === 'homebody') mult *= 0.85;
          break;
        case 'home_pull':
          if (q === 'homebody') mult *= 1.35;
          break;
        case 'stress_crowd':
          if (q === 'squeamish') mult *= 1.25;
          if (q === 'social_butterfly') mult *= 0.85;
          break;
        case 'damage_resist':
          if (q === 'sturdy') mult *= 0.9;
          break;
        case 'night_speed':
          if (q === 'night_owl') mult *= 1.15;
          break;
        case 'day_speed':
          if (q === 'night_owl') mult *= 0.92;
          break;
        case 'cohesion':
          if (q === 'social_butterfly') mult *= 1.2;
          break;
        case 'hunger_bias':
          if (q === 'greedy') mult *= 1.15;
          break;
        default:
          break;
      }
    }
    return mult;
  }

  seek(foodList, pheromone) {
    let best = null, bestD2 = Infinity;
    const senseRadius = this.genes.sense * (0.7 + (BehaviorConfig.forageWeight || 1) * 0.6);
    const senseRadius2 = senseRadius * senseRadius;

    const myX = this.x, myY = this.y, myDir = this.dir;
    const halfFov = this._halfFovRad;
    const forageWeight = BehaviorConfig.forageWeight || 1;

    const count = foodList.length;

    for (let i = 0; i < count; i++) {
      const f = foodList[i];
      const dx = f.x - myX, dy = f.y - myY;

      // Fast distance threshold check before expensive math
      if (Math.abs(dx) > senseRadius || Math.abs(dy) > senseRadius) continue;

      const d2 = dx * dx + dy * dy;
      if (d2 > senseRadius2) continue;

      // Only calculate atan2 if the food is a candidate for FOV check
      const ang = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(ang - myDir), Math.cos(ang - myDir));
      if (Math.abs(delta) > halfFov) continue;

      const bias = d2 / forageWeight;
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

  huntLite(world, dt) {
    const persona = this.personality;
    const tuning = CreatureAgentTuning.PREDATOR_LITE;
    if (!tuning) return;
    persona.huntCooldown = Math.max(0, persona.huntCooldown - dt);
    if (persona.huntCooldown > 0) return;

    const hunger = this.needs?.hunger ?? 0;
    const stress = this.needs?.stress ?? 0;
    if (hunger < tuning.HUNGER_TRIGGER && stress < tuning.STRESS_TRIGGER) return;
    if (Math.random() > tuning.CHASE_CHANCE) return;

    const detectionRadius = this.genes.sense * tuning.SENSE_MULT;
    const prey = world.findPrey?.(this, detectionRadius);
    if (prey && prey.alive) {
      persona.currentTargetId = prey.id;
      persona.ambushTimer = persona.ambushDelay;
      this.target = { x: prey.x, y: prey.y, creatureId: prey.id, predatorLite: true };
      persona.huntCooldown = tuning.CHASE_COOLDOWN;
      return;
    }

    this.target = null;
    persona.currentTargetId = null;
  }

  _applyPredatorLiteChase(world, dt) {
    const tuning = CreatureAgentTuning.PREDATOR_LITE;
    if (!tuning) return;
    this.cooldowns.predatorLite = Math.max(0, this.cooldowns.predatorLite - dt);
    if (this.cooldowns.predatorLite > 0) return;

    const targetId = this.personality.currentTargetId;
    if (!targetId) return;
    const prey = world.getAnyCreatureById(targetId);
    if (!prey || !prey.alive) {
      this.personality.currentTargetId = null;
      return;
    }

    const dx = prey.x - this.x;
    const dy = prey.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > tuning.TAG_RANGE) return;
    if (dist <= 0.001) return;

    const nx = dx / dist;
    const ny = dy / dist;
    prey.applyImpulse?.(nx * tuning.SCATTER_IMPULSE, ny * tuning.SCATTER_IMPULSE, {
      decay: 6,
      cap: tuning.SCATTER_CAP
    });
    if (prey.needs) {
      prey.needs.stress = clamp((prey.needs.stress ?? 0) + tuning.STRESS_BOOST, 0, 100);
    }
    if (prey.ecosystem) {
      prey.ecosystem.stress = clamp((prey.ecosystem.stress ?? 0) + tuning.STRESS_BOOST * 0.6, 0, 100);
    }
    prey.setMood?.('😳', 0.6);
    this.cooldowns.predatorLite = tuning.TAG_COOLDOWN;

    try {
      eventSystem.emit(GameEvents.PREDATOR_LITE_CHASE, {
        predatorId: this.id,
        preyId: prey.id,
        x: (prey.x + this.x) * 0.5,
        y: (prey.y + this.y) * 0.5,
        worldTime: world.t
      });
    } catch (error) {
      console.warn('Failed to emit predator-lite chase event:', error);
    }

    this.personality.currentTargetId = null;
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
    this.spawnTime += dt;
    this.spawnScale = Math.min(1, this.spawnTime / 0.4);
    this._lastWorld = world;

    // OPTIMIZATION: Only update age stage every 60 frames (~1s at 60fps)
    // Age stage doesn't change frequently
    if (!this._ageStageFrame || this._ageStageFrame++ > 60) {
      updateAgeStage(this);
      this.size = this.baseSize * getAgeSizeMultiplier(this.age, this.ageStage);
      this._ageStageFrame = 0;
    }

    // Update modular systems
    this.statusSystem.tick(dt);
    this.behaviorSystem.update(dt, world);
    updateAgentState(this, dt, world);

    // Nocturnal "Night Owl" status at night
    const dayNight = world?.dayNightState;
    const isNight = dayNight?.phase === 'night' || (dayNight?.light ?? 1) < 0.4;
    if (isNight && this.genes.nocturnal !== undefined && this.genes.nocturnal > 0.5) {
      const nightOwlStrength = this.genes.nocturnal;
      this.applyStatus('night-owl', {
        duration: 0.5,
        intensity: nightOwlStrength,
        metadata: { nocturnalPref: nightOwlStrength }
      });
    }

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
    if (this.cooldowns.predatorLite > 0) {
      this.cooldowns.predatorLite = Math.max(0, this.cooldowns.predatorLite - dt);
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
      const drowningRate = (0.4 - this.aquaticAffinity) * waterDepth * 2.2; // 0-2.2 damage/sec in deep water
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
    const temperament = this.traits?.temperament ?? 0.5;
    wanderScale *= clamp(0.65 + temperament * 0.7, 0.6, 1.4);
    const diet = this.genes.diet ?? (this.genes.predator ? 1.0 : 0.0);
    const dietRole = this.traits?.dietRole ?? 'herbivore';
    const isOmnivore = diet > 0.3 && diet < 0.7;
    const canScavenge = diet >= 0.3; // Omnivores and carnivores can scavenge
    if (this.aquaticAffinity > 0.45 && (inWetland || inWater)) {
      wanderScale *= 0.8;
    }

    const goal = this.goal?.current ?? 'WANDER';
    this.target = null;

    if (goal === 'SEEK_MATE' && this.senses?.mate) {
      const mate = this.senses.mate;
      this.target = { x: mate.x, y: mate.y, creatureId: mate.id, mate: true };
      this.personality.currentTargetId = null;
    } else if (goal === 'REST' && (this.senses?.homeNest || this.senses?.nest || this.senses?.restZone)) {
      const nest = this.senses?.homeNest || this.senses?.nest;
      if (nest) {
        const distToNest = Math.hypot(nest.x - this.x, nest.y - this.y);
        if (distToNest > nest.radius * 0.55) {
          this.target = { x: nest.x, y: nest.y, nest: true, nestId: nest.id };
        }
      } else if (this.senses?.restZone) {
        const zone = this.senses.restZone;
        const distToZone = Math.hypot(zone.x - this.x, zone.y - this.y);
        if (distToZone > zone.radius * 0.6) {
          this.target = { x: zone.x, y: zone.y, restZone: true, zoneId: zone.id };
        }
      }
      this.personality.currentTargetId = null;
    } else if (goal === 'EAT') {
      if (this.genes.predator || diet > 0.7) {
        if (dietRole === 'predator-lite') {
          this.huntLite(world, dt);
        } else {
          // Carnivores: hunt or scavenge
          this.hunt(world, dt);
        }
        if (this.personality.currentTargetId) {
          const tracked = world.getAnyCreatureById(this.personality.currentTargetId);
          if (tracked && tracked.alive) {
            this.target = { x: tracked.x, y: tracked.y, creatureId: tracked.id };
          }
        }

        // If no prey found and can scavenge, look for corpses
        if (!this.target && canScavenge && (this.energy < 30 || this.senses?.corpse)) {
          const corpse = this.senses?.corpse || world.findNearbyCorpse(this.x, this.y, this.genes.sense * 0.8);
          if (corpse) {
            this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
          }
        }

        wanderScale *= clamp(1 - this.personality.aggression * 0.25, 0.25, 1);
      } else if (isOmnivore) {
        const foodList = world.nearbyFood(this.x, this.y, this.genes.sense);
        const corpse = world.findNearbyCorpse(this.x, this.y, this.genes.sense * 0.9);

        if (corpse && this.energy < 25) {
          this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
        } else {
          this.seek(foodList, world.pheromone);
        }

        if (!this.target && corpse) {
          this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
        }
      } else {
        this.seek(world.nearbyFood(this.x, this.y, this.genes.sense), world.pheromone);
      }
    } else {
      this.personality.currentTargetId = null;
    }

    if (!this.target && this._selectMemory) {
      if (goal === 'EAT' && (this.needs?.hunger ?? 0) >= CreatureConfig.MEMORY.HUNGER_THRESHOLD) {
        const memoryTarget = this._selectMemory('food', world);
        if (memoryTarget) {
          this.target = {
            x: memoryTarget.x,
            y: memoryTarget.y,
            memory: true,
            memoryTag: memoryTarget.tag,
            memoryId: memoryTarget.entry?.id ?? null
          };
          this._setMemoryFocus?.(memoryTarget, world.t);
        }
      } else if (goal === 'REST') {
        const shouldRecallCalm = (this.needs?.energy ?? 100) < 45 ||
          (this.needs?.stress ?? 0) >= CreatureConfig.MEMORY.CALM_STRESS_MAX;
        if (shouldRecallCalm) {
          const memoryTarget = this._selectMemory('calm', world);
          if (memoryTarget) {
            this.target = {
              x: memoryTarget.x,
              y: memoryTarget.y,
              memory: true,
              memoryTag: memoryTarget.tag,
              memoryId: memoryTarget.entry?.id ?? null
            };
            this._setMemoryFocus?.(memoryTarget, world.t);
          }
        }
      } else if (goal === 'SEEK_MATE') {
        const memoryTarget = this._selectMemory('nest', world);
        if (memoryTarget) {
          this.target = {
            x: memoryTarget.x,
            y: memoryTarget.y,
            memory: true,
            memoryTag: memoryTarget.tag,
            memoryId: memoryTarget.entry?.id ?? null
          };
          this._setMemoryFocus?.(memoryTarget, world.t);
        }
      }
    }

    if (this.genes.predator && this.personality.ambushTimer > 0) {
      this.personality.ambushTimer = Math.max(0, this.personality.ambushTimer - dt);
    }

    let desiredAngle = this.dir + randn(0, wanderScale);
    if (this.target) {
      desiredAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      if (this.target.creatureId != null && this.target.mate) {
        const mate = world.getAnyCreatureById(this.target.creatureId);
        if (mate && mate.alive) {
          this.target.x = mate.x;
          this.target.y = mate.y;
        } else {
          this.target = null;
        }
      }
    }
    if (this.lifecycle?.playTimer > 0 && !this.target) {
      desiredAngle += Math.sin(this.lifecycle.playTimer * 12 + (this.id ?? 0)) * 0.4;
    }
    if (this.aquaticAffinity > 0.5 && !inWetland && (!this.target || this.target.family)) {
      const wetDir = this._sampleWetlandDirection(world);
      if (wetDir != null) {
        desiredAngle = desiredAngle * 0.7 + wetDir * 0.3;
      }
    }
    const memoryAvoid = (this.needs?.stress ?? 0) >= CreatureConfig.MEMORY.STRESS_THRESHOLD
      ? this._getMemoryAvoidance?.('danger')
      : null;
    const homeBias = getHomeBias(this, world, goal);
    const migrationBias = this.migration?.bias;
    const avoidScale = CreatureConfig.MEMORY.AVOID_STRENGTH;
    const steeringX = Math.cos(desiredAngle) +
      (this._separation?.x ?? 0) +
      (this._edgeAvoid?.x ?? 0) +
      ((memoryAvoid?.x ?? 0) * avoidScale) +
      (homeBias?.x ?? 0) +
      (migrationBias?.x ?? 0);
    const steeringY = Math.sin(desiredAngle) +
      (this._separation?.y ?? 0) +
      (this._edgeAvoid?.y ?? 0) +
      ((memoryAvoid?.y ?? 0) * avoidScale) +
      (homeBias?.y ?? 0) +
      (migrationBias?.y ?? 0);
    desiredAngle = Math.atan2(steeringY, steeringX);

    const aggressiveTurn = this.genes.predator && this.target && this.target.creatureId != null && this.personality.ambushTimer <= 0;
    const turnRate = aggressiveTurn ? 0.22 : 0.15;
    const turnClamp = clamp(turnRate * (dt / 0.016), 0.08, aggressiveTurn ? 0.34 : 0.24);
    const delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -turnClamp, turnClamp);

    let arriveFactor = 1;
    if (this.target) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (dist < CreatureAgentTuning.MOVEMENT.SLOW_RADIUS) {
        arriveFactor = clamp(
          dist / CreatureAgentTuning.MOVEMENT.SLOW_RADIUS,
          CreatureAgentTuning.MOVEMENT.MIN_ARRIVE_SPEED,
          1
        );
      }
    }

    const restFactor = BehaviorConfig.restWeight * clamp(1 - this.energy / 36, 0, 1);
    const aggressionFactor = this.genes.predator ? clamp(this.personality.aggression, 0.4, 2.2) : 1;
    let _baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    if (this.genes.predator) _baseSpeed *= 0.85 + aggressionFactor * 0.25;

    // Water biome speed modifiers
    if (inWater) {
      if (this.aquaticAffinity > 0.5) {
        // Aquatic creatures are fast in water
        _baseSpeed *= currentBiome.aquaticSpeed || (1.2 + this.aquaticAffinity * 0.3);
      } else if (this.aquaticAffinity > 0.2) {
        // Semi-aquatic creatures are okay in water
        _baseSpeed *= 0.7 + this.aquaticAffinity * 0.5;
      } else {
        // Non-aquatic creatures struggle badly in water
        _baseSpeed *= currentBiome.movementSpeed || 0.3;
      }
    } else if (inWetland) {
      if (this.aquaticAffinity > 0.1) {
        _baseSpeed *= 1 + this.aquaticAffinity * 0.32;
      } else {
        _baseSpeed *= 0.88;
      }
    } else if (this.aquaticAffinity > 0.5) {
      // Highly aquatic creatures are slower on land
      _baseSpeed *= 0.9 - Math.min(0.2, (this.aquaticAffinity - 0.5) * 0.25);
    }

    // Flying creatures get speed boost and prefer high elevation
    if (this.flyingAffinity > 0.4) {
      const isHighElevation = currentBiome?.elevation > 0.5;
      if (isHighElevation) {
        _baseSpeed *= 1.15 + this.flyingAffinity * 0.15;
      } else {
        _baseSpeed *= 1.05 + this.flyingAffinity * 0.1;
      }
    }

    // Burrowing creatures are slower but protected underground
    if (this.burrowingAffinity > 0.4) {
      const isUnderground = currentBiome?.type === 'mountain' || currentBiome?.elevation > 0.65;
      if (isUnderground) {
        _baseSpeed *= 1.1 + this.burrowingAffinity * 0.1;
      } else {
        _baseSpeed *= 0.85 - this.burrowingAffinity * 0.1;
      }
    }

    // NEW: Age stage speed modifiers (smooth transitions)
    _baseSpeed *= getAgeSpeedMultiplier(this.age);
    let _speedScalar = clamp(1 - restFactor * 0.6, 0.15, 1);
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
    _speedScalar *= clamp(speedBoost, 0.6, 1.9);
    const goalSpeedFactor = goal === 'REST'
      ? CreatureAgentTuning.MOVEMENT.REST_SPEED_MULT
      : goal === 'SEEK_MATE'
        ? CreatureAgentTuning.MOVEMENT.SEEK_MATE_SPEED_MULT
        : 1;
    _speedScalar *= arriveFactor * goalSpeedFactor;
    const recallUntil = this.memory?.focus?.recallUntil ?? -Infinity;
    if (world.t < recallUntil) {
      _speedScalar *= CreatureConfig.MEMORY.RECALL_SLOW;
    }
    if (this.genes.predator) {
      if (this.personality.ambushTimer > 0 && this.target && this.target.creatureId != null) {
        _speedScalar *= 0.25 + 0.15 * aggressionFactor;
      } else if (this.target && this.target.creatureId != null) {
        _speedScalar *= 1.05 + aggressionFactor * 0.15;
      } else if (this.target && this.target.signal) {
        _speedScalar *= 0.9 + this.personality.packInstinct * 0.35;
      }
    }

    const spd = this.calculateCurrentSpeed(dt, world);
    const chaosGravity = world?.chaos?.gravity ?? 0;
    if (Math.abs(chaosGravity) > 0.1) {
      this.applyImpulse(0, chaosGravity * dt * 60, { decay: 10, cap: 200 });
    }
    this.vx = Math.cos(this.dir) * spd;
    this.vy = Math.sin(this.dir) * spd;
    // MOVEMENT: position update is handled by behaviorSystem.applyMovement
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

      const fallThreshold = CreatureTuning.FALL_DAMAGE_THRESHOLD;
      if (prevExternalSpeed > fallThreshold) {
        const excess = prevExternalSpeed - fallThreshold;
        const normalized = clamp(excess / 180, 0, 1);
        const damage = normalized * (CreatureTuning.DAMAGE_CLAMP_MAX * 0.55);
        this.applyImpactDamage(damage, { cause: 'fall', intensity: normalized });
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

    const restZone = this.senses?.restZone;
    const inRestZone = restZone
      ? Math.hypot(restZone.x - this.x, restZone.y - this.y) <= restZone.radius
      : false;
    const nest = this.senses?.homeNest || this.senses?.nest;
    const inNest = nest ? Math.hypot(nest.x - this.x, nest.y - this.y) <= nest.radius : false;
    if ((goal === 'REST' || (this.needs?.energy ?? 100) < 30) && (inRestZone || inNest) && spd < 12) {
      applyRestRecovery(this, dt, world, { inRestZone, nest: inNest ? nest : null });
      updateRestHome(this, dt, world, inNest ? nest : null);
      if (Math.random() < 0.02) {
        this.setMood('💤', 0.5);
      }
    } else if (this._restNestTimer) {
      this._restNestTimer = Math.max(0, this._restNestTimer - dt * 2);
    }

    // NEW: Update animation state based on movement
    this._updateAnimationState(spd, world.t, dt);
    this._updateReaction(dt);
    this._updateMood(dt);
    this._ragdollCooldown = Math.max(0, this._ragdollCooldown - dt);
    this.recoveryPoseTimer = Math.max(0, this.recoveryPoseTimer - dt);

    this.updateTrail(dt);

    const canEat = goal === 'EAT' || this.energy < 12;
    if (canEat) {
      this._eatTimer = (this._eatTimer ?? 0) + dt;
    } else {
      this._eatTimer = Math.max(0, (this._eatTimer ?? 0) - dt);
    }

    if (this.genes.predator || diet > 0.7) {
      if (dietRole !== 'predator-lite') {
        // Carnivores: attack prey
        this.personality.attackCooldown = Math.max(0, this.personality.attackCooldown - dt);
        const attackResult = this.personality.attackCooldown <= 0 ? world.tryPredation(this) : null;
        if (attackResult?.victim) {
          if (attackResult.killed) {
            this.energy += 14; // BALANCED: Less OP, need more strategic hunting
            applyHungerRelief(this, 14);
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
      } else {
        this._applyPredatorLiteChase(world, dt);
      }

      // NEW: Try to scavenge corpse if nearby
      if (canScavenge && this.target?.isCorpse && this.target.corpse) {
        const eaten = world.tryEatCorpse(this, this.target.corpse);
        if (eaten) {
          const wasHungry = (this.needs?.hunger ?? 0) >= CreatureConfig.MEMORY.HUNGER_THRESHOLD &&
            (world.t - (this.needs?.lastEatAt ?? -Infinity) > 6);
          applyHungerRelief(this, eaten.energy);
          if (wasHungry) {
            try {
              eventSystem.emit(GameEvents.CREATURE_EAT, {
                creature: this,
                hungry: true,
                source: 'corpse',
                worldTime: world.t
              });
            } catch (error) {
              console.warn('Failed to emit eat event:', error);
            }
          }
          this.target = null;
        }
      }
    } else if (isOmnivore) {
      // NEW: Omnivores: eat plants or scavenge
      if (this.target?.isCorpse && this.target.corpse) {
        const eaten = world.tryEatCorpse(this, this.target.corpse);
        if (eaten) {
          const wasHungry = (this.needs?.hunger ?? 0) >= CreatureConfig.MEMORY.HUNGER_THRESHOLD &&
            (world.t - (this.needs?.lastEatAt ?? -Infinity) > 6);
          applyHungerRelief(this, eaten.energy);
          if (wasHungry) {
            try {
              eventSystem.emit(GameEvents.CREATURE_EAT, {
                creature: this,
                hungry: true,
                source: 'corpse',
                worldTime: world.t
              });
            } catch (error) {
              console.warn('Failed to emit eat event:', error);
            }
          }
          this.target = null;
        }
      } else {
        if (canEat && this._eatTimer >= CreatureAgentTuning.FOOD.BITE_INTERVAL) {
          this._eatTimer = 0;
          const eaten = world.tryEatFoodAt(this.x, this.y, CreatureAgentTuning.FOOD.CONSUME_RANGE, 1);
          if (eaten) {
            const energyGain = eaten.energy || 0;
            const food = eaten.food;
            const wasHungry = (this.needs?.hunger ?? 0) >= CreatureConfig.MEMORY.HUNGER_THRESHOLD &&
              (world.t - (this.needs?.lastEatAt ?? -Infinity) > 6);
            this.energy += energyGain;
            this.health = Math.min(this.maxHealth, this.health + energyGain * 0.15);
            this.stats.food += 1;
            applyHungerRelief(this, energyGain);
            this.logEvent(`Foraged ${food?.type || 'food'}`, world.t);
            world.dropPheromone(this.x, this.y, 0.5);

            this.animation.lastEat = world.t;
            this.animation.state = 'eating';

            if (world.audio && world.audio.ctx) {
              try {
                world.audio.playCreatureSound(this, 'eat');
              } catch {
                // Ignore audio errors (non-critical)
              }
            }

            if (world.particles && typeof world.particles.addFoodAbsorption === 'function' && food) {
              world.particles.addFoodAbsorption(food.x, food.y, this.x, this.y);
            }

            if (this.rememberLocation) {
              this.rememberLocation(this.x, this.y, 'food', 0.8, world.t);
            }
            if (this.memory?.focus?.tag === 'food') {
              this._reinforceMemory?.(this.memory.focus.entry, CreatureConfig.MEMORY.REINFORCE_AMOUNT, world.t);
              this.memory.focus = null;
            }

            if (this.stats.food === 20) {
              world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
            }

            if (wasHungry) {
              try {
                eventSystem.emit(GameEvents.CREATURE_EAT, {
                  creature: this,
                  hungry: true,
                  source: food?.type || 'food',
                  worldTime: world.t
                });
              } catch (error) {
                console.warn('Failed to emit eat event:', error);
              }
            }
          }
        }
      }
    } else {
      // Herbivores: only eat plants
      if (canEat && this._eatTimer >= CreatureAgentTuning.FOOD.BITE_INTERVAL) {
        this._eatTimer = 0;
        const eaten = world.tryEatFoodAt(this.x, this.y, CreatureAgentTuning.FOOD.CONSUME_RANGE, 1);
        if (eaten) {
          const energyGain = eaten.energy || 0;
          const food = eaten.food;
          const wasHungry = (this.needs?.hunger ?? 0) >= CreatureConfig.MEMORY.HUNGER_THRESHOLD &&
            (world.t - (this.needs?.lastEatAt ?? -Infinity) > 6);
          this.energy += energyGain;
          this.health = Math.min(this.maxHealth, this.health + energyGain * 0.15);
          this.stats.food += 1;
          applyHungerRelief(this, energyGain);
          this.logEvent(`Foraged ${food?.type || 'food'}`, world.t);
          world.dropPheromone(this.x, this.y, 0.5);

          this.animation.lastEat = world.t;
          this.animation.state = 'eating';

          if (this.rememberLocation) {
            this.rememberLocation(this.x, this.y, 'food', 0.8, world.t);
          }
          if (this.memory?.focus?.tag === 'food') {
            this._reinforceMemory?.(this.memory.focus.entry, CreatureConfig.MEMORY.REINFORCE_AMOUNT, world.t);
            this.memory.focus = null;
          }

          if (this.stats.food === 20) {
            world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
          }

          if (wasHungry) {
            try {
              eventSystem.emit(GameEvents.CREATURE_EAT, {
                creature: this,
                hungry: true,
                source: food?.type || 'food',
                worldTime: world.t
              });
            } catch (error) {
              console.warn('Failed to emit eat event:', error);
            }
          }
        }
      }
    }

    const tempPenalty = world.tempPenaltyAt(this.x, this.y);
    let energyDrain = this.baseBurn() + tempPenalty;

    // NEW: Age stage metabolism modifiers (smooth transitions)
    energyDrain *= getAgeMetabolismMultiplier(this.age);

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

    // Flying creatures have high metabolism but gain efficiency at high altitude
    if (this.flyingAffinity > 0.4) {
      const isHighElevation = currentBiome?.elevation > 0.5;
      if (isHighElevation) {
        energyDrain *= 0.85 - this.flyingAffinity * 0.1;
      } else {
        energyDrain *= 1.1 + this.flyingAffinity * 0.15;
      }
    }

    // Burrowing creatures are metabolically efficient when underground
    if (this.burrowingAffinity > 0.4) {
      const isUnderground = currentBiome?.type === 'mountain' || currentBiome?.elevation > 0.65;
      if (isUnderground) {
        energyDrain *= 0.75 - this.burrowingAffinity * 0.1;
      } else {
        energyDrain *= 1.15 + this.burrowingAffinity * 0.1;
      }
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

    // NEW: Needs-driven mating loop (controlled + goal-based)
    const canReproduce = this.ageStage === 'adult' ||
      (this.lifeStage === 'elder' && this.age < CreatureAgentTuning.LIFE_STAGE.ELDER_FADE_START);
    const socialReady = (this.needs?.socialDrive ?? 0) >= CreatureAgentTuning.MATING.SOCIAL_THRESHOLD;
    const calmEnough = (this.needs?.stress ?? 100) <= CreatureAgentTuning.MATING.STRESS_MAX;
    const mateCooldownReady = (this.goal?.mateCooldown ?? 0) <= 0;
    const energyReady = this.energy > 24;
    const mate = this.senses?.mate;
    if (goal === 'SEEK_MATE' && canReproduce && socialReady && calmEnough && mateCooldownReady && energyReady && mate) {
      const elderChance = this.lifeStage === 'elder' ? CreatureAgentTuning.MATING.ELDER_CHANCE_MULT : 1;
      const mateElderChance = mate.lifeStage === 'elder' ? CreatureAgentTuning.MATING.ELDER_CHANCE_MULT : 1;
      const mateReady = mate.goal?.current === 'SEEK_MATE' &&
        mate.needs?.socialDrive >= CreatureAgentTuning.MATING.SOCIAL_THRESHOLD &&
        mate.needs?.stress <= CreatureAgentTuning.MATING.STRESS_MAX &&
        (mate.goal?.mateCooldown ?? 0) <= 0 &&
        mate.energy > 24 &&
        Math.random() < elderChance &&
        Math.random() < mateElderChance;
      const distance = Math.hypot(mate.x - this.x, mate.y - this.y);
      const population = world.creatures.length;
      if (population < CreatureAgentTuning.MATING.POPULATION_HARD_CAP && mateReady && distance <= CreatureAgentTuning.MATING.RANGE) {
        const overload = Math.max(0, population - CreatureAgentTuning.MATING.POPULATION_SOFT_CAP);
        const bondMultiplier = overload > 0
          ? CreatureAgentTuning.MATING.OVERCROWD_BOND_MULT * (1 + overload / CreatureAgentTuning.MATING.POPULATION_SOFT_CAP)
          : 1;
        const bondDuration = CreatureAgentTuning.MATING.BOND_TIME * bondMultiplier;
        const bonded = updateMatingBond(this, world, mate, dt, bondDuration);

        if (bonded && this.id < mate.id) {
          world.spawnChild(this, mate);
          if (this.memory) {
            const now = world.t;
            if (now - (this.memory.lastNestAt ?? -Infinity) >= CreatureConfig.MEMORY.NEST_COOLDOWN) {
              this.rememberLocation?.(this.x, this.y, 'nest', 0.6, now);
              this.memory.lastNestAt = now;
            }
            if (mate.memory && now - (mate.memory.lastNestAt ?? -Infinity) >= CreatureConfig.MEMORY.NEST_COOLDOWN) {
              mate.rememberLocation?.(mate.x, mate.y, 'nest', 0.6, now);
              mate.memory.lastNestAt = now;
            }
          }

          const cooldownMult = overload > 0 ? CreatureAgentTuning.MATING.OVERCROWD_COOLDOWN_MULT : 1;
          const cooldown = CreatureAgentTuning.MATING.COOLDOWN * cooldownMult;
          this.goal.mateCooldown = cooldown;
          mate.goal.mateCooldown = cooldown;
          this.goal.bondingWith = null;
          this.goal.bondTimer = 0;
          this.goal.bondAnnounced = false;
          mate.goal.bondingWith = null;
          mate.goal.bondTimer = 0;
          mate.goal.bondAnnounced = false;

          this.energy *= CreatureAgentTuning.MATING.ENERGY_COST_MULT;
          mate.energy *= CreatureAgentTuning.MATING.ENERGY_COST_MULT;

          this.needs.socialDrive = clamp(this.needs.socialDrive - 45, 0, 100);
          mate.needs.socialDrive = clamp(mate.needs.socialDrive - 45, 0, 100);
          this.setMood('💖', 0.9);
          mate.setMood?.('💖', 0.9);
        }
      } else if (population >= CreatureAgentTuning.MATING.POPULATION_HARD_CAP) {
        this.goal.mateCooldown = Math.max(this.goal.mateCooldown, CreatureAgentTuning.MATING.COOLDOWN);
      }
    } else if (this.goal?.bondingWith && (!mate || mate.id !== this.goal.bondingWith)) {
      this.goal.bondingWith = null;
      this.goal.bondTimer = 0;
      this.goal.bondAnnounced = false;
    }

    this.energy -= energyDrain * dt;

    // Starvation mechanic: loss of health when energy is empty
    if (this.energy <= 0) {
      this.energy = 0;
      const starvationRate = CreatureAgentTuning.NEEDS.STARVATION_DAMAGE_RATE || 2.5;
      this.health -= starvationRate * dt;
      if (Math.random() < 0.05) this.setMood('💀', 0.5);
    }

    if (this.health <= 0 || this.age > CreatureAgentTuning.LIFE_STAGE.ELDER_FADE_END) {
      this.alive = false;
      const cause = this.health <= 0
        ? (this.energy <= 0 ? 'Starved' : 'Fatigued')
        : 'Faded peacefully';
      this.deathCause = this.health <= 0 ? (this.energy <= 0 ? 'starvation' : 'health') : 'elder';
      this.logEvent(cause, world.t);
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
      const severity = clamp(disease.intensity ?? 0.6, 0.1, 2.2) * (this.getQuirkMultiplier ? this.getQuirkMultiplier('damage_resist') : 1);
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
          } catch {
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

  /**
   * Records damage taken by the creature, applying health reduction,
   * damage caps, and invincibility frames.
   * @param {number} amount - Initial damage amount
   * @param {Object} ctx - Damage context (attacker, type, etc.)
   */
  recordDamage(amount, ctx = {}) {
    if (!this.alive) return 0;

    // Safety check for invincibility frames
    const now = this._lastWorld?.t ?? 0;
    if (now < (this.damageFx?.iframesUntil ?? -Infinity) && !ctx.ignoreIframes) {
      return 0;
    }

    // Unify visual feedback block
    if (!this.damageFx) {
      this.damageFx = { recentDamage: 0, hitFlash: 0, iframesUntil: -Infinity, lastDamageTime: -Infinity };
    }
    const ratio = clamp(amount / 10, 0.05, 1);
    this.damageFx.recentDamage = Math.min(2.6, (this.damageFx.recentDamage ?? 0) + ratio * 1.5);
    this.damageFx.hitFlash = Math.max(this.damageFx.hitFlash ?? 0, 0.18 + ratio * 0.35);

    // Apply global damage cap (Max 35% of max health per hit)
    const maxDamage = this.maxHealth * (CreatureConfig.COMBAT.MAX_DAMAGE_PERCENT || 0.35);
    const finalDamage = Math.min(amount, maxDamage);

    // Apply health reduction
    this.health = Math.max(0, this.health - finalDamage);
    this.stats.damageTaken += finalDamage;

    if (ctx.attacker) {
      this.killedBy = ctx.attacker.id;
    }

    // Set invincibility frames
    if (!ctx.ignoreIframes) {
      const iframes = CreatureConfig.COMBAT.INVINCIBILITY_DURATION || 0.8;
      this.damageFx.iframesUntil = now + iframes;
    }
    this.damageFx.lastDamageTime = now;

    // Trigger visual/collision reaction
    this.reactToCollision(finalDamage, { skipDamage: true });

    // Handle memory of danger
    if (this.memory && finalDamage > 0.6 &&
      now - (this.memory.lastDangerAt ?? -Infinity) >= CreatureConfig.MEMORY.DANGER_COOLDOWN) {
      const strength = clamp(0.3 + (finalDamage / 12) * 0.6, 0.3, 0.9);
      this.rememberLocation?.(this.x, this.y, 'danger', strength, now);
      this.memory.lastDangerAt = now;
    }

    // Check for death
    if (this.health <= 0) {
      this.alive = false;
      this.deathCause = ctx.type || 'combat';
    } else {
      // "Second Wind" - Adrenaline surge at critical health
      const healthRatio = this.health / this.maxHealth;
      if (healthRatio < 0.15 && (this.cooldowns.adrenaline ?? 0) <= 0) {
        this.applyStatus('adrenaline', {
          duration: 3.5,
          intensity: 0.6,
          metadata: { boost: 0.6, source: 'second_wind' }
        });
        this.cooldowns.adrenaline = 15;
        this.logEvent('Unleashed Second Wind!', now);
      }
    }

    return finalDamage;
  }

  /**
   * Calculates the current speed of the creature based on genes, biome, state, and boosters.
   * @param {number} dt - Time delta
   * @param {Object} world - Simulation world
   * @returns {number} The current speed in px/s
   */
  calculateCurrentSpeed(dt, world) {
    const biome = world.getBiomeAt ? world.getBiomeAt(this.x, this.y) : null;
    const inWater = biome?.type === 'water';
    const inWetland = biome?.type === 'wetland';
    const goal = this.goal?.current || 'WANDER';

    const restFactor = BehaviorConfig.restWeight * clamp(1 - this.energy / 36, 0, 1);
    const aggressionFactor = this.genes.predator ? clamp(this.personality.aggression, 0.4, 2.2) : 1;

    // Scale genes.speed to baseline simulation speeds
    let baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    if (this.genes.predator) baseSpeed *= 0.85 + aggressionFactor * 0.25;

    // Environmental/Biome modifiers
    if (inWater) {
      if (this.aquaticAffinity > 0.5) {
        baseSpeed *= biome.aquaticSpeed || (1.2 + this.aquaticAffinity * 0.3);
      } else if (this.aquaticAffinity > 0.2) {
        baseSpeed *= 0.7 + this.aquaticAffinity * 0.5;
      } else {
        baseSpeed *= biome.movementSpeed || 0.3;
      }
    } else if (inWetland) {
      if (this.aquaticAffinity > 0.1) {
        baseSpeed *= 1 + this.aquaticAffinity * 0.32;
      } else {
        baseSpeed *= 0.88;
      }
    } else if (this.aquaticAffinity > 0.5) {
      baseSpeed *= 0.9 - Math.min(0.2, (this.aquaticAffinity - 0.5) * 0.25);
    }

    // Nocturnal advantage at night
    const dayNight = world?.dayNightState;
    const isNight = dayNight?.phase === 'night' || (dayNight?.light ?? 1) < 0.4;
    if (isNight && this.genes.nocturnal !== undefined) {
      const nocturnalPref = this.genes.nocturnal;
      const isNocturnal = nocturnalPref > 0.5;
      if (isNocturnal) {
        baseSpeed *= 1 + CreatureAgentTuning.NOCTURNAL.NIGHT_SPEED_BONUS * nocturnalPref;
      } else {
        baseSpeed *= 1 - CreatureAgentTuning.NOCTURNAL.DIURNAL_NIGHT_SPEED_PENALTY * (1 - nocturnalPref);
      }
    }

    // Age stage speed modifiers
    baseSpeed *= getAgeSpeedMultiplier(this.age);

    let speedBoost = 1;
    const herdBuff = this.getStatus('herd-buff');
    const adrenaline = this.getStatus('adrenaline');
    const playBurst = this.getStatus('play-burst');
    const elderAid = this.getStatus('elder-aid');
    const bleed = this.getStatus('bleeding');

    if (herdBuff && !this.genes.predator) speedBoost += herdBuff.intensity ?? 0;
    if (adrenaline) speedBoost += adrenaline.metadata?.boost ?? adrenaline.intensity ?? 0;
    if (playBurst) speedBoost += playBurst.intensity ?? 0.25;
    if (elderAid) speedBoost += (elderAid.intensity ?? 0) * 0.08;
    if (bleed) speedBoost -= Math.min(0.3, 0.08 * (bleed.stacks ?? 1));

    // Arrive/Target factor
    let arriveFactor = 1;
    if (this.target) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (dist < CreatureAgentTuning.MOVEMENT.SLOW_RADIUS) {
        arriveFactor = clamp(dist / CreatureAgentTuning.MOVEMENT.SLOW_RADIUS, CreatureAgentTuning.MOVEMENT.MIN_ARRIVE_SPEED, 1);
      }
    }

    const goalSpeedFactor = goal === 'REST' ? 0.4 : goal === 'SEEK_MATE' ? 1.15 : 1;
    let speedScalar = clamp(1 - restFactor * 0.6, 0.15, 1) * clamp(speedBoost, 0.6, 1.9) * arriveFactor * goalSpeedFactor;

    if (this.genes.predator) {
      if (this.personality.ambushTimer > 0 && this.target && this.target.creatureId != null) {
        speedScalar *= 0.25 + 0.15 * aggressionFactor;
      } else if (this.target && this.target.creatureId != null) {
        speedScalar *= 1.05 + aggressionFactor * 0.15;
      } else if (this.target && this.target.signal) {
        speedScalar *= 0.9 + this.personality.packInstinct * 0.35;
      }
    }

    const recallUntil = this.memory?.focus?.recallUntil ?? -Infinity;
    if (world.t < recallUntil) speedScalar *= CreatureConfig.MEMORY.RECALL_SLOW;

    return baseSpeed * speedScalar;
  }

  _calculateCollisionDamage(amount) {
    const threshold = CreatureTuning.COLLISION_DAMAGE_THRESHOLD;
    if (amount <= threshold) return 0;
    const normalized = (amount - threshold) / (1 - threshold);
    return normalized * (CreatureTuning.DAMAGE_CLAMP_MAX * 0.45);
  }

  applyImpactDamage(amount, { cause = 'impact', intensity = 0.4 } = {}) {
    if (!this.alive || amount <= 0) return 0;
    const worldTime = this._lastWorld?.t ?? 0;
    const iframes = CreatureTuning.DAMAGE_IFRAMES_MS / 1000;
    if (worldTime < (this.damageFx?.iframesUntil ?? -Infinity)) return 0;

    const clamped = clamp(amount, 0, CreatureTuning.DAMAGE_CLAMP_MAX);
    const finalDamage = typeof this.recordDamage === 'function'
      ? this.recordDamage(clamped, { type: cause, ignoreIframes: true })
      : 0;
    if (finalDamage <= 0) return 0;

    if (this.damageFx) {
      this.damageFx.iframesUntil = worldTime + iframes;
      this.damageFx.lastDamageTime = worldTime;
    }

    if (this.memory && finalDamage > 0.6 &&
      worldTime - (this.memory.lastDangerAt ?? -Infinity) >= CreatureConfig.MEMORY.DANGER_COOLDOWN) {
      const strength = clamp(0.3 + (finalDamage / CreatureTuning.DAMAGE_CLAMP_MAX) * 0.6, 0.3, 0.9);
      this.rememberLocation?.(this.x, this.y, 'danger', strength, worldTime);
      this.memory.lastDangerAt = worldTime;
    }

    this._lastWorld?.creatureEcosystem?.registerEvent?.(this, 'impact', { intensity });
    return finalDamage;
  }

  applyImpulse(vx, vy, { decay = 6, cap = 360 } = {}) {
    if (!this.externalImpulse) {
      this.externalImpulse = { vx: 0, vy: 0, decay, cap };
    }
    const baseSize = this.size ?? 4;
    const weight = clamp(baseSize / 4, 0.7, 1.35);
    const bounce = this.traits?.bounce ?? 1;
    const scaledVX = (vx * bounce) / weight;
    const scaledVY = (vy * bounce) / weight;
    const effectiveCap = clamp(cap / weight, 180, 420);
    this.externalImpulse.vx = clamp(this.externalImpulse.vx + scaledVX, -effectiveCap, effectiveCap);
    this.externalImpulse.vy = clamp(this.externalImpulse.vy + scaledVY, -effectiveCap, effectiveCap);
    this.externalImpulse.decay = decay;
    this.externalImpulse.cap = effectiveCap;

    const projected = Math.hypot(this.externalImpulse.vx, this.externalImpulse.vy);
    const ragdollThreshold = 165 + Math.max(0, (this._lastWorld?.chaos?.reactionBoost ?? 1) - 1) * 20;
    if (projected > ragdollThreshold && this._ragdollCooldown <= 0) {
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
    this._lastWorld?.creatureEcosystem?.registerEvent?.(this, 'poke', { intensity });
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

  reactToCollision(amount = 0.5, { skipDamage = false } = {}) {
    const worldTime = this._lastWorld?.t ?? 0;
    if (worldTime - this._lastCollisionReactAt < 0.33) return;
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

    if (!skipDamage) {
      const damage = this._calculateCollisionDamage(amount);
      if (damage > 0) {
        this.applyImpactDamage(damage, { cause: 'collision', intensity: amount });
      }
    }
  }

  _triggerReaction(type, intensity = 0.5, duration = 0.35) {
    const reaction = this.animation?.reaction;
    if (!reaction) return;
    const chaosBoost = this._lastWorld?.chaos?.reactionBoost ?? 1;
    const eco = this.ecosystem;
    const stressBoost = eco ? clamp(eco.stress / 100, 0, 1) : 0;
    const stabilityFactor = eco ? clamp(0.75 + (1 - eco.stability / 100) * 0.5, 0.6, 1.3) : 1;
    const stateBoost = eco?.state === ECOSYSTEM_STATES.PANICKED ? 1.15
      : eco?.state === ECOSYSTEM_STATES.STRESSED ? 1.08
        : 1;
    reaction.type = type;
    reaction.timer = duration;
    reaction.duration = duration;
    reaction.intensity = clamp(intensity * chaosBoost * stateBoost * (1 + stressBoost * 0.25) * stabilityFactor, 0.1, 1.8);
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
    const curiosity = this.ecosystem ? clamp(this.ecosystem.curiosity / 100, 0.3, 1.2) : 1;
    const maxOffset = 0.9 * influence * curiosity;
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

  _applyAnimationTransform(ctx) {
    const anim = this.animation;
    if (!anim) return;
    const reaction = anim.reaction;
    const chaosWobble = this._lastWorld?.chaos?.wobbleBoost ?? 1;
    const eco = this.ecosystem;
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

    if (eco) {
      const stressRatio = clamp(eco.stress / 100, 0, 1);
      if (stressRatio > 0.25) {
        const jitter = Math.sin(anim.timer * 12) * 0.28 * stressRatio * chaosWobble;
        ctx.translate(jitter, 0);
      }
      const energyRatio = clamp(eco.energy / 100, 0, 1);
      if (energyRatio < 0.4) {
        const slump = (0.4 - energyRatio) * 2.2;
        ctx.translate(0, slump);
        ctx.scale(1 - slump * 0.04, 1 + slump * 0.02);
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
        const runBob = Math.sin(anim.bobPhase * 1.5) * 1.3;
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

    const ecoState = this.ecosystem?.state;
    const shouldRest = ecoState === ECOSYSTEM_STATES.RESTING ||
      this.energy < 15 ||
      this.goal?.current === 'REST';

    // Check if sleeping (low energy or resting state, and stationary)
    if (shouldRest && speed < 5) {
      anim.sleepTimer += step * (ecoState === ECOSYSTEM_STATES.RESTING ? 1.3 : 1);
      if (anim.sleepTimer > 2.0) { // Sleep after 2 seconds of low energy
        anim.state = 'sleeping';

        // Emit Zzz particles occasionally
        if (Math.random() < 0.008) { // Throttled to reduce visual spam
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
    const speedRatio = speed / Math.max(0.01, baseSpeed);
    anim.speedRatio = speedRatio;

    if (speedRatio > 0.8) {
      anim.state = 'running'; // Fast movement
    } else if (speedRatio > 0.1) {
      anim.state = 'walking'; // Normal movement
    } else {
      anim.state = 'idle'; // Stationary or very slow
    }
  }

  getBadges() { return _getBadges(this); }

  draw(ctx, opts = {}) { return _drawCreature(this, ctx, opts); }

  /**
   * Select a prepared sprite frame for this creature's current animation state.
   * @private
   */
  _getCachedSpriteFrame(worldTime = 0) { return _getCachedSpriteFrame(this, worldTime); }

  /**
   * Update the cached canvas for this creature's appearance
   * @private
   */
  _updateCachedCanvas(assetType, colorStr) { return _updateCachedCanvas(this, assetType, colorStr); }

  /**
   * Draw a small icon/indicator showing the creature's current behavior state
   * This makes AI behavior much more legible to players
   */
  _drawBehaviorState(ctx) { return _drawBehaviorState(this, ctx); }

  _drawTraits(ctx, g, hue, r) { return _drawTraits(this, ctx, g, hue, r); }
}
