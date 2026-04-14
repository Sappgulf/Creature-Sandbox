import { CreatureAgentTuning } from './creature-agent-constants.js';
import { CreatureConfig } from './creature-config.js';
import { clamp } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';

export function updateAgentState(creature, dt, world) {
  if (!creature.needs || !creature.goal || !creature.senses) return;

  creature._needsTimer = (creature._needsTimer ?? 0) + dt;
  creature._goalTimer = (creature._goalTimer ?? 0) + dt;
  creature._steeringTimer = (creature._steeringTimer ?? 0) + dt;

  creature.goal.cooldown = Math.max(0, (creature.goal.cooldown ?? 0) - dt);
  creature.goal.mateCooldown = Math.max(0, (creature.goal.mateCooldown ?? 0) - dt);

  if (creature._needsTimer >= CreatureAgentTuning.NEEDS.UPDATE_INTERVAL) {
    const step = creature._needsTimer;
    creature._needsTimer = 0;
    updateAgentSenses(creature, world);
    updateNeeds(creature, step, world);
  }

  if (creature._goalTimer >= CreatureAgentTuning.GOALS.UPDATE_INTERVAL) {
    creature._goalTimer = 0;
    if (creature._needsTimer > 0) {
      updateAgentSenses(creature, world);
    }
    selectGoal(creature, world);
  }

  if (creature._steeringTimer >= CreatureAgentTuning.MOVEMENT.STEERING_INTERVAL) {
    creature._steeringTimer = 0;
    updateSteeringForces(creature, world);
  }
}

export function updateAgentSenses(creature, world) {
  const senses = creature.senses;
  if (!senses) return;
  const dietRole = creature.traits?.dietRole ?? 'herbivore';
  const diet = creature.genes.diet ?? (creature.genes.predator ? 1.0 : 0.0);

  const foodRadius = clamp(
    creature.genes.sense * CreatureAgentTuning.SENSES.FOOD_RADIUS_MULT,
    CreatureAgentTuning.SENSES.FOOD_RADIUS_MIN,
    CreatureAgentTuning.SENSES.FOOD_RADIUS_MAX
  );
  const foodList = world?.ecosystem?.nearbyFood(creature.x, creature.y, foodRadius) || [];
  let bestFood = null;
  let bestFoodD2 = Infinity;
  for (const food of foodList) {
    if (!food) continue;
    if (food.bites !== undefined && food.bites <= 0) continue;
    const dx = food.x - creature.x;
    const dy = food.y - creature.y;
    const d2 = dx * dx + dy * dy;
    const scentRadius = food.scentRadius ?? CreatureAgentTuning.FOOD.SCENT_RADIUS;
    if (d2 > scentRadius * scentRadius) continue;
    if (d2 < bestFoodD2) {
      bestFoodD2 = d2;
      bestFood = food;
    }
  }
  senses.food = bestFood;

  const restZone = world?.ecosystem?.nearestRestZone?.(creature.x, creature.y, CreatureAgentTuning.REST_ZONES.DETECT_RADIUS);
  senses.restZone = restZone || null;

  const homeNest = creature.homeNestId ? world?.getNestById?.(creature.homeNestId) : null;
  const nearbyNest = world?.getNearestNest?.(creature.x, creature.y, CreatureAgentTuning.NESTS.DETECT_RADIUS);
  senses.homeNest = homeNest || null;
  senses.nest = homeNest || nearbyNest || null;

  if (creature.homeRegionId == null && world?.getRegionId) {
    creature.homeRegionId = world.getRegionId(creature.x, creature.y);
  }

  const mateRadius = creature.genes.sense * CreatureAgentTuning.SENSES.MATE_RADIUS_MULT;
  const candidates = world?.creatureManager?.queryCreaturesFast
    ? world.creatureManager.queryCreaturesFast(creature.x, creature.y, mateRadius)
    : world?.queryCreatures?.(creature.x, creature.y, mateRadius) || [];
  let bestMate = null;
  let bestMateD2 = Infinity;
  for (const other of candidates) {
    if (!isMateCompatible(creature, other)) continue;
    const dx = other.x - creature.x;
    const dy = other.y - creature.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestMateD2) {
      bestMateD2 = d2;
      bestMate = other;
    }
  }
  senses.mate = bestMate;

  if (dietRole === 'scavenger' || diet >= 0.3) {
    senses.corpse = world?.findNearbyCorpse
      ? world.findNearbyCorpse(creature.x, creature.y, creature.genes.sense * 0.9)
      : null;
  } else {
    senses.corpse = null;
  }

  const crowdRadius = CreatureAgentTuning.SENSES.OVERCROWD_RADIUS;
  const crowd = world?.creatureManager?.queryCreaturesFast
    ? world.creatureManager.queryCreaturesFast(creature.x, creature.y, crowdRadius)
    : world?.queryCreatures?.(creature.x, creature.y, crowdRadius) || [];
  senses.overcrowded = crowd.length > CreatureAgentTuning.SENSES.OVERCROWD_COUNT;
  if (senses.overcrowded && !creature._wasOvercrowded) {
    creature._wasOvercrowded = true;
    try {
      eventSystem.emit(GameEvents.CREATURE_OVERCROWD, {
        x: creature.x,
        y: creature.y,
        count: crowd.length,
        worldTime: world?.t ?? 0
      });
    } catch (error) {
      console.warn('Failed to emit overcrowd event:', error);
    }
  } else if (!senses.overcrowded) {
    creature._wasOvercrowded = false;
  }
}

