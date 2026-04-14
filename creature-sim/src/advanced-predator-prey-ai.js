/**
 * Advanced Predator-Prey AI System
 * Sophisticated hunting and evasion behaviors
 */

export class AdvancedPredatorPreyAI {
  /**
   * Predator hunting strategies
   */
  static applyHuntingStrategy(predator, prey, world, dt) {
    if (!prey || !prey.alive) return null;

    const strategy = this.selectHuntingStrategy(predator, prey, world);

    switch (strategy) {
      case 'ambush':
        return this.ambushStrategy(predator, prey, world);
      case 'chase':
        return this.chaseStrategy(predator, prey, world, dt);
      case 'intercept':
        return this.interceptStrategy(predator, prey, world);
      case 'herd':
        return this.herdingStrategy(predator, prey, world);
      case 'patience':
        return this.patienceStrategy(predator, prey, world);
      default:
        return null;
    }
  }

  /**
   * Select best hunting strategy
   */
  static selectHuntingStrategy(predator, prey, world) {
    const distance = Math.sqrt(
      (prey.x - predator.x) ** 2 + (prey.y - predator.y) ** 2
    );

    const predatorSpeed = predator.genes?.speed ?? 1;
    const preySpeed = prey.genes?.speed ?? 1;
    const ambushTrait = predator.genes?.ambushDelay ?? 0.5;
    const packInstinct = predator.genes?.packInstinct ?? 0.5;

    // Ambush predators wait
    if (ambushTrait > 0.7 && distance > 100) {
      return 'ambush';
    }

    // Fast predators chase
    if (predatorSpeed > preySpeed * 1.2) {
      return 'chase';
    }

    // Smart predators intercept
    if (distance > 80 && predatorSpeed >= preySpeed) {
      return 'intercept';
    }

    // Pack hunters herd prey
    if (packInstinct > 0.6) {
      const nearbyPack = world.creatures.filter(c =>
        c.alive && c.genes?.predator &&
        Math.sqrt((c.x - predator.x) ** 2 + (c.y - predator.y) ** 2) < 150
      );

      if (nearbyPack.length >= 2) {
        return 'herd';
      }
    }

    // Patient predators wait for opportunity
    if (prey.energy < 20) {
      return 'patience';
    }

    return 'chase';
  }

  /**
   * Ambush strategy - wait and strike
   */
  static ambushStrategy(predator, prey, _world) {
    if (!predator.ambushState) {
      predator.ambushState = {
        waiting: true,
        waitStartTime: Date.now(),
        hidePosition: { x: predator.x, y: predator.y }
      };
    }

    const state = predator.ambushState;
    const waitTime = Date.now() - state.waitStartTime;
    const preyDistance = Math.sqrt(
      (prey.x - predator.x) ** 2 + (prey.y - predator.y) ** 2
    );

    // Wait until prey is close
    if (state.waiting && preyDistance < 60 && waitTime > 2000) {
      state.waiting = false;
      // Strike!
      return {
        x: prey.x,
        y: prey.y,
        strategy: 'ambush_strike',
        speedBoost: 1.5
      };
    }

    if (state.waiting) {
      // Stay still
      return state.hidePosition;
    }

    return null;
  }

  /**
   * Chase strategy - direct pursuit
   */
  static chaseStrategy(predator, prey, _world, _dt) {
    // Predict prey position based on velocity
    const predictionTime = 0.5; // seconds
    const predictedX = prey.x + prey.vx * predictionTime;
    const predictedY = prey.y + prey.vy * predictionTime;

    return {
      x: predictedX,
      y: predictedY,
      strategy: 'chase',
      aggressive: true
    };
  }

  /**
   * Intercept strategy - cut off escape route
   */
  static interceptStrategy(predator, prey, _world) {
    // Calculate interception point
    const preyVelocity = Math.sqrt(prey.vx ** 2 + prey.vy ** 2);
    const _predatorSpeed = (predator.genes?.speed ?? 1) * 50;

    if (preyVelocity < 1) {
      // Prey is stationary, go direct
      return { x: prey.x, y: prey.y, strategy: 'intercept' };
    }

    // Lead the target
    const preyAngle = Math.atan2(prey.vy, prey.vx);
    const leadDistance = preyVelocity * 2;

    return {
      x: prey.x + Math.cos(preyAngle) * leadDistance,
      y: prey.y + Math.sin(preyAngle) * leadDistance,
      strategy: 'intercept'
    };
  }

