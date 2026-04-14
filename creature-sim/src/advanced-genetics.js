/**
 * Advanced Genetics - Rare mutations, special traits, and genetic phenomena
 */

export class AdvancedGenetics {
  /**
   * Rare mutation system - special genetic variants
   */
  static applyRareMutations(genes, mutationRate = 0.05) {
    const mutations = [];

    // Gigantism - 1% chance
    if (Math.random() < 0.01 * mutationRate) {
      genes.gigantism = true;
      genes.size = (genes.size ?? 6) * 1.5;
      genes.metabolism = (genes.metabolism ?? 1) * 0.8; // Slower metabolism
      mutations.push({ name: 'Gigantism', type: 'size', rarity: 'rare' });
    }

    // Dwarfism - 1% chance
    if (Math.random() < 0.01 * mutationRate && !genes.gigantism) {
      genes.dwarfism = true;
      genes.size = (genes.size ?? 6) * 0.6;
      genes.metabolism = (genes.metabolism ?? 1) * 1.3; // Faster metabolism
      mutations.push({ name: 'Dwarfism', type: 'size', rarity: 'rare' });
    }

    // Albinism - 2% chance (pure white coloration)
    if (Math.random() < 0.02 * mutationRate) {
      genes.albinism = true;
      genes.hue = 0;
      genes.saturation = 0;
      mutations.push({ name: 'Albinism', type: 'color', rarity: 'rare' });
    }

    // Melanism - 2% chance (very dark coloration)
    if (Math.random() < 0.02 * mutationRate && !genes.albinism) {
      genes.melanism = true;
      genes.lightness = 20;
      mutations.push({ name: 'Melanism', type: 'color', rarity: 'rare' });
    }

    // Bioluminescence - 0.5% chance (glowing!)
    if (Math.random() < 0.005 * mutationRate) {
      genes.bioluminescent = true;
      genes.glowIntensity = 0.3 + Math.random() * 0.5;
      mutations.push({ name: 'Bioluminescence', type: 'special', rarity: 'legendary' });
    }

    // Regeneration - 1.5% chance (health regen)
    if (Math.random() < 0.015 * mutationRate) {
      genes.regeneration = true;
      genes.regenRate = 0.1 + Math.random() * 0.2;
      mutations.push({ name: 'Regeneration', type: 'survival', rarity: 'rare' });
    }

    // Longevity - 1% chance (lives longer)
    if (Math.random() < 0.01 * mutationRate) {
      genes.longevity = true;
      genes.maxAge = (genes.maxAge ?? 120) * 1.5;
      mutations.push({ name: 'Longevity', type: 'survival', rarity: 'rare' });
    }

    // Accelerated Aging - 0.8% chance (grows faster but dies younger)
    if (Math.random() < 0.008 * mutationRate && !genes.longevity) {
      genes.acceleratedAging = true;
      genes.maturitySpeed = 2;
      genes.maxAge = (genes.maxAge ?? 120) * 0.7;
      mutations.push({ name: 'Accelerated Aging', type: 'lifecycle', rarity: 'uncommon' });
    }

    // Chameleon - 1% chance (camouflage ability)
    if (Math.random() < 0.01 * mutationRate) {
      genes.chameleon = true;
      genes.camouflageStrength = 0.6 + Math.random() * 0.3;
      mutations.push({ name: 'Chameleon', type: 'stealth', rarity: 'rare' });
    }

    // Telepathy - 0.3% chance (enhanced social bonding range)
    if (Math.random() < 0.003 * mutationRate) {
      genes.telepathy = true;
      genes.bondingRange = 300;
      mutations.push({ name: 'Telepathy', type: 'social', rarity: 'legendary' });
    }

    // Elemental Affinity - 0.5% chance
    if (Math.random() < 0.005 * mutationRate) {
      const elements = ['fire', 'ice', 'electric', 'earth'];
      genes.elementalAffinity = elements[Math.floor(Math.random() * elements.length)];
      mutations.push({ name: `${genes.elementalAffinity} Affinity`, type: 'elemental', rarity: 'legendary' });
    }

    // Super Senses - 2% chance
    if (Math.random() < 0.02 * mutationRate) {
      genes.superSenses = true;
      genes.sense = Math.min(300, (genes.sense ?? 100) * 1.8);
      mutations.push({ name: 'Super Senses', type: 'perception', rarity: 'uncommon' });
    }

    // Photosynthesis - 0.8% chance (herbivores only, gains energy from sunlight)
    if (!genes.predator && Math.random() < 0.008 * mutationRate) {
      genes.photosynthesis = true;
      genes.photosyntheticRate = 0.5 + Math.random() * 0.5;
      mutations.push({ name: 'Photosynthesis', type: 'energy', rarity: 'rare' });
    }

    // Venomous - 1.5% chance (predators only)
    if (genes.predator && Math.random() < 0.015 * mutationRate) {
      genes.venomous = true;
      genes.venomDamage = 1 + Math.random() * 2;
      mutations.push({ name: 'Venomous', type: 'combat', rarity: 'rare' });
    }

    // Armored - 1.2% chance (enhanced defense)
    if (Math.random() < 0.012 * mutationRate) {
      genes.armored = true;
      genes.armorStrength = 0.4 + Math.random() * 0.4;
      mutations.push({ name: 'Armored Shell', type: 'defense', rarity: 'rare' });
    }

    return mutations;
  }

