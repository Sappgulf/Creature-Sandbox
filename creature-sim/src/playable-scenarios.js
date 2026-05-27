import { gameState } from './game-state.js';
import { eventSystem } from './event-system.js';
import { clamp } from './utils.js';
import { collectGameplayMetrics } from './gameplay-objectives.js';

function randAround(center, radius) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.sqrt(Math.random()) * radius;
  return {
    x: center.x + Math.cos(angle) * dist,
    y: center.y + Math.sin(angle) * dist
  };
}

function foodPerCreature(metrics) {
  return metrics.alive > 0 ? metrics.food / metrics.alive : 0;
}

export const PLAYABLE_SCENARIOS = [
  {
    id: 'first_ecosystem',
    artFrame: 0,
    icon: '🌱',
    name: 'First Ecosystem',
    fantasy: 'Learn the loop by keeping a small herd fed, calm, and alive.',
    objective: 'Keep 25 creatures alive for 3 minutes.',
    targetSeconds: 180,
    minAlive: 25,
    setup: { herbivore: 24, omnivore: 4, predator: 2, food: 180, props: ['spring'] },
    tuning: { mode: 'balanced', foodRate: 1.15, disasters: false },
    steps: ['Spawn or protect grazers', 'Paint food near the herd', 'Use a calm zone if stress rises']
  },
  {
    id: 'peaceful_garden',
    artFrame: 1,
    icon: '🌿',
    name: 'Peaceful Garden',
    fantasy: 'Grow a stable, low-stress population without letting food run thin.',
    objective: 'Reach 45 living creatures while keeping food above 140.',
    targetSeconds: 240,
    minAlive: 45,
    minFood: 140,
    setup: { herbivore: 36, omnivore: 8, predator: 3, aquatic: 4, food: 260, props: ['bounce', 'calm'] },
    tuning: { mode: 'chill', foodRate: 1.35, disasters: false },
    steps: ['Paint food into empty pockets', 'Keep predators below pressure level', 'Let babies reach adulthood']
  },
  {
    id: 'predator_pressure',
    artFrame: 2,
    icon: '🦁',
    name: 'Predator Pressure',
    fantasy: 'Keep the ecosystem alive while predators hunt enough to matter.',
    objective: 'Survive 3 minutes with 5+ predators and 30+ total creatures.',
    targetSeconds: 180,
    minAlive: 30,
    minPredators: 5,
    setup: { herbivore: 42, omnivore: 6, predator: 7, food: 220, props: ['fan'] },
    tuning: { mode: 'frontier', foodRate: 1.0, disasters: true },
    steps: ['Feed prey clusters', 'Calm panicked areas', 'Remove predators only if the herd collapses']
  },
  {
    id: 'winter_survival',
    artFrame: 3,
    icon: '❄️',
    name: 'Winter Survival',
    fantasy: 'Food grows slowly. Help the population make it through scarcity.',
    objective: 'Keep 32 creatures alive for 4 minutes with limited food.',
    targetSeconds: 240,
    minAlive: 32,
    setup: { herbivore: 38, omnivore: 6, predator: 4, food: 130, props: ['calm'] },
    tuning: { mode: 'balanced', foodRate: 0.62, disasters: false, season: 'winter' },
    steps: ['Paint food sparingly near hungry groups', 'Use calm zones to save energy', 'Avoid spawning too many predators']
  },
  {
    id: 'tiny_island',
    artFrame: 4,
    icon: '🏝️',
    name: 'Tiny Island',
    fantasy: 'A dense pocket of life needs stress management more than raw population.',
    objective: 'Keep 20 creatures alive and average stress under 55 for 3 minutes.',
    targetSeconds: 180,
    minAlive: 20,
    maxStress: 55,
    setup: { herbivore: 22, omnivore: 4, predator: 3, food: 115, props: ['conveyor', 'spring'], radius: 280 },
    tuning: { mode: 'balanced', foodRate: 0.9, disasters: false },
    steps: ['Use calm zones when crowded', 'Open space with food trails', 'Keep predator pressure modest']
  },
  {
    id: 'mutation_lab',
    artFrame: 5,
    icon: '🧬',
    name: 'Mutation Lab',
    fantasy: 'Protect variant creatures long enough to see their roles emerge.',
    objective: 'Keep aquatic, flying, and burrowing variants alive for 3 minutes.',
    targetSeconds: 180,
    minAlive: 24,
    minVariants: 3,
    setup: { herbivore: 18, omnivore: 4, predator: 3, aquatic: 5, flying: 4, burrowing: 4, food: 210 },
    tuning: { mode: 'chill', foodRate: 1.2, disasters: false },
    steps: ['Select variants to read their needs', 'Feed across biomes', 'Avoid crowding one region']
  },
  {
    id: 'prop_playground',
    artFrame: 6,
    icon: '🧩',
    name: 'Prop Playground',
    fantasy: 'Turn the sim into a toybox without wiping out the herd.',
    objective: 'Trigger props while keeping 28 creatures alive for 2 minutes.',
    targetSeconds: 120,
    minAlive: 28,
    minProps: 4,
    setup: { herbivore: 32, omnivore: 5, predator: 2, food: 240, props: ['bounce', 'spring', 'fan', 'conveyor', 'launch'] },
    tuning: { mode: 'chill', foodRate: 1.3, disasters: false },
    steps: ['Place props at the edge of herds', 'Use gentle throws', 'Calm stressed creatures after chaos']
  },
  {
    id: 'lineage_guardian',
    artFrame: 0,
    icon: '🧬',
    name: 'Lineage Guardian',
    fantasy: 'Protect one family line long enough for a fifth generation to emerge.',
    objective: 'Reach generation 5 while keeping 26+ creatures alive.',
    targetSeconds: 300,
    minAlive: 26,
    minGeneration: 5,
    setup: { herbivore: 30, omnivore: 8, predator: 3, food: 250, props: ['calm', 'spring'] },
    tuning: { mode: 'balanced', foodRate: 1.2, disasters: false },
    steps: ['Pin a founder', 'Feed their descendants', 'Avoid predator pressure near nests']
  },
  {
    id: 'season_cycle',
    artFrame: 3,
    icon: '🍂',
    name: 'Four Season Chain',
    fantasy: 'Guide a herd through changing resource pressure.',
    objective: 'Survive 4 minutes with stable food and stress.',
    targetSeconds: 240,
    minAlive: 34,
    minFood: 120,
    maxStress: 60,
    setup: { herbivore: 40, omnivore: 6, predator: 4, food: 210, props: ['calm'] },
    tuning: { mode: 'balanced', foodRate: 0.95, disasters: true },
    steps: ['Build food buffer in spring', 'Calm crowded summer clusters', 'Protect elders in winter']
  },
  {
    id: 'tool_mastery',
    artFrame: 6,
    icon: '🛠️',
    name: 'Tool Mastery',
    fantasy: 'Learn each intervention without drowning the world in UI.',
    objective: 'Use props and calm zones while keeping 25+ creatures alive.',
    targetSeconds: 150,
    minAlive: 25,
    minProps: 5,
    setup: { herbivore: 28, omnivore: 5, predator: 2, food: 210, props: ['bounce', 'fan', 'gravity', 'spring'] },
    tuning: { mode: 'chill', foodRate: 1.25, disasters: false },
    steps: ['Place a bounce pad', 'Place a fan', 'Drop a calm zone near stress']
  },
  {
    id: 'mutation_showcase',
    artFrame: 5,
    icon: '✨',
    name: 'Mutation Showcase',
    fantasy: 'Inspect unusual variants in a controlled lab setup.',
    objective: 'Keep 5+ variants alive for 3 minutes.',
    targetSeconds: 180,
    minAlive: 24,
    minVariants: 5,
    setup: { herbivore: 14, omnivore: 4, predator: 2, aquatic: 6, flying: 6, burrowing: 6, food: 240, props: ['calm'] },
    tuning: { mode: 'chill', foodRate: 1.3, disasters: false },
    steps: ['Follow each variant type', 'Use the inspector to compare traits', 'Save the seed if the mix is interesting']
  }
];

