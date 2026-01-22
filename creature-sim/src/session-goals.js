import { clamp } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';

const GOAL_POOL = [
  {
    id: 'population_push',
    type: 'population',
    icon: '🌿',
    makeTarget: () => 70 + Math.floor(Math.random() * 50),
    getDescription: (target) => `Reach ${target} creatures at once`
  },
  {
    id: 'predator_prowess',
    type: 'predator_kills',
    icon: '🦁',
    makeTarget: () => 4 + Math.floor(Math.random() * 6),
    getDescription: (target) => `Let predators score ${target} total hunts`
  },
  {
    id: 'foraging_spree',
    type: 'food_collected',
    icon: '🍇',
    makeTarget: () => 80 + Math.floor(Math.random() * 80),
    getDescription: (target) => `Consume ${target} meals`
  },
  {
    id: 'baby_boom',
    type: 'births',
    icon: '🧬',
    makeTarget: () => 18 + Math.floor(Math.random() * 16),
    getDescription: (target) => `Welcome ${target} new births`
  },
  {
    id: 'endure',
    type: 'survival_time',
    icon: '⏳',
    makeTarget: () => 180 + Math.floor(Math.random() * 180),
    getDescription: (target) => `Survive ${Math.round(target / 60)} minutes`
  },
  {
    id: 'spawn_party',
    type: 'manual_spawns',
    icon: '✨',
    makeTarget: () => 3 + Math.floor(Math.random() * 3),
    getDescription: (target) => `Spawn ${target} creatures by hand`
  },
  {
    id: 'launch_creature',
    type: 'creature_throws',
    icon: '🎯',
    makeTarget: () => 2 + Math.floor(Math.random() * 3),
    getDescription: (target) => `Launch ${target} creatures across the sandbox`
  },
  {
    id: 'prop_chain',
    type: 'prop_triggers',
    icon: '🧩',
    makeTarget: () => 4 + Math.floor(Math.random() * 4),
    getDescription: (target) => `Trigger sandbox props ${target} times`
  }
];

export class SessionGoals {
  constructor({ notifications = null, audio = null } = {}) {
    this.notifications = notifications;
    this.audio = audio;
    this.goals = [];
    this._lastUpdate = 0;
    this.manualSpawns = 0;
    this.creatureThrows = 0;
    this.propTriggers = 0;
    this.propPlacements = 0;
    eventSystem.on(GameEvents.CREATURE_BORN, (event) => {
      if (!event || event.parentId !== null) return;
      this.manualSpawns += 1;
    });
    eventSystem.on(GameEvents.CREATURE_THROWN, () => {
      this.creatureThrows += 1;
    });
    eventSystem.on(GameEvents.SANDBOX_PROP_TRIGGERED, () => {
      this.propTriggers += 1;
    });
    eventSystem.on(GameEvents.SANDBOX_PROP_PLACED, () => {
      this.propPlacements += 1;
    });
    this.generateGoals();
  }

  generateGoals(count = 3) {
    const shuffled = [...GOAL_POOL].sort(() => Math.random() - 0.5);
    this.goals = shuffled.slice(0, count).map(def => {
      const target = def.makeTarget();
      return {
        id: def.id,
        type: def.type,
        icon: def.icon,
        target,
        description: def.getDescription(target),
        progress: 0,
        completed: false
      };
    });
    eventSystem.emit(GameEvents.SESSION_GOAL_UPDATED, this.getGoals());
  }

  getGoals() {
    return this.goals.map(g => ({ ...g }));
  }

  refresh() {
    this.generateGoals();
    if (this.notifications?.show) {
      this.notifications.show('🎯 New session goals ready', 'info', 2200);
    }
    if (this.audio?.playUISound) {
      this.audio.playUISound('toggle');
    }
  }

  update(world, dt = 0) {
    if (!world) return;

    // Throttle heavy checks to ~4Hz
    this._lastUpdate += dt;
    if (this._lastUpdate < 0.25) return;
    this._lastUpdate = 0;

    const metrics = this._collectMetrics(world);

    let changed = false;
    for (const goal of this.goals) {
      if (goal.completed) continue;
      const progress = clamp(this._calculateProgress(goal, metrics), 0, 1);
      if (progress !== goal.progress) {
        goal.progress = progress;
        changed = true;
      }
      if (progress >= 1 && !goal.completed) {
        goal.completed = true;
        changed = true;
        this._announceCompletion(goal);
      }
    }

    if (changed) {
      eventSystem.emit(GameEvents.SESSION_GOAL_UPDATED, this.getGoals());
    }
  }

  _announceCompletion(goal) {
    eventSystem.emit(GameEvents.SESSION_GOAL_COMPLETED, goal);
    if (this.notifications?.show) {
      this.notifications.show(`${goal.icon} Goal complete: ${goal.description}`, 'achievement', 3200);
    }
    if (this.audio?.playUISound) {
      this.audio.playUISound('success');
    }
  }

  _collectMetrics(world) {
    const metrics = {
      population: 0,
      predatorKills: 0,
      foodCollected: 0,
      births: 0,
      time: world.t ?? 0,
      manualSpawns: this.manualSpawns,
      creatureThrows: this.creatureThrows,
      propTriggers: this.propTriggers,
      propPlacements: this.propPlacements
    };

    for (const creature of world.creatures || []) {
      if (!creature) continue;
      if (creature.alive) metrics.population += 1;
      const stats = creature.stats || {};
      if (creature.genes?.predator) metrics.predatorKills += stats.kills || 0;
      metrics.foodCollected += stats.food || 0;
      metrics.births += stats.births || 0;
    }

    return metrics;
  }

  _calculateProgress(goal, metrics) {
    switch (goal.type) {
      case 'population':
        return metrics.population / goal.target;
      case 'predator_kills':
        return metrics.predatorKills / goal.target;
      case 'food_collected':
        return metrics.foodCollected / goal.target;
      case 'births':
        return metrics.births / goal.target;
      case 'survival_time':
        return metrics.time / goal.target;
      case 'manual_spawns':
        return metrics.manualSpawns / goal.target;
      case 'creature_throws':
        return metrics.creatureThrows / goal.target;
      case 'prop_triggers':
        return metrics.propTriggers / goal.target;
      case 'prop_places':
        return metrics.propPlacements / goal.target;
      default:
        return 0;
    }
  }
}
