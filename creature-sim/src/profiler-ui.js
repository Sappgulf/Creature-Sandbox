/**
 * profiler-ui.js
 *
 * Rich in-game performance overlay. Surfaces the existing `PerformanceProfiler`
 * data (FPS, frame time, memory, draw calls, slow frames) plus a derived
 * quality-level indicator and GC warnings. Toggle with F8.
 *
 * Design goals:
 *   - Lazy: only construct the DOM when first shown.
 *   - Cheap: re-render at most every `updateInterval` ms.
 *   - Read-only: never mutates profiler state.
 *   - Safe: all user-visible strings go through `escapeHtml`.
 */

import { escapeHtml } from './safe-html.js';

const TOGGLE_KEY = 'F8';
const FPS_HISTORY_SIZE = 60;
const SLOW_FRAMES_WINDOW_MS = 30000;
const UPDATE_INTERVAL_MS = 250;

/**
 * Compute a basic percentile from a sorted numeric array.
 * @param {number[]} sorted
 * @param {number} p percentile in [0, 1]
 * @returns {number}
 */
function percentile(sorted, p) {
  if (!sorted || sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Filter a sample list to a recent time window.
 * @param {Array<{timestamp: number, frameTime: number}>} samples
 * @param {number} windowMs
 * @returns {Array}
 */
function filterByWindow(samples, windowMs) {
  if (!Array.isArray(samples) || samples.length === 0) return [];
  const cutoff = performance.now() - windowMs;
  return samples.filter(s => s.timestamp >= cutoff);
}

/**
 * Try to derive a quality level from a world's renderer.
 * Returns null when no renderer is available.
 * @param {Object} world
 * @returns {{level: string, reason: string} | null}
 */
function detectQualityLevel(world) {
  const perf = world?.renderer?.performance;
  if (!perf) return null;
  const level = perf.getCurrentQuality?.() || perf.currentQuality || null;
  if (!level) return null;
  // Provide a brief "why" string based on known fields.
  const reasons = [];
  if (typeof perf.targetFps === 'number') reasons.push(`target ${perf.targetFps}fps`);
  if (perf.qualityOverride) reasons.push('override active');
  else if (perf._qualityRecoveryStreak) reasons.push(`recovery streak ${perf._qualityRecoveryStreak}`);
  if (perf.qualityLockTimer > 0) reasons.push(`locked (${Math.round(perf.qualityLockTimer)}f)`);
  return { level, reason: reasons.length ? reasons.join(', ') : 'auto' };
}

/**
 * Build a sparkline SVG from a list of FPS values.
 * Returns the SVG markup as a string. Always returns a valid SVG element.
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
function renderFpsSparkline(values, width = 160, height = 24) {
  if (!values || values.length < 2) {
    return `<svg class="profiler-sparkline" width="${width}" height="${height}" aria-hidden="true"></svg>`;
  }
  const min = 0;
  const max = 90; // clamp display at 90 to leave headroom
  const stepX = width / (values.length - 1);
  let path = '';
  values.forEach((v, i) => {
    const clamped = Math.max(min, Math.min(max, v));
    const x = i * stepX;
    const y = height - (clamped / max) * height;
    path += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return `<svg class="profiler-sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${escapeHtml(path)}" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>`;
}

/**
 * Build a frame-time distribution summary (min/p50/p95/p99/max) over a window.
 * @param {Array<{frameTime: number}>} samples
 * @returns {{min: number, p50: number, p95: number, p99: number, max: number}}
 */
function summarizeFrameTimes(samples) {
  if (!samples || samples.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }
  const values = samples.map(s => s.frameTime).filter(n => Number.isFinite(n) && n >= 0);
  if (values.length === 0) return { min: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1]
  };
}

/**
 * Find the top N slowest frame samples in a window.
 * @param {Array<{timestamp: number, frameTime: number}>} samples
 * @param {number} n
 * @returns {Array<{timestamp: number, frameTime: number}>}
 */
function slowestFrames(samples, n = 5) {
  if (!Array.isArray(samples) || samples.length === 0) return [];
  return [...samples]
    .filter(s => Number.isFinite(s?.frameTime))
    .sort((a, b) => b.frameTime - a.frameTime)
    .slice(0, n);
}

/**
 * Detect a probable GC event by sampling heapUsed deltas.
 * Returns a short warning message, or null when no spike is detected.
 * @param {Array<{timestamp: number, heapUsed: number}>} samples
 * @returns {string|null}
 */
function detectGcSpike(samples) {
  if (!Array.isArray(samples) || samples.length < 4) return null;
  const last = samples[samples.length - 1];
  if (!last || typeof last.heapUsed !== 'number' || last.heapUsed <= 0) return null;
  const baseline = samples[samples.length - Math.min(samples.length, 30)];
  if (!baseline || typeof baseline.heapUsed !== 'number' || baseline.heapUsed <= 0) return null;
  const delta = last.heapUsed - baseline.heapUsed;
  // Spike = >5MB jump in the last ~30 samples.
  if (delta > 5 * 1024 * 1024) {
    return `Heap grew by ${(delta / 1024 / 1024).toFixed(1)}MB in the last ~30 samples`;
  }
  return null;
}

export class ProfilerUI {
  /**
   * @param {Object} profiler - An instance of `PerformanceProfiler`.
   * @param {Object} [deps]
   * @param {Object} [deps.world] - World object (for renderer quality info).
   */
  constructor(profiler, deps = {}) {
    this.profiler = profiler;
    this.world = deps.world || null;
    this.isVisible = false;
    this.lastUpdate = 0;
    this.fpsHistory = [];
    this._keyHandler = this._onKeyDown.bind(this);
    this._render = this._render.bind(this);
    this._ensureDom();
  }

  /**
   * Lazily create the DOM scaffolding. Hidden by default.
   * @private
   */
  _ensureDom() {
    if (this.root) return;
    this.root = document.createElement('div');
    this.root.id = 'profiler-overlay';
    this.root.className = 'profiler-overlay dev-fps';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Performance profiler overlay');
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="profiler-header">
        <span class="profiler-title">📈 Profiler</span>
        <span class="profiler-stats" data-bind="status">—</span>
      </div>
      <div class="profiler-stats" data-bind="fps">
        FPS: <span data-bind="fps-1s">--</span> /
        <span data-bind="fps-5s">--</span> /
        <span data-bind="fps-30s">--</span>
        <span data-bind="fps-spark" class="profiler-spark-host"></span>
      </div>
      <div class="profiler-stats" data-bind="frame-time">
        Frame ms (5s): min <span data-bind="ft-min">--</span> ·
        p50 <span data-bind="ft-p50">--</span> ·
        p95 <span data-bind="ft-p95">--</span> ·
        p99 <span data-bind="ft-p99">--</span> ·
        max <span data-bind="ft-max">--</span>
      </div>
      <div class="profiler-stats" data-bind="memory">
        Memory: <span data-bind="mem-used">--</span> /
        <span data-bind="mem-total">--</span> MB
      </div>
      <div class="profiler-stats" data-bind="quality">
        Quality: <span data-bind="quality-level">--</span>
        <span class="profiler-quality-reason" data-bind="quality-reason"></span>
      </div>
      <div class="profiler-stats" data-bind="slow">
        Slowest 30s:
        <ul class="profiler-slow-list" data-bind="slow-list"></ul>
      </div>
      <div class="profiler-stats profiler-warnings" data-bind="warnings" hidden>
        <span data-bind="warnings-text"></span>
      </div>
    `;
    document.body.appendChild(this.root);
    // Cache element references.
    this._els = {
      status: this.root.querySelector('[data-bind="status"]'),
      fps1: this.root.querySelector('[data-bind="fps-1s"]'),
      fps5: this.root.querySelector('[data-bind="fps-5s"]'),
      fps30: this.root.querySelector('[data-bind="fps-30s"]'),
      fpsSpark: this.root.querySelector('[data-bind="fps-spark"]'),
      ftMin: this.root.querySelector('[data-bind="ft-min"]'),
      ftP50: this.root.querySelector('[data-bind="ft-p50"]'),
      ftP95: this.root.querySelector('[data-bind="ft-p95"]'),
      ftP99: this.root.querySelector('[data-bind="ft-p99"]'),
      ftMax: this.root.querySelector('[data-bind="ft-max"]'),
      memUsed: this.root.querySelector('[data-bind="mem-used"]'),
      memTotal: this.root.querySelector('[data-bind="mem-total"]'),
      qualityLevel: this.root.querySelector('[data-bind="quality-level"]'),
      qualityReason: this.root.querySelector('[data-bind="quality-reason"]'),
      slowList: this.root.querySelector('[data-bind="slow-list"]'),
      warnings: this.root.querySelector('[data-bind="warnings"]'),
      warningsText: this.root.querySelector('[data-bind="warnings-text"]')
    };
  }

  /**
   * Mount global keyboard handler. Safe to call multiple times.
   */
  attach() {
    if (this._attached) return;
    window.addEventListener('keydown', this._keyHandler);
    this._attached = true;
  }

  /**
   * Remove global keyboard handler.
   */
  detach() {
    window.removeEventListener('keydown', this._keyHandler);
    this._attached = false;
  }

  /**
   * Toggle overlay visibility.
   */
  toggle() {
    if (!this.root) this._ensureDom();
    this.isVisible = !this.isVisible;
    this.root.hidden = !this.isVisible;
    if (this.isVisible) this._render();
  }

  /**
   * Show the overlay.
   */
  show() {
    if (!this.root) this._ensureDom();
    this.isVisible = true;
    this.root.hidden = false;
    this._render();
  }

  /**
   * Hide the overlay.
   */
  hide() {
    if (!this.root) return;
    this.isVisible = false;
    this.root.hidden = true;
  }

  /**
   * Update the world reference (e.g. after a reset).
   * @param {Object} world
   */
  setWorld(world) {
    this.world = world;
  }

  /**
   * Per-frame update. Cheaply throttled to UPDATE_INTERVAL_MS.
   * Call this from the main render loop.
   */
  update() {
    if (!this.isVisible) return;
    const now = performance.now();
    if (now - this.lastUpdate < UPDATE_INTERVAL_MS) return;
    this.lastUpdate = now;
    this._render();
  }

  /**
   * @param {KeyboardEvent} e
   * @private
   */
  _onKeyDown(e) {
    if (e.key === TOGGLE_KEY || e.code === TOGGLE_KEY) {
      // Don't hijack when the user is typing in a field.
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      this.toggle();
    }
  }

  /**
   * Pull fresh stats from the profiler and rewrite the DOM in place.
   * Uses textContent / innerHTML only with escaped strings.
   * @private
   */
  _render() {
    if (!this.root || !this.profiler) return;
    const stats = this.profiler.getStats ? this.profiler.getStats() : null;
    if (!stats) return;
    const samples = Array.isArray(this.profiler.samples) ? this.profiler.samples : [];
    const fpsNow = stats.current.fps || 0;
    this._updateFpsHistory(fpsNow);

    // FPS averages (1s, 5s, 30s) from rolling samples
    const last1 = filterByWindow(samples.slice(-60), 1000);
    const last5 = filterByWindow(samples, 5000);
    const last30 = filterByWindow(samples, 30000);
    const avgFps1 = averageFps(last1);
    const avgFps5 = averageFps(last5);
    const avgFps30 = averageFps(last30);

    this._els.fps1.textContent = avgFps1.toFixed(1);
    this._els.fps5.textContent = avgFps5.toFixed(1);
    this._els.fps30.textContent = avgFps30.toFixed(1);
    this._els.fpsSpark.innerHTML = renderFpsSparkline(this.fpsHistory);

    // Frame time distribution over 5s
    const ft = summarizeFrameTimes(last5);
    this._els.ftMin.textContent = ft.min.toFixed(1);
    this._els.ftP50.textContent = ft.p50.toFixed(1);
    this._els.ftP95.textContent = ft.p95.toFixed(1);
    this._els.ftP99.textContent = ft.p99.toFixed(1);
    this._els.ftMax.textContent = ft.max.toFixed(1);

    // Memory
    if (typeof performance !== 'undefined' && performance.memory) {
      const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
      const totalMB = performance.memory.totalJSHeapSize / (1024 * 1024);
      this._els.memUsed.textContent = usedMB.toFixed(1);
      this._els.memTotal.textContent = totalMB.toFixed(1);
    } else {
      this._els.memUsed.textContent = 'n/a';
      this._els.memTotal.textContent = 'n/a';
    }

    // Quality level
    const quality = detectQualityLevel(this.world);
    if (quality) {
      this._els.qualityLevel.textContent = quality.level;
      this._els.qualityReason.textContent = quality.reason ? `(${quality.reason})` : '';
    } else {
      this._els.qualityLevel.textContent = 'n/a';
      this._els.qualityReason.textContent = '';
    }

    // Slowest frames in 30s
    const slow = slowestFrames(filterByWindow(samples, SLOW_FRAMES_WINDOW_MS), 5);
    if (slow.length === 0) {
      this._els.slowList.innerHTML = '<li class="profiler-empty">No slow frames in window</li>';
    } else {
      const items = slow
        .map(s => {
          const t = new Date(s.timestamp).toISOString().slice(11, 19);
          return `<li>${escapeHtml(t)} — ${s.frameTime.toFixed(1)}ms</li>`;
        })
        .join('');
      this._els.slowList.innerHTML = items;
    }

    // Warnings
    const warnings = [];
    const gcWarning = detectGcSpike(samples);
    if (gcWarning) warnings.push(`⚠️ GC: ${gcWarning}`);
    if (avgFps5 > 0 && avgFps5 < 30) warnings.push('⚠️ 5s avg FPS below 30');
    if (ft.p99 > 100) warnings.push(`⚠️ p99 frame time ${ft.p99.toFixed(1)}ms exceeds 100ms budget`);
    if (warnings.length === 0) {
      this._els.warnings.hidden = true;
    } else {
      this._els.warnings.hidden = false;
      this._els.warningsText.textContent = warnings.join('  •  ');
    }

    // Status line: how many samples are in the buffer.
    this._els.status.textContent = `samples: ${samples.length} · alerts: ${stats.alerts?.length || 0}`;
  }

  /**
   * @param {number} fps
   * @private
   */
  _updateFpsHistory(fps) {
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > FPS_HISTORY_SIZE) this.fpsHistory.shift();
  }

  /**
   * Destroy the overlay and clean up listeners.
   */
  destroy() {
    this.detach();
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}

/**
 * Compute average FPS over a sample window.
 * Returns 0 when no samples are present.
 * @param {Array<{fps: number, frameTime: number}>} samples
 * @returns {number}
 */
export function averageFps(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const s of samples) {
    // Prefer the precomputed fps field; fall back to 1000 / frameTime.
    if (Number.isFinite(s.fps) && s.fps > 0) {
      sum += s.fps;
    } else if (Number.isFinite(s.frameTime) && s.frameTime > 0) {
      sum += 1000 / s.frameTime;
    } else {
      continue;
    }
    count++;
  }
  return count > 0 ? sum / count : 0;
}

export const PROFILER_TOGGLE_KEY = TOGGLE_KEY;
