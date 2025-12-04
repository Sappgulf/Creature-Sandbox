/**
 * World Environment System - Manages environmental factors
 * Handles seasons, weather, temperature, day/night cycles, and biomes
 */
import { rand, clamp } from './utils.js';

export class WorldEnvironment {
  constructor(world) {
    this.world = world;
    this.initialize();
  }

  initialize() {
    // Day/Night cycle system
    this.timeOfDay = 12.0; // 0-24 hours (start at noon)
    this.dayLength = 120; // Real seconds for full day/night cycle
    this.dayNightEnabled = true;

    // Four Seasons System
    this.seasonTime = 0; // Time counter for seasons
    this.seasonDuration = 120; // Real seconds per season (2 minutes each)
    this.currentSeason = 'spring'; // spring, summer, autumn, winter
    this.seasonCycle = ['spring', 'summer', 'autumn', 'winter'];
    this.seasonIndex = 0;
    this.seasonPhase = 0;
    this.seasonSpeed = 0.015;

    this.seasonConfigs = {
      spring: {
        label: 'Spring Bloom',
        foodMultiplier: 1.4,
        reproductionMultiplier: 1.25,
        metabolismScalar: 0.92,
        environment: {
          tempOffset: 0.08,
          foodRateMultiplier: 1.3
        },
        weather: {
          type: 'rain',
          baseIntensity: 0.35,
          variation: 0.15,
          transition: 6
        },
        audioCue: 'season_spring'
      },
      summer: {
        label: 'Golden Summer',
        foodMultiplier: 1.15,
        reproductionMultiplier: 1.0,
        metabolismScalar: 1.02,
        environment: {
          tempOffset: 0.12,
          tempPenaltyAdd: 0.04,
          foodRateMultiplier: 1.1
        },
        weather: {
          type: 'storm',
          baseIntensity: 0.25,
          variation: 0.2,
          transition: 4
        },
        audioCue: 'season_summer'
      },
      autumn: {
        label: 'Harvest Fall',
        foodMultiplier: 0.85,
        reproductionMultiplier: 0.8,
        metabolismScalar: 1.08,
        environment: {
          tempOffset: -0.06,
          tempPenaltyAdd: -0.02,
          foodRateMultiplier: 0.9
        },
        weather: {
          type: 'wind',
          baseIntensity: 0.3,
          variation: 0.25,
          transition: 8
        },
        audioCue: 'season_autumn'
      },
      winter: {
        label: 'Frozen Winter',
        foodMultiplier: 0.6,
        reproductionMultiplier: 0.3,
        metabolismScalar: 1.25,
        environment: {
          tempOffset: -0.15,
          tempPenaltyAdd: -0.08,
          foodRateMultiplier: 0.7
        },
        weather: {
          type: 'snow',
          baseIntensity: 0.4,
          variation: 0.1,
          transition: 12
        },
        audioCue: 'season_winter'
      }
    };

    // Weather state
    this.weatherIntensity = 0;
    this.weatherType = null;
    this.weatherTransitionTime = 0;
    this.weatherTargetIntensity = 0;

    // Disease system
    this.diseaseTimer = 0;
    this.diseaseCheckInterval = 30; // Check every 30 seconds
    this.diseaseProbability = 0.02; // 2% chance per check

    console.log('🌤️ World environment system initialized');
  }

  update(dt) {
    this.updateSeasons(dt);
    this.updateWeather(dt);
    this.updateDiseaseSystem(dt);
  }

  updateSeasons(dt) {
    if (!this.dayNightEnabled) return;

    // Update season progression
    this.seasonTime += dt;
    this.seasonPhase += this.seasonSpeed * dt;

    // Check for season transition
    if (this.seasonTime >= this.seasonDuration) {
      this.transitionToNextSeason();
    }

    // Update day/night cycle
    this.timeOfDay = (this.timeOfDay + (24 * dt / this.dayLength)) % 24;
  }

  transitionToNextSeason() {
    this.seasonTime = 0;
    this.seasonIndex = (this.seasonIndex + 1) % 4;
    this.currentSeason = this.seasonCycle[this.seasonIndex];
    this.seasonPhase = 0;

    this.applySeasonConfig(this.seasonConfigs[this.currentSeason]);
    console.log(`🍂 Season changed to: ${this.seasonConfigs[this.currentSeason].label}`);
  }

