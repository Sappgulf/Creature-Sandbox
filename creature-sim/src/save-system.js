// Save/Load system for world state persistence
// Handles serialization, compression, and file I/O

/** @typedef {import('./types.js').SaveData} SaveData */

import { CreatureTuning } from './creature-tuning.js';
import { createEcosystemState } from './creature-ecosystem.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';
import { CreatureConfig } from './creature-config.js';
import { clamp, rand } from './utils.js';

export class SaveSystem {
  constructor() {
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 60; // seconds
    this.lastAutoSave = 0;
    this.saveSlots = 3;
    this._autoSaveScheduled = false;
  }

  /**
   * Serialize world state to JSON
   * @returns {SaveData}
   */
  serialize(world, camera, analytics, lineageTracker, additionalData = {}) {
    const childrenOfMap = world.childrenOf instanceof Map
      ? world.childrenOf
      : (world.creatureManager?.childrenOf instanceof Map ? world.creatureManager.childrenOf : new Map());

    const saveData = {
      version: '2.5',
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),

      // World state
      world: {
        width: world.width,
        height: world.height,
        t: world.t,
        seasonPhase: world.seasonPhase,
        _nextId: world.creatureManager?._nextId ?? world._nextId,
        chaosLevel: world.chaosBaseLevel ?? world.chaos?.level ?? 0.5,

        // Time system
        timeOfDay: world.timeOfDay ?? 12,
        dayLength: world.dayLength ?? 120,
        environment: world.environment ? {
          timeOfDay: world.environment.timeOfDay,
          dayLength: world.environment.dayLength,
          dayNightEnabled: world.environment.dayNightEnabled,
          seasonTime: world.environment.seasonTime,
          seasonDuration: world.environment.seasonDuration,
          currentSeason: world.environment.currentSeason,
          seasonIndex: world.environment.seasonIndex,
          seasonPhase: world.environment.seasonPhase,
          seasonSpeed: world.environment.seasonSpeed,
          weatherIntensity: world.environment.weatherIntensity,
          weatherType: world.environment.weatherType,
          weatherTransitionTime: world.environment.weatherTransitionTime,
          weatherTargetIntensity: world.environment.weatherTargetIntensity,
          diseaseTimer: world.environment.diseaseTimer,
          moodType: world.environment.moodType,
          moodIntensity: world.environment.moodIntensity,
          moodTimer: world.environment.moodTimer,
          moodDuration: world.environment.moodDuration,
          windAngle: world.environment.windAngle
        } : null,

        // Creatures
        creatures: world.creatures.map(c => ({
          id: c.id,
          parentId: c.parentId,
          x: c.x,
          y: c.y,
          vx: c.vx,
          vy: c.vy,
          dir: c.dir,
          energy: c.energy,
          age: c.age,
          ageStage: c.ageStage ?? null,
          lifeStage: c.lifeStage ?? null,
          health: c.health,
          maxHealth: c.maxHealth,
          alive: c.alive,
          deathTime: c.deathTime ?? null,
          deathCause: c.deathCause ?? null,
          killedBy: c.killedBy ?? null,
          genes: { ...c.genes },
          personality: c.personality ? { ...c.personality } : null,
          temperament: c.temperament ? { ...c.temperament } : null,
          quirks: Array.isArray(c.quirks) ? [...c.quirks] : [],
          stats: { ...c.stats },
          traits: c.traits ? { ...c.traits } : null,
          needs: c.needs ? { ...c.needs } : null,
          homeNestId: c.homeNestId ?? null,
          homeRegionId: c.homeRegionId ?? null,
          territoryAffinity: c.territoryAffinity ?? null,
          goal: c.goal ? {
            current: c.goal.current,
            lastChange: c.goal.lastChange,
            cooldown: c.goal.cooldown,
            mateCooldown: c.goal.mateCooldown
          } : null,
          ecosystem: c.ecosystem ? { ...c.ecosystem } : null,
          // Advanced features
          emotions: c.emotions ? { ...c.emotions } : null,
          intelligence: c.intelligence ? {
            level: c.intelligence.level,
            experiencePoints: c.intelligence.experiencePoints
          } : null,
          sexuality: c.sexuality ? {
            lastMated: c.sexuality.lastMated,
            attractiveness: c.sexuality.attractiveness
          } : null,
          migration: c.migration ? {
            lastMigration: c.migration.lastMigration,
            targetRegionId: c.migration.targetRegionId,
            target: c.migration.target ? { ...c.migration.target } : null,
            settled: c.migration.settled,
            active: c.migration.active,
            cooldownUntil: c.migration.cooldownUntil,
            recentUntil: c.migration.recentUntil
          } : null,
          memory: c.memory ? {
            capacity: c.memory.capacity,
            locations: Array.isArray(c.memory.locations)
              ? c.memory.locations.map(mem => ({
                id: mem.id ?? null,
                x: mem.x,
                y: mem.y,
                tag: mem.tag ?? mem.type ?? null,
                type: mem.type ?? mem.tag ?? null,
                strength: mem.strength,
                timestamp: mem.timestamp
              }))
              : []
          } : null
        })),

        // Food
        food: world.food.map(f => ({
          x: f.x,
          y: f.y,
          energy: f.energy,
          bites: f.bites,
          biteEnergy: f.biteEnergy,
          type: f.type,
          scentRadius: f.scentRadius,
          sourceId: f.sourceId ?? null,
          sourceTag: f.sourceTag ?? null,
          origin: f.origin ?? null
        })),
        foodPatches: world.ecosystem?.foodPatches
          ? world.ecosystem.foodPatches.map(patch => ({
            id: patch.id,
            x: patch.x,
            y: patch.y,
            radius: patch.radius,
            fertility: patch.fertility,
            maxStock: patch.maxStock,
            stock: patch.stock,
            pressure: patch.pressure,
            depletedTimer: patch.depletedTimer,
            spawnCooldown: patch.spawnCooldown,
            tag: patch.tag ?? null
          }))
          : [],
        restZones: world.restZones ? world.restZones.map(z => ({
          id: z.id,
          x: z.x,
          y: z.y,
          radius: z.radius
        })) : [],
        nests: world.nests ? world.nests.map(nest => ({
          id: nest.id,
          x: nest.x,
          y: nest.y,
          radius: nest.radius,
          capacity: nest.capacity,
          comfort: nest.comfort,
          createdAt: nest.createdAt ?? 0,
          createdBy: nest.createdBy ?? null
        })) : [],

        // Corpses
        corpses: world.corpses ? world.corpses.map(c => ({
          x: c.x,
          y: c.y,
          energy: c.energy,
          age: c.age,
          isPredator: c.isPredator
        })) : [],

        // Sandbox props
        sandboxProps: world.sandbox?.serialize?.() ?? [],

        // Lineage tracking
        childrenOf: Array.from(childrenOfMap.entries()).map(([parentId, childIds]) => ({
          parentId,
          childIds: Array.from(childIds)
        })),

        // Biome seed (for reproducibility)
        biomeSeed: world.biomeGenerator ? world.biomeGenerator.seed : Math.random(),

        // Disasters
        activeDisaster: world.disaster?.activeDisaster ?? null,
        disasterDuration: world.disaster?.activeDisaster?.duration ?? 0,
        disasterIntensity: world.disaster?.activeDisaster?.intensity ?? 1,
        disaster: world.disaster ? {
          active: world.disaster.activeDisaster ?? null,
          pending: Array.isArray(world.disaster.pendingDisasters)
            ? world.disaster.pendingDisasters.map(item => ({ ...item }))
            : [],
          cooldown: world.disaster.disasterCooldown ?? 0
        } : null,
        events: world.events ? {
          active: world.events.activeEvent ? { ...world.events.activeEvent } : null,
          cooldown: world.events.cooldown ?? 0,
          modifiers: { ...(world.eventModifiers || {}) }
        } : null
      },

      // Camera state
      camera: {
        x: camera.x,
        y: camera.y,
        zoom: camera.zoom,
        followMode: camera.followMode || 'free',
        followTarget: camera.followTarget || null,
        viewportWidth: camera.viewportWidth || 1200,
        viewportHeight: camera.viewportHeight || 800
      },

      // Analytics (condensed)
      analytics: analytics ? {
        dataPoints: analytics.data ? analytics.data.slice(-300) : [], // Last 300 points
        totalGenerations: analytics.totalGenerations || 0
      } : null,

      // Lineage names
      lineageNames: lineageTracker ? Array.from(lineageTracker.names.entries()) : [],

      // Additional metadata
      metadata: {
        populationSize: world.creatures.length,
        timeElapsed: world.t,
        generationsElapsed: Math.floor(world.t / 30), // Rough estimate
        ...additionalData
      }
    };

