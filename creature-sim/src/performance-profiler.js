/**
 * High-performance profiling and monitoring system
 * Provides real-time performance metrics, memory tracking, and optimization insights
 */

import { eventSystem, GameEvents } from './event-system.js';

/**
 * Performance sample data structure
 */
class PerformanceSample {
  constructor() {
    this.timestamp = performance.now();
    this.fps = 0;
    this.frameTime = 0;
    this.memoryUsage = 0;
    this.heapUsed = 0;
    this.heapTotal = 0;
    this.gcCollections = 0;
    this.drawCalls = 0;
    this.creaturesRendered = 0;
    this.particlesActive = 0;
    this.spatialGridQueries = 0;
    this.poolUtilization = {};
    this.eventCount = 0;
  }
}

/**
 * Rolling average calculator for smooth metrics
 */
class RollingAverage {
  constructor(windowSize = 60) {
    this.windowSize = windowSize;
    this.values = new Array(windowSize);
    this.index = 0;
    this.count = 0;
    this.sum = 0;
  }

  add(value) {
    // Remove old value from sum
    if (this.count >= this.windowSize) {
      this.sum -= this.values[this.index];
    } else {
      this.count++;
    }

    // Add new value
    this.values[this.index] = value;
    this.sum += value;
    this.index = (this.index + 1) % this.windowSize;

    return this.average;
  }

  get average() {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  get min() {
    if (this.count === 0) return 0;
    let min = Infinity;
    for (let i = 0; i < this.count; i++) {
      min = Math.min(min, this.values[i]);
    }
    return min;
  }

  get max() {
    if (this.count === 0) return 0;
    let max = -Infinity;
    for (let i = 0; i < this.count; i++) {
      max = Math.max(max, this.values[i]);
    }
    return max;
  }

  reset() {
    this.values.fill(0);
    this.index = 0;
    this.count = 0;
    this.sum = 0;
  }
}

/**
 * Performance Profiler - Main profiling system
 * Optimized for minimal overhead and silent operation by default
 */
export class PerformanceProfiler {
  constructor() {
    this.isEnabled = true;
    this.samples = [];
    this.maxSamples = 600; // 10 seconds at 60fps
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.lastFPSTime = performance.now();

    // === NEW: Silent mode and debug controls ===
    this.debugMode = false;           // Only show warnings when true
    this.showOverlayAlerts = false;   // Show intrusive overlay alerts
    this.startupGracePeriod = 300;    // Ignore first 300 frames (5 seconds)
    this.framesSinceStart = 0;
    this.alertsEnabled = false;       // Master switch - alerts completely disabled by default

    // Alert cooldown system (prevents spam)
    this.alertCooldowns = new Map();  // type -> lastAlertTime
    this.alertCooldownMs = 5000;      // 5 seconds between same alert type

    // Rolling averages for smooth metrics
    this.fpsAverage = new RollingAverage(60);
    this.frameTimeAverage = new RollingAverage(60);
    this.memoryAverage = new RollingAverage(60);

    // Performance metrics (reusable object to reduce allocations)
    this.currentMetrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      drawCalls: 0,
      creaturesRendered: 0,
      particlesActive: 0,
      spatialGridQueries: 0,
      poolHitRate: 0,
      eventThroughput: 0
    };

    // Performance budgets (configurable thresholds) - relaxed for better UX
    this.budgets = {
      targetFPS: 60,
      maxFrameTime: 16.67, // ~60fps
      maxMemoryMB: 150,    // Increased from 100
      maxDrawCalls: 1500,  // Increased from 1000
      warningThreshold: 0.7,  // Relaxed from 0.8
      criticalThreshold: 0.85 // Relaxed from 0.95
    };

    // Performance alerts (kept minimal)
    this.alerts = [];
    this.maxAlerts = 5; // Reduced from 10

    // Profiling scopes for detailed timing
    this.scopes = new Map();
    this.scopeStack = [];

    // Memory monitoring
    this.memoryInfo = {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      gcCollections: 0
    };

    // Reusable sample object (reduces GC pressure)
    this._reusableSample = new PerformanceSample();

