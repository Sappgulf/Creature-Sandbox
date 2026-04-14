/**
 * Enhanced World Features - Additional environmental effects and biome diversity
 */

export class WorldEnhancements {
  constructor() {
    this.weather = {
      type: 'clear', // clear, rain, storm, snow
      intensity: 0,
      duration: 0,
      particles: []
    };

    this.timeEffects = {
      sunrise: false,
      sunset: false,
      dawn: false,
      dusk: false
    };

    this.seasonalEvents = [];
  }

  /**
   * Update weather system
   */
  updateWeather(dt, world) {
    // Decrease weather duration
    if (this.weather.duration > 0) {
      this.weather.duration -= dt;

      if (this.weather.duration <= 0) {
        this.weather.type = 'clear';
        this.weather.intensity = 0;
      }
    }

    // Random weather events
    if (Math.random() < 0.0005 * dt) {
      this.triggerWeatherEvent(world);
    }

    // Update weather particles
    this.updateWeatherParticles(dt, world);
  }

  /**
   * Trigger a random weather event
   */
  triggerWeatherEvent(_world) {
    const events = ['rain', 'storm'];
    const event = events[Math.floor(Math.random() * events.length)];

    this.weather.type = event;
    this.weather.intensity = 0.3 + Math.random() * 0.7;
    this.weather.duration = 30 + Math.random() * 60; // 30-90 seconds

    console.debug(`🌦️ Weather event: ${event} (intensity: ${this.weather.intensity.toFixed(2)})`);
  }

  /**
   * Update weather particle effects
   */
  updateWeatherParticles(dt, world) {
    // Add new particles based on weather
    if (this.weather.type === 'rain' && Math.random() < this.weather.intensity) {
      this.weather.particles.push({
        x: Math.random() * world.width,
        y: -10,
        vx: -20 + Math.random() * 10,
        vy: 200 + Math.random() * 100,
        life: 1
      });
    }

    // Update and remove old particles
    this.weather.particles = this.weather.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0 && p.y < world.height;
    });

    // Limit particle count
    if (this.weather.particles.length > 500) {
      this.weather.particles = this.weather.particles.slice(-500);
    }
  }

  /**
   * Draw weather effects
   */
  drawWeather(ctx, _camera) {
    if (this.weather.type === 'clear') return;

    ctx.save();
    ctx.globalAlpha = 0.6 * this.weather.intensity;

    for (const particle of this.weather.particles) {
      ctx.fillStyle = '#a0c0ff';
      ctx.fillRect(particle.x, particle.y, 1, 4);
    }

    ctx.restore();
  }

  /**
   * Check time of day effects
   */
  updateTimeEffects(world) {
    if (!world.dayNightEnabled) return;

    const hour = world.timeOfDay % 24;

    this.timeEffects.dawn = (hour >= 5 && hour < 7);
    this.timeEffects.sunrise = (hour >= 6 && hour < 8);
    this.timeEffects.dusk = (hour >= 18 && hour < 20);
    this.timeEffects.sunset = (hour >= 17 && hour < 19);
  }

  /**
   * Apply environmental effects to creatures
   */
  applyEnvironmentalEffects(creature, world, dt) {
    // Weather effects
    if (this.weather.type === 'rain') {
      // Rain slows down non-aquatic creatures slightly
      if (creature.aquaticAffinity < 0.3) {
        creature.vx *= (1 - 0.05 * this.weather.intensity);
        creature.vy *= (1 - 0.05 * this.weather.intensity);
      }
      // But provides a small energy boost (moisture/cooling)
      creature.energy += 0.02 * this.weather.intensity * dt;
    }

    if (this.weather.type === 'storm') {
      // Storms stress creatures
      if (creature.needs && creature.needs.stress !== undefined) {
        creature.needs.stress = Math.min(100, creature.needs.stress + 2 * this.weather.intensity * dt);
      }
    }
  }
}

export const worldEnhancements = new WorldEnhancements();
