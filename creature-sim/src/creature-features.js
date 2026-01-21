// Additional creature methods for new features
// These extend the Creature class functionality

import { Creature } from './creature.js';
import { clamp, rand } from './utils.js';

// ============================================================================
// FEATURE 2: LEARNING & MEMORY
// ============================================================================

Creature.prototype._updateMemory = function(dt, world) {
  // Decay existing memories
  for (let i = this.memory.locations.length - 1; i >= 0; i--) {
    const mem = this.memory.locations[i];
    mem.strength -= this.memory.decayRate * dt;
    if (mem.strength <= 0) {
      this.memory.locations.splice(i, 1);
    }
  }
};

Creature.prototype.rememberLocation = function(x, y, type, strength, worldTime) {
  // Add or update memory
  const existing = this.memory.locations.find(m =>
    Math.abs(m.x - x) < 30 && Math.abs(m.y - y) < 30 && m.type === type
  );

  if (existing) {
    existing.strength = Math.min(1, existing.strength + strength);
    existing.timestamp = worldTime;
  } else if (this.memory.locations.length < this.memory.capacity) {
    this.memory.locations.push({ x, y, type, strength, timestamp: worldTime });
  } else {
    // Replace weakest memory
    this.memory.locations.sort((a, b) => a.strength - b.strength);
    this.memory.locations[0] = { x, y, type, strength, timestamp: worldTime };
  }
};

Creature.prototype.recallMemories = function(type) {
  return this.memory.locations
    .filter(m => m.type === type)
    .sort((a, b) => b.strength - a.strength);
};

// ============================================================================
// FEATURE 4: ADVANCED SOCIAL BEHAVIORS
// ============================================================================

Creature.prototype._updateSocialBehavior = function(world) {
  const socialRadius = this.genes.sense * 1.2;
  const nearby = world.queryCreatures(this.x, this.y, socialRadius);

  // Update herd mates (herbivores only)
  if (!this.genes.predator) {
    this.social.herdMates = nearby.filter(c =>
      c.id !== this.id &&
      !c.genes.predator &&
      c.alive
    );

    // Apply herding buff if in group
    if (this.social.herdMates.length >= 2) {
      const herdSize = Math.min(this.social.herdMates.length, 8);
      const buffStrength = (herdSize / 8) * (this.genes.herdInstinct ?? 0.5) * 0.3;
      this.applyStatus('herd-buff', { duration: 0.5, intensity: buffStrength });
    }
  }

  // Update pack coordination (predators only)
  if (this.genes.predator && this.personality.packInstinct > 0.3) {
    const packMates = nearby.filter(c =>
      c.id !== this.id &&
      c.genes.predator &&
      c.alive &&
      c.personality.packInstinct > 0.3
    );

    // Share target with pack
    if (packMates.length > 0 && this.target && this.target.creatureId) {
      for (const mate of packMates) {
        if (!mate.target || !mate.target.creatureId) {
          mate.social.packTarget = this.target.creatureId;
        }
      }
    }

    // Adopt pack target if have none
    if (!this.target && this.social.packTarget) {
      const sharedTarget = world.getAnyCreatureById(this.social.packTarget);
      if (sharedTarget && sharedTarget.alive && !sharedTarget.genes.predator) {
        this.target = { x: sharedTarget.x, y: sharedTarget.y, creatureId: sharedTarget.id };
      } else {
        this.social.packTarget = null;
      }
    }
  }
};

// ============================================================================
// FEATURE 9: MIGRATION PATTERNS
// ============================================================================

Creature.prototype._updateMigration = function(world, dt) {
  // Only migrate if have migration instinct
  if (this.migration.instinct < 0.3) return;

  // Check if it's time to consider migration
  const timeSinceLastMigration = world.t - this.migration.lastMigration;
  if (timeSinceLastMigration < 60) return; // wait at least 60s between migrations

  // Determine current biome
  const currentBiomeIdx = world.getBiomeIndexAt(this.x, this.y);
  if (currentBiomeIdx === -1) return;

  // Check if should migrate (based on food scarcity in current biome)
  const localFood = world.nearbyFood(this.x, this.y, this.genes.sense * 2).length;
  const foodScarcity = localFood < 3;

  // Migration chance increases with scarcity and instinct
  const migrationChance = foodScarcity ? this.migration.instinct * 0.01 : this.migration.instinct * 0.001;

  if (Math.random() < migrationChance) {
    // Pick target biome (prefer different from current, 0-5 = 6 biome types)
    const targetIdx = (currentBiomeIdx + 1 + Math.floor(Math.random() * 2)) % 6;

    // Set migration target to a random location in the world
    // Since Perlin noise biomes are organic, we pick a random spot and hope it's the target biome type
    this.migration.targetBiome = targetIdx;
    this.migration.lastMigration = world.t;
    this.migration.settled = false;

    // Override current target with migration destination (random location)
    this.target = {
      x: rand(world.width * 0.2, world.width * 0.8),
      y: rand(world.height * 0.2, world.height * 0.8),
      migration: true
    };
  }

  // Check if reached migration target (moved to target biome type)
  if (this.migration.targetBiome !== null && !this.migration.settled) {
    const currentBiome = world.getBiomeIndexAt(this.x, this.y);
    if (currentBiome === this.migration.targetBiome) {
      this.migration.settled = true;
      if (this.target && this.target.migration) {
        this.target = null; // Clear migration target
      }
    }
  }
};

// ============================================================================
// FEATURE 5: EMOTIONAL STATES & MOODS
// ============================================================================