export function updateNeeds(creature, dt, world) {
  const needs = creature.needs;
  if (!needs) return;

  const dayNight = world?.dayNightState;
  const dayFactor = dayNight ? clamp((dayNight.light - 0.2) / 0.8, 0, 1) : 1;
  const hungerRate = CreatureAgentTuning.NEEDS.HUNGER_RATE * (
    CreatureAgentTuning.DAY_NIGHT.HUNGER_NIGHT_MULT +
    (CreatureAgentTuning.DAY_NIGHT.HUNGER_DAY_MULT - CreatureAgentTuning.DAY_NIGHT.HUNGER_NIGHT_MULT) * dayFactor
  );
  const socialRate = CreatureAgentTuning.NEEDS.SOCIAL_RATE * (
    CreatureAgentTuning.DAY_NIGHT.SOCIAL_NIGHT_MULT +
    (CreatureAgentTuning.DAY_NIGHT.SOCIAL_DAY_MULT - CreatureAgentTuning.DAY_NIGHT.SOCIAL_NIGHT_MULT) * dayFactor
  );

  needs.hunger = clamp(needs.hunger + hungerRate * dt, 0, 100);
  needs.socialDrive = clamp(needs.socialDrive + socialRate * dt, 0, 100);
  needs.energy = clamp(creature.energy ?? needs.energy, CreatureAgentTuning.NEEDS.MIN, CreatureAgentTuning.NEEDS.MAX);

  const ecoStress = creature.ecosystem?.stress;
  if (Number.isFinite(ecoStress)) {
    needs.stress = clamp(ecoStress, 0, 100);
  }

  const overcrowdMult = CreatureAgentTuning.DAY_NIGHT.OVERCROWD_NIGHT_MULT +
    (CreatureAgentTuning.DAY_NIGHT.OVERCROWD_DAY_MULT - CreatureAgentTuning.DAY_NIGHT.OVERCROWD_NIGHT_MULT) * dayFactor;
  const stressGainMultiplier = creature.lifeStage === 'baby' ? 1.35 : creature.lifeStage === 'elder' ? 1.15 : 1;
  if (creature.senses?.overcrowded) {
    needs.stress = clamp(
      needs.stress + CreatureAgentTuning.NEEDS.STRESS_OVERCROWD_GAIN * stressGainMultiplier * overcrowdMult * dt,
      0,
      100
    );
  } else if (creature.goal?.current === 'REST') {
    needs.stress = clamp(needs.stress - CreatureAgentTuning.NEEDS.STRESS_REST_DECAY * dt, 0, 100);
  } else {
    needs.stress = clamp(needs.stress - CreatureAgentTuning.NEEDS.STRESS_CALM_DECAY * dt, 0, 100);
  }

  const calmZone = world?.environment?.getCalmZoneAt?.(creature.x, creature.y);
  const calmBoost = (world?.moodState?.calmBoost ?? 0) + (calmZone?.strength ?? 0);
  if (calmBoost > 0) {
    needs.stress = clamp(needs.stress - calmBoost * 6 * dt, 0, 100);
  }

  const region = world?.getRegionAt?.(creature.x, creature.y);
  if (region && region.pressure > 0) {
    const pressureGain = CreatureAgentTuning.TERRITORY.STRESS_GAIN * region.pressure * stressGainMultiplier;
    needs.stress = clamp(needs.stress + pressureGain * dt, 0, 100);
  }

  const prevStress = creature._lastStressLevel ?? needs.stress;
  const stressDelta = needs.stress - prevStress;
  creature._lastStressLevel = needs.stress;
  if (world && stressDelta >= CreatureConfig.MEMORY.STRESS_SPIKE_THRESHOLD &&
    needs.stress >= CreatureConfig.MEMORY.STRESS_THRESHOLD) {
    if (creature.memory && world.t - (creature.memory.lastDangerAt ?? -Infinity) >= CreatureConfig.MEMORY.DANGER_COOLDOWN) {
      creature.rememberLocation?.(creature.x, creature.y, 'danger', clamp(stressDelta / 40, 0.2, 0.8), world.t);
      creature.memory.lastDangerAt = world.t;
    }
  }
}

