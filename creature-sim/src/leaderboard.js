// @ts-check
/**
 * Leaderboard System
 * Local high-score storage for campaign levels.
 */
const STORAGE_KEY = 'creature-sandbox-leaderboard';

export class Leaderboard {
  constructor() {
    this.scores = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.scores));
    } catch {
      // Storage may be full or unavailable
    }
  }

  /**
   * @param {string} levelId
   * @param {{ score: number, stars: number, time: number, date: string, initials?: string }} entry
   */
  submit(levelId, entry) {
    if (!this.scores[levelId]) {
      this.scores[levelId] = [];
    }
    this.scores[levelId].push({
      ...entry,
      date: entry.date || new Date().toISOString()
    });
    // Keep top 10 per level
    this.scores[levelId].sort((a, b) => b.score - a.score);
    this.scores[levelId] = this.scores[levelId].slice(0, 10);
    this._save();
  }

  /**
   * @param {string} levelId
   * @returns {Array<{ score: number, stars: number, time: number, date: string, initials?: string }>}
   */
  getScores(levelId) {
    return this.scores[levelId] || [];
  }

  /**
   * @param {string} levelId
   * @returns {{ score: number, stars: number, time: number } | null}
   */
  getBest(levelId) {
    const scores = this.scores[levelId];
    return scores && scores.length > 0 ? scores[0] : null;
  }

  reset() {
    this.scores = {};
    this._save();
  }
}

export const leaderboard = new Leaderboard();
