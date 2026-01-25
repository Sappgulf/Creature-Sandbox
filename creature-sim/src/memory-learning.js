/**
 * Creature Memory & Learning System
 * Creatures remember locations, dangers, and learn from experience
 */

export class MemoryLearningSystem {
  constructor() {
    this.creatureMemories = new Map(); // creature ID -> memory data
  }

  /**
   * Initialize memory for a creature
   */
  initializeMemory(creature) {
    const memory = {
      creatureId: creature.id,
      
      // Location memories
      foodLocations: [], // {x, y, quality, lastSeen, visits}
      dangerZones: [], // {x, y, threat, lastEncounter}
      safeZones: [], // {x, y, safety, lastVisit}
      waterSources: [], // {x, y, quality}
      
      // Experience memories
      predatorEncounters: [], // {predatorId, outcome, timestamp}
      successfulHunts: 0,
      failedHunts: 0,
      timesEaten: 0,
      timesEscaped: 0,
      
      // Learning data
      learningRate: 0.1 + Math.random() * 0.2, // How fast they learn
      knowledgeLevel: 0, // 0-100 scale
      specializations: [], // Things creature is good at
      
      // Emotional memories
      traumaticEvents: [], // {type, severity, timestamp, recovered}
      happyEvents: [], // {type, joy, timestamp}
      
      // Social learning
      observedBehaviors: [], // {behavior, source, effectiveness}
      teachers: [], // Creatures learned from
      
      // Cognitive map
      exploredAreas: new Set(), // Grid cells visited
      pathMemory: [], // Recently traveled paths
      
      // Pattern recognition
      timePatterns: {
        bestFeedingTime: null,
        bestHidingTime: null,
        predatorActivityPeak: null
      },
      
      // Memory capacity
      maxMemories: 50 + Math.floor(creature.genes?.intelligence ?? 0) * 100,
      memoryDecayRate: 0.001 // Memories fade over time
    };
    
    this.creatureMemories.set(creature.id, memory);
    return memory;
  }

  /**
   * Remember a food location
   */
  rememberFood(creature, x, y, quality = 0.5) {
    const memory = this.getOrCreateMemory(creature);
    
    // Check if location already known
    const existing = memory.foodLocations.find(loc => 
      Math.abs(loc.x - x) < 20 && Math.abs(loc.y - y) < 20
    );
    
    if (existing) {
      existing.lastSeen = Date.now();
      existing.visits++;
      existing.quality = (existing.quality + quality) / 2;
    } else {
      memory.foodLocations.push({
        x, y,
        quality,
        lastSeen: Date.now(),
        visits: 1
      });
      
      // Limit memory capacity
      if (memory.foodLocations.length > memory.maxMemories) {
        memory.foodLocations.sort((a, b) => a.lastSeen - b.lastSeen);
        memory.foodLocations.shift(); // Remove oldest
      }
    }
    
    // Increase knowledge
    memory.knowledgeLevel = Math.min(100, memory.knowledgeLevel + 0.1);
  }

  /**
   * Remember a danger zone
   */
  rememberDanger(creature, x, y, threat = 0.8) {
    const memory = this.getOrCreateMemory(creature);
    
    const existing = memory.dangerZones.find(loc => 
      Math.abs(loc.x - x) < 30 && Math.abs(loc.y - y) < 30
    );
    
    if (existing) {
      existing.lastEncounter = Date.now();
      existing.threat = Math.max(existing.threat, threat);
    } else {
      memory.dangerZones.push({
        x, y,
        threat,
        lastEncounter: Date.now()
      });
    }
    
    // Add traumatic event
    if (threat > 0.7) {
      memory.traumaticEvents.push({
        type: 'predator_attack',
        severity: threat,
        timestamp: Date.now(),
        recovered: false
      });
    }
  }

  /**
   * Remember a safe zone
   */
  rememberSafeZone(creature, x, y, safety = 0.7) {
    const memory = this.getOrCreateMemory(creature);
    
    const existing = memory.safeZones.find(loc => 
      Math.abs(loc.x - x) < 30 && Math.abs(loc.y - y) < 30
    );
    
    if (existing) {
      existing.lastVisit = Date.now();
      existing.safety = Math.max(existing.safety, safety);
    } else {
      memory.safeZones.push({
        x, y,
        safety,
        lastVisit: Date.now()
      });
    }
  }

