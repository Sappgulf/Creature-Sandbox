/**
 * Event System - Decoupled communication between game systems.
 * Provides publish-subscribe pattern for clean system interactions.
 * Uses a circular buffer for event history to avoid O(n) array operations.
 * 
 * @example
 * // Subscribe to an event
 * const unsubscribe = eventSystem.on('creature:born', (data) => {
 *   console.log('Creature born:', data.id);
 * });
 * 
 * // Emit an event
 * eventSystem.emit('creature:born', { id: 123, genes: {...} });
 * 
 * // Unsubscribe
 * unsubscribe();
 */
export class EventSystem {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    // Circular buffer for event history (avoids O(n) shift operations)
    this.maxHistorySize = 1000;
    this.eventHistory = new Array(this.maxHistorySize);
    this.historyHead = 0;
    this.historyCount = 0;
    this.profilingEnabled = false;
    this.eventCounts = new Map();
    this.eventTimings = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - The event type to listen for
   * @param {Function} callback - The callback function
   * @param {Object} context - Optional context to bind to the callback
   * @returns {Function} Unsubscribe function
   */
  on(eventType, callback, context = null) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const boundCallback = context ? callback.bind(context) : callback;
    boundCallback._originalCallback = callback;
    boundCallback._context = context;

    this.listeners.get(eventType).add(boundCallback);

