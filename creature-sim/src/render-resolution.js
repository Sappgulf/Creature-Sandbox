/**
 * render-resolution.js — Owns the canvas backing-store scale.
 *
 * The old behaviour pinned the backing store to a fixed sub-1 fraction of the
 * CSS box (0.82 on desktop, 0.9 on mobile) and ignored devicePixelRatio
 * entirely. On a 2x display that rendered the world at 0.41x native, and on a
 * 3x phone at 0.30x — every creature, label and sprite was upscaled by the
 * compositor, which is why the field read as soft coloured dots.
 *
 * Resolution now starts at the device pixel ratio (capped, because a 3x phone
 * at full native is four times the fill rate of a 1.5x one for no visible
 * gain) and only steps *down* when measured FPS says the device cannot hold
 * the frame budget. It never drops below 1.0, so the world is never blurrier
 * than the CSS box it occupies.
 */

// Highest backing-store scale we will ever request. Beyond ~2x the extra
// samples are invisible on a hand-held display but cost real fill rate.
const MAX_SCALE_DESKTOP = 2;
const MAX_SCALE_MOBILE = 2;

// Never render below CSS resolution — that is the bug this module exists to
// fix. Under sustained load we shed sharpness down to, but not past, 1:1.
const MIN_SCALE = 1;

// Discrete rungs keep resizes rare and predictable; a continuously varying
// scale would reallocate the backing store every couple of seconds.
const LADDER = [1, 1.25, 1.5, 1.75, 2];

const FPS_DEGRADE_BELOW = 45;
const FPS_RESTORE_ABOVE = 57;

// How long a device must sit below/above the thresholds before we react, so a
// single hitch (a disaster event, a panel opening) never costs sharpness.
const DEGRADE_HOLD_MS = 3000;
const RESTORE_HOLD_MS = 12000;

// The very first climb, off the warm-up rung, happens sooner: by then the
// expensive boot work is done and the device has shown it can keep up.
const FIRST_RESTORE_HOLD_MS = 4000;

function ladderIndexFor(scale) {
  let best = 0;
  for (let i = 0; i < LADDER.length; i++) {
    if (LADDER[i] <= scale + 1e-6) best = i;
  }
  return best;
}

class RenderResolution {
  constructor() {
    this.maxScale = MAX_SCALE_DESKTOP;
    this.index = LADDER.length - 1;
    this.scale = LADDER[this.index];
    this.onChange = null;
    this._hasStarted = false;
    this._belowSince = 0;
    this._aboveSince = 0;
    this._lastChange = 0;
  }

  /**
   * Seed the ceiling from the device. Called once at bootstrap and again on
   * resize, since dragging a window between displays changes devicePixelRatio.
   */
  configure({ mobile = false, lowMemory = false } = {}) {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    let ceiling = mobile ? MAX_SCALE_MOBILE : MAX_SCALE_DESKTOP;
    // A low-memory phone gets a 1.5x ceiling: still sharp against the CSS box,
    // but a third of the pixels of full 2x.
    if (lowMemory) ceiling = Math.min(ceiling, 1.5);

    this.maxScale = Math.max(MIN_SCALE, Math.min(dpr, ceiling));
    this.maxIndex = ladderIndexFor(this.maxScale);

    // Start one rung below the ceiling and let the FPS watcher climb. Boot is
    // the most expensive stretch of the session — sprite caches, the biome
    // ground, the decoration index and the first full frame all land at once
    // — and paying for the top rung through all of it lengthens the very
    // tasks that block first interaction. One rung down is 1.75x vs 2x on a
    // retina display, which is not a difference anyone sees, and it is back
    // at the ceiling within the restore window once the device proves it can
    // hold the frame budget.
    if (!this._hasStarted) {
      this._hasStarted = true;
      this.index = Math.max(0, this.maxIndex - 1);
    }
    if (this.index > this.maxIndex) this.index = this.maxIndex;
    this.scale = LADDER[this.index];
    return this.scale;
  }

  getScale() {
    return this.scale;
  }

  /**
   * Feed measured FPS in. Returns true when the scale changed, so the caller
   * can resize the backing store.
   */
  notifyFps(fps, now = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
    if (!Number.isFinite(fps) || fps <= 0) return false;

    // Ignore samples taken right after a resize; the first frames on a new
    // backing store are always slow and would cascade us straight to 1x.
    if (now - this._lastChange < 2000) return false;

    if (fps < FPS_DEGRADE_BELOW) {
      this._aboveSince = 0;
      if (!this._belowSince) this._belowSince = now;
      if (now - this._belowSince >= DEGRADE_HOLD_MS && this.index > 0) {
        this.index -= 1;
        return this._commit(now);
      }
      return false;
    }

    if (fps > FPS_RESTORE_ABOVE) {
      this._belowSince = 0;
      if (!this._aboveSince) this._aboveSince = now;
      const hold = this._hasRestoredOnce ? RESTORE_HOLD_MS : FIRST_RESTORE_HOLD_MS;
      if (now - this._aboveSince >= hold && this.index < this.maxIndex) {
        this._hasRestoredOnce = true;
        this.index += 1;
        return this._commit(now);
      }
      return false;
    }

    this._belowSince = 0;
    this._aboveSince = 0;
    return false;
  }

  _commit(now) {
    this.scale = LADDER[this.index];
    this._belowSince = 0;
    this._aboveSince = 0;
    this._lastChange = now;
    this.onChange?.(this.scale);
    return true;
  }
}

export const renderResolution = new RenderResolution();
export { LADDER as RENDER_SCALE_LADDER, MIN_SCALE as MIN_RENDER_SCALE };
