/**
 * UI Controller - Centralized UI state and DOM manipulation
 * Handles all UI updates and event bindings
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem, GameEvents } from './event-system.js';
import { analyticsDashboard } from './enhanced-analytics.js';
import { HudMenu } from './hud-menu.js';
import { SANDBOX_PROP_TYPES } from './sandbox-props.js';
import { clamp } from './utils.js';
import { getDebugFlags } from './debug-flags.js';

const CREATURE_SPAWN_TYPES = {
  herbivore: { icon: '🦌', label: 'Herbivore' },
  omnivore: { icon: '🦡', label: 'Omnivore' },
  predator: { icon: '🦁', label: 'Predator' }
};
const DEFAULT_SPAWN_TYPE = 'herbivore';

// Local helper to validate notification subsystem shape without relying on external export
function isNotificationSystem(candidate) {
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
      const notificationsEnabled = this.achievements?.notificationsEnabled !== false;
      if (amount > 0 && this.hasNotifications() && notificationsEnabled) {
        this.notifications.show(`+${amount} XP`, 'achievement', 2200);
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

    eventSystem.on(GameEvents.SESSION_GOAL_COMPLETED, (goal) => {
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

  setPanelVisibility(panel, visible) {
    if (!panel) return false;
    const isVisible = !!visible;
    panel.classList.toggle('hidden', !isVisible);
    panel.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    return isVisible;
  }

  togglePanelVisibility(panel) {
    if (!panel) return false;
    const nextVisible = panel.classList.contains('hidden');
    return this.setPanelVisibility(panel, nextVisible);
  }

  /**
   * Bind core game controls
   */
  bindCoreControls() {
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

    if (showInspectorBtn) showInspectorBtn.addEventListener('click', () => gameState.setInspectorVisible(true));
    if (closeInspectorBtn) closeInspectorBtn.addEventListener('click', () => gameState.setInspectorVisible(false));

    // Quick action buttons (spawn food)
    const spawnFoodBtn = domCache.get('spawnFoodBtn');
    if (spawnFoodBtn) {
      spawnFoodBtn.addEventListener('click', this.boundHandlers.onFood);

    }

    // Spawn creature button and dropdown
    this.bindSpawnCreatureControls();
  }

  bindPropControls() {
    const propToolBtn = domCache.get('propToolBtn');
    const propDropdown = domCache.get('propDropdown');

    if (propToolBtn && propDropdown) {
      // Toggle dropdown on button click
      propToolBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !propDropdown.classList.contains('hidden');
        // Close other dropdowns first
        this.closeAllDropdowns();
        if (!isOpen) {
          propDropdown.classList.remove('hidden');
        }
      });

      // Handle dropdown item clicks
      const dropdownItems = propDropdown.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          const propType = item.dataset.prop;
          this.setPropType(propType);
          this.onPropTool();
          propDropdown.classList.add('hidden');
        });
      });
    }
  }

  /**
   * Close all dropdown menus
   */
  closeAllDropdowns() {
    const creatureDropdown = domCache.get('creatureDropdown');
    const propDropdown = domCache.get('propDropdown');
    if (creatureDropdown) creatureDropdown.classList.add('hidden');
    if (propDropdown) propDropdown.classList.add('hidden');
  }

  setPropType(type) {
    if (!type) return;
    const safeType = SANDBOX_PROP_TYPES[type] ? type : 'bounce';
    gameState.selectedPropType = safeType;
    this.tools?.setPropType?.(safeType);
    this.updatePropButton(safeType);

    const propDropdown = domCache.get('propDropdown');
    if (propDropdown) {
      propDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.prop === safeType);
      });
    }
  }

  cyclePropType(direction = 1) {
    const current = gameState.selectedPropType || 'bounce';
    const idx = this.propTypeOrder.indexOf(current);
    const nextIdx = (idx + direction + this.propTypeOrder.length) % this.propTypeOrder.length;
    this.setPropType(this.propTypeOrder[nextIdx]);
  }

  updatePropButton(type) {
    const propToolBtn = domCache.get('propToolBtn');

    const meta = SANDBOX_PROP_TYPES[type] || SANDBOX_PROP_TYPES.bounce;
    if (propToolBtn) {
      propToolBtn.textContent = meta.icon;
      propToolBtn.title = `${meta.label} (P)`;
    }

  }

  /**
   * Bind spawn creature dropdown controls
   */
  bindSpawnCreatureControls() {
    const spawnCreatureBtn = domCache.get('spawnCreatureBtn');
    const creatureDropdown = domCache.get('creatureDropdown');

    if (spawnCreatureBtn && creatureDropdown) {
      // Toggle dropdown on button click
      spawnCreatureBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !creatureDropdown.classList.contains('hidden');
        // Close other dropdowns first
        this.closeAllDropdowns();
        if (!isOpen) {
          creatureDropdown.classList.remove('hidden');
        }
      });

      // Handle dropdown item clicks
      const dropdownItems = creatureDropdown.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const creatureType = item.dataset.creature;
          this.applySpawnSelection(creatureType);
          this.onSpawnCreature(creatureType);
          creatureDropdown.classList.add('hidden');
        });
      });


    }

    // Global click handler to close dropdowns
    document.addEventListener('click', (e) => {
      // Don't close if clicking inside a dropdown
      if (e.target.closest('.dropdown-menu') || e.target.closest('.spawn-dropdown')) {
        return;
      }
      this.closeAllDropdowns();
    });
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

  bindGameplayModeControls() {
    if (!this.gameplayModes) return;
    const modeSelect = domCache.get('modeSelect');
    const modeApplyBtn = domCache.get('modeApplyBtn');
    const modeCycleBtn = domCache.get('modeCycleBtn');

    if (modeSelect) {
      modeSelect.innerHTML = this.gameplayModes.getModes()
        .map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`)
        .join('');
      modeSelect.value = this.gameplayModes.getActiveMode()?.id;
    }

    if (modeApplyBtn) {
      modeApplyBtn.addEventListener('click', this.boundHandlers.onModeChange);
    }

    if (modeCycleBtn) {
      modeCycleBtn.addEventListener('click', this.boundHandlers.onModeCycle);
    }

    this.renderGameMode();
  }

  bindSessionGoalControls() {
    const refreshBtn = domCache.get('refreshGoalsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', this.boundHandlers.onRefreshGoals);
    }
    this.renderSessionGoals();
  }

  bindWatchControls() {
    const watchToggleBtn = domCache.get('watchModeBtn');
    const watchPauseBtn = domCache.get('watchPauseBtn');
    const watchSpeedBtn = domCache.get('watchSpeedBtn');
    const watchFollowBtn = domCache.get('watchFollowBtn');
    const watchMomentsBtn = domCache.get('watchMomentsBtn');
    const watchGodModeBtn = domCache.get('watchGodModeBtn');
    const watchRecenterBtn = domCache.get('watchRecenterBtn');
    const momentsPanel = domCache.get('momentsPanel');
    const momentsList = domCache.get('momentsList');
    const momentsSummary = domCache.get('momentsSummary');
    const momentsClose = domCache.get('momentsClose');

    if (watchToggleBtn) watchToggleBtn.addEventListener('click', this.boundHandlers.onWatchModeToggle);
    if (watchPauseBtn) watchPauseBtn.addEventListener('click', this.boundHandlers.onWatchPause);
    if (watchSpeedBtn) watchSpeedBtn.addEventListener('click', this.boundHandlers.onWatchSpeed);
    if (watchFollowBtn) watchFollowBtn.addEventListener('click', this.boundHandlers.onWatchFollow);
    if (watchMomentsBtn) watchMomentsBtn.addEventListener('click', this.boundHandlers.onWatchMoments);
    if (watchGodModeBtn) watchGodModeBtn.addEventListener('click', this.boundHandlers.onWatchGodMode);
    if (watchRecenterBtn) watchRecenterBtn.addEventListener('click', this.boundHandlers.onWatchRecenter);

    if (this.moments?.bindDom) {
      this.moments.bindDom({
        panel: momentsPanel,
        listEl: momentsList,
        summaryEl: momentsSummary,
        closeBtn: momentsClose
      });
    }
  }

  onModeChange() {
    const select = domCache.get('modeSelect');
    if (!select || !this.gameplayModes) return;
    const value = select.value;
    this.gameplayModes.applyMode(value);
    this.renderGameMode();
    this.dismissInteractionHint();
  }

  onModeCycle() {
    if (!this.gameplayModes) return;
    this.gameplayModes.cycleMode(1);
    const select = domCache.get('modeSelect');
    if (select) {
      select.value = this.gameplayModes.getActiveMode()?.id;
    }
    this.renderGameMode();
    this.dismissInteractionHint();
  }

  onRefreshGoals() {
    if (!this.sessionGoals) return;
    this.sessionGoals.refresh();
    this.renderSessionGoals();
  }

  /**
   * Spawn a creature of the specified type
   */
  onSpawnCreature(type) {
    const safeType = this.resolveSpawnType(type, { notifyOnFallback: true });
    if (!safeType) return;
    const x = this.world.width / 2 + (Math.random() - 0.5) * 200;
    const y = this.world.height / 2 + (Math.random() - 0.5) * 200;

    // Use world helper so genetics and bookkeeping stay centralized
    const debugFlags = getDebugFlags();
    if (debugFlags.spawnDebug) {
      console.log('[Spawn][ui]', {
        requestedType: type,
        resolvedType: safeType,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
      });
    }
    const creature = this.world.spawnCreatureType(safeType, x, y);
    this.applySpawnSelection(safeType, { silent: true });
    this.dismissInteractionHint();
    if (creature && this.hasNotifications()) {
      this.notifications.show(`Spawned ${safeType}!`, 'info', 1500);
    }
    console.log(`🦌 Spawned ${safeType} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }

  updateSpawnButton(type) {
    const spawnCreatureBtn = domCache.get('spawnCreatureBtn');
    if (!spawnCreatureBtn) return;

    const meta = CREATURE_SPAWN_TYPES[type] || CREATURE_SPAWN_TYPES[DEFAULT_SPAWN_TYPE];
    const icon = meta.icon;
    const label = meta.label;
    spawnCreatureBtn.textContent = icon;
    spawnCreatureBtn.title = `Spawn ${label}`;
  }

  updateSpawnDropdownSelection(type) {
    const creatureDropdown = domCache.get('creatureDropdown');
    if (!creatureDropdown) return;
    creatureDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.creature === type);
    });
  }





  applySpawnSelection(type, { silent = false } = {}) {
    const safeType = CREATURE_SPAWN_TYPES[type] ? type : DEFAULT_SPAWN_TYPE;
    if (!CREATURE_SPAWN_TYPES[type] && !silent && this.hasNotifications()) {
      this.notifications.show('Unknown creature type. Defaulting to herbivore.', 'warning', 2000);
    }
    this.lastSpawnType = safeType;
    gameState.selectedCreatureType = safeType;
    this.updateSpawnButton(safeType);
    this.updateSpawnDropdownSelection(safeType);

    return safeType;
  }

  resolveSpawnType(type, { notifyOnFallback = false } = {}) {
    const directType = CREATURE_SPAWN_TYPES[type] ? type : null;
    if (directType) return directType;

    const fallback = CREATURE_SPAWN_TYPES[this.lastSpawnType]
      ? this.lastSpawnType
      : DEFAULT_SPAWN_TYPE;

    if (notifyOnFallback && this.hasNotifications()) {
      const message = type
        ? 'Selected creature missing. Spawning last used.'
        : 'No creature selected — spawning last used.';
      this.notifications.show(message, 'warning', 2200);
    }
    return fallback;
  }





  /**
   * Bind god mode controls
   */
  bindGodModeControls() {
    const godExitBtn = domCache.get('godModeExit');
    const godTools = [
      domCache.get('godToolFood'),
      domCache.get('godToolCalm'),
      domCache.get('godToolChaos'),
      domCache.get('godToolSpawn'),
      domCache.get('godToolRemove')
    ];

    if (godExitBtn) godExitBtn.addEventListener('click', this.boundHandlers.onGodModeExit);

    for (const btn of godTools) {
      if (!btn) continue;
      btn.addEventListener('click', this.boundHandlers.onGodToolSelect);
    }
  }

  /**
   * Bind panel toggle controls
   */
  bindPanelControls() {
    const featuresCloseBtn = domCache.get('featuresCloseBtn');
    const scenarioCloseBtn = domCache.get('scenarioCloseBtn');
    const achievementsCloseBtn = domCache.get('achievementsCloseBtn');
    const geneEditorCloseBtn = domCache.get('geneEditorCloseBtn');
    const ecoHealthCloseBtn = domCache.get('ecoHealthCloseBtn');
    const shortcutsCloseBtn = document.getElementById('btn-shortcuts-close');

    if (featuresCloseBtn) featuresCloseBtn.addEventListener('click', this.boundHandlers.onFeaturesToggle);

    if (scenarioCloseBtn) scenarioCloseBtn.addEventListener('click', this.boundHandlers.onScenarioToggle);

    if (achievementsCloseBtn) achievementsCloseBtn.addEventListener('click', this.boundHandlers.onAchievementsToggle);

    if (shortcutsCloseBtn) {
      shortcutsCloseBtn.addEventListener('click', () => this.toggleShortcutsHelp());
    }

    if (geneEditorCloseBtn) geneEditorCloseBtn.addEventListener('click', this.boundHandlers.onGeneEditorToggle);

    if (ecoHealthCloseBtn) ecoHealthCloseBtn.addEventListener('click', this.boundHandlers.onEcoHealthToggle);
  }

  toggleShortcutsHelp(forceVisible = null) {
    const overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) return;
    const shouldShow = forceVisible === null
      ? overlay.classList.contains('hidden')
      : !!forceVisible;
    overlay.classList.toggle('hidden', !shouldShow);
    overlay.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
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

  updateWatchModeUI() {
    const watchStrip = domCache.get('watchStrip');
    const watchToggleBtn = domCache.get('watchModeBtn');
    const watchSpeedBtn = domCache.get('watchSpeedBtn');
    const watchFollowBtn = domCache.get('watchFollowBtn');
    const watchRecenterBtn = domCache.get('watchRecenterBtn');
    const controlStrip = document.getElementById('control-strip');

    document.body.classList.toggle('watch-mode', !!gameState.watchModeEnabled);

    const watchSpeeds = [0.5, 1, 2];
    const speedIndex = watchSpeeds.indexOf(gameState.fastForward);
    if (speedIndex >= 0) {
      gameState.watchSpeedIndex = speedIndex;
    }

    if (watchStrip) {
      watchStrip.classList.toggle('hidden', !gameState.watchModeEnabled);
      watchStrip.setAttribute('aria-hidden', gameState.watchModeEnabled ? 'false' : 'true');
    }

    if (controlStrip) {
      controlStrip.classList.toggle('hidden', !!gameState.watchModeEnabled);
      controlStrip.setAttribute('aria-hidden', gameState.watchModeEnabled ? 'true' : 'false');
    }

    if (watchToggleBtn) {
      watchToggleBtn.setAttribute('aria-pressed', gameState.watchModeEnabled ? 'true' : 'false');
      watchToggleBtn.textContent = gameState.watchModeEnabled ? '👁️ Watch' : '🧭 Watch';
    }

    if (watchSpeedBtn) {
      const info = gameState.getWatchSpeedInfo();
      watchSpeedBtn.textContent = info.label;
      watchSpeedBtn.setAttribute('aria-label', `Watch speed ${info.label}`);
    }

    if (watchFollowBtn) {
      const isFollowing = this.camera.followMode !== 'free';
      watchFollowBtn.classList.toggle('active', isFollowing);
      watchFollowBtn.setAttribute('aria-pressed', isFollowing ? 'true' : 'false');
    }

    if (watchRecenterBtn) {
      const isSuspended = performance.now() < (gameState.autoDirectorOverrideUntil || 0);
      watchRecenterBtn.classList.toggle('active', isSuspended);
      watchRecenterBtn.setAttribute('aria-label', isSuspended ? 'Re-center to auto director' : 'Auto director active');
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
    const scenarioPanel = domCache.get('scenarioPanel');
    const geneEditorPanel = domCache.get('geneEditorPanel');
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

  updateGodModeUI() {
    const panel = domCache.get('godModePanel');
    const indicator = domCache.get('godModeIndicator');
    const toolButtons = [
      domCache.get('godToolFood'),
      domCache.get('godToolCalm'),
      domCache.get('godToolChaos'),
      domCache.get('godToolSpawn'),
      domCache.get('godToolRemove')
    ];

    if (panel) {
      panel.classList.toggle('hidden', !gameState.godModeActive);
      panel.setAttribute('aria-hidden', gameState.godModeActive ? 'false' : 'true');
    }
    if (indicator) {
      indicator.classList.toggle('hidden', !gameState.godModeActive);
    }

    for (const btn of toolButtons) {
      if (!btn) continue;
      const tool = btn.dataset.godTool;
      btn.classList.toggle('active', gameState.godModeTool === tool);
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
      if (showBtn) showBtn.classList.add('hidden');
    } else {
      if (inspector) inspector.classList.add('hidden');
      if (showBtn) showBtn.classList.remove('hidden');
    }
  }

  /**
   * Render gameplay mode card
   */
  renderGameMode(modeData = null) {
    const active = modeData || this.gameplayModes?.getActiveMode?.();
    const nameEl = domCache.get('modeName');
    const descEl = domCache.get('modeDescription');
    const tagsEl = domCache.get('modeTags');
    const select = domCache.get('modeSelect');

    if (!active) return;
    if (nameEl) nameEl.textContent = `${active.icon ?? '⚙️'} ${active.name}`;
    if (descEl) descEl.textContent = active.description || '';
    if (tagsEl) {
      tagsEl.innerHTML = (active.tags || []).map(tag => `<span class="pill">${tag}</span>`).join('');
    }
    if (select && active.id) {
      select.value = active.id;
    }
  }

  /**
   * Render session goals card
   */
  renderSessionGoals(goals = null) {
    const container = domCache.get('goalList');
    const card = domCache.get('goalCard');
    const goalData = goals || this.sessionGoals?.getGoals?.() || [];
    if (!container) return;

    if (!goalData.length) {
      container.innerHTML = '<div class="muted tiny">Goals will appear after the world starts running.</div>';
      return;
    }

    container.innerHTML = goalData.map(goal => {
      const percent = Math.min(100, Math.round((goal.progress || 0) * 100));
      const complete = goal.completed || percent >= 100;
      return `
        <div class="goal-row ${complete ? 'complete' : ''}">
          <div class="goal-row-header">
            <span class="goal-icon">${goal.icon || '🎯'}</span>
            <div class="goal-text">
              <div class="goal-desc">${goal.description}</div>
              <div class="goal-meta">${complete ? 'Complete' : `${percent}%`}</div>
            </div>
          </div>
          <div class="goal-progress">
            <div class="goal-progress-fill" style="width:${percent}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    if (card && goalData.some(g => g.completed)) {
      card.classList.add('celebrate');
      setTimeout(() => card.classList.remove('celebrate'), 600);
    }
  }

  /**
   * Update performance metrics display
   */
  updatePerformanceMetrics(rendered, culled, draws) {
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

  onCampaignToggle() {
    // Campaign panel toggle handled in main.js (kept for unified menu model)
  }

  onFood() {
    // Spawn diverse vegetation randomly across the map (10-20 pieces)
    const count = Math.floor(Math.random() * 11) + 10; // 10-20
    const stats = { grass: 0, berries: 0, fruit: 0 };

    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.world.width;
      const y = Math.random() * this.world.height;
      // Let addFood determine the type based on spawn chances
      const beforeLen = this.world.food.length;
      this.world.addFood(x, y);
      const added = this.world.food[this.world.food.length - 1];
      stats[added.type]++;
    }
  }

  onPropTool() {
    this.tools?.setMode?.('prop');
    if (!gameState.selectedPropType) {
      this.setPropType('bounce');
    }
    this.updateToolIndicator('prop');
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



  onWatchModeToggle() {
    gameState.watchModeEnabled = !gameState.watchModeEnabled;
    if (gameState.watchModeEnabled) {
      const speed = Math.min(2, Math.max(0.5, gameState.fastForward || 1));
      gameState.setWatchSpeed(speed);
    }
    this.updateWatchModeUI();
    this.updateSandboxUiVisibility();
  }

  onWatchPause() {
    this.onPause();
  }

  onWatchSpeed() {
    gameState.cycleWatchSpeed();
    this.updateWatchModeUI();
  }

  onWatchFollow() {
    const hasFollow = this.camera.followMode !== 'free';
    if (hasFollow) {
      this.camera.followMode = 'free';
      this.camera.followTarget = null;
      gameState.watchModeFollow = false;
      this.updateWatchModeUI();
      return;
    }

    const autoTarget = this.autoDirector?.getLastFocusTarget?.();
    const targetId = gameState.selectedId ?? autoTarget?.creatureId ?? null;
    if (!targetId) {
      if (this.hasNotifications()) {
        this.notifications.show('Select a creature to follow', 'info', 1800);
      }
      return;
    }

    this.camera.followMode = 'smooth-follow';
    this.camera.followTarget = targetId;
    gameState.watchModeFollow = true;
    this.updateWatchModeUI();
  }

  onWatchMoments() {
    this.moments?.togglePanel?.();
  }

  onWatchGodMode() {
    this.onGodModeToggle();
  }

  onWatchRecenter() {
    this.autoDirector?.recenter?.();
    this.updateWatchModeUI();
  }

  onGodModeToggle() {
    this.setGodModeActive(!gameState.godModeActive, { source: 'menu' });
  }

  onGodModeExit() {
    this.setGodModeActive(false, { source: 'panel' });
  }

  onGodToolSelect(event) {
    const tool = event?.currentTarget?.dataset?.godTool;
    if (!tool) return;
    gameState.godModeTool = tool;
    this.updateGodModeUI();
  }

  setGodModeActive(active, { source = 'menu' } = {}) {
    gameState.godModeActive = !!active;
    if (gameState.godModeActive) {
      this.tools?.setMode?.('inspect');
      gameState.spawnMode = false;
      gameState.geneEditorSpawnMode = false;
      if (!gameState.godModeTool) {
        gameState.godModeTool = 'food';
      }
      if (this.hasNotifications() && source !== 'gesture') {
        this.notifications.show('✨ God mode on', 'info', 1400);
      }
    } else if (this.hasNotifications() && source !== 'gesture') {
      this.notifications.show('God mode off', 'info', 1200);
    }
    this.updateGodModeUI();
    this.updateSandboxUiVisibility();
  }

  onFeaturesToggle() {
    const featuresPanel = domCache.get('featuresPanel');
    if (featuresPanel) {
      gameState.featuresPanelVisible = !gameState.featuresPanelVisible;
      this.setPanelVisibility(featuresPanel, gameState.featuresPanelVisible);
    }
    this.dismissInteractionHint();
  }

  onScenarioToggle() {
    const scenarioPanel = domCache.get('scenarioPanel');
    if (scenarioPanel) {
      gameState.scenarioPanelVisible = !gameState.scenarioPanelVisible;
      this.setPanelVisibility(scenarioPanel, gameState.scenarioPanelVisible);
    }
    this.updateSandboxUiVisibility();
    this.dismissInteractionHint();
  }

  onAchievementsToggle() {
    const panel = domCache.get('achievementsPanel') || document.getElementById('achievements-panel');
    if (panel) {
      const isVisible = this.togglePanelVisibility(panel);
      if (isVisible) {
        this.renderAchievementsPanel();
        this.bindAchievementsControls();
      }
    }
    this.dismissInteractionHint();
  }

  onAchievementsReset() {
    if (!this.achievements?.resetAll) return;
    const ok = typeof window === 'undefined' ? true : window.confirm('Reset all achievements and XP?');
    if (ok) {
      this.achievements.resetAll();
      this.renderAchievementsPanel();
    }
  }

  bindAchievementsControls() {
    const filter = document.getElementById('achievements-filter');
    const sort = document.getElementById('achievements-sort');
    const resetBtn = document.getElementById('btn-achievements-reset');

    if (filter && !filter._boundAchievements) {
      filter.addEventListener('change', () => this.renderAchievementsPanel());
      filter._boundAchievements = true;
    }
    if (sort && !sort._boundAchievements) {
      sort.addEventListener('change', () => this.renderAchievementsPanel());
      sort._boundAchievements = true;
    }
    if (resetBtn && !resetBtn._boundAchievements) {
      resetBtn.addEventListener('click', this.boundHandlers.onAchievementsReset);
      resetBtn._boundAchievements = true;
    }
  }

  renderAchievementsPanel() {
    const panel = document.getElementById('achievements-panel');
    if (!panel || panel.classList.contains('hidden')) return;

    const listEl = document.getElementById('achievements-list');
    const summaryEl = document.getElementById('achievements-summary');
    if (!listEl || !summaryEl || !this.achievements?.getProgress) return;

    const filterValue = document.getElementById('achievements-filter')?.value || 'all';
    const sortValue = document.getElementById('achievements-sort')?.value || 'locked';

    const progress = this.achievements.getProgress();
    let items = Array.isArray(progress.items) ? progress.items.slice() : [];

    if (filterValue !== 'all') {
      items = items.filter(i => i.type === filterValue);
    }

    switch (sortValue) {
      case 'unlocked':
        items.sort((a, b) => (b.unlocked === a.unlocked) ? (b.progress.percent - a.progress.percent) : (b.unlocked - a.unlocked));
        break;
      case 'recent':
        items.sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0));
        break;
      case 'name':
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'locked':
      default:
        items.sort((a, b) => (a.unlocked === b.unlocked) ? (b.progress.percent - a.progress.percent) : (a.unlocked - b.unlocked));
        break;
    }

    const xpTotal = Math.floor(progress.xp || 0);
    const nextLevelXP = Math.max(0, Math.floor(progress.nextLevelXP || 0));
    const levelProgress = nextLevelXP > 0 ? Math.min(1, xpTotal / nextLevelXP) : 1;
    summaryEl.innerHTML = `
      <div class="achievements-summary-row">
        <span>${progress.unlocked}/${progress.total} unlocked</span>
        <span>Level ${progress.level}</span>
        <span>${xpTotal}/${nextLevelXP} XP</span>
        <span>${Math.floor(progress.percentage)}%</span>
      </div>
      <div class="achievements-level-bar">
        <div class="achievements-level-fill" style="width:${Math.round(levelProgress * 100)}%"></div>
      </div>
    `;

    listEl.innerHTML = items.map(item => {
      const isSecretLocked = item.secret && !item.unlocked;
      const name = isSecretLocked ? '???' : item.name;
      const desc = isSecretLocked ? 'Hidden achievement' : (item.description || '');
      const icon = isSecretLocked ? '❓' : (item.icon || '🏅');
      const goal = item.progress.goal;
      const current = item.progress.current;
      const percent = item.progress.percent || 0;
      const progressHtml = goal ? `
        <div class="achievement-progress-bar">
          <div class="achievement-progress-fill" style="width:${Math.round(percent * 100)}%"></div>
        </div>
        <div class="achievement-progress-text">
          <span>${Math.floor(current)}/${goal}</span>
          <span>${Math.round(percent * 100)}%</span>
        </div>
      ` : '';

      return `
        <div class="achievement-item ${item.unlocked ? 'unlocked' : ''}">
          <div class="achievement-icon">${icon}</div>
          <div class="achievement-main">
            <div class="achievement-title-row">
              <div class="achievement-name">${name}</div>
              <div class="achievement-type">${item.type || ''}</div>
            </div>
            <div class="achievement-desc">${desc}</div>
            ${progressHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  onGeneEditorToggle() {
    const panel = domCache.get('geneEditorPanel') || document.getElementById('gene-editor-panel');
    if (panel) {
      this.togglePanelVisibility(panel);
    }
    this.updateSandboxUiVisibility();
    this.dismissInteractionHint();
  }

  onEcoHealthToggle() {
    const panel = document.getElementById('eco-health-panel');
    if (panel) {
      this.togglePanelVisibility(panel);
    }
    this.dismissInteractionHint();
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

  /**
   * Perform god mode action on selected creature
   */
  performGodAction(action) {
    // Prefer selected creature; fall back to nearest to camera center
    let creature = gameState.selectedId ? this.world.getAnyCreatureById(gameState.selectedId) : null;
    if (!creature || !creature.alive) {
      const cx = this.camera.x;
      const cy = this.camera.y;
      creature = this.world?.creatureManager?.nearestCreature(cx, cy, 120) || null;
    }

    if (!creature || !creature.alive) {
      this.notifications?.show?.('Select a creature first', 'warning', 1200);
      return;
    }

    try {
      switch (action) {
        case 'heal':
          creature.health = creature.maxHealth;
          creature.logEvent('Healed by divine intervention', this.world.t);
          break;

        case 'boost':
          creature.energy = Math.min((creature.energy ?? 0) + 30, creature.maxEnergy ?? 100);
          creature.logEvent('Received energy boost', this.world.t);
          break;

        case 'kill':
          creature.alive = false;
          creature.health = 0;
          creature.deathCause = 'god';
          creature.killedBy = 'god';
          creature.logEvent('Struck down by god', this.world.t);
          gameState.selectedId = null;
          break;

        case 'clone':
          if (this.world.cloneCreature) {
            const clone = this.world.cloneCreature(creature);
            if (clone && this.notifications) {
              this.notifications.show(`Cloned #${creature.id}`, 'info', 1200);
            }
          } else if (this.notifications) {
            this.notifications.show('Clone action unavailable', 'warning', 1200);
          }
          break;
      }

      window.godModeActionCount = (window.godModeActionCount || 0) + 1;

      try {
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, {
          action,
          creatureId: creature.id,
          worldTime: this.world.t
        });
      } catch (e) {
        console.warn('Failed to emit god mode action event:', e);
      }

    } catch (error) {
      console.error(`God action '${action}' failed:`, error);
    }
  }

  /**
   * Enhanced system handlers
   */
  onAnalyticsToggle() {
    analyticsDashboard.toggle();
  }

  onDebugToggle() {
    if (this.debugConsole) {
      this.debugConsole.toggle();
    }
  }

  onPerformanceToggle() {
    // Performance monitor is toggled with F12 key
    const monitor = document.querySelector('#performance-monitor');
    if (monitor) {
      const isVisible = monitor.style.display !== 'none';
      if (isVisible) {
        monitor.style.display = 'none';
      } else {
        monitor.style.display = 'block';
      }
    }
  }

  /**
   * Export functions - delegate to analytics
   */
  exportSnapshot() {
    if (this.subsystems.analytics) {
      const data = this.subsystems.analytics.snapshot();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-snapshot-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.hasNotifications()) {
        this.notifications.show('📊 Snapshot exported', 'success', 2000);
      }
    }
  }

  exportCSV() {
    if (this.subsystems.analytics) {
      const csv = this.subsystems.analytics.exportAsCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-population-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.hasNotifications()) {
        this.notifications.show('📈 Population CSV exported', 'success', 2000);
      }
    }
  }

  exportGenesCSV() {
    if (this.subsystems.analytics) {
      const csv = this.subsystems.analytics.exportGeneHistoryCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-genes-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (this.hasNotifications()) {
        this.notifications.show('🧬 Gene history CSV exported', 'success', 2000);
      }
    }
  }
}
