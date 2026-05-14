import { PLAYABLE_SCENARIOS } from '../playable-scenarios.js';

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

    const goals = [
      {
        id: `${scenario.id}_survive`,
        type: 'survival_time',
        icon: '⏳',
        target: scenario.targetSeconds,
        description: `Survive ${Math.round((scenario.targetSeconds || 0) / 60)} minutes`
      },
      {
        id: `${scenario.id}_population`,
        type: 'population',
        icon: '🐾',
        target: scenario.minAlive || 20,
        description: `Keep ${scenario.minAlive || 20}+ creatures alive`
      }
    ];

    if (scenario.minFood) {
      goals.push({
        id: `${scenario.id}_food`,
        type: 'food_available',
        icon: '🍃',
        target: scenario.minFood,
        description: `Keep ${scenario.minFood}+ food available`
      });
    }
    if (scenario.minPredators) {
      goals.push({
        id: `${scenario.id}_predators`,
        type: 'predator_count',
        icon: '🦁',
        target: scenario.minPredators,
        description: `Keep ${scenario.minPredators}+ predators alive`
      });
    }
    if (scenario.minVariants) {
      goals.push({
        id: `${scenario.id}_variants`,
        type: 'variant_alive',
        icon: '🧬',
        target: scenario.minVariants,
        description: `Keep ${scenario.minVariants}+ variants alive`
      });
    }
    if (scenario.minProps) {
      goals.push({
        id: `${scenario.id}_props`,
        type: 'prop_places',
        icon: '🧩',
        target: scenario.minProps,
        description: `Place ${scenario.minProps}+ sandbox props`
      });
    }
    if (scenario.minGeneration) {
      goals.push({
        id: `${scenario.id}_lineage`,
        type: 'lineage_generation',
        icon: '🌳',
        target: scenario.minGeneration,
        description: `Reach generation ${scenario.minGeneration}`
      });
    }
    if (scenario.maxStress) {
      goals.push({
        id: `${scenario.id}_biome_health`,
        type: 'biome_health',
        icon: '🌿',
        target: { score: 0.68 },
        description: `Keep average stress under ${scenario.maxStress}`
      });
    }

    return goals.slice(0, 4);
  }

  toOptions(progress = {}) {
    return this.scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      icon: scenario.icon,
      completions: Number(progress?.[scenario.id]?.completions || 0)
    }));
  }
}

export const scenarioRegistry = new ScenarioRegistry();
