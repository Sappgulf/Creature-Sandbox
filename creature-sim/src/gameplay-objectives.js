import { clamp } from './utils.js';
import { geneValue, isPredatorFromGenes } from './creature-genetics-helpers.js';

export { geneValue };

export function isPredatorCreature(creature) {
  if (!creature?.genes) return false;
  return isPredatorFromGenes(creature.genes);
}

export function collectGameplayMetrics(world, counters = {}) {
  const creatures = world?.creatures || [];
  const metrics = {
    totalCreatures: creatures.length,
    alive: 0,
    population: 0,
    predators: 0,
    herbivores: 0,
    babies: 0,
    aquatic: 0,
    aquaticAlive: 0,
    flying: 0,
    flyingAlive: 0,
    burrowing: 0,
    burrowingAlive: 0,
    variants: 0,
    variantsAlive: 0,
    food: world?.food?.length || 0,
    foodAvailable: world?.food?.length || 0,
    props: world?.sandbox?.props?.length || 0,
    restZones: (world?.restZones?.length || 0) + (world?.environment?.calmZones?.length || 0),
    averageStress: 0,
    averageHunger: 0,
    averageEnergy: 0,
    stress: 0,
    hunger: 0,
    energy: 0,
    predatorKills: 0,
    hunts: 0,
    foodCollected: 0,
    births: 0,
    time: Number(world?.t ?? 0),
    maxGeneration: 0,
    manualSpawns: Number(counters.manualSpawns || 0),
    creatureThrows: Number(counters.creatureThrows || 0),
    propTriggers: Number(counters.propTriggers || 0),
    propPlacements: Number(counters.propPlacements || 0),
    godActions: Number(counters.godActions || 0)
  };

  let stressTotal = 0;
  let hungerTotal = 0;
  let energyTotal = 0;

  for (const creature of creatures) {
    if (!creature) continue;

    const stats = creature.stats || {};
    if (isPredatorCreature(creature)) {
      metrics.predatorKills += Number(stats.kills || 0);
    }
    metrics.hunts += Number(stats.kills || 0);
    metrics.foodCollected += Number(stats.food || 0);
    metrics.births += Number(stats.births || 0);

    if (world?.lineageTracker?.generation && creature.id != null) {
      metrics.maxGeneration = Math.max(metrics.maxGeneration, world.lineageTracker.generation(world, creature.id));
    } else if (Number.isFinite(creature.generation)) {
      metrics.maxGeneration = Math.max(metrics.maxGeneration, creature.generation);
    }

    if (creature.alive === false) continue;

    metrics.alive += 1;
    const predator = isPredatorCreature(creature);
    if (predator) metrics.predators += 1;
    else metrics.herbivores += 1;

    if (creature.lifeStage === 'baby' || creature.ageStage === 'baby') metrics.babies += 1;

    const aquatic = geneValue(creature.genes, 'aquatic', 0) >= 0.6;
    const flying = geneValue(creature.genes, 'flying', 0) >= 0.6 || creature.traits?.creatureType === 'flying';
    const burrowing = geneValue(creature.genes, 'burrowing', 0) >= 0.6 || creature.traits?.creatureType === 'burrowing';

    if (aquatic) {
      metrics.aquatic += 1;
      metrics.aquaticAlive += 1;
    }
    if (flying) {
      metrics.flying += 1;
      metrics.flyingAlive += 1;
    }
    if (burrowing) {
      metrics.burrowing += 1;
      metrics.burrowingAlive += 1;
    }

    stressTotal += Number(creature.needs?.stress ?? creature.ecosystem?.stress ?? 0);
    hungerTotal += Number(creature.needs?.hunger ?? 0);
    energyTotal += Number(creature.energy ?? creature.needs?.energy ?? 0);
  }

  metrics.population = metrics.alive;
  metrics.variants = [metrics.aquaticAlive > 0, metrics.flyingAlive > 0, metrics.burrowingAlive > 0].filter(
    Boolean
  ).length;
  metrics.variantsAlive = metrics.variants;
  metrics.averageStress = metrics.alive ? stressTotal / metrics.alive : 0;
  metrics.averageHunger = metrics.alive ? hungerTotal / metrics.alive : 0;
  metrics.averageEnergy = metrics.alive ? energyTotal / metrics.alive : 0;
  metrics.stress = metrics.averageStress;
  metrics.hunger = metrics.averageHunger;
  metrics.energy = metrics.averageEnergy;
  metrics.foodPerCreature = metrics.alive ? Number((metrics.food / metrics.alive).toFixed(2)) : 0;

  return metrics;
}

export function getObjectiveProgress(type, target, metrics = {}) {
  const safeTarget = Math.max(1, Number(target) || 1);
  switch (type) {
    case 'population':
      return metrics.population / safeTarget;
    case 'predator_count':
      return metrics.predators / safeTarget;
    case 'predator_kills':
      return metrics.predatorKills / safeTarget;
    case 'food_collected':
      return metrics.foodCollected / safeTarget;
    case 'births':
      return metrics.births / safeTarget;
    case 'survival_time':
      return metrics.time / safeTarget;
    case 'manual_spawns':
      return metrics.manualSpawns / safeTarget;
    case 'creature_throws':
      return metrics.creatureThrows / safeTarget;
    case 'prop_triggers':
      return metrics.propTriggers / safeTarget;
    case 'prop_places':
      return metrics.propPlacements / safeTarget;
    case 'god_actions':
      return metrics.godActions / safeTarget;
    case 'aquatic_alive':
    case 'aquatic_creatures':
      return metrics.aquaticAlive / safeTarget;
    case 'food_available':
      return metrics.foodAvailable / safeTarget;
    case 'variant_alive':
      return metrics.variantsAlive / safeTarget;
    case 'lineage_generation':
      return metrics.maxGeneration / safeTarget;
    case 'stress_cap':
      // Progress climbs as average stress drops toward (and stays under) the cap.
      return 1 - Math.max(0, (metrics.averageStress ?? metrics.stress ?? 0) - safeTarget) / 60;
    default:
      return 0;
  }
}

export function clampObjectiveProgress(type, target, metrics = {}) {
  return clamp(getObjectiveProgress(type, target, metrics), 0, 1);
}
