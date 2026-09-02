/**
 * opening-hold.js — Keeps the composed opening frame intact until the player
 * is actually looking at it.
 *
 * `applyStarterGlade()` stages a deliberate tableau at world centre: two loose
 * herbivore herds, an omnivore between them, burrowers and a flier at the
 * edges of a clearing, a predator circling, and a ring of food. The camera
 * opens on it.
 *
 * The player never saw it. Between `world.seed()` and the first look there is
 * module load, worker handshake, an onboarding overlay animating in, and
 * however long it takes to read a card — several seconds of simulation at full
 * speed, by which point the tableau has walked apart and the opening frame is
 * a scattering of dots on open ground.
 *
 * So the world holds still until the player does something. Rendering keeps
 * running the whole time — day/night, parallax, ambient motion — this only
 * stops the simulation clock, so the frame reads as a held photograph rather
 * than a frozen game.
 *
 * It releases on the first real input (which includes clicking Next or Skip on
 * an onboarding card) or after a hard cap, whichever comes first. The cap
 * matters: a hold that fails to release would look exactly like a hang.
 */

const RELEASE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
const DEFAULT_MAX_MS = 12000;

// The hold begins inside startNewGame(), which is itself running from a click
// on "New Sandbox". That click keeps propagating, reaches the capture-phase
// listener attached microseconds earlier, and releases the hold before a
// single frame has been drawn. Ignore input for long enough for the gesture
// that started the game to finish.
const INPUT_GRACE_MS = 400;

class OpeningHold {
  constructor() {
    this.holding = false;
    this.startedAt = 0;
    this.maxMs = DEFAULT_MAX_MS;
    this._listener = null;
    this._reason = null;
  }

  /**
   * Begin holding the simulation clock. Safe to call repeatedly; a second
   * call restarts the window rather than stacking.
   */
  begin({ maxMs = DEFAULT_MAX_MS } = {}) {
    this.release('restart');
    if (typeof window === 'undefined') return;

    this.holding = true;
    this.maxMs = maxMs;
    this.startedAt = this._now();

    this._listener = () => {
      if (this._now() - this.startedAt < INPUT_GRACE_MS) return;
      this.release('input');
    };
    for (const type of RELEASE_EVENTS) {
      // Capture phase so a card's own click handler cannot swallow it, and
      // passive because we never preventDefault here.
      window.addEventListener(type, this._listener, { capture: true, passive: true });
    }
  }

  /**
   * Whether the simulation clock should stay at zero. Also enforces the cap,
   * so callers do not need their own timer.
   */
  isHolding() {
    if (!this.holding) return false;
    if (this._now() - this.startedAt >= this.maxMs) {
      this.release('timeout');
      return false;
    }
    return true;
  }

  release(reason = 'manual') {
    if (!this.holding) {
      this._detach();
      return;
    }
    this.holding = false;
    this._reason = reason;
    this._detach();
    console.debug(`🎬 Opening hold released (${reason})`);
  }

  /** Why the most recent hold ended — useful when debugging a stuck opening. */
  get lastReleaseReason() {
    return this._reason;
  }

  _detach() {
    if (!this._listener || typeof window === 'undefined') return;
    for (const type of RELEASE_EVENTS) {
      window.removeEventListener(type, this._listener, { capture: true });
    }
    this._listener = null;
  }

  _now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

export const openingHold = new OpeningHold();
