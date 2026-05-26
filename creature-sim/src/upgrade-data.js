import { clamp } from './utils.js';

export const READABILITY_MODES = [
  { id: 'normal', label: 'Normal', note: 'Balanced default contrast and effects.' },
  { id: 'cozy', label: 'Cozy', note: 'Warmer, softer world treatment.' },
  { id: 'contrast', label: 'High Contrast', note: 'Sharper creature and food readability.' },
  { id: 'analytics', label: 'Analytics', note: 'Prioritizes overlays and readable telemetry.' },
  { id: 'minimal', label: 'Minimal', note: 'Quiet world with fewer decorative layers.' }
];

export const FOLLOW_TARGET_MODES = [
  { id: 'youngest', label: 'Youngest', icon: '🌱' },
  { id: 'stressed', label: 'Most Stressed', icon: '⚠️' },
  { id: 'alpha', label: 'Alpha', icon: '👑' },
  { id: 'hunter', label: 'Hunter', icon: '🦁' },
  { id: 'lineage', label: 'Lineage Founder', icon: '🧬' }
];

export const SANDBOX_RECIPES = [
  {
    id: 'peaceful_meadow',
    label: 'Peaceful Meadow',
    icon: '🌿',
    description: 'Dense food, few predators, low-stress observation.',
    setup: { herbivore: 42, omnivore: 8, predator: 2, aquatic: 4, food: 280, calmZones: 3, props: ['spring', 'bounce'] }
  },
  {
    id: 'predator_stress',
    label: 'Predator Stress Test',
    icon: '🦁',
    description: 'Enough predators to test herd stability and player interventions.',
    setup: { herbivore: 48, omnivore: 6, predator: 9, food: 220, calmZones: 1, props: ['fan', 'conveyor'] }
  },
  {
    id: 'migration_lab',
    label: 'Migration Lab',
    icon: '🧭',
    description: 'Large map pressure with food trails and nest/territory visibility.',
    setup: { herbivore: 34, omnivore: 10, predator: 4, flying: 5, burrowing: 5, food: 240, calmZones: 2, props: ['slope', 'fan'] }
  },
  {
    id: 'tiny_toybox',
    label: 'Tiny Toybox',
    icon: '🧩',
    description: 'Compact chaos with props placed around a small creature cluster.',
    setup: { herbivore: 24, omnivore: 5, predator: 2, food: 170, calmZones: 2, props: ['bounce', 'spring', 'spinner', 'seesaw', 'launch'] }
  }
];

export const DISCOVERY_MILESTONES = [
  { id: 'first_birth', label: 'First Birth', icon: '🍼' },
  { id: 'first_elder', label: 'First Elder', icon: '⭐' },
  { id: 'first_mutation', label: 'First Mutation', icon: '🧬' },
  { id: 'first_hunt', label: 'First Hunt', icon: '🦁' },
  { id: 'first_migration', label: 'First Migration', icon: '🧭' },
  { id: 'first_scenario_complete', label: 'Scenario Complete', icon: '🏆' }
];

const STAGE_LABELS = {
  baby: { label: 'Baby', icon: '🍼' },
  juvenile: { label: 'Juvenile', icon: '🌱' },
  adult: { label: 'Adult', icon: '•' },
  elder: { label: 'Elder', icon: '⭐' }
};

export function getLifeStageDisplay(creature = {}) {
  const stage = creature.ageStage || creature.lifeStage || 'adult';
  return {
    id: stage,
    ...(STAGE_LABELS[stage] || { label: String(stage).replaceAll('_', ' '), icon: '•' })
  };
}

export function getCreatureEmotion(creature = {}) {
  const hunger = Number(creature.needs?.hunger ?? 0);
  const stress = Number(creature.needs?.stress ?? creature.ecosystem?.stress ?? 0);
  const social = Number(creature.needs?.social ?? 0);
  const energy = Number(creature.energy ?? creature.needs?.energy ?? 0);
  const goal = creature.goal?.current || creature.currentGoal || creature.state || '';

  if (creature.alive === false) return { id: 'gone', label: 'Gone', icon: '·', tone: 'muted' };
  if (stress >= 68) return { id: 'scared', label: 'Scared', icon: '!', tone: 'danger' };
  if (hunger >= 72 || energy < 14) return { id: 'hungry', label: 'Hungry', icon: '+', tone: 'warning' };
  if (goal === 'rest' || energy < 28) return { id: 'tired', label: 'Tired', icon: 'z', tone: 'muted' };
  if (social >= 65 || goal === 'mate') return { id: 'bonded', label: 'Bonded', icon: '♥', tone: 'warm' };
  if (goal === 'wander' || Number(creature.needs?.curiosity ?? 0) > 60) return { id: 'curious', label: 'Curious', icon: '?', tone: 'accent' };
  return { id: 'steady', label: 'Steady', icon: '•', tone: 'calm' };
}

export function buildBondsSummary(creature = {}, world = null) {
  const parentId = creature.parentId ?? null;
  const children = Array.isArray(world?.creatures)
    ? world.creatures.filter(item => item?.parentId === creature.id).slice(0, 4).map(item => item.id)
    : [];
  const bondCount = Array.isArray(creature.socialBonds)
    ? creature.socialBonds.length
    : Number(creature.bonds?.length ?? 0);

  return {
    parentId,
    children,
    bondCount,
    label: [
      parentId ? `Parent #${parentId}` : 'Founder',
      children.length ? `${children.length} children` : null,
      bondCount ? `${bondCount} bonds` : null
    ].filter(Boolean).join(' · ')
  };
}

