/**
 * Biome Interaction System - Creatures adapt and interact with their environment
 */

export class BiomeInteractions {
  /**
   * Apply biome-specific effects to creatures
   */
  static applyBiomeEffects(creature, biome, world, dt) {
    if (!biome) return;

    // Track time spent in biome
    if (!creature.biomeHistory) {
      creature.biomeHistory = {};
    }
    creature.biomeHistory[biome.type] = (creature.biomeHistory[biome.type] || 0) + dt;

    // Apply biome-specific effects
    switch (biome.type) {
      case 'forest':
        this.applyForestEffects(creature, biome, dt);
        break;
      case 'desert':
        this.applyDesertEffects(creature, biome, dt);
        break;
      case 'tundra':
        this.applyTundraEffects(creature, biome, dt);
        break;
      case 'swamp':
        this.applySwampEffects(creature, biome, dt);
        break;
      case 'ocean':
      case 'water':
        this.applyWaterEffects(creature, biome, dt);
        break;
      case 'mountain':
        this.applyMountainEffects(creature, biome, dt);
        break;
      case 'jungle':
        this.applyJungleEffects(creature, biome, dt);
        break;
      case 'savanna':
        this.applySavannaEffects(creature, biome, world, dt);
        break;
    }

    // Check for adaptations
    this.checkBiomeAdaptation(creature, biome);
  }

  /**
   * Forest biome effects - abundant food, cover
   */
  static applyForestEffects(creature, _biome, _dt) {
    // Cover bonus - harder to detect
    if (creature.genes && !creature.genes.predator) {
      creature.detectionModifier = 0.8;
    }

    // Food abundance
    creature.forestBonus = true;
  }

  /**
   * Desert biome effects - harsh heat, water scarcity
   */
  static applyDesertEffects(creature, biome, dt) {
    // Increased energy drain from heat
    creature.energy -= 0.5 * dt;

    // Heat stress
    if (Number.isFinite(creature.needs?.stress)) {
      creature.needs.stress = Math.min(100, creature.needs.stress + 1 * dt);
    }

    // Advantage for metabolically efficient creatures
    if (creature.genes?.metabolism && creature.genes.metabolism < 0.8) {
      creature.energy += 0.3 * dt; // Heat-adapted
    }
  }

  /**
   * Tundra biome effects - extreme cold
   */
  static applyTundraEffects(creature, biome, dt) {
    // Cold slows movement
    creature.vx *= 0.95;
    creature.vy *= 0.95;

    // Energy cost for warmth
    creature.energy -= 0.4 * dt;

    // Advantage for larger creatures (better heat retention)
    if (creature.size > 8) {
      creature.energy += 0.2 * dt;
    }
  }

  /**
   * Swamp biome effects - diseases, slow movement
   */
  static applySwampEffects(creature, biome, dt) {
    // Slowed movement
    creature.vx *= 0.9;
    creature.vy *= 0.9;

    // Disease risk
    if (Math.random() < 0.001 * dt && !creature.hasStatus?.('disease')) {
      creature.addStatus?.('disease', 10);
    }

    // Advantage for aquatic creatures
    if (creature.aquaticAffinity > 0.5) {
      creature.vx *= 1.1;
      creature.vy *= 1.1;
    }
  }

  /**
   * Water/Ocean biome effects
   */
  static applyWaterEffects(creature, biome, dt) {
    // Only aquatic creatures thrive
    if (creature.aquaticAffinity < 0.3) {
      // Non-aquatic creatures struggle
      creature.energy -= 1.5 * dt;
      creature.vx *= 0.7;
      creature.vy *= 0.7;
    } else {
      // Aquatic creatures get bonus
      creature.energy += 0.3 * dt;
      creature.vx *= 1.15;
      creature.vy *= 1.15;
    }
  }

  /**
   * Mountain biome effects - thin air, elevation
   */
  static applyMountainEffects(creature, biome, dt) {
    // Thin air affects breathing
    creature.energy -= 0.3 * dt;

    // Climbing advantage for high metabolism
    if (creature.genes?.metabolism && creature.genes.metabolism > 1.2) {
      creature.vx *= 1.05;
      creature.vy *= 1.05;
    }

    // Vision bonus from elevation
    if (creature.genes?.sense) {
      creature.effectiveSense = creature.genes.sense * 1.3;
    }
  }

  /**
   * Jungle biome effects - dense vegetation, biodiversity
   */
  static applyJungleEffects(creature, _biome, _dt) {
    // Abundant food
    creature.jungleBonus = true;

    // Camouflage for herbivores
    if (!creature.genes?.predator) {
      creature.detectionModifier = 0.7;
    }

    // Slight movement penalty (dense vegetation)
    creature.vx *= 0.95;
    creature.vy *= 0.95;
  }

