import { eventSystem, GameEvents } from './event-system.js';
import { unpackCreature } from './simulation-state.js';
import { BiomeGenerator } from './perlin-noise.js';

export class SimulationProxy {
  constructor(workerPath) {
    this.worker = typeof workerPath === 'function' ? new workerPath() : new Worker(workerPath, { type: 'module' });
    this.worker.onerror = e => {
      console.error('🚨 SimulationProxy: Worker Error', e.message, e.filename, e.lineno);
      this._recordWorkerError({
        message: e.message || 'Worker error',
        filename: e.filename || null,
        lineno: e.lineno ?? null
      });
      eventSystem.emit(GameEvents.ERROR_CRITICAL, { message: 'Simulation Worker Crashed: ' + e.message });
    };
    this.isReady = false;
    this.diagnostics = {
      errorCount: 0,
      snapshotCount: 0,
      lastReadyAt: null,
      lastSnapshotAt: null,
      lastWorldTime: 0,
      lastCreatureCount: 0,
      lastFoodCount: 0,
      lastError: null
    };

    this.worldSnapshot = {
      t: 0,
      width: 4000,
      height: 2800,
      creatures: [],
      food: [],
      corpses: [],
      regions: [],
      pheromone: {
        grid: new Float32Array(0),
        cell: 20,
        getAtWorld: () => 0,
        get: () => 0
      },
      temperature: {
        grid: new Float32Array(0),
        cell: 40,
        getAtWorld: () => 0,
        get: () => 0
      },
      foodGridDirty: false,
      corpseGridDirty: false,
      restGridDirty: false,
      nestGridDirty: false,
      randomDisasters: true,
      disasterCooldown: 40,
      disasterIntensity: 1.0,
      seasonSpeed: 0.015,
      dayLength: 120,
      autoBalanceSettings: {
        enabled: true,
        minPopulation: 36,
        maxPredators: 16,
        targetPredatorRatio: 0.24,
        targetFoodFraction: 0.5,
        minFoodAbsolute: 180
      },
      environment: {
        foodRateMultiplier: 1.0,
        dayPhase: 'day',
        dayLight: 1.0,
        currentSeason: 'spring',
        weatherType: null,
        weatherIntensity: 0,
        getMoodState: () => ({ type: 'neutral', intensity: 0 }),
        getDayNightState: () => ({ phase: 'day', light: 1 }),
        getSeasonInfo: () => ({ name: 'spring', progress: 0, label: 'Spring' }),
        getWeatherState: () => ({ type: null, intensity: 0, timeOfDay: 12 }),
        getBiomeAt: (x, y) => this.getBiomeAt(x, y)
      },
      ecosystem: {
        foodPatches: [],
        getBiomeAt: (x, y) => this.getBiomeAt(x, y)
      },
      creatureManager: {
        creatureGrid: {
          queryRect: (x1, y1, x2, y2) => {
            return this.worldSnapshot.creatures.filter(c => c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2);
          }
        }
      },
      foodGrid: {
        queryRect: (x1, y1, x2, y2) => {
          return this.worldSnapshot.food.filter(f => f.x >= x1 && f.x <= x2 && f.y >= y1 && f.y <= y2);
        }
      },
      corpseGrid: {
        queryRect: (x1, y1, x2, y2) => {
          return this.worldSnapshot.corpses.filter(c => c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2);
        }
      }
    };

    // NUCLEAR FIX: Define methods directly on 'this' to prevent "not a function" errors
    this.getBiomeAt = (x, y) => {
      if (!this.biomeGenerator) return { type: 'plain', color: '#4d7c0f' };
      const biome = this.biomeGenerator.getBiomeAt(x, y, this.worldSnapshot.width, this.worldSnapshot.height);
      return biome || { type: 'plain', color: '#4d7c0f' };
    };

    this.reset = () => {
      console.debug('📡 SimProxy: Reset Command Sent [v3]');
      this._send('RESET', {});
    };

    this.init = (width, height) => {
      this.worldSnapshot.width = width;
      this.worldSnapshot.height = height;
      this._send('INIT', { width, height });
    };

    this.seed = (nHerb, nPred, nFood) => {
      this._send('SEED', { nHerb, nPred, nFood });
    };

    this.step = dt => {
      this._send('STEP_AND_SYNC', { dt });
    };

    this.spawnManual = (x, y, predator) => {
      this._send('SPAWN_MANUAL', { x, y, predator });
    };

    this.pause = paused => {
      this._send('PAUSE', { paused });
    };

    this.setTimeScale = scale => {
      this._send('SET_TIME_SCALE', { scale });
    };

    this.spawnManualWithGenes = (x, y, genes) => {
      this._send('SPAWN_GENES', { x, y, genes });
      return null; // Async, cannot return object
    };

    this.spawnCreatureType = (type, x, y) => {
      this._send('SPAWN_TYPE', { type, x, y });
      return null;
    };

    this.killCreature = id => {
      this._send('KILL_CREATURE', { id });
    };

    // Alias for compatibility
    this.removeCreature = this.killCreature;

    this.addFood = (x, y, r, type) => {
      this._send('ADD_FOOD', { x, y, r, type });
      return null;
    };

    this.removeFood = id => {
      if (id) this._send('REMOVE_FOOD', { id });
    };

    // Disaster Stubs
    // Note: Worker sync requires additional message protocol - currently uses cached snapshot
    this.getActiveDisaster = () => {
      return this.worldSnapshot?.activeDisaster || null;
    };

    this.triggerDisaster = (type, options = {}) => {
      this._send('TRIGGER_DISASTER', { type, options });
    };

    // Initialize biome generator with a fixed seed if possible, or random
    this.biomeGenerator = new BiomeGenerator(0.123);

    // Cache for fields save-system.js's serialize() needs that aren't part
    // of the regular per-tick snapshot (nests, restZones, sandbox props,
    // childrenOf, _nextId). Populated on demand via requestSaveExtras().
    this._saveExtras = null;
    this._saveExtrasResolvers = [];

    const self = this;
    this._isInternalUpdate = false;

    // Worker snapshots expose creatures on the proxy root; code paths that
    // query via world.creatureManager need the same spatial helper.
    this.worldSnapshot.creatureManager.queryCreatures = (x, y, radius) => self.queryCreatures(x, y, radius);

    // Make autoBalanceSettings reactive so UI changes propagate to worker
    this.worldSnapshot.autoBalanceSettings = new Proxy(this.worldSnapshot.autoBalanceSettings, {
      set(target, prop, value) {
        if (target[prop] === value) return true;
        target[prop] = value;

        // Only send to worker if it's NOT an update coming FROM the worker
        if (!self._isInternalUpdate) {
          console.debug(`📡 SimProxy: Syncing autoBalanceSettings.${prop} = ${value}`);
          self._send('SET_PROP', { path: `autoBalanceSettings.${prop}`, value });
        }
        return true;
      }
    });

    // Make environment reactive for simple props
    this.worldSnapshot.environment = new Proxy(this.worldSnapshot.environment, {
      set(target, prop, value) {
        if (target[prop] === value) return true;
        target[prop] = value;

        // Only send to worker if it's NOT an update coming FROM the worker
        if (!self._isInternalUpdate && typeof value !== 'function') {
          console.debug(`📡 SimProxy: Syncing environment.${prop} = ${value}`);
          self._send('SET_PROP', { path: `environment.${prop}`, value });
        }
        return true;
      }
    });

    this.worker.onmessage = e => this.handleMessage(e);
    console.debug('✅ SimulationProxy [v3] Hard-Initialized');
    window.__SIM_PROXY_VERSION = '2.0.1';

    // Command queue for initial calls before ready
    this.queue = [];
  }

