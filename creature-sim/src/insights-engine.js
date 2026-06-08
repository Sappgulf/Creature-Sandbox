/**
 * insights-engine.js — Periodic narrative insight generation
 *
 * Runs every INSIGHT_INTERVAL seconds, examines the world state, and emits
 * narrative insights when conditions match. Insights are kept in a small ring
 * buffer and persisted to localStorage so they survive reloads (per task #4).
 *
 * Pure logic (no DOM) so it can be unit tested with `scripts/core-modules.test.mjs`.
 */

export const INSIGHT_TYPES = {
  POPULATION_CRASH: 'population_crash',
  POPULATION_BOOM: 'population_boom',
  SPEED_EVOLUTION: 'speed_evolution',
  PREDATOR_DOMINANCE: 'predator_dominance',
  NEW_SPECIES: 'new_species',
  DROUGHT_STRESS: 'drought_stress',
  BOND_FORMATION: 'bond_formation',
  ELDER_DEATH: 'elder_death'
};

const ICONS = {
  population_crash: '📉',
  population_boom: '📈',
  speed_evolution: '⚡',
  predator_dominance: '🦁',
  new_species: '🧬',
  drought_stress: '🥀',
  bond_formation: '💞',
  elder_death: '🕊️'
};

const INSIGHT_INTERVAL = 30;
const HISTORY_LIMIT = 20;
const POPULATION_CRASH_THRESHOLD = 0.2; // 20% drop in last minute
const POPULATION_BOOM_THRESHOLD = 0.25; // 25% rise in last minute
const PREDATOR_DOMINANCE_THRESHOLD = 0.45;
const DROUGHT_BIOME_RATIO = 0.4;
const POPULATION_HISTORY_LIMIT = 60; // 60 seconds of in-world history

const STORAGE_KEY = 'creature-sim-insights';

export class InsightsEngine {
  /**
   * @param {Object} options
   * @param {Function} [options.now] - Time provider (defaults to world.t)
   * @param {Function} [options.emit] - Optional emitter for tests
   * @param {Object} [options.storage] - Storage adapter for persistence (default: localStorage)
   */
  constructor({ now, emit, storage, subscribers } = {}) {
    this.now = typeof now === 'function' ? now : null;
    this.emit = typeof emit === 'function' ? emit : null;
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.subscribers = new Set(typeof subscribers === 'function' ? [subscribers] : subscribers || []);
    /** @type {Array<{id:string,type:string,icon:string,text:string,worldTime:number}>} */
    this.insights = [];
    this._lastUpdateAt = 0;
    /** @type {Array<{t:number,pop:number,pred:number,speed:number}>} */
    this._populationHistory = [];
    this._cooldowns = new Map();
    this._loadFromStorage();
  }

