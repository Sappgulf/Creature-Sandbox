// Save/Load system for world state persistence
// Handles serialization, compression, and file I/O

/** @typedef {import('./types.js').SaveData} SaveData */

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
    const saveData = {
      version: '2.0',
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),

      // World state
      world: {
        width: world.width,
        height: world.height,
        t: world.t,
        seasonPhase: world.seasonPhase,
        _nextId: world.creatureManager?._nextId ?? world._nextId,

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
          diseaseTimer: world.environment.diseaseTimer
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
          health: c.health,
          maxHealth: c.maxHealth,
          alive: c.alive,
          deathTime: c.deathTime ?? null,
          deathCause: c.deathCause ?? null,
          killedBy: c.killedBy ?? null,
          genes: { ...c.genes },
          stats: { ...c.stats },
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
            targetBiome: c.migration.targetBiome,
            settled: c.migration.settled
          } : null
        })),

        // Food
        food: world.food.map(f => ({ x: f.x, y: f.y, energy: f.energy })),

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
        childrenOf: Array.from(world.childrenOf.entries()).map(([parentId, childIds]) => ({
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
  deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator) {
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

    // Create new world
    const world = new World(data.width, data.height);
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

      const seasonKey = world.environment.currentSeason || world.environment.seasonCycle?.[world.environment.seasonIndex];
      if (seasonKey && world.environment.seasonConfigs?.[seasonKey]) {
        world.environment.applySeasonConfig(world.environment.seasonConfigs[seasonKey], { announce: false });
      }
    }

    // Restore biome with same seed
    if (data.biomeSeed != null && BiomeGenerator) {
      world.biomeGenerator = new BiomeGenerator(data.biomeSeed);
      world.biomeMap = world.biomeGenerator.generateBiomeMap(data.width, data.height, 50);
    }

    if (world.sandbox?.restore) {
      world.sandbox.restore(data.sandboxProps || data.sandbox?.props || []);
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
      creature.age = toNumber(cData.age, 0);
      creature.maxHealth = toNumber(cData.maxHealth, creature.maxHealth);
      creature.health = toNumber(cData.health, creature.maxHealth);
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
      if (cData.migration && creature.migration) {
        creature.migration.lastMigration = cData.migration.lastMigration;
        creature.migration.targetBiome = cData.migration.targetBiome;
        creature.migration.settled = cData.migration.settled;
      }

      world.creatures.push(creature);
      world.registry.set(creature.id, creature);
    }

    // Restore food
    world.food = (data.food || []).map(f => ({
      x: f.x,
      y: f.y,
      energy: toNumber(f.energy, 1.0)
    }));

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
  async loadFromFile(file, World, Creature, Camera, makeGenes, BiomeGenerator) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const json = e.target.result;
          const saveData = JSON.parse(json);
          const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
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
  loadAutoSave(World, Creature, Camera, makeGenes, BiomeGenerator) {
    try {
      const json = localStorage.getItem('creature-sim-autosave');
      if (!json) return null;

      const saveData = JSON.parse(json);
      const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
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
  loadFromSlot(slotNumber, World, Creature, Camera, makeGenes, BiomeGenerator) {
    if (slotNumber < 1 || slotNumber > this.saveSlots) {
      throw new Error(`Invalid slot number: ${slotNumber}`);
    }

    const json = localStorage.getItem(`creature-sim-slot-${slotNumber}`);
    if (!json) return null;

    const saveData = JSON.parse(json);
    const result = this.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
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
    // Current version - no migration needed
    if (fromVersion === '2.0') {
      return saveData;
    }

    // Clone to avoid mutating original
    const migrated = JSON.parse(JSON.stringify(saveData));

    // Migration from 1.x to 2.0
    if (fromVersion.startsWith('1.')) {
      // Ensure world structure exists
      if (!migrated.world) {
        migrated.world = saveData;
      }

      // Add missing fields with defaults
      if (!migrated.world.timeOfDay) migrated.world.timeOfDay = 12;
      if (!migrated.world.dayLength) migrated.world.dayLength = 120;
      if (!migrated.world.corpses) migrated.world.corpses = [];

      // Ensure creatures have new fields
      if (migrated.world.creatures) {
        for (const c of migrated.world.creatures) {
          if (!c.emotions) c.emotions = null;
          if (!c.intelligence) c.intelligence = null;
          if (!c.sexuality) c.sexuality = null;
          if (!c.migration) c.migration = null;
        }
      }

      migrated.version = '2.0';
      console.log(`[SaveSystem] Migrated save from v${fromVersion} to v2.0`);
    }

    return migrated;
  }
}
