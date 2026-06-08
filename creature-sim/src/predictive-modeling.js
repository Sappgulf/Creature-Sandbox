/**
 * predictive-modeling.js — Logistic growth curve fitting for population projection
 *
 * Fits a logistic curve `P(t) = K / (1 + ((K - P0) / P0) * exp(-r * t))` to
 * historical population samples and projects forward. Returns confidence based
 * on sample count and a residual-based R².
 *
 * The model uses simple gradient-free fitting: closed-form estimation of K
 * (carrying capacity) from peak population, then line search over r.
 *
 * Pure logic (no DOM) so it can be unit tested.
 */

/**
 * Fit a logistic curve to a series of population samples.
 * @param {Array<{t:number, pop:number}>} samples - In-world time, population samples.
 * @param {Object} [options]
 * @param {number} [options.horizon=60] - Seconds to project forward.
 * @param {number} [options.maxIter=80] - Maximum iterations for r optimization.
 * @returns {{
 *   ok: boolean,
 *   r: number,
 *   K: number,
 *   P0: number,
 *   r2: number,
 *   confidence: 'high'|'medium'|'low',
 *   sampleCount: number,
 *   projected: Array<{t:number, pop:number}>,
 *   upperBand: Array<{t:number, pop:number}>,
 *   lowerBand: Array<{t:number, pop:number}>
 * }}
 */
export function fitLogistic(samples, options = {}) {
  const horizon = Math.max(1, Number(options.horizon) || 60);
  const maxIter = Math.max(10, Number(options.maxIter) || 80);

  if (!Array.isArray(samples) || samples.length < 5) {
    return emptyResult(horizon);
  }
  const cleaned = samples
    .filter(s => s && Number.isFinite(s.t) && Number.isFinite(s.pop) && s.pop >= 0)
    .map(s => ({ t: Number(s.t), pop: Number(s.pop) }))
    .sort((a, b) => a.t - b.t);
  if (cleaned.length < 5) {
    return emptyResult(horizon);
  }

  const P0 = Math.max(0.0001, cleaned[0].pop);
  const K = estimateCarryingCapacity(cleaned);
  if (!Number.isFinite(K) || K <= 0) {
    return emptyResult(horizon);
  }
  // Use the most recent sample as anchor; remap t to 0..latestT
  const t0 = cleaned[0].t;
  const lastT = cleaned[cleaned.length - 1].t;
  const lastPop = cleaned[cleaned.length - 1].pop;
  const series = cleaned.map(s => ({ t: s.t - t0, pop: s.pop }));
  const seriesLastT = lastT - t0;

  const r = estimateGrowthRate(series, K, maxIter);
  const fit = series.map(s => logistic(s.t, P0, K, r));
  const r2 = computeR2(
    series.map(s => s.pop),
    fit
  );

  // Project forward from the latest sample
  const lastAnchorPop = Math.max(P0, lastPop);
  const lastAnchorT = seriesLastT;
  const projected = [];
  const upperBand = [];
  const lowerBand = [];
  const stepSec = Math.max(1, horizon / 60);
  for (let dt = 0; dt <= horizon; dt += stepSec) {
    const tForward = lastAnchorT + dt;
    const pop = logistic(tForward, P0, K, r);
    projected.push({ t: tForward + t0, pop });
    const band = Math.max(pop * 0.1, 1);
    upperBand.push({ t: tForward + t0, pop: pop + band });
    lowerBand.push({ t: tForward + t0, pop: Math.max(0, pop - band) });
  }
  const confidence = confidenceFor(cleaned.length, r2);

  return {
    ok: true,
    r,
    K,
    P0: lastAnchorPop,
    r2,
    confidence,
    sampleCount: cleaned.length,
    projected,
    upperBand,
    lowerBand
  };
}

function logistic(t, P0, K, r) {
  const safeP0 = Math.max(0.0001, P0);
  const a = (K - safeP0) / safeP0;
  return K / (1 + a * Math.exp(-r * t));
}

function estimateCarryingCapacity(samples) {
  let peak = 0;
  for (const s of samples) if (s.pop > peak) peak = s.pop;
  // If growth is still happening, assume K is somewhat above the peak
  const last = samples[samples.length - 1].pop;
  if (last >= peak) {
    return Math.max(peak * 1.6, 50);
  }
  return Math.max(peak * 1.15, 50);
}

function estimateGrowthRate(series, K, maxIter) {
  // Closed-form approximation: r ≈ (1/Δt) * ln((K - P0) / (K - P1)) - P1 / P0) — too noisy.
  // Brute-force line search: minimize sum of squared residuals for r in [0.001, 1.5].
  let bestR = 0.05;
  let bestErr = Infinity;
  for (let i = 0; i < maxIter; i++) {
    const r = 0.001 + (1.5 - 0.001) * (i / (maxIter - 1));
    const err = squaredError(series, K, r);
    if (err < bestErr) {
      bestErr = err;
      bestR = r;
    }
  }
  // Local refinement around bestR
  const lo = Math.max(0.0005, bestR * 0.5);
  const hi = Math.min(3, bestR * 1.5);
  for (let i = 0; i < 30; i++) {
    const r = lo + ((hi - lo) * i) / 29;
    const err = squaredError(series, K, r);
    if (err < bestErr) {
      bestErr = err;
      bestR = r;
    }
  }
  return bestR;
}

function squaredError(series, K, r) {
  const P0 = Math.max(0.0001, series[0].pop);
  let total = 0;
  for (const s of series) {
    const fit = logistic(s.t, P0, K, r);
    const d = s.pop - fit;
    total += d * d;
  }
  return total;
}

function computeR2(actual, predicted) {
  if (actual.length === 0) return 0;
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const p = predicted[i];
    ssTot += (a - mean) * (a - mean);
    ssRes += (a - p) * (a - p);
  }
  if (ssTot <= 0) return 0;
  return Math.max(0, 1 - ssRes / ssTot);
}

function confidenceFor(sampleCount, r2) {
  if (sampleCount >= 30 && r2 >= 0.5) return 'high';
  if (sampleCount >= 15 && r2 >= 0.25) return 'medium';
  return 'low';
}

function emptyResult() {
  return {
    ok: false,
    r: 0,
    K: 0,
    P0: 0,
    r2: 0,
    confidence: 'low',
    sampleCount: 0,
    projected: [],
    upperBand: [],
    lowerBand: []
  };
}

/**
 * Read the most recent N samples from an analytics tracker.
 * @param {{samples?:Array}} tracker
 * @param {number} maxSamples
 * @returns {Array<{t:number, pop:number}>}
 */
export function readRecentSamples(tracker, maxSamples = 60) {
  if (!tracker || !Array.isArray(tracker.samples)) return [];
  const list = tracker.samples;
  const start = Math.max(0, list.length - maxSamples);
  const out = new Array(list.length - start);
  for (let i = start; i < list.length; i++) {
    const s = list[i];
    out[i - start] = { t: Number(s.t) || 0, pop: Number(s.pop) || 0 };
  }
  return out;
}
