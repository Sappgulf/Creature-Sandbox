export const rand = (min = 0, max = 1) => Math.random() * (max - min) + min;
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
  const u = 1 - Math.random(),
    v = 1 - Math.random();
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