export class PlayableScenarios {
  constructor({ world, camera, gameplayModes = null, sessionGoals = null, notifications = null, audio = null, moments = null, autoDirector = null } = {}) {
    this.world = world;
    this.camera = camera;
    this.gameplayModes = gameplayModes;
    this.sessionGoals = sessionGoals;
    this.notifications = notifications;
    this.audio = audio;
    this.moments = moments;
    this.autoDirector = autoDirector;
    this.activeRun = null;
    this.lastSnapshot = this._emptySnapshot();
    this._updateTimer = 0;
    this.progress = this._loadProgress();
  }

  getScenarios() {
    return PLAYABLE_SCENARIOS.map(scenario => ({
      ...scenario,
      progress: this.progress[scenario.id] || { completions: 0, bestSeconds: null }
    }));
  }

  getActiveScenario() {
    return this.activeRun?.scenario || null;
  }

  startScenario(id, { announce = true } = {}) {
    const scenario = PLAYABLE_SCENARIOS.find(item => item.id === id) || PLAYABLE_SCENARIOS[0];
    if (!this.world) return null;

    this._resetWorldForScenario(scenario);
    this._applyTuning(scenario);

    const now = this.world.t ?? 0;
    this.activeRun = {
      id: scenario.id,
      scenario,
      startedAt: now,
      completed: false,
      failed: false,
      state: 'running',
      elapsed: 0,
      progress: 0
    };

    gameState.sessionMetaVisible = true;
    gameState.selectedId = null;
    gameState.pinnedId = null;
    gameState.autoDirectorEnabled = true;

    if (this.sessionGoals) {
      this.sessionGoals.setGoals?.(this._scenarioGoals(scenario), { announce: false });
    }

    if (this.camera) {
      this.camera.x = this.world.width * 0.5;
      this.camera.y = this.world.height * 0.5;
      this.camera.targetX = this.camera.x;
      this.camera.targetY = this.camera.y;
      this.camera.zoom = Math.max(this.camera.minZoom || 0.1, Math.min(0.72, this.camera.maxZoom || 3));
      this.camera.targetZoom = this.camera.zoom;
    }

    this.lastSnapshot = this._buildSnapshot();
    if (announce) {
      this.notifications?.show?.(`${scenario.icon} ${scenario.name}: ${scenario.objective}`, 'info', 3600);
      this.audio?.playUISound?.('success');
    }
    this.moments?.logMoment?.({
      type: `scenario_${scenario.id}`,
      icon: scenario.icon,
      text: `${scenario.name} started`,
      x: this.world.width * 0.5,
      y: this.world.height * 0.5,
      worldTime: this.world.t
    });
    this._emitUpdate();
    return this.getSnapshot();
  }