  handleMessage(e) {
    const { type } = e.data;

    switch (type) {
      case 'READY':
        console.debug('📡 SimProxy: Worker READY received');
        this.isReady = true;
        this.diagnostics.lastReadyAt = Date.now();
        this.queue.forEach(q => this.worker.postMessage(q));
        this.queue = [];
        break;

      case 'STATE_UPDATE':
        this.updateSnapshot(e.data);
        break;

      case 'WORLD_EXTRAS':
        this._saveExtras = e.data.data;
        if (this._saveExtras?.biomeSeed != null && this.biomeGenerator) {
          this.biomeGenerator.seed = this._saveExtras.biomeSeed;
        }
        this._saveExtrasResolvers.forEach(resolve => resolve(this._saveExtras));
        this._saveExtrasResolvers = [];
        break;

      case 'EVENT':
        eventSystem.emit(e.data.eventType, e.data.data);
        break;

      case 'ERROR':
        this._recordWorkerError(e.data.data || e.data);
        console.error('🚨 SimulationProxy: Worker reported error', e.data.data || e.data);
        break;
    }
  }

  _recordWorkerError(error) {
    this.diagnostics.errorCount += 1;
    this.diagnostics.lastError = {
      message: error?.message || String(error || 'Unknown worker error'),
      stack: error?.stack || null,
      filename: error?.filename || null,
      lineno: error?.lineno ?? null,
      at: Date.now()
    };
  }

