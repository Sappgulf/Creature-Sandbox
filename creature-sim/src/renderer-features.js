/**
 * Renderer Feature Manager - Manages toggling and coordination of visual features
 */
import { RendererConfig } from './renderer-config.js';

export class RendererFeatureManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.initializeFeatures();
  }

  initializeFeatures() {
    // Copy default feature states
    this.features = { ...RendererConfig.FEATURES };

    // Apply mobile optimizations
    if (this.renderer.isMobile) {
      this.applyMobileOptimizations();
    }
  }

  applyMobileOptimizations() {
    // Disable performance-heavy features on mobile
    this.features.TRAILS = false;
    this.features.ATMOSPHERE = false;
    this.features.WEATHER = false;
    this.features.MINIMAP = false;
  }

  // Feature toggling methods
  setFeature(feature, enabled) {
    if (feature in this.features) {
      this.features[feature] = enabled;
      this.onFeatureChanged(feature, enabled);
    }
  }

  toggleFeature(feature) {
    if (feature in this.features) {
      this.setFeature(feature, !this.features[feature]);
    }
  }

  isFeatureEnabled(feature) {
    return this.features[feature] || false;
  }

  // Batch feature updates
  setFeatures(featureMap) {
    let changed = false;
    for (const [feature, enabled] of Object.entries(featureMap)) {
      if (feature in this.features && this.features[feature] !== enabled) {
        this.features[feature] = enabled;
        changed = true;
      }
    }

    if (changed) {
      this.onFeaturesChanged(featureMap);
    }
  }

  // Get all feature states
  getFeatureStates() {
    return { ...this.features };
  }

  // Reset to defaults
  resetToDefaults() {
    this.features = { ...RendererConfig.FEATURES };
    if (this.renderer.isMobile) {
      this.applyMobileOptimizations();
    }
    this.onFeaturesReset();
  }

  // Event handlers for feature changes
  onFeatureChanged(feature, enabled) {
    // Update renderer properties based on feature changes
    switch (feature) {
      case 'TRAILS':
        this.renderer.enableTrails = enabled;
        break;
      case 'VISION':
        this.renderer.enableVision = enabled;
        break;
      case 'CLUSTERING':
        this.renderer.enableClustering = enabled;
        break;
      case 'TERRITORIES':
        this.renderer.enableTerritories = enabled;
        break;
      case 'MEMORY':
        this.renderer.enableMemory = enabled;
        break;
      case 'SOCIAL':
        this.renderer.enableSocialBonds = enabled;
        break;
      case 'MIGRATION':
        this.renderer.enableMigration = enabled;
        break;
      case 'NESTS':
        this.renderer.enableNests = enabled;
        break;
      case 'EMOTIONS':
        this.renderer.enableEmotions = enabled;
        break;
      case 'SENSORY':
        this.renderer.enableSensoryViz = enabled;
        break;
      case 'INTELLIGENCE':
        this.renderer.enableIntelligence = enabled;
        break;
      case 'MATING':
        this.renderer.enableMating = enabled;
        break;
      case 'ATMOSPHERE':
        this.renderer.enableAtmosphere = enabled;
        break;
      case 'WEATHER':
        this.renderer.enableWeather = enabled;
        break;
      case 'DAY_NIGHT':
        this.renderer.enableDayNight = enabled;
        break;
      case 'MINIMAP':
        this.renderer.enableMiniMap = enabled;
        break;
    }
  }

  onFeaturesChanged(featureMap) {
    // Handle batch feature changes
    for (const [feature, enabled] of Object.entries(featureMap)) {
      this.onFeatureChanged(feature, enabled);
    }
  }

  onFeaturesReset() {
    // Re-apply all current feature states to renderer
    for (const [feature, enabled] of Object.entries(this.features)) {
      this.onFeatureChanged(feature, enabled);
    }
  }

  // Performance monitoring
  getPerformanceImpact() {
    let impact = 0;

    // Calculate performance cost of enabled features
    if (this.features.TRAILS) impact += 1;
    if (this.features.VISION) impact += 2;
    if (this.features.CLUSTERING) impact += 1;
    if (this.features.TERRITORIES) impact += 2;
    if (this.features.MEMORY) impact += 1;
    if (this.features.SOCIAL) impact += 1;
    if (this.features.MIGRATION) impact += 1;
    if (this.features.NESTS) impact += 1;
    if (this.features.EMOTIONS) impact += 1;
    if (this.features.SENSORY) impact += 1;
    if (this.features.INTELLIGENCE) impact += 1;
    if (this.features.MATING) impact += 1;
    if (this.features.ATMOSPHERE) impact += 3;
    if (this.features.WEATHER) impact += 2;
    if (this.features.DAY_NIGHT) impact += 1;
    if (this.features.MINIMAP) impact += 2;

    return {
      score: impact,
      level: impact < 5 ? 'low' : impact < 10 ? 'medium' : 'high',
      recommendations: this.getPerformanceRecommendations(impact)
    };
  }

  getPerformanceRecommendations(impact) {
    const recommendations = [];

    if (impact > 10) {
      recommendations.push('Consider disabling atmosphere and weather effects');
    }
    if (impact > 8) {
      recommendations.push('Try disabling vision cones and territories');
    }
    if (impact > 6) {
      recommendations.push('Consider disabling trails and minimap');
    }

    return recommendations;
  }
}
