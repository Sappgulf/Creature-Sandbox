import { clamp } from './utils.js';
import { CreatureTuning } from './creature-tuning.js';
import { CreatureConfig } from './creature-config.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';
import { BehaviorConfig } from './behavior.js';
import { getAgeSpeedMultiplier } from './creature-age.js';

/**
 * Calculates the current speed of the creature based on genes, biome, state, and boosters.
 * @param {Creature} creature
 * @param {number} dt - Time delta
 * @param {Object} world - Simulation world
 * @returns {number} The current speed in px/s
 */
export function calculateCreatureCurrentSpeed(creature, dt, world) {
  const biome = world.getBiomeAt ? world.getBiomeAt(creature.x, creature.y) : null;
  const inWater = biome?.type === 'water';
  const inWetland = biome?.type === 'wetland';
  const goal = creature.goal?.current || 'WANDER';

  const restFactor = BehaviorConfig.restWeight * clamp(1 - creature.energy / 36, 0, 1);
  const aggressionFactor = creature.genes.predator ? clamp(creature.personality.aggression, 0.4, 2.2) : 1;

  // Scale genes.speed to baseline simulation speeds
  let baseSpeed = creature.genes.speed * (creature.genes.predator ? 46 : 40);
  if (creature.genes.predator) baseSpeed *= 0.85 + aggressionFactor * 0.25;

  // Environmental/Biome modifiers
  if (inWater) {
    if (creature.aquaticAffinity > 0.5) {
      baseSpeed *= biome.aquaticSpeed || 1.2 + creature.aquaticAffinity * 0.3;
    } else if (creature.aquaticAffinity > 0.2) {
      baseSpeed *= 0.7 + creature.aquaticAffinity * 0.5;
    } else {
      baseSpeed *= biome.movementSpeed || 0.3;
    }
  } else if (inWetland) {
    if (creature.aquaticAffinity > 0.1) {
      baseSpeed *= 1 + creature.aquaticAffinity * 0.32;
    } else {
      baseSpeed *= 0.88;
    }
  } else if (creature.aquaticAffinity > 0.5) {
    baseSpeed *= 0.9 - Math.min(0.2, (creature.aquaticAffinity - 0.5) * 0.25);
  }

  // Nocturnal advantage at night
  const dayNight = world?.dayNightState;
  const isNight = dayNight?.phase === 'night' || (dayNight?.light ?? 1) < 0.4;
  if (isNight && creature.genes.nocturnal !== undefined) {
    const nocturnalPref = creature.genes.nocturnal;
    const isNocturnal = nocturnalPref > 0.5;
    if (isNocturnal) {
      baseSpeed *= 1 + CreatureAgentTuning.NOCTURNAL.NIGHT_SPEED_BONUS * nocturnalPref;
    } else {
      baseSpeed *= 1 - CreatureAgentTuning.NOCTURNAL.DIURNAL_NIGHT_SPEED_PENALTY * (1 - nocturnalPref);
    }
  }

  // Age stage speed modifiers
  baseSpeed *= getAgeSpeedMultiplier(creature.age);

  let speedBoost = 1;
  const herdBuff = creature.getStatus('herd-buff');
  const adrenaline = creature.getStatus('adrenaline');
  const playBurst = creature.getStatus('play-burst');
  const elderAid = creature.getStatus('elder-aid');
  const bleed = creature.getStatus('bleeding');

  if (herdBuff && !creature.genes.predator) speedBoost += herdBuff.intensity ?? 0;
  if (adrenaline) speedBoost += adrenaline.metadata?.boost ?? adrenaline.intensity ?? 0;
  if (playBurst) speedBoost += playBurst.intensity ?? 0.25;
  if (elderAid) speedBoost += (elderAid.intensity ?? 0) * 0.08;
  if (bleed) speedBoost -= Math.min(0.3, 0.08 * (bleed.stacks ?? 1));

  // Arrive/Target factor
  let arriveFactor = 1;
  if (creature.target) {
    const dist = Math.hypot(creature.target.x - creature.x, creature.target.y - creature.y);
    if (dist < CreatureAgentTuning.MOVEMENT.SLOW_RADIUS) {
      arriveFactor = clamp(
        dist / CreatureAgentTuning.MOVEMENT.SLOW_RADIUS,
        CreatureAgentTuning.MOVEMENT.MIN_ARRIVE_SPEED,
        1
      );
    }
  }

  const goalSpeedFactor = goal === 'REST' ? 0.4 : goal === 'SEEK_MATE' ? 1.15 : 1;
  let speedScalar = clamp(1 - restFactor * 0.6, 0.15, 1) * clamp(speedBoost, 0.6, 1.9) * arriveFactor * goalSpeedFactor;

  if (creature.genes.predator) {
    if (creature.personality.ambushTimer > 0 && creature.target && creature.target.creatureId != null) {
      speedScalar *= 0.25 + 0.15 * aggressionFactor;
    } else if (creature.target && creature.target.creatureId != null) {
      speedScalar *= 1.05 + aggressionFactor * 0.15;
    } else if (creature.target && creature.target.signal) {
      speedScalar *= 0.9 + creature.personality.packInstinct * 0.35;
    }
  }

  const recallUntil = creature.memory?.focus?.recallUntil ?? -Infinity;
  if (world.t < recallUntil) speedScalar *= CreatureConfig.MEMORY.RECALL_SLOW;

  return baseSpeed * speedScalar;
}