  update(dt = 0) {
    this._updateTimer += dt;
    if (this._updateTimer < 0.35) return;
    this._updateTimer = 0;

    this.lastSnapshot = this._buildSnapshot();
    this._evaluateRun();
    this._emitUpdate();
  }

  getSnapshot() {
    return this.lastSnapshot || this._emptySnapshot();
  }

  serialize() {
    return {
      progress: this.progress,
      activeRun: this.activeRun ? {
        id: this.activeRun.id,
        startedAt: Number(this.activeRun.startedAt ?? 0),
        elapsed: Number(this.activeRun.elapsed ?? 0),
        progress: Number(this.activeRun.progress ?? 0),
        completed: !!this.activeRun.completed,
        failed: !!this.activeRun.failed,
        state: this.activeRun.state || 'running',
        scenario: {
          id: this.activeRun.scenario?.id,
          name: this.activeRun.scenario?.name,
          objective: this.activeRun.scenario?.objective,
          icon: this.activeRun.scenario?.icon
        }
      } : null,
      lastSnapshot: this.lastSnapshot
    };
  }

  restore(data, { announce = false } = {}) {
    if (!data || typeof data !== 'object') return false;
    if (data.progress && typeof data.progress === 'object') {
      this.progress = { ...this.progress, ...data.progress };
      this._saveProgress();
    }

    const savedRun = data.activeRun;
    if (!savedRun?.id) {
      this.activeRun = null;
      this.lastSnapshot = this._emptySnapshot();
      this._emitUpdate();
      return true;
    }

    const scenario = PLAYABLE_SCENARIOS.find(item => item.id === savedRun.id);
    if (!scenario) return false;

    const worldTime = Number(this.world?.t ?? 0);
    const elapsed = Math.max(0, Number(savedRun.elapsed ?? 0));
    const startedAt = Number.isFinite(Number(savedRun.startedAt))
      ? Number(savedRun.startedAt)
      : Math.max(0, worldTime - elapsed);

    this._applyTuning(scenario);
    this.activeRun = {
      id: scenario.id,
      scenario,
      startedAt,
      completed: !!savedRun.completed,
      failed: !!savedRun.failed,
      state: savedRun.state || 'running',
      elapsed,
      progress: Number(savedRun.progress ?? 0)
    };

    gameState.sessionMetaVisible = true;
    gameState.autoDirectorEnabled = true;

    if (this.sessionGoals) {
      this.sessionGoals.setGoals?.(this._scenarioGoals(scenario), { announce: false });
    }

    this.lastSnapshot = data.lastSnapshot?.active ? data.lastSnapshot : this._buildSnapshot();
    if (announce) {
      this.notifications?.show?.(`${scenario.icon} ${scenario.name} restored`, 'info', 2200);
    }
    this._emitUpdate();
    return true;
  }