  /**
   * Record predator encounter
   */
  recordPredatorEncounter(creature, predator, escaped = false) {
    const memory = this.getOrCreateMemory(creature);
    
    memory.predatorEncounters.push({
      predatorId: predator.id,
      predatorType: predator.genes?.hue ?? 0,
      outcome: escaped ? 'escaped' : 'caught',
      timestamp: Date.now()
    });
    
    if (escaped) {
      memory.timesEscaped++;
      // Learn from escape
      memory.knowledgeLevel = Math.min(100, memory.knowledgeLevel + 2);
    } else {
      memory.timesEaten++;
    }
    
    // Remember danger at current location
    this.rememberDanger(creature, creature.x, creature.y, 0.9);
  }

  /**
   * Learn from hunting
   */
  learnFromHunt(creature, success = false) {
    const memory = this.getOrCreateMemory(creature);
    
    if (success) {
      memory.successfulHunts++;
      memory.knowledgeLevel = Math.min(100, memory.knowledgeLevel + 1);
      
      // Remember hunting location
      this.rememberFood(creature, creature.x, creature.y, 0.8);
      
      // Learn time pattern
      if (!memory.timePatterns.bestFeedingTime) {
        memory.timePatterns.bestFeedingTime = Date.now() % 86400000; // Time of day
      }
    } else {
      memory.failedHunts++;
    }
  }

  /**
   * Observe another creature's behavior
   */
  observeBehavior(creature, otherCreature, behavior, effectiveness = 0.5) {
    const memory = this.getOrCreateMemory(creature);
    
    // Young creatures and high-intelligence creatures learn better
    const isYoung = creature.age < 30;
    const intelligence = creature.genes?.intelligence ?? 0.5;
    const canLearn = isYoung || intelligence > 0.6;
    
    if (!canLearn) return;
    
    memory.observedBehaviors.push({
      behavior,
      source: otherCreature.id,
      effectiveness,
      observed: Date.now()
    });
    
    if (!memory.teachers.includes(otherCreature.id)) {
      memory.teachers.push(otherCreature.id);
    }
    
    // Social learning increases knowledge faster
    memory.knowledgeLevel = Math.min(100, memory.knowledgeLevel + 0.5 * memory.learningRate);
  }

  /**
   * Get best remembered food location
   */
  getBestFoodLocation(creature, currentX, currentY) {
    const memory = this.getMemory(creature.id);
    if (!memory || memory.foodLocations.length === 0) return null;
    
    // Filter out stale memories (>5 minutes old)
    const fresh = memory.foodLocations.filter(loc => 
      Date.now() - loc.lastSeen < 300000
    );
    
    if (fresh.length === 0) return null;
    
    // Find closest high-quality location
    let best = null;
    let bestScore = -Infinity;
    
    for (const loc of fresh) {
      const dx = loc.x - currentX;
      const dy = loc.y - currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Score based on quality and distance
      const score = loc.quality * 100 - dist * 0.5 + loc.visits * 2;
      
      if (score > bestScore) {
        bestScore = score;
        best = loc;
      }
    }
    
    return best;
  }

