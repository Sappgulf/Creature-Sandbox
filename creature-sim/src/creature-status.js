/**
 * Creature Status System - Manages status effects, diseases, and temporary conditions
 */
import { rand, clamp } from './utils.js';
import { CreatureConfig } from './creature-config.js';
import { diseaseSystem, DISEASE_TYPES } from './disease-system.js';

export class CreatureStatusSystem {
  constructor(creature) {
    this.creature = creature;
  }

  /**
   * Check if creature has a specific status
   */
  hasStatus(key) {
    return this.creature.statuses.has(key);
  }

  /**
   * Get status object by key
   */
  getStatus(key) {
    return this.creature.statuses.get(key);
  }

  /**
   * Get status intensity with fallback
   */
  getStatusIntensity(key, fallback = 0) {
    const status = this.getStatus(key);
    return status?.intensity ?? status?.metadata?.intensity ?? fallback;
  }

  /**
   * Apply or update a status effect
   */
  applyStatus(key, opts = {}) {
    const now = this.creature.statuses.get(key) || {
      duration: 0,
      intensity: 1.0,
      stacks: 1,
      source: null,
      metadata: {}
    };

    // Update duration
    if (opts.duration !== undefined) {
      now.duration = Math.max(0, opts.duration);
    }

    // Update intensity
    if (opts.intensity !== undefined) {
      now.intensity = opts.intensity;
    }

    // Update stacks
    if (opts.stacks !== undefined) {
      now.stacks = Math.max(1, opts.stacks);
    }

    // Update metadata
    if (opts.metadata) {
      now.metadata = { ...now.metadata, ...opts.metadata };
    }

    // Update source
    if (opts.source !== undefined) {
      now.source = opts.source;
    }

    this.creature.statuses.set(key, now);

    // Trigger immediate effects
    this.onStatusApplied(key, now);
  }

  /**
   * Remove a status effect
   */
  removeStatus(key) {
    const status = this.creature.statuses.get(key);
    if (status) {
      this.creature.statuses.delete(key);
      this.onStatusRemoved(key, status);
    }
  }

  /**
   * Update status system each frame
   */
  tick(dt) {
    if (this.creature.statuses.size === 0) return;

    for (const [key, status] of this.creature.statuses) {
      // Update duration
      if (status.duration !== undefined) {
        status.duration -= dt;
        if (status.duration <= 0) {
          this.removeStatus(key);
          continue;
        }
      }

      // Apply ongoing effects
      this.applyStatusEffects(dt, key, status);
    }
  }

  /**
   * Apply ongoing status effects
   */
  applyStatusEffects(dt, key, status) {
    const world = this.creature._lastWorld;
    if (!world) return;

    switch (key) {
      case 'disease':
        this.applyDiseaseEffects(dt, status, world);
        break;
      case 'venom':
        this.applyVenomEffects(dt, status);
        break;
      case 'bleeding':
        this.applyBleedingEffects(dt, status);
        break;
    }
  }

  /**
   * Apply disease effects
   */
  applyDiseaseEffects(dt, disease, world) {
    // Disease spread timer
    if (!this.creature.statusTimers) {
      this.creature.statusTimers = {};
    }

    // Get disease modifiers from disease system
    const modifiers = diseaseSystem.getDiseaseModifiers(this.creature);

    // Apply health drain
    if (modifiers.healthDrainPerSecond > 0) {
      this.creature.health -= modifiers.healthDrainPerSecond * dt;
      if (this.creature.health <= 0) {
        this.creature.alive = false;
        diseaseSystem.handleDiseaseDeath(this.creature);
      }
    }

    // Force rest chance (for lethargy)
    if (modifiers.forceRestChance > 0 && Math.random() < modifiers.forceRestChance * dt) {
      this.creature.resting = true;
      this.creature.restTimer = 2.0; // Force 2 seconds of rest
    }

    // Spread timer
    if (this.creature.statusTimers.diseaseSpread === undefined) {
      this.creature.statusTimers.diseaseSpread = rand(0.6, 1.2);
    }

    this.creature.statusTimers.diseaseSpread -= dt;
    if (this.creature.statusTimers.diseaseSpread <= 0) {
      this.creature.statusTimers.diseaseSpread = rand(0.6, 1.2);
      this.spreadDisease(world, disease);
    }

    // Emotional effects
    const severity = disease.metadata?.severity || disease.severity || 0.5;
    if (this.creature.emotions) {
      this.creature.emotions.fear = Math.min(1.0, this.creature.emotions.fear + severity * 0.1 * dt);
      this.creature.emotions.happiness = Math.max(0, this.creature.emotions.happiness - severity * 0.05 * dt);
    }
  }