    this.setupMemoryMonitoring();

    console.debug('📊 Performance profiler initialized (silent mode)');
  }

  /**
   * Setup memory monitoring if available
   */
  setupMemoryMonitoring() {
    if (performance.memory) {
      this.memoryInfo.heapUsed = performance.memory.usedJSHeapSize;
      this.memoryInfo.heapTotal = performance.memory.totalJSHeapSize;
      this.memoryInfo.external = performance.memory.usedJSHeapSize - performance.memory.totalJSHeapSize;
    }
  }

  /**
   * Start a profiling scope
   * @param {string} name - Scope name
   */
  startScope(name) {
    if (!this.isEnabled) return;

    const scope = {
      name,
      startTime: performance.now(),
      children: [],
      parent: this.scopeStack.length > 0 ? this.scopeStack[this.scopeStack.length - 1] : null
    };

    if (scope.parent) {
      scope.parent.children.push(scope);
    } else if (!this.scopes.has(name)) {
      this.scopes.set(name, []);
    }

    this.scopeStack.push(scope);
  }

  /**
   * End the current profiling scope
   */
  endScope() {
    if (!this.isEnabled || this.scopeStack.length === 0) return;

    const scope = this.scopeStack.pop();
    scope.endTime = performance.now();
    scope.duration = scope.endTime - scope.startTime;

    // Store root scopes for analysis
    if (!scope.parent) {
      const scopes = this.scopes.get(scope.name) || [];
      scopes.push(scope);
      if (scopes.length > 100) {
        scopes.shift(); // Keep last 100 samples
      }
      this.scopes.set(scope.name, scopes);
    }
  }

  /**
   * Profile a function execution
   * @param {string} name - Function name
   * @param {Function} fn - Function to profile
   * @param {*} context - Function context
   * @returns {*} Function result
   */
  profileFunction(name, fn, context = null) {
    this.startScope(name);
    try {
      return fn.call(context);
    } finally {
      this.endScope();
    }
  }

  /**
   * Mark the beginning of a frame
   */
  beginFrame() {
    this.lastFrameTime = performance.now();
    this.frameCount++;
    this.framesSinceStart++;
  }

  /**
   * Mark the end of a frame and collect metrics
   */
  endFrame() {
    if (!this.isEnabled) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;

    // Calculate FPS
    const fpsTimeDiff = now - this.lastFPSTime;
    if (fpsTimeDiff >= 1000) { // Update FPS every second
      this.currentMetrics.fps = (this.frameCount / fpsTimeDiff) * 1000;
      this.frameCount = 0;
      this.lastFPSTime = now;
    }

    this.currentMetrics.frameTime = frameTime;

    // Update rolling averages
    if (this.currentMetrics.fps > 0) {
      this.fpsAverage.add(this.currentMetrics.fps);
    }
    this.frameTimeAverage.add(frameTime);

    // Memory monitoring
    if (performance.memory) {
      this.memoryInfo.heapUsed = performance.memory.usedJSHeapSize;
      this.memoryInfo.heapTotal = performance.memory.totalJSHeapSize;
      this.memoryInfo.external = performance.memory.usedJSHeapSize - performance.memory.totalJSHeapSize;

      const memoryMB = this.memoryInfo.heapUsed / (1024 * 1024);
      this.currentMetrics.memoryUsage = memoryMB;
      this.memoryAverage.add(memoryMB);
    }

    // Collect sample
    this.collectSample();

    // Check performance budgets
    this.checkBudgets();
  }

