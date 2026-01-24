/**
 * Creature Behavior System - AI, decision making, and behavioral logic
 */
import { rand, clamp, dist2 } from './utils.js';
import { CreatureConfig } from './creature-config.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';
import { TempObjectPool } from './object-pool.js';

export class CreatureBehaviorSystem {
  constructor(creature) {
    this.creature = creature;

    // Cache for expensive calculations
    this._cachedSin = 0;
    this._cachedCos = 1;
    this._lastAngle = 0;
    this._angleCacheThreshold = 0.01; // Only update cache if angle changed significantly

    // Object pool for temporary calculations
    this._tempPool = new TempObjectPool(5);
  }

  /**
   * Main behavior update - decide what to do each frame
   */
  update(dt, world) {
    this.creature._lastWorld = world;
    const dietRole = this.creature.traits?.dietRole ?? 'herbivore';

    // Update target selection and behavior
    this.updateTargeting(world, dt);
    this.updateMovement(world, dt);

    // Handle specific behaviors based on type and state
    if (dietRole === 'predator-lite') {
      this.updatePredatorLiteBehavior(world, dt);
    } else if (this.creature.genes.predator) {
      this.updatePredatorBehavior(world, dt);
    } else {
      this.updateHerbivoreBehavior(world, dt);
    }

    // Handle lifecycle behaviors
    this.updateLifecycleBehavior(dt, world);
  }

  /**
   * Update target selection and tracking
   */
  updateTargeting(world, dt) {
    // Update existing target validity
    if (this.creature.target) {
      if (this.creature.target.isCorpse && this.creature.target.corpse) {
        // Corpse target - check if still exists
        if (!world.corpses.includes(this.creature.target.corpse)) {
          this.creature.target = null;
        }
      } else if (this.creature.target.creatureId !== undefined) {
        // Creature target - check if still alive
        const targetCreature = world.creatures.find(c => c.id === this.creature.target.creatureId);
        if (!targetCreature || !targetCreature.alive) {
          this.creature.target = null;
        }
      }
    }

    // Find new targets if needed
    if (!this.creature.target) {
      this.selectNewTarget(world);
    }
  }

  /**
   * Select a new target based on creature type and needs
   */
  selectNewTarget(world) {
    const diet = this.creature.genes.diet ?? (this.creature.genes.predator ? 1.0 : 0.0);
    const dietRole = this.creature.traits?.dietRole ?? 'herbivore';

    // Predators prioritize hunting
    if (dietRole === 'predator-lite') {
      this.selectPredatorLiteTarget(world);
    } else if (diet > 0.7) {
      this.selectHuntingTarget(world);
    }
    // Omnivores look for food first, then prey
    else if (diet > 0.3) {
      this.selectOmnivoreTarget(world);
    }
    // Herbivores look for food
    else {
      this.selectForagingTarget(world);
    }

    // Scavenging as fallback
    if (dietRole === 'scavenger') {
      this.selectScavengingTarget(world);
    } else if (!this.creature.target && this.creature.energy < 30) {
      this.selectScavengingTarget(world);
    }
  }

  /**
   * Select hunting target for predators
   */
  selectHuntingTarget(world) {
    if (!world.combat) return;

    const prey = world.combat.findPrey(this.creature, 120);
    if (prey) {
      this.creature.target = {
        x: prey.x,
        y: prey.y,
        creatureId: prey.id,
        priority: 1.0
      };
      this.creature.personality.currentTargetId = prey.id;
    }
  }

  selectPredatorLiteTarget(world) {
    const prey = world.findPrey?.(this.creature, 140);
    if (prey) {
      this.creature.target = {
        x: prey.x,
        y: prey.y,
        creatureId: prey.id,
        predatorLite: true,
        priority: 0.75
      };
      this.creature.personality.currentTargetId = prey.id;
    }
  }

  /**
   * Select target for omnivores (food first, then prey)
   */
  selectOmnivoreTarget(world) {
    // Try food first
    const food = this.seekFood(world);
    if (food) {
      this.creature.target = {
        x: food.x,
        y: food.y,
        food: food,
        priority: 0.8
      };
      return;
    }

    // Then try hunting (less aggressively than pure predators)
    if (rand() < 0.3) { // 30% chance to hunt
      this.selectHuntingTarget(world);
    }
  }

