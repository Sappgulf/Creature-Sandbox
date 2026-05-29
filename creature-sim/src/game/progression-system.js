const STORAGE_KEY = 'creature-sandbox-progression-v1';

const DEFAULT_UNLOCKS = Object.freeze({
  tools: ['inspect', 'food', 'spawn', 'erase', 'prop', 'calm', 'chaos'],
  props: ['bounce', 'spring', 'calm'],
  biomes: ['grassland', 'forest'],
  creatureVariants: ['herbivore', 'omnivore', 'predator'],
  scenarios: ['first_ecosystem', 'peaceful_garden', 'predator_pressure'],
  overlays: []
});

function storageAvailable() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function toSet(values = []) {
  return new Set(Array.isArray(values) ? values.filter(Boolean) : []);
}

function setsToArrays(unlocks = {}) {
  return Object.fromEntries(Object.entries(unlocks).map(([key, value]) => [key, Array.from(value || [])]));
}

export class ProgressionSystem {
  constructor({ storageKey = STORAGE_KEY } = {}) {
    this.storageKey = storageKey;
    this.unlocks = Object.fromEntries(Object.entries(DEFAULT_UNLOCKS).map(([key, value]) => [key, toSet(value)]));
    this.completedScenarios = {};
    this.stats = {
      highestPopulation: 0,
      highestGeneration: 0,
      variantsSeen: 0,
      challengeLevel: 1
    };
    this.load();
  }

  update({ world, playable, challengeSystem, unlockableAchievements } = {}) {
    const population = world?.creatures?.filter?.(creature => creature?.alive !== false)?.length ?? 0;
    this.stats.highestPopulation = Math.max(this.stats.highestPopulation, population);
    this.stats.highestGeneration = Math.max(
      this.stats.highestGeneration,
      Number(playable?.metrics?.maxGeneration || 0)
    );
    this.stats.variantsSeen = Math.max(this.stats.variantsSeen, Number(playable?.metrics?.variantsAlive || 0));
    this.stats.challengeLevel = Math.max(this.stats.challengeLevel, Number(challengeSystem?.level || 1));

    this.mergeUnlockableAchievements(unlockableAchievements);
    this.applyMilestoneUnlocks();
  }

  mergeUnlockableAchievements(unlockableAchievements) {
    const legacyUnlocks = unlockableAchievements?.unlocks;
    if (!legacyUnlocks || typeof legacyUnlocks !== 'object') return;

    for (const [key, values] of Object.entries(legacyUnlocks)) {
      const mappedKey = key === 'creatures' ? 'creatureVariants' : key;
      if (!this.unlocks[mappedKey]) this.unlocks[mappedKey] = new Set();
      for (const value of values || []) {
        this.unlocks[mappedKey].add(value);
      }
    }
  }

  applyMilestoneUnlocks() {
    if (this.stats.highestPopulation >= 45) {
      this.unlock('tools', 'weather');
      this.unlock('biomes', 'wetlands');
      this.unlock('scenarios', 'winter_survival');
    }
    if (this.stats.variantsSeen >= 2) {
      this.unlock('creatureVariants', 'aquatic');
      this.unlock('creatureVariants', 'flying');
      this.unlock('scenarios', 'mutation_lab');
    }
    if (this.stats.highestGeneration >= 3) {
      this.unlock('props', 'fan');
      this.unlock('scenarios', 'lineage_guardian');
    }
    if (this.stats.challengeLevel >= 2) {
      this.unlock('tools', 'terrain');
      this.unlock('overlays', 'observer');
    }
  }

  recordScenarioComplete(id, payload = {}) {
    if (!id) return;
    const existing = this.completedScenarios[id] || { completions: 0, bestSeconds: null };
    const seconds = Number(payload.seconds ?? payload.elapsed ?? 0);
    this.completedScenarios[id] = {
      completions: existing.completions + 1,
      bestSeconds:
        existing.bestSeconds == null || (seconds && seconds < existing.bestSeconds) ? seconds : existing.bestSeconds,
      completedAt: Date.now()
    };
    this.unlock('scenarios', id);
  }

  unlock(category, value) {
    if (!category || !value) return false;
    if (!this.unlocks[category]) this.unlocks[category] = new Set();
    const before = this.unlocks[category].size;
    this.unlocks[category].add(value);
    const changed = this.unlocks[category].size !== before;
    if (changed) this.save();
    return changed;
  }

  isUnlocked(category, value) {
    return !!this.unlocks[category]?.has(value);
  }

  getSnapshot() {
    return {
      unlocks: setsToArrays(this.unlocks),
      completedScenarios: { ...this.completedScenarios },
      stats: { ...this.stats }
    };
  }

  serialize() {
    return this.getSnapshot();
  }

  restore(data = {}) {
    if (!data || typeof data !== 'object') return false;
    if (data.unlocks && typeof data.unlocks === 'object') {
      for (const [key, values] of Object.entries(data.unlocks)) {
        this.unlocks[key] = toSet(values);
      }
    }
    if (data.completedScenarios && typeof data.completedScenarios === 'object') {
      this.completedScenarios = { ...data.completedScenarios };
    }
    if (data.stats && typeof data.stats === 'object') {
      this.stats = { ...this.stats, ...data.stats };
    }
    return true;
  }

  load() {
    if (!storageAvailable()) return false;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return false;
      return this.restore(JSON.parse(raw));
    } catch {
      return false;
    }
  }

  save() {
    if (!storageAvailable()) return false;
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.serialize()));
      return true;
    } catch {
      return false;
    }
  }
}