export function selectGoal(creature, world) {
  const needs = creature.needs;
  const senses = creature.senses;
  const goal = creature.goal;
  if (!needs || !senses || !goal) return;

  const dietRole = creature.traits?.dietRole ?? 'herbivore';
  const roleTuning = CreatureAgentTuning.ROLES?.[dietRole] ?? {};

  const hungerScore = clamp(needs.hunger / 100, 0, 1);
  const energyScore = clamp(1 - needs.energy / 100, 0, 1);
  const socialScore = clamp(needs.socialDrive / 100, 0, 1);
  const stressScore = clamp(needs.stress / 100, 0, 1);
  const dayNight = world?.dayNightState;
  const dayFactor = dayNight ? clamp((dayNight.light - 0.2) / 0.8, 0, 1) : 1;
  const restBias = CreatureAgentTuning.DAY_NIGHT.REST_NIGHT_BIAS +
    (CreatureAgentTuning.DAY_NIGHT.REST_DAY_BIAS - CreatureAgentTuning.DAY_NIGHT.REST_NIGHT_BIAS) * dayFactor;
  const eatBias = CreatureAgentTuning.DAY_NIGHT.EAT_NIGHT_BIAS +
    (CreatureAgentTuning.DAY_NIGHT.EAT_DAY_BIAS - CreatureAgentTuning.DAY_NIGHT.EAT_NIGHT_BIAS) * dayFactor;
  const wanderBias = CreatureAgentTuning.DAY_NIGHT.WANDER_NIGHT_BIAS +
    (CreatureAgentTuning.DAY_NIGHT.WANDER_DAY_BIAS - CreatureAgentTuning.DAY_NIGHT.WANDER_NIGHT_BIAS) * dayFactor;

  const memoryFood = !senses.food && creature._selectMemory ? creature._selectMemory('food', world) : null;
  const memoryCalm = !senses.restZone && creature._selectMemory ? creature._selectMemory('calm', world) : null;
  const eatSourceFactor = senses.food ? 1 : memoryFood ? 0.6 : 0.3;
  const restSourceFactor = senses.restZone ? 1 : memoryCalm ? 0.6 : 0.4;
  let eatScore = hungerScore * eatSourceFactor * CreatureAgentTuning.GOALS.SCORE_BIAS.EAT * eatBias;
  let restScore = (energyScore * 0.9 + stressScore * 0.3) *
    restSourceFactor * CreatureAgentTuning.GOALS.SCORE_BIAS.REST * restBias;
  let mateScore = socialScore * (senses.mate ? 1 : 0.2) * CreatureAgentTuning.GOALS.SCORE_BIAS.SEEK_MATE;
  if (needs.stress > CreatureAgentTuning.MATING.STRESS_MAX) {
    mateScore *= 0.1;
  }
  if (goal.mateCooldown > 0) {
    mateScore = 0;
  }
  if (creature.lifeStage === 'elder') {
    restScore *= 1.2;
    mateScore *= CreatureAgentTuning.MATING.ELDER_GOAL_MULT;
  }

  let wanderScore = CreatureAgentTuning.GOALS.SCORE_BIAS.WANDER * wanderBias;

  const nest = senses.homeNest || senses.nest;
  if (nest) {
    let nestBias = 1 + creature.territoryAffinity * 0.3;
    if (creature.lifeStage === 'baby') {
      nestBias += 0.35;
    } else if (creature.lifeStage === 'elder') {
      nestBias += 0.25;
    } else {
      nestBias += 0.12;
    }
    restScore *= nestBias;
    if (creature.lifeStage === 'adult') {
      mateScore *= 1.08;
    }
  }

  if (senses.corpse && dietRole === 'scavenger') {
    eatScore *= roleTuning.corpseBias ?? 1.25;
  }
  eatScore *= roleTuning.eatBias ?? 1;
  restScore *= roleTuning.restBias ?? 1;
  mateScore *= roleTuning.mateBias ?? 1;
  wanderScore *= roleTuning.wanderBias ?? 1;

  const scores = [
    { key: 'EAT', score: eatScore },
    { key: 'REST', score: restScore },
    { key: 'SEEK_MATE', score: mateScore },
    { key: 'WANDER', score: wanderScore }
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const now = world?.t ?? 0;
  const timeSinceChange = now - (goal.lastChange ?? 0);
  const shouldHold = timeSinceChange < CreatureAgentTuning.GOALS.MIN_DURATION &&
    (goal.score ?? 0) >= best.score - CreatureAgentTuning.GOALS.SWITCH_HYSTERESIS;

  if (!shouldHold && goal.current !== best.key) {
    goal.current = best.key;
    goal.lastChange = now;
  }
  goal.score = best.score;

  if (needs.hunger > 70) {
    creature.setMood('🍽️', 0.5);
  } else if (needs.energy < 30) {
    creature.setMood('😴', 0.5);
  } else if (needs.socialDrive > 75 && goal.current === 'SEEK_MATE') {
    creature.setMood('💞', 0.5);
  }
}

export function updateSteeringForces(creature, world) {
  if (!creature._separation || !creature._edgeAvoid) return;
  const separation = creature._separation;
  separation.x = 0;
  separation.y = 0;

  const radius = CreatureAgentTuning.MOVEMENT.SEPARATION_RADIUS;
  const neighbors = world?.creatureManager?.queryCreaturesFast
    ? world.creatureManager.queryCreaturesFast(creature.x, creature.y, radius)
    : world?.queryCreatures?.(creature.x, creature.y, radius) || [];
  for (const other of neighbors) {
    if (!other || other === creature) continue;
    const dx = creature.x - other.x;
    const dy = creature.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001) continue;
    const strength = clamp((radius - dist) / radius, 0, 1);
    separation.x += (dx / dist) * strength;
    separation.y += (dy / dist) * strength;
  }
  separation.x *= CreatureAgentTuning.MOVEMENT.SEPARATION_STRENGTH;
  separation.y *= CreatureAgentTuning.MOVEMENT.SEPARATION_STRENGTH;

  const edgeAvoid = creature._edgeAvoid;
  edgeAvoid.x = 0;
  edgeAvoid.y = 0;
  const margin = CreatureAgentTuning.MOVEMENT.EDGE_AVOID_MARGIN;
  if (creature.x < margin) edgeAvoid.x += (margin - creature.x) / margin;
  if (creature.x > world.width - margin) edgeAvoid.x -= (creature.x - (world.width - margin)) / margin;
  if (creature.y < margin) edgeAvoid.y += (margin - creature.y) / margin;
  if (creature.y > world.height - margin) edgeAvoid.y -= (creature.y - (world.height - margin)) / margin;
  edgeAvoid.x *= CreatureAgentTuning.MOVEMENT.EDGE_AVOID_FORCE;
  edgeAvoid.y *= CreatureAgentTuning.MOVEMENT.EDGE_AVOID_FORCE;
}

