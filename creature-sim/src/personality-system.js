/**
 * Creature Personality System - Unique behavioral traits and quirks
 */

export class PersonalitySystem {
  /**
   * Generate a personality for a creature based on genetics and randomness
   */
  static generatePersonality(genes, parentPersonalities = []) {
    const personality = {
      // Core personality traits (0-1 scale)
      boldness: this.inheritTrait(parentPersonalities, 'boldness', 0.3, 0.2),
      curiosity: this.inheritTrait(parentPersonalities, 'curiosity', 0.5, 0.2),
      sociability: this.inheritTrait(parentPersonalities, 'sociability', 0.5, 0.2),
      aggression: this.inheritTrait(parentPersonalities, 'aggression', genes.predator ? 0.7 : 0.3, 0.2),
      playfulness: this.inheritTrait(parentPersonalities, 'playfulness', 0.4, 0.2),
      stubbornness: this.inheritTrait(parentPersonalities, 'stubbornness', 0.4, 0.15),
      loyalty: this.inheritTrait(parentPersonalities, 'loyalty', 0.5, 0.2),
      
      // Unique quirks (randomly assigned)
      quirks: this.generateQuirks(genes),
      
      // Favorite things
      favoriteFood: null, // Will be set when eating
      favoriteBiome: null, // Will be set when exploring
      
      // Preferences
      prefersDaytime: Math.random() > 0.5,
      prefersGroups: (genes.herdInstinct ?? 0.5) > 0.6,
      prefersExploring: this.inheritTrait(parentPersonalities, 'curiosity', 0.5, 0.2) > 0.6,
      
      // Emotional tendencies
      temperament: this.selectTemperament(genes),
      moodSwings: Math.random() < 0.2, // 20% chance of mood swings
      
      // Special traits
      isLeader: false,
      isFollower: false,
      isLoner: Math.random() < 0.15
    };
    
    return personality;
  }

  /**
   * Inherit a trait from parents with mutation
   */
  static inheritTrait(parentPersonalities, traitName, defaultValue, variance) {
    if (parentPersonalities.length === 0) {
      return Math.max(0, Math.min(1, defaultValue + (Math.random() - 0.5) * variance * 2));
    }
    
    // Average parents' traits with mutation
    const parentAvg = parentPersonalities.reduce((sum, p) => sum + (p[traitName] ?? defaultValue), 0) / parentPersonalities.length;
    const mutation = (Math.random() - 0.5) * variance * 2;
    
    return Math.max(0, Math.min(1, parentAvg + mutation));
  }

  /**
   * Generate unique quirks for a creature
   */
  static generateQuirks(genes) {
    const possibleQuirks = [
      { name: 'collector', description: 'Loves gathering food items', chance: 0.1 },
      { name: 'wanderer', description: 'Constantly explores new areas', chance: 0.12 },
      { name: 'guardian', description: 'Protects nearby creatures', chance: 0.08 },
      { name: 'showoff', description: 'Performs displays frequently', chance: 0.1 },
      { name: 'shy', description: 'Avoids social interactions', chance: 0.08 },
      { name: 'competitive', description: 'Challenges others often', chance: 0.1 },
      { name: 'lazy', description: 'Rests more than average', chance: 0.12 },
      { name: 'hyperactive', description: 'Always moving, rarely rests', chance: 0.08 },
      { name: 'foodie', description: 'Seeks out specific food types', chance: 0.1 },
      { name: 'cautious', description: 'Extremely alert to danger', chance: 0.1 },
      { name: 'brave', description: 'Confronts threats head-on', chance: 0.08 },
      { name: 'mentor', description: 'Stays near younger creatures', chance: 0.07 },
      { name: 'rebel', description: 'Ignores group behavior', chance: 0.08 },
      { name: 'optimist', description: 'Recovers from stress quickly', chance: 0.1 },
      { name: 'pessimist', description: 'Gets stressed easily', chance: 0.08 }
    ];
    
    const quirks = [];
    
    // Each creature gets 0-2 quirks
    const quirkCount = Math.random() < 0.7 ? 1 : Math.random() < 0.3 ? 2 : 0;
    
    for (let i = 0; i < quirkCount; i++) {
      const availableQuirks = possibleQuirks.filter(q => !quirks.find(eq => eq.name === q.name));
      const selectedQuirk = availableQuirks[Math.floor(Math.random() * availableQuirks.length)];
      
      if (selectedQuirk && Math.random() < selectedQuirk.chance) {
        quirks.push(selectedQuirk);
      }
    }
    
    return quirks;
  }

  /**
   * Select temperament based on genetics
   */
  static selectTemperament(genes) {
    const temperaments = ['calm', 'nervous', 'aggressive', 'playful', 'melancholic'];
    
    if (genes.predator) {
      return Math.random() < 0.6 ? 'aggressive' : 'calm';
    }
    
    const panicTrail = genes.panicTrail ?? 0.3;
    if (panicTrail > 0.7) return 'nervous';
    
    const herdInstinct = genes.herdInstinct ?? 0.5;
    if (herdInstinct > 0.7) return 'playful';
    
    return temperaments[Math.floor(Math.random() * temperaments.length)];
  }

