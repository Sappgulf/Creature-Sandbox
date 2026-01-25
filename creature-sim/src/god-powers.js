/**
 * God Powers System - Player interaction tools and powers
 */

export class GodPowersSystem {
  constructor() {
    this.activePowers = new Map();
    this.powerCooldowns = new Map();
    this.selectedCreatures = new Set();
    this.brushSize = 50;
    this.powerLevel = 1; // Unlocks more powerful abilities
  }

  /**
   * Define available god powers
   */
  getPowers() {
    return {
      // Basic Powers (Level 1)
      bless: {
        name: 'Divine Blessing',
        description: 'Restore health and energy to creatures',
        cost: 10,
        cooldown: 5000,
        level: 1,
        icon: '✨'
      },
      curse: {
        name: 'Curse',
        description: 'Weaken creatures temporarily',
        cost: 15,
        cooldown: 8000,
        level: 1,
        icon: '💀'
      },
      attract: {
        name: 'Attraction',
        description: 'Draw creatures to a location',
        cost: 5,
        cooldown: 3000,
        level: 1,
        icon: '🧲'
      },
      repel: {
        name: 'Repulsion',
        description: 'Push creatures away from a location',
        cost: 5,
        cooldown: 3000,
        level: 1,
        icon: '💨'
      },
      
      // Advanced Powers (Level 2)
      lightning: {
        name: 'Lightning Strike',
        description: 'Instant kill on impact, creates fear',
        cost: 30,
        cooldown: 15000,
        level: 2,
        icon: '⚡'
      },
      growth: {
        name: 'Rapid Growth',
        description: 'Age creatures to adulthood instantly',
        cost: 20,
        cooldown: 10000,
        level: 2,
        icon: '🌱'
      },
      meteor: {
        name: 'Meteor Strike',
        description: 'Area damage and environmental effect',
        cost: 50,
        cooldown: 30000,
        level: 2,
        icon: '☄️'
      },
      fertility: {
        name: 'Fertility Blessing',
        description: 'Increase birth rates in an area',
        cost: 25,
        cooldown: 12000,
        level: 2,
        icon: '💑'
      },
      
      // Master Powers (Level 3)
      timeWarp: {
        name: 'Time Warp',
        description: 'Speed up or slow down time in an area',
        cost: 40,
        cooldown: 20000,
        level: 3,
        icon: '⏰'
      },
      evolution: {
        name: 'Forced Evolution',
        description: 'Trigger beneficial mutations',
        cost: 35,
        cooldown: 18000,
        level: 3,
        icon: '🧬'
      },
      resurrection: {
        name: 'Resurrection',
        description: 'Bring recently dead creatures back to life',
        cost: 60,
        cooldown: 40000,
        level: 3,
        icon: '👼'
      },
      teleport: {
        name: 'Divine Teleport',
        description: 'Instantly move creatures to a location',
        cost: 20,
        cooldown: 8000,
        level: 3,
        icon: '🌀'
      },
      
      // Ultimate Powers (Level 4)
      apocalypse: {
        name: 'Apocalypse',
        description: 'Mass extinction event',
        cost: 100,
        cooldown: 60000,
        level: 4,
        icon: '💥'
      },
      genesis: {
        name: 'Genesis',
        description: 'Create new life forms with custom traits',
        cost: 80,
        cooldown: 45000,
        level: 4,
        icon: '🌟'
      },
      ascension: {
        name: 'Ascension',
        description: 'Transform creatures into legendary forms',
        cost: 70,
        cooldown: 35000,
        level: 4,
        icon: '👑'
      }
    };
  }

  /**
   * Use a god power
   */
  usePower(powerName, x, y, world, radius = null) {
    const powers = this.getPowers();
    const power = powers[powerName];
    
    if (!power) {
      console.warn(`Unknown power: ${powerName}`);
      return false;
    }
    
    // Check level requirement
    if (power.level > this.powerLevel) {
      console.warn(`Power ${powerName} requires level ${power.level}`);
      return false;
    }
    
    // Check cooldown
    const lastUse = this.powerCooldowns.get(powerName) || 0;
    if (Date.now() - lastUse < power.cooldown) {
      console.warn(`Power ${powerName} on cooldown`);
      return false;
    }
    
    // Apply power effect
    const actualRadius = radius || this.brushSize;
    this.applyPowerEffect(powerName, power, x, y, world, actualRadius);
    
    // Set cooldown
    this.powerCooldowns.set(powerName, Date.now());
    
    console.log(`${power.icon} Used power: ${power.name}`);
    return true;
  }

