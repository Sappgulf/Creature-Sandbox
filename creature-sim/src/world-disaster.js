/**
 * World Disaster System - Manages disasters, effects, and ecosystem challenges
 */
import { rand, clamp } from './utils.js';
import { diseaseSystem, DISEASE_TYPES } from './disease-system.js';

export class WorldDisaster {
  constructor(world) {
    this.world = world;
    this.initialize();
  }

  initialize() {
    this.activeDisaster = null;
    this.pendingDisasters = [];
    this.disasterCooldown = 0;
    this.disasterHistory = [];

    // Disaster configurations
    this.disasterTypes = {
      meteorStorm: {
        name: 'Meteor Storm',
        duration: 30,
        intensity: 1.0,
        effects: ['creature_damage', 'food_destruction'],
        particleEffect: 'meteor',
        sound: 'meteor_impact'
      },
      iceAge: {
        name: 'Ice Age',
        duration: 120,
        intensity: 1.0,
        effects: ['temperature_drop', 'food_scarcity'],
        particleEffect: 'snow',
        sound: 'ice_crack'
      },
      plague: {
        name: 'Plague',
        duration: 90,
        intensity: 1.0,
        effects: ['creature_disease', 'population_decline'],
        particleEffect: 'disease',
        sound: 'plague'
      },
      drought: {
        name: 'Drought',
        duration: 150,
        intensity: 1.0,
        effects: ['food_destruction', 'water_scarcity'],
        particleEffect: 'dust',
        sound: 'drought'
      }
    };

    console.debug('🌪️ World disaster system initialized');
  }

  update(dt) {
    this.updateDisasters(dt);
  }

  // Update active disasters and pending queue
  updateDisasters(dt) {
    // Update cooldown
    if (this.disasterCooldown > 0) {
      this.disasterCooldown -= dt;
    }

    // Process scheduled disasters
    this.processScheduledDisasters();

    // Update active disaster
    if (this.activeDisaster) {
      this.activeDisaster.timeRemaining -= dt;
      this.applyDisasterEffects(dt);

      if (this.activeDisaster.timeRemaining <= 0) {
        this.endDisaster();
      }
    }
  }

  // Trigger disaster manually or randomly
  triggerDisaster(type, options = {}) {
    const config = this.disasterTypes[type];
    if (!config) {
      console.warn(`Unknown disaster type: ${type}`);
      return false;
    }

    const disaster = {
      id: Date.now() + rand(),
      type,
      name: config.name,
      duration: options.duration || config.duration,
      intensity: options.intensity || config.intensity,
      timeRemaining: options.duration || config.duration,
      effects: config.effects,
      manual: options.manual || false,
      applyCooldown: options.applyCooldown !== false,
      startTime: this.world.t,
      ...options
    };

    if (options.queue) {
      // Add to pending queue
      if (options.delay) {
        disaster.startsIn = options.delay;
        disaster.scheduledFor = this.world.t + options.delay;
      }
      this.pendingDisasters.push(disaster);
      this.pendingDisasters.sort((a, b) => (a.scheduledFor || 0) - (b.scheduledFor || 0));
    } else {
      // Start immediately
      this.beginDisaster(type, disaster);
    }

    return true;
  }

  // Trigger random disaster
  triggerRandomDisaster() {
    if (this.disasterCooldown > 0 || this.activeDisaster) return false;

    const types = Object.keys(this.disasterTypes);
    const randomType = types[Math.floor(rand() * types.length)];

    return this.triggerDisaster(randomType, {
      intensity: 0.8 + rand() * 0.4, // 0.8-1.2 intensity
      manual: false
    });
  }

