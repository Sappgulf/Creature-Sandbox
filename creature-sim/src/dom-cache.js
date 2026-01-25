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
    this.cacheElement('watch-strip', 'watchStrip');

    this.cacheElement('moments-close', 'momentsClose');

    // Inspector elements
    this.cacheElement('inspector', 'inspector');
    this.cacheElement('btn-show-inspector', 'showInspectorBtn');
    this.cacheElement('btn-close-inspector', 'closeInspectorBtn');

    // UI controls


    // Behavior sliders
    this.cacheElement('slider-forage', 'forageSlider');
    this.cacheElement('slider-wander', 'wanderSlider');
    this.cacheElement('slider-rest', 'restSlider');

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
    this.cacheElement('god-tool-remove', 'godToolRemove');



    // Feature panel


    // Achievements panel


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