  _resetWorldForScenario(scenario) {
    this.world.reset?.();
    this.world.food = [];
    this.world.corpses = [];
    this.world.sandbox?.clear?.();

    const center = { x: this.world.width * 0.5, y: this.world.height * 0.5 };
    const radius = scenario.setup.radius || 520;
    const spawnTypes = ['herbivore', 'omnivore', 'predator', 'aquatic', 'flying', 'burrowing'];
    for (const type of spawnTypes) {
      const count = scenario.setup[type] || 0;
      for (let i = 0; i < count; i++) {
        const pos = randAround(center, radius);
        this.world.spawnCreatureType?.(type, pos.x, pos.y);
      }
    }

    for (let i = 0; i < (scenario.setup.food || 0); i++) {
      const pos = randAround(center, radius * 1.15);
      this.world.addFood?.(pos.x, pos.y);
    }

    const props = scenario.setup.props || [];
    props.forEach((type, index) => {
      if (type === 'calm') {
        this.world.restZones = this.world.restZones || [];
        this.world.restZones.push({
          id: `scenario-calm-${index}`,
          x: center.x + (index - 0.5) * 160,
          y: center.y + 180,
          radius: 145
        });
        this.world.restGridDirty = true;
        return;
      }
      const pos = randAround(center, radius * 0.55);
      this.world.sandbox?.addProp?.(type, pos.x, pos.y);
    });

    this.world.ensureSpatial?.();
  }

  _applyTuning(scenario) {
    const tuning = scenario.tuning || {};
    if (tuning.mode && this.gameplayModes) {
      this.gameplayModes.applyMode(tuning.mode, { announce: false });
    }
    if (this.world.environment && Number.isFinite(tuning.foodRate)) {
      this.world.environment.foodRateMultiplier = tuning.foodRate;
    }
    if (typeof tuning.disasters === 'boolean') {
      this.world.randomDisasters = tuning.disasters;
    }
    if (tuning.season && this.world.environment?.seasonCycle) {
      const idx = this.world.environment.seasonCycle.indexOf(tuning.season);
      if (idx >= 0) {
        this.world.environment.currentSeason = tuning.season;
        this.world.environment.seasonIndex = idx;
        const config = this.world.environment.seasonConfigs?.[tuning.season];
        if (config) {
          this.world.environment.applySeasonConfig?.(config, { announce: false });
        }
      }
    }
  }

  _scenarioGoals(scenario) {
    const goals = [
      {
        id: `${scenario.id}_survive`,
        type: 'survival_time',
        icon: '⏳',
        target: scenario.targetSeconds,
        description: `Survive ${Math.round(scenario.targetSeconds / 60)} minutes`,
        progress: 0,
        completed: false
      },
      {
        id: `${scenario.id}_population`,
        type: 'population',
        icon: '🐾',
        target: scenario.minAlive || 20,
        description: `Keep ${scenario.minAlive || 20}+ creatures alive`,
        progress: 0,
        completed: false
      }
    ];

    if (scenario.minFood) {
      goals.push({
        id: `${scenario.id}_food`,
        type: 'food_available',
        icon: '🌿',
        target: scenario.minFood,
        description: `Keep ${scenario.minFood}+ food available`,
        progress: 0,
        completed: false
      });
    } else if (scenario.minVariants) {
      goals.push({
        id: `${scenario.id}_variants`,
        type: 'variant_alive',
        icon: '🧬',
        target: scenario.minVariants,
        description: 'Keep aquatic, flying, and burrowing variants alive',
        progress: 0,
        completed: false
      });
    } else if (scenario.minProps) {
      goals.push({
        id: `${scenario.id}_props`,
        type: 'prop_places',
        icon: '🧩',
        target: scenario.minProps,
        description: `Place ${scenario.minProps}+ sandbox props`,
        progress: 0,
        completed: false
      });
    } else if (scenario.minGeneration) {
      goals.push({
        id: `${scenario.id}_generation`,
        type: 'lineage_generation',
        icon: '🧬',
        target: scenario.minGeneration,
        description: `Reach generation ${scenario.minGeneration}`,
        progress: 0,
        completed: false
      });
    }

    return goals.slice(0, 3);
  }