  /**
   * Herding strategy - coordinate with pack
   */
  static herdingStrategy(predator, prey, world) {
    // Find pack members
    const packMembers = world.creatures.filter(c =>
      c.alive && c.genes?.predator && c.id !== predator.id &&
      Math.sqrt((c.x - predator.x) ** 2 + (c.y - predator.y) ** 2) < 200
    );

    if (packMembers.length === 0) {
      return this.chaseStrategy(predator, prey, world, 0);
    }

    // Calculate pack center
    const packCenterX = packMembers.reduce((sum, p) => sum + p.x, predator.x) / (packMembers.length + 1);
    const packCenterY = packMembers.reduce((sum, p) => sum + p.y, predator.y) / (packMembers.length + 1);

    // Push prey away from pack center
    const awayAngle = Math.atan2(prey.y - packCenterY, prey.x - packCenterX);
    const pushDistance = 100;

    return {
      x: prey.x + Math.cos(awayAngle) * pushDistance,
      y: prey.y + Math.sin(awayAngle) * pushDistance,
      strategy: 'herd',
      coordinated: true
    };
  }

  /**
   * Patience strategy - wait for weak prey
   */
  static patienceStrategy(predator, prey, _world) {
    // Follow at distance
    const followDistance = 80;
    const angle = Math.atan2(prey.y - predator.y, prey.x - predator.x);

    return {
      x: prey.x - Math.cos(angle) * followDistance,
      y: prey.y - Math.sin(angle) * followDistance,
      strategy: 'patience',
      stalking: true
    };
  }

  /**
   * Prey evasion strategies
   */
  static applyEvasionStrategy(prey, predators, world, dt) {
    if (!predators || predators.length === 0) return null;

    const closestPredator = this.getClosestPredator(prey, predators);
    const strategy = this.selectEvasionStrategy(prey, closestPredator, predators, world);

    switch (strategy) {
      case 'zigzag':
        return this.zigzagEvasion(prey, closestPredator, dt);
      case 'hide':
        return this.hideEvasion(prey, closestPredator, world);
      case 'group':
        return this.groupEvasion(prey, closestPredator, world);
      case 'flee':
        return this.fleeEvasion(prey, closestPredator, world);
      case 'freeze':
        return this.freezeEvasion(prey, closestPredator);
      default:
        return null;
    }
  }

  /**
   * Select best evasion strategy
   */
  static selectEvasionStrategy(prey, predator, _allPredators, _world) {
    const distance = Math.sqrt(
      (predator.x - prey.x) ** 2 + (predator.y - prey.y) ** 2
    );

    const preySpeed = prey.genes?.speed ?? 1;
    const predatorSpeed = predator.genes?.speed ?? 1;
    const _panicLevel = prey.emotions?.fear ?? 0;
    const spines = prey.genes?.spines ?? 0;

    // Freeze if very close and has spines (defense)
    if (distance < 30 && spines > 0.5) {
      return 'freeze';
    }

    // Zigzag if faster than predator
    if (preySpeed > predatorSpeed && distance < 100) {
      return 'zigzag';
    }

    // Hide if nearby cover exists
    if (distance > 80) {
      return 'hide';
    }

    // Join group if herd instinct
    const herdInstinct = prey.genes?.herdInstinct ?? 0.5;
    if (herdInstinct > 0.6 && distance > 50) {
      return 'group';
    }

    // Default: flee
    return 'flee';
  }

  /**
   * Zigzag evasion - erratic movement
   */
  static zigzagEvasion(prey, predator, _dt) {
    if (!prey.zigzagState) {
      prey.zigzagState = {
        direction: Math.random() * Math.PI * 2,
        changeTime: Date.now(),
        zigzagCount: 0
      };
    }

    const state = prey.zigzagState;
    const now = Date.now();

    // Change direction every 0.5 seconds
    if (now - state.changeTime > 500) {
      state.direction += (Math.random() - 0.5) * Math.PI;
      state.changeTime = now;
      state.zigzagCount++;
    }

    // Move away from predator but with zigzag
    const awayAngle = Math.atan2(prey.y - predator.y, prey.x - predator.x);
    const zigzagAngle = awayAngle + Math.sin(state.direction) * 0.5;
    const distance = 200;

    return {
      x: prey.x + Math.cos(zigzagAngle) * distance,
      y: prey.y + Math.sin(zigzagAngle) * distance,
      strategy: 'zigzag',
      speedBoost: 1.2
    };
  }

