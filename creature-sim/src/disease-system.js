/**
 * Disease System - Manages disease types, outbreaks, immunity, and epidemiology
 *
 * Features:
 * - Multiple disease types with unique effects
 * - Immunity system (temporary and permanent)
 * - Global outbreak tracking and statistics
 * - Integration with creature status system
 */

import { rand, clamp } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';

/** Disease type definitions */
export const DISEASE_TYPES = {
  fever: {
    id: 'fever',
    name: 'Red Fever',
    description: 'High temperature causes energy drain and slowed movement',
    color: '#ff6b6b',
    icon: '🔥',
    baseDuration: 30,
    durationVariance: 15,
    contagiousness: 0.25,
    severity: 0.6,
    effects: {
      speedMultiplier: 0.7,
      energyDrainMultiplier: 1.5,
      healthDrainPerSecond: 0.3
    },
    immunityDuration: 120, // 2 minutes immunity after recovery
    immunityChance: 0.8    // 80% chance to gain immunity
  },

  lethargy: {
    id: 'lethargy',
    name: 'Lethargy Plague',
    description: 'Extreme fatigue causes creatures to move slowly and rest often',
    color: '#9b59b6',
    icon: '😴',
    baseDuration: 45,
    durationVariance: 20,
    contagiousness: 0.15,
    severity: 0.4,
    effects: {
      speedMultiplier: 0.4,
      energyDrainMultiplier: 0.8, // Actually less energy drain but very slow
      healthDrainPerSecond: 0.1,
      forceRestChance: 0.3 // Chance per second to force rest state
    },
    immunityDuration: 90,
    immunityChance: 0.9
  },

  parasite: {
    id: 'parasite',
    name: 'Gut Parasite',
    description: 'Internal parasite steals nutrition, causing starvation',
    color: '#27ae60',
    icon: '🦠',
    baseDuration: 60,
    durationVariance: 30,
    contagiousness: 0.1, // Low contagion - spread through food
    severity: 0.5,
    effects: {
      speedMultiplier: 0.9,
      energyDrainMultiplier: 2.0, // Double energy consumption
      healthDrainPerSecond: 0.15,
      foodEfficiency: 0.5 // Food gives half energy
    },
    immunityDuration: 180, // Longer immunity
    immunityChance: 0.6
  },

  blight: {
    id: 'blight',
    name: 'The Blight',
    description: 'Deadly disease with high mortality but grants permanent immunity to survivors',
    color: '#2c3e50',
    icon: '💀',
    baseDuration: 20,
    durationVariance: 10,
    contagiousness: 0.4, // Very contagious
    severity: 1.0,
    effects: {
      speedMultiplier: 0.5,
      energyDrainMultiplier: 1.8,
      healthDrainPerSecond: 1.0, // Deadly
      reproductionBlocked: true
    },
    immunityDuration: Infinity, // Permanent immunity
    immunityChance: 1.0 // Survivors always get immunity
  }
};

/**
 * Disease System - Global manager for disease outbreaks
 */
export class DiseaseSystem {
  constructor() {
    this.activeOutbreaks = new Map(); // diseaseId -> outbreak data
    this.immuneCreatures = new Map(); // creatureId -> Map(diseaseId -> expiryTime)
    this.statistics = {
      totalInfections: 0,
      totalDeaths: 0,
      totalRecoveries: 0,
      currentInfected: 0,
      outbreakHistory: []
    };
    this.lastUpdateTime = 0;
  }

  /**
   * Initialize or reset the disease system
   */
  reset() {
    this.activeOutbreaks.clear();
    this.immuneCreatures.clear();
    this.statistics = {
      totalInfections: 0,
      totalDeaths: 0,
      totalRecoveries: 0,
      currentInfected: 0,
      outbreakHistory: []
    };
  }

  /**
   * Update disease system each frame
   * @param {number} dt - Delta time in seconds
   * @param {object} world - World reference
   */
  update(dt, world) {
    if (!world?.creatures) return;

    const currentTime = world.t || 0;
    this.lastUpdateTime = currentTime;

    // Update immunity timers
    this.updateImmunity(currentTime);

    // Count current infections
    let infectedCount = 0;
    for (const creature of world.creatures) {
      if (creature?.alive && creature.hasStatus?.('disease')) {
        infectedCount++;
      }
    }
    this.statistics.currentInfected = infectedCount;

    // Update outbreak tracking
    this.updateOutbreaks(world);
  }