  /**
   * Apply power effect
   */
  applyPowerEffect(powerName, power, x, y, world, radius) {
    switch (powerName) {
      case 'bless':
        this.applyBless(x, y, world, radius);
        break;
      case 'curse':
        this.applyCurse(x, y, world, radius);
        break;
      case 'attract':
        this.applyAttraction(x, y, world, radius, 5);
        break;
      case 'repel':
        this.applyRepulsion(x, y, world, radius, 5);
        break;
      case 'lightning':
        this.applyLightning(x, y, world, radius);
        break;
      case 'growth':
        this.applyGrowth(x, y, world, radius);
        break;
      case 'meteor':
        this.applyMeteor(x, y, world, radius);
        break;
      case 'fertility':
        this.applyFertility(x, y, world, radius, 10);
        break;
      case 'timeWarp':
        this.applyTimeWarp(x, y, world, radius, 10);
        break;
      case 'evolution':
        this.applyEvolution(x, y, world, radius);
        break;
      case 'resurrection':
        this.applyResurrection(x, y, world, radius);
        break;
      case 'teleport':
        this.applyTeleport(x, y, world, radius);
        break;
      case 'apocalypse':
        this.applyApocalypse(x, y, world, radius * 2);
        break;
      case 'genesis':
        this.applyGenesis(x, y, world);
        break;
      case 'ascension':
        this.applyAscension(x, y, world, radius);
        break;
    }
  }