  // Begin disaster execution
  beginDisaster(type, options = {}) {
    if (this.activeDisaster) {
      console.warn('Cannot start disaster: another disaster is active');
      return false;
    }

    const config = this.disasterTypes[type];
    if (!config) return false;

    this.activeDisaster = {
      id: options.id || Date.now() + rand(),
      type,
      name: config.name,
      duration: options.duration || config.duration,
      intensity: options.intensity || config.intensity,
      timeRemaining: options.duration || config.duration,
      effects: config.effects,
      manual: options.manual || false,
      startTime: this.world.t,
      ...options
    };

    // Set disaster cooldown
    if (this.activeDisaster.applyCooldown) {
      this.disasterCooldown = Math.max(this.disasterCooldown, this.activeDisaster.duration * 2);
    }

    // Trigger start effects
    this.onDisasterStart(this.activeDisaster);

    console.log(`🌪️ Disaster started: ${this.activeDisaster.name} (${this.activeDisaster.intensity.toFixed(1)}× intensity)`);
    return true;
  }

  // Process pending disasters
  processScheduledDisasters() {
    if (this.activeDisaster) return;

    const now = this.world.t;
    const readyDisasters = this.pendingDisasters.filter(d =>
      d.scheduledFor && d.scheduledFor <= now
    );

    if (readyDisasters.length > 0) {
      const disaster = readyDisasters[0];
      this.pendingDisasters.splice(this.pendingDisasters.indexOf(disaster), 0, 1);
      this.beginDisaster(disaster.type, disaster);
    }

    // Update countdown timers
    for (const disaster of this.pendingDisasters) {
      if (disaster.startsIn) {
        disaster.startsIn = Math.max(0, disaster.scheduledFor - now);
      }
    }
  }

  // Apply disaster effects each frame
  applyDisasterEffects(dt) {
    if (!this.activeDisaster) return;

    const disaster = this.activeDisaster;
    const intensity = disaster.intensity;
    const progress = 1 - (disaster.timeRemaining / disaster.duration);

    for (const effect of disaster.effects) {
      switch (effect) {
        case 'creature_damage':
          this.applyCreatureDamage(dt, intensity, progress);
          break;
        case 'food_destruction':
          this.applyFoodDestruction(dt, intensity, progress);
          break;
        case 'temperature_drop':
          this.applyTemperatureEffect(dt, intensity, progress);
          break;
        case 'creature_disease':
          this.applyDiseaseEffect(dt, intensity, progress);
          break;
      }
    }

    // Visual and audio effects
    this.applyVisualEffects(dt, disaster);
  }

  // Apply damage to creatures
  applyCreatureDamage(dt, intensity, progress) {
    const damageRate = intensity * dt * 2; // 2 damage per second at 1.0 intensity

    for (const creature of this.world.creatures) {
      if (!creature.alive) continue;

      if (rand() < dt * 0.1 * intensity) { // 10% chance per second
        this.world.combat?.applyDamage(creature, damageRate, {
          disaster: this.activeDisaster.type,
          bypassIframes: true
        });
      }
    }
  }

  // Destroy food
  applyFoodDestruction(dt, intensity, progress) {
    const destroyRate = intensity * dt * 0.5; // 0.5 food destroyed per second

    for (let i = this.world.food.length - 1; i >= 0; i--) {
      const food = this.world.food[i];
      if (rand() < destroyRate / this.world.food.length) {
        this.world.ecosystem?.world.food.splice(i, 1);
        this.world.foodGrid?.remove(food);
      }
    }
  }

  // Apply temperature effects
  applyTemperatureEffect(dt, intensity, progress) {
    const tempDrop = intensity * 0.05 * dt;
    // This would affect the temperature scalar field
    // For now, we'll apply a global temperature modifier
    this.world.temperatureModifier = (this.world.temperatureModifier || 1.0) - tempDrop;
  }