  /**
   * Select foraging target for herbivores
   */
  selectForagingTarget(world) {
    const food = this.seekFood(world);
    if (food) {
      this.creature.target = {
        x: food.x,
        y: food.y,
        food: food,
        priority: 0.9
      };
    }
  }

  /**
   * Select scavenging target
   */
  selectScavengingTarget(world) {
    if (!world.findNearbyCorpse) return;
    const corpse = world.findNearbyCorpse(this.creature.x, this.creature.y, 60);

    if (corpse) {
      this.creature.target = {
        x: corpse.x,
        y: corpse.y,
        isCorpse: true,
        corpse: corpse,
        priority: 0.6
      };
    }
  }

  /**
   * Seek food using vision and pheromones
   */
  seekFood(world) {
    if (!world.ecosystem) return null;

    const foodList = world.ecosystem.nearbyFood(this.creature.x, this.creature.y, this.creature.genes.sense);
    const pheromone = world.pheromone.getAtWorld(this.creature.x, this.creature.y);

    if (!foodList.length && !pheromone) return null;

    const senseRadius = this.creature.genes.sense;
    const senseRadius2 = senseRadius * senseRadius;
    const halfFov = this.creature._halfFovRad;

    // Cache trig values for vision cone calculations
    const { cos: dirCos, sin: dirSin } = this.getCachedTrig(this.creature.dir);

    let best = null;
    let bestD2 = Infinity;

    // Check visible food
    for (const food of foodList) {
      const dx = food.x - this.creature.x;
      const dy = food.y - this.creature.y;
      const d2 = dx * dx + dy * dy;

      if (d2 > senseRadius2) continue;

      const angle = Math.atan2(dy, dx);
      const delta = angle - this.creature.dir;
      const normalizedDelta = ((delta + Math.PI) % CreatureConfig.TAU) - Math.PI;

      if (Math.abs(normalizedDelta) > halfFov) continue;

      // Bias toward closer food
      const bias = d2 * (1 + Math.abs(normalizedDelta) / halfFov * 0.5);
      if (bias < bestD2) {
        bestD2 = bias;
        best = food;
      }
    }

    // Follow pheromone trails if no food found
    if (!best && pheromone > 0.1) {
      return this.followPheromoneTrail(world, senseRadius);
    }

    return best;
  }