  /**
   * Update immunity timers, removing expired immunities
   */
  updateImmunity(currentTime) {
    for (const [creatureId, immunities] of this.immuneCreatures) {
      for (const [diseaseId, expiryTime] of immunities) {
        if (expiryTime !== Infinity && currentTime >= expiryTime) {
          immunities.delete(diseaseId);
        }
      }
      if (immunities.size === 0) {
        this.immuneCreatures.delete(creatureId);
      }
    }
  }

  /**
   * Update outbreak tracking
   */
  updateOutbreaks(world) {
    // Count infections by disease type
    const infectionCounts = new Map();

    for (const creature of world.creatures) {
      if (!creature?.alive) continue;

      const diseaseStatus = creature.statuses?.get('disease');
      if (diseaseStatus?.metadata?.diseaseType) {
        const type = diseaseStatus.metadata.diseaseType;
        infectionCounts.set(type, (infectionCounts.get(type) || 0) + 1);
      }
    }

    // Update active outbreaks
    for (const [diseaseId, count] of infectionCounts) {
      if (!this.activeOutbreaks.has(diseaseId)) {
        // New outbreak detected
        this.activeOutbreaks.set(diseaseId, {
          diseaseId,
          startTime: world.t,
          peakInfections: count,
          totalInfected: count
        });

        eventSystem?.emit(GameEvents.NOTIFICATION, {
          message: `${DISEASE_TYPES[diseaseId]?.icon || '🦠'} ${DISEASE_TYPES[diseaseId]?.name || 'Disease'} outbreak detected!`,
          type: 'warning'
        });
      } else {
        const outbreak = this.activeOutbreaks.get(diseaseId);
        outbreak.peakInfections = Math.max(outbreak.peakInfections, count);
      }
    }

    // Check for ended outbreaks
    for (const [diseaseId, outbreak] of this.activeOutbreaks) {
      if (!infectionCounts.has(diseaseId) || infectionCounts.get(diseaseId) === 0) {
        // Outbreak ended
        this.statistics.outbreakHistory.push({
          ...outbreak,
          endTime: world.t,
          duration: world.t - outbreak.startTime
        });
        this.activeOutbreaks.delete(diseaseId);

        eventSystem?.emit(GameEvents.NOTIFICATION, {
          message: `${DISEASE_TYPES[diseaseId]?.icon || '✅'} ${DISEASE_TYPES[diseaseId]?.name || 'Disease'} outbreak has ended`,
          type: 'success'
        });
      }
    }
  }

  /**
   * Check if a creature is immune to a disease
   * @param {number} creatureId - Creature ID
   * @param {string} diseaseId - Disease type ID
   * @returns {boolean} True if immune
   */
  isImmune(creatureId, diseaseId) {
    const immunities = this.immuneCreatures.get(creatureId);
    if (!immunities) return false;

    const expiryTime = immunities.get(diseaseId);
    if (expiryTime === undefined) return false;

    return expiryTime === Infinity || expiryTime > this.lastUpdateTime;
  }

  /**
   * Grant immunity to a creature
   * @param {number} creatureId - Creature ID
   * @param {string} diseaseId - Disease type ID
   * @param {number} duration - Duration in seconds (Infinity for permanent)
   */
  grantImmunity(creatureId, diseaseId, duration) {
    if (!this.immuneCreatures.has(creatureId)) {
      this.immuneCreatures.set(creatureId, new Map());
    }

    const expiryTime = duration === Infinity ? Infinity : this.lastUpdateTime + duration;
    this.immuneCreatures.get(creatureId).set(diseaseId, expiryTime);
  }

  /**
   * Attempt to infect a creature with a disease
   * @param {object} creature - Creature to infect
   * @param {string} diseaseId - Disease type ID
   * @param {object} options - Override options
   * @returns {boolean} True if infection succeeded
   */
  infectCreature(creature, diseaseId, options = {}) {
    if (!creature?.alive || !creature.applyStatus) return false;

    const diseaseType = DISEASE_TYPES[diseaseId];
    if (!diseaseType) return false;

    // Check immunity
    if (this.isImmune(creature.id, diseaseId)) {
      return false;
    }

    // Check if already infected with this disease
    const existingDisease = creature.statuses?.get('disease');
    if (existingDisease?.metadata?.diseaseType === diseaseId) {
      return false;
    }

    // Calculate duration
    const duration = options.duration ||
      diseaseType.baseDuration + (Math.random() - 0.5) * 2 * diseaseType.durationVariance;

    // Apply the disease status
    creature.applyStatus('disease', {
      duration,
      intensity: options.severity || diseaseType.severity,
      metadata: {
        diseaseType: diseaseId,
        diseaseName: diseaseType.name,
        effects: { ...diseaseType.effects },
        contagiousness: options.contagiousness || diseaseType.contagiousness,
        severity: options.severity || diseaseType.severity,
        color: diseaseType.color
      }
    });

    this.statistics.totalInfections++;

    return true;
  }

