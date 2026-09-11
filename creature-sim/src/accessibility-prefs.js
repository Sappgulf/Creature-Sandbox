/**
 * Accessibility preference helpers.
 *
 * Reduced motion is a first-class runtime switch: the UI toggle, the OS
 * preference, and the canvas renderers must all agree. Previously the renderer
 * checked `matchMedia` directly, so the in-app toggle only affected DOM CSS,
 * and two different localStorage keys disagreed about the stored value.
 *
 * The body class is the single authoritative runtime signal once the app has
 * booted; `matchMedia` is only used to resolve the initial preference.
 */

const REDUCED_MOTION_KEY = 'creatureSandboxReducedMotion';
const LEGACY_REDUCED_MOTION_KEY = 'creature-sim-reduced-motion';
const REDUCED_MOTION_CLASS = 'reduced-motion';

let _motionQuery = null;

function getMotionQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  if (!_motionQuery) {
    _motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  return _motionQuery;
}

/**
 * Resolve the preference to apply at boot: an explicit stored value wins,
 * otherwise the OS preference.
 * @returns {boolean}
 */
export function resolveReducedMotionPreference() {
  try {
    const stored = window.localStorage?.getItem(REDUCED_MOTION_KEY);
    if (stored === 'true' || stored === 'false') return stored === 'true';
    const legacy = window.localStorage?.getItem(LEGACY_REDUCED_MOTION_KEY);
    if (legacy === 'true' || legacy === 'false') return legacy === 'true';
  } catch {
    // Ignore storage errors and fall through to the OS preference.
  }
  return !!getMotionQuery()?.matches;
}

/**
 * Runtime check used by renderers and systems. The body class is authoritative
 * because a user may explicitly opt out even when the OS prefers reduced motion.
 * @returns {boolean}
 */
export function isReducedMotion() {
  if (typeof document !== 'undefined' && document.body) {
    return document.body.classList.contains(REDUCED_MOTION_CLASS);
  }
  return !!getMotionQuery()?.matches;
}

/**
 * Apply and persist the reduced-motion preference.
 * @param {boolean} enabled
 */
export function setReducedMotion(enabled) {
  const value = !!enabled;
  if (typeof document !== 'undefined') {
    document.body?.classList.toggle(REDUCED_MOTION_CLASS, value);
  }
  try {
    window.localStorage?.setItem(REDUCED_MOTION_KEY, String(value));
  } catch {
    // Storage may be unavailable (private mode); the class still applies.
  }
  return value;
}

export const REDUCED_MOTION_STORAGE_KEY = REDUCED_MOTION_KEY;
