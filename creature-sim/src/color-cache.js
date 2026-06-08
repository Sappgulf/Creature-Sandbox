/**
 * color-cache.js — Quantized CSS color string cache
 *
 * The hot per-creature draw loop allocates many CSS color strings every frame
 * (e.g. `hsl(${hue}, 80%, 55%)`). Each allocation produces GC pressure.
 * This module quantizes inputs to small buckets so similar colors share the
 * same string, returning stable references from a Map cache.
 *
 * Quantization buckets:
 *   hue:   5° steps   (72 distinct values, 0..355)
 *   sat:   5% steps   (21 distinct values, 0..100)
 *   light: 5% steps   (21 distinct values, 0..100)
 *   alpha: 1/8 steps  (8 distinct values, 0..1)
 *
 * These match the spec's "round to nearest 5 for hue, 10 for sat, 5 for light,
 * 8 for alpha" guidance, tuned for human-perceptible smoothness while keeping
 * the cache small (≤ ~30k entries for the 3-channel combo).
 */

/**
 * @param {number} v
 * @param {number} step
 * @param {number} max
 * @returns {number}
 */
function quantize(v, step, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const q = Math.round(n / step) * step;
  if (q < 0) return 0;
  if (q > max) return max;
  return q;
}

/**
 * @param {number} v
 * @returns {number}
 */
function qHue(v) {
  // Use modulo to wrap 360 → 0
  const q = quantize(v, 5, 360);
  return q % 360;
}

/**
 * @param {number} v
 * @returns {number}
 */
function qSat(v) {
  return quantize(v, 5, 100);
}

/**
 * @param {number} v
 * @returns {number}
 */
function qLight(v) {
  return quantize(v, 5, 100);
}

/**
 * @param {number} v
 * @returns {number}
 */
function qAlpha(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return Math.round(n * 8) / 8;
}

/**
 * @param {number} v
 * @returns {number}
 */
function qRgb(v) {
  // Quantize RGB channels to nearest 8 (0..255) — small visual difference,
  // big cache win.
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const q = Math.round(n / 8) * 8;
  if (q < 0) return 0;
  if (q > 255) return 255;
  return q;
}

export class ColorCache {
  /**
   * @param {{ maxEntries?: number }} [opts]
   */
  constructor(opts = {}) {
    this._hsl = new Map();
    this._hsla = new Map();
    this._rgba = new Map();
    this._hits = 0;
    this._misses = 0;
    this._maxEntries = opts.maxEntries ?? 4096;
  }

  /**
   * Returns a cached `hsl(H, S%, L%)` string. Quantized inputs collide
   * on the same string instance.
   *
   * @param {number} hue 0..360
   * @param {number} sat 0..100
   * @param {number} light 0..100
   * @returns {string}
   */
  cssHsl(hue, sat, light) {
    const h = qHue(hue);
    const s = qSat(sat);
    const l = qLight(light);
    const key = `${h}|${s}|${l}`;
    const cached = this._hsl.get(key);
    if (cached !== undefined) {
      this._hits++;
      return cached;
    }
    if (this._hsl.size >= this._maxEntries) {
      // Bail out without caching — return a fresh string but count as a miss.
      this._misses++;
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
    const str = `hsl(${h}, ${s}%, ${l}%)`;
    this._hsl.set(key, str);
    this._misses++;
    return str;
  }

  /**
   * Returns a cached `hsla(H, S%, L%, A)` string.
   *
   * @param {number} hue 0..360
   * @param {number} sat 0..100
   * @param {number} light 0..100
   * @param {number} alpha 0..1
   * @returns {string}
   */
  cssHsla(hue, sat, light, alpha) {
    const h = qHue(hue);
    const s = qSat(sat);
    const l = qLight(light);
    const a = qAlpha(alpha);
    const key = `${h}|${s}|${l}|${a}`;
    const cached = this._hsla.get(key);
    if (cached !== undefined) {
      this._hits++;
      return cached;
    }
    if (this._hsla.size >= this._maxEntries) {
      this._misses++;
      return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }
    const str = `hsla(${h}, ${s}%, ${l}%, ${a})`;
    this._hsla.set(key, str);
    this._misses++;
    return str;
  }

  /**
   * Returns a cached `rgba(R, G, B, A)` string with 8-step RGB and 1/8 alpha.
   *
   * @param {number} r 0..255
   * @param {number} g 0..255
   * @param {number} b 0..255
   * @param {number} alpha 0..1
   * @returns {string}
   */
  cssRgba(r, g, b, alpha) {
    const rr = qRgb(r);
    const gg = qRgb(g);
    const bb = qRgb(b);
    const a = qAlpha(alpha);
    const key = `${rr}|${gg}|${bb}|${a}`;
    const cached = this._rgba.get(key);
    if (cached !== undefined) {
      this._hits++;
      return cached;
    }
    if (this._rgba.size >= this._maxEntries) {
      this._misses++;
      return `rgba(${rr}, ${gg}, ${bb}, ${a})`;
    }
    const str = `rgba(${rr}, ${gg}, ${bb}, ${a})`;
    this._rgba.set(key, str);
    this._misses++;
    return str;
  }

  /**
   * Clears the cache. Call on zoom/quality change.
   * @returns {void}
   */
  reset() {
    this._hsl.clear();
    this._hsla.clear();
    this._rgba.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * @returns {{ hits: number, misses: number, size: number, hitRate: number }}
   */
  getStats() {
    const total = this._hits + this._misses;
    const hits = this._hits;
    const misses = this._misses;
    const size = this._hsl.size + this._hsla.size + this._rgba.size;
    return {
      hits,
      misses,
      size,
      hitRate: total > 0 ? hits / total : 0
    };
  }
}

/**
 * Shared singleton. Pre-bound for the hot per-creature draw loop.
 */
export const colorCache = new ColorCache();

// Expose for debug/inspection from the browser console.
if (typeof globalThis !== 'undefined') {
  globalThis.__colorCache = colorCache;
}
