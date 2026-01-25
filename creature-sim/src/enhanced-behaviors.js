/**
 * Enhanced Creature Behaviors - Schooling, pack hunting, and advanced tactics
 */

import { dist2, clamp } from './utils.js';

export class EnhancedBehaviors {
  /**
   * Schooling behavior - herbivores move together in coordinated groups
   */
  static applySchooling(creature, nearbyCreatures, dt) {
    if (!creature.genes || creature.genes.predator) return;
    
    const schoolingRadius = 80;
    const alignmentStrength = 0.3;
    const cohesionStrength = 0.2;
    const separationStrength = 0.4;
    const separationRadius = 25;
    
    let alignVx = 0, alignVy = 0;
    let cohesionX = 0, cohesionY = 0;
    let separateVx = 0, separateVy = 0;
    let schoolCount = 0;
    let separateCount = 0;
    
    for (const other of nearbyCreatures) {
      if (other === creature || !other.alive || other.genes.predator) continue;
      
      const dx = other.x - creature.x;
      const dy = other.y - creature.y;
      const distSq = dx * dx + dy * dy;
      
      // Separation - avoid crowding
      if (distSq < separationRadius * separationRadius && distSq > 0) {
        const dist = Math.sqrt(distSq);
        separateVx -= dx / dist;
        separateVy -= dy / dist;
        separateCount++;
      }
      
      // Alignment and cohesion - match velocity and position with school
      if (distSq < schoolingRadius * schoolingRadius) {
        alignVx += other.vx;
        alignVy += other.vy;
        cohesionX += other.x;
        cohesionY += other.y;
        schoolCount++;
      }
    }
    
    if (schoolCount > 0) {
      // Apply alignment
      alignVx /= schoolCount;
      alignVy /= schoolCount;
      creature.vx += (alignVx - creature.vx) * alignmentStrength * dt;
      creature.vy += (alignVy - creature.vy) * alignmentStrength * dt;
      
      // Apply cohesion
      cohesionX /= schoolCount;
      cohesionY /= schoolCount;
      const dx = cohesionX - creature.x;
      const dy = cohesionY - creature.y;
      creature.vx += dx * cohesionStrength * dt;
      creature.vy += dy * cohesionStrength * dt;
    }
    
    if (separateCount > 0) {
      // Apply separation
      separateVx /= separateCount;
      separateVy /= separateCount;
      creature.vx += separateVx * separationStrength * dt;
      creature.vy += separateVy * separationStrength * dt;
    }
  }

  /**
   * Pack hunting - predators coordinate attacks
   */
  static applyPackHunting(predator, nearbyPredators, prey, dt) {
    if (!predator.genes || !predator.genes.predator || !prey) return null;
    
    const packRadius = 150;
    const packInstinct = predator.genes.packInstinct ?? 0.5;
    
    if (packInstinct < 0.3) return null; // Solitary hunter
    
    // Find pack members targeting same prey
    const packMembers = nearbyPredators.filter(other => 
      other !== predator &&
      other.alive &&
      other.genes.predator &&
      other.target === prey &&
      dist2(other.x, other.y, predator.x, predator.y) < packRadius * packRadius
    );
    
    if (packMembers.length === 0) return null;
    
    // Calculate flanking positions
    const preyAngle = Math.atan2(prey.y - predator.y, prey.x - predator.x);
    const flankAngle = Math.PI / 3; // 60 degrees
    
    // Predator takes a flanking position
    const flankSide = predator.id % 2 === 0 ? 1 : -1;
    const targetAngle = preyAngle + (flankAngle * flankSide);
    const flankDistance = 40;
    
    return {
      x: prey.x - Math.cos(targetAngle) * flankDistance,
      y: prey.y - Math.sin(targetAngle) * flankDistance,
      isPack: true,
      packSize: packMembers.length + 1
    };
  }

  /**
   * Ambush behavior - predators with high ambush delay wait in hiding
   */
  static applyAmbush(predator, prey, world) {
    const ambushDelay = predator.genes.ambushDelay ?? 0.5;
    
    if (ambushDelay < 0.6) return false; // Not an ambush predator
    
    // Initialize ambush state if not present
    if (!predator.ambushState) {
      predator.ambushState = {
        isWaiting: false,
        waitTime: 0,
        hideSpot: null
      };
    }
    
    const state = predator.ambushState;
    
    // If no prey nearby, enter wait mode
    if (!prey) {
      if (!state.isWaiting) {
        state.isWaiting = true;
        state.waitTime = 0;
        state.hideSpot = { x: predator.x, y: predator.y };
      }
      return true; // Stay hidden
    }
    
    // If prey is close and we've waited enough, strike!
    const distToPrey = Math.sqrt(dist2(predator.x, predator.y, prey.x, prey.y));
    const strikeDistance = predator.genes.sense * 0.4;
    
    if (state.isWaiting && distToPrey < strikeDistance && state.waitTime > ambushDelay * 3) {
      state.isWaiting = false;
      state.waitTime = 0;
      // Apply speed boost for ambush strike
      if (predator.hasStatus) {
        predator.addStatus?.('adrenaline', 2); // Short adrenaline burst
      }
      return false; // Strike!
    }
    
    return state.isWaiting;
  }

  /**
   * Herding behavior - creatures guide juveniles and protect them
   */
  static applyHerding(adult, juveniles, dt) {
    if (!adult.genes || adult.ageStage !== 'adult') return;
    
    const herdInstinct = adult.genes.herdInstinct ?? 0.5;
    if (herdInstinct < 0.4) return;
    
    const herdRadius = 100;
    const protectionRadius = 150;
    
    // Count nearby juveniles
    let youngCount = 0;
    let avgJuvenileX = 0;
    let avgJuvenileY = 0;
    
    for (const juvenile of juveniles) {
      const distSq = dist2(adult.x, adult.y, juvenile.x, juvenile.y);
      if (distSq < herdRadius * herdRadius) {
        avgJuvenileX += juvenile.x;
        avgJuvenileY += juvenile.y;
        youngCount++;
      }
    }
    
    if (youngCount > 0) {
      // Move towards center of juvenile group
      avgJuvenileX /= youngCount;
      avgJuvenileY /= youngCount;
      
      const dx = avgJuvenileX - adult.x;
      const dy = avgJuvenileY - adult.y;
      const strength = herdInstinct * 0.5;
      
      adult.vx += dx * strength * dt;
      adult.vy += dy * strength * dt;
      
      // Mark as protector (could show visual indicator)
      adult.isProtecting = true;
    }
  }

  /**
   * Scavenging behavior - opportunistic feeding on corpses
   */
  static findCorpses(creature, world) {
    if (!world.corpses || world.corpses.length === 0) return null;
    
    const scavengeInstinct = creature.genes.diet ?? (creature.genes.predator ? 1.0 : 0.0);
    if (scavengeInstinct < 0.3) return null; // Only omnivores and carnivores scavenge
    
    const senseRange = creature.genes.sense;
    let closestCorpse = null;
    let closestDist = senseRange * senseRange;
    
    for (const corpse of world.corpses) {
      const distSq = dist2(creature.x, creature.y, corpse.x, corpse.y);
      if (distSq < closestDist) {
        closestDist = distSq;
        closestCorpse = corpse;
      }
    }
    
    return closestCorpse;
  }
}