export function isMateCompatible(creature, other) {
  if (!other || other === creature || !other.alive) return false;
  if (creature.ageStage !== 'adult' || other.ageStage !== 'adult') return false;
  const diet = creature.genes.diet ?? (creature.genes.predator ? 1.0 : 0.0);
  const otherDiet = other.genes.diet ?? (other.genes.predator ? 1.0 : 0.0);
  if (Math.abs(diet - otherDiet) > 0.4) return false;
  return true;
}

export function applyRestRecovery(creature, dt, world, { inRestZone = false, nest = null } = {}) {
  if (!inRestZone && !nest) return;
  const nestComfort = nest ? (nest.comfortEffective ?? nest.comfort ?? CreatureAgentTuning.NESTS.COMFORT) : 1;
  const restBonus = nest ? CreatureAgentTuning.NESTS.REST_BONUS : 1;
  const energyGain = CreatureAgentTuning.REST_ZONES.ENERGY_RECOVERY * restBonus * nestComfort * dt;
  creature.energy = Math.min((creature.energy ?? 0) + energyGain, CreatureAgentTuning.NEEDS.MAX);
  if (creature.needs) {
    creature.needs.energy = clamp(creature.energy ?? creature.needs.energy, 0, 100);
    const stressRecovery = CreatureAgentTuning.REST_ZONES.STRESS_RECOVERY * (nest ? 1 + nestComfort * 0.4 : 1);
    creature.needs.stress = clamp(creature.needs.stress - stressRecovery * dt, 0, 100);
    if (nest?.overcrowded) {
      creature.needs.stress = clamp(
        creature.needs.stress + CreatureAgentTuning.NESTS.OVERCROWD_PENALTY * dt,
        0,
        100
      );
    }
  }
  world?.creatureEcosystem?.registerEvent?.(creature, 'rest');
  if (creature.memory && creature.needs?.stress <= CreatureConfig.MEMORY.CALM_STRESS_MAX) {
    const now = world?.t ?? 0;
    if (now - (creature.memory.lastCalmAt ?? -Infinity) >= CreatureConfig.MEMORY.CALM_COOLDOWN) {
      creature.rememberLocation?.(creature.x, creature.y, 'calm', 0.55, now);
      creature.memory.lastCalmAt = now;
    }
    if (creature.memory.focus?.tag === 'calm') {
      creature._reinforceMemory?.(creature.memory.focus.entry, CreatureConfig.MEMORY.REINFORCE_AMOUNT * 0.6, now);
      creature.memory.focus = null;
    }
  }
}

