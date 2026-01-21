/**
 * Renderer Configuration Constants
 * Centralized configuration for rendering behavior and performance
 */
export const RendererConfig = {
  // Canvas and rendering
  CANVAS: {
    DEFAULT_BACKGROUND: '#15201a',
    IMAGE_SMOOTHING: {
      MOBILE: 'medium',
      DESKTOP: 'high'
    }
  },

  // Performance settings
  PERFORMANCE: {
    MOBILE_OPTIMIZATIONS: true,
    TRAILS_DISABLED_MOBILE: true,
    ATMOSPHERE_DISABLED_MOBILE: true,
    WEATHER_DISABLED_MOBILE: true,
    MINIMAP_DISABLED_MOBILE: true
  },

  // QUALITY PRESETS - for dynamic quality scaling
  QUALITY_PRESETS: {
    ultra: {
      maxParticles: 500,
      shadowsEnabled: true,
      trailsEnabled: true,
      clusteringEnabled: true,
      miniMapEnabled: true,
      miniMapUpdateInterval: 15,
      heatmapEnabled: true,
      nameLabelsEnabled: true,
      traitVisualizationEnabled: true,
      maxRenderedCreatures: 500
    },
    high: {
      maxParticles: 300,
      shadowsEnabled: true,
      trailsEnabled: true,
      clusteringEnabled: true,
      miniMapEnabled: true,
      miniMapUpdateInterval: 30,
      heatmapEnabled: true,
      nameLabelsEnabled: true,
      traitVisualizationEnabled: true,
      maxRenderedCreatures: 300
    },
    medium: {
      maxParticles: 150,
      shadowsEnabled: false,
      trailsEnabled: false,
      clusteringEnabled: true,
      miniMapEnabled: true,
      miniMapUpdateInterval: 60,
      heatmapEnabled: true,
      nameLabelsEnabled: false,
      traitVisualizationEnabled: false,
      maxRenderedCreatures: 200
    },
    low: {
      maxParticles: 50,
      shadowsEnabled: false,
      trailsEnabled: false,
      clusteringEnabled: false,
      miniMapEnabled: false,
      miniMapUpdateInterval: 120,
      heatmapEnabled: false,
      nameLabelsEnabled: false,
      traitVisualizationEnabled: false,
      maxRenderedCreatures: 100
    }
  },

  // Visual feature toggles (default states)
  FEATURES: {
    TRAILS: false,
    VISION: false,
    CLUSTERING: false,
    TERRITORIES: false,
    MEMORY: false,
    SOCIAL: false,
    MIGRATION: false,
    EMOTIONS: false,
    SENSORY: false,
    INTELLIGENCE: false,
    MATING: false,
    ATMOSPHERE: false,
    WEATHER: false,
    DAY_NIGHT: true,
    MINIMAP: false,
    MINIMAP_AUTO_HIDE: true
  },

  // Day/night cycle
  DAY_NIGHT: {
    LENGTH_SECONDS: 120,
    SPEED: 0.0002,
    START_TIME: 12 // noon
  },

  // Mini-map settings
  MINIMAP: {
    OPACITY: 1.0,
    TARGET_OPACITY: 1.0,
    FADE_SPEED: 2.0
  },

  // Rendering layers (z-index ordering)
  LAYERS: {
    BACKGROUND: 0,
    FOOD: 1,
    CORPSES: 2,
    CREATURES: 3,
    PARTICLES: 4,
    UI_OVERLAY: 5,
    DEBUG: 6
  },

  // Color schemes
  COLORS: {
    BACKGROUND: '#15201a',
    FOOD: {
      GRASS: '#7FDB6A',
      BERRIES: '#FF6B9D',
      FRUIT: '#FFA500'
    },
    CORPSES: '#8B4513',
    CREATURES: {
      HEALTHY: '#4CAF50',
      DAMAGED: '#FF5722',
      DEAD: '#9E9E9E'
    },
    TERRITORIES: '#FFEB3B',
    HEATMAP: {
      DEATH: '#FF0000',
      BIRTH: '#00FF00',
      ACTIVITY: '#FFFF00',
      ENERGY: '#00FFFF'
    }
  },

  // Animation settings
  ANIMATION: {
    HIT_FLASH_DURATION: 0.3,
    DAMAGE_FADE_TIME: 1.0,
    TRAIL_FADE_TIME: 0.5,
    PARTICLE_LIFETIME: 2.0
  },

  // Size and scaling
  SIZES: {
    CREATURE_MIN: 2,
    CREATURE_MAX: 8,
    FOOD_MIN: 1.5,
    FOOD_MAX: 4,
    CORPSE_SIZE: 3,
    TRAIL_SIZE: 1
  },

  // Performance thresholds
  THRESHOLDS: {
    CULL_DISTANCE: 1000,
    LOD_DISTANCE: 500,
    MAX_RENDERED_OBJECTS: 1000,
    FRAME_SKIP_THRESHOLD: 16 // ms
  }
};

export default RendererConfig;
