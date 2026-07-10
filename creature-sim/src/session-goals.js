import { clamp } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';
import { collectGameplayMetrics, getObjectiveProgress } from './gameplay-objectives.js';

// Goal types backed by metrics that accumulate over the whole session (not a
// point-in-time snapshot like population/predator_count). These must be
// measured relative to a baseline captured when the goal is generated —
// otherwise a goal like "collect 80 food" instantly completes if the player
// already collected that much before the goal existed.
const CUMULATIVE_METRIC_KEY = {
  predator_kills: 'predatorKills',
  food_collected: 'foodCollected',
  births: 'births',
  survival_time: 'time',
  manual_spawns: 'manualSpawns',
  creature_throws: 'creatureThrows',
  prop_triggers: 'propTriggers',
  prop_places: 'propPlacements',
  god_actions: 'godActions',
  lineage_generation: 'maxGeneration'
};

const GOAL_POOL = [
  {
    id: 'population_push',
    type: 'population',
    icon: '🌿',
    makeTarget: () => 70 + Math.floor(Math.random() * 50),
    getDescription: target => `Reach ${target} creatures at once`
  },
  {
    id: 'predator_prowess',
    type: 'predator_kills',
    icon: '🦁',
    makeTarget: () => 4 + Math.floor(Math.random() * 6),
    getDescription: target => `Let predators score ${target} total hunts`
  },
  {
    id: 'foraging_spree',
    type: 'food_collected',
    icon: '🍇',
    makeTarget: () => 80 + Math.floor(Math.random() * 80),
    getDescription: target => `Consume ${target} meals`
  },
  {
    id: 'baby_boom',
    type: 'births',
    icon: '🧬',
    makeTarget: () => 18 + Math.floor(Math.random() * 16),
    getDescription: target => `Welcome ${target} new births`
  },
  {
    id: 'endure',
    type: 'survival_time',
    icon: '⏳',
    makeTarget: () => 180 + Math.floor(Math.random() * 180),
    getDescription: target => `Survive ${Math.round(target / 60)} minutes`
  },
  {
    id: 'spawn_party',
    type: 'manual_spawns',
    icon: '✨',
    makeTarget: () => 3 + Math.floor(Math.random() * 3),
    getDescription: target => `Spawn ${target} creatures by hand`
  },
  {
    id: 'launch_creature',
    type: 'creature_throws',
    icon: '🎯',
    makeTarget: () => 2 + Math.floor(Math.random() * 3),
    getDescription: target => `Launch ${target} creatures across the sandbox`
  },
  {
    id: 'prop_chain',
    type: 'prop_triggers',
    icon: '🧩',
    makeTarget: () => 4 + Math.floor(Math.random() * 4),
    getDescription: target => `Trigger sandbox props ${target} times`
  },
  {
    id: 'prop_builder',
    type: 'prop_places',
    icon: '🧱',
    makeTarget: () => 4 + Math.floor(Math.random() * 5),
    getDescription: target => `Place ${target} sandbox props`
  },
  {
    id: 'divine_intervention',
    type: 'god_actions',
    icon: '✨',
    makeTarget: () => 5 + Math.floor(Math.random() * 5),
    getDescription: target => `Use god powers ${target} times`
  },
  {
    id: 'wetland_watch',
    type: 'aquatic_alive',
    icon: '🐠',
    makeTarget: () => 6 + Math.floor(Math.random() * 6),
    getDescription: target => `Keep ${target} aquatic creatures alive at once`
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
    this.godActions = 0;
    eventSystem.on(GameEvents.CREATURE_BORN, event => {
      if (!event || event.parentId != null) return;
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
    eventSystem.on(GameEvents.GOD_MODE_ACTION, () => {
      this.godActions += 1;
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
        completed: false,
        baseline: null
      };
    });
    eventSystem.emit(GameEvents.SESSION_GOAL_UPDATED, this.getGoals());
  }

  getGoals() {
    return this.goals.map(g => ({ ...g }));
  }

  setGoals(goals = [], { announce = true } = {}) {
    this.goals = goals.map(goal => ({
      id: goal.id,
      type: goal.type,
      icon: goal.icon || '🎯',
      target: Math.max(1, Number(goal.target) || 1),
      description: goal.description || 'Complete the objective',
      progress: clamp(Number(goal.progress) || 0, 0, 1),
      completed: !!goal.completed,
      baseline: Number.isFinite(goal.baseline) ? goal.baseline : null
    }));
    eventSystem.emit(GameEvents.SESSION_GOAL_UPDATED, this.getGoals());
    if (announce && this.notifications?.show) {
      this.notifications.show('🎯 Scenario goals loaded', 'info', 1800);
    }
  }

  serialize() {
    return {
      goals: this.getGoals(),
      counters: {
        manualSpawns: this.manualSpawns,
        creatureThrows: this.creatureThrows,
        propTriggers: this.propTriggers,
        propPlacements: this.propPlacements,
        godActions: this.godActions
      }
    };
  }

  restore(data, { announce = false } = {}) {
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data.goals)) {
      this.setGoals(data.goals, { announce });
    }

    const counters = data.counters || {};
    this.manualSpawns = Number(counters.manualSpawns || 0);
    this.creatureThrows = Number(counters.creatureThrows || 0);
    this.propTriggers = Number(counters.propTriggers || 0);
    this.propPlacements = Number(counters.propPlacements || 0);
    this.godActions = Number(counters.godActions || 0);

    eventSystem.emit(GameEvents.SESSION_GOAL_UPDATED, this.getGoals());
    return true;
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

    // Auto-refresh goals when all are completed
    const allCompleted = this.goals.length > 0 && this.goals.every(g => g.completed);
    if (allCompleted) {
      this.refresh();
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
    return collectGameplayMetrics(world, {
      manualSpawns: this.manualSpawns,
      creatureThrows: this.creatureThrows,
      propTriggers: this.propTriggers,
      propPlacements: this.propPlacements,
      godActions: this.godActions
    });
  }

  _calculateProgress(goal, metrics) {
    const metricKey = CUMULATIVE_METRIC_KEY[goal.type];
    if (metricKey) {
      const current = Number(metrics[metricKey] || 0);
      if (goal.baseline == null) {
        goal.baseline = current;
      }
      const delta = Math.max(0, current - goal.baseline);
      return delta / Math.max(1, Number(goal.target) || 1);
    }
    return getObjectiveProgress(goal.type, goal.target, metrics);
  }
}