  /**
   * Apply venom effects
   */
  applyVenomEffects(dt, venom) {
    if (!this.creature.statusTimers) {
      this.creature.statusTimers = {};
    }

    this.creature.statusTimers.venomTick -= dt;
    if (this.creature.statusTimers.venomTick <= 0) {
      this.creature.statusTimers.venomTick = CreatureConfig.STATUS.VENOM_TICK_RATE;

      const damage = venom.damagePerSecond * CreatureConfig.STATUS.VENOM_TICK_RATE;
      this.creature.health -= damage;

      if (typeof this.creature.recordDamage === 'function') {
        this.creature.recordDamage(damage);
      }

      // Check if venom killed the creature
      if (this.creature.health <= 0) {
        this.creature.alive = false;
      }
    }
  }

  /**
   * Apply bleeding effects
   */
  applyBleedingEffects(dt, bleed) {
    // Bleeding damage is applied in main update loop
    // This method handles any additional bleeding logic
  }

  /**
   * Spread disease to nearby creatures
   */
  spreadDisease(world, disease) {
    if (!world?.creatureManager) return;

    const diseaseType = disease.metadata?.diseaseType || 'fever';
    const contagiousness = disease.metadata?.contagiousness || disease.contagiousness || 0.2;

    const neighbors = world.creatureManager.queryCreatures(
      this.creature.x, this.creature.y, 30
    );

    if (!neighbors || neighbors.length <= 1) return;

    for (const other of neighbors) {
      if (other === this.creature || !other.alive) continue;
      if (other.hasStatus && other.hasStatus('disease')) continue;

      // Check immunity via disease system
      if (diseaseSystem.isImmune(other.id, diseaseType)) {
        continue;
      }

      const distance = Math.sqrt(
        (other.x - this.creature.x) ** 2 + (other.y - this.creature.y) ** 2
      );
      const spreadChance = contagiousness * (1 - distance / 30);

      if (Math.random() < spreadChance) {
        // Use disease system to infect
        const infected = diseaseSystem.infectCreature(other, diseaseType, {
          severity: (disease.metadata?.severity || disease.severity || 0.5) * 0.9
        });

        if (infected) {
          if (typeof other.logEvent === 'function') {
            const diseaseName = DISEASE_TYPES[diseaseType]?.name || 'disease';
            other.logEvent(`Contracted ${diseaseName} from nearby creature`, world.t);
          }

          if (world.particles && typeof world.particles.addDiseasePulse === 'function') {
            world.particles.addDiseasePulse(this.creature.x, this.creature.y);
          }
        }
      }
    }
  }

  /**
   * Handle status application events
   */
  onStatusApplied(key, status) {
    // Log status application
    if (typeof this.creature.logEvent === 'function') {
      this.creature.logEvent(`Status applied: ${key}`, this.creature._lastWorld?.t || 0, {
        duration: status.duration,
        intensity: status.intensity
      });
    }

    // Audio/visual feedback
    const world = this.creature._lastWorld;
    if (world?.audio && key === 'disease') {
      world.audio.playSound('disease');
    }
  }

  /**
   * Handle status removal events
   */
  onStatusRemoved(key, status) {
    // Log status removal
    if (typeof this.creature.logEvent === 'function') {
      this.creature.logEvent(`Status removed: ${key}`, this.creature._lastWorld?.t || 0);
    }

    // Cleanup any status-specific data
    if (key === 'disease') {
      if (this.creature.statusTimers) {
        delete this.creature.statusTimers.diseaseSpread;
      }

      // Handle disease recovery - grant immunity if creature is still alive
      if (this.creature.alive && status.metadata?.diseaseType) {
        diseaseSystem.handleRecovery(this.creature, status.metadata.diseaseType);
      }
    }
    if (key === 'venom' && this.creature.statusTimers) {
      delete this.creature.statusTimers.venomTick;
    }
  }

  /**
   * Get all active statuses
   */
  getActiveStatuses() {
    return Array.from(this.creature.statuses.entries()).map(([key, status]) => ({
      key,
      ...status
    }));
  }

  /**
   * Clear all statuses (for reset/cleanup)
   */
  clearAllStatuses() {
    this.creature.statuses.clear();
    if (this.creature.statusTimers) {
      this.creature.statusTimers = {};
    }
  }
}
