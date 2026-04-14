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
    this.dayLength = 600; // Real seconds for full day/night cycle (10 min)
    this.dayNightEnabled = true;
    this.dayPhase = 'day';
    this.dayLight = 1;
    this.dayNightState = {
      phase: 'day',
      light: 1,
      activityBias: 1,
      restBias: 1,
      eatBias: 1,
      wanderBias: 1,
      hungerRateMult: 1,
      socialRateMult: 1,
      overcrowdStressMult: 1,
      movementSpeedMult: 1,
      foodGrowthMult: 1
    };

    // Four Seasons System
    this.seasonTime = 0; // Time counter for seasons
    this.seasonDuration = 480; // Real seconds per season (8 minutes each)
    this.currentSeason = 'spring'; // spring, summer, autumn, winter
    this.seasonCycle = ['spring', 'summer', 'autumn', 'winter'];
    this.seasonIndex = 0;
    this.seasonPhase = 0;
    this.seasonSpeed = 0.015;

    this.seasonConfigs = {
      spring: {
        label: 'Spring Bloom',
        foodMultiplier: 1.25,
        reproductionMultiplier: 1.15,
        metabolismScalar: 0.95,
        environment: {
          tempOffset: 0.08,
          foodRateMultiplier: 1.18
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
        foodMultiplier: 1.08,
        reproductionMultiplier: 0.98,
        metabolismScalar: 1.05,
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
        foodMultiplier: 0.95,
        reproductionMultiplier: 0.9,
        metabolismScalar: 1.05,
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
        foodMultiplier: 0.8,
        reproductionMultiplier: 0.6,
        metabolismScalar: 1.15,
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

    // Ambient mood system (wind/calm)
    this.moodType = 'neutral';
    this.moodIntensity = 0;
    this.moodTimer = rand(10, 18);
    this.moodDuration = 0;
    this.windAngle = rand() * Math.PI * 2;
    this.windStrength = 0;
    this.windX = 0;
    this.windY = 0;
    this.calmBoost = 0;
    this.moodState = {
      type: 'neutral',
      intensity: 0,
      windX: 0,
      windY: 0,
      calmBoost: 0
    };
    this.calmZones = [];
    this.calmZoneId = 1;

    // Disease system
    this.diseaseTimer = 0;
    this.diseaseCheckInterval = 30; // Check every 30 seconds
    this.diseaseProbability = 0.02; // 2% chance per check

    this.updateDayNightState();
    console.debug('🌤️ World environment system initialized');
  }

  update(dt) {
    this.updateSeasons(dt);
    this.updateWeather(dt);
    this.updateAmbientMood(dt);
    this.updateCalmZones(dt);
    this.updateDiseaseSystem(dt);
  }

  updateSeasons(dt) {
    // Update season progression
    this.seasonTime += dt;
    this.seasonPhase += this.seasonSpeed * dt;

    // Check for season transition
    if (this.seasonTime >= this.seasonDuration) {
      this.transitionToNextSeason();
    }

    // Update day/night cycle
    if (this.dayNightEnabled) {
      this.timeOfDay = (this.timeOfDay + (24 * dt / this.dayLength)) % 24;
      this.updateDayNightState();
    } else {
      this.applyStaticDayNightState();
    }
  }

  transitionToNextSeason() {
    this.seasonTime = 0;
    this.seasonIndex = (this.seasonIndex + 1) % 4;
    this.currentSeason = this.seasonCycle[this.seasonIndex];
    this.seasonPhase = 0;

    this.applySeasonConfig(this.seasonConfigs[this.currentSeason]);
    console.debug(`🍂 Season changed to: ${this.seasonConfigs[this.currentSeason].label}`);
  }

  applySeasonConfig(config, { announce = true } = {}) {
    // Apply environmental modifiers
    if (config.environment) {
      if (config.environment.tempOffset !== undefined) {
        this.world.temperature.grid.fill(0.5 + config.environment.tempOffset);
      }
      if (config.environment.foodRateMultiplier !== undefined) {
        // This will affect food growth rates
        this.world.foodGrowthMultiplier = clamp(config.environment.foodRateMultiplier, 0.7, 1.4);
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
      }, this.world);
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

  updateDayNightState() {
    const hour = this.timeOfDay % 24;
    let phase = 'night';
    let light = 0.25;

    if (hour >= 6 && hour < 18) {
      phase = 'day';
      light = 1;
    } else if (hour >= 18 && hour < 20) {
      phase = 'dusk';
      light = 1 - ((hour - 18) / 2) * 0.75;
    } else if (hour >= 4 && hour < 6) {
      phase = 'dawn';
      light = 0.25 + ((hour - 4) / 2) * 0.75;
    }

    this.dayPhase = phase;
    this.dayLight = clamp(light, 0.2, 1);

    const activityBias = 0.85 + this.dayLight * 0.35;
    const restBias = 1.25 - this.dayLight * 0.35;
    const eatBias = 0.95 + this.dayLight * 0.2;
    const wanderBias = 0.85 + this.dayLight * 0.35;
    const hungerRateMult = 0.9 + this.dayLight * 0.2;
    const socialRateMult = 0.9 + this.dayLight * 0.15;
    const overcrowdStressMult = 1.25 - this.dayLight * 0.3;
    const movementSpeedMult = 0.9 + this.dayLight * 0.15;
    const foodGrowthMult = 0.85 + this.dayLight * 0.25;

    this.dayNightState.phase = phase;
    this.dayNightState.light = this.dayLight;
    this.dayNightState.activityBias = activityBias;
    this.dayNightState.restBias = restBias;
    this.dayNightState.eatBias = eatBias;
    this.dayNightState.wanderBias = wanderBias;
    this.dayNightState.hungerRateMult = hungerRateMult;
    this.dayNightState.socialRateMult = socialRateMult;
    this.dayNightState.overcrowdStressMult = overcrowdStressMult;
    this.dayNightState.movementSpeedMult = movementSpeedMult;
    this.dayNightState.foodGrowthMult = foodGrowthMult;
  }

  applyStaticDayNightState() {
    this.dayPhase = 'day';
    this.dayLight = 1;

    this.dayNightState.phase = 'day';
    this.dayNightState.light = 1;
    this.dayNightState.activityBias = 1.2;
    this.dayNightState.restBias = 0.9;
    this.dayNightState.eatBias = 1.15;
    this.dayNightState.wanderBias = 1.2;
    this.dayNightState.hungerRateMult = 1.1;
    this.dayNightState.socialRateMult = 1.05;
    this.dayNightState.overcrowdStressMult = 0.95;
    this.dayNightState.movementSpeedMult = 1.05;
    this.dayNightState.foodGrowthMult = 1.1;
  }

  updateAmbientMood(dt) {
    if (this.moodDuration > 0) {
      this.moodDuration = Math.max(0, this.moodDuration - dt);
      if (this.moodType === 'wind') {
        const fade = this.moodDuration < 4 ? this.moodDuration / 4 : 1;
        const intensity = this.moodIntensity * fade;
        this.windStrength = intensity;
        this.windAngle += dt * 0.12;
      } else if (this.moodType === 'calm') {
        const fade = this.moodDuration < 3 ? this.moodDuration / 3 : 1;
        this.calmBoost = this.moodIntensity * fade;
        this.windStrength = 0;
      }
    } else {
      this.windStrength = 0;
      this.calmBoost = 0;
      this.moodTimer -= dt;
      if (this.moodTimer <= 0) {
        this.startAmbientMood();
      }
    }

    this.windX = Math.cos(this.windAngle) * this.windStrength;
    this.windY = Math.sin(this.windAngle) * this.windStrength;

    this.moodState.type = this.moodType;
    this.moodState.intensity = this.moodIntensity;
    this.moodState.windX = this.windX;
    this.moodState.windY = this.windY;
    this.moodState.calmBoost = this.calmBoost;
  }

  updateCalmZones(dt) {
    if (!this.calmZones.length) return;
    for (let i = this.calmZones.length - 1; i >= 0; i--) {
      const zone = this.calmZones[i];
      zone.t -= dt;
      if (zone.t <= 0) {
        this.calmZones.splice(i, 1);
      }
    }
  }

  addCalmZone(x, y, radius = 120, duration = 16, strength = 0.6) {
    const zone = {
      id: this.calmZoneId++,
      x,
      y,
      radius,
      strength: clamp(strength, 0.2, 1),
      t: duration
    };
    this.calmZones.push(zone);
    return zone;
  }

  getCalmZoneAt(x, y) {
    if (!this.calmZones.length) return null;
    let best = null;
    let bestD2 = Infinity;
    for (const zone of this.calmZones) {
      const dx = zone.x - x;
      const dy = zone.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= zone.radius * zone.radius && d2 < bestD2) {
        bestD2 = d2;
        best = zone;
      }
    }
    return best;
  }

  startAmbientMood() {
    const roll = rand();
    this.moodType = roll < 0.55 ? 'wind' : 'calm';
    this.moodIntensity = this.moodType === 'wind' ? rand(0.18, 0.45) : rand(0.2, 0.5);
    this.moodDuration = this.moodType === 'wind' ? rand(12, 20) : rand(10, 16);
    this.moodTimer = rand(16, 26);
    if (this.moodType === 'wind') {
      this.windAngle = rand() * Math.PI * 2;
    }
  }

  triggerWindBurst(intensity = 0.35, duration = 6) {
    this.moodType = 'wind';
    this.moodIntensity = clamp(intensity, 0.15, 0.6);
    this.moodDuration = clamp(duration, 3, 12);
    this.moodTimer = rand(14, 22);
    this.windAngle = rand() * Math.PI * 2;
    this.updateAmbientMood(0);
  }

  triggerDiseaseOutbreak() {
    const victim = this.world.creatures[Math.floor(rand() * this.world.creatures.length)];
    if (victim && victim.alive) {
      victim.statuses.set('disease', {
        severity: 0.3 + rand() * 0.4,
        duration: 20 + rand() * 40,
        contagiousness: 0.2
      });

      console.debug('🦠 Disease outbreak affects creature');
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

  getDayNightState() {
    return this.dayNightState;
  }

  getMoodState() {
    return this.moodState;
  }

  getSeasonModifier(kind) {
    const config = this.seasonConfigs[this.currentSeason];
    if (!config) return 1.0;

    switch (kind) {
      case 'food': return clamp(config.foodMultiplier, 0.7, 1.35);
      case 'reproduction': return clamp(config.reproductionMultiplier, 0.5, 1.2);
      case 'metabolism': return clamp(config.metabolismScalar, 0.85, 1.25);
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