export function updateRestHome(creature, dt, world, nest = null) {
  if (!world) return;
  const now = world.t ?? 0;
  const region = world.getRegionAt?.(creature.x, creature.y);
  if (region?.id != null) {
    creature.homeRegionId = region.id;
  }

  const shouldTrack = (creature.needs?.stress ?? 100) <= CreatureAgentTuning.NESTS.CREATE_STRESS_MAX;
  if (!shouldTrack) {
    creature._restNestTimer = 0;
    return;
  }
  creature._restNestTimer += dt;

  if (nest && nest.id) {
    creature.homeNestId = nest.id;
  }

  if (creature.migration?.active && creature.migration.targetRegionId != null) {
    if (region?.id === creature.migration.targetRegionId) {
      creature.migration.settleTimer = (creature.migration.settleTimer ?? 0) + dt;
      if (creature.migration.settleTimer >= CreatureAgentTuning.MIGRATION.SETTLE_REST_TIME &&
        (creature.needs?.stress ?? 100) < CreatureAgentTuning.MIGRATION.STRESS_TRIGGER) {
        creature.migration.active = false;
        creature.migration.settled = true;
        creature.migration.targetRegionId = region.id;
        creature.migration.recentUntil = now + CreatureAgentTuning.MIGRATION.RECENTLY_MIGRATED;
        creature.migration.settleTimer = 0;
        creature.migration.bias = null;
        creature.migration.target = null;
        world.registerMigrationSettled?.(creature, region);

        if (!nest && world.addNest) {
          const newNest = world.addNest(creature.x, creature.y, { createdBy: creature.id });
          if (newNest) {
            creature.homeNestId = newNest.id;
            nest = newNest;
          }
        }
        if (nest) {
          creature.rememberLocation?.(nest.x, nest.y, 'nest', CreatureAgentTuning.NESTS.MEMORY_STRENGTH, now);
          if (creature.memory) {
            creature.memory.lastNestAt = now;
          }
          creature._restNestTimer = 0;
        }
      }
    } else {
      creature.migration.settleTimer = 0;
    }
  }

  if (creature._restNestTimer < CreatureAgentTuning.NESTS.CREATE_MIN_REST) return;
  if (creature.lifeStage === 'baby') return;
  if ((creature.needs?.energy ?? 0) < CreatureAgentTuning.NESTS.CREATE_ENERGY_MIN) return;
  if (now - (creature.memory?.lastNestAt ?? -Infinity) < CreatureAgentTuning.NESTS.CREATE_COOLDOWN) return;

  if (!nest && world.addNest) {
    const newNest = world.addNest(creature.x, creature.y, { createdBy: creature.id });
    if (newNest) {
      creature.homeNestId = newNest.id;
      nest = newNest;
    }
  }

  if (nest) {
    creature.rememberLocation?.(nest.x, nest.y, 'nest', CreatureAgentTuning.NESTS.MEMORY_STRENGTH, now);
    if (creature.memory) {
      creature.memory.lastNestAt = now;
    }
    creature.territoryAffinity = clamp(creature.territoryAffinity + 0.05, 0.1, 1);
  }

  creature._restNestTimer = 0;
}

