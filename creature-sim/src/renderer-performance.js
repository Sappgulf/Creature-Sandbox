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

    // ENHANCEMENT: Quality preset tracking
    this.currentQuality = 'high';
    this.qualityLockTimer = 0; // Prevent rapid quality changes
    this.qualityLockDuration = 120; // ~2 seconds at 60fps

    // Detect mobile for default quality
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    if (isMobile) {
      this.currentQuality = 'medium';
      this.applyQualityPreset('medium');
    }

    this.reset();
  }

  /**
   * Apply a quality preset to the renderer
   */
  applyQualityPreset(presetName) {
    const preset = RendererConfig.QUALITY_PRESETS[presetName];
    if (!preset || !this.renderer) return;

    this.currentQuality = presetName;

    // Apply preset settings to renderer
    if (this.renderer.particles) {
      this.renderer.particles.maxParticles = preset.maxParticles;
    }

    this.renderer.enableTrails = preset.trailsEnabled;
    this.renderer.enableClustering = preset.clusteringEnabled;
    this.renderer.enableMiniMap = preset.miniMapEnabled;
    this.renderer.enableNameLabels = preset.nameLabelsEnabled;
    this.renderer.enableTraitVisualization = preset.traitVisualizationEnabled;

    // Update heatmap cache interval
    if (this.renderer._heatmapCache) {
      this.renderer._heatmapCache.updateInterval = preset.miniMapUpdateInterval;
    }

    console.log(`🎨 Quality set to: ${presetName}`);
  }

  reset() {
    this.stats.rendered = 0;
    this.stats.culled = 0;
    this.stats.totalObjects = 0;
  }

  beginFrame() {
    this.reset();
    this.stats.lastFrameTime = performance.now();
  }

  endFrame() {
    this.stats.frameTime = performance.now() - this.stats.lastFrameTime;
  }

  // Distance-based culling
  shouldCull(x, y, camera) {
    const viewport = camera.getViewportBounds();
    const distance = this.getDistanceFromViewport(x, y, viewport);

    return distance > RendererConfig.THRESHOLDS.CULL_DISTANCE;
  }

  // Level of detail based on distance
  getLOD(x, y, camera) {
    const viewport = camera.getViewportBounds();
    const distance = this.getDistanceFromViewport(x, y, viewport);

    if (distance < RendererConfig.THRESHOLDS.LOD_DISTANCE * 0.5) return 'high';
    if (distance < RendererConfig.THRESHOLDS.LOD_DISTANCE) return 'medium';
    return 'low';
  }

  // Calculate distance from viewport center
  getDistanceFromViewport(x, y, viewport) {
    const centerX = (viewport.left + viewport.right) / 2;
    const centerY = (viewport.top + viewport.bottom) / 2;

    const dx = x - centerX;
    const dy = y - centerY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // Check if object should be rendered based on performance
  shouldRender(object, camera) {
    this.stats.totalObjects++;

    // Always render selected/highlighted objects
    if (object.isSelected || object.isHighlighted) {
      this.stats.rendered++;
      return true;
    }

    // Performance-based culling
    if (this.stats.frameTime > RendererConfig.THRESHOLDS.FRAME_SKIP_THRESHOLD) {
      // Skip rendering distant objects when frame rate is low
      if (this.shouldCull(object.x, object.y, camera)) {
        this.stats.culled++;
        return false;
      }
    }

    // Distance-based culling
    if (this.shouldCull(object.x, object.y, camera)) {
      this.stats.culled++;
      return false;
    }

    // Limit total rendered objects
    if (this.stats.rendered >= RendererConfig.THRESHOLDS.MAX_RENDERED_OBJECTS) {
      this.stats.culled++;
      return false;
    }

    this.stats.rendered++;
    return true;
  }

  // Get performance statistics
  getStats() {
    return {
      ...this.stats,
      cullRatio: this.stats.totalObjects > 0 ?
        this.stats.culled / this.stats.totalObjects : 0,
      renderEfficiency: this.stats.totalObjects > 0 ?
        this.stats.rendered / this.stats.totalObjects : 0
    };
  }

  /**
   * Adaptive quality adjustment based on FPS
   * ENHANCED: Uses quality presets for smoother transitions
   */
  adjustQuality() {
    const stats = this.getStats();
    this.frameCount++;

    // Update FPS history
    const fps = stats.frameTime > 0 ? 1000 / stats.frameTime : 60;
    this.fpsHistory[this.fpsHistoryIndex] = fps;
    this.fpsHistoryIndex = (this.fpsHistoryIndex + 1) % this.fpsHistory.length;

    // Calculate rolling average FPS
    let sum = 0;
    for (let i = 0; i < this.fpsHistory.length; i++) {
      sum += this.fpsHistory[i];
    }
    this.currentFps = sum / this.fpsHistory.length;

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
      this.applyQualityPreset(presets[currentIndex - 1]);
      this.qualityLockTimer = this.qualityLockDuration;

    }
    // Upgrade quality if FPS is good
    else if (this.currentFps > 55 && currentIndex < presets.length - 1) {
      this.applyQualityPreset(presets[currentIndex + 1]);
      this.qualityLockTimer = this.qualityLockDuration;

    }

    // Legacy threshold adjustments (fine-tuning)
    if (stats.cullRatio > 0.7) {
      RendererConfig.THRESHOLDS.CULL_DISTANCE *= 0.95;
    }
    if (stats.frameTime > 20) {
      RendererConfig.THRESHOLDS.CULL_DISTANCE *= 0.98;
    }
    if (stats.frameTime < 12) {
      RendererConfig.THRESHOLDS.CULL_DISTANCE *= 1.01;
    }

    // Clamp values to reasonable ranges
    RendererConfig.THRESHOLDS.CULL_DISTANCE = Math.max(500,
      Math.min(2000, RendererConfig.THRESHOLDS.CULL_DISTANCE));
    RendererConfig.THRESHOLDS.MAX_RENDERED_OBJECTS = Math.max(500,
      Math.min(2000, RendererConfig.THRESHOLDS.MAX_RENDERED_OBJECTS));
  }

  /**
   * Get current quality preset name
   */
  getCurrentQuality() {
    return this.currentQuality;
  }

  /**
   * Get current FPS (rolling average)
   */
  getCurrentFps() {
    return this.currentFps;
  }

  // Batch rendering optimization
  optimizeBatch(objects, camera) {
    // Sort objects by distance for better rendering order
    return objects
      .filter(obj => this.shouldRender(obj, camera))
      .sort((a, b) => {
        const distA = this.getDistanceFromViewport(a.x, a.y, camera.getViewportBounds());
        const distB = this.getDistanceFromViewport(b.x, b.y, camera.getViewportBounds());
        return distA - distB; // Closer objects first
      });
  }

  // Memory pool for render operations
  getRenderPool() {
    if (!this.renderPool) {
      this.renderPool = {
        vectors: [],
        colors: [],
        transforms: []
      };
    }
    return this.renderPool;
  }

  // Clean up render pool
  cleanupPool() {
    if (this.renderPool) {
      this.renderPool.vectors.length = 0;
      this.renderPool.colors.length = 0;
      this.renderPool.transforms.length = 0;
    }
  }
}
