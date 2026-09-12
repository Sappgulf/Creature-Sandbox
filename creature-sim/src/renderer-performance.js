/**
 * Renderer Performance Monitor - Handles culling, LOD, and performance optimizations
 * ENHANCED: Added quality presets and FPS-based dynamic quality scaling
 */
import { RendererConfig } from './renderer-config.js';

export class RendererPerformanceMonitor {
  constructor(renderer) {
    this.renderer = renderer;
    this.stats = {
      rendered: 0,
      culled: 0,
      totalObjects: 0,
      frameTime: 0,
      lastFrameTime: performance.now()
    };

    // ENHANCEMENT: FPS tracking for quality scaling
    this.fpsHistory = new Array(60).fill(60); // Rolling average
    this.fpsHistoryIndex = 0;
    this.currentFps = 60;
    this.frameCount = 0;
    this._lastFrameTimestamp = performance.now();
    this._fpsFrameCounter = 0;
    this._fpsSampleCount = 0;
    this._lastFpsSample = 60;
    this._qualityRecoveryStreak = 0;

    // ENHANCEMENT: Quality preset tracking
    this.currentQuality = 'high';
    this.qualityOverride = null;
    this.qualityLockTimer = 0; // Prevent rapid quality changes
    this.qualityLockDuration = 120; // ~2 seconds at 60fps

    // Phase 2: per-renderer-instance thresholds. These are seeded from the
    // global defaults but never written back, so one renderer's adaptive
    // scaling cannot shift culling for every other renderer/worker.
    this.cullDistance = RendererConfig.THRESHOLDS.CULL_DISTANCE;
    this.maxRenderedObjects = RendererConfig.THRESHOLDS.MAX_RENDERED_OBJECTS;

    // Detect mobile for default quality
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    if (isMobile) {
      this.currentQuality = 'medium';
      this.applyQualityPreset('medium');
    }

    this.reset();
  }

  /**
   * Apply a quality preset to the renderer.
   * Phase 2 split: only PERF knobs (particle caps, shadow/heatmap cost,
   * render budgets, cache intervals) are applied. Visibility overlays
   * (miniMap, nameLabels, traitViz, trails, clustering) are player-controlled
   * and are NEVER toggled here.
   */
  applyQualityPreset(presetName) {
    const preset = RendererConfig.QUALITY_PRESETS[presetName];
    if (!preset || !this.renderer) return;

    this.currentQuality = presetName;

    // Apply preset settings to renderer (perf only)
    if (this.renderer.particles) {
      this.renderer.particles.maxParticles = preset.maxParticles;
    }

    // NOTE: preset.trailsEnabled / clusteringEnabled / miniMapEnabled /
    // nameLabelsEnabled / traitVisualizationEnabled are intentionally NOT
    // applied. Genetic clustering is a *visualization* mode, not a quality
    // level: it replaces every creature's own hue with one of six k-means
    // cluster colours. Only the player toggles these (see renderer-features.js
    // and RendererConfig.QUALITY_VISIBILITY_KEYS).
    // Per-instance budget (never mutates the shared RendererConfig).
    this.maxRenderedObjects = preset.maxRenderedCreatures;

    // Update heatmap cache interval
    if (this.renderer._heatmapCache) {
      this.renderer._heatmapCache.updateInterval = preset.miniMapUpdateInterval;
    }

    console.debug(`🎨 Quality set to: ${presetName}`);
  }

  reset() {
    this.stats.rendered = 0;
    this.stats.culled = 0;
    this.stats.totalObjects = 0;
  }

  beginFrame() {
    this.reset();
    this.stats.lastFrameTime = performance.now();

    // Track real FPS using frame timestamps
    this._fpsFrameCounter++;
    const now = performance.now();
    const elapsed = now - this._lastFrameTimestamp;
    if (elapsed >= 1000) {
      const realFps = (this._fpsFrameCounter * 1000) / elapsed;
      this._lastFpsSample = realFps;
      this.fpsHistory[this.fpsHistoryIndex] = realFps;
      this.fpsHistoryIndex = (this.fpsHistoryIndex + 1) % this.fpsHistory.length;
      this._fpsSampleCount = Math.min(this._fpsSampleCount + 1, this.fpsHistory.length);
      this._lastFrameTimestamp = now;
      this._fpsFrameCounter = 0;
    }
  }