  /**
   * Subscribe to insight events. Returns an unsubscribe function.
   * @param {Function} fn
   * @returns {Function}
   */
  subscribe(fn) {
    if (typeof fn === 'function') this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  _notify(entry) {
    if (typeof this.emit === 'function') {
      try {
        this.emit(entry);
      } catch (error) {
        console.warn('insights-engine: emit failed', error);
      }
    }
    for (const fn of this.subscribers) {
      try {
        fn(entry, this);
      } catch (error) {
        console.warn('insights-engine: subscriber failed', error);
      }
    }
  }

  /**
   * Update the engine — call once per frame.
   * @param {Object} world
   * @param {number} dt
   * @returns {Array} insights generated in this update
   */
  update(world, dt) {
    if (!world) return [];
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const currentTime = this.now ? this.now() : Number(world.t) || 0;
    this._lastUpdateAt += safeDt;
    this._trackHistory(world, currentTime);

    if (this._lastUpdateAt < INSIGHT_INTERVAL) return [];
    this._lastUpdateAt = 0;

    const generated = this._evaluate(world, currentTime);
    if (generated.length > 0) {
      this._persist();
    }
    return generated;
  }

  _trackHistory(world, currentTime) {
    const creatures = Array.isArray(world.creatures) ? world.creatures : [];
    const pop = creatures.length;
    const pred = creatures.filter(c => isPredator(c)).length;
    const speed = average(creatures.map(c => c?.genes?.speed).filter(Number.isFinite));
    this._populationHistory.push({ t: currentTime, pop, pred, speed });
    if (this._populationHistory.length > POPULATION_HISTORY_LIMIT) {
      this._populationHistory.shift();
    }
  }

  _evaluate(world, currentTime) {
    const generated = [];
    const checks = [
      () => this._checkPopulationCrash(world, currentTime),
      () => this._checkPopulationBoom(world, currentTime),
      () => this._checkSpeedEvolution(world, currentTime),
      () => this._checkPredatorDominance(world, currentTime),
      () => this._checkNewSpecies(world, currentTime),
      () => this._checkDroughtStress(world, currentTime),
      () => this._checkBondFormation(world, currentTime),
      () => this._checkElderDeath(world, currentTime)
    ];
    for (const check of checks) {
      try {
        const result = check();
        if (result) {
          generated.push(result);
          this._recordInsight(result, currentTime);
        }
      } catch (error) {
        // Never let a single insight crash the engine
        console.warn('insights-engine: check failed', error);
      }
    }
    return generated;
  }

  _checkPopulationCrash(world, currentTime) {
    const history = this._populationHistory;
    if (history.length < 2) return null;
    const latest = history[history.length - 1];
    const minuteAgo = findClosestSampleAtT(history, currentTime - 60);
    if (!minuteAgo || minuteAgo.pop < 5) return null;
    const ratio = (minuteAgo.pop - latest.pop) / minuteAgo.pop;
    if (ratio < POPULATION_CRASH_THRESHOLD) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.POPULATION_CRASH, currentTime)) return null;
    const percent = Math.round(ratio * 100);
    return {
      type: INSIGHT_TYPES.POPULATION_CRASH,
      icon: ICONS.population_crash,
      text: `Population dropped ${percent}% in the last minute.`,
      worldTime: currentTime
    };
  }

  _checkPopulationBoom(world, currentTime) {
    const history = this._populationHistory;
    if (history.length < 2) return null;
    const latest = history[history.length - 1];
    const minuteAgo = findClosestSampleAtT(history, currentTime - 60);
    if (!minuteAgo || minuteAgo.pop < 5) return null;
    const ratio = (latest.pop - minuteAgo.pop) / minuteAgo.pop;
    if (ratio < POPULATION_BOOM_THRESHOLD) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.POPULATION_BOOM, currentTime)) return null;
    const percent = Math.round(ratio * 100);
    return {
      type: INSIGHT_TYPES.POPULATION_BOOM,
      icon: ICONS.population_boom,
      text: `Population grew ${percent}% — ecosystem is thriving.`,
      worldTime: currentTime
    };
  }

  _checkSpeedEvolution(world, currentTime) {
    const history = this._populationHistory;
    if (history.length < 2) return null;
    const latest = history[history.length - 1];
    const hourAgo = findClosestSampleAtT(history, currentTime - 3600);
    if (!hourAgo || hourAgo.speed <= 0) return null;
    if (Math.abs(latest.speed - hourAgo.speed) < 0.05) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.SPEED_EVOLUTION, currentTime)) return null;
    return {
      type: INSIGHT_TYPES.SPEED_EVOLUTION,
      icon: ICONS.speed_evolution,
      text: `The Swift lineage is now averaging speed ${latest.speed.toFixed(2)} (up from ${hourAgo.speed.toFixed(2)} last hour).`,
      worldTime: currentTime
    };
  }

  _checkPredatorDominance(world, currentTime) {
    const creatures = Array.isArray(world.creatures) ? world.creatures : [];
    if (creatures.length < 5) return null;
    const pred = creatures.filter(isPredator).length;
    const ratio = pred / creatures.length;
    if (ratio < PREDATOR_DOMINANCE_THRESHOLD) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.PREDATOR_DOMINANCE, currentTime)) return null;
    return {
      type: INSIGHT_TYPES.PREDATOR_DOMINANCE,
      icon: ICONS.predator_dominance,
      text: `Predators now make up ${Math.round(ratio * 100)}% of the population.`,
      worldTime: currentTime
    };
  }

  _checkNewSpecies(world, currentTime) {
    const groups = world?.analytics?.speciesGroups;
    if (!Array.isArray(groups) || groups.length < 2) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.NEW_SPECIES, currentTime)) return null;
    const latest = groups[0];
    const desc = latest?.avgGenes ? describeSpecies(latest.avgGenes) : 'a distinct genetic cluster';
    return {
      type: INSIGHT_TYPES.NEW_SPECIES,
      icon: ICONS.new_species,
      text: `A new genetic cluster emerged — ${desc}.`,
      worldTime: currentTime
    };
  }

  _checkDroughtStress(world, currentTime) {
    const patches = world?.ecosystem?.foodPatches;
    if (!Array.isArray(patches) || patches.length === 0) return null;
    const total = patches.length;
    const scarce = patches.filter(p => (p.stock || 0) <= 0 || (p.pressure || 0) > 0.6).length;
    if (total === 0 || scarce / total < DROUGHT_BIOME_RATIO) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.DROUGHT_STRESS, currentTime)) return null;
    return {
      type: INSIGHT_TYPES.DROUGHT_STRESS,
      icon: ICONS.drought_stress,
      text: `Food is scarce in ${scarce} biomes.`,
      worldTime: currentTime
    };
  }

  _checkBondFormation(world, currentTime) {
    const pending = world?.pendingBond;
    if (!pending) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.BOND_FORMATION, currentTime)) return null;
    const generation = Number(pending.generation) || 0;
    return {
      type: INSIGHT_TYPES.BOND_FORMATION,
      icon: ICONS.bond_formation,
      text: `Two creatures bonded — generation ${generation} is taking root.`,
      worldTime: currentTime
    };
  }

  _checkElderDeath(world, currentTime) {
    const lastDeath = world?.lastDeath;
    if (!lastDeath || !lastDeath.elder) return null;
    if (!this._cooldownReady(INSIGHT_TYPES.ELDER_DEATH, currentTime)) return null;
    return {
      type: INSIGHT_TYPES.ELDER_DEATH,
      icon: ICONS.elder_death,
      text: `An elder died at age ${Math.round(lastDeath.age)}. Their lineage spans ${lastDeath.generation || 0} generations.`,
      worldTime: currentTime
    };
  }

  _recordInsight(insight, currentTime) {
    const entry = {
      id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: insight.type,
      icon: insight.icon,
      text: insight.text,
      worldTime: Number(insight.worldTime ?? currentTime)
    };
    this.insights.unshift(entry);
    if (this.insights.length > HISTORY_LIMIT) {
      this.insights.length = HISTORY_LIMIT;
    }
    this._notify(entry);
  }

  _cooldownReady(type, currentTime) {
    const cd = COOLDOWN[type] || 60;
    const last = this._cooldowns.get(type) ?? -Infinity;
    if (currentTime - last < cd) return false;
    this._cooldowns.set(type, currentTime);
    return true;
  }

  serialize() {
    return {
      insights: this.insights.slice(0, HISTORY_LIMIT),
      savedAt: Date.now()
    };
  }

  restore(data) {
    if (!data || !Array.isArray(data.insights)) return false;
    this.insights = data.insights
      .filter(entry => entry && typeof entry.text === 'string')
      .slice(0, HISTORY_LIMIT)
      .map((entry, index) => ({
        id: entry.id || `insight-restored-${index}`,
        type: entry.type || 'unknown',
        icon: entry.icon || '✨',
        text: String(entry.text),
        worldTime: Number(entry.worldTime) || 0
      }));
    return true;
  }

  _persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.serialize()));
    } catch (error) {
      console.warn('insights-engine: persist failed', error);
    }
  }

  _loadFromStorage() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.restore(parsed);
    } catch (error) {
      console.warn('insights-engine: load failed', error);
    }
  }

  clear() {
    this.insights = [];
    this._cooldowns.clear();
    this._populationHistory = [];
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }
}

