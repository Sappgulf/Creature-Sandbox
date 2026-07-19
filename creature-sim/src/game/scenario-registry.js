import { PLAYABLE_SCENARIOS, buildScenarioObjectives } from '../playable-scenarios.js';

export class ScenarioRegistry {
  constructor(scenarios = PLAYABLE_SCENARIOS) {
    this.scenarios = scenarios;
  }

  list() {
    return this.scenarios.slice();
  }

  ids() {
    return this.scenarios.map(scenario => scenario.id);
  }

  get(id) {
    return this.scenarios.find(scenario => scenario.id === id) || null;
  }

  first() {
    return this.scenarios[0] || null;
  }

  getObjectives(id) {
    const scenario = this.get(id);
    if (!scenario) return [];
    return buildScenarioObjectives(scenario);
  }

  toOptions(progress = {}) {
    return this.scenarios.map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      icon: scenario.icon,
      completions: Number(progress?.[scenario.id]?.completions || 0)
    }));
  }
}

export const scenarioRegistry = new ScenarioRegistry();
