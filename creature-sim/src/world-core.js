/**
 * World Core - Main World class with subsystem delegation
 * This is the clean, refactored version of the World class
 */
import { SpatialGrid } from './spatial-grid.js';
import { ScalarField } from './world-scalar-field.js';
import { WorldEnvironment } from './world-environment.js';
import { WorldEcosystem } from './world-ecosystem.js';
import { WorldCreatureManager } from './world-creature-manager.js';
import { WorldCombat } from './world-combat.js';
import { WorldDisaster } from './world-disaster.js';
import { CreatureEcosystemSystem } from './creature-ecosystem.js';
import { WorldEvents } from './world-events.js';
import { BiomeGenerator } from './perlin-noise.js';
import { SandboxProps } from './sandbox-props.js';
import { clamp, dist2, rand } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';
import { getDebugFlags } from './debug-flags.js';

export class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.t = 0; // Simulation time

    // Core spatial systems
    this.pheromone = new ScalarField(width, height, 20, 0.992, 0.18);
    this.temperature = new ScalarField(width, height, 40, 1.0, 0.0);

    // Entity collections
    this.creatures = [];
    this.food = [];
    this.corpses = [];
    this.restZones = [];
    this.nests = [];

    // Spatial grids for performance
    this.foodGrid = new SpatialGrid(36);
    this.corpseGrid = new SpatialGrid(40);
    this.restGrid = new SpatialGrid(120, width, height);
    this.nestGrid = new SpatialGrid(140, width, height);
    this.foodGridDirty = true;
    this.corpseGridDirty = true;
    this.restGridDirty = true;
    this.nestGridDirty = true;

    // External system attachments
    this.lineageTracker = null;
    this.particles = null;
    this.heatmaps = null;
    this.audio = null;

    // Initialize subsystems
    this.environment = new WorldEnvironment(this);
    this.ecosystem = new WorldEcosystem(this);
    this.creatureManager = new WorldCreatureManager(this);
    this.combat = new WorldCombat(this);
    this.disaster = new WorldDisaster(this);
    this.creatureEcosystem = new CreatureEcosystemSystem(this);
    this.sandbox = new SandboxProps(this);
    this.events = new WorldEvents(this);

    // World settings
    this.maxFood = Math.floor((width * height) / 180);
    this.gridDirty = false;

    // Biome system
    this.biomeGenerator = new BiomeGenerator(Math.random());
    this.biomeMap = this.biomeGenerator.generateBiomeMap(width, height, 50);
    this.biomeCache = new Map();

    // Visual FX helpers
    this.screenShake = 0;
    this.temperatureModifier = 1.0;
    this.bumpCheckTimer = 0;
    this.bumpIndex = 0;
    this.crowdCheckTimer = 0;
    this.lastPointerWorld = { x: width * 0.5, y: height * 0.5 };
    this.regionUpdateTimer = 0;
    this.nestUpdateTimer = 0;
    this.nestId = 1;
    this._initRegions();
    this._migrationSettleCooldowns = new Map();
    this.chaos = {
      level: 0.5,
      gravity: 0,
      bounceBoost: 1,
      wobbleBoost: 1,
      reactionBoost: 1
    };
    this.chaosBaseLevel = 0.5;
    this.chaosNudge = {
      timer: 0,
      intensity: 0,
      duration: 0
    };
    this._applyChaosLevel(this.chaosBaseLevel);
    this.eventModifiers = {
      foodGrowth: 1,
      activity: 1,
      stress: 1,
      migration: 1
    };

    // Auto-balance settings (used by gameplay-modes.js)
    this.autoBalanceSettings = {
      enabled: true,
      minPopulation: 36,
      targetPredatorRatio: 0.24,
      maxPredators: 16,
      targetFoodFraction: 0.5,
      minFoodAbsolute: 180
    };

    // Disaster settings
    this.randomDisasters = true;
    this.disasterCooldown = 40;
    this.disasterIntensity = 1.0;

    console.debug('🌍 World core initialized with subsystems');
  }

  _sanitizeSpawnPoint(x, y) {
    const safeX = Number.isFinite(x) ? x : this.width * 0.5;
    const safeY = Number.isFinite(y) ? y : this.height * 0.5;
    return {
      x: clamp(safeX, 0, this.width),
      y: clamp(safeY, 0, this.height)
    };
  }

  _recordSpawnDebug({ source, type, x, y, creature }) {
    const debugFlags = getDebugFlags();
    if (!debugFlags.spawnDebug) return;
    const previousVersion = this._debugSpawn?.version || 0;
    this._debugSpawn = {
      version: previousVersion + 1,
      source,
      type,
      x,
      y,
      creatureId: creature?.id ?? null,
      worldCount: this.creatures?.length || 0,
      time: this.t
    };
  }

  // Main simulation step
  // STABILITY: Added defensive guards
  step(dt) {
    // STABILITY: Validate dt
    if (typeof dt !== 'number' || !isFinite(dt) || dt < 0) {
      dt = 1 / 60; // Fallback to 60fps timestep
    }

    this.t += dt;

    // Update environmental systems (with guards)
    try {
      this.environment?.update(dt);
      this.events?.update(dt);
      this.ecosystem?.update(dt);
      this.creatureEcosystem?.update(dt);
      this.updateChaosNudge(dt);
      this.disaster?.update(dt);
      this.sandbox?.update(dt);

      // Update scalar fields
      this.pheromone?.step();
      this.temperature?.step();

      // Update creatures
      this.updateCreatures(dt);

      // Soft bump interactions (throttled for performance)
      this.bumpCheckTimer += dt;
      if (this.bumpCheckTimer >= 0.2) {
        this.bumpCheckTimer = 0;
        this.applyCreatureBumps();
      }

      this.crowdCheckTimer += dt;
      if (this.crowdCheckTimer >= 0.6) {
        this.crowdCheckTimer = 0;
        this.applyCrowdJitter();
      }

      this.nestUpdateTimer += dt;
      if (this.nestUpdateTimer >= 0.7) {
        this.nestUpdateTimer = 0;
        this.updateNests();
      }

      this.regionUpdateTimer += dt;
      if (this.regionUpdateTimer >= CreatureAgentTuning.TERRITORY.UPDATE_INTERVAL) {
        this.regionUpdateTimer = 0;
        this.updateRegions();
      }

      // Update corpse system
      this.updateCorpses(dt);

      // Update food growth
      this.updateFood(dt);
    } catch (error) {
      console.error('World step error:', error);
      // Attempt to continue - individual creature errors shouldn't crash world
    }
  }

  // Update all creatures
  // STABILITY: Added per-creature error handling
  updateCreatures(dt) {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const creature = this.creatures[i];

      // STABILITY: Skip invalid creatures
      if (!creature) {
        this.creatures.splice(i, 1);
        continue;
      }

      if (!creature.alive) {
        if (!creature._deathEmitted) {
          creature._deathEmitted = true;
          try {
            eventSystem.emit(GameEvents.CREATURE_DIED, {
              creature,
              worldTime: this.t,
              cause: creature.deathCause || 'unknown',
              attackerId: creature.killedBy || null
            });
          } catch (e) {
            console.warn('Failed to emit creature died event:', e);
          }
        }
        // Remove dead creatures after a delay
        if (creature.deathTime && this.t - creature.deathTime > 5) {
          this.creatures.splice(i, 1);
          this.creatureManager?.creatureGrid?.remove(creature);
        }
        continue;
      }

      // Update creature logic with error isolation
      try {
        creature.update(dt, this);
      } catch (error) {
        // STABILITY: Log error but don't crash - mark creature as dead to remove it
        console.warn(`Creature ${creature.id} update error:`, error);
        creature.alive = false;
        creature.deathTime = this.t;
      }

      // Handle creature death
      if (!creature.alive) {
        creature.deathTime = this.t;
        if (!creature._deathEmitted) {
          creature._deathEmitted = true;
          try {
            eventSystem.emit(GameEvents.CREATURE_DIED, {
              creature,
              worldTime: this.t,
              cause: creature.deathCause || 'unknown',
              attackerId: creature.killedBy || null
            });
          } catch (e) {
            console.warn('Failed to emit creature died event:', e);
          }
        }
      }
    }

    // Update spatial grid
    if (this.creatureManager) {
      this.creatureManager.gridDirty = true;
      this.creatureManager.ensureSpatial();
    }
  }

  applyCreatureBumps() {
    const creatures = this.creatures;
    if (!creatures || creatures.length < 2) return;

    const maxSamples = Math.min(14, creatures.length);
    const bumpRadius = 22;
    const bumpRadiusSq = bumpRadius * bumpRadius;

    for (let i = 0; i < maxSamples; i++) {
      const idx = this.bumpIndex % creatures.length;
      this.bumpIndex += 1;
      const a = creatures[idx];
      if (!a || !a.alive || a.isGrabbed) continue;

      for (let j = 0; j < creatures.length; j++) {
        if (j === idx) continue;
        const b = creatures[j];
        if (!b || !b.alive || b.isGrabbed) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > bumpRadiusSq || distSq < 1) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const exaggerate = Math.random() < 0.25 ? 1.4 : 1;
        const force = 90 * exaggerate;
        a.applyImpulse?.(-nx * force, -ny * force, { decay: 7, cap: 220 });
        b.applyImpulse?.(nx * force, ny * force, { decay: 7, cap: 220 });
        a.reactToCollision?.(0.45);
        b.reactToCollision?.(0.45);
        eventSystem.emit(GameEvents.CREATURE_BUMPED, { aId: a.id, bId: b.id });
        break;
      }
    }
  }

  applyCrowdJitter() {
    const creatures = this.creatures;
    if (!creatures || creatures.length < 5) return;
    const samples = Math.min(6, creatures.length);
    for (let i = 0; i < samples; i++) {
      const idx = Math.floor(Math.random() * creatures.length);
      const creature = creatures[idx];
      if (!creature || !creature.alive || creature.isGrabbed) continue;
      const nearby = this.creatureManager?.queryCreatures?.(creature.x, creature.y, 48) || [];
      if (nearby.length < 4) continue;
      const angle = Math.random() * Math.PI * 2;
      const shove = 35 + Math.random() * 25;
      creature.applyImpulse?.(Math.cos(angle) * shove, Math.sin(angle) * shove, { decay: 8, cap: 180 });
      creature._triggerReaction?.('fall', 0.35, 0.2);
      creature.setMood?.('😵', 0.4);
    }
  }

  // Update food system
  updateFood(dt) {
    const growthRate = this.ecosystem.foodGrowthRate();

    // Patch-based food growth handled by ecosystem
    this.ecosystem.updateFoodPatches?.(dt);

    // Baseline food growth safety net
    const minReserve = this.ecosystem.minFoodReserve ?? Math.max(40, Math.round(this.maxFood * 0.2));
    if (this.food.length < minReserve && Math.random() < dt * growthRate * 0.4) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.ecosystem.addFood(x, y);
    }

    // Update food timers
    for (const food of this.food) {
      food.t += dt;
    }

    if (this.foodGridDirty && this.foodGrid?.buildIndex) {
      this.foodGrid.buildIndex();
      this.foodGridDirty = false;
    }
  }

  // Update corpse system
  updateCorpses(dt) {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const corpse = this.corpses[i];
      corpse.decayTimer -= dt;

      if (corpse.decayTimer <= 0) {
        this.corpses.splice(i, 1);
        this.corpseGrid?.remove(corpse);
        this.corpseGridDirty = true;
      }
    }

    if (this.corpseGridDirty && this.corpseGrid?.buildIndex) {
      this.corpseGrid.buildIndex();
      this.corpseGridDirty = false;
    }
  }

  // Seed initial world state with diverse creature types
  seed(nHerb = 60, nPred = 6, nFood = 180) {
    // Clear existing state
    this.reset();

    // Calculate diverse creature distribution.
    // Non-predator pool now includes herbivores, omnivores, and aquatic scavengers.
    const nAquatic = Math.max(1, Math.floor(nHerb * 0.12));
    const remainingLand = Math.max(0, nHerb - nAquatic);
    const nOmnivores = Math.floor(remainingLand * 0.35);
    const nPureHerbivores = Math.max(0, remainingLand - nOmnivores);

    // Spawn pure herbivores in clusters (natural herding)
    const herbivoreClusterCount = Math.max(3, Math.floor(nPureHerbivores / 12));
    for (let cluster = 0; cluster < herbivoreClusterCount; cluster++) {
      const clusterX = Math.random() * this.width;
      const clusterY = Math.random() * this.height;
      const clusterSize = Math.floor(nPureHerbivores / herbivoreClusterCount);

      for (let i = 0; i < clusterSize; i++) {
        const offsetX = (Math.random() - 0.5) * 200;
        const offsetY = (Math.random() - 0.5) * 200;
        const x = clamp(clusterX + offsetX, 50, this.width - 50);
        const y = clamp(clusterY + offsetY, 50, this.height - 50);
        this.creatureManager.spawnManual(x, y, false); // Herbivore
      }
    }

    // Spawn omnivores scattered (more solitary)
    for (let i = 0; i < nOmnivores; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.creatureManager.spawnOmnivore(x, y);
    }

    // Spawn aquatic scavengers near wetland/water-biased regions.
    for (let i = 0; i < nAquatic; i++) {
      const spot = this.findBiomeSpot('wetland', 8);
      const x = clamp(spot.x + rand(-80, 80), 30, this.width - 30);
      const y = clamp(spot.y + rand(-80, 80), 30, this.height - 30);
      this.creatureManager.spawnAquatic(x, y);
    }

    // Spawn predators strategically (not too close to start)
    for (let i = 0; i < nPred; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.creatureManager.spawnManual(x, y, true); // Predator
    }

    // Spawn food in patches (more realistic distribution)
    const foodPatchCount = Math.max(8, Math.floor(nFood / 25));
    for (let patch = 0; patch < foodPatchCount; patch++) {
      const patchX = Math.random() * this.width;
      const patchY = Math.random() * this.height;
      const patchSize = Math.floor(nFood / foodPatchCount);

      for (let i = 0; i < patchSize; i++) {
        const offsetX = (Math.random() - 0.5) * 120;
        const offsetY = (Math.random() - 0.5) * 120;
        const x = clamp(patchX + offsetX, 0, this.width);
        const y = clamp(patchY + offsetY, 0, this.height);
        this.ecosystem.addFood(x, y);
      }
    }

    console.log(`🌱 Seeded diverse world: ${nPureHerbivores} herbivores, ${nOmnivores} omnivores, ${nAquatic} aquatic, ${nPred} predators, ${nFood} food`);
  }

  // Reset world to empty state
  reset() {
    this.creatures = [];
    this.food = [];
    this.corpses = [];
    this.restZones = [];
    this.nests = [];
    this.t = 0;

    // Reset subsystems
    this.environment.initialize();
    this.ecosystem.initialize();
    this.creatureManager.initialize();
    this.combat.initialize();
    this.disaster.initialize();
    this.sandbox?.clear();
    this.chaosNudge = { timer: 0, intensity: 0, duration: 0 };
    this._applyChaosLevel(this.chaosBaseLevel);
    this.events?.resetModifiers();
    if (this.events) {
      this.events.activeEvent = null;
      this.events.cooldown = 30;
    }

    // Clear scalar fields
    this.pheromone.grid.fill(0);
    this.temperature.grid.fill(0.5);

    // Clear spatial grids
    this.creatureManager.creatureGrid.clear();
    this.foodGrid.clear();
    this.corpseGrid?.clear();
    this.nestGrid?.clear();
    this.foodGridDirty = true;
    this.corpseGridDirty = true;
    this.nestGridDirty = true;
    this.nestId = 1;
    this._initRegions();
    this._migrationSettleCooldowns?.clear();

    console.debug('🔄 World reset to initial state');
  }

  // Attach external systems
  attachLineageTracker(tracker) {
    this.lineageTracker = tracker;
    this.creatureManager.attachLineageTracker(tracker);
  }

  attachParticleSystem(particles) {
    this.particles = particles;
  }

  attachHeatmapSystem(heatmaps) {
    this.heatmaps = heatmaps;
  }

  attachAudioSystem(audio) {
    this.audio = audio;
  }

  attachNotificationSystem(notifications) {
    this.notificationSystem = notifications;
  }

  attachProceduralSounds(proceduralSounds) {
    this.proceduralSounds = proceduralSounds;
  }

  attachUnlockableAchievements(unlockableAchievements) {
    this.unlockableAchievements = unlockableAchievements;
  }

  attachFamilyBonds(familyBonds) {
    this.familyBonds = familyBonds;
  }

  attachMemoryLearning(memoryLearning) {
    this.memoryLearning = memoryLearning;
  }

  setChaosLevel(level = 0.5) {
    const safeLevel = clamp(level, 0, 1);
    this.chaosBaseLevel = safeLevel;
    this._applyChaosLevel(this.chaosBaseLevel + (this.chaosNudge?.intensity || 0));
  }

  _applyChaosLevel(level = 0.5) {
    const safeLevel = clamp(level, 0, 1);
    this.chaos.level = safeLevel;
    const offset = safeLevel - 0.5;
    this.chaos.gravity = offset * 18;
    this.chaos.bounceBoost = clamp(1 + offset * 0.6, 0.7, 1.35);
    this.chaos.wobbleBoost = clamp(1 + offset * 0.8, 0.6, 1.5);
    this.chaos.reactionBoost = clamp(1 + offset * 0.7, 0.65, 1.4);
  }

  updateChaosNudge(dt) {
    if (!this.chaosNudge || this.chaosNudge.timer <= 0) return;
    this.chaosNudge.timer = Math.max(0, this.chaosNudge.timer - dt);
    const fade = this.chaosNudge.duration > 0 ? this.chaosNudge.timer / this.chaosNudge.duration : 0;
    this._applyChaosLevel(this.chaosBaseLevel + this.chaosNudge.intensity * fade);
    if (this.chaosNudge.timer <= 0) {
      this.chaosNudge.intensity = 0;
      this._applyChaosLevel(this.chaosBaseLevel);
    }
  }

  triggerChaosNudge(intensity = 0.25, duration = 6) {
    const safeIntensity = clamp(intensity, 0.05, 0.6);
    const safeDuration = clamp(duration, 2, 12);
    this.chaosNudge = {
      intensity: safeIntensity,
      duration: safeDuration,
      timer: safeDuration
    };
    this._applyChaosLevel(this.chaosBaseLevel + safeIntensity);
  }

  // Query methods
  getCreatureById(id) {
    return this.creatureManager.getCreatureById(id);
  }

  getAnyCreatureById(id) {
    return this.creatureManager.getAnyCreatureById(id);
  }

  addCreature(creature, parentId = null) {
    return this.creatureManager.addCreature(creature, parentId);
  }

  cloneCreature(creature) {
    return this.creatureManager.cloneCreature(creature);
  }

  spawnChild(parent1, parent2 = null) {
    return this.creatureManager.spawnChild(parent1, parent2);
  }

  spawnManual(x, y, predator = false) {
    const debugFlags = getDebugFlags();
    const sanitized = this._sanitizeSpawnPoint(x, y);
    if (debugFlags.spawnDebug) {
      console.log('[Spawn][world] manual:start', {
        predator,
        x: Number(sanitized.x.toFixed(2)),
        y: Number(sanitized.y.toFixed(2))
      });
    }
    const creature = this.creatureManager.spawnManual(sanitized.x, sanitized.y, predator);
    if (debugFlags.spawnDebug) {
      console.log('[Spawn][world] manual:end', {
        id: creature?.id ?? null,
        worldCount: this.creatures.length
      });
    }
    this._recordSpawnDebug({ source: 'manual', type: predator ? 'predator' : 'herbivore', x: sanitized.x, y: sanitized.y, creature });
    return creature;
  }

  spawnManualWithGenes(x, y, genes) {
    const debugFlags = getDebugFlags();
    const sanitized = this._sanitizeSpawnPoint(x, y);
    if (debugFlags.spawnDebug) {
      console.log('[Spawn][world] genes:start', {
        x: Number(sanitized.x.toFixed(2)),
        y: Number(sanitized.y.toFixed(2)),
        hasGenes: Boolean(genes)
      });
    }
    const creature = this.creatureManager.spawnManualWithGenes(sanitized.x, sanitized.y, genes);
    if (debugFlags.spawnDebug) {
      console.log('[Spawn][world] genes:end', {
        id: creature?.id ?? null,
        worldCount: this.creatures.length
      });
    }
    this._recordSpawnDebug({ source: 'genes', type: 'custom', x: sanitized.x, y: sanitized.y, creature });
    return creature;
  }

  /**
   * Spawn a creature of a specific type at the given coordinates.
   * Supports herbivores, predators, omnivores, and aquatic while clamping to world bounds.
   */
  spawnCreatureType(type = 'herbivore', x = this.width * 0.5, y = this.height * 0.5) {
    const debugFlags = getDebugFlags();
    const sanitized = this._sanitizeSpawnPoint(x, y);
    if (debugFlags.spawnDebug) {
      console.log('[Spawn][world] type:start', {
        type,
        x: Number(sanitized.x.toFixed(2)),
        y: Number(sanitized.y.toFixed(2))
      });
    }

    switch (type) {
      case 'predator':
        const predator = this.creatureManager.spawnManual(sanitized.x, sanitized.y, true);
        if (debugFlags.spawnDebug) {
          console.log('[Spawn][world] type:end', { id: predator?.id ?? null, worldCount: this.creatures.length });
        }
        this._recordSpawnDebug({ source: 'type', type, x: sanitized.x, y: sanitized.y, creature: predator });
        return predator;
      case 'omnivore':
        const omnivore = this.creatureManager.spawnOmnivore(sanitized.x, sanitized.y);
        if (debugFlags.spawnDebug) {
          console.log('[Spawn][world] type:end', { id: omnivore?.id ?? null, worldCount: this.creatures.length });
        }
        this._recordSpawnDebug({ source: 'type', type, x: sanitized.x, y: sanitized.y, creature: omnivore });
        return omnivore;
      case 'aquatic':
        const aquatic = this.creatureManager.spawnAquatic(sanitized.x, sanitized.y);
        if (debugFlags.spawnDebug) {
          console.log('[Spawn][world] type:end', { id: aquatic?.id ?? null, worldCount: this.creatures.length });
        }
        this._recordSpawnDebug({ source: 'type', type, x: sanitized.x, y: sanitized.y, creature: aquatic });
        return aquatic;
      case 'herbivore':
      default:
        const herbivore = this.creatureManager.spawnManual(sanitized.x, sanitized.y, false);
        if (debugFlags.spawnDebug) {
          console.log('[Spawn][world] type:end', { id: herbivore?.id ?? null, worldCount: this.creatures.length });
        }
        this._recordSpawnDebug({ source: 'type', type: 'herbivore', x: sanitized.x, y: sanitized.y, creature: herbivore });
        return herbivore;
    }
  }

  queryCreatures(x, y, radius) {
    return this.creatureManager.queryCreatures(x, y, radius);
  }

  getActiveEvents() {
    return this.events?.activeEvent ? [this.events.activeEvent] : [];
  }

  // Food helpers (proxy to ecosystem)
  addFood(x, y, r = 1.5, type = null) {
    return this.ecosystem.addFood(x, y, r, type);
  }

  nearbyFood(x, y, radius) {
    return this.ecosystem.nearbyFood(x, y, radius);
  }

  tryEatFoodAt(x, y, reach = 8, biteSize = 1) {
    return this.ecosystem.tryEatFoodAt(x, y, reach, biteSize);
  }

  // Combat helpers (proxy to combat subsystem)
  findPrey(predator, radius = 120) {
    return this.combat.findPrey(predator, radius);
  }

  tryPredation(predator) {
    return this.combat.tryPredation(predator);
  }

  registerPredatorSignal(x, y, strength = 1, ttl = 5, sourceId = null) {
    return this.combat.registerPredatorSignal(x, y, strength, ttl, sourceId);
  }

  samplePredatorSignal(x, y, radius = 140, excludeSource = null) {
    return this.combat.samplePredatorSignal(x, y, radius, excludeSource);
  }

  dropPheromone(x, y, val = 1.0) {
    return this.combat.dropPheromone(x, y, val);
  }

  // Corpse helpers (lightweight fallback until a dedicated system is added)
  findNearbyCorpse(x, y, radius) {
    const source = this.corpseGrid?.nearby ? this.corpseGrid.nearby(x, y, radius) : this.corpses;
    if (!source || source.length === 0) return null;

    let best = null;
    let bestD2 = radius * radius;
    for (const corpse of source) {
      if (!corpse || corpse.energy !== undefined && corpse.energy < 0.5) continue;
      const d2 = dist2(corpse.x, corpse.y, x, y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = corpse;
      }
    }
    return best;
  }

  tryEatCorpse(scavenger, corpse) {
    if (!corpse || (corpse.energy !== undefined && corpse.energy < 0.5)) return false;

    const eatAmount = Math.min(corpse.energy ?? 0, 8);
    if (eatAmount <= 0) return false;

    if (corpse.energy !== undefined) {
      corpse.energy -= eatAmount;
    }
    scavenger.energy += eatAmount;

    if (this.audio && this.audio.ctx && scavenger) {
      try {
        this.audio.playCreatureSound(scavenger, 'eat');
      } catch (_) {
        // Non-critical
      }
    }

    if (scavenger.stats) scavenger.stats.food++;
    scavenger.logEvent?.('Scavenged corpse', this.t);
    scavenger.rememberLocation?.(corpse.x, corpse.y, 'food', 0.7, this.t);

    if (corpse.energy !== undefined && corpse.energy < 0.5) {
      const idx = this.corpses.indexOf(corpse);
      if (idx >= 0) {
        this.corpses.splice(idx, 1);
        this.corpseGrid?.remove?.(corpse);
        this.corpseGridDirty = true;
      }
    }

    return { energy: eatAmount, corpse };
  }

  _initRegions() {
    const size = CreatureAgentTuning.TERRITORY.REGION_SIZE;
    this.regionSize = size;
    this.regionCols = Math.max(1, Math.ceil(this.width / size));
    this.regionRows = Math.max(1, Math.ceil(this.height / size));
    this.regions = new Array(this.regionCols * this.regionRows);

    for (let row = 0; row < this.regionRows; row++) {
      for (let col = 0; col < this.regionCols; col++) {
        const id = row * this.regionCols + col;
        const x1 = col * size;
        const y1 = row * size;
        const x2 = Math.min(this.width, x1 + size);
        const y2 = Math.min(this.height, y1 + size);
        this.regions[id] = {
          id,
          col,
          row,
          x: x1 + (x2 - x1) * 0.5,
          y: y1 + (y2 - y1) * 0.5,
          size,
          bounds: { x1, y1, x2, y2 },
          population: 0,
          stressAvg: 0,
          pressure: 0,
          comfort: 1,
          foodRatio: 0.5,
          nestCount: 0,
          nestComfort: 0,
          lastDepletedAt: -Infinity,
          lastThrivingAt: -Infinity
        };
      }
    }
  }

  getRegionId(x, y) {
    const size = this.regionSize || CreatureAgentTuning.TERRITORY.REGION_SIZE;
    const col = clamp(Math.floor(x / size), 0, this.regionCols - 1);
    const row = clamp(Math.floor(y / size), 0, this.regionRows - 1);
    return row * this.regionCols + col;
  }

  getRegionAt(x, y) {
    if (!this.regions) return null;
    const id = this.getRegionId(x, y);
    return this.regions[id] || null;
  }

  getRegionById(id) {
    if (!this.regions) return null;
    return this.regions[id] || null;
  }

  updateRegions() {
    if (!this.regions?.length) return;
    const regions = this.regions;
    const now = this.t ?? 0;
    const pressureStart = CreatureAgentTuning.TERRITORY.PRESSURE_START;
    const pressureRange = CreatureAgentTuning.TERRITORY.PRESSURE_RANGE;
    const pressureMax = CreatureAgentTuning.TERRITORY.PRESSURE_MAX;

    for (const region of regions) {
      region.population = 0;
      region.stressAvg = 0;
      region.pressure = 0;
      region.comfort = 1;
      region.foodRatio = 0.5;
      region.foodStock = 0;
      region.foodMax = 0;
      region.nestCount = 0;
      region.nestComfort = 0;
    }

    for (const creature of this.creatures) {
      if (!creature || !creature.alive) continue;
      const regionId = this.getRegionId(creature.x, creature.y);
      const region = regions[regionId];
      if (!region) continue;
      region.population += 1;
      region.stressAvg += creature.needs?.stress ?? 0;
    }

    const patches = this.ecosystem?.foodPatches || [];
    for (const patch of patches) {
      if (!patch) continue;
      const regionId = this.getRegionId(patch.x, patch.y);
      const region = regions[regionId];
      if (!region) continue;
      region.foodStock += patch.stock ?? 0;
      region.foodMax += patch.maxStock ?? 0;
    }

    for (const nest of this.nests) {
      if (!nest) continue;
      nest.regionId = this.getRegionId(nest.x, nest.y);
      const region = regions[nest.regionId];
      if (!region) continue;
      region.nestCount += 1;
      region.nestComfort += nest.comfortEffective ?? nest.comfort ?? CreatureAgentTuning.NESTS.COMFORT;
    }

    for (const region of regions) {
      const pop = region.population;
      region.stressAvg = pop > 0 ? region.stressAvg / pop : 0;
      const pressure = clamp((pop - pressureStart) / pressureRange, 0, 1);
      region.pressure = pressure * pressureMax;
      region.comfort = clamp(1 - region.pressure * CreatureAgentTuning.TERRITORY.COMFORT_DROP, 0.5, 1);
      region.foodRatio = region.foodMax > 0 ? clamp(region.foodStock / region.foodMax, 0, 1) : 0.5;
      region.nestComfort = region.nestCount > 0 ? region.nestComfort / region.nestCount : 0;

      if (region.foodRatio <= CreatureAgentTuning.TERRITORY.FOOD_DEPLETION_THRESHOLD) {
        if (now - (region.lastDepletedAt ?? -Infinity) > CreatureAgentTuning.TERRITORY.EVENT_COOLDOWN) {
          region.lastDepletedAt = now;
          eventSystem.emit(GameEvents.WORLD_REGION_DEPLETED, {
            regionId: region.id,
            x: region.x,
            y: region.y,
            worldTime: now
          });
        }
      }
      if (region.foodRatio >= CreatureAgentTuning.TERRITORY.FOOD_THRIVE_THRESHOLD) {
        if (now - (region.lastThrivingAt ?? -Infinity) > CreatureAgentTuning.TERRITORY.EVENT_COOLDOWN) {
          region.lastThrivingAt = now;
          eventSystem.emit(GameEvents.WORLD_REGION_THRIVING, {
            regionId: region.id,
            x: region.x,
            y: region.y,
            worldTime: now
          });
        }
      }
    }
  }

  addNest(x, y, options = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const nest = {
      id: options.id ?? `nest-${this.nestId++}`,
      x: clamp(x, 0, this.width),
      y: clamp(y, 0, this.height),
      radius: options.radius ?? CreatureAgentTuning.NESTS.RADIUS,
      capacity: options.capacity ?? CreatureAgentTuning.NESTS.CAPACITY,
      comfort: options.comfort ?? CreatureAgentTuning.NESTS.COMFORT,
      comfortEffective: options.comfort ?? CreatureAgentTuning.NESTS.COMFORT,
      occupancy: 0,
      overcrowded: false,
      createdAt: this.t ?? 0,
      createdBy: options.createdBy ?? null,
      regionId: this.getRegionId(x, y),
      lastOvercrowdedAt: -Infinity
    };

    this.nests.push(nest);
    this.nestGridDirty = true;
    eventSystem.emit(GameEvents.NEST_ESTABLISHED, {
      nest,
      x: nest.x,
      y: nest.y,
      worldTime: this.t ?? 0
    });
    return nest;
  }

  getNestById(id) {
    if (!id) return null;
    return this.nests.find(nest => nest.id === id) || null;
  }

  getNearestNest(x, y, radius = CreatureAgentTuning.NESTS.DETECT_RADIUS) {
    const source = this.nestGrid?.nearby ? this.nestGrid.nearby(x, y, radius) : this.nests;
    if (!source || source.length === 0) return null;

    let best = null;
    let bestD2 = radius * radius;
    for (const nest of source) {
      if (!nest) continue;
      const d2 = dist2(x, y, nest.x, nest.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = nest;
      }
    }
    return best;
  }

  updateNests() {
    if (!this.nests?.length) return;
    const manager = this.creatureManager;
    const now = this.t ?? 0;
    const overcrowdCooldown = CreatureAgentTuning.TERRITORY.EVENT_COOLDOWN;

    for (const nest of this.nests) {
      if (!nest) continue;
      const crowd = manager?.queryCreaturesFast
        ? manager.queryCreaturesFast(nest.x, nest.y, nest.radius)
        : manager?.queryCreatures?.(nest.x, nest.y, nest.radius) || [];
      const occupancy = crowd.filter(c => c?.alive).length;
      nest.occupancy = occupancy;
      const over = occupancy - nest.capacity;
      const overcrowded = over > 0;
      nest.overcrowded = overcrowded;
      const crowdRatio = overcrowded ? over / Math.max(1, nest.capacity) : 0;
      nest.comfortEffective = clamp(
        nest.comfort * (1 - crowdRatio * CreatureAgentTuning.NESTS.OVERCROWD_PENALTY),
        0.2,
        1
      );

      if (overcrowded && now - (nest.lastOvercrowdedAt ?? -Infinity) > overcrowdCooldown) {
        nest.lastOvercrowdedAt = now;
        eventSystem.emit(GameEvents.NEST_OVERCROWDED, {
          nest,
          x: nest.x,
          y: nest.y,
          count: occupancy,
          worldTime: now
        });
      }
    }
  }

  registerMigrationSettled(creature, region) {
    const now = this.t ?? 0;
    const regionId = region?.id ?? this.getRegionId(creature.x, creature.y);
    const last = this._migrationSettleCooldowns.get(regionId) ?? -Infinity;
    if (now - last < CreatureAgentTuning.TERRITORY.EVENT_COOLDOWN) return;
    this._migrationSettleCooldowns.set(regionId, now);
    eventSystem.emit(GameEvents.WORLD_MIGRATION_SETTLED, {
      regionId,
      x: creature.x,
      y: creature.y,
      worldTime: now
    });
  }

  // Biome helpers
  getBiomeAt(x, y) {
    const cacheKey = `${Math.floor(x / 50)},${Math.floor(y / 50)}`;
    if (this.biomeCache.has(cacheKey)) {
      return this.biomeCache.get(cacheKey);
    }
    const biome = this.biomeGenerator.getBiomeAt(x, y, this.width, this.height);
    this.biomeCache.set(cacheKey, biome);
    return biome;
  }

  getBiomeIndexAt(x, y) {
    const biome = this.getBiomeAt(x, y);
    const typeMap = { forest: 0, grassland: 1, desert: 2, mountain: 3, wetland: 4, meadow: 5 };
    return typeMap[biome?.type] ?? 1;
  }

  findBiomeSpot(targetType, attempts = 12) {
    let fallback = null;
    for (let i = 0; i < attempts; i++) {
      const x = rand(0, this.width);
      const y = rand(0, this.height);
      const biome = this.getBiomeAt(x, y);
      if (!biome) continue;
      if (biome.type === targetType) {
        return { x, y };
      }
      if (!fallback || (biome.moisture ?? 0) > fallback.score) {
        fallback = { x, y, score: biome.moisture ?? 0 };
      }
    }
    if (fallback) {
      return { x: fallback.x, y: fallback.y };
    }
    return { x: this.width * 0.5, y: this.height * 0.5 };
  }

  // Environment helpers
  tempPenaltyAt(x, y) {
    return this.environment.tempPenaltyAt(x, y);
  }

  getSeasonModifier(kind) {
    return this.environment.getSeasonModifier(kind);
  }

  getSeasonInfo() {
    return this.environment.getSeasonInfo();
  }

  getWeatherState() {
    return this.environment.getWeatherState();
  }

  get timeOfDay() {
    return this.environment.timeOfDay;
  }

  get dayLength() {
    return this.environment.dayLength;
  }

  set dayLength(value) {
    if (this.environment) {
      this.environment.dayLength = value;
    }
  }

  get dayNightEnabled() {
    return this.environment.dayNightEnabled;
  }

  set dayNightEnabled(value) {
    if (this.environment) {
      this.environment.dayNightEnabled = value;
    }
  }

  get dayNightState() {
    return this.environment.getDayNightState();
  }

  get moodState() {
    return this.environment.getMoodState();
  }

  get seasonPhase() {
    return this.environment.seasonPhase;
  }

  get seasonSpeed() {
    return this.environment.seasonSpeed;
  }

  set seasonSpeed(value) {
    if (this.environment) {
      this.environment.seasonSpeed = value;
    }
  }

  get currentSeason() {
    return this.environment.currentSeason;
  }

  get foodGrowthMultiplier() {
    return this.ecosystem.foodGrowthMultiplier;
  }

  set foodGrowthMultiplier(value) {
    if (this.ecosystem) {
      this.ecosystem.foodGrowthMultiplier = value;
    }
  }

  addCalmZone(x, y, radius, duration, strength) {
    return this.environment.addCalmZone(x, y, radius, duration, strength);
  }

  // Disaster helpers
  triggerDisaster(type, options = {}) {
    return this.disaster.triggerDisaster(type, options);
  }

  getActiveDisaster() {
    return this.disaster.getActiveDisaster();
  }

  getPendingDisasters() {
    return this.disaster.getPendingDisasters();
  }

  getPendingDisastersVersion() {
    return this.disaster.pendingDisasters?.length ?? 0;
  }

  // Family tree helpers
  get childrenOf() {
    return this.creatureManager.childrenOf;
  }

  get registry() {
    return this.creatureManager.registry;
  }

  descendantsOf(rootId) {
    return this.creatureManager.descendantsOf(rootId);
  }

  buildLineageOverview(rootId, maxDepth = 6) {
    return this.creatureManager.buildLineageOverview(rootId, maxDepth);
  }

  ensureSpatial() {
    this.creatureManager.ensureSpatial();
    if (this.gridDirty && this.corpseGrid) {
      this.corpseGrid.clear();
      for (const corpse of this.corpses) {
        this.corpseGrid.add(corpse);
      }
      this.corpseGrid.buildIndex?.();
      this.gridDirty = false;
    }
    if (this.restGridDirty && this.restGrid) {
      this.restGrid.clear();
      for (const zone of this.restZones) {
        this.restGrid.add(zone);
      }
      this.restGrid.buildIndex?.();
      this.restGridDirty = false;
    }
    if (this.nestGridDirty && this.nestGrid) {
      this.nestGrid.clear();
      for (const nest of this.nests) {
        this.nestGrid.add(nest);
      }
      this.nestGrid.buildIndex?.();
      this.nestGridDirty = false;
    }
  }

  // Get ecosystem statistics
  getStats() {
    return {
      time: this.t,
      creatures: this.creatureManager.getPopulationStats(),
      food: this.food.length,
      corpses: this.corpses.length,
      environment: this.environment.getWeatherState(),
      ecosystem: this.ecosystem.getStats(),
      disaster: this.disaster.getStats()
    };
  }

  // Serialization support
  exportState() {
    return {
      width: this.width,
      height: this.height,
      time: this.t,
      creatures: this.creatures.map(c => c.export ? c.export() : null).filter(Boolean),
      food: this.food,
      corpses: this.corpses,
      restZones: this.restZones,
      nests: this.nests,
      environment: this.environment.exportState ? this.environment.exportState() : {},
      ecosystem: this.ecosystem.exportState ? this.ecosystem.exportState() : {},
      disaster: this.disaster.exportState ? this.disaster.exportState() : {}
    };
  }

  importState(snapshot) {
    if (!snapshot) return;

    this.width = snapshot.width;
    this.height = snapshot.height;
    this.t = snapshot.time || 0;

    // Import entities
    this.creatures = snapshot.creatures || [];
    this.food = snapshot.food || [];
    this.corpses = snapshot.corpses || [];
    this.restZones = snapshot.restZones || this.restZones || [];
    this.nests = snapshot.nests || [];
    let maxNestId = 0;
    for (const nest of this.nests) {
      if (!nest?.id) continue;
      const match = String(nest.id).match(/nest-(\d+)/);
      if (match) {
        maxNestId = Math.max(maxNestId, Number(match[1]));
      }
    }
    this.nestId = Math.max(this.nestId, maxNestId + 1);

    // Rebuild spatial indices
    this.creatureManager.creatureGrid.clear();
    for (const c of this.creatures) {
      if (c.alive) {
        this.creatureManager.creatureGrid.add(c);
      }
    }

    this.foodGrid.clear();
    for (const f of this.food) {
      this.foodGrid.add(f);
    }
    this.foodGrid.buildIndex?.();
    this.foodGridDirty = false;

    this.restGrid?.clear();
    for (const zone of this.restZones) {
      this.restGrid?.add(zone);
    }
    this.restGrid?.buildIndex?.();
    this.restGridDirty = false;

    this.nestGrid?.clear();
    for (const nest of this.nests) {
      this.nestGrid?.add(nest);
    }
    this.nestGrid?.buildIndex?.();
    this.nestGridDirty = false;

    // Import subsystem states
    if (this.environment.importState) {
      this.environment.importState(snapshot.environment);
    }
    if (this.ecosystem.importState) {
      this.ecosystem.importState(snapshot.ecosystem);
    }
    if (this.disaster.importState) {
      this.disaster.importState(snapshot.disaster);
    }

    // Rebuild family links
    this.creatureManager.rebuildFamilyLinks();

    console.log('📦 World state imported');
  }
}