  updateSnapshot(payload) {
    const { t, count, creatureBuffer, food, corpses, environment, activeDisaster } = payload;
    this.diagnostics.snapshotCount += 1;
    this.diagnostics.lastSnapshotAt = Date.now();
    this.diagnostics.lastWorldTime = Number(t || 0);
    this.diagnostics.lastCreatureCount = Number(count || 0);
    this.diagnostics.lastFoodCount = Array.isArray(food) ? food.length : 0;

    // Debug first few updates or if count changes
    if (Math.random() < 0.01 || count !== this.worldSnapshot.creatures.length) {
      console.debug(`📡 SimProxy: Snapshot t=${t.toFixed(2)} count=${count} buffer=${creatureBuffer.byteLength}`);
    }

    // Flag this as an internal update to prevent Proxies from echoing back to worker
    this._isInternalUpdate = true;

    try {
      this.worldSnapshot.t = t;
      this.worldSnapshot.food = food;
      this.worldSnapshot.corpses = corpses;
      this.worldSnapshot.activeDisaster = activeDisaster;

      if (environment) {
        // Update base properties
        this.worldSnapshot.dayPhase = environment.dayPhase;
        this.worldSnapshot.dayLight = environment.dayLight;
        this.worldSnapshot.currentSeason = environment.currentSeason;
        this.worldSnapshot.weatherType = environment.weatherType;
        this.worldSnapshot.moodState = environment.moodState;

        // Merge values into the EXISTING (potentially proxied) environment object
        if (this.worldSnapshot.environment) {
          const target = this.worldSnapshot.environment;
          Object.keys(environment).forEach(key => {
            if (typeof environment[key] !== 'function') {
              target[key] = environment[key];
            }
          });

          // Ensure method stubs remain
          target.getMoodState = () => environment.moodState;
          target.getDayNightState = () => ({ phase: environment.dayPhase, light: environment.dayLight });
          target.getSeasonInfo = () => ({
            name: environment.currentSeason,
            progress: environment.seasonPhase,
            label: environment.currentSeason
              ? environment.currentSeason.charAt(0).toUpperCase() + environment.currentSeason.slice(1)
              : 'Unknown'
          });
          target.getWeatherState = () => ({
            type: environment.weatherType,
            intensity: environment.weatherIntensity,
            timeOfDay: environment.timeOfDay,
            season: environment.currentSeason
          });
        }
      }

      // Unpack binary buffer into renderable objects
      const creatures = new Array(count);
      for (let i = 0; i < count; i++) {
        creatures[i] = unpackCreature(creatureBuffer, i);
      }
      this.worldSnapshot.creatures = creatures;
    } finally {
      this._isInternalUpdate = false;
    }
  }

  _send(type, data) {
    // INIT must be sent immediately to start the worker
    if (this.isReady || type === 'INIT') {
      this.worker.postMessage({ type, data });
    } else {
      this.queue.push({ type, data });
    }
  }