  /**
   * Savanna biome effects - open plains
   */
  static applySavannaEffects(creature, biome, world, dt) {
    // Increased visibility
    creature.detectionModifier = 1.3;

    // Speed advantage for fast creatures
    if (creature.genes?.speed && creature.genes.speed > 1.2) {
      creature.vx *= 1.1;
      creature.vy *= 1.1;
    }

    // Heat during day
    const env = world?.environment || world;
    if (env?.dayNightEnabled) {
      const hour = (env.timeOfDay ?? 12) % 24;
      if (hour >= 10 && hour < 16) {
        creature.energy -= 0.2 * dt;
      }
    }
  }

  /**
   * Check and apply biome adaptations
   */
  static checkBiomeAdaptation(creature, biome) {
    if (!creature.biomeAdaptations) {
      creature.biomeAdaptations = {};
    }

    const timeInBiome = creature.biomeHistory?.[biome.type] || 0;
    const adaptationThreshold = 300; // 5 minutes

    if (timeInBiome > adaptationThreshold && !creature.biomeAdaptations[biome.type]) {
      // Creature has adapted to this biome!
      creature.biomeAdaptations[biome.type] = {
        level: 1,
        bonuses: this.getAdaptationBonuses(biome.type)
      };

      console.debug(`🌿 Creature ${creature.id} adapted to ${biome.type}!`);
    }
  }

  /**
   * Get adaptation bonuses for a biome type
   */
  static getAdaptationBonuses(biomeType) {
    const bonuses = {
      forest: { foodFinding: 1.2, stealth: 1.3 },
      desert: { heatResistance: 1.5, waterEfficiency: 1.3 },
      tundra: { coldResistance: 1.5, energyEfficiency: 1.2 },
      swamp: { diseaseResistance: 1.4, movementInWater: 1.3 },
      ocean: { aquaticSpeed: 1.5, oxygenEfficiency: 1.4 },
      mountain: { oxygenEfficiency: 1.3, visionRange: 1.4 },
      jungle: { foodFinding: 1.3, camouflage: 1.4 },
      savanna: { speedBonus: 1.3, visionRange: 1.2 }
    };

    return bonuses[biomeType] || {};
  }

  /**
   * Apply adaptation bonuses
   */
  static applyAdaptationBonuses(creature) {
    if (!creature.biomeAdaptations || !creature.currentBiomeType) return;

    const adaptation = creature.biomeAdaptations[creature.currentBiomeType];
    if (!adaptation) return;

    const bonuses = adaptation.bonuses;

    // Apply bonuses
    if (bonuses.foodFinding && creature.forageEfficiency) {
      creature.forageEfficiency *= bonuses.foodFinding;
    }
    if (bonuses.speedBonus) {
      creature.vx *= bonuses.speedBonus;
      creature.vy *= bonuses.speedBonus;
    }
    if (bonuses.visionRange && creature.effectiveSense) {
      creature.effectiveSense *= bonuses.visionRange;
    }
  }

  /**
   * Biome-specific food preferences
   */
  static getBiomeFoodPreference(creature, biome) {
    if (!biome) return 1;

    const preferences = {
      forest: { herbivore: 1.3, predator: 1.0, omnivore: 1.2 },
      desert: { herbivore: 0.7, predator: 1.1, omnivore: 0.9 },
      tundra: { herbivore: 0.6, predator: 1.2, omnivore: 0.8 },
      swamp: { herbivore: 1.0, predator: 0.9, omnivore: 1.3 },
      ocean: { herbivore: 0.5, predator: 1.3, omnivore: 1.1 },
      mountain: { herbivore: 0.8, predator: 1.0, omnivore: 1.0 },
      jungle: { herbivore: 1.4, predator: 1.1, omnivore: 1.3 },
      savanna: { herbivore: 1.1, predator: 1.3, omnivore: 1.0 }
    };

    const diet = creature.genes?.diet ?? (creature.genes?.predator ? 1.0 : 0.0);
    let dietType = 'herbivore';
    if (diet > 0.7) dietType = 'predator';
    else if (diet > 0.3) dietType = 'omnivore';

    return preferences[biome.type]?.[dietType] ?? 1;
  }

  /**
   * Draw biome adaptation indicators
   */
  static drawAdaptationIndicator(ctx, creature, x, y) {
    if (!creature.biomeAdaptations) return;

    const adaptedBiomes = Object.keys(creature.biomeAdaptations);
    if (adaptedBiomes.length === 0) return;

    ctx.save();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#88ff88';
    ctx.fillText(`🌿 ${adaptedBiomes.length}`, x + 10, y - 20);
    ctx.restore();
  }
}
