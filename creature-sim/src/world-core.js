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
import { BiomeGenerator } from './perlin-noise.js';
import { SandboxProps } from './sandbox-props.js';
import { clamp, dist2, rand } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';

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

    // Spatial grids for performance
    this.foodGrid = new SpatialGrid(36);
    this.corpseGrid = new SpatialGrid(40);
    this.restGrid = new SpatialGrid(120, width, height);
    this.foodGridDirty = true;
    this.corpseGridDirty = true;
    this.restGridDirty = true;

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

  // Seed initial world state
  seed(nHerb = 60, nPred = 6, nFood = 180) {
    // Clear existing state
    this.reset();

    // Spawn creatures
    for (let i = 0; i < nHerb; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.creatureManager.spawnManual(x, y, false); // Herbivore
    }

    for (let i = 0; i < nPred; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.creatureManager.spawnManual(x, y, true); // Predator
    }

    // Spawn food
    for (let i = 0; i < nFood; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      this.ecosystem.addFood(x, y);
    }

    console.log(`🌱 Seeded world: ${nHerb} herbivores, ${nPred} predators, ${nFood} food`);
  }

  // Reset world to empty state
  reset() {
    this.creatures = [];
    this.food = [];
    this.corpses = [];
    this.restZones = [];
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

    // Clear scalar fields
    this.pheromone.grid.fill(0);
    this.temperature.grid.fill(0.5);

    // Clear spatial grids
    this.creatureManager.creatureGrid.clear();
    this.foodGrid.clear();
    this.corpseGrid?.clear();
    this.foodGridDirty = true;
    this.corpseGridDirty = true;

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
    return this.creatureManager.spawnManual(x, y, predator);
  }

  spawnManualWithGenes(x, y, genes) {
    return this.creatureManager.spawnManualWithGenes(x, y, genes);
  }

  /**
   * Spawn a creature of a specific type at the given coordinates.
   * Supports herbivores, predators, and omnivores while clamping to world bounds.
   */
  spawnCreatureType(type = 'herbivore', x = this.width * 0.5, y = this.height * 0.5) {
    const clampedX = clamp(x, 0, this.width);
    const clampedY = clamp(y, 0, this.height);

    switch (type) {
      case 'predator':
        return this.creatureManager.spawnManual(clampedX, clampedY, true);
      case 'omnivore':
        return this.creatureManager.spawnOmnivore(clampedX, clampedY);
      case 'herbivore':
      default:
        return this.creatureManager.spawnManual(clampedX, clampedY, false);
    }
  }

  queryCreatures(x, y, radius) {
    return this.creatureManager.queryCreatures(x, y, radius);
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

  get dayNightEnabled() {
    return this.environment.dayNightEnabled;
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