  _collectMetrics() {
    return collectGameplayMetrics(this.world);
  }

  _evaluateRun() {
    if (!this.activeRun || this.activeRun.completed || this.activeRun.failed) return;
    const snapshot = this.lastSnapshot;
    const scenario = this.activeRun.scenario;
    const metrics = snapshot.metrics;
    const elapsed = Math.max(0, (this.world?.t ?? 0) - this.activeRun.startedAt);
    const timeProgress = clamp(elapsed / Math.max(1, scenario.targetSeconds), 0, 1);
    const populationProgress = clamp(metrics.alive / Math.max(1, scenario.minAlive || 1), 0, 1);
    const foodProgress = scenario.minFood ? clamp(metrics.food / scenario.minFood, 0, 1) : 1;
    const predatorProgress = scenario.minPredators ? clamp(metrics.predators / scenario.minPredators, 0, 1) : 1;
    const stressProgress = scenario.maxStress ? clamp(1 - Math.max(0, metrics.averageStress - scenario.maxStress) / 60, 0, 1) : 1;
    const variantProgress = scenario.minVariants ? clamp(metrics.variants / scenario.minVariants, 0, 1) : 1;
    const propProgress = scenario.minProps ? clamp(metrics.props / scenario.minProps, 0, 1) : 1;
    const generationProgress = scenario.minGeneration ? clamp(metrics.maxGeneration / scenario.minGeneration, 0, 1) : 1;
    const progress = Math.min(timeProgress, populationProgress, foodProgress, predatorProgress, stressProgress, variantProgress, propProgress, generationProgress);

    this.activeRun.elapsed = elapsed;
    this.activeRun.progress = progress;

    if (metrics.alive <= 0 || (elapsed > 20 && metrics.alive < Math.max(6, Math.floor((scenario.minAlive || 20) * 0.35)))) {
      this._failRun('The ecosystem collapsed.');
      return;
    }

    const complete = elapsed >= scenario.targetSeconds &&
      metrics.alive >= (scenario.minAlive || 0) &&
      (!scenario.minFood || metrics.food >= scenario.minFood) &&
      (!scenario.minPredators || metrics.predators >= scenario.minPredators) &&
      (!scenario.maxStress || metrics.averageStress <= scenario.maxStress) &&
      (!scenario.minVariants || metrics.variants >= scenario.minVariants) &&
      (!scenario.minProps || metrics.props >= scenario.minProps) &&
      (!scenario.minGeneration || metrics.maxGeneration >= scenario.minGeneration);

    if (complete) {
      this._completeRun();
    }
  }

  _buildSnapshot() {
    const scenario = this.activeRun?.scenario || PLAYABLE_SCENARIOS[0];
    const metrics = this._collectMetrics();
    metrics.foodPerCreature = Number(foodPerCreature(metrics).toFixed(2));
    const elapsed = this.activeRun ? Math.max(0, (this.world?.t ?? 0) - this.activeRun.startedAt) : 0;
    const risk = this._risk(metrics, scenario);
    const progress = this.activeRun
      ? Math.round((this.activeRun.progress || 0) * 100)
      : 0;

    return {
      active: !!this.activeRun,
      state: this.activeRun?.state || 'idle',
      scenario: this.activeRun ? {
        id: scenario.id,
        icon: scenario.icon,
        name: scenario.name,
        fantasy: scenario.fantasy,
        objective: scenario.objective,
        steps: scenario.steps || []
      } : null,
      elapsed,
      targetSeconds: scenario.targetSeconds || 0,
      progress,
      metrics,
      director: risk
    };
  }