  /**
   * Collect a performance sample (optimized to reduce allocations)
   */
  collectSample() {
    // Only collect samples every 3rd frame to reduce overhead
    if (this.framesSinceStart % 3 !== 0) return;

    // Create new sample only when needed (reuse where possible)
    const sample = new PerformanceSample();
    sample.timestamp = performance.now();
    sample.fps = this.currentMetrics.fps;
    sample.frameTime = this.currentMetrics.frameTime;
    sample.memoryUsage = this.currentMetrics.memoryUsage;
    sample.heapUsed = this.memoryInfo.heapUsed;
    sample.heapTotal = this.memoryInfo.heapTotal;
    sample.drawCalls = this.currentMetrics.drawCalls;
    sample.creaturesRendered = this.currentMetrics.creaturesRendered;
    sample.particlesActive = this.currentMetrics.particlesActive;
    sample.spatialGridQueries = this.currentMetrics.spatialGridQueries;
    sample.eventCount = eventSystem ? eventSystem.historyCount : 0;

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /**
   * Check performance against budgets and generate alerts
   * Now with cooldown system and silent mode support
   */
  checkBudgets() {
    // Master switch - if alerts are disabled, skip entirely
    if (!this.alertsEnabled) {
      return;
    }

    // Skip during startup grace period
    if (this.framesSinceStart < this.startupGracePeriod) {
      return;
    }

    const now = performance.now();
    const issues = [];

    // FPS budget
    if (this.currentMetrics.fps > 0 && this.currentMetrics.fps < this.budgets.targetFPS * this.budgets.warningThreshold) {
      issues.push({
        type: 'fps',
        severity: this.currentMetrics.fps < this.budgets.targetFPS * this.budgets.criticalThreshold ? 'critical' : 'warning',
        message: `FPS dropped to ${this.currentMetrics.fps.toFixed(1)} (target: ${this.budgets.targetFPS})`,
        value: this.currentMetrics.fps,
        threshold: this.budgets.targetFPS
      });
    }

    // Frame time budget
    if (this.currentMetrics.frameTime > this.budgets.maxFrameTime * this.budgets.warningThreshold) {
      issues.push({
        type: 'frame_time',
        severity: this.currentMetrics.frameTime > this.budgets.maxFrameTime * this.budgets.criticalThreshold ? 'critical' : 'warning',
        message: `Frame time: ${this.currentMetrics.frameTime.toFixed(2)}ms (budget: ${this.budgets.maxFrameTime.toFixed(2)}ms)`,
        value: this.currentMetrics.frameTime,
        threshold: this.budgets.maxFrameTime
      });
    }

    // Memory budget
    if (this.currentMetrics.memoryUsage > this.budgets.maxMemoryMB * this.budgets.warningThreshold) {
      issues.push({
        type: 'memory',
        severity: this.currentMetrics.memoryUsage > this.budgets.maxMemoryMB * this.budgets.criticalThreshold ? 'critical' : 'warning',
        message: `Memory usage: ${this.currentMetrics.memoryUsage.toFixed(1)}MB (budget: ${this.budgets.maxMemoryMB}MB)`,
        value: this.currentMetrics.memoryUsage,
        threshold: this.budgets.maxMemoryMB
      });
    }

    // Draw calls budget
    if (this.currentMetrics.drawCalls > this.budgets.maxDrawCalls * this.budgets.warningThreshold) {
      issues.push({
        type: 'draw_calls',
        severity: 'warning',
        message: `Draw calls: ${this.currentMetrics.drawCalls} (budget: ${this.budgets.maxDrawCalls})`,
        value: this.currentMetrics.drawCalls,
        threshold: this.budgets.maxDrawCalls
      });
    }

    // Process alerts with cooldown
    for (const issue of issues) {
      // Check cooldown - skip if same alert type was shown recently
      const lastAlert = this.alertCooldowns.get(issue.type);
      if (lastAlert && (now - lastAlert) < this.alertCooldownMs) {
        continue; // Skip this alert, still in cooldown
      }

      // Update cooldown
      this.alertCooldowns.set(issue.type, now);
      issue.timestamp = now;

      this.alerts.push(issue);
      if (this.alerts.length > this.maxAlerts) {
        this.alerts.shift();
      }

      // Only emit events if overlay alerts are enabled
      if (this.showOverlayAlerts && eventSystem) {
        eventSystem.emit('performance:alert', issue, { throwOnError: false });
      }

      // Only log to console in debug mode
      if (this.debugMode) {
        console.warn(`⚠️ Performance ${issue.severity}: ${issue.message}`);
      }
    }
  }

  /**
   * Enable/disable debug mode (shows console warnings)
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.alertsEnabled = enabled; // Also enable alerts when debug mode is on
    console.log(`🔧 Performance debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Enable/disable overlay alerts (intrusive notifications)
   */
  setOverlayAlerts(enabled) {
    this.showOverlayAlerts = enabled;
    this.alertsEnabled = enabled; // Also enable alerts when overlay alerts are on
    console.log(`🔔 Performance overlay alerts: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Enable/disable all performance alerts (master switch)
   */
  setAlertsEnabled(enabled) {
    this.alertsEnabled = enabled;
    console.log(`📊 Performance alerts: ${enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Update render metrics
   * @param {number} drawCalls - Number of draw calls this frame
   * @param {number} creaturesRendered - Number of creatures rendered
   * @param {number} particlesActive - Number of active particles
   */
  updateRenderMetrics(drawCalls = 0, creaturesRendered = 0, particlesActive = 0) {
    this.currentMetrics.drawCalls = drawCalls;
    this.currentMetrics.creaturesRendered = creaturesRendered;
    this.currentMetrics.particlesActive = particlesActive;
  }

  /**
   * Update spatial grid metrics
   * @param {number} queries - Number of spatial queries this frame
   */
  updateSpatialMetrics(queries = 0) {
    this.currentMetrics.spatialGridQueries = queries;
  }

  /**
   * Get current performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    const recentSamples = this.samples.slice(-60); // Last second at 60fps

    return {
      current: { ...this.currentMetrics },
      averages: {
        fps: this.fpsAverage.average,
        frameTime: this.frameTimeAverage.average,
        memoryMB: this.memoryAverage.average
      },
      ranges: {
        fps: { min: this.fpsAverage.min, max: this.fpsAverage.max },
        frameTime: { min: this.frameTimeAverage.min, max: this.frameTimeAverage.max }
      },
      memory: { ...this.memoryInfo },
      samples: recentSamples.length,
      alerts: this.alerts.slice(-5), // Last 5 alerts
      budgets: { ...this.budgets }
    };
  }

  /**
   * Get profiling scope statistics
   * @returns {Object} Scope profiling data
   */
  getScopeStats() {
    const stats = {};

    for (const [name, scopes] of this.scopes) {
      if (scopes.length === 0) continue;

      const durations = scopes.map(s => s.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      stats[name] = {
        count: scopes.length,
        avgDuration: avgDuration,
        minDuration: minDuration,
        maxDuration: maxDuration,
        totalTime: durations.reduce((a, b) => a + b, 0),
        percentage: 0 // Will be calculated relative to frame time
      };
    }

    // Calculate percentages relative to average frame time
    const avgFrameTime = this.frameTimeAverage.average;
    if (avgFrameTime > 0) {
      for (const name in stats) {
        stats[name].percentage = ((stats[name].avgDuration / avgFrameTime) * 100).toFixed(1) + '%';
      }
    }

    return stats;
  }

  /**
   * Export performance data for analysis
   * @param {number} duration - Duration in seconds to export (0 = all)
   * @returns {Object} Exported data
   */
  exportData(duration = 0) {
    let exportSamples = this.samples;

    if (duration > 0) {
      const cutoffTime = performance.now() - (duration * 1000);
      exportSamples = this.samples.filter(s => s.timestamp >= cutoffTime);
    }

    return {
      metadata: {
        exportTime: new Date().toISOString(),
        duration: duration,
        sampleCount: exportSamples.length,
        profilerEnabled: this.isEnabled
      },
      budgets: { ...this.budgets },
      samples: exportSamples,
      scopeStats: this.getScopeStats(),
      alerts: this.alerts,
      config: {
        maxSamples: this.maxSamples,
        rollingAverageWindow: 60
      }
    };
  }

  /**
   * Reset profiler state
   */
  reset() {
    this.samples.length = 0;
    this.alerts.length = 0;
    this.scopes.clear();
    this.scopeStack.length = 0;

    this.fpsAverage.reset();
    this.frameTimeAverage.reset();
    this.memoryAverage.reset();

    this.frameCount = 0;
    this.lastFPSTime = performance.now();

    console.log('🔄 Performance profiler reset');
  }

  /**
   * Enable or disable profiling
   * @param {boolean} enabled - Whether to enable profiling
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.debug(`${enabled ? '▶️' : '⏸️'} Performance profiler ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set performance budgets
   * @param {Object} budgets - New budget values
   */
  setBudgets(budgets) {
    Object.assign(this.budgets, budgets);
    console.log('📊 Performance budgets updated:', budgets);
  }
}

/**
 * Performance Monitor UI Component
 */
export class PerformanceMonitor {
  constructor(container, profiler) {
    this.container = container;
    this.profiler = profiler;
    this.isVisible = false;
    this.updateInterval = 100; // Update every 100ms
    this.lastUpdate = 0;
    this.charts = {};

    this.createUI();
    this.setupEventListeners();
  }

  createUI() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'performance-monitor';
    this.overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 10000;
      min-width: 300px;
      max-width: 500px;
      display: none;
      backdrop-filter: blur(5px);
    `;

    this.overlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #00ff00;">Performance Monitor</h3>
        <button id="perf-close" style="background: none; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px;">×</button>
      </div>

      <div id="perf-metrics" style="margin-bottom: 10px;">
        <div>FPS: <span id="perf-fps">--</span> (avg: <span id="perf-fps-avg">--</span>)</div>
        <div>Frame Time: <span id="perf-frame-time">--</span>ms (avg: <span id="perf-frame-time-avg">--</span>ms)</div>
        <div>Update: <span id="perf-update">--</span>ms · Render: <span id="perf-render">--</span>ms</div>
        <div>Memory: <span id="perf-memory">--</span>MB (avg: <span id="perf-memory-avg">--</span>MB)</div>
        <div>Draw Calls: <span id="perf-draw-calls">--</span></div>
        <div>Creatures: <span id="perf-creatures">--</span></div>
      </div>

      <div id="perf-alerts" style="margin-bottom: 10px; max-height: 100px; overflow-y: auto;">
        <div style="color: #ffa500; font-weight: bold;">Alerts:</div>
        <div id="perf-alert-list">None</div>
      </div>

      <div id="perf-charts" style="margin-bottom: 10px;">
        <canvas id="perf-fps-chart" width="280" height="60" style="background: rgba(0,0,0,0.5); border: 1px solid #333;"></canvas>
      </div>

      <div style="display: flex; gap: 5px; flex-wrap: wrap;">
        <button id="perf-toggle" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px; font-size: 11px;">Toggle</button>
        <button id="perf-reset" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px; font-size: 11px;">Reset</button>
        <button id="perf-export" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px; font-size: 11px;">Export</button>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Get references to elements
    this.fpsElement = this.overlay.querySelector('#perf-fps');
    this.fpsAvgElement = this.overlay.querySelector('#perf-fps-avg');
    this.frameTimeElement = this.overlay.querySelector('#perf-frame-time');
    this.frameTimeAvgElement = this.overlay.querySelector('#perf-frame-time-avg');
    this.updateElement = this.overlay.querySelector('#perf-update');
    this.renderElement = this.overlay.querySelector('#perf-render');
    this.memoryElement = this.overlay.querySelector('#perf-memory');
    this.memoryAvgElement = this.overlay.querySelector('#perf-memory-avg');
    this.drawCallsElement = this.overlay.querySelector('#perf-draw-calls');
    this.creaturesElement = this.overlay.querySelector('#perf-creatures');
    this.alertListElement = this.overlay.querySelector('#perf-alert-list');
    this.fpsChartCanvas = this.overlay.querySelector('#perf-fps-chart');
    this.fpsChartCtx = this.fpsChartCanvas.getContext('2d');
  }

  setupEventListeners() {
    // Close button
    this.overlay.querySelector('#perf-close').addEventListener('click', () => {
      this.hide();
    });

    // Toggle button
    this.overlay.querySelector('#perf-toggle').addEventListener('click', () => {
      this.profiler.setEnabled(!this.profiler.isEnabled);
    });

    // Reset button
    this.overlay.querySelector('#perf-reset').addEventListener('click', () => {
      this.profiler.reset();
      this.clearChart();
    });

    // Export button
    this.overlay.querySelector('#perf-export').addEventListener('click', () => {
      this.exportData();
    });

    // Keyboard shortcut (F12)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  show() {
    this.overlay.style.display = 'block';
    this.isVisible = true;
  }

  hide() {
    this.overlay.style.display = 'none';
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  update() {
    if (!this.isVisible) return;

    const now = performance.now();
    if (now - this.lastUpdate < this.updateInterval) return;

    this.lastUpdate = now;

    const stats = this.profiler.getStats();
    const scopes = this.profiler.getScopeStats();

    // Update metrics
    this.fpsElement.textContent = stats.current.fps.toFixed(1);
    this.fpsAvgElement.textContent = stats.averages.fps.toFixed(1);
    this.frameTimeElement.textContent = stats.current.frameTime.toFixed(2);
    this.frameTimeAvgElement.textContent = stats.averages.frameTime.toFixed(2);
    const updateMs = scopes['world-step']?.avgDuration;
    const renderMs = scopes.render?.avgDuration;
    this.updateElement.textContent = Number.isFinite(updateMs) ? updateMs.toFixed(2) : '--';
    this.renderElement.textContent = Number.isFinite(renderMs) ? renderMs.toFixed(2) : '--';
    this.memoryElement.textContent = stats.current.memoryUsage.toFixed(1);
    this.memoryAvgElement.textContent = stats.averages.memoryMB.toFixed(1);
    this.drawCallsElement.textContent = stats.current.drawCalls;
    this.creaturesElement.textContent = stats.current.creaturesRendered;

    // Update alerts
    this.updateAlerts(stats.alerts);

    // Update chart
    this.updateChart(stats.samples);
  }

  updateAlerts(alerts) {
    if (alerts.length === 0) {
      this.alertListElement.innerHTML = '<span style="color: #888;">None</span>';
      return;
    }

    const alertHtml = alerts.map(alert => {
      const color = alert.severity === 'critical' ? '#ff4444' : '#ffa500';
      return `<div style="color: ${color}; font-size: 10px;">${alert.message}</div>`;
    }).join('');

    this.alertListElement.innerHTML = alertHtml;
  }

  updateChart(samples) {
    const ctx = this.fpsChartCtx;
    const canvas = this.fpsChartCanvas;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (samples.length < 2) return;

    // Draw background grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Horizontal grid lines (FPS markers)
    for (let fps = 0; fps <= 60; fps += 15) {
      const y = height - (fps / 60) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(fps.toString(), 2, y - 2);
    }

    // Draw FPS line
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const recentSamples = samples.slice(-width); // Show last N samples
    const maxSamples = Math.min(recentSamples.length, width);

    for (let i = 0; i < maxSamples; i++) {
      const sample = recentSamples[recentSamples.length - maxSamples + i];
      const x = (i / maxSamples) * width;
      const y = height - (Math.min(sample.fps, 60) / 60) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw current FPS marker
    const currentSample = samples[samples.length - 1];
    if (currentSample) {
      const currentY = height - (Math.min(currentSample.fps, 60) / 60) * height;
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(width - 5, currentY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  clearChart() {
    this.fpsChartCtx.clearRect(0, 0, this.fpsChartCanvas.width, this.fpsChartCanvas.height);
  }

  exportData() {
    const data = this.profiler.exportData(60); // Last 60 seconds
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-profile-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('📊 Performance data exported');
  }
}

// Global instances
export const performanceProfiler = new PerformanceProfiler();

// Frame timing integration
let monitor = null;

export function initializePerformanceMonitor(container = document.body) {
  monitor = new PerformanceMonitor(container, performanceProfiler);
  return monitor;
}

export function updatePerformanceMonitor() {
  if (monitor) {
    monitor.update();
  }
}

// Convenience profiling functions
export const profile = {
  start: (name) => performanceProfiler.startScope(name),
  end: () => performanceProfiler.endScope(),
  function: (name, fn, context) => performanceProfiler.profileFunction(name, fn, context),
  frame: () => {
    performanceProfiler.endFrame();
    performanceProfiler.beginFrame();
  }
};