  // Apply disease effects using the disease system
  applyDiseaseEffect(dt, intensity, progress) {
    // Only try to infect new creatures periodically, not every frame
    if (Math.random() > dt * 0.5) return; // ~50% chance per second to attempt infections

    // Pick a random disease type based on intensity
    const diseaseTypes = Object.keys(DISEASE_TYPES);
    let diseaseId;

    if (intensity >= 0.8) {
      // High intensity: chance of blight
      diseaseId = Math.random() < 0.3 ? 'blight' : diseaseTypes[Math.floor(Math.random() * diseaseTypes.length)];
    } else if (intensity >= 0.5) {
      // Medium intensity: fever or parasite
      diseaseId = Math.random() < 0.5 ? 'fever' : 'parasite';
    } else {
      // Low intensity: lethargy
      diseaseId = 'lethargy';
    }

    const infectionRate = intensity * 0.03; // 3% of population per attempt

    for (const creature of this.world.creatures) {
      if (!creature.alive) continue;
      if (creature.statuses?.has('disease')) continue;

      if (Math.random() < infectionRate) {
        diseaseSystem.infectCreature(creature, diseaseId, {
          severity: intensity * (0.6 + Math.random() * 0.4)
        });
      }
    }
  }

  // Apply visual effects
  applyVisualEffects(dt, disaster) {
    // Particle effects
    if (this.world.particles && rand() < dt * 2) {
      const x = rand() * this.world.width;
      const y = rand() * this.world.height;
      this.world.particles.emit(x, y, disaster.type.toLowerCase());
    }

    // Screen shake for intense disasters
    if (disaster.intensity > 1.5) {
      this.world.screenShake = Math.min(this.world.screenShake || 0 + dt * 5, 10);
    }
  }

  // Handle disaster start
  onDisasterStart(disaster) {
    // Notify systems
    if (this.world.lineageTracker) {
      this.world.lineageTracker.recordEvent({
        type: 'disaster_start',
        disaster: disaster.type,
        intensity: disaster.intensity
      }, this.world);
    }

    // Audio cues
    if (this.world.audio) {
      this.world.audio.playSound(`disaster_${disaster.type}`);
    }
  }

  // End disaster
  endDisaster(options = {}) {
    if (!this.activeDisaster) return;

    const disaster = this.activeDisaster;
    const cancelled = options.cancelled || false;

    console.log(`${cancelled ? '🚫' : '✅'} Disaster ended: ${disaster.name}`);

    // Record in history
    this.disasterHistory.push({
      ...disaster,
      endTime: this.world.t,
      cancelled
    });

    // Cleanup effects
    this.cleanupDisasterEffects(disaster);

    // Reset state
    this.activeDisaster = null;

    // Notify systems
    if (this.world.lineageTracker) {
      this.world.lineageTracker.recordEvent({
        type: 'disaster_end',
        disaster: disaster.type,
        duration: this.world.t - disaster.startTime,
        cancelled
      }, this.world);
    }
  }

  // Cancel active disaster
  cancelDisaster() {
    if (this.activeDisaster) {
      this.endDisaster({ cancelled: true });
    }
  }

  // Cleanup disaster effects
  cleanupDisasterEffects(disaster) {
    // Reset temperature modifier
    if (disaster.effects.includes('temperature_drop')) {
      this.world.temperatureModifier = 1.0;
    }

    // Clear screen shake
    this.world.screenShake = 0;
  }

  // Get active disaster info
  getActiveDisaster() {
    return this.activeDisaster;
  }

  // Get pending disasters
  getPendingDisasters() {
    return this.pendingDisasters;
  }

  // Cancel pending disaster
  cancelPendingDisaster(id) {
    const index = this.pendingDisasters.findIndex(d => d.id === id);
    if (index >= 0) {
      this.pendingDisasters.splice(index, 1);
      return true;
    }
    return false;
  }

  // Clear all pending disasters
  clearPendingDisasters() {
    this.pendingDisasters = [];
  }

  // Get disaster statistics
  getStats() {
    return {
      active: this.activeDisaster,
      pending: this.pendingDisasters.length,
      cooldown: Math.max(0, this.disasterCooldown),
      history: this.disasterHistory.slice(-10) // Last 10 disasters
    };
  }
}