const COOLDOWN = {
  population_crash: 90,
  population_boom: 90,
  speed_evolution: 180,
  predator_dominance: 60,
  new_species: 120,
  drought_stress: 90,
  bond_formation: 45,
  elder_death: 30
};

function isPredator(creature) {
  if (!creature?.genes) return false;
  if (creature.genes.predator) return true;
  return (creature.genes.diet || 0) > 0.7;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

function findClosestSampleAtT(history, targetT) {
  if (!Array.isArray(history) || history.length === 0) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const sample of history) {
    const delta = Math.abs(Number(sample.t) - targetT);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = sample;
    }
  }
  return best;
}

function describeSpecies(genes) {
  if (!genes) return 'a distinct genetic cluster';
  const speed = Number(genes.speed) || 0;
  const sense = Number(genes.sense) || 0;
  const metab = Number(genes.metabolism) || 0;
  const traits = [];
  if (speed > 1.4) traits.push('fast');
  else if (speed < 0.7) traits.push('slow');
  if (sense > 120) traits.push('keen-sensed');
  if (metab < 0.6) traits.push('low-metabolism');
  else if (metab > 1.4) traits.push('high-metabolism');
  if (traits.length === 0) return 'a distinct genetic cluster';
  return `a ${traits.join(', ')} lineage`;
}

export const __insightsTestUtils = {
  isPredator,
  findClosestSampleAtT,
  describeSpecies,
  average
};
