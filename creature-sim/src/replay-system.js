/**
 * Replay System — Periodic world-state snapshotting with playback controls.
 *
 * Snapshots the world at a fixed interval, stores them in a capped ring buffer
 * (and optionally persists them in `localStorage` under `creature-sim-replay-snapshots`),
 * and exposes playback controls: play/pause, speed, scrub, and step ±.
 *
 * The snapshots are intentionally lightweight: counts plus per-creature position
 * summaries, not full state. This keeps replay within the 60-snapshot budget.
 */

const SNAPSHOT_INTERVAL_S = 5;
const MAX_SNAPSHOTS = 60;
const STORAGE_KEY = 'creature-sim-replay-snapshots';

export class ReplaySystem {
  constructor() {
    /** @type {Array<{t:number, snapshottedAt:number, payload:Object}>} */
    this.snapshots = [];
    this.lastSnapshotTime = 0;
    this.snapshotInterval = SNAPSHOT_INTERVAL_S;
    this.maxSnapshots = MAX_SNAPSHOTS;
    this.playing = false;
    this.speed = 1;
    this.cursor = -1;
    this.lastFrameTime = 0;
    this.subscribers = new Set();
    this._loadedFromStorage = false;
  }

  /**
   * Capture a snapshot of the world if enough time has passed.
   * @param {Object} world
   * @param {number} dt - Delta in seconds
   * @returns {boolean} true when a snapshot was taken
   */
  update(world, dt) {
    if (!world) return false;
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.lastSnapshotTime += safeDt;
    if (this.lastSnapshotTime < this.snapshotInterval) return false;
    this.lastSnapshotTime = 0;
    const snapshot = this.captureSnapshot(world);
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    this._notify();
    return true;
  }

  /**
   * Build a compact snapshot for a given world.
   * @param {Object} world
   * @returns {{t:number, snapshottedAt:number, payload:Object}}
   */
  captureSnapshot(world) {
    const creatures = Array.isArray(world.creatures) ? world.creatures : [];
    const summary = {
      population: creatures.length,
      alive: creatures.filter(c => c && c.alive !== false).length,
      predators: creatures.filter(c => c && c.genes && (c.genes.predator || (c.genes.diet || 0) > 0.7)).length,
      meanSpeed: average(creatures.map(c => c?.genes?.speed).filter(Number.isFinite)),
      meanEnergy: average(creatures.map(c => c?.energy).filter(Number.isFinite)),
      food: Array.isArray(world.food) ? world.food.length : 0
    };
    return {
      t: Number(world.t) || 0,
      snapshottedAt: Date.now(),
      payload: {
        summary,
        // Position samples are limited to 200 to bound snapshot size
        positions: creatures.slice(0, 200).map(c => ({
          id: c.id,
          x: Number(c.x?.toFixed?.(2) ?? c.x ?? 0),
          y: Number(c.y?.toFixed?.(2) ?? c.y ?? 0),
          alive: c.alive !== false,
          predator: !!(c.genes?.predator || (c.genes?.diet || 0) > 0.7)
        }))
      }
    };
  }

  reset() {
    this.snapshots = [];
    this.lastSnapshotTime = 0;
    this.cursor = -1;
    this.playing = false;
    this._notify();
  }

  /** Returns number of available snapshots. */
  size() {
    return this.snapshots.length;
  }

