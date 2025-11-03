// Additional creature methods for new features
// These extend the Creature class functionality

import { Creature } from './creature.js';

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
      this.effects.herdBuff = 0.5; // duration
      this.effects.herdIntensity = buffStrength;
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
    // Pick target biome (prefer different from current)
    const targetIdx = (currentBiomeIdx + 1 + Math.floor(Math.random() * 2)) % world.biomes.length;
    const targetBiome = world.biomes[targetIdx];
    
    // Set migration target to center of target biome
    this.migration.targetBiome = targetIdx;
    this.migration.lastMigration = world.t;
    this.migration.settled = false;
    
    // Override current target with migration destination
    const targetY = (targetBiome.y1 + targetBiome.y2) / 2;
    this.target = { 
      x: this.x + (Math.random() - 0.5) * world.width * 0.3, 
      y: targetY,
      migration: true
    };
  }
  
  // Check if reached migration target
  if (this.migration.targetBiome !== null && !this.migration.settled) {
    const targetBiome = world.biomes[this.migration.targetBiome];
    if (this.y >= targetBiome.y1 && this.y <= targetBiome.y2) {
      this.migration.settled = true;
      if (this.target && this.target.migration) {
        this.target = null; // Clear migration target
      }
    }
  }
};