    return saveData;
  }

  /**
   * Deserialize JSON to world state
   * Supports migration from older save versions
   */
  deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld = null) {
    if (!saveData) {
      throw new Error('Save file is empty or corrupted');
    }

    // Handle version migration
    const version = saveData.version || '1.0';
    const migratedData = this._migrateSaveData(saveData, version);

    const data = migratedData.world;
    const toNumber = (value, fallback) => {
      if (value == null) return fallback;
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };
    const clamp01 = (value, fallback = 0.5) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return fallback;
      return Math.min(1, Math.max(0, num));
    };
    const restoreTemperament = (t) => ({
      boldness: clamp01(t?.boldness, Math.random()),
      sociability: clamp01(t?.sociability, Math.random()),
      calmness: clamp01(t?.calmness, Math.random()),
      curiosity: clamp01(t?.curiosity, Math.random())
    });
    const restorePersonality = (personalityData, fallback) => {
      if (!fallback) return fallback;
      if (!personalityData || typeof personalityData !== 'object') {
        return fallback;
      }

      return {
        ...fallback,
        packInstinct: clamp01(personalityData.packInstinct, fallback.packInstinct),
        ambushDelay: Math.max(0, toNumber(personalityData.ambushDelay, fallback.ambushDelay)),
        aggression: Math.min(2.2, Math.max(0.4, toNumber(personalityData.aggression, fallback.aggression))),
        ambushTimer: Math.max(0, toNumber(personalityData.ambushTimer, fallback.ambushTimer)),
        huntCooldown: Math.max(0, toNumber(personalityData.huntCooldown, fallback.huntCooldown)),
        lastSignalAt: toNumber(personalityData.lastSignalAt, fallback.lastSignalAt),
        currentTargetId: personalityData.currentTargetId ?? fallback.currentTargetId,
        attackCooldown: Math.max(0, toNumber(personalityData.attackCooldown, fallback.attackCooldown)),
        idleTempo: Math.min(2.5, Math.max(0.2, toNumber(personalityData.idleTempo, fallback.idleTempo))),
        idleSway: Math.min(2.5, Math.max(0.2, toNumber(personalityData.idleSway, fallback.idleSway))),
        reactivity: Math.min(2.0, Math.max(0.1, toNumber(personalityData.reactivity, fallback.reactivity))),
        playfulness: Math.min(2.0, Math.max(0.05, toNumber(personalityData.playfulness, fallback.playfulness)))
      };
    };

    // Create new world
    const canReuseWorld = !!existingWorld &&
      typeof existingWorld.reset === 'function' &&
      existingWorld.creatureManager &&
      existingWorld.registry &&
      existingWorld.width === data.width &&
      existingWorld.height === data.height;
    const world = canReuseWorld ? existingWorld : new World(data.width, data.height);
    world.width = data.width;
    world.height = data.height;
    world.reset();

    // Restore basic state
    world.t = toNumber(data.t, 0);
    const nextId = toNumber(data._nextId, 1);
    if (world.creatureManager) {
      world.creatureManager._nextId = nextId;
    } else {
      world._nextId = nextId;
    }
    if (world.environment) {
      const envData = data.environment && typeof data.environment === 'object' ? data.environment : null;
      const seasonPhaseValue = envData?.seasonPhase ?? data.seasonPhase;
      world.environment.seasonPhase = toNumber(seasonPhaseValue, world.environment.seasonPhase);
      world.environment.timeOfDay = toNumber(envData?.timeOfDay ?? data.timeOfDay, world.environment.timeOfDay);
      world.environment.dayLength = toNumber(envData?.dayLength ?? data.dayLength, world.environment.dayLength);
      if (envData?.dayNightEnabled !== undefined) {
        world.environment.dayNightEnabled = !!envData.dayNightEnabled;
      }
      world.environment.seasonTime = toNumber(envData?.seasonTime, world.environment.seasonTime);
      world.environment.seasonDuration = toNumber(envData?.seasonDuration, world.environment.seasonDuration);
      world.environment.seasonSpeed = toNumber(envData?.seasonSpeed, world.environment.seasonSpeed);
      if (envData?.seasonIndex != null) {
        world.environment.seasonIndex = toNumber(envData.seasonIndex, world.environment.seasonIndex);
      }
      if (envData?.currentSeason) {
        world.environment.currentSeason = envData.currentSeason;
        const derivedIndex = world.environment.seasonCycle?.indexOf(envData.currentSeason);
        if (derivedIndex >= 0) {
          world.environment.seasonIndex = derivedIndex;
        }
      }
      world.environment.weatherIntensity = toNumber(envData?.weatherIntensity, world.environment.weatherIntensity);
      if (envData?.weatherType !== undefined) {
        world.environment.weatherType = envData.weatherType;
      }
      world.environment.weatherTransitionTime = toNumber(envData?.weatherTransitionTime, world.environment.weatherTransitionTime);
      world.environment.weatherTargetIntensity = toNumber(envData?.weatherTargetIntensity, world.environment.weatherTargetIntensity);
      world.environment.diseaseTimer = toNumber(envData?.diseaseTimer, world.environment.diseaseTimer);
      if (envData?.moodType) {
        world.environment.moodType = envData.moodType;
      }
      world.environment.moodIntensity = toNumber(envData?.moodIntensity, world.environment.moodIntensity);
      world.environment.moodTimer = toNumber(envData?.moodTimer, world.environment.moodTimer);
      world.environment.moodDuration = toNumber(envData?.moodDuration, world.environment.moodDuration);
      world.environment.windAngle = toNumber(envData?.windAngle, world.environment.windAngle);
      world.environment.updateDayNightState?.();
      world.environment.updateAmbientMood?.(0);

      const seasonKey = world.environment.currentSeason || world.environment.seasonCycle?.[world.environment.seasonIndex];
      if (seasonKey && world.environment.seasonConfigs?.[seasonKey]) {
        world.environment.applySeasonConfig(world.environment.seasonConfigs[seasonKey], { announce: false });
      }
    }
    if (world.setChaosLevel) {
      world.setChaosLevel(toNumber(data.chaosLevel, world.chaos?.level ?? 0.5));
    }

    // Restore biome with same seed
    if (data.biomeSeed != null && BiomeGenerator) {
      world.biomeGenerator = new BiomeGenerator(data.biomeSeed);
      world.biomeMap = world.biomeGenerator.generateBiomeMap(data.width, data.height, 50);
    }

    if (world.sandbox?.restore) {
      world.sandbox.restore(data.sandboxProps || data.sandbox?.props || []);
    }
    if (world.ecosystem?.restoreFoodPatches) {
      world.ecosystem.restoreFoodPatches(data.foodPatches || []);
    }

    if (Array.isArray(data.nests) && data.nests.length > 0) {
      let maxNestId = 0;
      world.nests = data.nests.map(nest => {
        const restored = {
          id: nest.id ?? `nest-${maxNestId + 1}`,
          x: clamp(nest.x ?? rand(80, world.width - 80), 0, world.width),
          y: clamp(nest.y ?? rand(80, world.height - 80), 0, world.height),
          radius: clamp(nest.radius ?? CreatureAgentTuning.NESTS.RADIUS, 20, CreatureAgentTuning.NESTS.RADIUS * 2),
          capacity: clamp(nest.capacity ?? CreatureAgentTuning.NESTS.CAPACITY, 1, CreatureAgentTuning.NESTS.CAPACITY * 2),
          comfort: clamp(nest.comfort ?? CreatureAgentTuning.NESTS.COMFORT, 0.2, 1),
          comfortEffective: clamp(nest.comfort ?? CreatureAgentTuning.NESTS.COMFORT, 0.2, 1),
          occupancy: 0,
          overcrowded: false,
          createdAt: toNumber(nest.createdAt, world.t),
          createdBy: nest.createdBy ?? null,
          regionId: world.getRegionId?.(nest.x ?? 0, nest.y ?? 0) ?? null,
          lastOvercrowdedAt: -Infinity
        };
        const match = String(restored.id).match(/nest-(\d+)/);
        if (match) {
          maxNestId = Math.max(maxNestId, Number(match[1]));
        }
        return restored;
      });
      world.nestId = Math.max(world.nestId ?? 1, maxNestId + 1);
      world.nestGridDirty = true;
    } else {
      world.nests = [];
    }

    // Restore creatures
    world.creatures = [];
    world.registry.clear();
    for (const cData of data.creatures) {
      const creature = new Creature(cData.x, cData.y, cData.genes || makeGenes(), false);
      creature.id = cData.id;
      creature.parentId = cData.parentId || null;
      creature.vx = toNumber(cData.vx, 0);
      creature.vy = toNumber(cData.vy, 0);
      creature.dir = toNumber(cData.dir, 0);
      creature.energy = toNumber(cData.energy, 24);
      creature.age = toNumber(cData.age, CreatureAgentTuning.LIFE_STAGE.DEFAULT_AGE);
      creature._updateAgeStage?.();
      const baselineMaxHealth = (cData.genes?.predator ?? creature.genes?.predator)
        ? CreatureTuning.DEFAULT_MAX_HEALTH * 1.25
        : CreatureTuning.DEFAULT_MAX_HEALTH;
      creature.maxHealth = toNumber(cData.maxHealth, creature.maxHealth);
      creature.maxHealth = Math.max(creature.maxHealth, baselineMaxHealth);
      creature.health = toNumber(cData.health, creature.maxHealth);
      creature.health = Math.min(creature.health, creature.maxHealth);
      creature.alive = cData.alive ?? true;
      if (!creature.alive) {
        const deathTime = cData.deathTime;
        if (deathTime != null) {
          creature.deathTime = toNumber(deathTime, world.t);
        } else {
          creature.deathTime = world.t;
        }
        creature.deathCause = cData.deathCause ?? creature.deathCause;
        creature.killedBy = cData.killedBy ?? creature.killedBy ?? null;
        creature._deathEmitted = true;
      }
      creature.stats = cData.stats || { food: 0, kills: 0, births: 0, damageTaken: 0, damageDealt: 0 };
      if (cData.traits && creature.traits) {
        creature.traits.bounce = toNumber(cData.traits.bounce, creature.traits.bounce);
        creature.traits.temperament = toNumber(cData.traits.temperament, creature.traits.temperament);
        if (cData.traits.dietRole) {
          creature.traits.dietRole = cData.traits.dietRole;
        }
      }
      if (creature.needs) {
        const needsData = cData.needs || {};
        creature.needs.hunger = toNumber(needsData.hunger, creature.needs.hunger ?? CreatureAgentTuning.NEEDS.START.hunger);
        creature.needs.energy = toNumber(needsData.energy, creature.needs.energy ?? CreatureAgentTuning.NEEDS.START.energy);
        creature.needs.socialDrive = toNumber(needsData.socialDrive, creature.needs.socialDrive ?? CreatureAgentTuning.NEEDS.START.socialDrive);
        creature.needs.stress = toNumber(needsData.stress, creature.needs.stress ?? CreatureAgentTuning.NEEDS.START.stress);
        creature.needs.lastEatAt = toNumber(needsData.lastEatAt, creature.needs.lastEatAt ?? -Infinity);
      }
      if (creature.goal) {
        const goalData = cData.goal || {};
        creature.goal.current = goalData.current ?? creature.goal.current;
        creature.goal.lastChange = toNumber(goalData.lastChange, creature.goal.lastChange ?? 0);
        creature.goal.cooldown = toNumber(goalData.cooldown, creature.goal.cooldown ?? 0);
        creature.goal.mateCooldown = toNumber(goalData.mateCooldown, creature.goal.mateCooldown ?? 0);
      }
      creature.homeNestId = cData.homeNestId ?? creature.homeNestId ?? null;
      const derivedHomeRegion = world.getRegionId?.(creature.x, creature.y);
      creature.homeRegionId = cData.homeRegionId ?? derivedHomeRegion ?? creature.homeRegionId ?? null;
      creature.territoryAffinity = toNumber(
        cData.territoryAffinity,
        creature.territoryAffinity ?? 0.4
      );
      creature.temperament = restoreTemperament(cData.temperament || null);
      creature.personality = restorePersonality(cData.personality, creature.personality);
      creature.quirks = Array.isArray(cData.quirks) ? [...cData.quirks] : [];

      // Restore advanced features
      if (cData.emotions && creature.emotions) {
        Object.assign(creature.emotions, cData.emotions);
      }
      if (cData.intelligence && creature.intelligence) {
        creature.intelligence.level = cData.intelligence.level;
        creature.intelligence.experiencePoints = cData.intelligence.experiencePoints;
      }
      if (cData.sexuality && creature.sexuality) {
        creature.sexuality.lastMated = cData.sexuality.lastMated;
        creature.sexuality.attractiveness = cData.sexuality.attractiveness;
      }
      if (creature.migration) {
        const migrationData = cData.migration || {};
        creature.migration.lastMigration = toNumber(migrationData.lastMigration, creature.migration.lastMigration);
        creature.migration.targetRegionId = migrationData.targetRegionId ?? creature.migration.targetRegionId ?? null;
        creature.migration.target = migrationData.target
          ? {
            x: toNumber(migrationData.target.x, creature.x),
            y: toNumber(migrationData.target.y, creature.y)
          }
          : null;
        creature.migration.settled = migrationData.settled ?? creature.migration.settled ?? true;
        creature.migration.active = migrationData.active ?? creature.migration.active ?? false;
        creature.migration.cooldownUntil = toNumber(
          migrationData.cooldownUntil,
          creature.migration.cooldownUntil ?? -Infinity
        );
        creature.migration.recentUntil = toNumber(
          migrationData.recentUntil,
          creature.migration.recentUntil ?? -Infinity
        );
      }
      if (creature.ecosystem) {
        const ecoData = cData.ecosystem;
        if (ecoData) {
          creature.ecosystem.stress = toNumber(ecoData.stress, creature.ecosystem.stress);
          creature.ecosystem.energy = toNumber(ecoData.energy, creature.ecosystem.energy);
          creature.ecosystem.curiosity = toNumber(ecoData.curiosity, creature.ecosystem.curiosity);
          creature.ecosystem.stability = toNumber(ecoData.stability, creature.ecosystem.stability);
          creature.ecosystem.state = ecoData.state ?? creature.ecosystem.state;
        }
      }
      if (creature.memory) {
        const memoryData = cData.memory;
        creature.memory.locations = [];
        creature.memory.capacity = toNumber(memoryData?.capacity, creature.memory.capacity);
        if (memoryData?.locations && Array.isArray(memoryData.locations)) {
          for (const mem of memoryData.locations) {
            if (!mem) continue;
            creature.memory.locations.push({
              id: mem.id ?? null,
              x: toNumber(mem.x, creature.x),
              y: toNumber(mem.y, creature.y),
              tag: mem.tag ?? mem.type ?? null,
              type: mem.type ?? mem.tag ?? null,
              strength: toNumber(mem.strength, 0.4),
              timestamp: toNumber(mem.timestamp, world.t)
            });
          }
        }
        const ids = creature.memory.locations.map(mem => mem.id).filter(id => typeof id === 'number');
        creature.memory.nextId = ids.length ? Math.max(...ids) + 1 : 1;
      }

      world.creatures.push(creature);
      world.registry.set(creature.id, creature);
    }

    // Restore food
    world.food = (data.food || []).map(f => ({
      x: f.x,
      y: f.y,
      energy: toNumber(f.energy, 1.0),
      bites: toNumber(f.bites, Math.max(1, Math.round(toNumber(f.energy, 1.0) / CreatureAgentTuning.FOOD.BITE_ENERGY))),
      biteEnergy: toNumber(f.biteEnergy, CreatureAgentTuning.FOOD.BITE_ENERGY),
      type: f.type ?? 'grass',
      scentRadius: toNumber(f.scentRadius, CreatureAgentTuning.FOOD.SCENT_RADIUS),
      sourceId: f.sourceId ?? null,
      sourceTag: f.sourceTag ?? null,
      origin: f.origin ?? null,
      t: 0
    }));
    if (world.foodGrid) {
      world.foodGrid.clear();
      for (const food of world.food) {
        world.foodGrid.add(food);
      }
      world.foodGrid.buildIndex?.();
      world.foodGridDirty = false;
    }
    if (data.restZones && data.restZones.length > 0) {
      world.restZones = data.restZones.map(z => ({
        id: z.id ?? `rest-${Math.random().toString(36).slice(2, 7)}`,
        x: toNumber(z.x, 0),
        y: toNumber(z.y, 0),
        radius: toNumber(z.radius, CreatureAgentTuning.REST_ZONES.RADIUS)
      }));
    }
    if (world.restGrid) {
      world.restGrid.clear();
      for (const zone of world.restZones) {
        world.restGrid.add(zone);
      }
      world.restGrid.buildIndex?.();
      world.restGridDirty = false;
    }

    // Restore corpses
    world.corpses = (data.corpses || []).map(c => ({
      x: c.x,
      y: c.y,
      energy: toNumber(c.energy, 5),
      age: toNumber(c.age, 0),
      isPredator: c.isPredator ?? false
    }));

    // Restore lineage relationships
    world.childrenOf.clear();
    for (const entry of data.childrenOf || []) {
      world.childrenOf.set(entry.parentId, new Set(entry.childIds));
    }

    // Restore disasters
    if (world.disaster) {
      const disasterData = data.disaster && typeof data.disaster === 'object'
        ? data.disaster
        : null;
      if (disasterData) {
        world.disaster.activeDisaster = (disasterData.active && typeof disasterData.active === 'object')
          ? disasterData.active
          : null;
        world.disaster.pendingDisasters = Array.isArray(disasterData.pending)
          ? disasterData.pending.map(item => ({ ...item }))
          : [];
        world.disaster.disasterCooldown = toNumber(disasterData.cooldown, world.disaster.disasterCooldown);
        world.disaster.pendingDisasters.sort((a, b) => (a.scheduledFor || 0) - (b.scheduledFor || 0));
      } else {
        const activeDisaster = data.activeDisaster;
        world.disaster.activeDisaster = (activeDisaster && typeof activeDisaster === 'object')
          ? activeDisaster
          : null;
      }
    }

    // Restore world events
    if (world.events) {
      const eventData = data.events && typeof data.events === 'object' ? data.events : null;
      if (eventData?.active) {
        world.events.activeEvent = { ...eventData.active };
        world.eventModifiers = { ...(eventData.modifiers || world.eventModifiers) };
        world.events.cooldown = toNumber(eventData.cooldown, world.events.cooldown);
      } else {
        world.events.resetModifiers();
      }
    }

    // Mark spatial grid as dirty and force rebuild
    world.gridDirty = true;
    world.ensureSpatial(); // Immediately rebuild spatial grid for loaded creatures

    // Restore camera
    let camera = null;
    if (saveData.camera && Camera) {
      // Use actual viewport dimensions or reasonable defaults
      const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || saveData.camera.viewportWidth || 1200;
      const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || saveData.camera.viewportHeight || 800;

      camera = new Camera({
        x: saveData.camera.x,
        y: saveData.camera.y,
        zoom: saveData.camera.zoom,
        minZoom: 0.1,
        maxZoom: 3,
        worldWidth: world.width,
        worldHeight: world.height,
        viewportWidth,
        viewportHeight
      });
      camera.followMode = saveData.camera.followMode || 'free';
      camera.followTarget = saveData.camera.followTarget || null;
    }

    // Restore lineage names
    const lineageNames = new Map();
    if (saveData.lineageNames) {
      for (const [id, name] of saveData.lineageNames) {
        lineageNames.set(id, name);
      }
    }

    return {
      world,
      camera,
      lineageNames,
      metadata: saveData.metadata,
      analytics: saveData.analytics
    };
  }

  /**
   * Save to file (download)
   */
  saveToFile(world, camera, analytics, lineageTracker, filename = null) {
    const saveData = this.serialize(world, camera, analytics, lineageTracker, {
      saveName: filename || `save_${Date.now()}`
    });

    const json = JSON.stringify(saveData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || `creature-sim-${Date.now()}`) + '.crsim';
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Load from file (upload)
   */
  async loadFromFile(file, World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const json = e.target.result;
          const saveData = JSON.parse(json);
          const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld);
          resolve(result);
        } catch (err) {
          console.error('Failed to load save file:', err);
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Auto-save to localStorage
   */
  autoSave(world, camera, analytics, lineageTracker, dt) {
    if (!this.autoSaveEnabled) return;

    const delta = Number(dt);
    if (!Number.isFinite(delta) || delta <= 0) return;

    this.lastAutoSave += delta;
    if (this.lastAutoSave < this.autoSaveInterval) return;
    this.lastAutoSave = 0;
    if (this._autoSaveScheduled) return;
    this._autoSaveScheduled = true;

    const runSave = () => {
      this._autoSaveScheduled = false;
      try {
        const saveData = this.serialize(world, camera, analytics, lineageTracker, {
          isAutoSave: true
        });
        const json = JSON.stringify(saveData);
        localStorage.setItem('creature-sim-autosave', json);
      } catch (err) {
        console.warn('Auto-save failed:', err);
      }
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(runSave, { timeout: 2000 });
    } else {
      setTimeout(runSave, 0);
    }
  }

  /**
   * Load from localStorage
   */
  loadAutoSave(World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld = null) {
    try {
      const json = localStorage.getItem('creature-sim-autosave');
      if (!json) return null;

      const saveData = JSON.parse(json);
      const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld);
      return result;
    } catch (err) {
      console.error('Failed to load auto-save:', err);
      return null;
    }
  }

  /**
   * Check if auto-save exists
   */
  hasAutoSave() {
    return !!localStorage.getItem('creature-sim-autosave');
  }

  /**
   * Clear auto-save
   */
  clearAutoSave() {
    localStorage.removeItem('creature-sim-autosave');
  }

  /**
   * Save to slot (localStorage)
   */
  saveToSlot(slotNumber, world, camera, analytics, lineageTracker, name = '') {
    if (slotNumber < 1 || slotNumber > this.saveSlots) {
      throw new Error(`Invalid slot number: ${slotNumber}`);
    }

    const saveData = this.serialize(world, camera, analytics, lineageTracker, {
      slotNumber,
      saveName: name || `Save ${slotNumber}`,
      isManualSave: true
    });

    const json = JSON.stringify(saveData);
    localStorage.setItem(`creature-sim-slot-${slotNumber}`, json);
  }

  /**
   * Load from slot
   */
  loadFromSlot(slotNumber, World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld = null) {
    if (slotNumber < 1 || slotNumber > this.saveSlots) {
      throw new Error(`Invalid slot number: ${slotNumber}`);
    }

    const json = localStorage.getItem(`creature-sim-slot-${slotNumber}`);
    if (!json) return null;

    const saveData = JSON.parse(json);
    const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator, existingWorld);
    return result;
  }

  /**
   * Get all save slot info
   */
  getSaveSlots() {
    const slots = [];
    for (let i = 1; i <= this.saveSlots; i++) {
      const json = localStorage.getItem(`creature-sim-slot-${i}`);
      if (json) {
        try {
          const data = JSON.parse(json);
          slots.push({
            slot: i,
            name: data.metadata.saveName || `Save ${i}`,
            timestamp: data.timestamp,
            savedAt: data.savedAt,
            population: data.metadata.populationSize,
            timeElapsed: data.metadata.timeElapsed
          });
        } catch (err) {
          slots.push({ slot: i, error: true });
        }
      } else {
        slots.push({ slot: i, empty: true });
      }
    }
    return slots;
  }

  /**
   * Migrate save data from older versions to current version
   * @private
   */
  _migrateSaveData(saveData, fromVersion) {
    const toNumber = (value, fallback) => {
      if (value == null) return fallback;
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };
    // Current version - no migration needed
    if (fromVersion === '2.5') {
      return saveData;
    }

    // Clone to avoid mutating original
    const migrated = JSON.parse(JSON.stringify(saveData));

    const ensureMemoryDefaults = () => {
      if (migrated.world?.creatures) {
        for (const c of migrated.world.creatures) {
          if (c.age == null || !Number.isFinite(Number(c.age))) {
            c.age = CreatureAgentTuning.LIFE_STAGE.DEFAULT_AGE;
          }
          if (!c.memory) c.memory = { capacity: CreatureConfig.MEMORY.SLOTS_MIN, locations: [] };
        }
      }
    };
    const ensureTerritoryDefaults = () => {
      if (!migrated.world?.nests) migrated.world.nests = [];
      if (migrated.world?.creatures) {
        for (const c of migrated.world.creatures) {
          if (c.homeNestId === undefined) c.homeNestId = null;
          if (c.homeRegionId === undefined) c.homeRegionId = null;
          if (c.territoryAffinity === undefined) c.territoryAffinity = null;
          if (c.migration) {
            if (c.migration.targetRegionId === undefined) c.migration.targetRegionId = null;
            if (c.migration.target === undefined) c.migration.target = null;
            if (c.migration.active === undefined) c.migration.active = false;
            if (c.migration.cooldownUntil === undefined) c.migration.cooldownUntil = -Infinity;
            if (c.migration.recentUntil === undefined) c.migration.recentUntil = -Infinity;
          }
        }
      }
    };

    if (fromVersion === '2.4') {
      ensureTerritoryDefaults();
      migrated.version = '2.5';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.5`);
      return migrated;
    }

    if (fromVersion === '2.3') {
      if (!migrated.world?.foodPatches) migrated.world.foodPatches = [];
      ensureTerritoryDefaults();
      migrated.version = '2.5';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.5`);
      return migrated;
    }

    if (fromVersion === '2.2') {
      ensureMemoryDefaults();
      if (!migrated.world?.foodPatches) migrated.world.foodPatches = [];
      ensureTerritoryDefaults();
      migrated.version = '2.5';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.5`);
      return migrated;
    }

    if (fromVersion === '2.1') {
      if (migrated.world?.creatures) {
        for (const c of migrated.world.creatures) {
          if (!c.needs) c.needs = { ...CreatureAgentTuning.NEEDS.START };
          if (!c.goal) c.goal = { current: 'WANDER', lastChange: 0, cooldown: 0, mateCooldown: 0 };
        }
      }
      if (migrated.world?.food) {
        for (const food of migrated.world.food) {
          const energy = toNumber(food.energy, 1.0);
          food.bites = Math.max(1, Math.round(energy / CreatureAgentTuning.FOOD.BITE_ENERGY));
          food.biteEnergy = energy / food.bites;
          food.scentRadius = CreatureAgentTuning.FOOD.SCENT_RADIUS;
        }
      }
      if (!migrated.world?.restZones) migrated.world.restZones = [];
      ensureMemoryDefaults();
      if (!migrated.world?.foodPatches) migrated.world.foodPatches = [];
      ensureTerritoryDefaults();
      migrated.version = '2.5';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.5`);
      return migrated;
    }

    if (fromVersion === '2.0') {
      if (migrated.world?.creatures) {
        for (const c of migrated.world.creatures) {
          if (!c.ecosystem) c.ecosystem = createEcosystemState();
          if (!c.needs) c.needs = { ...CreatureAgentTuning.NEEDS.START };
          if (!c.goal) c.goal = { current: 'WANDER', lastChange: 0, cooldown: 0, mateCooldown: 0 };
        }
      }
      if (migrated.world?.food) {
        for (const food of migrated.world.food) {
          const energy = toNumber(food.energy, 1.0);
          food.bites = Math.max(1, Math.round(energy / CreatureAgentTuning.FOOD.BITE_ENERGY));
          food.biteEnergy = energy / food.bites;
          food.scentRadius = CreatureAgentTuning.FOOD.SCENT_RADIUS;
        }
      }
      if (!migrated.world?.restZones) migrated.world.restZones = [];
      ensureMemoryDefaults();
      if (!migrated.world?.foodPatches) migrated.world.foodPatches = [];
      ensureTerritoryDefaults();
      migrated.version = '2.5';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.5`);
      return migrated;
    }

    // Migration from 1.x to 2.x
    if (fromVersion.startsWith('1.')) {
      // Ensure world structure exists
      if (!migrated.world) {
        migrated.world = saveData;
      }

      // Add missing fields with defaults
      if (!migrated.world.timeOfDay) migrated.world.timeOfDay = 12;
      if (!migrated.world.dayLength) migrated.world.dayLength = 600;
      if (!migrated.world.corpses) migrated.world.corpses = [];
      if (!migrated.world.restZones) migrated.world.restZones = [];

      // Ensure creatures have new fields
      if (migrated.world.creatures) {
        for (const c of migrated.world.creatures) {
          if (!c.emotions) c.emotions = null;
          if (!c.intelligence) c.intelligence = null;
          if (!c.sexuality) c.sexuality = null;
          if (!c.migration) c.migration = null;
          if (!c.ecosystem) c.ecosystem = createEcosystemState();
          if (!c.needs) c.needs = { ...CreatureAgentTuning.NEEDS.START };
          if (!c.goal) c.goal = { current: 'WANDER', lastChange: 0, cooldown: 0, mateCooldown: 0 };
          if (!c.temperament) {
            c.temperament = {
              boldness: Math.random(),
              sociability: Math.random(),
              calmness: Math.random(),
              curiosity: Math.random()
            };
          }
          if (!Array.isArray(c.quirks)) {
            c.quirks = [];
          }
        }
      }

      if (migrated.world?.food) {
        for (const food of migrated.world.food) {
          const energy = toNumber(food.energy, 1.0);
          food.bites = Math.max(1, Math.round(energy / CreatureAgentTuning.FOOD.BITE_ENERGY));
          food.biteEnergy = energy / food.bites;
          food.scentRadius = CreatureAgentTuning.FOOD.SCENT_RADIUS;
        }
      }
      ensureMemoryDefaults();
      if (!migrated.world?.foodPatches) migrated.world.foodPatches = [];
      ensureTerritoryDefaults();
      migrated.version = '2.5';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.5`);
    }

    return migrated;
  }
}
