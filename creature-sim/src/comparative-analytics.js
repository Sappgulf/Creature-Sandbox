/**
 * comparative-analytics.js — Overlay "current run" vs "best/previous" comparison
 *
 * Caches a `comparison` series (a deep copy of an analytics snapshot) and
 * exposes a `getComparison()` accessor the dashboard can use to draw a
 * semi-transparent line on top of the Population chart.
 *
 * Pure logic + a small UI binding for the dashboard toolbar.
 */

const COMPARISON_STORAGE_KEY = 'creature-sim-comparative-analytics';
const MAX_SAMPLES = 600;

export class ComparativeAnalytics {
  constructor({ storage } = {}) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    /** @type {Array<{t:number, pop:number, herb:number, pred:number}> | null} */
    this.comparison = null;
    /** @type {string | null} */
    this.source = null; // 'best' | 'previous' | 'manual'
    this.subscribers = new Set();
    this._load();
  }

  /**
   * Subscribe to comparison changes.
   * @param {Function} fn
   * @returns {Function}
   */
  subscribe(fn) {
    if (typeof fn === 'function') this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Snapshot a series for later comparison. Stores only a deep copy of
   * the relevant data; trims to MAX_SAMPLES.
   * @param {Array} samples
   * @param {Object} options
   * @param {string} [options.source='manual']
   */
  capture(samples, { source = 'manual' } = {}) {
    if (!Array.isArray(samples) || samples.length === 0) return false;
    const cleaned = samples.slice(-MAX_SAMPLES).map(sample => ({
      t: Number(sample.t) || 0,
      pop: Number(sample.pop ?? sample.population ?? 0) || 0,
      herb: Number(sample.herb ?? sample.herbivores ?? 0) || 0,
      pred: Number(sample.pred ?? sample.predators ?? 0) || 0
    }));
    this.comparison = cleaned;
    this.source = source;
    this._persist();
    this._notify();
    return true;
  }

  /**
   * Auto-capture the "best" run so far (peak population).
   * @param {Array} samples
   * @returns {boolean}
   */
  captureIfBest(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return false;
    let peak = 0;
    for (const s of samples) {
      const pop = Number(s.pop ?? s.population) || 0;
      if (pop > peak) peak = pop;
    }
    const currentPeak = this._peakPopulation(this.comparison);
    if (peak > currentPeak) {
      return this.capture(samples, { source: 'best' });
    }
    return false;
  }

  _peakPopulation(samples) {
    if (!Array.isArray(samples)) return 0;
    let peak = 0;
    for (const s of samples) {
      const pop = Number(s.pop) || 0;
      if (pop > peak) peak = pop;
    }
    return peak;
  }

  /**
   * Clear the active comparison.
   */
  reset() {
    this.comparison = null;
    this.source = null;
    if (this.storage) {
      try {
        this.storage.removeItem(COMPARISON_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this._notify();
  }

  isActive() {
    return Array.isArray(this.comparison) && this.comparison.length > 0;
  }

  getComparison() {
    return this.comparison;
  }

  getSource() {
    return this.source;
  }

  _notify() {
    for (const fn of this.subscribers) {
      try {
        fn(this.snapshot());
      } catch (error) {
        console.warn('comparative-analytics subscriber error', error);
      }
    }
  }

  snapshot() {
    return {
      active: this.isActive(),
      source: this.source,
      sampleCount: this.comparison?.length || 0
    };
  }

  _persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(
        COMPARISON_STORAGE_KEY,
        JSON.stringify({
          comparison: this.comparison,
          source: this.source,
          savedAt: Date.now()
        })
      );
    } catch (error) {
      console.warn('comparative-analytics persist failed', error);
    }
  }

  _load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(COMPARISON_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.comparison)) {
        this.comparison = parsed.comparison;
        this.source = parsed.source || null;
      }
    } catch (error) {
      console.warn('comparative-analytics load failed', error);
    }
  }
}

export const comparativeAnalytics = new ComparativeAnalytics();