/**
 * Applies an external impulse to the creature.
 * @param {Creature} creature
 * @param {number} vx
 * @param {number} vy
 * @param {Object} opts
 */
export function applyCreatureImpulse(creature, vx, vy, { decay = 6, cap = 360 } = {}) {
  if (!creature.externalImpulse) {
    creature.externalImpulse = { vx: 0, vy: 0, decay, cap };
  }
  const baseSize = creature.size ?? 4;
  const weight = clamp(baseSize / 4, 0.7, 1.35);
  const bounce = creature.traits?.bounce ?? 1;
  const scaledVX = (vx * bounce) / weight;
  const scaledVY = (vy * bounce) / weight;
  const effectiveCap = clamp(cap / weight, 180, 420);
  creature.externalImpulse.vx = clamp(creature.externalImpulse.vx + scaledVX, -effectiveCap, effectiveCap);
  creature.externalImpulse.vy = clamp(creature.externalImpulse.vy + scaledVY, -effectiveCap, effectiveCap);
  creature.externalImpulse.decay = decay;
  creature.externalImpulse.cap = effectiveCap;

  const projected = Math.hypot(creature.externalImpulse.vx, creature.externalImpulse.vy);
  const ragdollThreshold = 165 + Math.max(0, (creature._lastWorld?.chaos?.reactionBoost ?? 1) - 1) * 20;
  if (projected > ragdollThreshold && creature._ragdollCooldown <= 0) {
    creature._ragdollCooldown = 0.6;
    creature._triggerReaction('ragdoll', clamp(projected / 220, 0.6, 1.4), 0.5);
    creature.setMood('😵', 0.9);
    creature.recoveryPoseTimer = Math.max(creature.recoveryPoseTimer, 0.6);
    creature.funStats.goofyFails += 1;
  }
}

/**
 * Applies the creature's stored external impulse to its position.
 * @param {Creature} creature
 * @param {number} dt
 */
export function applyCreatureExternalImpulse(creature, dt) {
  const impulse = creature.externalImpulse;
  if (!impulse) return;
  if (Math.abs(impulse.vx) < 0.1 && Math.abs(impulse.vy) < 0.1) {
    impulse.vx = 0;
    impulse.vy = 0;
    return;
  }
  creature.x += impulse.vx * dt;
  creature.y += impulse.vy * dt;
  const decay = impulse.decay ?? 6;
  const decayFactor = Math.max(0, 1 - decay * dt);
  impulse.vx *= decayFactor;
  impulse.vy *= decayFactor;
}