export function buildEcosystemStory(world = null, playableSnapshot = null) {
  const creatures = world?.creatures || [];
  const alive = creatures.filter(creature => creature?.alive !== false);
  const predators = alive.filter(creature => creature.genes?.predator || (creature.genes?.diet ?? 0) >= 0.7).length;
  const food = world?.food?.length || 0;
  const stress = alive.length
    ? alive.reduce((sum, creature) => sum + Number(creature.needs?.stress ?? creature.ecosystem?.stress ?? 0), 0) / alive.length
    : 0;
  const foodPerCreature = alive.length ? food / alive.length : 0;
  const predatorRatio = alive.length ? predators / alive.length : 0;

  let level = 'stable';
  let headline = 'Ecosystem is steady';
  let action = 'Watch the herd and respond to the next event.';
  if (alive.length < 18) {
    level = 'critical';
    headline = 'Population is fragile';
    action = 'Spawn grazers or protect the nearest family line.';
  } else if (foodPerCreature < 3) {
    level = 'strained';
    headline = 'Food pressure is rising';
    action = 'Paint food near the largest cluster.';
  } else if (stress > 62) {
    level = 'strained';
    headline = 'Stress is spreading';
    action = 'Place a calm zone near the noisy cluster.';
  } else if (predatorRatio > 0.22) {
    level = 'watch';
    headline = 'Predators are shaping the herd';
    action = 'Follow a hunter and keep prey groups fed.';
  } else if (playableSnapshot?.state === 'complete') {
    level = 'complete';
    headline = 'Scenario complete';
    action = 'Save the seed or try a harder preset.';
  }

  return {
    level,
    headline,
    action,
    metrics: {
      alive: alive.length,
      predators,
      food,
      stress: Number(stress.toFixed(1)),
      foodPerCreature: Number(foodPerCreature.toFixed(2))
    }
  };
}

export function buildObjectiveRail(playableSnapshot = null, goals = []) {
  if (playableSnapshot?.active) {
    return {
      icon: playableSnapshot.scenario?.icon || '🎯',
      title: playableSnapshot.scenario?.name || 'Scenario',
      progress: clamp(Number(playableSnapshot.progress ?? 0), 0, 100),
      action: playableSnapshot.director?.nextAction ||
        playableSnapshot.scenario?.steps?.[0] ||
        playableSnapshot.scenario?.objective ||
        'Keep the ecosystem stable.'
    };
  }

  const activeGoal = goals.find(goal => !goal.completed) || goals[0] || null;
  if (activeGoal) {
    const actionHints = {
      population: 'Feed clusters and protect new births.',
      predator_kills: 'Watch hunters without letting prey collapse.',
      food_collected: 'Paint food near moving groups.',
      births: 'Keep adults fed, calm, and close together.',
      survival_time: 'Stay in Watch Mode and respond to pressure.',
      manual_spawns: 'Open Spawn and add a balanced creature mix.',
      creature_throws: 'Use Inspect, drag, then release gently.',
      prop_triggers: 'Place toys near the herd edge.',
      prop_places: 'Open Props and build near open ground.',
      god_actions: 'Use God Mode for food, calm, or cleanup.',
      aquatic_alive: 'Keep wetland creatures fed and uncrowded.'
    };
    return {
      icon: activeGoal.icon || '🎯',
      title: activeGoal.description || 'Session goal',
      progress: Math.round(clamp(Number(activeGoal.progress ?? 0), 0, 1) * 100),
      action: actionHints[activeGoal.type] || 'Take the next visible action.'
    };
  }

  return {
    icon: '👁️',
    title: 'Watch the ecosystem',
    progress: 0,
    action: 'Select a creature, follow Watch Mode, or start a scenario.'
  };
}

export function buildScenarioResult(snapshot = null) {
  if (!snapshot?.active) return null;
  const metrics = snapshot.metrics || {};
  const survival = Math.round(clamp((metrics.alive || 0) / Math.max(1, snapshot.scenario?.minAlive || 25), 0, 1.4) * 100);
  const foodStability = Math.round(clamp((metrics.foodPerCreature || 0) / 6, 0, 1) * 100);
  const stressScore = Math.round(clamp(1 - (metrics.averageStress || 0) / 100, 0, 1) * 100);
  const discoveries = [metrics.variants ? 'Variants' : null, metrics.hunts ? 'Hunts' : null, metrics.props ? 'Props' : null].filter(Boolean);
  const score = Math.round((survival * 0.45) + (foodStability * 0.25) + (stressScore * 0.3));
  const medal = score >= 90 ? 'Gold' : score >= 72 ? 'Silver' : score >= 55 ? 'Bronze' : 'Practice';
  return { survival, foodStability, stressScore, discoveries, score, medal };
}

export function buildWorldPostcard({ world, playableSnapshot, moments, seed } = {}) {
  const story = buildEcosystemStory(world, playableSnapshot);
  const season = world?.environment?.currentSeason || world?.currentSeason || 'unknown';
  return {
    title: playableSnapshot?.scenario?.name || 'Creature Sandbox',
    seed: seed || '',
    population: story.metrics.alive,
    predators: story.metrics.predators,
    food: story.metrics.food,
    season,
    strongestEvent: moments?.moments?.[0]?.text || story.headline,
    caption: `${story.headline}. ${story.action}`
  };
}