  // Getters to match World interface
  get t() {
    return this.worldSnapshot.t;
  }
  get width() {
    return this.worldSnapshot.width;
  }
  get height() {
    return this.worldSnapshot.height;
  }
  get creatures() {
    return this.worldSnapshot.creatures;
  }
  get food() {
    return this.worldSnapshot.food;
  }
  get corpses() {
    return this.worldSnapshot.corpses;
  }
  get pheromone() {
    return this.worldSnapshot.pheromone;
  }
  get temperature() {
    return this.worldSnapshot.temperature;
  }
  get creatureManager() {
    return this.worldSnapshot.creatureManager;
  }
  get foodGrid() {
    return this.worldSnapshot.foodGrid;
  }
  get corpseGrid() {
    return this.worldSnapshot.corpseGrid;
  }
  get ecosystem() {
    return this.worldSnapshot.ecosystem;
  }
  get foodGridDirty() {
    return this.worldSnapshot.foodGridDirty;
  }
  get corpseGridDirty() {
    return this.worldSnapshot.corpseGridDirty;
  }
  get lineageTracker() {
    return this.worldSnapshot.lineageTracker;
  }
  get particles() {
    return this.worldSnapshot.particles;
  }
  get heatmaps() {
    return this.worldSnapshot.heatmaps;
  }
  get audio() {
    return this.worldSnapshot.audio;
  }
  get notificationSystem() {
    return this.worldSnapshot.notificationSystem;
  }
  get proceduralSounds() {
    return this.worldSnapshot.proceduralSounds;
  }
  get unlockableAchievements() {
    return this.worldSnapshot.unlockableAchievements;
  }
  get familyBonds() {
    return this.worldSnapshot.familyBonds;
  }
  get memoryLearning() {
    return this.worldSnapshot.memoryLearning;
  }

  get randomDisasters() {
    return this.worldSnapshot.randomDisasters;
  }
  set randomDisasters(val) {
    this.worldSnapshot.randomDisasters = val;
    this._send('SET_PROP', { path: 'randomDisasters', value: val });
  }

  get disasterCooldown() {
    return this.worldSnapshot.disasterCooldown;
  }
  set disasterCooldown(val) {
    this.worldSnapshot.disasterCooldown = val;
    this._send('SET_PROP', { path: 'disasterCooldown', value: val });
  }

  get autoBalanceSettings() {
    return this.worldSnapshot.autoBalanceSettings;
  }
  get environment() {
    return this.worldSnapshot.environment;
  }

  get seasonSpeed() {
    return this.worldSnapshot.seasonSpeed;
  }
  set seasonSpeed(val) {
    this.worldSnapshot.seasonSpeed = val;
    this._send('SET_PROP', { path: 'seasonSpeed', value: val });
  }

  get dayLength() {
    return this.worldSnapshot.dayLength;
  }
  set dayLength(val) {
    this.worldSnapshot.dayLength = val;
    this._send('SET_PROP', { path: 'dayLength', value: val });
  }

  get dayPhase() {
    return this.worldSnapshot.dayPhase || 'day';
  }
  get dayLight() {
    return this.worldSnapshot.dayLight ?? 1;
  }
  get currentSeason() {
    return this.worldSnapshot.currentSeason || 'spring';
  }
  get moodState() {
    return this.worldSnapshot.moodState;
  }
  get weatherType() {
    return this.worldSnapshot.weatherType;
  }
  get regions() {
    return this.worldSnapshot.regions;
  }

  // Fields backed by requestSaveExtras()/prepareForSave() — see WORLD_EXTRAS
  // handler above. Safe to read before the first fetch (return empty
  // defaults matching what a fresh world would have).
  get childrenOf() {
    const entries = this._saveExtras?.childrenOf || [];
    return new Map(entries.map(entry => [entry.parentId, new Set(entry.childIds)]));
  }
  get nests() {
    return this._saveExtras?.nests || [];
  }
  get restZones() {
    return this._saveExtras?.restZones || [];
  }
  get _nextId() {
    return this._saveExtras?._nextId ?? 1;
  }
  get chaosBaseLevel() {
    return this._saveExtras?.chaosBaseLevel ?? 0.5;
  }
  get sandbox() {
    const props = this._saveExtras?.sandboxProps || [];
    return { props, serialize: () => props };
  }
  get disaster() {
    return {
      activeDisaster: this.worldSnapshot.activeDisaster ?? null,
      pendingDisasters: this._saveExtras?.disasterPending || [],
      disasterCooldown: this.worldSnapshot.disasterCooldown ?? 0
    };
  }

