/**
 * mulberry32 — tiny deterministic PRNG stream.
 * Accepts a uint32 or an arbitrary string (hashed via FNV-1a); returns a
 * function yielding values in [0, 1), usable as a Math.random replacement.
 * @param {number|string} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a;
  if (typeof seed === 'string') {
    a = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      a ^= seed.charCodeAt(i);
      a = Math.imul(a, 16777619);
    }
  } else {
    a = Number(seed) >>> 0;
  }
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-level world-seed indirection. Unset by default, in which case
// getRng() returns Math.random and every caller behaves exactly as before.
// Call setWorldSeed(seed) to opt into a deterministic global stream.
let _worldSeed = null;
let _worldRng = null;

/**
 * Opt into a deterministic global RNG stream (additive; no-op until called).
 * Pass null/undefined to clear and restore plain Math.random behavior.
 * @param {number|string|null|undefined} seed
 * @returns {?() => number} the active RNG, or null when cleared
 */
export function setWorldSeed(seed) {
  if (seed === null || seed === undefined) {
    _worldSeed = null;
    _worldRng = null;
    return null;
  }
  _worldSeed = seed;
  _worldRng = mulberry32(seed);
  return _worldRng;
}

/**
 * @returns {number|string|null} the active world seed, or null when unset
 */
export function getWorldSeed() {
  return _worldSeed;
}

/**
 * @returns {() => number} the active RNG, or Math.random when no seed is set
 */
export function getRng() {
  return _worldRng ?? Math.random;
}

export const rand = (min = 0, max = 1) => getRng()() * (max - min) + min;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx,
    dy = ay - by;
  return dx * dx + dy * dy;
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => {
  if (a === b) return 0;
  return (v - a) / (b - a);
};
export const remap = (inMin, inMax, outMin, outMax, v) => {
  return lerp(outMin, outMax, clamp(invLerp(inMin, inMax, v), 0, 1));
};

// Box-Muller Gaussian
export function randn(mean = 0, std = 1) {
  const rng = getRng();
  const u = 1 - rng(),
    v = 1 - rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

/**
 * Shortest signed rotation from `from` to `to`, in (-PI, PI].
 * Steering code that does `dir += (target - dir) * k` without this turns the
 * long way round whenever the two are more than half a turn apart, and `dir`
 * accumulates unbounded, so the raw difference can exceed a full rotation.
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
export function angleDelta(from, to) {
  const TAU = Math.PI * 2;
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function wrap(x, max) {
  if (x < 0) return x + max;
  if (x >= max) return x - max;
  return x;
}