  /**
   * Check if location is dangerous
   */
  isDangerous(creature, x, y, threshold = 0.5) {
    const memory = this.getMemory(creature.id);
    if (!memory) return false;
    
    for (const danger of memory.dangerZones) {
      const dx = danger.x - x;
      const dy = danger.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 50 && danger.threat > threshold) {
        // Recent danger is more concerning
        const age = Date.now() - danger.lastEncounter;
        if (age < 60000) { // Within last minute
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Find nearest safe zone
   */
  getNearestSafeZone(creature, currentX, currentY) {
    const memory = this.getMemory(creature.id);
    if (!memory || memory.safeZones.length === 0) return null;
    
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const safe of memory.safeZones) {
      const dx = safe.x - currentX;
      const dy = safe.y - currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < nearestDist && safe.safety > 0.6) {
        nearestDist = dist;
        nearest = safe;
      }
    }
    
    return nearest;
  }

  /**
   * Apply memory-based behaviors
   */
  applyMemoryBehaviors(creature, world, dt) {
    const memory = this.getMemory(creature.id);
    if (!memory) return;
    
    // Avoid danger zones
    for (const danger of memory.dangerZones) {
      const dx = danger.x - creature.x;
      const dy = danger.y - creature.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < 80 * 80) {
        // Push away from danger
        const strength = danger.threat * 2 * dt;
        creature.vx -= (dx / Math.sqrt(distSq)) * strength;
        creature.vy -= (dy / Math.sqrt(distSq)) * strength;
      }
    }
    
    // Seek remembered food when hungry
    if (creature.energy < 25 && Math.random() < 0.1) {
      const foodLoc = this.getBestFoodLocation(creature, creature.x, creature.y);
      if (foodLoc) {
        creature.rememberedFoodTarget = foodLoc;
      }
    }
    
    // Flee to safe zone when threatened
    if (creature.emotions?.fear > 0.7) {
      const safeZone = this.getNearestSafeZone(creature, creature.x, creature.y);
      if (safeZone) {
        creature.fleeTarget = safeZone;
      }
    }
    
    // Decay memories over time
    this.decayMemories(memory, dt);
    
    // Recover from trauma
    this.recoverFromTrauma(memory, dt);
  }

  /**
   * Decay old memories
   */
  decayMemories(memory, dt) {
    const now = Date.now();
    const decayThreshold = 600000; // 10 minutes
    
    // Decay food locations
    memory.foodLocations = memory.foodLocations.filter(loc => 
      now - loc.lastSeen < decayThreshold
    );
    
    // Decay danger zones (fear fades)
    for (const danger of memory.dangerZones) {
      danger.threat *= (1 - memory.memoryDecayRate * dt);
    }
    memory.dangerZones = memory.dangerZones.filter(d => d.threat > 0.1);
  }

  /**
   * Recover from traumatic events
   */
  recoverFromTrauma(memory, dt) {
    for (const trauma of memory.traumaticEvents) {
      if (trauma.recovered) continue;
      
      const age = Date.now() - trauma.timestamp;
      const recoveryTime = 120000; // 2 minutes
      
      if (age > recoveryTime) {
        trauma.recovered = true;
        memory.knowledgeLevel = Math.min(100, memory.knowledgeLevel + 0.5);
      }
    }
  }

  /**
   * Get or create memory for creature
   */
  getOrCreateMemory(creature) {
    let memory = this.creatureMemories.get(creature.id);
    if (!memory) {
      memory = this.initializeMemory(creature);
    }
    return memory;
  }

  /**
   * Get memory for creature ID
   */
  getMemory(creatureId) {
    return this.creatureMemories.get(creatureId);
  }

  /**
   * Get memory stats for UI
   */
  getMemoryStats(creatureId) {
    const memory = this.getMemory(creatureId);
    if (!memory) return null;
    
    return {
      knowledge: Math.floor(memory.knowledgeLevel),
      foodLocations: memory.foodLocations.length,
      dangerZones: memory.dangerZones.length,
      safeZones: memory.safeZones.length,
      huntSuccess: memory.successfulHunts / Math.max(1, memory.successfulHunts + memory.failedHunts),
      escapeRate: memory.timesEscaped / Math.max(1, memory.timesEscaped + memory.timesEaten),
      teachers: memory.teachers.length,
      trauma: memory.traumaticEvents.filter(t => !t.recovered).length
    };
  }

  /**
   * Clean up memories for dead creatures
   */
  cleanup(world) {
    const aliveIds = new Set(world.creatures.map(c => c.id));
    
    for (const id of this.creatureMemories.keys()) {
      if (!aliveIds.has(id)) {
        this.creatureMemories.delete(id);
      }
    }
  }
}

export const memoryLearningSystem = new MemoryLearningSystem();
