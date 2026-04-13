/**
 * DOM Cache - Centralized DOM element caching for performance
 * Eliminates repeated DOM queries in hot paths
 */
export class DOMCache {
  constructor() {
    this.elements = new Map();
    this.keyToIds = new Map();
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
    this.cacheElement('watch-strip', 'watchStrip');
    this.cacheElement('watch-pause', 'watchPauseBtn');
    this.cacheElement('watch-speed', 'watchSpeedBtn');
    this.cacheElement('watch-follow', 'watchFollowBtn');
    this.cacheElement('watch-moments', 'watchMomentsBtn');
    this.cacheElement('watch-god-mode', 'watchGodModeBtn');
    this.cacheElement('watch-recenter', 'watchRecenterBtn');

    this.cacheElement('moments-close', 'momentsClose');
    this.cacheElement('moments-panel', 'momentsPanel');
    this.cacheElement('moments-list', 'momentsList');
    this.cacheElement('moments-summary', 'momentsSummary');

    // Inspector elements
    this.cacheElement('inspector', 'inspector');
    this.cacheElement('btn-show-inspector', 'showInspectorBtn');
    this.cacheElement('btn-close-inspector', 'closeInspectorBtn');
    this.cacheElement('btn-minimize-inspector', 'minimizeInspectorBtn');
    this.cacheElement('btn-export', 'exportBtn');
    this.cacheElement('btn-export-csv', 'exportCSVBtn');
    this.cacheElement('btn-export-genes', 'exportGenesBtn');

    // UI controls


    // Behavior sliders
    this.cacheElement('slider-forage', 'forageSlider');
    this.cacheElement('slider-wander', 'wanderSlider');
    this.cacheElement('slider-rest', 'restSlider');
    this.cacheElement('chaos-slider', 'chaosSlider');
    this.cacheElement('chaos-value', 'chaosValue');
    this.cacheElement('toggle-vision', 'toggleVision');
    this.cacheElement('toggle-clustering', 'toggleClustering');
    this.cacheElement('toggle-territories', 'toggleTerritories');
    this.cacheElement('toggle-memory', 'toggleMemory');
    this.cacheElement('toggle-social', 'toggleSocial');
    this.cacheElement('toggle-migration', 'toggleMigration');

    // Spawn controls

    this.cacheElement('interaction-hint', 'interactionHint');
    this.cacheElement('interaction-hint-close', 'interactionHintClose');

    // God mode UI
    this.cacheElement('god-mode-indicator', 'godModeIndicator');
    this.cacheElement('god-mode-panel', 'godModePanel');
    this.cacheElement('god-mode-exit', 'godModeExit');
    this.cacheElement('god-tool-food', 'godToolFood');
    this.cacheElement('god-tool-calm', 'godToolCalm');
    this.cacheElement('god-tool-chaos', 'godToolChaos');
    this.cacheElement('god-tool-spawn', 'godToolSpawn');
    this.cacheElement('god-tool-prop', 'godToolProp');
    this.cacheElement('god-tool-remove', 'godToolRemove');



    // Feature panel
    this.cacheElement('features-panel', 'featuresPanel');
    this.cacheElement('btn-features-close', 'featuresCloseBtn');


    // Achievements panel
    this.cacheElement('achievements-panel', 'achievementsPanel');
    this.cacheElement('btn-achievements-close', 'achievementsCloseBtn');
    this.cacheElement('gene-editor-panel', 'geneEditorPanel');
    this.cacheElement('btn-gene-editor-close', 'geneEditorCloseBtn');
    this.cacheElement('scenario-panel', 'scenarioPanel');
    this.cacheElement('btn-scenario-close', 'scenarioCloseBtn');
    this.cacheElement('eco-health-panel', 'ecoHealthPanel');
    this.cacheElement('btn-eco-health-close', 'ecoHealthCloseBtn');


    // Gameplay modes + goals
    this.cacheElement('session-meta', 'sessionMeta');
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
    this.keyToIds.set(key, id);
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
    let element = this.elements.get(key) || null;
    if (!element) {
      const id = this.keyToIds.get(key);
      if (id) {
        element = document.getElementById(id);
        if (element) {
          this.elements.set(key, element);
        }
      }
    }
    return element || null;
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
    this.keyToIds.clear();
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
