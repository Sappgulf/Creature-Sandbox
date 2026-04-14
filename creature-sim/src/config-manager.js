/**
 * Configuration Manager - Centralized game configuration system
 * Provides type-safe configuration with validation and hot-reloading
 */

export class ConfigManager {
  constructor() {
    this.configs = new Map();
    this.defaults = new Map();
    this.validators = new Map();
    this.listeners = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the configuration manager with default configs
   */
  initialize() {
    if (this.isInitialized) return;

    this.registerConfig('world', this.getDefaultWorldConfig());
    this.registerConfig('creature', this.getDefaultCreatureConfig());
    this.registerConfig('rendering', this.getDefaultRenderingConfig());
    this.registerConfig('ui', this.getDefaultUIConfig());
    this.registerConfig('performance', this.getDefaultPerformanceConfig());
    this.registerConfig('genetics', this.getDefaultGeneticsConfig());
    this.registerConfig('audio', this.getDefaultAudioConfig());
    this.registerConfig('achievements', this.getDefaultAchievementsConfig());

    this.isInitialized = true;
  }

  /**
   * Register a configuration section
   * @param {string} section - Configuration section name
   * @param {Object} defaultConfig - Default configuration object
   * @param {Function} validator - Optional validation function
   */
  registerConfig(section, defaultConfig, validator = null) {
    this.defaults.set(section, JSON.parse(JSON.stringify(defaultConfig)));
    this.configs.set(section, JSON.parse(JSON.stringify(defaultConfig)));

    if (validator) {
      this.validators.set(section, validator);
    }
  }

  /**
   * Get a configuration value
   * @param {string} section - Configuration section
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} Configuration value
   */
  get(section, key = null, defaultValue = undefined) {
    const config = this.configs.get(section);
    if (!config) {
      console.warn(`Configuration section '${section}' not found`);
      return defaultValue;
    }

    if (key === null) {
      return config;
    }

    // Support dot notation (e.g., 'rendering.canvas.width')
    return this.getNestedValue(config, key, defaultValue);
  }

  /**
   * Set a configuration value
   * @param {string} section - Configuration section
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} value - New value
   * @param {boolean} validate - Whether to validate the change
   * @returns {boolean} True if successful
   */
  set(section, key, value, validate = true) {
    const config = this.configs.get(section);
    if (!config) {
      console.warn(`Configuration section '${section}' not found`);
      return false;
    }

    const oldValue = this.getNestedValue(config, key);

    // Set the new value
    this.setNestedValue(config, key, value);

    // Validate if requested
    if (validate && this.validators.has(section)) {
      const validator = this.validators.get(section);
      try {
        const validationResult = validator(config, key, value);
        if (validationResult !== true) {
          // Validation failed, revert the change
          this.setNestedValue(config, key, oldValue);
          console.warn(`Configuration validation failed for ${section}.${key}:`, validationResult);
          return false;
        }
      } catch (error) {
        // Validation error, revert the change
        this.setNestedValue(config, key, oldValue);
        console.error(`Configuration validation error for ${section}.${key}:`, error);
        return false;
      }
    }

    // Notify listeners
    this.notifyListeners(section, key, value, oldValue);

    return true;
  }

  /**
   * Reset a configuration section to defaults
   * @param {string} section - Configuration section
   * @param {boolean} notify - Whether to notify listeners
   */
  resetSection(section, notify = true) {
    if (!this.defaults.has(section)) {
      console.warn(`No default configuration found for section '${section}'`);
      return;
    }

    const oldConfig = this.configs.get(section);
    const newConfig = JSON.parse(JSON.stringify(this.defaults.get(section)));
    this.configs.set(section, newConfig);

    if (notify) {
      this.notifyListeners(section, null, newConfig, oldConfig);
    }
  }

  /**
   * Reset all configurations to defaults
   */
  resetAll() {
    for (const section of this.defaults.keys()) {
      this.resetSection(section, false);
    }
    // All configurations reset to defaults
  }

  /**
   * Load configuration from an object
   * @param {Object} configData - Configuration data
   * @param {boolean} validate - Whether to validate changes
   */
  loadFromObject(configData, validate = true) {
    let _loadedCount = 0;
    let _failedCount = 0;

    for (const [section, sectionConfig] of Object.entries(configData)) {
      if (this.configs.has(section)) {
        for (const [key, value] of Object.entries(sectionConfig)) {
          if (this.set(section, key, value, validate)) {
            _loadedCount++;
          } else {
            _failedCount++;
          }
        }
      } else {
        console.warn(`Unknown configuration section: ${section}`);
        _failedCount++;
      }
    }

    // Configuration loaded silently
  }

  /**
   * Export current configuration to an object
   * @returns {Object} Configuration data
   */
  exportToObject() {
    const result = {};
    for (const [section, config] of this.configs) {
      result[section] = JSON.parse(JSON.stringify(config));
    }
    return result;
  }

  /**
   * Subscribe to configuration changes
   * @param {string} section - Configuration section
   * @param {Function} callback - Callback function
   * @param {Object} context - Optional context
   * @returns {Function} Unsubscribe function
   */
  onChange(section, callback, context = null) {
    if (!this.listeners.has(section)) {
      this.listeners.set(section, new Set());
    }

    const boundCallback = context ? callback.bind(context) : callback;
    boundCallback._originalCallback = callback;
    boundCallback._context = context;

    this.listeners.get(section).add(boundCallback);

    return () => {
      if (this.listeners.has(section)) {
        this.listeners.get(section).delete(boundCallback);
      }
    };
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  getNestedValue(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation
   * @private
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Notify listeners of configuration changes
   * @private
   */
  notifyListeners(section, key, newValue, oldValue) {
    if (this.listeners.has(section)) {
      const listeners = Array.from(this.listeners.get(section));
      for (const callback of listeners) {
        try {
          callback({
            section,
            key,
            newValue,
            oldValue,
            timestamp: performance.now()
          });
        } catch (error) {
          console.error(`Error in config change listener for ${section}:`, error);
        }
      }
    }
  }

  /**
   * Get default world configuration
   * @private
   */
  getDefaultWorldConfig() {
    return {
      width: 4000,
      height: 2800,
      maxFood: 500,
      foodRespawnRate: 1.0,
      seasonSpeed: 0.015,
      dayLength: 120,
      timeScale: 1.0,
      gravity: 0.0, // No gravity in this sim
      airResistance: 0.98,
      temperature: {
        enabled: true,
        baseTemp: 0.7,
        tempGradient: 0.3,
        comfortZone: { min: 0.3, max: 0.8 }
      }
    };
  }

  /**
   * Get default creature configuration
   * @private
   */
  getDefaultCreatureConfig() {
    return {
      maxCreatures: 500,
      baseEnergy: 40,
      baseSize: 3.5,
      baseHealth: 12,
      baseSpeed: 1.0,
      baseMetabolism: 1.0,
      baseSense: 90,
      baseFOV: 70,
      maxAge: 300,
      reproduction: {
        energyThreshold: 36,
        energyCost: 18,
        cooldown: 0
      },
      lifecycle: {
        baby: { multiplier: 1.1, sizeMultiplier: 0.7 },
        juvenile: { multiplier: 1.05, sizeMultiplier: 0.85 },
        adult: { multiplier: 1.0, sizeMultiplier: 1.0 },
        elder: { multiplier: 1.15, sizeMultiplier: 1.1 }
      }
    };
  }

  /**
   * Get default rendering configuration
   * @private
   */
  getDefaultRenderingConfig() {
    return {
      canvas: {
        devicePixelRatio: 1.0, // Performance optimization
        imageSmoothing: true,
        imageSmoothingQuality: 'high'
      },
      camera: {
        zoomSpeed: 0.0015,
        minZoom: 0.1,
        maxZoom: 3.0,
        followSmoothing: 0.12
      },
      features: {
        vision: false,
        clustering: false,
        territories: false,
        memory: false,
        social: false,
        migration: false,
        nests: false,
        emotions: false,
        sensory: false,
        intelligence: false,
        mating: false,
        minimap: true,
        trails: true,
        weather: true,
        atmosphere: true
      },
      performance: {
        cullingDistance: 1000,
        maxVisibleCreatures: 200,
        particleLimit: 200,
        trailLength: 24
      }
    };
  }

  /**
   * Get default UI configuration
   * @private
   */
  getDefaultUIConfig() {
    return {
      inspector: {
        visible: true,
        autoHide: false,
        updateThrottle: 100 // ms
      },
      panels: {
        features: { visible: false },
        scenario: { visible: false },
        geneEditor: { visible: false },
        ecoHealth: { visible: false }
      },
      charts: {
        updateThrottle: 5000, // ms
        maxDataPoints: 600
      },
      notifications: {
        enabled: true,
        duration: 3000,
        maxVisible: 5
      }
    };
  }

  /**
   * Get default performance configuration
   * @private
   */
  getDefaultPerformanceConfig() {
    return {
      targetFPS: 60,
      fixedTimeStep: 1/60,
      maxFrameSkip: 6,
      analyticsWorker: true,
      updateThrottles: {
        ui: 200,      // UI updates every 200ms
        charts: 5000, // Charts every 5 seconds
        analytics: 1000, // Analytics every second
        physics: 16   // Physics every frame (~60fps)
      },
      memory: {
        maxEventHistory: 1000,
        gcThreshold: 50 * 1024 * 1024, // 50MB
        objectPoolSize: 1000
      },
      profiling: {
        enabled: false,
        sampleRate: 1000, // Sample every 1000ms
        includeScopes: false
      }
    };
  }

  /**
   * Get default genetics configuration
   * @private
   */
  getDefaultGeneticsConfig() {
    return {
      mutationRate: 0.05,
      diploid: true,
      traits: {
        speed: { min: 0.2, max: 2.0, default: 0.8 },
        sense: { min: 20, max: 200, default: 90 },
        metabolism: { min: 0.4, max: 2.0, default: 1.0 },
        fov: { min: 20, max: 160, default: 70 },
        size: { min: 2.0, max: 6.0, default: 3.5 }
      },
      disorders: {
        enabled: true,
        probability: 0.02
      },
      sexualSelection: {
        enabled: true,
        choosiness: 0.3
      }
    };
  }

  /**
   * Get default audio configuration
   * @private
   */
  getDefaultAudioConfig() {
    return {
      enabled: true,
      masterVolume: 0.7,
      musicVolume: 0.5,
      sfxVolume: 0.8,
      spatialAudio: false,
      adaptiveMusic: true,
      soundEvents: {
        creatureBorn: true,
        creatureDied: true,
        achievement: true,
        disaster: true,
        seasonChange: true
      }
    };
  }

  /**
   * Get default achievements configuration
   * @private
   */
  getDefaultAchievementsConfig() {
    return {
      enabled: true,
      notifications: true,
      autoSave: true,
      tracking: {
        milestones: true,
        statistics: true,
        rareEvents: true
      },
      rewards: {
        xpMultiplier: 1.0,
        unlockFeatures: true
      }
    };
  }
}

// Global configuration manager instance
export const configManager = new ConfigManager();

// Initialize on first access
configManager.initialize();
