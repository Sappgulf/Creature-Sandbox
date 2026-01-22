/**
 * Game Loop - Main game loop and timing management
 * Handles the core simulation loop with proper timing and performance monitoring
 * Now integrated with all subsystems for complete feature restoration
 *
 * PERFORMANCE: Static imports instead of dynamic to avoid per-frame import() latency
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { performanceProfiler, updatePerformanceMonitor, profile } from './performance-profiler.js';
import { eventSystem, GameEvents } from './event-system.js';
import { configManager } from './config-manager.js';
import { poolManager } from './object-pool.js';
import { batchRenderer } from './batch-renderer.js';
import { ecsWorld } from './ecs.js';
import { analyticsDashboard, advancedStatsCalculator } from './enhanced-analytics.js';
// STATIC UI IMPORTS - avoids dynamic import() latency in hot path
import { renderStats, renderSelectedInfo, renderAnalyticsCharts } from './ui.js';

// Local helper to validate notification subsystem shape without depending on cross-module export availability
function isNotificationSystem(candidate) {
  return !!candidate &&
    typeof candidate.show === 'function' &&
    typeof candidate.update === 'function' &&
    typeof candidate.draw === 'function';
}

export class GameLoop {
  constructor(world, camera, renderer, analytics, uiController, subsystems = {}) {
    this.world = world;
    this.camera = camera;
    this.renderer = renderer;
    this.analytics = analytics;
    this.uiController = uiController;

    // Store all subsystems for proper integration
    this.subsystems = subsystems;
    this.tutorial = subsystems.tutorial;
    this.achievements = subsystems.achievements;
    this.audio = subsystems.audio;
    this.particles = subsystems.particles;
    this.notifications = isNotificationSystem(subsystems.notifications)
      ? subsystems.notifications
      : null;
    this.heatmaps = subsystems.heatmaps;
    this.lineageTracker = subsystems.lineageTracker;
    this.miniGraphs = subsystems.miniGraphs;
    this.debugConsole = subsystems.debugConsole;
    this.saveSystem = subsystems.saveSystem;
    this.geneEditor = subsystems.geneEditor;
    this.ecoHealth = subsystems.ecoHealth;
    this.gameplayModes = subsystems.gameplayModes;
    this.sessionGoals = subsystems.sessionGoals;
    this.devTools = subsystems.devTools || {};

    this.lastNow = performance.now();
    this.fixedDt = configManager.get('performance', 'fixedTimeStep', 1 / 60);
    this.MAX_STEPS = configManager.get('performance', 'maxFrameSkip', 6);

    this.frameCount = 0;
    this.statsUpdateCounter = 0;
    this.chartUpdateCounter = 0;

    // Performance tracking
    this.lastAnalyticsUpdate = 0;
    this.lastUIUpdate = 0;
    this.lastDashboardUpdate = 0;
    this.lastEcoHealthUpdate = 0;
    this.lastTimingLog = 0;
    this.timingLogInterval = Number(this.devTools.timingLogInterval || 5000) || 5000;

    // Track pause state for UI sync
    this._lastPausedState = false;
    this._uiCache = new Map();

    // Reusable event objects to reduce allocations
    this.worldUpdateEvent = {
      time: 0,
      creatureCount: 0,
      foodCount: 0
    };

    // Reusable render options object to reduce per-frame allocations
    this.renderOptions = {
      selectedId: null,
      pinnedId: null,
      lineageRootId: null,
      worldTime: 0,
      lineageTracker: null,
      world: null,
      travelPreview: null,
      cameraTravel: null,
      cameraMoving: false,
      viewportWidth: 0,
      viewportHeight: 0,
      batchRenderer: null,
      useBatchRendering: false,
      particleSystem: null,
      heatmaps: null
    };

    this.boundLoop = this.loop.bind(this);

    // STABILITY: Watchdog to detect if game loop stops
    this._lastLoopTime = 0;
    this._watchdogInterval = null;

    // Profiling report controls
    this.profileReportEnabled = !!configManager.get('performance', 'profiling.enabled', false);
    this.profileReportInterval = Number(configManager.get('performance', 'profiling.sampleRate', 1000)) || 1000;
    this.profileReportIncludeScopes = !!configManager.get('performance', 'profiling.includeScopes', false);
    this.lastPerfReport = 0;
    performanceProfiler.setEnabled(this.profileReportEnabled);

    configManager.onChange('performance', () => {
      this.profileReportEnabled = !!configManager.get('performance', 'profiling.enabled', false);
      this.profileReportInterval = Number(configManager.get('performance', 'profiling.sampleRate', 1000)) || 1000;
      this.profileReportIncludeScopes = !!configManager.get('performance', 'profiling.includeScopes', false);
      performanceProfiler.setEnabled(this.profileReportEnabled);
    });

    // Initialize enhanced systems
    this.initializeEnhancedSystems();
  }

  hasNotifications() {
    return isNotificationSystem(this.notifications);
  }

  /**
   * Initialize enhanced systems integration
   */
  initializeEnhancedSystems() {
    // Connect event system to subsystems
    this.setupEventListeners();

    // Warm up object pools
    poolManager.warm({
      vectors: 100,
      arrays: 50,
      particles: 200
    });

    console.debug('🔗 Enhanced systems integrated into game loop');
  }

  /**
   * Setup event listeners for subsystem communication
   */
  setupEventListeners() {
    // World events
    eventSystem.on(GameEvents.WORLD_UPDATE, () => {
      if (this.ecoHealth) this.ecoHealth.update(this.world);
    });

    // Creature events
    eventSystem.on(GameEvents.CREATURE_BORN, (data) => {
      if (this.lineageTracker) this.lineageTracker.onCreatureBorn(data.creature, this.world);
      if (this.audio) this.audio.playSound('creatureBorn');
      if (this.particles) this.particles.emit(data.x, data.y, 'birth');
    });

    eventSystem.on(GameEvents.CREATURE_DIED, (data) => {
      if (this.lineageTracker) this.lineageTracker.onCreatureDied(data.creature);
      if (this.audio) this.audio.playSound('creatureDied');
      if (this.particles) this.particles.emit(data.x, data.y, 'death');
    });

    // Achievement events
    eventSystem.on(GameEvents.ACHIEVEMENT_UNLOCKED, (data) => {
      const uiHandlesNotifications = this.uiController && typeof this.uiController.hasNotifications === 'function';
      const uiHasAudio = !!this.uiController?.audio;

      if (!uiHandlesNotifications && this.hasNotifications()) {
        this.notifications.show(`Achievement: ${data.name}`, 'achievement');
      }
      if (!uiHasAudio && this.audio) {
        this.audio.playSound('achievement');
      }
    });
  }

  /**
   * Start the game loop
   */
  start() {
    console.debug('🎮 Starting game loop');
    this._lastLoopTime = performance.now();
    requestAnimationFrame(this.boundLoop);

    // STABILITY: Watchdog timer to detect and recover from stalled game loop
    // Checks every 2 seconds if the loop is still running
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
    }
    this._watchdogInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - this._lastLoopTime;

      // If more than 3 seconds have passed since last loop, something is wrong
      if (elapsed > 3000 && gameState.isReady()) {
        console.warn('⚠️ Game loop watchdog: Loop appears stalled, attempting restart...');
        this._lastLoopTime = now;
        requestAnimationFrame(this.boundLoop);
      }
    }, 2000);
  }

  /**
   * Stop the game loop (for cleanup)
   */
  stop() {
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
    console.debug('🛑 Game loop stopped');
  }

  /**
   * Main game loop
   * STABILITY: Added defensive guards to prevent crashes
   */
  loop(now) {
    // STABILITY: Update watchdog timestamp
    this._lastLoopTime = now || performance.now();

    // Don't run if game hasn't started
    if (!gameState.isReady()) {
      requestAnimationFrame(this.boundLoop);
      return;
    }

    // STABILITY: Wrap entire loop in try-catch to prevent complete game freeze
    try {
      // Performance profiling
      performanceProfiler.beginFrame();
      this.profileStart('game-loop');

      // STABILITY: Validate timestamp
      if (typeof now !== 'number' || !isFinite(now)) {
        now = performance.now();
      }

      const dt = Math.min(0.25, (now - this.lastNow) / 1000);
      this.lastNow = now;

      // Calculate time scale (pause/speed controls)
      gameState.timeScale = gameState.paused ? 0 : gameState.fastForward;
      gameState.accumulator += dt * gameState.timeScale;

      // Run physics steps
      let steps = 0;
      while (gameState.accumulator >= this.fixedDt && steps < this.MAX_STEPS) {
        this.step(this.fixedDt);
        gameState.accumulator -= this.fixedDt;
        steps++;
      }

      // Prevent accumulator from getting too large
      if (steps === this.MAX_STEPS) {
        gameState.accumulator = 0;
      }

      // Update camera
      this.profileStart('camera-update');
      this.camera.update(dt);
      this.profileEnd();

      // Render frame
      this.profileStart('render');
      this.render(dt);
      this.profileEnd();

      // Update UI (throttled)
      this.profileStart('ui-update');
      this.updateUI(dt);
      this.profileEnd();

      // Update subsystems
      this.profileStart('subsystem-update');
      this.updateSubsystems(dt);
      this.profileEnd();

      // Per-frame updates for systems that want wall-clock cadence
      try {
        eventSystem.emit(GameEvents.FRAME_UPDATE, {
          dt,
          now,
          worldTime: this.world.t,
          timeScale: gameState.timeScale
        }, { throwOnError: false });
      } catch {
        // Ignore frame update listener failures to keep loop alive
      }

      this.profileEnd();

      // Performance profiling end frame
      performanceProfiler.endFrame();

      // Update performance monitor
      updatePerformanceMonitor();

      if (this.devTools.timingLogs) {
        const logNow = performance.now();
        if (logNow - this.lastTimingLog >= this.timingLogInterval) {
          this.lastTimingLog = logNow;
          console.debug('⏱️ Loop timings', performanceProfiler.getScopeStats());
        }
      }

      // Optional performance report logging
      if (this.profileReportEnabled) {
        const reportNow = performance.now();
        if (reportNow - this.lastPerfReport >= this.profileReportInterval) {
          this.lastPerfReport = reportNow;
          this.logPerformanceSnapshot();
        }
      }

    } catch (error) {
      // STABILITY: Log error but don't crash - attempt recovery
      console.error('Game loop error:', error);
      // Reset accumulator to prevent spiral of death
      gameState.accumulator = 0;
    }

    // Continue loop (always, even on error)
    requestAnimationFrame(this.boundLoop);
  }

  /**
   * Safe profile start helper
   */
  profileStart(name) {
    if (typeof profile !== 'undefined' && profile.start) {
      profile.start(name);
    }
  }

  /**
   * Safe profile end helper
   */
  profileEnd() {
    if (typeof profile !== 'undefined' && profile.end) {
      profile.end();
    }
  }

  logPerformanceSnapshot() {
    const stats = performanceProfiler.getStats();
    const avg = stats.averages;
    const current = stats.current;
    const summary = [
      `fps=${avg.fps.toFixed(1)}`,
      `frame=${avg.frameTime.toFixed(2)}ms`,
      `mem=${avg.memoryMB.toFixed(1)}MB`,
      `draws=${current.drawCalls}`,
      `creatures=${current.creaturesRendered}`
    ].join(' ');
    console.log(`[Perf] ${summary}`);

    if (this.profileReportIncludeScopes) {
      const scopes = performanceProfiler.getScopeStats();
      const topScopes = Object.entries(scopes)
        .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
        .slice(0, 3)
        .map(([name, data]) => `${name}:${data.avgDuration.toFixed(2)}ms`)
        .join(' ');
      if (topScopes) {
        console.log(`[PerfScopes] ${topScopes}`);
      }
    }
  }

  /**
   * Single physics step
   */
  step(dt) {
    this.profileStart('world-step');

    // Update world
    this.world.step(dt);

    // Update ECS world
    ecsWorld.update(dt);

    this.profileEnd();

    // Update camera follow logic
    this.profileStart('camera-follow');
    this.updateCameraFollow();
    this.profileEnd();

    // Update analytics (throttled)
    if (this.frameCount % 5 === 0) {
      this.profileStart('analytics');
      this.analytics.update(this.world, dt * 5);

      // Update enhanced analytics
      advancedStatsCalculator.update(this.world.creatures, this.world.food, this.world);
      this.profileEnd();
    }

    // Emit world update event (reuse object to reduce allocations)
    if (this.frameCount % 30 === 0) { // Every 0.5 seconds
      this.worldUpdateEvent.time = this.world.t;
      this.worldUpdateEvent.creatureCount = this.world.creatures.length;
      this.worldUpdateEvent.foodCount = this.world.food.length;
      this.worldUpdateEvent.world = this.world;
      this.worldUpdateEvent.context = {
        analytics: this.analytics,
        lineageTracker: this.lineageTracker
      };
      eventSystem.emit(GameEvents.WORLD_UPDATE, this.worldUpdateEvent);
    }

    // Update tutorial system
    if (this.tutorial?.update && this.tutorial?.isActive) {
      this.tutorial.update(dt, this.world);
    }

    // Update achievement system
    // Achievements are now event-driven via WORLD_UPDATE / kill / god action events.
  }

  /**
   * Handle camera follow mode
   */
  updateCameraFollow() {
    if (this.camera.followMode !== 'free' && this.camera.followTarget) {
      const target = this.world.getAnyCreatureById(this.camera.followTarget);
      if (target && target.alive) {
        // Smooth follow
        const smoothing = this.camera.followSmoothing || 0.12;
        this.camera.targetX = target.x;
        this.camera.targetY = target.y;

        // Optional auto-zoom based on creature speed
        if (this.camera.followZoomAdjust) {
          const speed = target.genes.speed || 1;
          const targetZoom = Math.max(0.3, Math.min(1.5, 1.0 / speed));
          this.camera.targetZoom = targetZoom;
        }
      } else {
        // Target died or lost, return to free mode
        this.camera.followMode = 'free';
        this.camera.followTarget = null;

      }
    }
  }

  /**
   * Render the current frame
   */
  render(dt) {
    const canvas = domCache.get('canvas');

    // Clear canvas
    this.renderer.clear(canvas.width, canvas.height);

    // Get camera state for rendering
    const cameraTravelState = typeof this.camera.getTravelState === 'function'
      ? this.camera.getTravelState()
      : null;

    // Update reusable render options (reduces per-frame allocations)
    const batchRendererReady = Boolean(batchRenderer?.isReady?.());
    const opts = this.renderOptions;
    opts.selectedId = gameState.selectedId;
    opts.pinnedId = gameState.pinnedId;
    opts.lineageRootId = gameState.lineageRootId;
    opts.selectionPulseUntil = gameState.selectionPulseUntil;
    opts.worldTime = this.world.t;
    opts.lineageTracker = this.world.lineageTracker;
    opts.world = this.world;
    opts.travelPreview = gameState.travelPreview;
    opts.cameraTravel = cameraTravelState;
    opts.cameraMoving = this.camera.isMoving;
    opts.viewportWidth = canvas.width;
    opts.viewportHeight = canvas.height;
    opts.batchRenderer = batchRendererReady ? batchRenderer : null;
    opts.useBatchRendering = batchRendererReady && configManager.get('rendering', 'performance.batchRendering', true);
    opts.particleSystem = this.particles;
    opts.heatmaps = this.heatmaps;

    this.renderer.drawWorld(this.world, opts);

    const drawEstimate = (this.renderer.renderedCount || 0) +
      (this.world.food?.length || 0) +
      (this.world.corpses?.length || 0);
    performanceProfiler.updateRenderMetrics(
      drawEstimate,
      this.renderer.renderedCount || 0,
      this.particles?.particles?.length || 0
    );

    // Update FPS calculation
    gameState.fps = 0.9 * gameState.fps + 0.1 * (1 / Math.max(dt, 0.0001));

    // Flush batch renderer if enabled
    if (opts.useBatchRendering) {
      batchRenderer.flush?.();
    }

    // Render heatmaps (if active)
    if (this.world.heatmaps?.activeType) {
      this.renderHeatmaps();
    }

    // Render overlays (mini-graphs, notifications, enhanced analytics)
    this.renderOverlays(dt);
  }

  /**
   * Render heatmaps
   */
  renderHeatmaps() {
    const ctx = domCache.get('canvas').getContext('2d');
    ctx.save();
    ctx.translate(this.renderer.ctx.canvas.width / 2, this.renderer.ctx.canvas.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    this.world.heatmaps.draw(ctx, this.camera);
    ctx.restore();
  }

  /**
   * Render UI overlays
   */
  renderOverlays(dt) {
    const ctx = domCache.get('canvas').getContext('2d');
    const hudBottomEl = domCache.get('hudBottom');

    // Calculate bottom offset for mini-graphs
    let hudBottomHeight = 0;
    if (hudBottomEl && (performance.now() - gameState.hudBottomMeasuredAt > 200)) {
      hudBottomHeight = hudBottomEl.getBoundingClientRect().height;
      gameState.hudBottomMeasuredAt = performance.now();
    }

    // Render mini-graphs
    if (this.miniGraphs) {
      this.miniGraphs.draw(ctx, {
        viewportWidth: this.camera.viewportWidth,
        viewportHeight: this.camera.viewportHeight,
        cameraMoving: this.camera.isMoving,
        bottomOffset: hudBottomHeight
      });
    }

    // Render notifications
    if (this.hasNotifications()) {
      this.notifications.draw(ctx, this.renderer.ctx.canvas.width, this.renderer.ctx.canvas.height);
    }

    // Render particles
    if (this.particles) {
      this.particles.draw(ctx, this.camera);
    }

    // Update enhanced analytics dashboard (throttled)
    if (analyticsDashboard.isVisible) {
      const now = performance.now();
      if (now - this.lastDashboardUpdate > 250) {
        analyticsDashboard.update(advancedStatsCalculator.stats, this.world, performanceProfiler.getStats());
        this.lastDashboardUpdate = now;
      }
    }
  }

  getCachedElement(key, resolver) {
    if (this._uiCache.has(key)) {
      const cached = this._uiCache.get(key);
      if (cached && document.contains(cached)) {
        return cached;
      }
    }

    const element = resolver();
    if (element) {
      this._uiCache.set(key, element);
    }
    return element;
  }

  /**
   * Update all subsystems
   * @param {number} dt - Delta time
   */
  updateSubsystems(dt) {
    // Achievement system is event-driven; no per-frame update needed.

    // Update audio system
    if (this.audio) {
      this.audio.update(dt);
    }

    // Update particles
    if (this.particles) {
      this.particles.update(dt);
    }

    // Update notifications
    if (this.hasNotifications()) {
      this.notifications.update(dt);
    }

    // Update heatmaps (apply decay)
    if (this.heatmaps) {
      this.heatmaps.update(dt);
    }

    // Update session goals tracking
    if (this.sessionGoals) {
      this.sessionGoals.update(this.world, dt);
    }

    // Update eco-health
    if (this.ecoHealth) {
      this.lastEcoHealthUpdate += dt;
      if (this.lastEcoHealthUpdate >= 0.5) {
        this.ecoHealth.update(this.world);
        this.lastEcoHealthUpdate = 0;
      }
    }

    // Update gene editor
    if (this.geneEditor && this.geneEditor.isActive) {
      this.geneEditor.update(dt);
    }

    // Update debug console
    if (this.debugConsole && this.debugConsole.isActive) {
      this.debugConsole.update(dt);
    }

    // Update save system (auto-save)
    if (this.saveSystem) {
      this.saveSystem.autoSave(this.world, this.camera, this.analytics, this.lineageTracker, dt);
    }
  }

  /**
   * Update UI elements (throttled)
   */
  updateUI(dt) {
    this.frameCount++;
    this.statsUpdateCounter++;
    this.chartUpdateCounter++;

    // STABILITY: Ensure pause button state is always synchronized
    // This catches any edge cases where pause state changes without UI update
    if (gameState.paused !== this._lastPausedState) {
      this._lastPausedState = gameState.paused;
      if (this.uiController?.updatePauseButton) {
        this.uiController.updatePauseButton();
      }
      if (this.uiController?.updateMobileControls) {
        this.uiController.updateMobileControls();
      }
    }

    // Update stats UI every 5 frames (~12Hz)
    if (this.statsUpdateCounter >= 5) {
      this.updateStatsUI();
      this.statsUpdateCounter = 0;
    }

    // Update charts every 30 frames (~0.5Hz)
    if (this.chartUpdateCounter >= 30) {
      this.updateCharts();
      this.updateAdvancedAnalytics();
      this.updateEcoHealthUI();
      this.updateScenarioStatus();
      this.chartUpdateCounter = 0;
    }

    // Update performance metrics every 10 frames
    if (this.frameCount % 10 === 0) {
      this.uiController.updatePerformanceMetrics(
        this.renderer.renderedCount,
        this.renderer.culledCount,
        (this.renderer.renderedCount || 0) + (this.world.food?.length || 0)
      );

      const devFpsEl = domCache.get('devFps');
      if (devFpsEl && this.devTools?.fpsOverlay) {
        const stats = performanceProfiler.getStats();
        devFpsEl.textContent = `FPS ${stats.current.fps.toFixed(0)} · ${stats.current.frameTime.toFixed(1)}ms`;
      }
    }
  }

  /**
   * Update stats UI
   * OPTIMIZED: Uses static imports instead of dynamic import() to avoid latency spikes
   */
  updateStatsUI() {
    const statsEl = domCache.get('stats');
    const selectedInfoEl = domCache.get('selectedInfo');

    if (statsEl) {
      renderStats(statsEl, this.world, gameState.fps, {
        fastForward: gameState.fastForward,
        paused: gameState.paused,
        tool: this.uiController?.tools?.mode,
        brushSize: this.uiController?.tools?.brushSize,
        visionEnabled: this.renderer.enableVision,
        clusteringEnabled: this.renderer.enableClustering,
        timeOfDay: this.world.timeOfDay
      });
    }

    if (selectedInfoEl) {
      const focusId = gameState.pinnedId ?? gameState.selectedId ?? null;
      const focusCreature = focusId ? this.world.getAnyCreatureById(focusId) : null;
      renderSelectedInfo(selectedInfoEl, focusCreature, { world: this.world, lineageTracker: this.world.lineageTracker });
    }
  }

  /**
   * Update analytics charts
   * OPTIMIZED: Uses static import instead of dynamic import()
   */
  updateCharts() {
    if (!gameState.inspectorVisible) return;

    // Check if Evolution Analytics section is visible
    const analyticsSection = this.getCachedElement('analyticsSection', () =>
      document.querySelector('#inspector-panel > .panel-body > div:nth-child(4)')
    );
    if (!analyticsSection || analyticsSection.offsetParent === null) return;

    const data = this.analytics.getData();
    if (data.version === gameState.analyticsVersion) return;

    gameState.analyticsVersion = data.version;
    renderAnalyticsCharts(this.world.chartCtx, data);
  }

  /**
   * Update advanced analytics (expensive, so very throttled)
   */
  updateAdvancedAnalytics() {
    const now = performance.now();

    if (now - (this.lastAdvancedAnalyticsUpdate || 0) < 5000) {
      return;
    }
    this.lastAdvancedAnalyticsUpdate = now;

    // Update phylogeny if panel is visible
    const phylogenyList = this.getCachedElement('phylogeny-list', () =>
      document.getElementById('phylogeny-list')
    );
    if (phylogenyList && this.analytics) {
      const phylogenySection = phylogenyList.closest('.panel-body');
      const isVisible = phylogenySection && phylogenySection.offsetParent !== null;

      if (isVisible) {
        const phylogeny = this.analytics.buildPhylogeny(this.world);
        if (phylogeny && phylogeny.length > 0) {
          let html = '<div class="phylogeny-roots">';
          for (const root of phylogeny.slice(0, 5)) {
            html += `<div class="phylogeny-item">
              <span class="phylogeny-name">${root.name}</span>
              <span class="phylogeny-stats">${root.alive}/${root.total} (${root.depth} gen)</span>
            </div>`;
          }
          html += '</div>';
          phylogenyList.innerHTML = html;
        } else {
          phylogenyList.innerHTML = '<span class="muted tiny">No lineage data yet</span>';
        }
      } else {
        phylogenyList.innerHTML = '<span class="muted tiny">Computing...</span>';
      }
    }

    // Update species groups
    const speciesList = this.getCachedElement('species-list', () =>
      document.getElementById('species-list')
    );
    if (speciesList && this.analytics.speciesGroups) {
      if (this.analytics.speciesGroups.length > 0) {
        let html = '<div class="species-groups">';
        for (let i = 0; i < Math.min(5, this.analytics.speciesGroups.length); i++) {
          const group = this.analytics.speciesGroups[i];
          const diet = group.avgGenes.diet || 0;
          const icon = diet > 0.7 ? '🦁' : (diet > 0.3 ? '🦡' : '🦌');
          html += `<div class="species-item">
            <span class="species-icon">${icon}</span>
            <span class="species-size">${group.members} individuals</span>
          </div>`;
        }
        html += '</div>';
        speciesList.innerHTML = html;
      } else {
        speciesList.innerHTML = '<span class="muted tiny">Analyzing genetic diversity...</span>';
      }
    }
  }

  /**
   * Update ecosystem health UI
   */
  updateEcoHealthUI() {
    if (!this.world.ecoHealth?.visible) return;

    const metrics = this.world.ecoHealth.metrics;
    const status = this.world.ecoHealth.getHealthStatus();
    const recommendations = this.world.ecoHealth.getRecommendations(this.world);

    // Update overall score
    const overallScore = this.getCachedElement('health-overall-score', () =>
      document.getElementById('health-overall-score')
    );
    if (overallScore) overallScore.textContent = Math.round(metrics.overall);

    const statusEmoji = this.getCachedElement('health-status-emoji', () =>
      document.getElementById('health-status-emoji')
    );
    if (statusEmoji) statusEmoji.textContent = status.emoji;

    const statusLabel = this.getCachedElement('health-status-label', () =>
      document.getElementById('health-status-label')
    );
    if (statusLabel) statusLabel.textContent = status.label;

    const scoreCircle = this.getCachedElement('health-score-circle', () =>
      document.querySelector('.health-score-circle')
    );
    if (scoreCircle) {
      scoreCircle.style.background = `linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%)`;
    }

    // Update metric bars
    const biodiversityValue = this.getCachedElement('health-biodiversity-value', () =>
      document.getElementById('health-biodiversity-value')
    );
    if (biodiversityValue) biodiversityValue.textContent = Math.round(metrics.biodiversity);

    const biodiversityFill = this.getCachedElement('health-biodiversity-fill', () =>
      document.getElementById('health-biodiversity-fill')
    );
    if (biodiversityFill) biodiversityFill.style.width = `${metrics.biodiversity}%`;

    const stabilityValue = this.getCachedElement('health-stability-value', () =>
      document.getElementById('health-stability-value')
    );
    if (stabilityValue) stabilityValue.textContent = Math.round(metrics.stability);

    const stabilityFill = this.getCachedElement('health-stability-fill', () =>
      document.getElementById('health-stability-fill')
    );
    if (stabilityFill) stabilityFill.style.width = `${metrics.stability}%`;

    const sustainabilityValue = this.getCachedElement('health-sustainability-value', () =>
      document.getElementById('health-sustainability-value')
    );
    if (sustainabilityValue) sustainabilityValue.textContent = Math.round(metrics.sustainability);

    const sustainabilityFill = this.getCachedElement('health-sustainability-fill', () =>
      document.getElementById('health-sustainability-fill')
    );
    if (sustainabilityFill) sustainabilityFill.style.width = `${metrics.sustainability}%`;

    // Update recommendations
    const recList = this.getCachedElement('health-recommendations-list', () =>
      document.getElementById('health-recommendations-list')
    );
    if (recList) {
      recList.innerHTML = recommendations.map(r => `<div>${r}</div>`).join('');
    }
  }

  /**
   * Update scenario status
   */
  updateScenarioStatus() {
    const scenarioStatus = this.getCachedElement('scenario-status', () =>
      document.getElementById('scenario-status')
    );
    if (!scenarioStatus) return;

    const pending = typeof this.world.getPendingDisasters === 'function'
      ? this.world.getPendingDisasters()
      : [];
    const active = this.world.getActiveDisaster();

    if (active) {
      const remaining = Math.max(0, active.timeRemaining ?? 0);
      const mode = active.manual ? 'scenario' : 'random';
      const intensity = (active.intensity ?? 1).toFixed(1);
      scenarioStatus.textContent = `${active.name} (${mode}) · ${remaining.toFixed(1)}s left · ${intensity}× intensity`;
    } else {
      if (pending.length) {
        const next = pending[0];
        scenarioStatus.textContent = `Next: ${next.name} in ${next.startsIn.toFixed(1)}s`;
      } else {
        scenarioStatus.textContent = 'No active disaster.';
      }
    }

    // Update queue display
    const version = typeof this.world.getPendingDisastersVersion === 'function'
      ? this.world.getPendingDisastersVersion()
      : 0;
    const now = performance.now();
    const shouldRefresh = gameState.scenarioPanelVisible &&
      (now - gameState.lastScenarioQueueRender > 250);

    if (version !== gameState.scenarioQueueVersion || shouldRefresh) {
      this.renderScenarioQueue(pending);
      gameState.scenarioQueueVersion = version;
      gameState.lastScenarioQueueRender = now;
    }
  }

  /**
   * Render scenario queue
   */
  renderScenarioQueue(pending = null) {
    const scenarioQueueList = this.getCachedElement('scenario-queue', () =>
      document.getElementById('scenario-queue')
    );
    if (!scenarioQueueList) return;

    const items = pending ?? (typeof this.world.getPendingDisasters === 'function'
      ? this.world.getPendingDisasters()
      : []);

    if (!items.length) {
      scenarioQueueList.innerHTML = '<div class="scenario-queue-empty muted">No queued scenarios.</div>';
      return;
    }

    const html = items.map(item => {
      const durationLabel = item.duration ? `${Math.round(item.duration)}s` : '—';
      const intensityLabel = (item.intensity ?? 1).toFixed(1);
      const waitLabel = item.waitForClear ? 'wait' : 'overlap';
      return `
        <div class="scenario-queue-item">
          <div class="scenario-queue-item-header">
            <span class="scenario-queue-name">${item.name}</span>
            <span class="scenario-queue-start">${item.startsIn.toFixed(1)}s</span>
          </div>
          <div class="scenario-queue-meta">
            <span>dur ${durationLabel}</span>
            <span>int ${intensityLabel}×</span>
            <span>${waitLabel}</span>
          </div>
          <button class="scenario-queue-remove" data-queue-id="${item.id}" title="Remove">✕</button>
        </div>
      `;
    }).join('');
    scenarioQueueList.innerHTML = html;
  }

  /**
   * Perform a single step (for debugging)
   */
  stepOnce() {
    gameState.paused = true;
    gameState.accumulator += this.fixedDt;

  }
}