export function updateMatingBond(creature, world, mate, dt, bondDuration) {
  if (!creature.goal || !mate?.goal) return false;
  if (creature.goal.bondingWith !== mate.id) {
    creature.goal.bondingWith = mate.id;
    creature.goal.bondTimer = 0;
    creature.goal.bondAnnounced = false;
  }
  if (!creature.goal.bondAnnounced) {
    creature.goal.bondAnnounced = true;
    try {
      eventSystem.emit(GameEvents.CREATURE_BOND, {
        creature: creature,
        mateId: mate.id,
        worldTime: world?.t ?? 0
      });
    } catch (error) {
      console.warn('Failed to emit bond event:', error);
    }
  }
  creature.goal.bondTimer += dt;
  if (mate.goal.bondingWith !== creature.id) {
    mate.goal.bondingWith = creature.id;
    mate.goal.bondTimer = Math.max(mate.goal.bondTimer ?? 0, creature.goal.bondTimer * 0.5);
  }
  return creature.goal.bondTimer >= bondDuration;
}

export function applyHungerRelief(creature, energyGain) {
  if (!creature.needs || !Number.isFinite(energyGain)) return;
  creature.needs.hunger = clamp(
    creature.needs.hunger - energyGain * CreatureAgentTuning.NEEDS.HUNGER_RELIEF_PER_ENERGY,
    0,
    100
  );
  creature.needs.lastEatAt = creature._lastWorld?.t ?? creature.needs.lastEatAt;
  if (creature.needs.hunger < 45) {
    creature._returnHomeUntil = (creature._lastWorld?.t ?? 0) + CreatureAgentTuning.TERRITORY.HOME_RETURN_DURATION;
  }
}

export function getHomeBias(creature, world, goal) {
  if (!world?.getRegionById || !creature.homeRegionId) return null;
  const affinity = creature.territoryAffinity ?? 0;
  if (affinity <= 0.05) return null;

  const region = world.getRegionById(creature.homeRegionId);
  if (!region) return null;

  const dx = region.x - creature.x;
  const dy = region.y - creature.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.01) return null;

  const now = world.t ?? 0;
  const returning = now < (creature._returnHomeUntil ?? -Infinity);
  const stressed = (creature.needs?.stress ?? 0) >= CreatureAgentTuning.MIGRATION.STRESS_TRIGGER;
  const goalAllows = goal === 'WANDER' || goal === 'REST' || goal === 'SEEK_MATE' || returning || stressed;
  if (!goalAllows) return null;

  const homeRadius = (region.size ?? CreatureAgentTuning.TERRITORY.REGION_SIZE) * 0.5 *
    CreatureAgentTuning.TERRITORY.HOME_RADIUS_MULT;
  if (dist < homeRadius * 0.6 && !returning && !stressed) return null;

  const baseStrength = returning ? 0.55 : stressed ? 0.45 : 0.28;
  const strength = baseStrength * affinity;
  return { x: (dx / dist) * strength, y: (dy / dist) * strength };
}