  /**
   * Follow pheromone trails
   */
  followPheromoneTrail(world, senseRadius) {
    let maxVal = 0;
    let bestDir = null;

    // Sample pheromone in adjacent cells
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;

        const px = this.creature.x + ox * world.pheromone.cell;
        const py = this.creature.y + oy * world.pheromone.cell;
        const v = world.pheromone.getAtWorld(px, py);

        if (v > maxVal) {
          maxVal = v;
          bestDir = { x: px, y: py };
        }
      }
    }

    if (bestDir) {
      return { x: bestDir.x, y: bestDir.y, pheromone: true };
    }

    return null;
  }

  /**
   * Update movement toward target
   */
  updateMovement(world, dt) {
    let desiredAngle = null;

    // Calculate desired movement direction
    if (this.creature.target) {
      desiredAngle = Math.atan2(
        this.creature.target.y - this.creature.y,
        this.creature.target.x - this.creature.x
      );
    } else if (this.creature.lifecycle?.playTimer > 0) {
      // Play behavior - random movement
      desiredAngle = this.creature.dir + (rand() - 0.5) * 2;
    } else {
      // Default wandering
      this.updateWandering(dt);
      return;
    }

    // Aquatic behavior
    if (this.creature.aquaticAffinity > 0.5) {
      desiredAngle = this.updateAquaticMovement(world, desiredAngle);
    }

    if (desiredAngle !== null) {
      this.steerToward(desiredAngle, dt);
    }

    this.applyMovement(dt);
  }

  /**
   * Update wandering behavior
   */
  updateWandering(dt) {
    // Gentle random steering
    const temp = this.creature.temperament || {};
    const curiosityBoost = 0.8 + (temp.curiosity ?? 0) * 0.7;
    const quirkBoost = this.creature.getQuirkMultiplier?.('wander') ?? 1;
    const wanderStrength = CreatureConfig.MOVEMENT.WANDER_STRENGTH * curiosityBoost * quirkBoost;
    this.creature.dir += (rand() - 0.5) * wanderStrength * dt;

    // Homebody bias toward anchor
    if (this.creature.getQuirkMultiplier && (this.creature.getQuirkMultiplier('home_pull') > 1.0)) {
      const anchor = this.creature.homeAnchor;
      if (anchor) {
        const dx = anchor.x - this.creature.x;
        const dy = anchor.y - this.creature.y;
        const desired = Math.atan2(dy, dx);
        const pull = 0.15 * dt * this.creature.getQuirkMultiplier('home_pull');
        this.creature.dir += (desired - this.creature.dir) * pull;
      }
    }
  }

  /**
   * Update aquatic movement behavior
   */
  updateAquaticMovement(world, desiredAngle) {
    // Check if in wetland biome
    const inWetland = world.getBiomeAt ?
      world.getBiomeAt(this.creature.x, this.creature.y)?.type === 'wetland' : false;

    if (!inWetland && (!this.creature.target || this.creature.target.family)) {
      // Seek wetland
      const wetDir = this.sampleWetlandDirection(world);
      if (wetDir !== null) {
        return wetDir;
      }
    }

    return desiredAngle;
  }

  /**
   * Steer toward desired angle
   */
  steerToward(desiredAngle, dt) {
    let delta = desiredAngle - this.creature.dir;

    // Normalize to [-π, π]
    while (delta > Math.PI) delta -= CreatureConfig.TAU;
    while (delta < -Math.PI) delta += CreatureConfig.TAU;

    // Apply turn rate limit
    const maxTurn = CreatureConfig.MOVEMENT.TURN_RATE * dt;
    delta = clamp(delta, -maxTurn, maxTurn);

    this.creature.dir += delta;
  }

  /**
   * Get cached sin/cos values to avoid repeated calculations
   */
  getCachedTrig(angle) {
    if (Math.abs(angle - this._lastAngle) > this._angleCacheThreshold) {
      this._lastAngle = angle;
      this._cachedSin = Math.sin(angle);
      this._cachedCos = Math.cos(angle);
    }
    return { sin: this._cachedSin, cos: this._cachedCos };
  }

  /**
   * Apply movement physics
   */
  applyMovement(dt) {
    const diet = this.creature.genes.diet ?? (this.creature.genes.predator ? 1.0 : 0.0);
    const aggressionFactor = this.creature.personality.aggression;
    const temp = this.creature.temperament || {};

    let baseSpeed = CreatureConfig.MOVEMENT.BASE_SPEED;

    // Predator speed modifiers
    if (this.creature.genes.predator) {
      baseSpeed *= 0.85 + aggressionFactor * 0.25;
    }

    // Environmental modifiers
    const inWetland = this.creature._lastWorld?.getBiomeAt ?
      this.creature._lastWorld.getBiomeAt(this.creature.x, this.creature.y)?.type === 'wetland' : false;

    if (inWetland) {
      if (this.creature.aquaticAffinity > 0.1) {
        baseSpeed *= CreatureConfig.ENVIRONMENT.WETLAND_SPEED_MULTIPLIER;
      } else {
        baseSpeed *= 0.5; // Penalty for non-aquatic creatures
      }
    }

    // Age modifiers
    baseSpeed *= this.getAgeSpeedMultiplier();

    // Status modifiers
    baseSpeed *= this.getStatusSpeedMultiplier(temp);

    const eventActivity = this.creature._lastWorld?.eventModifiers?.activity ?? 1;
    baseSpeed *= clamp(eventActivity, 0.85, 1.2);

    // Temperament-driven pacing (small)
    baseSpeed *= clamp(0.92 + (temp.curiosity ?? 0) * 0.15 + (temp.boldness ?? 0) * 0.08, 0.85, 1.25);

    // Quirk pacing (night owl)
    if (this.creature.getQuirkMultiplier) {
      const timeOfDay = this.creature._lastWorld?.environment?.timeOfDay ?? 12;
      const isNight = timeOfDay >= 18 || timeOfDay <= 6;
      if (isNight) {
        baseSpeed *= this.creature.getQuirkMultiplier('night_speed');
      } else {
        baseSpeed *= this.creature.getQuirkMultiplier('day_speed');
      }
    }

    const dayNight = this.creature._lastWorld?.dayNightState;
    if (dayNight) {
      const dayFactor = clamp((dayNight.light - 0.2) / 0.8, 0, 1);
      const nightMult = CreatureAgentTuning.DAY_NIGHT.MOVE_NIGHT_MULT;
      const dayMult = CreatureAgentTuning.DAY_NIGHT.MOVE_DAY_MULT;
      baseSpeed *= nightMult + (dayMult - nightMult) * dayFactor;
    }

    // Apply movement (use cached trig calculations)
    const speed = baseSpeed * dt;
    const { cos: dirCos, sin: dirSin } = this.getCachedTrig(this.creature.dir);
    this.creature.x += dirCos * speed;
    this.creature.y += dirSin * speed;

    const windX = this.creature._lastWorld?.moodState?.windX ?? 0;
    const windY = this.creature._lastWorld?.moodState?.windY ?? 0;
    if (windX || windY) {
      const windScale = 18;
      this.creature.x += windX * windScale * dt;
      this.creature.y += windY * windScale * dt;
    }

    // Update animation
    this.creature._updateAnimationState(speed, this.creature._lastWorld?.t || 0);
  }

  /**
   * Get age-based speed multiplier
   */
  getAgeSpeedMultiplier() {
    if (typeof this.creature._getAgeSpeedMultiplier === 'function') {
      return this.creature._getAgeSpeedMultiplier();
    }
    switch (this.creature.ageStage) {
      case 'baby': return 1.0;
      case 'juvenile': return 0.95;
      case 'adult': return 1.0;
      case 'elder': return 0.85;
      default: return 1.0;
    }
  }

  /**
   * Get status-based speed multiplier
   */
  getStatusSpeedMultiplier(temp = null) {
    let multiplier = 1.0;

    // Adrenaline boost
    if (this.creature.hasStatus('adrenaline')) {
      const adrenaline = this.creature.getStatus('adrenaline');
      multiplier *= 1.4 + (adrenaline.intensity || 0);
    }

    // Panic slowdown
    if (this.creature.hasStatus('panic')) {
      const calmness = temp?.calmness ?? 0;
      multiplier *= 0.7 + calmness * 0.2;
    }

    return multiplier;
  }

  /**
   * Update predator-specific behavior
   */
  updatePredatorBehavior(world, dt) {
    if (this.creature.traits?.dietRole === 'predator-lite') return;
    // Update ambush timer
    if (this.creature.personality.ambushTimer > 0) {
      this.creature.personality.ambushTimer -= dt;
    }

    // Attempt hunting
    if (this.creature.personality.currentTargetId) {
      world.combat?.tryPredation(this.creature);
    }

    // Pheromone signaling
    if (this.creature.personality.lastSignalAt < world.t - 2) {
      this.creature.personality.lastSignalAt = world.t;
      world.combat?.registerPredatorSignal(
        this.creature.x, this.creature.y,
        0.5, 5, this.creature.id
      );
    }
  }

  updatePredatorLiteBehavior(world, dt) {
    if (this.creature.personality.ambushTimer > 0) {
      this.creature.personality.ambushTimer -= dt;
    }
    if (this.creature.personality.currentTargetId && this.creature.personality.ambushTimer <= 0) {
      const target = world.getAnyCreatureById?.(this.creature.personality.currentTargetId);
      if (target && target.alive) {
        this.creature.target = { x: target.x, y: target.y, creatureId: target.id, predatorLite: true };
      }
    }
  }

  /**
   * Update herbivore-specific behavior
   */
  updateHerbivoreBehavior(world, dt) {
    // Herd behavior
    if (this.creature.genes.herdInstinct > 0.5) {
      this.updateHerdBehavior(world, dt);
    }
  }

  /**
   * Update herd behavior
   */
  updateHerdBehavior(world, dt) {
    const herdMembers = world.creatureManager?.queryCreatures(
      this.creature.x, this.creature.y, 50
    ).filter(c =>
      c !== this.creature &&
      c.alive &&
      !c.genes.predator &&
      c.genes.herdInstinct > 0.3
    ) || [];

    if (herdMembers.length > 0) {
      this.applyHerdForces(herdMembers, dt);
    }
  }

  /**
   * Apply herding forces (separation, alignment, cohesion)
   */
  applyHerdForces(herdMembers, dt) {
    const temp = this.creature.temperament || {};
    const socialPull = 0.8 + (temp.sociability ?? 0) * 0.5;
    const separationScale = 1 - Math.min(0.3, (temp.sociability ?? 0) * 0.25);
    const separationForce = { x: 0, y: 0 };
    const alignmentForce = { x: 0, y: 0 };
    const cohesionForce = { x: 0, y: 0 };

    for (const other of herdMembers) {
      const dx = other.x - this.creature.x;
      const dy = other.y - this.creature.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        // Separation
        if (dist < CreatureConfig.MOVEMENT.HERD_SEPARATION * separationScale) {
          separationForce.x -= dx / dist;
          separationForce.y -= dy / dist;
        }

        // Alignment
        if (dist < CreatureConfig.MOVEMENT.HERD_ALIGNMENT) {
          alignmentForce.x += Math.cos(other.dir);
          alignmentForce.y += Math.sin(other.dir);
        }

        // Cohesion
        cohesionForce.x += dx / dist;
        cohesionForce.y += dy / dist;
      }
    }

    // Apply forces to direction
    const herdStrength = this.creature.genes.herdInstinct;
    const quirkCohesion = this.creature.getQuirkMultiplier?.('cohesion') ?? 1;
    const totalForce = {
      x: separationForce.x * 0.5 + alignmentForce.x * 0.3 * quirkCohesion + cohesionForce.x * 0.2 * socialPull * quirkCohesion,
      y: separationForce.y * 0.5 + alignmentForce.y * 0.3 * quirkCohesion + cohesionForce.y * 0.2 * socialPull * quirkCohesion
    };

    if (totalForce.x !== 0 || totalForce.y !== 0) {
      const forceAngle = Math.atan2(totalForce.y, totalForce.x);
      this.creature.dir += (forceAngle - this.creature.dir) * herdStrength * dt;
    }
  }

  /**
   * Update lifecycle behaviors (play, elder aid, etc.)
   */
  updateLifecycleBehavior(dt, world) {
    // Juvenile play behavior
    if (this.creature.ageStage === 'juvenile' && !this.creature.genes.predator) {
      this.updateJuvenilePlay(dt, world);
    }

    // Elder aid behavior
    if (this.creature.ageStage === 'elder' && !this.creature.genes.predator) {
      this.updateElderAid(dt, world);
    }
  }

  /**
   * Update juvenile play behavior
   */
  updateJuvenilePlay(dt, world) {
    if (this.creature.lifecycle.playCooldown <= 0 && this.creature.energy > 12) {
      if (rand() < 0.005) { // 0.5% chance per frame
        this.creature.lifecycle.playTimer = 3 + rand() * 2; // 3-5 seconds
        this.creature.lifecycle.playCooldown = rand(
          CreatureConfig.SOCIAL.PLAY_COOLDOWN.min,
          CreatureConfig.SOCIAL.PLAY_COOLDOWN.max
        );

        // Emotional response
        if (this.creature.emotions) {
          this.creature.emotions.happiness = Math.min(1.0, this.creature.emotions.happiness + 0.3);
        }

        // Visual effects
        if (world.particles && typeof world.particles.addPlayBurst === 'function') {
          world.particles.addPlayBurst(this.creature.x, this.creature.y);
        }

        // Audio
        if (world.audio) {
          world.audio.playSound('play');
        }
      }
    }

    // Update play timer
    if (this.creature.lifecycle.playTimer > 0) {
      this.creature.lifecycle.playTimer -= dt;
    }

    // Update cooldown
    if (this.creature.lifecycle.playCooldown > 0) {
      this.creature.lifecycle.playCooldown -= dt;
    }
  }

  /**
   * Update elder aid behavior
   */
  updateElderAid(dt, world) {
    if (this.creature.lifecycle.elderAidCooldown <= 0) {
      this.emitElderSupport(world);
      this.creature.lifecycle.elderAidCooldown = rand(
        CreatureConfig.SOCIAL.ELDER_AID_COOLDOWN.min,
        CreatureConfig.SOCIAL.ELDER_AID_COOLDOWN.max
      );
    }

    // Update cooldown
    if (this.creature.lifecycle.elderAidCooldown > 0) {
      this.creature.lifecycle.elderAidCooldown -= dt;
    }

    // Family anchor behavior
    this.updateFamilyAnchor(world, dt);
  }

  /**
   * Emit elder support aura
   */
  emitElderSupport(world) {
    const allies = world.creatureManager?.queryCreatures(
      this.creature.x, this.creature.y, 40
    ).filter(c =>
      c !== this.creature &&
      c.alive &&
      !c.genes.predator &&
      c.ageStage !== 'elder'
    ) || [];

    if (allies.length === 0) return;

    for (const ally of allies) {
      ally.applyStatus('elder_aid', {
        duration: 15,
        intensity: 0.3,
        metadata: { elderId: this.creature.id }
      });

      // Emotional boost
      if (ally.emotions) {
        ally.emotions.security = Math.min(1.0, ally.emotions.security + 0.2);
      }
    }

    // Visual effects
    if (world.particles && typeof world.particles.addElderAura === 'function') {
      world.particles.addElderAura(this.creature.x, this.creature.y);
    }
  }

  /**
   * Update family anchor behavior
   */
  updateFamilyAnchor(world, dt) {
    if (!this.creature.children || this.creature.children.length === 0) return;

    if (this.creature.lifecycle.familyCheck <= 0) {
      this.creature.lifecycle.familyAnchor = this.selectFamilyAnchor(world);
      this.creature.lifecycle.familyCheck = rand(
        CreatureConfig.SOCIAL.FAMILY_CHECK_INTERVAL.min,
        CreatureConfig.SOCIAL.FAMILY_CHECK_INTERVAL.max
      );
    }

    // Update check timer
    if (this.creature.lifecycle.familyCheck > 0) {
      this.creature.lifecycle.familyCheck -= dt;
    }

    // Move toward family anchor if too far
    if (this.creature.lifecycle.familyAnchor && !this.creature.target) {
      const anchor = this.creature.lifecycle.familyAnchor;
      const dx = anchor.x - this.creature.x;
      const dy = anchor.y - this.creature.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 45) {
        this.creature.target = {
          x: anchor.x,
          y: anchor.y,
          family: true,
          priority: 0.3
        };
      }
    }
  }

  /**
   * Select a family member to anchor to
   */
  selectFamilyAnchor(world) {
    if (!this.creature.children) return null;

    let best = null;
    let bestScore = 0;

    for (const childId of this.creature.children) {
      const child = world.creatureManager?.getAnyCreatureById(childId);
      if (!child || !child.alive) continue;

      if (child.ageStage === 'adult') continue; // Adults are independent

      const score = child.ageStage === 'juvenile' ? 2 :
        child.ageStage === 'baby' ? 3 : 1;

      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }

    return best;
  }

  /**
   * Sample direction toward wetland biome
   */
  sampleWetlandDirection(world) {
    if (!world.getBiomeAt) return null;

    for (let i = 0; i < 5; i++) {
      const angle = rand() * CreatureConfig.TAU;
      const distance = 30 + rand() * 50;
      const testX = this.creature.x + Math.cos(angle) * distance;
      const testY = this.creature.y + Math.sin(angle) * distance;

      const biome = world.getBiomeAt(testX, testY);
      if (biome?.type === 'wetland') {
        return angle;
      }
    }

    return null;
  }
}
