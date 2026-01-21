export const rand = (min=0, max=1) => Math.random()*(max-min)+min;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const dist2 = (ax,ay,bx,by) => { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };

export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => {
  if (a === b) return 0;
  return (v - a) / (b - a);
};
export const remap = (inMin, inMax, outMin, outMax, v) => {
  return lerp(outMin, outMax, clamp(invLerp(inMin, inMax, v), 0, 1));
};

// Box-Muller Gaussian
export function randn(mean=0, std=1) {
  const u = 1 - Math.random(), v = 1 - Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2*Math.PI*v);
  return mean + z * std;
}

export function wrap(x, max) {
  if (x < 0) return x + max;
  if (x >= max) return x - max;
  return x;
}
