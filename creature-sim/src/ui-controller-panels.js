import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { loadEnhancedAnalyticsModule } from './enhanced-analytics-loader.js';
import { touchOnboarding } from './touch-onboarding.js';

export function applyUiPanelMethods(UIController) {
  UIController.prototype.setPanelVisibility = function (panel, visible) {
    if (!panel) return false;
    const isVisible = !!visible;
    if (!isVisible) {
      this.blurFocusedDescendant(panel);
    }
    panel.classList.toggle('hidden', !isVisible);
    panel.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const anyPanelOpen = document.querySelector('.panel:not(.hidden)');
      document.body.classList.toggle('panel-open', !!anyPanelOpen);
    } else {
      document.body.classList.remove('panel-open');
    }
    if (isVisible) {
      requestAnimationFrame(() => {
        const firstFocusable = panel.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) firstFocusable.focus();
      });
    }
    return isVisible;
  };

  UIController.prototype.closeMajorPanels = function (exceptPanelId = null) {
    const panelIds = [
      'features-panel',
      'sound-panel',
      'upgrade-panel',
      'scenario-panel',
      'achievements-panel',
      'gene-editor-panel',
      'eco-health-panel'
    ];

    for (const panelId of panelIds) {
      if (panelId === exceptPanelId) continue;
      const panel = document.getElementById(panelId);
      if (!panel) continue;
      this.setPanelVisibility(panel, false);
    }

    if (exceptPanelId !== 'features-panel') {
      gameState.featuresPanelVisible = false;
    }
    if (exceptPanelId !== 'scenario-panel') {
      gameState.scenarioPanelVisible = false;
    }
  };

  UIController.prototype.togglePanelVisibility = function (panel) {
    if (!panel) return false;
    const nextVisible = panel.classList.contains('hidden');
    return this.setPanelVisibility(panel, nextVisible);
  };

  UIController.prototype.bindPanelControls = function () {
    const featuresCloseBtn = domCache.get('featuresCloseBtn') || document.getElementById('btn-features-close');
    const soundCloseBtn = document.getElementById('btn-sound-close');
    const scenarioCloseBtn = domCache.get('scenarioCloseBtn') || document.getElementById('btn-scenario-close');
    const achievementsCloseBtn =
      domCache.get('achievementsCloseBtn') || document.getElementById('btn-achievements-close');
    const geneEditorCloseBtn = domCache.get('geneEditorCloseBtn') || document.getElementById('btn-gene-editor-close');
    const ecoHealthCloseBtn = domCache.get('ecoHealthCloseBtn') || document.getElementById('btn-eco-health-close');
    const shortcutsCloseBtn = document.getElementById('btn-shortcuts-close');

    if (featuresCloseBtn) featuresCloseBtn.addEventListener('click', this.boundHandlers.onFeaturesToggle);

    if (soundCloseBtn) soundCloseBtn.addEventListener('click', this.boundHandlers.onSoundToggle);

    if (scenarioCloseBtn) scenarioCloseBtn.addEventListener('click', this.boundHandlers.onScenarioToggle);

    if (achievementsCloseBtn) achievementsCloseBtn.addEventListener('click', this.boundHandlers.onAchievementsToggle);

    if (shortcutsCloseBtn) {
      shortcutsCloseBtn.addEventListener('click', () => this.toggleShortcutsHelp());
    }

    if (geneEditorCloseBtn) geneEditorCloseBtn.addEventListener('click', this.boundHandlers.onGeneEditorToggle);

    if (ecoHealthCloseBtn) ecoHealthCloseBtn.addEventListener('click', this.boundHandlers.onEcoHealthToggle);
  };

  UIController.prototype.bindScenarioControls = function () {
    if (this._scenarioControlsBound) return;

    const panel = domCache.get('scenarioPanel') || document.getElementById('scenario-panel');
    const typeSelect = domCache.get('scenarioType') || document.getElementById('scenario-type');
    const durationSlider = domCache.get('scenarioDuration') || document.getElementById('scenario-duration');
    const intensitySlider = domCache.get('scenarioIntensity') || document.getElementById('scenario-intensity');
    const delaySlider = domCache.get('scenarioDelay') || document.getElementById('scenario-delay');
    const cooldownToggle = domCache.get('scenarioCooldown') || document.getElementById('scenario-cooldown');
    const autoBalanceToggle = domCache.get('scenarioAutoBalance') || document.getElementById('scenario-autobalance');
    const triggerButton = domCache.get('scenarioTriggerBtn') || document.getElementById('btn-scenario-trigger');
    const queueButton = domCache.get('scenarioQueueBtn') || document.getElementById('btn-scenario-queue');
    const endButton = domCache.get('scenarioEndBtn') || document.getElementById('btn-scenario-end');
    const clearButton = domCache.get('scenarioClearBtn') || document.getElementById('btn-scenario-clear');
    const queue = domCache.get('scenarioQueue') || document.getElementById('scenario-queue');

    if (
      !panel ||
      !typeSelect ||
      !durationSlider ||
      !intensitySlider ||
      !delaySlider ||
      !triggerButton ||
      !queueButton
    ) {
      return;
    }

    const durationValue = document.getElementById('scenario-duration-value');
    const intensityValue = document.getElementById('scenario-intensity-value');
    const delayValue = document.getElementById('scenario-delay-value');

    const syncLabels = () => {
      if (durationValue) durationValue.textContent = `${durationSlider.value}s`;
      if (intensityValue) intensityValue.textContent = `${Number(intensitySlider.value).toFixed(1)}×`;
      if (delayValue) delayValue.textContent = `${delaySlider.value}s`;
    };

    const syncAutoBalance = () => {
      if (autoBalanceToggle && this.world.autoBalanceSettings) {
        autoBalanceToggle.checked = this.world.autoBalanceSettings.enabled !== false;
      }
    };

    const readNumber = (input, fallback) => {
      const value = Number(input?.value);
      return Number.isFinite(value) ? value : fallback;
    };

    const readOptions = queueMode => ({
      duration: readNumber(durationSlider, 30),
      intensity: readNumber(intensitySlider, 1),
      delay: readNumber(delaySlider, 0),
      manual: true,
      queue: queueMode,
      waitForClear: true,
      applyCooldown: cooldownToggle?.checked !== false
    });

    const setAutoBalance = () => {
      if (autoBalanceToggle && this.world.autoBalanceSettings) {
        this.world.autoBalanceSettings.enabled = autoBalanceToggle.checked;
      }
    };

    const announce = (message, type = 'info') => {
      this.notifications?.show?.(message, type, 2200);
    };

    const startScenario = queueMode => {
      try {
        setAutoBalance();
        const type = typeSelect.value;
        const result = this.world.triggerDisaster?.(type, readOptions(queueMode));
        if (result === false) {
          throw new Error(`Unable to start disaster: ${type}`);
        }
        const label = typeSelect.options[typeSelect.selectedIndex]?.textContent?.trim() || type;
        announce(queueMode ? `🗓️ ${label} queued` : `🌪️ ${label} started`, 'success');
      } catch (error) {
        console.error('Scenario action failed:', error);
        announce('Scenario action failed. Try again.', 'error');
      }
    };

    durationSlider.addEventListener('input', syncLabels);
    intensitySlider.addEventListener('input', syncLabels);
    delaySlider.addEventListener('input', syncLabels);
    triggerButton.addEventListener('click', () => startScenario(false));
    queueButton.addEventListener('click', () => startScenario(true));

    endButton?.addEventListener('click', () => {
      const active = this.world.getActiveDisaster?.();
      if (!active) {
        announce('No active disaster to end.', 'info');
        return;
      }
      this.world.cancelDisaster?.();
      announce(`✅ ${active.name || 'Disaster'} ended`, 'success');
    });

    clearButton?.addEventListener('click', () => {
      const pending = this.world.getPendingDisasters?.() || [];
      if (!pending.length) {
        announce('No queued disasters to clear.', 'info');
        return;
      }
      this.world.clearPendingDisasters?.();
      announce('🧹 Queued disasters cleared', 'success');
    });

    queue?.addEventListener('click', event => {
      const removeButton = event.target.closest?.('.scenario-queue-remove');
      if (!removeButton) return;
      const rawId = removeButton.dataset.queueId;
      const numericId = Number(rawId);
      this.world.cancelPendingDisaster?.(Number.isFinite(numericId) ? numericId : rawId);
      announce('🗑️ Queued disaster removed', 'success');
    });

    this._scenarioControlsBound = true;
    this.syncScenarioControls = () => {
      syncLabels();
      syncAutoBalance();
    };
    this.syncScenarioControls();
  };

  UIController.prototype.toggleShortcutsHelp = function (forceVisible = null) {
    const overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) return;
    const shouldShow = forceVisible === null ? overlay.classList.contains('hidden') : !!forceVisible;
    if (!shouldShow) {
      this.blurFocusedDescendant(overlay);
    }
    overlay.classList.toggle('hidden', !shouldShow);
    overlay.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    if (shouldShow) {
      requestAnimationFrame(() => {
        const firstFocusable = overlay.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) firstFocusable.focus();
      });
    }
  };

  UIController.prototype.bindFeaturesEnhancements = function () {
    const panel = document.getElementById('features-panel');
    if (!panel) return;

    const searchInput = document.getElementById('features-search');
    const results = document.getElementById('features-results-count');
    const enableVisualsBtn = document.getElementById('btn-features-enable-visuals');
    const disableOverlaysBtn = document.getElementById('btn-features-disable-overlays');
    const resetBtn = document.getElementById('btn-features-reset');

    const applySearchFilter = () => {
      const query = (searchInput?.value || '').trim().toLowerCase();
      const allRows = [...panel.querySelectorAll('.feature-toggle')];
      let visibleCount = 0;

      allRows.forEach(row => {
        const matches = !query || row.textContent.toLowerCase().includes(query);
        row.classList.toggle('feature-hidden', !matches);
        if (matches) visibleCount += 1;
      });

      const sections = [...panel.querySelectorAll('.features-section')];
      sections.forEach(section => {
        const hasVisible = section.querySelector('.feature-toggle:not(.feature-hidden)');
        section.classList.toggle('section-hidden', !hasVisible);
      });

      if (results) {
        results.textContent = query
          ? `Showing ${visibleCount} matching controls`
          : `Showing all controls (${allRows.length})`;
      }
    };

    const setControls = (ids, checked) => {
      ids.forEach(id => {
        const input = document.getElementById(id);
        if (!input || input.checked === checked) return;
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    if (searchInput && !searchInput._boundFeaturesSearch) {
      searchInput.addEventListener('input', applySearchFilter);
      searchInput._boundFeaturesSearch = true;
      applySearchFilter();
    }

    if (enableVisualsBtn && !enableVisualsBtn._boundFeaturesAction) {
      enableVisualsBtn.addEventListener('click', () => {
        setControls(
          [
            'toggle-vision',
            'toggle-clustering',
            'toggle-territories',
            'toggle-memory',
            'toggle-social',
            'toggle-nameplates',
            'toggle-migration',
            'toggle-nests',
            'toggle-emotions',
            'toggle-sensory',
            'toggle-intelligence',
            'toggle-mating',
            'toggle-minigraphs'
          ],
          true
        );
      });
      enableVisualsBtn._boundFeaturesAction = true;
    }

    if (disableOverlaysBtn && !disableOverlaysBtn._boundFeaturesAction) {
      disableOverlaysBtn.addEventListener('click', () => {
        setControls(
          [
            'toggle-vision',
            'toggle-clustering',
            'toggle-territories',
            'toggle-memory',
            'toggle-social',
            'toggle-migration',
            'toggle-nests',
            'toggle-emotions',
            'toggle-sensory',
            'toggle-intelligence',
            'toggle-mating',
            'toggle-minigraphs'
          ],
          false
        );
        const offRadio = document.getElementById('toggle-heatmap-off');
        if (offRadio && !offRadio.checked) {
          offRadio.checked = true;
          offRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      disableOverlaysBtn._boundFeaturesAction = true;
    }

    if (resetBtn && !resetBtn._boundFeaturesAction) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          applySearchFilter();
        }
        const chaosSlider = document.getElementById('chaos-slider');
        if (chaosSlider) {
          chaosSlider.value = '50';
        }
        chaosSlider?.dispatchEvent(new Event('input', { bubbles: true }));
      });
      resetBtn._boundFeaturesAction = true;
    }
  };

  UIController.prototype.onFeaturesToggle = function () {
    const featuresPanel = domCache.get('featuresPanel') || document.getElementById('features-panel');
    if (featuresPanel) {
      const willShow = featuresPanel.classList.contains('hidden');
      if (willShow) {
        this.closeMajorPanels('features-panel');
      }
      gameState.featuresPanelVisible = willShow;
      this.setPanelVisibility(featuresPanel, gameState.featuresPanelVisible);
    }
    this.dismissInteractionHint();
  };

  UIController.prototype.onSoundToggle = function () {
    const soundPanel = document.getElementById('sound-panel');
    if (soundPanel) {
      const willShow = soundPanel.classList.contains('hidden');
      if (willShow) {
        this.closeMajorPanels('sound-panel');
      }
      this.setPanelVisibility(soundPanel, willShow);
    }
    this.dismissInteractionHint();
  };

  UIController.prototype.onScenarioToggle = function () {
    const scenarioPanel = domCache.get('scenarioPanel') || document.getElementById('scenario-panel');
    if (scenarioPanel) {
      const willShow = scenarioPanel.classList.contains('hidden');
      if (willShow) {
        this.closeMajorPanels('scenario-panel');
        this.syncScenarioControls?.();
      }
      gameState.scenarioPanelVisible = willShow;
      this.setPanelVisibility(scenarioPanel, gameState.scenarioPanelVisible);
    }
    this.updateSandboxUiVisibility();
    this.dismissInteractionHint();
  };

  UIController.prototype.onGeneEditorToggle = async function () {
    const panel = domCache.get('geneEditorPanel') || document.getElementById('gene-editor-panel');
    const shouldShow = panel?.classList.contains('hidden') ?? false;
    let editor = null;
    if (shouldShow) {
      this.closeMajorPanels('gene-editor-panel');
      try {
        editor = await this.geneEditor?.ensure?.();
      } catch (error) {
        console.error('Gene editor failed to load:', error);
        this.notifications?.show?.('Gene editor failed to load', 'error', 3000);
      }
    } else {
      editor = await this.geneEditor?.ensure?.().catch(() => null);
    }

    if (editor) {
      if (shouldShow) editor.show?.();
      else editor.hide?.();
    } else if (panel) {
      this.togglePanelVisibility(panel);
    }

    if (panel) {
      panel.setAttribute('aria-hidden', panel.classList.contains('hidden') ? 'true' : 'false');
    }
    this.updateSandboxUiVisibility();
    this.dismissInteractionHint();
  };

  UIController.prototype.onEcoHealthToggle = function () {
    const panel = document.getElementById('eco-health-panel');
    if (panel) {
      if (panel.classList.contains('hidden')) {
        this.closeMajorPanels('eco-health-panel');
      }
      this.togglePanelVisibility(panel);
    }
    this.dismissInteractionHint();
  };

  UIController.prototype.onAnalyticsToggle = async function () {
    const { analyticsDashboard } = await loadEnhancedAnalyticsModule();
    analyticsDashboard.toggle();
  };

  UIController.prototype.onDebugToggle = function () {
    if (this.debugConsole) {
      this.debugConsole.toggle();
    }
  };

  UIController.prototype.onPerformanceToggle = function () {
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
  };

  UIController.prototype.onReplayTutorial = function () {
    // Two separate onboarding surfaces exist: the eight-step tutorial that
    // every player sees, and the touch gesture card that only appears on a
    // touch device. This replayed the touch card alone and returned early when
    // there was none, so on a mouse the button did nothing at all — and the
    // step tutorial, whose steps auto-advance and persist as completed, could
    // never be replayed once it had run.
    let replayed = false;

    if (this.tutorial?.restart) {
      replayed = this.tutorial.restart() !== false;
    }

    if (touchOnboarding) {
      touchOnboarding.reset();
      touchOnboarding.show({ force: true });
      replayed = true;
    }

    if (replayed) {
      this.notifications?.show?.('🎓 Replaying tutorial…', 'info', 1600);
    }
  };
}
