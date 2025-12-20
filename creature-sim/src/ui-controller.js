/**
 * UI Controller - Centralized UI state and DOM manipulation
 * Handles all UI updates and event bindings
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem, GameEvents } from './event-system.js';
import { performanceProfiler } from './performance-profiler.js';
import { analyticsDashboard } from './enhanced-analytics.js';
import { scenarioEditor } from './scenario-editor.js';

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

    this.boundHandlers = {
      onPause: this.onPause.bind(this),
      onStep: this.onStep.bind(this),
      onFood: this.onFood.bind(this),
      onBehaviorChange: this.onBehaviorChange.bind(this),
      onMobileSpawn: this.onMobileSpawn.bind(this),
      onMobileFood: this.onMobileFood.bind(this),
      onMobilePause: this.onMobilePause.bind(this),
      onMobileSpeed: this.onMobileSpeed.bind(this),
      onGodHeal: this.onGodHeal.bind(this),
      onGodBoost: this.onGodBoost.bind(this),
      onGodKill: this.onGodKill.bind(this),
      onGodClone: this.onGodClone.bind(this),
      onFeaturesToggle: this.onFeaturesToggle.bind(this),
      onScenarioToggle: this.onScenarioToggle.bind(this),
      onGeneEditorToggle: this.onGeneEditorToggle.bind(this),
      onEcoHealthToggle: this.onEcoHealthToggle.bind(this),
      onAnalyticsToggle: this.onAnalyticsToggle.bind(this),
      onDebugToggle: this.onDebugToggle.bind(this),
      onPerformanceToggle: this.onPerformanceToggle.bind(this),
      onModeChange: this.onModeChange.bind(this),
      onModeCycle: this.onModeCycle.bind(this),
      onRefreshGoals: this.onRefreshGoals.bind(this)
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

    // Listen for achievement unlocks
    eventSystem.on(GameEvents.ACHIEVEMENT_UNLOCKED, (data) => {
      if (this.hasNotifications()) {
        this.notifications.show(`🏆 ${data.name}`, 'achievement', 3000);
      }
      if (this.audio) {
        this.audio.playSound('achievement');
      }
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
      this.updateMobileControls();
    });
    
    eventSystem.on('game:resumed', () => {
      this.updatePauseButton();
      this.updateMobileControls();
    });
  }

  /**
   * Initialize UI event bindings
   */
  initialize() {
    this.bindCoreControls();
    this.bindMobileControls();
    this.bindGodModeControls();
    this.bindPanelControls();
    this.bindBehaviorControls();
    this.bindEnhancedControls();
    this.bindGameplayModeControls();
    this.bindSessionGoalControls();
  }

  /**
   * Check if notifications subsystem is available
   */
  hasNotifications() {
    return isNotificationSystem(this.notifications);
  }

  /**
   * Bind core game controls
   */
  bindCoreControls() {
    // Pause/Step buttons
    const pauseBtn = domCache.get('pauseBtn');
    const stepBtn = domCache.get('stepBtn');

    if (pauseBtn) pauseBtn.addEventListener('click', this.boundHandlers.onPause);
    if (stepBtn) stepBtn.addEventListener('click', this.boundHandlers.onStep);

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
      console.log('🌿 Spawn food button bound');
    }
    
    // Spawn creature button and dropdown
    this.bindSpawnCreatureControls();
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
        creatureDropdown.classList.toggle('hidden');
      });
      
      // Handle dropdown item clicks
      const dropdownItems = creatureDropdown.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const creatureType = item.dataset.creature;
          this.onSpawnCreature(creatureType);
          creatureDropdown.classList.add('hidden');
        });
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        creatureDropdown.classList.add('hidden');
      });
      
      console.log('🦌 Spawn creature controls bound');
    }
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

  onModeChange() {
    const select = domCache.get('modeSelect');
    if (!select || !this.gameplayModes) return;
    const value = select.value;
    this.gameplayModes.applyMode(value);
    this.renderGameMode();
  }

  onModeCycle() {
    if (!this.gameplayModes) return;
    this.gameplayModes.cycleMode(1);
    const select = domCache.get('modeSelect');
    if (select) {
      select.value = this.gameplayModes.getActiveMode()?.id;
    }
    this.renderGameMode();
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
    const x = this.world.width / 2 + (Math.random() - 0.5) * 200;
    const y = this.world.height / 2 + (Math.random() - 0.5) * 200;
    
    let genes = {};
    switch (type) {
      case 'predator':
        genes = { diet: 1.0, aggression: 1.5, speed: 1.3, isPredator: 1 };
        break;
      case 'omnivore':
        genes = { diet: 0.5, aggression: 0.8, speed: 1.0, isPredator: 0 };
        break;
      case 'herbivore':
      default:
        genes = { diet: 0.0, aggression: 0.3, speed: 1.0, isPredator: 0 };
        break;
    }
    
    this.world.addCreature(x, y, genes);
    if (this.hasNotifications()) {
      this.notifications.show(`Spawned ${type}!`, 'info', 1500);
    }
    console.log(`🦌 Spawned ${type} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }

  /**
   * Bind mobile quick action controls
   */
  bindMobileControls() {
    const mobileSpawnBtn = domCache.get('mobileSpawnBtn');
    const mobileFoodBtn = domCache.get('mobileFoodBtn');
    const mobilePauseBtn = domCache.get('mobilePauseBtn');
    const mobileSpeedBtn = domCache.get('mobileSpeedBtn');

    if (mobileSpawnBtn) mobileSpawnBtn.addEventListener('click', this.boundHandlers.onMobileSpawn);
    if (mobileFoodBtn) mobileFoodBtn.addEventListener('click', this.boundHandlers.onMobileFood);
    if (mobilePauseBtn) mobilePauseBtn.addEventListener('click', this.boundHandlers.onMobilePause);
    if (mobileSpeedBtn) mobileSpeedBtn.addEventListener('click', this.boundHandlers.onMobileSpeed);
  }

  /**
   * Bind god mode controls
   */
  bindGodModeControls() {
    const godHealBtn = domCache.get('godHealBtn');
    const godBoostBtn = domCache.get('godBoostBtn');
    const godKillBtn = domCache.get('godKillBtn');
    const godCloneBtn = domCache.get('godCloneBtn');

    if (godHealBtn) godHealBtn.addEventListener('click', this.boundHandlers.onGodHeal);
    if (godBoostBtn) godBoostBtn.addEventListener('click', this.boundHandlers.onGodBoost);
    if (godKillBtn) godKillBtn.addEventListener('click', this.boundHandlers.onGodKill);
    if (godCloneBtn) godCloneBtn.addEventListener('click', this.boundHandlers.onGodClone);
  }

  /**
   * Bind panel toggle controls
   */
  bindPanelControls() {
    const featuresBtn = domCache.get('featuresBtn');
    const featuresCloseBtn = domCache.get('featuresCloseBtn');
    const scenarioBtn = domCache.get('scenarioBtn');
    const scenarioCloseBtn = domCache.get('scenarioCloseBtn');
    const geneEditorBtn = domCache.get('geneEditorBtn');
    const geneEditorCloseBtn = domCache.get('geneEditorCloseBtn');
    const ecoHealthBtn = domCache.get('ecoHealthBtn');
    const ecoHealthCloseBtn = domCache.get('ecoHealthCloseBtn');

    if (featuresBtn) featuresBtn.addEventListener('click', this.boundHandlers.onFeaturesToggle);
    if (featuresCloseBtn) featuresCloseBtn.addEventListener('click', this.boundHandlers.onFeaturesToggle);

    if (scenarioBtn) scenarioBtn.addEventListener('click', this.boundHandlers.onScenarioToggle);
    if (scenarioCloseBtn) scenarioCloseBtn.addEventListener('click', this.boundHandlers.onScenarioToggle);

    if (geneEditorBtn) geneEditorBtn.addEventListener('click', this.boundHandlers.onGeneEditorToggle);
    if (geneEditorCloseBtn) geneEditorCloseBtn.addEventListener('click', this.boundHandlers.onGeneEditorToggle);

    if (ecoHealthBtn) ecoHealthBtn.addEventListener('click', this.boundHandlers.onEcoHealthToggle);
    if (ecoHealthCloseBtn) ecoHealthCloseBtn.addEventListener('click', this.boundHandlers.onEcoHealthToggle);
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

    if (analyticsToggle) analyticsToggle.addEventListener('click', this.boundHandlers.onAnalyticsToggle);
    if (debugToggle) debugToggle.addEventListener('click', this.boundHandlers.onDebugToggle);
    if (performanceToggle) performanceToggle.addEventListener('click', this.boundHandlers.onPerformanceToggle);
  }

  /**
   * Update pause button state
   */
  updatePauseButton() {
    const pauseBtn = domCache.get('pauseBtn');
    if (pauseBtn) {
      if (gameState.paused) {
        pauseBtn.textContent = '▶️ Play';
        pauseBtn.classList.add('active');
      } else {
        pauseBtn.textContent = '⏸️ Pause';
        pauseBtn.classList.remove('active');
      }
    }
  }

  /**
   * Update mobile controls
   */
  updateMobileControls() {
    const mobilePauseBtn = domCache.get('mobilePauseBtn');
    const mobileSpeedBtn = domCache.get('mobileSpeedBtn');

    if (mobilePauseBtn) {
      mobilePauseBtn.classList.toggle('active', gameState.paused);
      mobilePauseBtn.textContent = gameState.paused ? '▶️' : '⏸️';
    }

    if (mobileSpeedBtn) {
      const speedInfo = gameState.getMobileSpeedInfo();
      mobileSpeedBtn.textContent = speedInfo.emoji;
    }
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
    gameState.togglePause();
    this.updatePauseButton();
    this.updateMobileControls();
  }

  onStep() {
    gameState.paused = true;
    this.updatePauseButton();
    this.updateMobileControls();
    // Single step handled by game loop's step mode
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

  onMobileSpawn() {
    // Spawn a random creature at center of view
    const centerX = this.camera.targetX;
    const centerY = this.camera.targetY;

    import('./genetics.js').then(({ makeGenes }) => {
      import('./creature.js').then(({ Creature }) => {
        const genes = makeGenes();
        const creature = new Creature(centerX, centerY, genes);
        this.world.addCreature(creature, null);
      });
    });
  }

  onMobileFood() {
    // Spawn food at center of view
    const centerX = this.camera.targetX;
    const centerY = this.camera.targetY;

    for (let i = 0; i < 20; i++) {
      const offsetX = (Math.random() - 0.5) * 200;
      const offsetY = (Math.random() - 0.5) * 200;
      this.world.addFood(centerX + offsetX, centerY + offsetY);
    }
  }

  onMobilePause() {
    this.onPause();
  }

  onMobileSpeed() {
    gameState.cycleMobileSpeed();
    this.updateMobileControls();
  }

  onGodHeal() {
    this.performGodAction('heal');
  }

  onGodBoost() {
    this.performGodAction('boost');
  }

  onGodKill() {
    this.performGodAction('kill');
  }

  onGodClone() {
    this.performGodAction('clone');
  }

  onFeaturesToggle() {
    const featuresPanel = domCache.get('featuresPanel');
    if (featuresPanel) {
      gameState.featuresPanelVisible = !gameState.featuresPanelVisible;
      if (gameState.featuresPanelVisible) {
        featuresPanel.classList.remove('hidden');
      } else {
        featuresPanel.classList.add('hidden');
      }
    }
  }

  onScenarioToggle() {
    const scenarioPanel = domCache.get('scenarioPanel');
    if (scenarioPanel) {
      gameState.scenarioPanelVisible = !gameState.scenarioPanelVisible;
      if (gameState.scenarioPanelVisible) {
        scenarioPanel.classList.remove('hidden');
      } else {
        scenarioPanel.classList.add('hidden');
      }
    }
  }

  onGeneEditorToggle() {
    const panel = document.getElementById('gene-editor-panel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  }

  onEcoHealthToggle() {
    const panel = document.getElementById('eco-health-panel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  }

  /**
   * Perform god mode action on selected creature
   */
  performGodAction(action) {
    const creature = gameState.selectedId ? this.world.getAnyCreatureById(gameState.selectedId) : null;

    if (!creature || !creature.alive) {
      return;
    }

    try {
      switch (action) {
        case 'heal':
          creature.health = creature.maxHealth;
          creature.logEvent('Healed by divine intervention', this.world.t);
          break;

        case 'boost':
          creature.energy += 30;
          creature.logEvent('Received energy boost', this.world.t);
          break;

        case 'kill':
          creature.alive = false;
          creature.health = 0;
          creature.logEvent('Struck down by god', this.world.t);
          gameState.selectedId = null;
          break;

        case 'clone':
          // Clone handled by world.cloneCreature()
          if (this.world.cloneCreature) {
            this.world.cloneCreature(creature);
          }
          break;
      }

      window.godModeActionCount = (window.godModeActionCount || 0) + 1;

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
    }
  }
}
