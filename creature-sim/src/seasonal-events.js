/**
 * Seasonal Events & Migration System
 * Dynamic seasonal changes affecting creatures and world
 */

export class SeasonalEventsSystem {
  constructor() {
    this.currentSeason = 'spring';
    this.seasonProgress = 0; // 0-1 through current season
    this.seasonDuration = 120; // seconds per season
    this.activeEvents = [];
    this.migrationRoutes = new Map();
    this.seasonalEffects = this.defineSeasonalEffects();
  }

  /**
   * Define seasonal effects
   */
  defineSeasonalEffects() {
    return {
      spring: {
        name: 'Spring',
        color: '#88ff88',
        effects: {
          foodGrowth: 1.5,
          birthRate: 1.4,
          energy: 1.1,
          mood: 'happy'
        },
        events: ['bloom', 'rain_shower', 'new_growth']
      },
      summer: {
        name: 'Summer',
        color: '#ffff88',
        effects: {
          foodGrowth: 1.2,
          birthRate: 1.0,
          energy: 0.9,
          mood: 'energetic'
        },
        events: ['heat_wave', 'drought', 'abundance']
      },
      autumn: {
        name: 'Autumn',
        color: '#ff8844',
        effects: {
          foodGrowth: 0.8,
          birthRate: 0.8,
          energy: 1.0,
          mood: 'calm'
        },
        events: ['harvest', 'leaf_fall', 'migration_start']
      },
      winter: {
        name: 'Winter',
        color: '#88ccff',
        effects: {
          foodGrowth: 0.3,
          birthRate: 0.5,
          energy: 0.7,
          mood: 'survival'
        },
        events: ['snowfall', 'frost', 'hibernation']
      }
    };
  }

  /**
   * Update seasonal progression
   */
  update(world, dt) {
    // Progress through season
    this.seasonProgress += dt / this.seasonDuration;

    if (this.seasonProgress >= 1) {
      this.seasonProgress = 0;
      this.changeSeason(world);
    }

    // Update active events
    this.updateEvents(world, dt);

    // Apply seasonal effects
    this.applySeasonalEffects(world, dt);

    // Check for migrations
    this.checkMigrations(world, dt);
  }

  /**
   * Change to next season
   */
  changeSeason(world) {
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    const currentIndex = seasons.indexOf(this.currentSeason);
    const nextIndex = (currentIndex + 1) % seasons.length;

    this.currentSeason = seasons[nextIndex];

    console.debug(`🍂 Season changed to ${this.seasonalEffects[this.currentSeason].name}`);

    // Trigger season change event
    this.triggerSeasonChangeEvent(world);

    // Notify creatures
    if (world.notificationSystem) {
      world.notificationSystem.show(
        `🍂 ${this.seasonalEffects[this.currentSeason].name} has arrived`,
        'The seasons are changing...',
        4000
      );
    }
  }

  /**
   * Trigger season-specific event
   */
  triggerSeasonChangeEvent(world) {
    const seasonData = this.seasonalEffects[this.currentSeason];
    const possibleEvents = seasonData.events;

    // Random chance to trigger event
    if (Math.random() < 0.7) {
      const eventType = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
      this.triggerEvent(eventType, world);
    }
  }

  /**
   * Trigger a specific event
   */
  triggerEvent(eventType, world) {
    const event = {
      type: eventType,
      startTime: Date.now(),
      duration: 30000 + Math.random() * 60000, // 30-90 seconds
      intensity: 0.5 + Math.random() * 0.5,
      active: true
    };

    this.activeEvents.push(event);

    console.debug(`⚡ Seasonal event: ${eventType}`);

    // Apply immediate event effects
    this.applyEventEffect(event, world);
  }

  /**
   * Apply event effects
   */
  applyEventEffect(event, world) {
    switch (event.type) {
      case 'bloom':
        // Spawn extra food
        for (let i = 0; i < 50; i++) {
          world.addFood(
            Math.random() * world.width,
            Math.random() * world.height,
            1.5 // Extra nutritious
          );
        }
        break;

      case 'heat_wave':
        // All creatures lose energy faster
        event.energyDrain = 0.5 * event.intensity;
        break;

      case 'drought':
        // Reduce food spawning
        event.foodReduction = 0.7;
        break;

      case 'harvest':
        // Bonus food in specific areas
        event.harvestZones = this.createHarvestZones(world, 3);
        break;

      case 'migration_start':
        // Trigger migration for some creatures
        this.initiateSeasonalMigration(world);
        break;

      case 'snowfall':
        // Slow movement, create snow particles
        event.snowParticles = [];
        event.movementPenalty = 0.8;
        break;

      case 'hibernation':
        // Some creatures enter low-energy state
        event.hibernationBonus = 0.5; // Energy savings
        break;
    }
  }

  /**
   * Create harvest zones
   */
  createHarvestZones(world, count) {
    const zones = [];

    for (let i = 0; i < count; i++) {
      zones.push({
        x: Math.random() * world.width,
        y: Math.random() * world.height,
        radius: 100 + Math.random() * 100,
        foodBonus: 2
      });
    }

    return zones;
  }

  /**
   * Initiate seasonal migration
   */
  initiateSeasonalMigration(world) {
    // Some creatures will migrate to better biomes
    const migrants = world.creatures.filter(c =>
      c.genes?.migrationInstinct && c.genes.migrationInstinct > 0.6
    );

    for (const creature of migrants) {
      const route = this.createMigrationRoute(creature, world);
      this.migrationRoutes.set(creature.id, route);
      creature.isMigrating = true;
    }

    console.debug(`🦅 ${migrants.length} creatures began migration`);
  }

