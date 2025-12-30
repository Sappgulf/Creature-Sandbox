/**
 * DOM Cache - Centralized DOM element caching for performance
 * Eliminates repeated DOM queries in hot paths
 */
export class DOMCache {
  constructor() {
    this.elements = new Map();
    this.initialized = false;
  }

  /**
   * Initialize DOM cache with all commonly accessed elements
   */
  initialize() {
    if (this.initialized) return;

    // Core canvas and UI elements
    this.cacheElement('view', 'canvas');
    this.cacheElement('stats', 'stats');
    this.cacheElement('selected-info', 'selectedInfo');
    this.cacheElement('hud-bottom-left', 'hudBottom');

    // Inspector elements
    this.cacheElement('inspector', 'inspector');
    this.cacheElement('btn-show-inspector', 'showInspectorBtn');
    this.cacheElement('btn-close-inspector', 'closeInspectorBtn');

    // UI controls
    this.cacheElement('btn-pause', 'pauseBtn');
    this.cacheElement('btn-step', 'stepBtn');
    this.cacheElement('btn-export', 'exportBtn');
    this.cacheElement('btn-export-csv', 'exportCSVBtn');
    this.cacheElement('btn-export-genes', 'exportGenesBtn');

    // Behavior sliders
    this.cacheElement('slider-forage', 'forageSlider');
    this.cacheElement('slider-wander', 'wanderSlider');
    this.cacheElement('slider-rest', 'restSlider');

    // Spawn controls
    this.cacheElement('btn-spawn-food', 'spawnFoodBtn');
    this.cacheElement('btn-spawn-creature', 'spawnCreatureBtn');
    this.cacheElement('creature-dropdown', 'creatureDropdown');

    // God mode buttons (quick actions)
    this.cacheElement('btn-god-heal', 'godHealBtn');
    this.cacheElement('btn-god-boost', 'godBoostBtn');
    this.cacheElement('btn-god-kill', 'godKillBtn');
    this.cacheElement('btn-god-clone', 'godCloneBtn');

    // Mobile controls
    this.cacheElement('mobile-btn-spawn', 'mobileSpawnBtn');
    this.cacheElement('mobile-btn-food', 'mobileFoodBtn');
    this.cacheElement('mobile-btn-pause', 'mobilePauseBtn');
    this.cacheElement('mobile-btn-speed', 'mobileSpeedBtn');

    // Feature panel
    this.cacheElement('btn-features', 'featuresBtn');
    this.cacheElement('features-panel', 'featuresPanel');
    this.cacheElement('btn-features-close', 'featuresCloseBtn');

    // Scenario panel
    this.cacheElement('btn-scenario', 'scenarioBtn');
    this.cacheElement('scenario-panel', 'scenarioPanel');
    this.cacheElement('btn-scenario-close', 'scenarioCloseBtn');

    // Achievements panel
    this.cacheElement('btn-achievements', 'achievementsBtn');
    this.cacheElement('achievements-panel', 'achievementsPanel');
    this.cacheElement('btn-achievements-close', 'achievementsCloseBtn');

    // Gene editor
    this.cacheElement('btn-gene-editor', 'geneEditorBtn');
    this.cacheElement('btn-gene-editor-close', 'geneEditorCloseBtn');

    // Ecosystem health
    this.cacheElement('btn-eco-health', 'ecoHealthBtn');
    this.cacheElement('btn-eco-health-close', 'ecoHealthCloseBtn');

    // Enhanced systems toggles
    this.cacheElement('analytics-dashboard-toggle', 'analyticsDashboardToggle');
    this.cacheElement('debug-console-toggle', 'debugConsoleToggle');
    this.cacheElement('performance-monitor-toggle', 'performanceMonitorToggle');

    // Gameplay modes + goals
    this.cacheElement('mode-select', 'modeSelect');
    this.cacheElement('mode-apply', 'modeApplyBtn');
    this.cacheElement('mode-cycle', 'modeCycleBtn');
    this.cacheElement('mode-name', 'modeName');
    this.cacheElement('mode-description', 'modeDescription');
    this.cacheElement('mode-tags', 'modeTags');
    this.cacheElement('session-goals-card', 'goalCard');
    this.cacheElement('session-goal-list', 'goalList');
    this.cacheElement('refresh-goals', 'refreshGoalsBtn');

    // Home page elements
    this.cacheElement('home-page', 'homePage');
    this.cacheElement('home-bg', 'homeBg');
    this.cacheElement('btn-continue', 'continueBtn');
    this.cacheElement('btn-new-game', 'newGameBtn');
    this.cacheElement('btn-campaign', 'campaignBtn');
    this.cacheElement('continue-hint', 'continueHint');

    // Performance metrics (handled by performance profiler overlay)

    this.initialized = true;
  }

  /**
   * Cache a DOM element by ID
   */
  cacheElement(id, key) {
    try {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(key, element);
      } else {
        console.warn(`⚠️ DOM element not found: ${id}`);
        this.elements.set(key, null);
      }
    } catch (error) {
      console.error(`❌ Error caching DOM element ${id}:`, error);
      this.elements.set(key, null);
    }
  }

  /**
   * Get a cached DOM element
   */
  get(key) {
    if (!this.initialized) {
      this.initialize();
    }
    return this.elements.get(key) || null;
  }

  /**
   * Get multiple cached elements as an object
   */
  getMultiple(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Add a new element to cache dynamically
   */
  add(key, element) {
    this.elements.set(key, element);
  }

  /**
   * Remove an element from cache
   */
  remove(key) {
    this.elements.delete(key);
  }

  /**
   * Clear all cached elements
   */
  clear() {
    this.elements.clear();
    this.initialized = false;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalElements: this.elements.size,
      initialized: this.initialized,
      nullElements: Array.from(this.elements.values()).filter(el => el === null).length
    };
  }
}

// Global DOM cache instance
export const domCache = new DOMCache();