/**
 * Updates the creature's position and handles physics for one frame.
 * @param {Creature} creature
 * @param {number} dt
 * @param {Object} world
 * @param {number} spd - current speed
 */
export function updateCreaturePosition(creature, dt, world, spd) {
  const chaosGravity = world?.chaos?.gravity ?? 0;
  if (Math.abs(chaosGravity) > 0.1) {
    creature.applyImpulse(0, chaosGravity * dt * 60, { decay: 10, cap: 200 });
  }
  creature.vx = Math.cos(creature.dir) * spd;
  creature.vy = Math.sin(creature.dir) * spd;
  // MOVEMENT: position update is handled by behaviorSystem.applyMovement
  creature._applyExternalImpulse(dt);
  const impulse = creature.externalImpulse;
  const externalSpeed = impulse ? Math.hypot(impulse.vx, impulse.vy) : 0;
  const prevExternalSpeed = creature._lastExternalSpeed || 0;
  creature._lastExternalSpeed = externalSpeed;
  creature._fallReactCooldown = Math.max(0, creature._fallReactCooldown - dt);

  if (externalSpeed > 120 && creature._fallReactCooldown <= 0 && !creature.isGrabbed) {
    creature._triggerReaction('fall', clamp(externalSpeed / 220, 0.4, 1.2), 0.25);
    creature.setMood('😰', 0.6);
    creature._fallReactCooldown = 0.4;
  }

  if (prevExternalSpeed > 140 && externalSpeed < 40 && !creature.isGrabbed) {
    const landingIntensity = clamp(prevExternalSpeed / 220, 0.4, 1.3);
    creature._triggerReaction('landing', landingIntensity, 0.35);
    if (prevExternalSpeed > 180) {
      creature.funStats.hardLandings += 1;
      creature.setMood('😳', 1.1);
      creature.recoveryPoseTimer = Math.max(creature.recoveryPoseTimer, 0.8);
      if (Math.random() < 0.12) {
        creature._triggerReaction('oops', 1.1, 0.45);
        creature.funStats.goofyFails += 1;
      }
    }

    const fallThreshold = CreatureTuning.FALL_DAMAGE_THRESHOLD;
    if (prevExternalSpeed > fallThreshold) {
      const excess = prevExternalSpeed - fallThreshold;
      const normalized = clamp(excess / 180, 0, 1);
      const damage = normalized * (CreatureTuning.DAMAGE_CLAMP_MAX * 0.55);
      creature.applyImpactDamage(damage, { cause: 'fall', intensity: normalized });
    }
  }

  // World boundary handling (configurable via world.boundaryMode)
  const boundaryMode = world.boundaryMode || 'wrap'; // 'wrap', 'clamp', or 'none'
  if (boundaryMode === 'wrap') {
    // Wrap-around (pacman style)
    if (creature.x < 0) creature.x += world.width;
    else if (creature.x >= world.width) creature.x -= world.width;
    if (creature.y < 0) creature.y += world.height;
    else if (creature.y >= world.height) creature.y -= world.height;
  } else if (boundaryMode === 'clamp') {
    // Hard boundaries (bounce at edge)
    const margin = 10;
    if (creature.x < margin) {
      creature.x = margin;
      creature.vx = Math.abs(creature.vx);
      creature.dir = Math.atan2(creature.vy, creature.vx);
    } else if (creature.x > world.width - margin) {
      creature.x = world.width - margin;
      creature.vx = -Math.abs(creature.vx);
      creature.dir = Math.atan2(creature.vy, creature.vx);
    }
    if (creature.y < margin) {
      creature.y = margin;
      creature.vy = Math.abs(creature.vy);
      creature.dir = Math.atan2(creature.vy, creature.vx);
    } else if (creature.y > world.height - margin) {
      creature.y = world.height - margin;
      creature.vy = -Math.abs(creature.vy);
      creature.dir = Math.atan2(creature.vy, creature.vx);
    }
  }
  // boundaryMode 'none' = no restrictions (current behavior)
}
