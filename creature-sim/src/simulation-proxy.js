import { eventSystem, GameEvents } from './event-system.js';
import { unpackCreature, CREATURE_STRIDE } from './simulation-state.js';
import { BiomeGenerator } from './perlin-noise.js';
import { getCurrentSaveVersion } from './save-migration.js';

// Upper bound for commands queued before the worker signals READY. The
// pre-READY window is short (INIT -> READY), so anything beyond this is a
// runaway producer (e.g. per-frame STEP_AND_SYNC while the worker stalls).
const MAX_PRE_READY_QUEUE = 60;

// Merge on-demand EXTRAS entries into snapshot items by static position.
// Food pellets and corpses never move, so coordinate matching stays correct
// even when the snapshot and the extras round-trip straddle a tick that
// eats/spawns entries (a naive index merge would misalign after any shift).
// Entries without a positional match keep their snapshot values.
function mergeExtrasByPosition(targets, sources, keys) {
  if (!Array.isArray(targets) || !Array.isArray(sources)) return;
  const byPos = new Map();
  for (const entry of sources) {
    if (!entry || entry.x === undefined || entry.y === undefined) continue;
    const key = entry.x + ',' + entry.y;
    let bucket = byPos.get(key);
    if (!bucket) {
      bucket = [];
      byPos.set(key, bucket);
    }
    bucket.push(entry);
  }
  for (const item of targets) {
    if (!item) continue;
    const bucket = byPos.get(item.x + ',' + item.y);
    if (!bucket || bucket.length === 0) continue;
    const extra = bucket.shift();
    for (const key of keys) {
      if (extra[key] !== undefined) item[key] = extra[key];
    }
  }
}

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
    this._decorations = [];
    this.diagnostics = {
      errorCount: 0,
      snapshotCount: 0,
      snapshotDropped: 0,
      queueDropped: 0,
      queueCoalesced: 0,
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
      pendingDisasters: [],
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

    this.cancelDisaster = () => {
      this._send('CANCEL_DISASTER', {});
    };

    this.cancelPendingDisaster = id => {
      if (id != null) this._send('CANCEL_PENDING_DISASTER', { id });
    };

    this.clearPendingDisasters = () => {
      this._send('CLEAR_PENDING_DISASTERS', {});
    };

    // Previously undefined on the proxy -- the god-mode Calm/Chaos tools
    // called these directly on `world` with no optional chaining, so every
    // click threw an uncaught TypeError in worker mode (the shipping
    // default). Mirrors the addFood/triggerDisaster fire-and-forget pattern.
    this.addCalmZone = (x, y, radius, duration, strength) => {
      this._send('ADD_CALM_ZONE', { x, y, radius, duration, strength });
      return null;
    };

    this.triggerChaosNudge = (intensity, duration) => {
      this._send('TRIGGER_CHAOS_NUDGE', { intensity, duration });
      return null;
    };

    this.addRestZone = (x, y, radius) => {
      this._send('ADD_REST_ZONE', { x, y, radius });
      return null;
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

      case 'DECORATIONS':
        this._decorations = e.data.data?.decorations || [];
        break;

      case 'WORLD_EXTRAS':
        this._saveExtras = e.data.data;
        if (this._saveExtras?.biomeSeed != null && this.biomeGenerator) {
          this.biomeGenerator.seed = this._saveExtras.biomeSeed;
        }
        // The merge target below includes the proxied environment object,
        // so hold the internal-update flag (as updateSnapshot does) to keep
        // the merge from echoing SET_PROP traffic back to the worker.
        this._isInternalUpdate = true;
        try {
          this._applySaveExtras();
        } finally {
          this._isInternalUpdate = false;
        }
        this._saveExtrasResolvers.forEach(resolve => resolve(this._saveExtras));
        this._saveExtrasResolvers = [];
        break;

      case 'EVENT':
        eventSystem.emit(e.data.eventType, e.data.data);
        break;

      case 'ERROR': {
        const errData = e.data.data || e.data;
        this._recordWorkerError(errData);
        console.error('🚨 SimulationProxy: Worker reported error', errData);
        // Never leave save callers hanging on a dead worker: release
        // pending requestSaveExtras() resolvers with the stale cache.
        if (this._saveExtrasResolvers.length) {
          const pending = this._saveExtrasResolvers.splice(0);
          const fallback = { ...(this._saveExtras || {}), stale: true };
          pending.forEach(resolve => resolve(fallback));
        }
        eventSystem.emit(GameEvents.ERROR_CRITICAL, {
          message: 'Simulation Worker Error: ' + (errData?.message || String(errData || 'Unknown worker error'))
        });
        break;
      }
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
    const { t, count, creatureBuffer, food, corpses, environment, activeDisaster, pendingDisasters } = payload || {};
    // Validate without changing the wire protocol: a malformed STATE_UPDATE
    // (NaN time, bad count, short/missing buffer) is dropped with an explicit
    // warn + counter instead of throwing inside the message handler or
    // clobbering the last good snapshot (previously `t.toFixed` below threw
    // a TypeError on any non-numeric t, killing that message dispatch).
    const tNum = Number(t);
    const countNum = Number(count);
    // The worker transfers a Float32Array (.length in floats); tests and some
    // callers pass a raw ArrayBuffer (.byteLength in bytes). Accept both.
    const floatLength = Number.isInteger(creatureBuffer?.length)
      ? creatureBuffer.length
      : Number.isInteger(creatureBuffer?.byteLength)
        ? creatureBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
        : NaN;
    const bufferOk =
      Number.isInteger(floatLength) &&
      Number.isInteger(countNum) &&
      countNum >= 0 &&
      floatLength === countNum * CREATURE_STRIDE;
    if (!Number.isFinite(tNum) || !bufferOk) {
      this.diagnostics.snapshotDropped = (this.diagnostics.snapshotDropped || 0) + 1;
      console.warn('📡 SimProxy: dropping malformed STATE_UPDATE', {
        t,
        count,
        bufferLength: Number.isInteger(floatLength) ? floatLength : null,
        expectedLength: Number.isInteger(countNum) && countNum >= 0 ? countNum * CREATURE_STRIDE : null
      });
      return;
    }
    this.diagnostics.snapshotCount += 1;
    this.diagnostics.lastSnapshotAt = Date.now();
    this.diagnostics.lastWorldTime = tNum;
    this.diagnostics.lastCreatureCount = countNum;
    this.diagnostics.lastFoodCount = Array.isArray(food) ? food.length : 0;

    // Debug first few updates or if count changes
    if (Math.random() < 0.01 || countNum !== this.worldSnapshot.creatures.length) {
      console.debug(
        `📡 SimProxy: Snapshot t=${tNum.toFixed(2)} count=${countNum} buffer=${creatureBuffer?.byteLength ?? creatureBuffer?.length ?? floatLength}`
      );
    }

    // Flag this as an internal update to prevent Proxies from echoing back to worker
    this._isInternalUpdate = true;

    try {
      this.worldSnapshot.t = tNum;
      this.worldSnapshot.food = Array.isArray(food) ? food : [];
      this.worldSnapshot.corpses = Array.isArray(corpses) ? corpses : [];
      this.worldSnapshot.activeDisaster = activeDisaster;
      this.worldSnapshot.pendingDisasters = Array.isArray(pendingDisasters) ? pendingDisasters : [];

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

      // Unpack binary buffer into renderable objects. A raw ArrayBuffer is
      // not indexable, so view it as Float32Array first (count 0 never reads).
      const creatureView = creatureBuffer instanceof ArrayBuffer ? new Float32Array(creatureBuffer) : creatureBuffer;
      const creatures = new Array(countNum);
      for (let i = 0; i < countNum; i++) {
        creatures[i] = unpackCreature(creatureView, i);
      }
      this.worldSnapshot.creatures = creatures;
      // Re-apply cached save fidelity fields: snapshots arriving after a
      // WORLD_EXTRAS round-trip would otherwise present bare unpacked
      // creatures (no parentId/maxHealth/full genes) to serialize().
      this._applySaveExtras();
    } finally {
      this._isInternalUpdate = false;
    }
  }

  _send(type, data) {
    // INIT must be sent immediately to start the worker
    if (this.isReady || type === 'INIT') {
      this.worker.postMessage({ type, data });
    } else {
      // Coalescible per-tick step: only the latest dt matters once the worker
      // drains the queue, so compact earlier STEP_AND_SYNC entries instead of
      // letting them pile up unbounded while the worker is stalled.
      if (type === 'STEP_AND_SYNC') {
        const existing = this.queue.findIndex(q => q.type === 'STEP_AND_SYNC');
        if (existing !== -1) {
          this.queue[existing] = { type, data };
          this.diagnostics.queueCoalesced = (this.diagnostics.queueCoalesced || 0) + 1;
          return;
        }
      }
      if (this.queue.length >= MAX_PRE_READY_QUEUE) {
        this.queue.shift();
        this.diagnostics.queueDropped = (this.diagnostics.queueDropped || 0) + 1;
      }
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
  /**
   * Environmental decorations (trees, rocks, flowers, grass). Pushed from the
   * worker once per seed/reset rather than riding along in every snapshot,
   * since they are fixed for the life of a world.
   */
  get decorations() {
    return this._decorations;
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

  // Top-level time fields serialize() reads directly off the world object.
  // They live in the environment on a real World; expose them here so worker
  // saves preserve them instead of falling back to serialize() defaults.
  get timeOfDay() {
    return this.worldSnapshot.environment?.timeOfDay ?? 12;
  }
  get seasonPhase() {
    return this.worldSnapshot.environment?.seasonPhase ?? 0;
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
      pendingDisasters: this._saveExtras?.disasterPending || this.worldSnapshot.pendingDisasters || [],
      disasterCooldown: this.worldSnapshot.disasterCooldown ?? 0
    };
  }

  getPendingDisasters() {
    return this.worldSnapshot.pendingDisasters || [];
  }

  getPendingDisastersVersion() {
    return this.getPendingDisasters().length;
  }

  /**
   * Merge the on-demand WORLD_EXTRAS fidelity fields back into the latest
   * per-tick snapshot so save-system.js's serialize() reads full values.
   * unpackCreature (simulation-state.js) is intentionally untouched: the
   * binary layout stays fixed and this merge is the single adaptation point.
   * No-op when no extras (or no snapshot) exist yet. Callers must hold
   * _isInternalUpdate (updateSnapshot sets it; the WORLD_EXTRAS handler sets
   * it around the call) so the proxied environment merge never echoes
   * SET_PROP traffic back to the worker.
   */
  _applySaveExtras() {
    const extras = this._saveExtras;
    const snap = this.worldSnapshot;
    if (!extras || !snap) return;

    if (Array.isArray(extras.creatureExtras) && Array.isArray(snap.creatures)) {
      const byId = new Map();
      for (const entry of extras.creatureExtras) {
        if (entry && entry.id != null) byId.set(entry.id, entry);
      }
      for (const creature of snap.creatures) {
        if (!creature) continue;
        const extra = byId.get(creature.id);
        if (!extra) continue;
        if (extra.parentId !== undefined) creature.parentId = extra.parentId ?? null;
        if (extra.maxHealth !== undefined && extra.maxHealth != null) creature.maxHealth = extra.maxHealth;
        if (extra.genes && typeof extra.genes === 'object') {
          creature.genes = { ...(creature.genes || {}), ...extra.genes };
        }
        if (extra.personality && typeof extra.personality === 'object') {
          creature.personality = { ...(creature.personality || {}), ...extra.personality };
        }
        if (extra.temperament && typeof extra.temperament === 'object') {
          creature.temperament = { ...(creature.temperament || {}), ...extra.temperament };
        }
        if (Array.isArray(extra.quirks)) creature.quirks = [...extra.quirks];
        if (extra.stats && typeof extra.stats === 'object') {
          creature.stats = { ...(creature.stats || {}), ...extra.stats };
        }
        if (extra.traits && typeof extra.traits === 'object') {
          creature.traits = { ...(creature.traits || {}), ...extra.traits };
        }
        if (extra.needs && typeof extra.needs === 'object') {
          const base = creature.needs && typeof creature.needs === 'object' ? creature.needs : {};
          creature.needs = { ...base };
          for (const key of ['energy', 'socialDrive', 'lastEatAt']) {
            if (extra.needs[key] !== undefined && extra.needs[key] !== null) creature.needs[key] = extra.needs[key];
          }
          for (const key of ['hunger', 'stress']) {
            if (base[key] === undefined && extra.needs[key] !== undefined) creature.needs[key] = extra.needs[key];
          }
        }
        if (extra.goal && typeof extra.goal === 'object') {
          creature.goal = { ...(creature.goal || {}), ...extra.goal };
        }
        if (extra.ecosystem && typeof extra.ecosystem === 'object') {
          creature.ecosystem = { ...(creature.ecosystem || {}), ...extra.ecosystem };
        }
        if (extra.emotions && typeof extra.emotions === 'object') {
          creature.emotions = { ...(creature.emotions || {}), ...extra.emotions };
        }
        if (extra.memory && typeof extra.memory === 'object') {
          creature.memory = {
            capacity: extra.memory.capacity ?? creature.memory?.capacity ?? null,
            locations: Array.isArray(extra.memory.locations) ? extra.memory.locations.map(mem => ({ ...mem })) : []
          };
        }
        if (extra.deathTime !== undefined) creature.deathTime = extra.deathTime ?? null;
        if (extra.deathCause !== undefined) creature.deathCause = extra.deathCause ?? null;
        if (extra.killedBy !== undefined) creature.killedBy = extra.killedBy ?? null;
      }
    }

    mergeExtrasByPosition(snap.food, extras.foodFull, [
      'energy',
      'bites',
      'biteEnergy',
      'scentRadius',
      'sourceId',
      'sourceTag',
      'origin'
    ]);
    // Note: snapshot-fresh fields (food `type`, corpse `age`) are deliberately
    // excluded so stale extras can never overwrite newer per-tick values.
    mergeExtrasByPosition(snap.corpses, extras.corpsesFull, ['energy', 'isPredator']);

    if (extras.environmentFull && typeof extras.environmentFull === 'object' && snap.environment) {
      const target = snap.environment;
      for (const [key, value] of Object.entries(extras.environmentFull)) {
        if (value !== undefined && typeof value !== 'function') target[key] = value;
      }
      if (extras.environmentFull.dayLength !== undefined) snap.dayLength = extras.environmentFull.dayLength;
      if (extras.environmentFull.seasonSpeed !== undefined) snap.seasonSpeed = extras.environmentFull.seasonSpeed;
    }

    if (extras._nextId != null && snap.creatureManager) {
      snap.creatureManager._nextId = extras._nextId;
    }
  }

  /**
   * Ask the worker for the save-only fields (nests, restZones, sandbox
   * props, childrenOf, _nextId, biome seed) not included in the regular
   * per-tick snapshot, and cache them for the getters above. Must be
   * awaited before calling save-system.js's serialize() against this proxy.
   */
  requestSaveExtras(timeoutMs = 3000) {
    return new Promise(resolve => {
      let timer = null;
      const wrapped = value => {
        if (timer) clearTimeout(timer);
        resolve(value);
      };
      timer = setTimeout(() => {
        const idx = this._saveExtrasResolvers.indexOf(wrapped);
        if (idx !== -1) this._saveExtrasResolvers.splice(idx, 1);
        resolve({ ...(this._saveExtras || {}), stale: true });
      }, timeoutMs);
      this._saveExtrasResolvers.push(wrapped);
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

  importState(saveWorld, version = getCurrentSaveVersion()) {
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
      queuedDropped: this.diagnostics.queueDropped || 0,
      queuedCoalesced: this.diagnostics.queueCoalesced || 0,
      snapshotDropped: this.diagnostics.snapshotDropped || 0,
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