  applySeasonConfig(config, { announce = true } = {}) {
    // Apply environmental modifiers
    if (config.environment) {
      if (config.environment.tempOffset !== undefined) {
        this.world.temperature.grid.fill(0.5 + config.environment.tempOffset);
      }
      if (config.environment.foodRateMultiplier !== undefined) {
        // This will affect food growth rates
        this.world.foodGrowthMultiplier = config.environment.foodRateMultiplier;
      }
    }

    // Configure weather for the season
    this.configureSeasonWeather(config);

    // Announce season change if requested
    if (announce && this.world.lineageTracker) {
      this.world.lineageTracker.recordEvent({
        type: 'season_change',
        season: this.currentSeason,
        config: config
      });
    }
  }

  configureSeasonWeather(config) {
    if (!config.weather) return;

    this.weatherType = config.weather.type;
    this.weatherTargetIntensity = config.weather.baseIntensity +
      (rand() - 0.5) * config.weather.variation * 2;
    this.weatherTransitionTime = config.weather.transition;
  }

  updateWeather(dt) {
    if (this.weatherTransitionTime > 0) {
      const transitionRate = dt / this.weatherTransitionTime;
      this.weatherIntensity += (this.weatherTargetIntensity - this.weatherIntensity) * transitionRate;
      this.weatherTransitionTime -= dt;

      if (this.weatherTransitionTime <= 0) {
        this.weatherIntensity = this.weatherTargetIntensity;
        this.weatherTransitionTime = 0;
      }
    }
  }

  updateDiseaseSystem(dt) {
    this.diseaseTimer += dt;
    if (this.diseaseTimer >= this.diseaseCheckInterval) {
      this.diseaseTimer = 0;

      // Random disease outbreaks
      if (rand() < this.diseaseProbability && this.world.creatures.length > 10) {
        this.triggerDiseaseOutbreak();
      }
    }
  }

  triggerDiseaseOutbreak() {
    const victim = this.world.creatures[Math.floor(rand() * this.world.creatures.length)];
    if (victim && victim.alive) {
      victim.statuses.set('disease', {
        severity: 0.3 + rand() * 0.4,
        duration: 20 + rand() * 40,
        contagiousness: 0.2
      });

      console.log('🦠 Disease outbreak affects creature');
    }
  }

  getWeatherState() {
    return {
      type: this.weatherType,
      intensity: this.weatherIntensity,
      timeOfDay: this.timeOfDay,
      season: this.currentSeason
    };
  }

  getSeasonModifier(kind) {
    const config = this.seasonConfigs[this.currentSeason];
    if (!config) return 1.0;

    switch (kind) {
      case 'food': return config.foodMultiplier;
      case 'reproduction': return config.reproductionMultiplier;
      case 'metabolism': return config.metabolismScalar;
      default: return 1.0;
    }
  }

  getSeasonInfo() {
    const config = this.seasonConfigs[this.currentSeason];
    return {
      name: this.currentSeason,
      label: config?.label || this.currentSeason,
      progress: clamp(this.seasonTime / this.seasonDuration, 0, 1),
      icon: this.getSeasonIcon(),
      color: this.getSeasonColor()
    };
  }

  getSeasonIcon() {
    const icons = {
      spring: '🌸',
      summer: '☀️',
      autumn: '🍂',
      winter: '❄️'
    };
    return icons[this.currentSeason] || '🌍';
  }

  getSeasonColor() {
    const colors = {
      spring: '#7FDB6A',
      summer: '#FFA500',
      autumn: '#D2691E',
      winter: '#87CEEB'
    };
    return colors[this.currentSeason] || '#666';
  }

  // Temperature penalty calculation
  tempPenaltyAt(x, y) {
    const temp = this.world.temperature.get(
      Math.floor(x / this.world.temperature.cell),
      Math.floor(y / this.world.temperature.cell)
    );

    // Optimal temperature range: 0.4-0.6 (slightly cool to warm)
    const optimalMin = 0.4;
    const optimalMax = 0.6;
    const penalty = Math.max(0,
      Math.abs(temp - 0.5) - (optimalMax - optimalMin) / 2
    ) / 0.3; // Normalize to 0-1 scale

    return clamp(penalty, 0, 1);
  }
}
