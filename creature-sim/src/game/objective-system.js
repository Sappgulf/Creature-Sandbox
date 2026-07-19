import { collectGameplayMetrics, getObjectiveProgress } from '../gameplay-objectives.js';
import { clamp } from '../utils.js';

const OBJECTIVE_ALIASES = Object.freeze({
  timed: 'survival_time',
  timer: 'survival_time',
  survival: 'survival_time',
  breeding: 'births',
  breeding_goal: 'births',
  predator_control: 'predator_control',
  biome_health: 'biome_health'
});

const OBJECTIVE_LABELS = Object.freeze({
  survival_time: 'Survive',
  population: 'Population',
  births: 'Breeding',
  predator_count: 'Predators',
  predator_kills: 'Hunts',
  predator_control: 'Predator control',
  biome_health: 'Biome health',
  food_available: 'Food reserve',
  variant_alive: 'Variants',
  lineage_generation: 'Lineage',
  prop_places: 'Props',
  god_actions: 'Interventions',
  stress_cap: 'Calm biome'
});

const OBJECTIVE_ICONS = Object.freeze({
  survival_time: '⏳',
  population: '🐾',
  births: '🐣',
  predator_count: '🦁',
  predator_kills: '⚔️',
  predator_control: '⚖️',
  biome_health: '🌿',
  food_available: '🍃',
  variant_alive: '🧬',
  lineage_generation: '🌳',
  prop_places: '🧩',
  god_actions: '✨',
  stress_cap: '🌤️'
});

function normalizeType(type) {
  const safeType = String(type || 'population');
  return OBJECTIVE_ALIASES[safeType] || safeType;
}