  _risk(metrics, scenario) {
    if (metrics.alive <= 0) {
      return {
        level: 'critical',
        headline: 'No living creatures remain',
        why: 'The run is over because the population collapsed.',
        nextAction: 'Start a new scenario.'
      };
    }
    if (metrics.foodPerCreature < 2.2 || metrics.averageHunger > 68) {
      return {
        level: 'high',
        headline: 'Food pressure is rising',
        why: 'Hungry creatures cluster around scarce food and burn energy faster.',
        nextAction: 'Paint food near the largest herd, then watch if hunger drops.'
      };
    }
    if (metrics.predators > Math.max(2, metrics.herbivores * 0.34)) {
      return {
        level: 'high',
        headline: 'Predators are over pressure',
        why: 'Too many hunters can scatter prey, raise stress, and stop births.',
        nextAction: 'Spawn herbivores or remove one predator if the herd keeps shrinking.'
      };
    }
    if (scenario.minPredators && metrics.predators < scenario.minPredators) {
      return {
        level: 'medium',
        headline: 'Predator count is below the objective',
        why: 'This scenario needs a real predator-prey balance, not only grazers.',
        nextAction: 'Spawn a predator near the edge of the herd and keep food available.'
      };
    }
    if (metrics.averageStress > (scenario.maxStress || 58)) {
      return {
        level: 'medium',
        headline: 'Stress is limiting recovery',
        why: 'Crowding, danger, or chaos makes creatures rest less efficiently.',
        nextAction: 'Place a calm zone beside the stressed group.'
      };
    }
    if (metrics.alive < (scenario.minAlive || 20)) {
      return {
        level: 'medium',
        headline: 'Population is below the objective',
        why: 'The run needs more stable adults before it can be considered safe.',
        nextAction: 'Spawn herbivores and keep them fed until births start.'
      };
    }
    return {
      level: 'stable',
      headline: 'Ecosystem is on track',
      why: 'Food, stress, and predator pressure are within the playable target range.',
      nextAction: 'Stay in Watch Mode and react to the next major event.'
    };
  }

  _completeRun() {
    this.activeRun.completed = true;
    this.activeRun.state = 'complete';
    this.activeRun.progress = 1;
    const id = this.activeRun.id;
    const seconds = Math.round(this.activeRun.elapsed);
    const existing = this.progress[id] || { completions: 0, bestSeconds: null };
    this.progress[id] = {
      completions: existing.completions + 1,
      bestSeconds: existing.bestSeconds == null ? seconds : Math.min(existing.bestSeconds, seconds)
    };
    this._saveProgress();
    this.notifications?.show?.(`🏆 Scenario complete: ${this.activeRun.scenario.name}`, 'achievement', 4200);
    this.audio?.playUISound?.('success');
    this.lastSnapshot = this._buildSnapshot();
    this._emitUpdate();
  }

  _failRun(reason) {
    this.activeRun.failed = true;
    this.activeRun.state = 'failed';
    this.lastSnapshot = this._buildSnapshot();
    this.notifications?.show?.(`Scenario failed: ${reason}`, 'error', 4200);
    this._emitUpdate();
  }

  _emitUpdate() {
    eventSystem.emit('playable:updated', this.getSnapshot());
  }

  _emptySnapshot() {
    return {
      active: false,
      state: 'idle',
      scenario: null,
      elapsed: 0,
      targetSeconds: 0,
      progress: 0,
      metrics: {
        alive: 0,
        predators: 0,
        herbivores: 0,
        food: 0,
        props: 0,
        variants: 0,
        averageStress: 0,
        averageHunger: 0,
        averageEnergy: 0,
        foodPerCreature: 0
      },
      director: {
        level: 'stable',
        headline: 'Choose a scenario',
        why: 'Scenario objectives turn the sandbox into a playable run.',
        nextAction: 'Pick a scenario and press Start.'
      }
    };
  }

  _loadProgress() {
    try {
      return JSON.parse(localStorage.getItem('creature-sim-playable-progress') || '{}');
    } catch {
      return {};
    }
  }

  _saveProgress() {
    try {
      localStorage.setItem('creature-sim-playable-progress', JSON.stringify(this.progress));
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }
}

export default PlayableScenarios;