  /**
   * Bless - heal and energize
   */
  applyBless(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      creature.health = creature.maxHealth;
      creature.energy = Math.min(50, creature.energy + 20);
      
      // Add blessing buff
      creature.blessed = {
        duration: 10,
        healthRegen: 0.5,
        energyBonus: 1.2
      };
      
      // Visual effect
      if (world.visualEffects) {
        world.visualEffects.createEvolutionEffect(creature.x, creature.y, creature.genes?.hue ?? 120);
      }
    }
  }

  /**
   * Curse - weaken creatures
   */
  applyCurse(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      creature.cursed = {
        duration: 8,
        speedPenalty: 0.7,
        energyDrain: 1.5
      };
      
      creature.energy *= 0.7;
    }
  }

  /**
   * Attraction - pull creatures
   */
  applyAttraction(x, y, world, radius, duration) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      creature.attracted = {
        targetX: x,
        targetY: y,
        duration,
        strength: 5
      };
    }
  }

  /**
   * Repulsion - push creatures away
   */
  applyRepulsion(x, y, world, radius, duration) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      const angle = Math.atan2(creature.y - y, creature.x - x);
      const force = 200;
      
      creature.vx += Math.cos(angle) * force;
      creature.vy += Math.sin(angle) * force;
    }
  }

  /**
   * Lightning - instant kill
   */
  applyLightning(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      creature.alive = false;
      creature.health = 0;
      
      // Create fear in nearby creatures
      const nearbyCreatures = this.getCreaturesInRadius(x, y, world, radius * 2);
      for (const nearby of nearbyCreatures) {
        if (nearby.alive && nearby.emotions) {
          nearby.emotions.fear = 1;
        }
      }
    }
    
    // Visual effect
    if (world.visualEffects) {
      world.visualEffects.effects.push({
        type: 'lightning',
        x, y,
        duration: 0.5,
        branches: this.generateLightningBranches(x, y, 5)
      });
    }
  }

  /**
   * Growth - age to adult
   */
  applyGrowth(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      if (creature.ageStage === 'baby' || creature.ageStage === 'juvenile') {
        creature.ageStage = 'adult';
        creature.age = 60; // Skip to adult
        creature.size = creature.baseSize || 6;
      }
    }
  }

  /**
   * Meteor - area damage
   */
  applyMeteor(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      const dist = Math.sqrt((creature.x - x) ** 2 + (creature.y - y) ** 2);
      const damage = (1 - dist / radius) * 30;
      
      creature.health = Math.max(0, creature.health - damage);
      if (creature.health <= 0) {
        creature.alive = false;
      }
    }
    
    // Create crater
    if (world.craters) {
      world.craters.push({ x, y, radius, age: 0 });
    }
  }

  /**
   * Fertility - boost breeding
   */
  applyFertility(x, y, world, radius, duration) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      creature.fertile = {
        duration,
        breedingBonus: 2,
        mateCooldownReduction: 0.5
      };
    }
  }

  /**
   * Time Warp - speed up time
   */
  applyTimeWarp(x, y, world, radius, duration) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      creature.timeWarped = {
        duration,
        timeMultiplier: 2
      };
    }
  }

  /**
   * Evolution - beneficial mutations
   */
  applyEvolution(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      // Boost random trait
      const traits = ['speed', 'sense', 'size'];
      const trait = traits[Math.floor(Math.random() * traits.length)];
      
      if (creature.genes[trait]) {
        creature.genes[trait] *= 1.2;
      }
      
      // Chance for rare mutation
      if (Math.random() < 0.3 && world.advancedGenetics) {
        const mutations = world.advancedGenetics.applyRareMutations(creature.genes, 5);
        creature.rareMutations = mutations;
      }
    }
  }

  /**
   * Resurrection - revive dead
   */
  applyResurrection(x, y, world, radius) {
    if (!world.recentlyDead) return;
    
    for (const deadCreature of world.recentlyDead) {
      const dist = Math.sqrt((deadCreature.x - x) ** 2 + (deadCreature.y - y) ** 2);
      
      if (dist < radius) {
        deadCreature.alive = true;
        deadCreature.health = deadCreature.maxHealth * 0.5;
        deadCreature.energy = 20;
        world.creatures.push(deadCreature);
      }
    }
  }

  /**
   * Teleport - move creatures
   */
  applyTeleport(x, y, world, radius) {
    for (const creature of this.selectedCreatures) {
      creature.x = x + (Math.random() - 0.5) * radius;
      creature.y = y + (Math.random() - 0.5) * radius;
    }
  }

  /**
   * Apocalypse - mass death
   */
  applyApocalypse(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      if (Math.random() < 0.8) { // 80% death rate
        creature.alive = false;
        creature.health = 0;
      }
    }
  }

  /**
   * Genesis - create custom creature
   */
  applyGenesis(x, y, world) {
    // Create a powerful custom creature
    const genes = world.makeGenes ? world.makeGenes() : {};
    
    // Boost all traits
    genes.speed = 1.5;
    genes.sense = 200;
    genes.size = 10;
    genes.metabolism = 0.8;
    
    if (world.Creature) {
      const creature = new world.Creature(x, y, genes);
      world.addCreature(creature);
    }
  }

  /**
   * Ascension - legendary transformation
   */
  applyAscension(x, y, world, radius) {
    const affected = this.getCreaturesInRadius(x, y, world, radius);
    
    for (const creature of affected) {
      // Grant legendary status
      creature.ascended = true;
      creature.genes.speed *= 1.5;
      creature.genes.sense *= 1.5;
      creature.size *= 1.3;
      creature.maxHealth *= 2;
      creature.health = creature.maxHealth;
      
      // Add visual aura
      creature.aura = {
        color: '#ffaa00',
        intensity: 0.8
      };
    }
  }

  /**
   * Get creatures in radius
   */
  getCreaturesInRadius(x, y, world, radius) {
    return world.creatures.filter(c => {
      if (!c.alive) return false;
      const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
      return dist <= radius;
    });
  }

  /**
   * Generate lightning branches
   */
  generateLightningBranches(x, y, branches) {
    const result = [];
    
    for (let i = 0; i < branches; i++) {
      const angle = (i / branches) * Math.PI * 2;
      const length = 50 + Math.random() * 50;
      
      result.push({
        startX: x,
        startY: y,
        endX: x + Math.cos(angle) * length,
        endY: y + Math.sin(angle) * length
      });
    }
    
    return result;
  }

  /**
   * Check if power is available
   */
  isPowerAvailable(powerName) {
    const powers = this.getPowers();
    const power = powers[powerName];
    
    if (!power) return false;
    if (power.level > this.powerLevel) return false;
    
    const lastUse = this.powerCooldowns.get(powerName) || 0;
    return Date.now() - lastUse >= power.cooldown;
  }

  /**
   * Get cooldown remaining
   */
  getCooldownRemaining(powerName) {
    const powers = this.getPowers();
    const power = powers[powerName];
    
    if (!power) return 0;
    
    const lastUse = this.powerCooldowns.get(powerName) || 0;
    const remaining = power.cooldown - (Date.now() - lastUse);
    
    return Math.max(0, remaining);
  }
}

export const godPowers = new GodPowersSystem();