  /**
   * Apply personality-based behavior modifications
   */
  static applyPersonalityBehavior(creature, world, dt) {
    const p = creature.personality;
    if (!p) return;
    
    // Boldness affects fear response
    if (p.boldness > 0.7 && creature.emotions) {
      creature.emotions.fear *= 0.8;
    }
    
    // Curiosity drives exploration
    if (p.curiosity > 0.7 && Math.random() < 0.01 * dt) {
      this.triggerExploration(creature, world);
    }
    
    // Sociability affects grouping behavior
    if (p.sociability > 0.7 && creature.needs) {
      creature.needs.socialDrive = Math.min(100, creature.needs.socialDrive + 0.5 * dt);
    }
    
    // Playfulness creates play behavior
    if (p.playfulness > 0.7 && creature.ageStage !== 'elder' && Math.random() < 0.005 * dt) {
      this.triggerPlayBehavior(creature);
    }
    
    // Apply quirk behaviors
    for (const quirk of p.quirks) {
      this.applyQuirkBehavior(creature, quirk, world, dt);
    }
    
    // Temperament effects
    this.applyTemperamentEffects(creature, p.temperament, dt);
  }

  /**
   * Trigger exploration behavior
   */
  static triggerExploration(creature, world) {
    // Pick a random distant point to explore
    const angle = Math.random() * Math.PI * 2;
    const distance = 200 + Math.random() * 300;
    
    creature.explorationTarget = {
      x: creature.x + Math.cos(angle) * distance,
      y: creature.y + Math.sin(angle) * distance,
      expires: Date.now() + 10000 // 10 seconds
    };
  }

  /**
   * Trigger play behavior
   */
  static triggerPlayBehavior(creature) {
    if (!creature.lifecycle) {
      creature.lifecycle = {};
    }
    
    creature.lifecycle.playTimer = 3 + Math.random() * 5; // Play for 3-8 seconds
    creature.setMood?.('🎮', 0.7);
  }

  /**
   * Apply quirk-specific behaviors
   */
  static applyQuirkBehavior(creature, quirk, world, dt) {
    switch (quirk.name) {
      case 'collector':
        // Seeks food even when not hungry
        if (creature.energy > 30 && Math.random() < 0.01 * dt) {
          creature.forceForage = true;
        }
        break;
        
      case 'wanderer':
        // Moves more, rests less
        creature.vx *= 1.05;
        creature.vy *= 1.05;
        break;
        
      case 'guardian':
        // Marks creature as protector
        creature.isProtecting = true;
        break;
        
      case 'lazy':
        // Moves slower, rests more
        creature.vx *= 0.9;
        creature.vy *= 0.9;
        break;
        
      case 'hyperactive':
        // Constant movement
        creature.vx *= 1.1;
        creature.vy *= 1.1;
        if (creature.lifecycle?.restTimer) {
          creature.lifecycle.restTimer *= 0.5;
        }
        break;
        
      case 'cautious':
        // Enhanced danger detection
        if (creature.genes.sense) {
          creature.effectiveSense = creature.genes.sense * 1.2;
        }
        break;
        
      case 'optimist':
        // Faster stress recovery
        if (creature.needs?.stress) {
          creature.needs.stress = Math.max(0, creature.needs.stress - 2 * dt);
        }
        break;
        
      case 'pessimist':
        // Slower stress recovery
        if (creature.needs?.stress) {
          creature.needs.stress = Math.min(100, creature.needs.stress + 0.5 * dt);
        }
        break;
    }
  }

  /**
   * Apply temperament effects
   */
  static applyTemperamentEffects(creature, temperament, dt) {
    switch (temperament) {
      case 'calm':
        if (creature.needs?.stress) {
          creature.needs.stress = Math.max(0, creature.needs.stress - 1 * dt);
        }
        break;
        
      case 'nervous':
        if (creature.emotions?.fear) {
          creature.emotions.fear = Math.min(1, creature.emotions.fear + 0.1 * dt);
        }
        break;
        
      case 'aggressive':
        if (creature.genes.predator && creature.needs?.hunger) {
          creature.needs.hunger = Math.min(100, creature.needs.hunger + 0.5 * dt);
        }
        break;
        
      case 'playful':
        if (creature.ageStage === 'juvenile' || creature.ageStage === 'baby') {
          creature.energy += 0.1 * dt; // Extra energy from playfulness
        }
        break;
        
      case 'melancholic':
        if (creature.needs?.socialDrive) {
          creature.needs.socialDrive = Math.max(0, creature.needs.socialDrive - 0.3 * dt);
        }
        break;
    }
  }

  /**
   * Get personality description for UI
   */
  static getPersonalityDescription(personality) {
    const traits = [];
    
    if (personality.boldness > 0.7) traits.push('Bold');
    if (personality.curiosity > 0.7) traits.push('Curious');
    if (personality.sociability > 0.7) traits.push('Social');
    if (personality.aggression > 0.7) traits.push('Aggressive');
    if (personality.playfulness > 0.7) traits.push('Playful');
    if (personality.loyalty > 0.7) traits.push('Loyal');
    
    const quirkNames = personality.quirks.map(q => q.name);
    
    return {
      traits,
      quirks: quirkNames,
      temperament: personality.temperament,
      description: `${personality.temperament} | ${traits.join(', ') || 'Balanced'}`
    };
  }
}
