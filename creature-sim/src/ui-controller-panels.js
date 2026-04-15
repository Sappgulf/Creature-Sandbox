import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { loadEnhancedAnalyticsModule } from './enhanced-analytics-loader.js';

export function applyUiPanelMethods(UIController) {
  UIController.prototype.setPanelVisibility = function(panel, visible) {
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
    return isVisible;
  };

  UIController.prototype.closeMajorPanels = function(exceptPanelId = null) {
    const panelIds = [
      'features-panel',
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

  UIController.prototype.togglePanelVisibility = function(panel) {
    if (!panel) return false;
    const nextVisible = panel.classList.contains('hidden');
    return this.setPanelVisibility(panel, nextVisible);
  };

  UIController.prototype.bindPanelControls = function() {
    const featuresCloseBtn = domCache.get('featuresCloseBtn') || document.getElementById('btn-features-close');
    const scenarioCloseBtn = domCache.get('scenarioCloseBtn') || document.getElementById('btn-scenario-close');
    const achievementsCloseBtn = domCache.get('achievementsCloseBtn') || document.getElementById('btn-achievements-close');
    const geneEditorCloseBtn = domCache.get('geneEditorCloseBtn') || document.getElementById('btn-gene-editor-close');
    const ecoHealthCloseBtn = domCache.get('ecoHealthCloseBtn') || document.getElementById('btn-eco-health-close');
    const shortcutsCloseBtn = document.getElementById('btn-shortcuts-close');

    if (featuresCloseBtn) featuresCloseBtn.addEventListener('click', this.boundHandlers.onFeaturesToggle);

    if (scenarioCloseBtn) scenarioCloseBtn.addEventListener('click', this.boundHandlers.onScenarioToggle);

    if (achievementsCloseBtn) achievementsCloseBtn.addEventListener('click', this.boundHandlers.onAchievementsToggle);

    if (shortcutsCloseBtn) {
      shortcutsCloseBtn.addEventListener('click', () => this.toggleShortcutsHelp());
    }

    if (geneEditorCloseBtn) geneEditorCloseBtn.addEventListener('click', this.boundHandlers.onGeneEditorToggle);

    if (ecoHealthCloseBtn) ecoHealthCloseBtn.addEventListener('click', this.boundHandlers.onEcoHealthToggle);
  };

  UIController.prototype.toggleShortcutsHelp = function(forceVisible = null) {
    const overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) return;
    const shouldShow = forceVisible === null
      ? overlay.classList.contains('hidden')
      : !!forceVisible;
    overlay.classList.toggle('hidden', !shouldShow);
    overlay.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  };

  UIController.prototype.bindFeaturesEnhancements = function() {
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

      allRows.forEach((row) => {
        const matches = !query || row.textContent.toLowerCase().includes(query);
        row.classList.toggle('feature-hidden', !matches);
        if (matches) visibleCount += 1;
      });

      const sections = [...panel.querySelectorAll('.features-section')];
      sections.forEach((section) => {
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
      ids.forEach((id) => {
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
        setControls([
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
        ], true);
      });
      enableVisualsBtn._boundFeaturesAction = true;
    }

    if (disableOverlaysBtn && !disableOverlaysBtn._boundFeaturesAction) {
      disableOverlaysBtn.addEventListener('click', () => {
        setControls([
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
        ], false);
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

  UIController.prototype.onFeaturesToggle = function() {
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

  UIController.prototype.onScenarioToggle = function() {
    const scenarioPanel = domCache.get('scenarioPanel') || document.getElementById('scenario-panel');
    if (scenarioPanel) {
      const willShow = scenarioPanel.classList.contains('hidden');
      if (willShow) {
        this.closeMajorPanels('scenario-panel');
      }
      gameState.scenarioPanelVisible = willShow;
      this.setPanelVisibility(scenarioPanel, gameState.scenarioPanelVisible);
    }
    this.updateSandboxUiVisibility();
    this.dismissInteractionHint();
  };

  UIController.prototype.onGeneEditorToggle = function() {
    const panel = domCache.get('geneEditorPanel') || document.getElementById('gene-editor-panel');
    if (panel) {
      if (panel.classList.contains('hidden')) {
        this.closeMajorPanels('gene-editor-panel');
      }
      this.togglePanelVisibility(panel);
    }
    this.updateSandboxUiVisibility();
    this.dismissInteractionHint();
  };

  UIController.prototype.onEcoHealthToggle = function() {
    const panel = document.getElementById('eco-health-panel');
    if (panel) {
      if (panel.classList.contains('hidden')) {
        this.closeMajorPanels('eco-health-panel');
      }
      this.togglePanelVisibility(panel);
    }
    this.dismissInteractionHint();
  };

  UIController.prototype.onAnalyticsToggle = async function() {
    const { analyticsDashboard } = await loadEnhancedAnalyticsModule();
    analyticsDashboard.toggle();
  };

  UIController.prototype.onDebugToggle = function() {
    if (this.debugConsole) {
      this.debugConsole.toggle();
    }
  };

  UIController.prototype.onPerformanceToggle = function() {
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
}