  /** Returns the latest snapshot or null. */
  latest() {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /** Returns the snapshot at cursor (or latest when not scrubbing). */
  current() {
    if (this.cursor < 0) return this.latest();
    if (this.cursor >= this.snapshots.length) return this.latest();
    return this.snapshots[this.cursor];
  }

  /**
   * Step through snapshots using a wall-clock pace scaled by `speed`.
   * @param {number} dt seconds since last update
   */
  tickPlayback(dt) {
    if (!this.playing) return;
    if (this.snapshots.length === 0) return;
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.lastFrameTime += safeDt * this.speed;
    // Each snapshot covers `snapshotInterval` seconds of in-world time; playback advances one snapshot per interval
    if (this.lastFrameTime < this.snapshotInterval) return;
    this.lastFrameTime = 0;
    if (this.cursor < 0) {
      this.cursor = 0;
    } else if (this.cursor < this.snapshots.length - 1) {
      this.cursor += 1;
    } else {
      this.playing = false;
    }
    this._notify();
  }

  setPlaying(playing) {
    const next = !!playing;
    if (next && this.cursor >= this.snapshots.length - 1) {
      this.cursor = -1;
    }
    this.playing = next;
    this._notify();
  }

  setSpeed(speed) {
    const value = Number(speed);
    if (!Number.isFinite(value) || value <= 0) return;
    this.speed = Math.min(8, Math.max(0.25, value));
    this._notify();
  }

  /**
   * Move cursor by N positions; clamped to valid range.
   * @param {number} delta
   */
  step(delta) {
    if (this.snapshots.length === 0) return;
    let target;
    if (this.cursor < 0) {
      target = delta >= 0 ? 0 : this.snapshots.length - 1;
    } else {
      target = this.cursor + delta;
    }
    target = Math.max(0, Math.min(this.snapshots.length - 1, target));
    this.cursor = target;
    this._notify();
  }

  /**
   * Scrub to a specific cursor position (0..snapshots.length-1) or -1 to follow live.
   * @param {number} cursor
   */
  scrubTo(cursor) {
    const value = Number(cursor);
    if (!Number.isFinite(value) || value < 0) {
      this.cursor = -1;
    } else {
      this.cursor = Math.max(0, Math.min(this.snapshots.length - 1, Math.floor(value)));
    }
    this._notify();
  }

  subscribe(fn) {
    if (typeof fn === 'function') this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  _notify() {
    for (const fn of this.subscribers) {
      try {
        fn(this.snapshotState());
      } catch (error) {
        console.warn('ReplaySystem subscriber error', error);
      }
    }
  }

  /**
   * Build a serializable view of the current state for UI binding.
   * @returns {{size:number, cursor:number, playing:boolean, speed:number}}
   */
  snapshotState() {
    return {
      size: this.snapshots.length,
      cursor: this.cursor,
      playing: this.playing,
      speed: this.speed
    };
  }

  /**
   * Persist snapshots to localStorage so they survive page reloads.
   * Stored under a separate key so they don't bloat the main save data.
   */
  persist() {
    if (typeof localStorage === 'undefined') return false;
    try {
      const payload = {
        version: 1,
        savedAt: Date.now(),
        snapshots: this.snapshots.slice(-this.maxSnapshots)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('ReplaySystem.persist failed:', error);
      return false;
    }
  }

  /**
   * Load snapshots from localStorage on startup.
   * @returns {boolean}
   */
  loadFromStorage() {
    if (this._loadedFromStorage) return this.snapshots.length > 0;
    this._loadedFromStorage = true;
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.snapshots) ? parsed.snapshots : [];
      const cleaned = list
        .filter(entry => entry && typeof entry === 'object' && Number.isFinite(entry.t))
        .slice(-this.maxSnapshots);
      this.snapshots = cleaned;
      return cleaned.length > 0;
    } catch (error) {
      console.warn('ReplaySystem.loadFromStorage failed:', error);
      return false;
    }
  }

  clearStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('ReplaySystem.clearStorage failed:', error);
    }
  }

  /**
   * Build a JSON export payload for the current timeline.
   * @returns {{version:number, generatedAt:string, snapshots:Array}}
   */
  exportJSON() {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      snapshots: this.snapshots.map(snapshot => ({
        t: snapshot.t,
        snapshottedAt: snapshot.snapshottedAt,
        payload: snapshot.payload
      }))
    };
  }
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

export const replaySystem = new ReplaySystem();