  /**
   * Handle creature recovery from disease
   * @param {object} creature - Creature that recovered
   * @param {string} diseaseId - Disease type ID
   */
  handleRecovery(creature, diseaseId) {
    const diseaseType = DISEASE_TYPES[diseaseId];
    if (!diseaseType) return;

    this.statistics.totalRecoveries++;

    // Check for immunity gain
    if (Math.random() < diseaseType.immunityChance) {
      this.grantImmunity(creature.id, diseaseId, diseaseType.immunityDuration);

      if (creature.logEvent) {
        creature.logEvent(`Developed immunity to ${diseaseType.name}`, this.lastUpdateTime);
      }
    }
  }

  /**
   * Handle creature death from disease
   * @param {object} creature - Creature that died
   */
  handleDiseaseDeath(creature) {
    this.statistics.totalDeaths++;
  }

  /**
   * Start a disease outbreak (typically from disaster system)
   * @param {string} diseaseId - Disease type to outbreak
   * @param {object} world - World reference
   * @param {object} options - Outbreak options
   */
  startOutbreak(diseaseId, world, options = {}) {
    if (!world?.creatures?.length) return;

    const diseaseType = DISEASE_TYPES[diseaseId];
    if (!diseaseType) return;

    const targetCount = options.initialInfections || Math.ceil(world.creatures.length * 0.1);
    const candidates = world.creatures.filter(c =>
      c?.alive && !this.isImmune(c.id, diseaseId)
    );

    // Shuffle and pick random creatures
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    let infected = 0;

    for (const creature of shuffled) {
      if (infected >= targetCount) break;
      if (this.infectCreature(creature, diseaseId, options)) {
        infected++;
      }
    }

    return infected;
  }

  /**
   * Get disease modifiers for a creature
   * @param {object} creature - Creature to check
   * @returns {object} Modifier values
   */
  getDiseaseModifiers(creature) {
    const modifiers = {
      speedMultiplier: 1.0,
      energyDrainMultiplier: 1.0,
      healthDrainPerSecond: 0,
      foodEfficiency: 1.0,
      reproductionBlocked: false,
      forceRestChance: 0
    };

    if (!creature?.statuses) return modifiers;

    const diseaseStatus = creature.statuses.get('disease');
    if (!diseaseStatus?.metadata?.effects) return modifiers;

    const effects = diseaseStatus.metadata.effects;
    const severity = diseaseStatus.metadata.severity || 1.0;

    // Apply effects scaled by severity
    if (effects.speedMultiplier !== undefined) {
      modifiers.speedMultiplier = 1 - (1 - effects.speedMultiplier) * severity;
    }
    if (effects.energyDrainMultiplier !== undefined) {
      modifiers.energyDrainMultiplier = 1 + (effects.energyDrainMultiplier - 1) * severity;
    }
    if (effects.healthDrainPerSecond !== undefined) {
      modifiers.healthDrainPerSecond = effects.healthDrainPerSecond * severity;
    }
    if (effects.foodEfficiency !== undefined) {
      modifiers.foodEfficiency = 1 - (1 - effects.foodEfficiency) * severity;
    }
    if (effects.reproductionBlocked) {
      modifiers.reproductionBlocked = true;
    }
    if (effects.forceRestChance !== undefined) {
      modifiers.forceRestChance = effects.forceRestChance * severity;
    }

    return modifiers;
  }

  /**
   * Get statistics for display
   * @returns {object} Statistics object
   */
  getStatistics() {
    return {
      ...this.statistics,
      activeOutbreakCount: this.activeOutbreaks.size,
      activeOutbreaks: Array.from(this.activeOutbreaks.values()),
      immuneCount: this.immuneCreatures.size
    };
  }

  /**
   * Get available disease types for UI/debugging
   * @returns {object[]} Array of disease type info
   */
  getDiseaseTypes() {
    return Object.values(DISEASE_TYPES).map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      color: d.color,
      severity: d.severity,
      contagiousness: d.contagiousness
    }));
  }
}

// Global disease system instance
export const diseaseSystem = new DiseaseSystem();