  endFrame() {
    this.stats.frameTime = performance.now() - this.stats.lastFrameTime;
  }

  // Get performance statistics
  getStats() {
    return {
      ...this.stats,
      quality: this.currentQuality,
      currentFps: Number(this.currentFps.toFixed(2)),
      lastFpsSample: Number(this._lastFpsSample.toFixed(2)),
      fpsSampleCount: this._fpsSampleCount,
      qualityRecoveryStreak: this._qualityRecoveryStreak,
      qualityLockTimer: this.qualityLockTimer,
      cullDistance: this.cullDistance,
      maxRenderedObjects: this.maxRenderedObjects,
      cullRatio: this.stats.totalObjects > 0 ? this.stats.culled / this.stats.totalObjects : 0,
      renderEfficiency: this.stats.totalObjects > 0 ? this.stats.rendered / this.stats.totalObjects : 0
    };
  }

  /**
   * Adaptive quality adjustment based on FPS
   * ENHANCED: Uses quality presets for smoother transitions
   */
  adjustQuality() {
    this.frameCount++;

    // FPS is now updated in beginFrame() using real frame counting.
    // Use only real samples so startup does not promote quality from the
    // initial all-60 placeholder history before the browser has settled.
    const sampleCount = Math.max(1, this._fpsSampleCount);
    let sum = 0;
    for (let i = 0; i < sampleCount; i++) {
      sum += this.fpsHistory[i];
    }
    this.currentFps = sum / sampleCount;

    // Quality overrides (battery saver, main-thread fallback) should pin the
    // preset, not the telemetry: compute currentFps first so the reported FPS
    // is real even while adaptive changes are disabled.
    if (this.qualityOverride) return;

    // Decrement quality lock timer
    if (this.qualityLockTimer > 0) {
      this.qualityLockTimer--;
      return;
    }

    // Quality preset transitions based on FPS
    const presets = ['low', 'medium', 'high', 'ultra'];
    const currentIndex = presets.indexOf(this.currentQuality);

    // Downgrade quality if FPS too low
    if (this.currentFps < 25 && currentIndex > 0) {
      this._qualityRecoveryStreak = 0;
      this.applyQualityPreset(presets[currentIndex - 1]);
      this.qualityLockTimer = this.qualityLockDuration;
    } else {
      const recovering = this._fpsSampleCount >= 2 && this.currentFps > 50 && this._lastFpsSample > 52;
      this._qualityRecoveryStreak = recovering ? this._qualityRecoveryStreak + 1 : 0;
    }

    // Upgrade quality after sustained real samples, so temporary dips recover without flapping.
    if (this._qualityRecoveryStreak >= 2 && currentIndex < presets.length - 1) {
      this._qualityRecoveryStreak = 0;
      this.applyQualityPreset(presets[currentIndex + 1]);
      this.qualityLockTimer = this.qualityLockDuration;
    }

    // Preserve the preset's per-instance creature budget. The old floor of 500
    // silently invalidated the low/medium presets (100/200) every frame.
    const presetFloor = RendererConfig.QUALITY_PRESETS[this.currentQuality]?.maxRenderedCreatures ?? 100;
    this.maxRenderedObjects = Math.max(presetFloor, Math.min(2000, this.maxRenderedObjects));
  }

  /**
   * Get current quality preset name
   */
  getCurrentQuality() {
    return this.currentQuality;
  }

  setQualityOverride(presetName = null) {
    if (!presetName) {
      this.qualityOverride = null;
      return;
    }
    if (!RendererConfig.QUALITY_PRESETS[presetName]) return;
    this.qualityOverride = presetName;
    this.applyQualityPreset(presetName);
  }

  /**
   * Get current FPS (rolling average)
   */
  getCurrentFps() {
    return this.currentFps;
  }
}