Creature.prototype._updateEmotions = function(dt, world) {
  const em = this.emotions;

  // Update hunger based on energy
  em.hunger = clamp(1 - (this.energy / 30), 0, 1);

  // Fear increases near predators (herbivores only)
  if (!this.genes.predator) {
    const nearbyPredators = world.queryCreatures(this.x, this.y, this.genes.sense * 1.5)
      .filter(c => c.genes.predator && c.alive);
    em.fear = Math.min(1, em.fear + nearbyPredators.length * 0.1);
  } else {
    // Predators feel fear when wounded
    const healthRatio = this.health / this.maxHealth;
    em.fear = healthRatio < 0.3 ? (1 - healthRatio) * 0.5 : em.fear * 0.95;
  }

  // Stress accumulates from fear and hunger
  em.stress = clamp(em.stress + (em.fear * 0.01 + em.hunger * 0.01) * dt, 0, 1);

  // Contentment reduces stress
  if (this.energy > 25 && this.health > this.maxHealth * 0.7) {
    em.contentment = Math.min(1, em.contentment + 0.05 * dt);
    em.stress = Math.max(0, em.stress - em.contentment * 0.03 * dt);
  } else {
    em.contentment = Math.max(0, em.contentment - 0.02 * dt);
  }

  // Curiosity drives exploration (decreases with stress)
  em.curiosity = clamp(this.genes.sense / 150 - em.stress * 0.5, 0, 1);

  // Decay fear over time
  em.fear = Math.max(0, em.fear - 0.05 * dt);
};

Creature.prototype.getEmotionalMultiplier = function(action) {
  const em = this.emotions;

  switch(action) {
    case 'speed':
      return 1 + em.fear * 0.3 - em.stress * 0.2;
    case 'aggression':
      return 1 + em.confidence * 0.4 - em.fear * 0.3;
    case 'risk':
      return em.confidence - em.fear;
    case 'exploration':
      return em.curiosity;
    default:
      return 1;
  }
};

// ============================================================================
// FEATURE 6: SENSORY SPECIALIZATIONS
// ============================================================================

Creature.prototype.getEnhancedSenseRadius = function() {
  const base = this.genes.sense;

  switch(this.senseType) {
    case 'echolocation':
      return base * 1.5;
    case 'chemical':
      return base * 1.2;
    case 'thermal':
      return base * 1.3;
    case 'normal':
    default:
      return base;
  }
};

Creature.prototype.canDetectThroughObstacles = function() {
  return this.senseType === 'thermal' || this.senseType === 'echolocation';
};

Creature.prototype.getPheromoneBonus = function() {
  return this.senseType === 'chemical' ? 2.0 : 1.0;
};

// ============================================================================
// FEATURE 7: PROBLEM SOLVING & INTELLIGENCE
// ============================================================================

Creature.prototype._updateIntelligence = function(dt, world) {
  const intel = this.intelligence;

  // Gain experience from successful actions
  if (this.stats.food > intel.experiencePoints / 10) {
    intel.experiencePoints += 1;
  }

  // Learn patterns from repeated success
  if (this.stats.food > 0 && this.stats.food % 5 === 0) {
    const pattern = {
      type: 'food_location',
      x: Math.floor(this.x / 50) * 50,
      y: Math.floor(this.y / 50) * 50,
      success: 1
    };

    const existing = intel.patterns.find(p =>
      p.type === pattern.type &&
      Math.abs(p.x - pattern.x) < 50 &&
      Math.abs(p.y - pattern.y) < 50
    );

    if (existing) {
      existing.success += 1;
    } else if (intel.patterns.length < 10) {
      intel.patterns.push(pattern);
    }
  }

  intel.level = Math.min(2, intel.level + intel.learningRate * dt * 0.001);
};

Creature.prototype.getBestKnownFoodLocation = function() {
  if (this.intelligence.patterns.length === 0) return null;

  const foodPatterns = this.intelligence.patterns
    .filter(p => p.type === 'food_location')
    .sort((a, b) => b.success - a.success);

  return foodPatterns.length > 0 ? foodPatterns[0] : null;
};

Creature.prototype.getIntelligenceBonus = function() {
  return 1 + this.intelligence.level * 0.15;
};

// ============================================================================
// FEATURE 8: SEXUAL SELECTION & MATING
// ============================================================================

Creature.prototype.evaluateMate = function(partner) {
  if (!partner || !partner.alive) return 0;
  if (partner.genes.predator !== this.genes.predator) return 0;
  if (partner.id === this.id) return 0;

  const traits = this.sexuality.desiredTraits;
  let score = 0;

  if (traits.speed && partner.genes.speed > 1.2) score += 0.3;
  if (traits.sense && partner.genes.sense > 100) score += 0.3;
  if (traits.health && partner.health / partner.maxHealth > 0.7) score += 0.2;

  score += partner.sexuality.attractiveness * 0.5;

  const ageScore = partner.age > 15 && partner.age < 150 ? 0.2 : 0;
  score += ageScore;

  return clamp(score, 0, 1);
};

Creature.prototype.shouldAcceptMate = function(partner, worldTime) {
  const timeSinceLastMate = worldTime - this.sexuality.lastMated;
  if (timeSinceLastMate < 30) return false;

  const mateScore = this.evaluateMate(partner);
  return mateScore >= this.sexuality.choosiness;
};

Creature.prototype.performCourtship = function() {
  return {
    style: this.sexuality.courtshipStyle,
    duration: 1.0,
    active: true
  };
};
