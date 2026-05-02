// @ts-check
/**
 * Lifetime Stats System
 * Persistent cross-session statistics for player engagement.
 */

const STORAGE_KEY = 'creature-sandbox-lifetime-stats';

export class LifetimeStats {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return this._default();
  }

  _default() {
    return {
      version: 1,
      totalPlayTimeSeconds: 0,
      totalSessions: 0,
      totalCreaturesBorn: 0,
      totalCreaturesDied: 0,
      totalPredatorKills: 0,
      totalFoodEaten: 0,
      totalMatings: 0,
      totalDisastersSurvived: 0,
      totalMutationsObserved: 0,
      highestPopulation: 0,
      longestCreatureLived: 0,
      mostSuccessfulPredator: { name: '', kills: 0 },
      oldestCreature: { name: '', age: 0 },
      firstPlayedAt: Date.now(),
      lastPlayedAt: Date.now()
    };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage errors
    }
  }

  increment(key, amount = 1) {
    if (typeof this.data[key] === 'number') {
      this.data[key] += amount;
      this._save();
    }
  }

  updateMax(key, value) {
    if (typeof this.data[key] === 'number' && value > this.data[key]) {
      this.data[key] = value;
      this._save();
    }
  }

  updateRecord(key, record) {
    this.data[key] = record;
    this._save();
  }

  addPlayTime(seconds) {
    this.data.totalPlayTimeSeconds += seconds;
    this.data.lastPlayedAt = Date.now();
    this._save();
  }

  startSession() {
    this.data.totalSessions += 1;
    this.data.lastPlayedAt = Date.now();
    this._save();
  }

  getSummary() {
    const d = this.data;
    const hours = Math.floor(d.totalPlayTimeSeconds / 3600);
    const minutes = Math.floor((d.totalPlayTimeSeconds % 3600) / 60);
    return {
      ...d,
      formattedPlayTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      daysSinceFirst: Math.floor((Date.now() - d.firstPlayedAt) / 86400000)
    };
  }

  reset() {
    this.data = this._default();
    this._save();
  }
}

export const lifetimeStats = new LifetimeStats();
