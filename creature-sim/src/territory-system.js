import { clamp } from './utils.js';

/**
 * Territory & Dominance System
 * Manages predator territories, dominance hierarchies, and conflicts
 */
export class TerritorySystem {
  constructor(world) {
    this.world = world;
    this.territories = new Map(); // predatorId -> territory object
    this.conflicts = []; // active conflicts for visualization
  }

  update(dt) {
    this._cleanupDeadTerritories();
    this._updateTerritories(dt);
    this._resolveConflicts(dt);
    this._updateRanks();
  }

  _cleanupDeadTerritories() {
    for (const [id, territory] of this.territories.entries()) {
      const owner = this.world.registry.get(id);
      if (!owner || !owner.alive || !owner.genes.predator) {
        this.territories.delete(id);
      }
    }
  }

  _updateTerritories(dt) {
    const predators = this.world.creatures.filter(c => c.genes.predator && c.alive);
    
    for (const predator of predators) {
      if (this.territories.has(predator.id)) {
        // Update existing territory
        const territory = this.territories.get(predator.id);
        territory.strength = this._calculateStrength(predator);
        territory.radius = 60 + (territory.strength * 40);
        territory.x = predator.x;
        territory.y = predator.y;
        territory.lastUpdate = this.world.t;
      } else if (predator.age > 10 && predator.stats.kills >= 1) {
        // Establish new territory (mature predator with at least 1 kill)
        const strength = this._calculateStrength(predator);
        this.territories.set(predator.id, {
          owner: predator.id,
          x: predator.x,
          y: predator.y,
          radius: 60 + (strength * 40),
          strength: strength,
          establishedAt: this.world.t,
          lastUpdate: this.world.t,
          dominanceRank: 0
        });
      }
    }
  }

  _calculateStrength(predator) {
    // Multi-factor strength calculation
    const geneScore = (predator.genes.aggression || 1) * 0.3 + 
                      (predator.genes.speed || 1) * 0.2 +
                      (predator.genes.metabolism || 1) * 0.1;
    const healthScore = (predator.health / predator.maxHealth) * 0.2;
    const killScore = Math.min(predator.stats.kills / 10, 1) * 0.2;
    const ageScore = Math.min(predator.age / 60, 1) * 0.1;
    
    return clamp(geneScore + healthScore + killScore + ageScore, 0.3, 2.5);
  }

  _resolveConflicts(dt) {
    this.conflicts = [];
    const territories = Array.from(this.territories.values());
    
    for (let i = 0; i < territories.length; i++) {
      for (let j = i + 1; j < territories.length; j++) {
        const t1 = territories[i];
        const t2 = territories[j];
        
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = t1.radius + t2.radius;
        
        // Territories overlap
        if (distSq < minDist * minDist) {
          const owner1 = this.world.registry.get(t1.owner);
          const owner2 = this.world.registry.get(t2.owner);
          
          if (owner1 && owner2 && owner1.alive && owner2.alive) {
            // Record conflict
            this.conflicts.push({
              x: (t1.x + t2.x) / 2,
              y: (t1.y + t2.y) / 2,
              predator1: t1.owner,
              predator2: t2.owner,
              intensity: 1 - Math.sqrt(distSq) / minDist
            });
            
            // Apply dominance effects
            if (t1.strength > t2.strength * 1.2) {
              this._applyDominance(owner2, owner1, dt);
            } else if (t2.strength > t1.strength * 1.2) {
              this._applyDominance(owner1, owner2, dt);
            }
          }
        }
      }
    }
  }

  _applyDominance(subordinate, dominant, dt) {
    // Subordinate loses energy from stress
    subordinate.energy -= 0.3 * dt;
    
    // Subordinate flees
    const dx = subordinate.x - dominant.x;
    const dy = subordinate.y - dominant.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.1) {
      const fleeAngle = Math.atan2(dy, dx);
      subordinate.dir = fleeAngle;
      subordinate.personality.huntCooldown = Math.max(subordinate.personality.huntCooldown, 3);
    }
    
    // Dominant gains confidence
    dominant.energy += 0.1 * dt;
  }

  _updateRanks() {
    const territories = Array.from(this.territories.values())
      .sort((a, b) => b.strength - a.strength);
    
    territories.forEach((territory, index) => {
      territory.dominanceRank = index + 1;
    });
  }

  getTerritory(predatorId) {
    return this.territories.get(predatorId) || null;
  }

  isInTerritory(x, y, excludeOwner = null) {
    for (const [ownerId, territory] of this.territories.entries()) {
      if (excludeOwner && ownerId === excludeOwner) continue;
      
      const dx = x - territory.x;
      const dy = y - territory.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < territory.radius * territory.radius) {
        return { ownerId, territory };
      }
    }
    return null;
  }

  getAllTerritories() {
    return Array.from(this.territories.values());
  }

  getConflicts() {
    return this.conflicts;
  }
}

