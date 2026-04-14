import { eventSystem, GameEvents } from './event-system.js';
import { unpackCreature } from './simulation-state.js';
import { BiomeGenerator } from './perlin-noise.js';

export class SimulationProxy {
  constructor(workerPath) {
    this.worker = new Worker(workerPath, { type: 'module' });
    this.worker.onerror = (e) => {
      console.error('🚨 SimulationProxy: Worker Error', e.message, e.filename, e.lineno);
      eventSystem.emit(GameEvents.ERROR_CRITICAL, { message: 'Simulation Worker Crashed: ' + e.message });
    };
    this.isReady = false;

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
            return this.worldSnapshot.creatures.filter(c =>
              c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2
            );
          }
        }
      },
      foodGrid: {
        queryRect: (x1, y1, x2, y2) => {
          return this.worldSnapshot.food.filter(f =>
            f.x >= x1 && f.x <= x2 && f.y >= y1 && f.y <= y2
          );
        }
      },
      corpseGrid: {
        queryRect: (x1, y1, x2, y2) => {
          return this.worldSnapshot.corpses.filter(c =>
            c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2
          );
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

    this.step = (dt) => {
      this._send('STEP_AND_SYNC', { dt });
    };

    this.spawnManual = (x, y, predator) => {
      this._send('SPAWN_MANUAL', { x, y, predator });
    };

    this.pause = (paused) => {
      this._send('PAUSE', { paused });
    };

    this.setTimeScale = (scale) => {
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

    this.killCreature = (id) => {
      this._send('KILL_CREATURE', { id });
    };

    // Alias for compatibility
    this.removeCreature = this.killCreature;

    this.addFood = (x, y, r, type) => {
      this._send('ADD_FOOD', { x, y, r, type });
      return null;
    };

    this.removeFood = (id) => {
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

    const self = this;
    this._isInternalUpdate = false;

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

    this.worker.onmessage = (e) => this.handleMessage(e);
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
        this.queue.forEach(q => this.worker.postMessage(q));
        this.queue = [];
        break;

      case 'STATE_UPDATE':
        this.updateSnapshot(e.data);
        break;

      case 'EVENT':
        eventSystem.emit(e.data.eventType, e.data.data);
        break;
    }
  }

  updateSnapshot(payload) {
    const { t, count, creatureBuffer, food, corpses, environment, activeDisaster } = payload;

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
            label: environment.currentSeason ? (environment.currentSeason.charAt(0).toUpperCase() + environment.currentSeason.slice(1)) : 'Unknown'
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
  get t() { return this.worldSnapshot.t; }
  get width() { return this.worldSnapshot.width; }
  get height() { return this.worldSnapshot.height; }
  get creatures() { return this.worldSnapshot.creatures; }
  get food() { return this.worldSnapshot.food; }
  get corpses() { return this.worldSnapshot.corpses; }
  get pheromone() { return this.worldSnapshot.pheromone; }
  get temperature() { return this.worldSnapshot.temperature; }
  get creatureManager() { return this.worldSnapshot.creatureManager; }
  get foodGrid() { return this.worldSnapshot.foodGrid; }
  get corpseGrid() { return this.worldSnapshot.corpseGrid; }
  get ecosystem() { return this.worldSnapshot.ecosystem; }
  get foodGridDirty() { return this.worldSnapshot.foodGridDirty; }
  get corpseGridDirty() { return this.worldSnapshot.corpseGridDirty; }

  get randomDisasters() { return this.worldSnapshot.randomDisasters; }
  set randomDisasters(val) {
    this.worldSnapshot.randomDisasters = val;
    this._send('SET_PROP', { path: 'randomDisasters', value: val });
  }

  get disasterCooldown() { return this.worldSnapshot.disasterCooldown; }
  set disasterCooldown(val) {
    this.worldSnapshot.disasterCooldown = val;
    this._send('SET_PROP', { path: 'disasterCooldown', value: val });
  }

  get autoBalanceSettings() { return this.worldSnapshot.autoBalanceSettings; }
  get environment() { return this.worldSnapshot.environment; }

  get seasonSpeed() { return this.worldSnapshot.seasonSpeed; }
  set seasonSpeed(val) {
    this.worldSnapshot.seasonSpeed = val;
    this._send('SET_PROP', { path: 'seasonSpeed', value: val });
  }

  get dayLength() { return this.worldSnapshot.dayLength; }
  set dayLength(val) {
    this.worldSnapshot.dayLength = val;
    this._send('SET_PROP', { path: 'dayLength', value: val });
  }

  get dayPhase() { return this.worldSnapshot.dayPhase || 'day'; }
  get dayLight() { return this.worldSnapshot.dayLight ?? 1; }
  get currentSeason() { return this.worldSnapshot.currentSeason || 'spring'; }
  get moodState() { return this.worldSnapshot.moodState; }
  get weatherType() { return this.worldSnapshot.weatherType; }
  get regions() { return this.worldSnapshot.regions; }

  // Search helper
  getAnyCreatureById(id) {
    return this.worldSnapshot.creatures.find(c => c.id === id);
  }

  getCreatureById(id) {
    return this.getAnyCreatureById(id);
  }

  // Stubs for World attachment methods
  attachLineageTracker() { }
  attachParticleSystem(p) { this.worldSnapshot.particles = p; }
  attachHeatmapSystem() { }
  attachAudioSystem() { }
  attachNotificationSystem() { }
  attachProceduralSounds() { }
  attachUnlockableAchievements() { }
  attachFamilyBonds() { }
  attachMemoryLearning() { }
}