  /**
   * Apply rare mutation effects during creature update
   */
  static applyMutationEffects(creature, world, dt) {
    const g = creature.genes;

    // Bioluminescence - creature glows
    if (g.bioluminescent && creature._glowPhase === undefined) {
      creature._glowPhase = Math.random() * Math.PI * 2;
    }
    if (g.bioluminescent) {
      creature._glowPhase += dt * 2;
      creature.glowIntensity = 0.5 + Math.sin(creature._glowPhase) * 0.3;
    }

    // Regeneration - heal over time
    if (g.regeneration && creature.health < creature.maxHealth) {
      creature.health = Math.min(creature.maxHealth, creature.health + g.regenRate * dt);
    }

    // Photosynthesis - gain energy in daylight
    if (g.photosynthesis && world.dayNightEnabled) {
      const hour = world.timeOfDay % 24;
      const isDaytime = hour >= 6 && hour < 20;
      if (isDaytime) {
        creature.energy += g.photosyntheticRate * dt;
      }
    }

    // Chameleon - reduced detection by predators
    if (g.chameleon) {
      creature.camouflageActive = creature.vx * creature.vx + creature.vy * creature.vy < 100; // Still = camouflaged
    }

    // Venomous - apply poison on attack
    if (g.venomous && creature.lastAttackTarget) {
      const target = creature.lastAttackTarget;
      if (target.alive && !target.poisoned) {
        target.poisoned = {
          damage: g.venomDamage,
          duration: 5 + Math.random() * 5,
          source: creature.id
        };
      }
      creature.lastAttackTarget = null;
    }

    // Armored - reduce incoming damage
    if (g.armored && creature.incomingDamage) {
      creature.incomingDamage *= (1 - g.armorStrength);
    }

    // Elemental effects
    if (g.elementalAffinity) {
      this.applyElementalEffects(creature, g.elementalAffinity, world, dt);
    }
  }

  /**
   * Apply elemental affinity effects
   */
  static applyElementalEffects(creature, element, world, dt) {
    switch (element) {
      case 'fire':
        // Fire creatures deal extra damage and are warm
        if (creature.combatStats) {
          creature.combatStats.damageMultiplier = 1.3;
        }
        creature.temperature = 'hot';
        break;

      case 'ice':
        // Ice creatures slow enemies and resist cold
        creature.slowAura = { radius: 50, strength: 0.3 };
        creature.coldResistance = 0.8;
        break;

      case 'electric':
        // Electric creatures have speed bursts
        if (Math.random() < 0.05 * dt) {
          creature.vx *= 1.5;
          creature.vy *= 1.5;
        }
        break;

      case 'earth':
        // Earth creatures have stability and defense
        creature.knockbackResistance = 0.7;
        if (creature.maxHealth) {
          creature.maxHealth *= 1.2;
        }
        break;
    }
  }

  /**
   * Genetic Chimera - extremely rare (0.1%) - combines traits from multiple species
   */
  static applyChimeraMutation(genes) {
    if (Math.random() > 0.001) return null;

    genes.chimera = true;
    genes.hybridTraits = {
      hasWings: Math.random() < 0.5,
      hasTail: Math.random() < 0.7,
      hasHorns: Math.random() < 0.4,
      multipleEyes: Math.random() < 0.3
    };

    return { name: 'Chimera', type: 'hybrid', rarity: 'mythic' };
  }

  /**
   * Get mutation rarity color
   */
  static getRarityColor(rarity) {
    const colors = {
      common: '#888888',
      uncommon: '#55ff55',
      rare: '#5555ff',
      legendary: '#ff55ff',
      mythic: '#ffaa00'
    };
    return colors[rarity] || colors.common;
  }

  /**
   * Draw mutation indicator
   */
  static drawMutationIndicator(ctx, creature, x, y) {
    const mutations = creature.rareMutations || [];
    if (mutations.length === 0) return;

    // Draw small star indicators above creature
    ctx.save();
    let offsetX = -mutations.length * 4;

    for (const mutation of mutations) {
      const color = this.getRarityColor(mutation.rarity);

      // Draw star
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const radius = i % 2 === 0 ? 3 : 1.5;
        const px = x + offsetX + Math.cos(angle) * radius;
        const py = y - 15 + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();

      offsetX += 8;
    }

    ctx.restore();
  }
}
