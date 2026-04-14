/**
 * UI Controller - Centralized UI state and DOM manipulation
 * Handles all UI updates and event bindings
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem, GameEvents } from './event-system.js';
import { HudMenu } from './hud-menu.js';
import { SANDBOX_PROP_TYPES } from './sandbox-props.js';
import { clamp } from './utils.js';

import { applyUiExportMethods } from './ui-controller-exports.js';
import { applyUiGameModeMethods } from './ui-controller-game-mode.js';
import { applyUiWatchMethods } from './ui-controller-watch.js';
import { applyUiGodModeMethods } from './ui-controller-god-mode.js';
import { DEFAULT_SPAWN_TYPE, applyUiSpawnMethods } from './ui-controller-spawn.js';
import { applyUiAchievementsMethods } from './ui-controller-achievements.js';
import { applyUiPanelMethods } from './ui-controller-panels.js';

// Local helper to validate notification subsystem shape without relying on external export
export function isNotificationSystem(candidate) {
  return !!candidate &&
    typeof candidate.show === 'function' &&
    typeof candidate.update === 'function' &&
    typeof candidate.draw === 'function';
}

export class UIController {
  constructor(world, camera, tools, subsystems = {}) {
    this.world = world;
    this.camera = camera;
    this.tools = tools;
    this.lastSpawnType = DEFAULT_SPAWN_TYPE;
    this.propTypeOrder = Object.keys(SANDBOX_PROP_TYPES);

    // Store subsystems for enhanced integration
    this.subsystems = subsystems;
    this.tutorial = subsystems.tutorial;
    this.achievements = subsystems.achievements;
    this.audio = subsystems.audio;
    this.notifications = isNotificationSystem(subsystems.notifications)
      ? subsystems.notifications
      : null;
    this.debugConsole = subsystems.debugConsole;
    this.geneEditor = subsystems.geneEditor;
    this.ecoHealth = subsystems.ecoHealth;
    this.gameplayModes = subsystems.gameplayModes;
    this.sessionGoals = subsystems.sessionGoals;
    this.autoDirector = subsystems.autoDirector;
    this.moments = subsystems.moments;

    this.boundHandlers = {
      onPause: this.onPause.bind(this),
      onStep: this.onStep.bind(this),
      onFood: this.onFood.bind(this),
      onBehaviorChange: this.onBehaviorChange.bind(this),

      onPropTool: this.onPropTool.bind(this),
      onGodModeToggle: this.onGodModeToggle.bind(this),
      onGodModeExit: this.onGodModeExit.bind(this),
      onGodToolSelect: this.onGodToolSelect.bind(this),
      onFeaturesToggle: this.onFeaturesToggle.bind(this),
      onScenarioToggle: this.onScenarioToggle.bind(this),
      onAchievementsToggle: this.onAchievementsToggle.bind(this),
      onAchievementsReset: this.onAchievementsReset.bind(this),
      onGeneEditorToggle: this.onGeneEditorToggle.bind(this),
      onEcoHealthToggle: this.onEcoHealthToggle.bind(this),
      onAnalyticsToggle: this.onAnalyticsToggle.bind(this),
      onDebugToggle: this.onDebugToggle.bind(this),
      onPerformanceToggle: this.onPerformanceToggle.bind(this),
      onSessionMetaToggle: this.onSessionMetaToggle.bind(this),
      onCampaignToggle: this.onCampaignToggle.bind(this),
      onModeChange: this.onModeChange.bind(this),
      onModeCycle: this.onModeCycle.bind(this),
      onRefreshGoals: this.onRefreshGoals.bind(this),

      onWatchModeToggle: this.onWatchModeToggle.bind(this),
      onWatchPause: this.onWatchPause.bind(this),
      onWatchSpeed: this.onWatchSpeed.bind(this),
      onWatchFollow: this.onWatchFollow.bind(this),
      onWatchMoments: this.onWatchMoments.bind(this),
      onWatchGodMode: this.onWatchGodMode.bind(this),
      onWatchRecenter: this.onWatchRecenter.bind(this)
    };

    // Setup event listeners for enhanced systems
    this.setupEventListeners();

    this.initialize();
  }

  /**
   * Setup event listeners for enhanced systems
   */
  setupEventListeners() {
    // Performance alerts are now silent by default
    // They only show when explicitly enabled via performanceProfiler.setOverlayAlerts(true)
    eventSystem.on('performance:alert', (alert) => {
      // Only show if notifications are configured to show performance alerts
      if (this.hasNotifications() && this.notifications.showPerformanceAlerts) {
        this.notifications.show(`⚠️ ${alert.message}`, 'performance', 3000);
      }
    });

    // Generic UI notifications (campaign, disease, etc.)
    eventSystem.on(GameEvents.NOTIFICATION, (data) => {
      if (!data || !this.hasNotifications()) return;
      const message = data.message || '';
      if (!message) return;
      this.notifications.show(message, data.type || 'info', data.duration || 3000);
    });

    eventSystem.on(GameEvents.GOD_MODE_TOGGLE, (data) => {
      this.setGodModeActive(!gameState.godModeActive, { source: data?.source || 'gesture' });
    });

    eventSystem.on('god:tool-changed', (data) => {
      const tool = data?.tool;
      if (!tool) return;
      this.setGodTool(tool, {
        source: data?.source || 'event',
        announce: data?.source === 'hotkey'
      });
    });

    // Listen for achievement unlocks
    eventSystem.on(GameEvents.ACHIEVEMENT_UNLOCKED, (data) => {
      const notificationsEnabled = this.achievements?.notificationsEnabled !== false;
      if (this.hasNotifications() && notificationsEnabled) {
        this.notifications.show(`🏆 ${data.name}`, 'achievement', 3000);
      }
      if (this.audio) {
        this.audio.playSound('achievement');
      }
      this.renderAchievementsPanel();
    });

    // XP grants (campaign rewards, etc.)
    eventSystem.on(GameEvents.ACHIEVEMENT_XP, (data) => {
      const amount = Number(data?.amount) || 0;
      const levelUp = !!data?.levelUp;
      const notificationsEnabled = this.achievements?.notificationsEnabled !== false;
      if (this.hasNotifications() && notificationsEnabled && (amount > 0 || levelUp)) {
        const message = levelUp
          ? `Level ${Number(data?.level) || this.achievements?.level || 1} reached`
          : `+${amount} XP`;
        if (message) {
          this.notifications.show(message, 'achievement', levelUp ? 2600 : 2200);
        }
      }
      if (levelUp && this.world?.particles) {
        const fxX = this.camera?.x ?? this.world.width * 0.5;
        const fxY = this.camera?.y ?? this.world.height * 0.5;
        this.world.particles.emit(fxX, fxY, 'levelup');
        this.world.particles.triggerShake?.(3.5);
      }
      this.renderAchievementsPanel();
    });

    // Live progress updates
    eventSystem.on(GameEvents.ACHIEVEMENT_PROGRESS, () => {
      this.renderAchievementsPanel();
    });

    eventSystem.on(GameEvents.GAME_MODE_CHANGED, (data) => {
      this.renderGameMode(data);
    });

    eventSystem.on(GameEvents.SESSION_GOAL_UPDATED, (goals) => {
      this.renderSessionGoals(goals);
    });

    eventSystem.on(GameEvents.SESSION_GOAL_COMPLETED, (_goal) => {
      const card = domCache.get('goalCard');
      if (card) {
        card.classList.add('pulse');
        setTimeout(() => card.classList.remove('pulse'), 400);
      }
      if (this.audio) this.audio.playUISound?.('success');
    });

    // Listen for game pause/resume events (from blur/focus)
    eventSystem.on('game:paused', () => {
      this.updatePauseButton();

    });

    eventSystem.on('game:resumed', () => {
      this.updatePauseButton();

    });

    // Tool change events (from keyboard shortcuts)
    eventSystem.on('tool:changed', (data) => {
      if (data?.mode) {
        this.updateToolIndicator(data.mode);
      }
    });
  }

  /**
   * Initialize UI event bindings
   */
  initialize() {
    this.setupHudMenu();
    this.bindCoreControls();

    this.bindPropControls();
    this.bindGodModeControls();
    this.bindPanelControls();
    this.bindInteractionHintControls();
    this.bindBehaviorControls();
    this.bindEnhancedControls();
    this.bindChaosControls();
    this.bindFeaturesEnhancements();
    this.bindGameplayModeControls();
    this.bindSessionGoalControls();
    this.bindWatchControls();
    this.applyMobileDefaults();
    this.updateInspectorVisibility();

    this.updateSessionMetaVisibility();
    this.applySpawnSelection(gameState.selectedCreatureType || this.lastSpawnType, { silent: true });
    this.setPropType(gameState.selectedPropType || 'bounce');
    this.updateSandboxUiVisibility();
    this.updateGodModeUI();
    this.updateWatchModeUI();
  }

  applyMobileDefaults() {
    if (this.mobileDefaultsApplied) return;
    const isMobile = document.body.classList.contains('mobile-device') ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    if (!isMobile) return;

    this.mobileDefaultsApplied = true;
    gameState.inspectorVisible = false;
    gameState.inspectorAutoOpen = false;
    gameState.sessionMetaVisible = false;

    const panels = [
      document.getElementById('scenario-panel'),
      document.getElementById('gene-editor-panel'),
      document.getElementById('eco-health-panel'),
      document.getElementById('achievements-panel'),
      document.getElementById('features-panel')
    ];

    for (const panel of panels) {
      if (!panel) continue;
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  setupHudMenu() {
    this.hudMenu = new HudMenu({ handlers: this.boundHandlers });
    this.hudMenu.initialize();
  }

  /**
   * Check if notifications subsystem is available
   */
  hasNotifications() {
    return isNotificationSystem(this.notifications);
  }

  blurFocusedDescendant(container) {
    const active = document.activeElement;
    if (container && active instanceof HTMLElement && container.contains(active)) {
      active.blur();
    }
  }

  /**
   * Bind core game controls
   */
  bindCoreControls() {
    // Panel overlay (mobile — closes panels on tap outside)
    const panelOverlay = document.querySelector('.panel-overlay');
    if (panelOverlay) {
      panelOverlay.addEventListener('click', () => {
        this.closeMajorPanels();
        const inspector = domCache.get('inspector');
        if (inspector) inspector.classList.add('hidden');
        gameState.inspectorVisible = false;
        this.updateInspectorVisibility();
      });
    }

    // Export buttons
    const exportBtn = domCache.get('exportBtn');
    const exportCSVBtn = domCache.get('exportCSVBtn');
    const exportGenesBtn = domCache.get('exportGenesBtn');

    if (exportBtn) exportBtn.addEventListener('click', () => this.exportSnapshot());
    if (exportCSVBtn) exportCSVBtn.addEventListener('click', () => this.exportCSV());
    if (exportGenesBtn) exportGenesBtn.addEventListener('click', () => this.exportGenesCSV());

    // Inspector controls
    const showInspectorBtn = domCache.get('showInspectorBtn');
    const closeInspectorBtn = domCache.get('closeInspectorBtn');
    const minimizeInspectorBtn = domCache.get('minimizeInspectorBtn');
    const inspector = domCache.get('inspector');

    if (showInspectorBtn) {
      showInspectorBtn.addEventListener('click', () => {
        if (inspector) inspector.classList.remove('minimized');
        this.setInspectorVisibility(true, true);
      });
    }
    if (closeInspectorBtn) {
      closeInspectorBtn.addEventListener('click', () => this.setInspectorVisibility(false, false));
    }
    if (minimizeInspectorBtn && inspector) {
      minimizeInspectorBtn.addEventListener('click', () => {
        inspector.classList.toggle('minimized');
      });
    }

    // Quick action buttons (spawn food)
    const spawnFoodBtn = domCache.get('spawnFoodBtn');
    if (spawnFoodBtn) {
      spawnFoodBtn.addEventListener('click', this.boundHandlers.onFood);

    }

    // Spawn creature button and dropdown
    this.bindSpawnCreatureControls();
  }

  bindInteractionHintControls() {
    const hint = domCache.get('interactionHint');
    const hintClose = domCache.get('interactionHintClose');
    if (hintClose) {
      hintClose.addEventListener('click', (event) => {
        event.stopPropagation();
        this.dismissInteractionHint();
      });
    }

    document.addEventListener('pointerdown', (event) => {
      if (!hint || hint.classList.contains('hidden')) return;
      if (!hint.contains(event.target)) {
        this.dismissInteractionHint();
      }
    });
  }

  /**
   * Bind behavior weight controls
   */
  bindBehaviorControls() {
    const forageSlider = domCache.get('forageSlider');
    const wanderSlider = domCache.get('wanderSlider');
    const restSlider = domCache.get('restSlider');

    if (forageSlider) forageSlider.addEventListener('input', this.boundHandlers.onBehaviorChange);
    if (wanderSlider) wanderSlider.addEventListener('input', this.boundHandlers.onBehaviorChange);
    if (restSlider) restSlider.addEventListener('input', this.boundHandlers.onBehaviorChange);

    // Initialize behavior weights
    this.updateBehaviorWeights();
  }

  /**
   * Bind enhanced system controls
   */
  bindEnhancedControls() {
    const analyticsToggle = domCache.get('analytics-dashboard-toggle');
    const debugToggle = domCache.get('debug-console-toggle');
    const performanceToggle = domCache.get('performance-monitor-toggle');

    if (analyticsToggle) analyticsToggle.setAttribute('aria-label', 'Toggle analytics dashboard');
    if (debugToggle) debugToggle.setAttribute('aria-label', 'Toggle debug console');
    if (performanceToggle) performanceToggle.setAttribute('aria-label', 'Toggle performance monitor');
  }

  bindChaosControls() {
    const chaosSlider = domCache.get('chaosSlider');
    const chaosValue = domCache.get('chaosValue');
    if (!chaosSlider) return;

    const stored = typeof window !== 'undefined'
      ? Number(window.localStorage?.getItem('creatureSandboxChaosLevel'))
      : null;
    const initialLevel = Number.isFinite(stored) ? stored : gameState.chaosLevel;
    const safeLevel = clamp(initialLevel, 0, 1);
    gameState.chaosLevel = safeLevel;
    if (this.world?.setChaosLevel) {
      this.world.setChaosLevel(safeLevel);
    }

    chaosSlider.value = String(Math.round(safeLevel * 100));
    if (chaosValue) {
      chaosValue.textContent = `${Math.round(safeLevel * 100)}%`;
    }

    chaosSlider.addEventListener('input', () => {
      const level = clamp(Number(chaosSlider.value) / 100, 0, 1);
      gameState.chaosLevel = level;
      if (this.world?.setChaosLevel) {
        this.world.setChaosLevel(level);
      }
      if (chaosValue) {
        chaosValue.textContent = `${Math.round(level * 100)}%`;
      }
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem('creatureSandboxChaosLevel', String(level));
      }
    });
  }

  /**
   * Update pause button state
   */
  updatePauseButton() {
    const pauseBtn = domCache.get('pauseBtn');
    if (pauseBtn) {
      if (gameState.paused) {
        pauseBtn.textContent = '▶️ Play';
        pauseBtn.setAttribute('aria-label', 'Resume simulation');
        pauseBtn.setAttribute('aria-pressed', 'true');
        pauseBtn.classList.add('active');
      } else {
        pauseBtn.textContent = '⏸️ Pause';
        pauseBtn.setAttribute('aria-label', 'Pause simulation');
        pauseBtn.setAttribute('aria-pressed', 'false');
        pauseBtn.classList.remove('active');
      }
    }

    const watchPauseBtn = domCache.get('watchPauseBtn');
    if (watchPauseBtn) {
      watchPauseBtn.textContent = gameState.paused ? '▶️' : '⏸️';
      watchPauseBtn.setAttribute('aria-pressed', gameState.paused ? 'true' : 'false');
      watchPauseBtn.setAttribute('aria-label', gameState.paused ? 'Resume simulation' : 'Pause simulation');
      watchPauseBtn.classList.toggle('active', gameState.paused);
    }
  }

  updateSessionMetaVisibility() {
    const sessionMeta = domCache.get('sessionMeta');
    const modeBtn = domCache.get('modeBtn');
    const isVisible = gameState.sessionMetaVisible !== false;

    if (sessionMeta) {
      sessionMeta.classList.toggle('hidden', !isVisible);
      sessionMeta.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    }

    if (modeBtn) {
      modeBtn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
      modeBtn.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    }
  }

  updateSandboxUiVisibility() {
    const quickActions = domCache.get('quickActions');
    const mobileQuickActions = domCache.get('mobileQuickActions');
    const interactionHint = domCache.get('interactionHint');
    const scenarioPanel = domCache.get('scenarioPanel') || document.getElementById('scenario-panel');
    const geneEditorPanel = domCache.get('geneEditorPanel') || document.getElementById('gene-editor-panel');
    const editorOpen = (scenarioPanel && !scenarioPanel.classList.contains('hidden')) ||
      (geneEditorPanel && !geneEditorPanel.classList.contains('hidden'));
    const godModeActive = gameState.godModeActive;
    const watchMode = gameState.watchModeEnabled;

    if (quickActions) quickActions.classList.toggle('hidden', editorOpen || godModeActive || watchMode);
    if (mobileQuickActions) mobileQuickActions.classList.toggle('hidden', editorOpen || godModeActive || watchMode);
    if (interactionHint) {
      interactionHint.classList.toggle('hidden', editorOpen || godModeActive || watchMode);
      interactionHint.setAttribute('aria-hidden', editorOpen || godModeActive || watchMode ? 'true' : 'false');
    }
  }

  dismissInteractionHint() {
    const hint = domCache.get('interactionHint');
    if (!hint) return;
    const promptId = gameState.curiosityPrompt?.id;
    if (promptId) {
      gameState.curiosityPromptDismissed.add(promptId);
      gameState.curiosityPrompt = null;
    }
    hint.dataset.dismissed = 'true';
    hint.classList.add('hidden');
    hint.setAttribute('aria-hidden', 'true');
  }

  /**
   * Update behavior weight sliders
   */
  updateBehaviorWeights() {
    const forageSlider = domCache.get('forageSlider');
    const wanderSlider = domCache.get('wanderSlider');
    const restSlider = domCache.get('restSlider');

    // Import BehaviorConfig dynamically to avoid circular dependency
    import('./behavior.js').then(({ BehaviorConfig }) => {
      if (forageSlider) forageSlider.value = BehaviorConfig.forageWeight;
      if (wanderSlider) wanderSlider.value = BehaviorConfig.wanderWeight;
      if (restSlider) restSlider.value = BehaviorConfig.restWeight;
    });
  }

  /**
   * Update inspector visibility
   */
  updateInspectorVisibility() {
    const inspector = domCache.get('inspector');
    const showBtn = domCache.get('showInspectorBtn');

    if (gameState.inspectorVisible) {
      if (inspector) inspector.classList.remove('hidden');
      if (inspector) inspector.setAttribute('aria-hidden', 'false');
      if (showBtn) {
        showBtn.classList.add('hidden');
        showBtn.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (inspector) inspector.classList.add('hidden');
      if (inspector) inspector.setAttribute('aria-hidden', 'true');
      if (showBtn) {
        showBtn.classList.remove('hidden');
        showBtn.setAttribute('aria-hidden', 'false');
      }
    }
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const anyPanelOrInspectorOpen = document.querySelector('.panel:not(.hidden), #inspector:not(.hidden)');
      document.body.classList.toggle('panel-open', !!anyPanelOrInspectorOpen);
    } else {
      document.body.classList.remove('panel-open');
    }
  }

  setInspectorVisibility(visible, autoOpen = visible) {
    gameState.setInspectorVisible(visible);
    gameState.setInspectorAutoOpen(autoOpen);
    this.updateInspectorVisibility();
  }

  /**
   * Update performance metrics display
   */
  updatePerformanceMetrics(_rendered, _culled, _draws) {
    // Note: Performance metrics are now handled by the performance profiler overlay
    // This method is kept for compatibility but metrics are displayed in the profiler UI
  }

  /**
   * Event handlers
   */
  onPause() {
    const paused = gameState.togglePause();
    eventSystem.emit(paused ? 'game:paused' : 'game:resumed', { reason: 'ui' });
    this.updatePauseButton();
    this.updateMobileControls();
  }

  onStep() {
    const wasPaused = gameState.paused;
    gameState.paused = true;
    if (!wasPaused) {
      eventSystem.emit('game:paused', { reason: 'step' });
    }
    this.updatePauseButton();
    this.updateMobileControls();
    // Single step handled by game loop's step mode
  }

  onSessionMetaToggle() {
    gameState.sessionMetaVisible = !gameState.sessionMetaVisible;
    this.updateSessionMetaVisibility();
  }

  onFood() {
    // Spawn diverse vegetation randomly across the map (10-20 pieces)
    const count = Math.floor(Math.random() * 11) + 10; // 10-20
    const stats = { grass: 0, berries: 0, fruit: 0 };

    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.world.width;
      const y = Math.random() * this.world.height;
      // Let addFood determine the type based on spawn chances
      this.world.addFood(x, y);
      const added = this.world.food[this.world.food.length - 1];
      stats[added.type]++;
    }
  }

  /**
   * Update tool indicator and quick action button states
   */
  updateToolIndicator(mode) {
    const toolMeta = {
      food: { icon: '🌿', label: 'Food', hint: '[/] brush' },
      spawn: { icon: '🧬', label: 'Spawn', hint: '' },
      erase: { icon: '🧹', label: 'Erase', hint: '[/] brush' },
      inspect: { icon: '🔍', label: 'Inspect', hint: '' },
      prop: { icon: '🧱', label: 'Props', hint: '' }
    };

    // Update quick action button active states
    const foodBtn = domCache.get('spawnFoodBtn');
    const spawnBtn = domCache.get('spawnCreatureBtn');
    const propBtn = domCache.get('propToolBtn');

    foodBtn?.classList.toggle('active', mode === 'food');
    spawnBtn?.classList.toggle('active', mode === 'spawn');
    propBtn?.classList.toggle('active', mode === 'prop');

    // Pulse the active button
    const activeBtn = mode === 'food' ? foodBtn : mode === 'spawn' ? spawnBtn : mode === 'prop' ? propBtn : null;
    if (activeBtn) {
      activeBtn.classList.add('pulse');
      setTimeout(() => activeBtn.classList.remove('pulse'), 250);
    }

    // Update tool indicator
    const indicator = document.getElementById('tool-indicator');
    if (!indicator) return;

    const meta = toolMeta[mode];
    if (!meta) {
      indicator.classList.remove('visible');
      return;
    }

    const iconEl = indicator.querySelector('.tool-icon');
    const nameEl = indicator.querySelector('.tool-name');
    const hintEl = indicator.querySelector('.tool-hint');

    if (iconEl) iconEl.textContent = meta.icon;
    if (nameEl) nameEl.textContent = meta.label;
    if (hintEl) hintEl.textContent = meta.hint;

    indicator.classList.add('visible');

    // Hide indicator after brief display
    clearTimeout(this._toolIndicatorTimeout);
    this._toolIndicatorTimeout = setTimeout(() => {
      indicator.classList.remove('visible');
    }, 1800);
  }

  onBehaviorChange() {
    // Import and update behavior weights dynamically
    import('./behavior.js').then(({ setBehaviorWeights }) => {
      const forageSlider = domCache.get('forageSlider');
      const wanderSlider = domCache.get('wanderSlider');
      const restSlider = domCache.get('restSlider');

      setBehaviorWeights({
        forage: Number(forageSlider?.value ?? 1),
        wander: Number(wanderSlider?.value ?? 1),
        rest: Number(restSlider?.value ?? 0.6)
      });
    });
  }

  updateMobileControls() {
    const ctrlPauseIcon = document.querySelector('#ctrl-pause .ctrl-icon');
    const ctrlPauseBtn = document.getElementById('ctrl-pause');
    const ctrlSpeedIcon = document.querySelector('#ctrl-speed .ctrl-icon');

    if (ctrlPauseIcon) {
      ctrlPauseIcon.textContent = gameState.paused ? '▶️' : '⏸️';
    }
    if (ctrlPauseBtn) {
      ctrlPauseBtn.classList.toggle('active', gameState.paused);
      ctrlPauseBtn.setAttribute('aria-pressed', gameState.paused ? 'true' : 'false');
      ctrlPauseBtn.setAttribute('aria-label', gameState.paused ? 'Resume simulation' : 'Pause simulation');
    }

    if (ctrlSpeedIcon) {
      ctrlSpeedIcon.textContent = `${gameState.fastForward}×`;
    }
  }
}

// Apply prototype methods from focused modules
applyUiExportMethods(UIController);
applyUiGameModeMethods(UIController);
applyUiWatchMethods(UIController);
applyUiGodModeMethods(UIController);
applyUiSpawnMethods(UIController);
applyUiAchievementsMethods(UIController);
applyUiPanelMethods(UIController);