  /**
   * Hide evasion - seek cover
   */
  static hideEvasion(prey, predator, _world) {
    // Find nearest obstacle or dense area
    // For now, just move perpendicular to predator approach
    const awayAngle = Math.atan2(prey.y - predator.y, prey.x - predator.x);
    const perpAngle = awayAngle + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);

    return {
      x: prey.x + Math.cos(perpAngle) * 150,
      y: prey.y + Math.sin(perpAngle) * 150,
      strategy: 'hide',
      stealth: true
    };
  }

  /**
   * Group evasion - join herd
   */
  static groupEvasion(prey, predator, world) {
    // Find nearest group of same species
    const sameSpecies = world.creatures.filter(c =>
      c.alive && !c.genes?.predator &&
      Math.abs((c.genes?.hue ?? 0) - (prey.genes?.hue ?? 0)) < 30
    );

    if (sameSpecies.length < 2) {
      return this.fleeEvasion(prey, predator, world);
    }

    // Find center of nearest group
    let groupCenterX = 0;
    let groupCenterY = 0;
    let count = 0;

    for (const other of sameSpecies) {
      const dist = Math.sqrt((other.x - prey.x) ** 2 + (other.y - prey.y) ** 2);
      if (dist < 150) {
        groupCenterX += other.x;
        groupCenterY += other.y;
        count++;
      }
    }

    if (count > 0) {
      return {
        x: groupCenterX / count,
        y: groupCenterY / count,
        strategy: 'group',
        safety: true
      };
    }

    return this.fleeEvasion(prey, predator, world);
  }

  /**
   * Flee evasion - run away
   */
  static fleeEvasion(prey, predator, _world) {
    const awayAngle = Math.atan2(prey.y - predator.y, prey.x - predator.x);
    const fleeDistance = 300;

    return {
      x: prey.x + Math.cos(awayAngle) * fleeDistance,
      y: prey.y + Math.sin(awayAngle) * fleeDistance,
      strategy: 'flee',
      panic: true,
      speedBoost: 1.3
    };
  }

  /**
   * Freeze evasion - rely on defenses
   */
  static freezeEvasion(prey, _predator) {
    return {
      x: prey.x,
      y: prey.y,
      strategy: 'freeze',
      defensive: true,
      frozen: true
    };
  }

  /**
   * Get closest predator
   */
  static getClosestPredator(prey, predators) {
    let closest = predators[0];
    let closestDist = Infinity;

    for (const predator of predators) {
      const dist = Math.sqrt(
        (predator.x - prey.x) ** 2 + (predator.y - prey.y) ** 2
      );

      if (dist < closestDist) {
        closestDist = dist;
        closest = predator;
      }
    }

    return closest;
  }

  /**
   * Calculate hunt success probability
   */
  static calculateHuntSuccess(predator, prey) {
    const speedAdvantage = (predator.genes?.speed ?? 1) / (prey.genes?.speed ?? 1);
    const senseAdvantage = (predator.genes?.sense ?? 100) / 100;
    const preyDefense = (prey.genes?.spines ?? 0) * 0.5;
    const preyEnergy = prey.energy / 40; // Low energy = easier catch

    let successChance = 0.3; // Base 30%
    successChance += speedAdvantage * 0.2;
    successChance += senseAdvantage * 0.1;
    successChance -= preyDefense;
    successChance += (1 - preyEnergy) * 0.2;

    return Math.max(0.05, Math.min(0.95, successChance));
  }

  /**
   * Apply fatigue from chase
   */
  static applyFatigue(creature, intensity, dt) {
    const fatigueRate = intensity * 0.5 * dt;
    creature.energy -= fatigueRate;

    // High fatigue reduces speed
    if (creature.energy < 15) {
      creature.fatigueSpeedPenalty = 0.7;
    } else if (creature.energy < 25) {
      creature.fatigueSpeedPenalty = 0.85;
    } else {
      creature.fatigueSpeedPenalty = 1;
    }
  }
}

export const advancedAI = AdvancedPredatorPreyAI;