    // Return unsubscribe function
    return () => this.off(eventType, callback, context);
  }

  /**
   * Subscribe to an event once (auto-unsubscribes after first trigger)
   * @param {string} eventType - The event type to listen for
   * @param {Function} callback - The callback function
   * @param {Object} context - Optional context to bind to the callback
   * @returns {Function} Unsubscribe function
   */
  once(eventType, callback, context = null) {
    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, new Set());
    }

    const boundCallback = context ? callback.bind(context) : callback;
    boundCallback._originalCallback = callback;
    boundCallback._context = context;

    this.onceListeners.get(eventType).add(boundCallback);

    // Return unsubscribe function
    return () => this.off(eventType, callback, context);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventType - The event type
   * @param {Function} callback - The callback function to remove
   * @param {Object} context - Optional context that was used when subscribing
   */
  off(eventType, callback, context = null) {
    // Remove from regular listeners
    if (this.listeners.has(eventType)) {
      const listeners = this.listeners.get(eventType);
      for (const boundCallback of listeners) {
        if (boundCallback._originalCallback === callback &&
            boundCallback._context === context) {
          listeners.delete(boundCallback);
          break;
        }
      }

      // Clean up empty listener sets
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }

    // Remove from once listeners
    if (this.onceListeners.has(eventType)) {
      const listeners = this.onceListeners.get(eventType);
      for (const boundCallback of listeners) {
        if (boundCallback._originalCallback === callback &&
            boundCallback._context === context) {
          listeners.delete(boundCallback);
          break;
        }
      }

      // Clean up empty listener sets
      if (listeners.size === 0) {
        this.onceListeners.delete(eventType);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventType - The event type
   * @param {*} data - Optional data to pass to listeners
   * @param {Object} options - Optional emission options
   */
  emit(eventType, data = null, options = {}) {
    const startTime = performance.now();

    // Update event counts for profiling
    this.eventCounts.set(eventType, (this.eventCounts.get(eventType) || 0) + 1);

    // Add to circular buffer history (O(1) instead of O(n) shift)
    this.eventHistory[this.historyHead] = {
      type: eventType,
      data: data,
      timestamp: startTime,
      options: options
    };
    this.historyHead = (this.historyHead + 1) % this.maxHistorySize;
    if (this.historyCount < this.maxHistorySize) {
      this.historyCount++;
    }

    // Notify regular listeners
    if (this.listeners.has(eventType)) {
      const listeners = Array.from(this.listeners.get(eventType));
      for (const callback of listeners) {
        try {
          const result = callback(data, eventType);
          if (result === false) {
            // Listener returned false, stop propagation
            break;
          }
        } catch (error) {
          console.error(`Error in event listener for '${eventType}':`, error);
          if (options.throwOnError !== false) {
            throw error;
          }
        }
      }
    }

    // Notify once listeners and remove them
    if (this.onceListeners.has(eventType)) {
      const listeners = Array.from(this.onceListeners.get(eventType));
      this.onceListeners.delete(eventType); // Clear before calling to avoid re-entry issues

      for (const callback of listeners) {
        try {
          callback(data, eventType);
        } catch (error) {
          console.error(`Error in once event listener for '${eventType}':`, error);
          if (options.throwOnError !== false) {
            throw error;
          }
        }
      }
    }

    // Record timing for profiling
    if (this.profilingEnabled) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      if (!this.eventTimings.has(eventType)) {
        this.eventTimings.set(eventType, []);
      }
      const timings = this.eventTimings.get(eventType);
      timings.push(duration);
      if (timings.length > 100) {
        timings.shift(); // Keep only last 100 timings
      }
    }
  }

  /**
   * Check if there are any listeners for an event type
   * @param {string} eventType - The event type to check
   * @returns {boolean} True if there are listeners
   */
  hasListeners(eventType) {
    return this.listeners.has(eventType) || this.onceListeners.has(eventType);
  }

  /**
   * Get the number of listeners for an event type
   * @param {string} eventType - The event type
   * @returns {number} Number of listeners
   */
  listenerCount(eventType) {
    let count = 0;
    if (this.listeners.has(eventType)) {
      count += this.listeners.get(eventType).size;
    }
    if (this.onceListeners.has(eventType)) {
      count += this.onceListeners.get(eventType).size;
    }
    return count;
  }

  /**
   * Clear all listeners (useful for cleanup)
   */
  clear() {
    this.listeners.clear();
    this.onceListeners.clear();
    // Reset circular buffer
    this.eventHistory = new Array(this.maxHistorySize);
    this.historyHead = 0;
    this.historyCount = 0;
    this.eventCounts.clear();
    this.eventTimings.clear();
  }

  /**
   * Get event profiling information
   * @returns {Object} Profiling data
   */
  getProfilingInfo() {
    const eventStats = {};

    for (const [eventType, count] of this.eventCounts) {
      eventStats[eventType] = {
        count: count,
        avgTime: 0,
        maxTime: 0,
        listeners: this.listenerCount(eventType)
      };

      if (this.eventTimings.has(eventType)) {
        const timings = this.eventTimings.get(eventType);
        if (timings.length > 0) {
          eventStats[eventType].avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
          eventStats[eventType].maxTime = Math.max(...timings);
        }
      }
    }

    return {
      totalEvents: this.historyCount,
      eventStats: eventStats,
      recentEvents: this.getRecentEvents(10)
    };
  }

  /**
   * Enable or disable event profiling
   * @param {boolean} enabled - Whether to enable profiling
   */
  setProfiling(enabled) {
    this.profilingEnabled = enabled;
    if (!enabled) {
      this.eventTimings.clear();
    }
  }

  /**
   * Get recent event history from circular buffer
   * @param {number} count - Number of recent events to return
   * @returns {Array} Recent events (newest first)
   */
  getRecentEvents(count = 10) {
    const actualCount = Math.min(count, this.historyCount);
    const result = [];
    
    for (let i = 0; i < actualCount; i++) {
      // Walk backwards from most recent
      const idx = (this.historyHead - 1 - i + this.maxHistorySize) % this.maxHistorySize;
      const event = this.eventHistory[idx];
      if (event) {
        result.push(event);
      }
    }
    
    return result;
  }
}

// Game Event Types - Centralized event definitions
export const GameEvents = {
  // Core game events
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  GAME_RESET: 'game:reset',

  // Creature events
  CREATURE_BORN: 'creature:born',
  CREATURE_DIED: 'creature:died',
  CREATURE_EAT: 'creature:eat',
  CREATURE_MOVE: 'creature:move',
  CREATURE_REPRODUCE: 'creature:reproduce',
  CREATURE_ATTACK: 'creature:attack',
  CREATURE_DEFEND: 'creature:defend',

  // World events
  WORLD_UPDATE: 'world:update',
  WORLD_SEASON_CHANGE: 'world:season_change',
  WORLD_WEATHER_CHANGE: 'world:weather_change',
  WORLD_DISASTER_START: 'world:disaster_start',
  WORLD_DISASTER_END: 'world:disaster_end',

  // UI events
  UI_PANEL_OPEN: 'ui:panel_open',
  UI_PANEL_CLOSE: 'ui:panel_close',
  UI_INSPECTOR_UPDATE: 'ui:inspector_update',
  UI_CHART_UPDATE: 'ui:chart_update',

  // Input events
  INPUT_KEY_DOWN: 'input:key_down',
  INPUT_KEY_UP: 'input:key_up',
  INPUT_MOUSE_DOWN: 'input:mouse_down',
  INPUT_MOUSE_UP: 'input:mouse_up',
  INPUT_MOUSE_MOVE: 'input:mouse_move',

  // Achievement events
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  ACHIEVEMENT_PROGRESS: 'achievement:progress',
  SESSION_GOAL_UPDATED: 'session_goal:updated',
  SESSION_GOAL_COMPLETED: 'session_goal:completed',
  GAME_MODE_CHANGED: 'game_mode:changed',

  // Analytics events
  ANALYTICS_DATA_UPDATE: 'analytics:data_update',
  ANALYTICS_SNAPSHOT: 'analytics:snapshot',

  // Audio events
  AUDIO_PLAY_SOUND: 'audio:play_sound',
  AUDIO_STOP_SOUND: 'audio:stop_sound',
  AUDIO_MUSIC_CHANGE: 'audio:music_change',

  // Error events
  ERROR_OCCURRED: 'error:occurred',
  ERROR_CRITICAL: 'error:critical',
  ERROR_RECOVERED: 'error:recovered'
};

// Global event system instance
export const eventSystem = new EventSystem();