function safeTarget(target, fallback = 1) {
  if (target && typeof target === 'object') return target;
  const value = Number(target);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function biomeHealthScore(metrics = {}) {
  const foodScore = clamp((Number(metrics.foodPerCreature || 0) - 0.8) / 3.6, 0, 1);
  const stressScore = clamp(1 - Number(metrics.averageStress || 0) / 100, 0, 1);
  const hungerScore = clamp(1 - Number(metrics.averageHunger || 0) / 100, 0, 1);
  const energyScore = clamp(Number(metrics.averageEnergy || 0) / 100, 0, 1);
  const diversityScore = clamp(Number(metrics.variantsAlive || 0) / 3, 0, 1);
  const restScore = clamp(Number(metrics.restZones || 0) / 3, 0, 1);
  return clamp(
    foodScore * 0.26 +
      stressScore * 0.24 +
      hungerScore * 0.18 +
      energyScore * 0.14 +
      diversityScore * 0.1 +
      restScore * 0.08,
    0,
    1
  );
}

function predatorControlScore(metrics = {}, target = {}) {
  const alive = Math.max(1, Number(metrics.population || metrics.alive || 0));
  const predators = Number(metrics.predators || 0);
  const maxPredators = Number(target.maxPredators ?? target.max ?? Math.max(2, Math.ceil(alive * 0.22)));
  const minPredators = Number(target.minPredators ?? target.min ?? 0);
  const maxRatio = Number(target.maxRatio ?? 0.28);
  const ratio = predators / alive;

  const upperScore = maxPredators > 0 ? clamp(1 - Math.max(0, predators - maxPredators) / maxPredators, 0, 1) : 1;
  const lowerScore = minPredators > 0 ? clamp(predators / minPredators, 0, 1) : 1;
  const ratioScore = clamp(1 - Math.max(0, ratio - maxRatio) / maxRatio, 0, 1);
  return clamp(Math.min(upperScore, lowerScore, ratioScore), 0, 1);
}

function progressForObjective(objective, metrics = {}) {
  const type = normalizeType(objective.type);
  const target = safeTarget(objective.target, type === 'biome_health' ? 0.72 : 1);

  if (type === 'biome_health') {
    const targetScore = typeof target === 'object' ? Number(target.score ?? target.min ?? 0.72) : Number(target);
    return biomeHealthScore(metrics) / Math.max(0.1, targetScore || 0.72);
  }

  if (type === 'predator_control') {
    return predatorControlScore(metrics, typeof target === 'object' ? target : { maxPredators: target });
  }

  if (type === 'survival_time' && Number.isFinite(metrics.elapsed)) {
    return metrics.elapsed / Math.max(1, Number(target) || 1);
  }

  return getObjectiveProgress(type, target, metrics);
}

function formatValue(type, target, metrics = {}, progress = 0) {
  const normalized = normalizeType(type);
  if (normalized === 'survival_time') {
    const elapsed = Number(metrics.elapsed ?? metrics.time ?? 0);
    return `${Math.floor(elapsed)}s / ${Math.floor(Number(target) || 0)}s`;
  }
  if (normalized === 'biome_health') {
    return `${Math.round(biomeHealthScore(metrics) * 100)}%`;
  }
  if (normalized === 'predator_control') {
    return `${Number(metrics.predators || 0)} predators`;
  }
  if (normalized === 'lineage_generation') {
    return `Gen ${Number(metrics.maxGeneration || 0)} / ${Number(target || 0)}`;
  }
  if (normalized === 'food_available') {
    return `${Number(metrics.foodAvailable || metrics.food || 0)} / ${Number(target || 0)}`;
  }
  return `${Math.round(clamp(progress, 0, 1) * Number(target || 1))} / ${Number(target || 0)}`;
}

export class ObjectiveSystem {
  constructor() {
    this.lastSnapshot = this.emptySnapshot();
  }

  emptySnapshot() {
    return {
      metrics: {},
      cards: [],
      progress: 0,
      completed: 0,
      total: 0,
      mobileSummary: 'No active objective'
    };
  }

  normalizeObjective(goal = {}) {
    const type = normalizeType(goal.type);
    return {
      id: goal.id || `${type}-${goal.target ?? 'objective'}`,
      type,
      icon: goal.icon || OBJECTIVE_ICONS[type] || '🎯',
      label: goal.label || goal.title || OBJECTIVE_LABELS[type] || 'Objective',
      description: goal.description || goal.objective || OBJECTIVE_LABELS[type] || 'Objective',
      target: safeTarget(goal.target, type === 'biome_health' ? 0.72 : 1),
      required: goal.required !== false,
      completed: !!goal.completed
    };
  }

  evaluate(world, objectives = [], counters = {}, context = {}) {
    const metrics = collectGameplayMetrics(world, counters);
    if (Number.isFinite(context.elapsed)) {
      metrics.elapsed = Number(context.elapsed);
    }

    const cards = objectives.filter(Boolean).map(goal => this.toCard(this.normalizeObjective(goal), metrics));
    const completed = cards.filter(card => card.completed).length;
    const progress = cards.length ? cards.reduce((sum, card) => sum + card.progress, 0) / cards.length : 0;

    this.lastSnapshot = {
      metrics,
      cards,
      progress,
      completed,
      total: cards.length,
      mobileSummary: this.buildMobileSummary(cards)
    };
    return this.lastSnapshot;
  }

  toCard(objective, metrics) {
    const rawProgress = progressForObjective(objective, metrics);
    const progress = clamp(rawProgress, 0, 1);
    const completed = objective.completed || progress >= 1;
    return {
      ...objective,
      progress,
      completed,
      value: formatValue(objective.type, objective.target, metrics, progress),
      level: completed ? 'complete' : progress >= 0.72 ? 'watch' : 'active'
    };
  }

  buildMobileSummary(cards = []) {
    if (!cards.length) return 'No active objective';
    const active = cards.find(card => !card.completed) || cards[0];
    return `${active.icon} ${active.label}: ${Math.round(active.progress * 100)}%`;
  }

  getSnapshot() {
    return this.lastSnapshot || this.emptySnapshot();
  }
}