  /**
   * Ask the worker for the save-only fields (nests, restZones, sandbox
   * props, childrenOf, _nextId, biome seed) not included in the regular
   * per-tick snapshot, and cache them for the getters above. Must be
   * awaited before calling save-system.js's serialize() against this proxy.
   */
  requestSaveExtras() {
    return new Promise(resolve => {
      this._saveExtrasResolvers.push(resolve);
      this._send('REQUEST_WORLD_EXTRAS', {});
    });
  }

  async prepareForSave() {
    await this.requestSaveExtras();
  }

  // Search helper
  getAnyCreatureById(id) {
    return this.worldSnapshot.creatures.find(c => c.id === id);
  }

  getCreatureById(id) {
    return this.getAnyCreatureById(id);
  }

  importState(saveWorld, version = '2.0') {
    if (!saveWorld || typeof saveWorld !== 'object') return;
    this._send('IMPORT_STATE', { saveWorld, version });
  }

  queryCreatures(x, y, radius = 120) {
    const radiusSq = radius * radius;
    const creatures = this.worldSnapshot?.creatures;
    if (!Array.isArray(creatures)) return [];

    const matches = [];
    for (const creature of creatures) {
      if (!creature || creature.alive === false) continue;
      const dx = creature.x - x;
      const dy = creature.y - y;
      if (dx * dx + dy * dy <= radiusSq) {
        matches.push(creature);
      }
    }
    return matches;
  }

  getRuntimeDiagnostics() {
    const now = Date.now();
    const lastSnapshotAt = this.diagnostics.lastSnapshotAt;
    const lastReadyAt = this.diagnostics.lastReadyAt;
    return {
      ready: !!this.isReady,
      queuedCommands: this.queue?.length || 0,
      errorCount: this.diagnostics.errorCount,
      lastError: this.diagnostics.lastError,
      snapshotCount: this.diagnostics.snapshotCount,
      lastSnapshotAgeMs: lastSnapshotAt ? now - lastSnapshotAt : null,
      readyAgeMs: lastReadyAt ? now - lastReadyAt : null,
      lastWorldTime: Number(this.diagnostics.lastWorldTime.toFixed?.(3) ?? this.diagnostics.lastWorldTime ?? 0),
      lastCreatureCount: this.diagnostics.lastCreatureCount,
      lastFoodCount: this.diagnostics.lastFoodCount
    };
  }

  // World attachment contract for systems that need to read the active runtime.
  attachLineageTracker(tracker) {
    this.worldSnapshot.lineageTracker = tracker;
    this.worldSnapshot.creatureManager.lineageTracker = tracker;
    this.worldSnapshot.creatureManager.attachLineageTracker = nextTracker => {
      this.worldSnapshot.lineageTracker = nextTracker;
      this.worldSnapshot.creatureManager.lineageTracker = nextTracker;
    };
  }

  attachParticleSystem(particles) {
    this.worldSnapshot.particles = particles;
  }
  attachHeatmapSystem(heatmaps) {
    this.worldSnapshot.heatmaps = heatmaps;
  }
  attachAudioSystem(audio) {
    this.worldSnapshot.audio = audio;
  }
  attachNotificationSystem(notifications) {
    this.worldSnapshot.notificationSystem = notifications;
  }
  attachProceduralSounds(proceduralSounds) {
    this.worldSnapshot.proceduralSounds = proceduralSounds;
  }
  attachUnlockableAchievements(unlockableAchievements) {
    this.worldSnapshot.unlockableAchievements = unlockableAchievements;
  }
  attachFamilyBonds(familyBonds) {
    this.worldSnapshot.familyBonds = familyBonds;
  }
  attachMemoryLearning(memoryLearning) {
    this.worldSnapshot.memoryLearning = memoryLearning;
  }
}
