import { clamp } from './utils.js';
import { BehaviorConfig } from './behavior.js';
import { CreatureConfig } from './creature-config.js';
import { CreatureTuning } from './creature-tuning.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';
import { getAgeSpeedMultiplier } from './creature-age.js';

/**
 * Records damage taken by the creature, applying health reduction,
 * damage caps, and invincibility frames.
 * @param {Object} creature - The creature instance
 * @param {number} amount - Initial damage amount
 * @param {Object} ctx - Damage context (attacker, type, etc.)
 * @returns {number} Final damage dealt
 */
export function recordDamage(creature, amount, ctx = {}) {
  if (!creature.alive) return 0;

  // Safety check for invincibility frames
  const now = creature._lastWorld?.t ?? 0;
  if (now < (creature.damageFx?.iframesUntil ?? -Infinity) && !ctx.ignoreIframes) {
    return 0;
  }

  // Unify visual feedback block
  if (!creature.damageFx) {
    creature.damageFx = { recentDamage: 0, hitFlash: 0, iframesUntil: -Infinity, lastDamageTime: -Infinity };
  }
  const ratio = clamp(amount / 10, 0.05, 1);
  creature.damageFx.recentDamage = Math.min(2.6, (creature.damageFx.recentDamage ?? 0) + ratio * 1.5);
  creature.damageFx.hitFlash = Math.max(creature.damageFx.hitFlash ?? 0, 0.18 + ratio * 0.35);

  // Apply global damage cap (Max 35% of max health per hit)
  const maxDamage = creature.maxHealth * (CreatureConfig.COMBAT.MAX_DAMAGE_PERCENT || 0.35);
  const finalDamage = Math.min(amount, maxDamage);

  // Apply health reduction
  creature.health = Math.max(0, creature.health - finalDamage);
  creature.stats.damageTaken += finalDamage;

  if (ctx.attacker) {
    creature.killedBy = ctx.attacker.id;
  }

  // Set invincibility frames
  if (!ctx.ignoreIframes) {
    const iframes = CreatureConfig.COMBAT.INVINCIBILITY_DURATION || 0.8;
    creature.damageFx.iframesUntil = now + iframes;
  }
  creature.damageFx.lastDamageTime = now;

  // Trigger visual/collision reaction
  creature.reactToCollision(finalDamage, { skipDamage: true });

  // Handle memory of danger
  if (creature.memory && finalDamage > 0.6 &&
    now - (creature.memory.lastDangerAt ?? -Infinity) >= CreatureConfig.MEMORY.DANGER_COOLDOWN) {
    const strength = clamp(0.3 + (finalDamage / 12) * 0.6, 0.3, 0.9);
    creature.rememberLocation?.(creature.x, creature.y, 'danger', strength, now);
    creature.memory.lastDangerAt = now;
  }

  // Check for death
  if (creature.health <= 0) {
    creature.alive = false;
    creature.deathCause = ctx.type || 'combat';
  } else {
    // "Second Wind" - Adrenaline surge at critical health
    const healthRatio = creature.health / creature.maxHealth;
    if (healthRatio < 0.15 && (creature.cooldowns.adrenaline ?? 0) <= 0) {
      creature.applyStatus('adrenaline', {
        duration: 3.5,
        intensity: 0.6,
        metadata: { boost: 0.6, source: 'second_wind' }
      });
      creature.cooldowns.adrenaline = 15;
      creature.logEvent('Unleashed Second Wind!', now);
    }
  }

  return finalDamage;
}

/**
 * Calculates the current speed of the creature based on genes, biome, state, and boosters.
 * @param {Object} creature - The creature instance
 * @param {number} dt - Time delta
 * @param {Object} world - Simulation world
 * @returns {number} The current speed in px/s
 */
export function calculateCurrentSpeed(creature, dt, world) {
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
      baseSpeed *= biome.aquaticSpeed || (1.2 + creature.aquaticAffinity * 0.3);
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
      arriveFactor = clamp(dist / CreatureAgentTuning.MOVEMENT.SLOW_RADIUS, CreatureAgentTuning.MOVEMENT.MIN_ARRIVE_SPEED, 1);
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

export function applyImpactDamage(creature, amount, { cause = 'impact', intensity = 0.4 } = {}) {
  if (!creature.alive || amount <= 0) return 0;
  const worldTime = creature._lastWorld?.t ?? 0;
  const iframes = CreatureTuning.DAMAGE_IFRAMES_MS / 1000;
  if (worldTime < (creature.damageFx?.iframesUntil ?? -Infinity)) return 0;

  const clamped = clamp(amount, 0, CreatureTuning.DAMAGE_CLAMP_MAX);
  const finalDamage = typeof creature.recordDamage === 'function'
    ? creature.recordDamage(clamped, { type: cause, ignoreIframes: true })
    : 0;
  if (finalDamage <= 0) return 0;

  if (creature.damageFx) {
    creature.damageFx.iframesUntil = worldTime + iframes;
    creature.damageFx.lastDamageTime = worldTime;
  }

  if (creature.memory && finalDamage > 0.6 &&
    worldTime - (creature.memory.lastDangerAt ?? -Infinity) >= CreatureConfig.MEMORY.DANGER_COOLDOWN) {
    const strength = clamp(0.3 + (finalDamage / CreatureTuning.DAMAGE_CLAMP_MAX) * 0.6, 0.3, 0.9);
    creature.rememberLocation?.(creature.x, creature.y, 'danger', strength, worldTime);
    creature.memory.lastDangerAt = worldTime;
  }

  creature._lastWorld?.creatureEcosystem?.registerEvent?.(creature, 'impact', { intensity });
  return finalDamage;
}

export function applyImpulse(creature, vx, vy, { decay = 6, cap = 360 } = {}) {
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