  /**
   * Create migration route
   */
  createMigrationRoute(creature, world) {
    // Find a distant location with favorable conditions
    const targetX = Math.random() * world.width;
    const targetY = Math.random() * world.height;

    return {
      startX: creature.x,
      startY: creature.y,
      targetX,
      targetY,
      progress: 0,
      waypoints: this.generateWaypoints(creature.x, creature.y, targetX, targetY)
    };
  }

  /**
   * Generate waypoints for migration
   */
  generateWaypoints(startX, startY, targetX, targetY) {
    const waypoints = [];
    const steps = 5;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      waypoints.push({
        x: startX + (targetX - startX) * t,
        y: startY + (targetY - startY) * t
      });
    }

    return waypoints;
  }

  /**
   * Update active events
   */
  updateEvents(world, dt) {
    const now = Date.now();

    this.activeEvents = this.activeEvents.filter(event => {
      const age = now - event.startTime;

      if (age > event.duration) {
        // Event ended
        this.endEvent(event, world);
        return false;
      }

      // Update event
      this.updateEvent(event, world, dt);
      return true;
    });
  }

  /**
   * Update specific event
   */
  updateEvent(event, world, dt) {
    switch (event.type) {
      case 'snowfall':
        // Add snow particles
        if (Math.random() < 0.1) {
          event.snowParticles.push({
            x: Math.random() * world.width,
            y: 0,
            vy: 50 + Math.random() * 50,
            size: 2 + Math.random() * 2
          });
        }

        // Update snow particles
        for (const particle of event.snowParticles) {
          particle.y += particle.vy * dt;
        }

        event.snowParticles = event.snowParticles.filter(p => p.y < world.height);
        break;
    }
  }

  /**
   * End event
   */
  endEvent(event, world) {
    console.debug(`✓ Event ended: ${event.type}`);

    // Clean up event-specific data
    if (event.type === 'migration_start') {
      // End migrations
      for (const creature of world.creatures) {
        if (creature.isMigrating) {
          creature.isMigrating = false;
          this.migrationRoutes.delete(creature.id);
        }
      }
    }
  }

  /**
   * Apply seasonal effects to creatures
   */
  applySeasonalEffects(world, _dt) {
    const seasonData = this.seasonalEffects[this.currentSeason];

    for (const creature of world.creatures) {
      // Energy modifier
      creature.seasonalEnergyMod = seasonData.effects.energy;

      // Mood effect
      if (creature.emotions) {
        this.applySeasonalMood(creature, seasonData.effects.mood);
      }
    }
  }

  /**
   * Apply seasonal mood
   */
  applySeasonalMood(creature, mood) {
    switch (mood) {
      case 'happy':
        creature.emotions.joy = Math.min(1, (creature.emotions.joy || 0) + 0.01);
        break;
      case 'energetic':
        creature.seasonalSpeedBonus = 1.1;
        break;
      case 'calm':
        if (creature.needs?.stress) {
          creature.needs.stress = Math.max(0, creature.needs.stress - 0.5);
        }
        break;
      case 'survival':
        creature.seasonalEnergyConservation = true;
        break;
    }
  }

  /**
   * Check and update migrations
   */
  checkMigrations(world, _dt) {
    for (const [creatureId, route] of this.migrationRoutes.entries()) {
      const creature = world.creatures.find(c => c.id === creatureId);
      if (!creature || !creature.alive) {
        this.migrationRoutes.delete(creatureId);
        continue;
      }

      // Move towards next waypoint
      const waypoint = route.waypoints[Math.floor(route.progress * route.waypoints.length)];
      if (waypoint) {
        const dx = waypoint.x - creature.x;
        const dy = waypoint.y - creature.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 50) {
          route.progress += 0.01;
        }

        // Guide creature towards waypoint
        creature.migrationTarget = waypoint;
      }

      // Complete migration
      if (route.progress >= 1) {
        creature.isMigrating = false;
        this.migrationRoutes.delete(creatureId);
        console.debug(`✓ Creature ${creatureId} completed migration`);
      }
    }
  }

  /**
   * Draw seasonal effects
   */
  drawSeasonalEffects(ctx, _world) {
    // Draw snow particles
    for (const event of this.activeEvents) {
      if (event.type === 'snowfall' && event.snowParticles) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (const particle of event.snowParticles) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw harvest zones
      if (event.type === 'harvest' && event.harvestZones) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 220, 100, 0.3)';
        ctx.lineWidth = 2;
        for (const zone of event.harvestZones) {
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /**
   * Draw season UI
   */
  drawSeasonUI(ctx, x, y) {
    const seasonData = this.seasonalEffects[this.currentSeason];

    ctx.save();

    // Season indicator
    ctx.fillStyle = 'rgba(30, 30, 45, 0.8)';
    ctx.fillRect(x, y, 200, 50);

    ctx.fillStyle = seasonData.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`🍂 ${seasonData.name}`, x + 10, y + 20);

    // Progress bar
    ctx.fillStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.fillRect(x + 10, y + 30, 180, 8);

    ctx.fillStyle = seasonData.color;
    ctx.fillRect(x + 10, y + 30, 180 * this.seasonProgress, 8);

    // Active events
    if (this.activeEvents.length > 0) {
      ctx.fillStyle = '#ffff88';
      ctx.font = '11px sans-serif';
      ctx.fillText(`⚡ ${this.activeEvents[0].type}`, x + 10, y + 48);
    }

    ctx.restore();
  }

  /**
   * Get current season data for world effects
   */
  getCurrentSeasonData() {
    return this.seasonalEffects[this.currentSeason];
  }
}

export const seasonalEventsSystem = new SeasonalEventsSystem();
