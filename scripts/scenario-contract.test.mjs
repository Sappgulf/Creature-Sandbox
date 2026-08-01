import assert from 'node:assert/strict';
import {
  PLAYABLE_SCENARIOS,
  buildScenarioObjectives,
  validatePlayableScenarioDefinitions
} from '../creature-sim/src/playable-scenarios.js';

assert.deepEqual(validatePlayableScenarioDefinitions(), []);

const mutationShowcase = PLAYABLE_SCENARIOS.find(scenario => scenario.id === 'mutation_showcase');
assert.equal(mutationShowcase?.minVariants, 3);
assert.match(mutationShowcase?.objective || '', /all 3 variant roles/i);

const herdRescue = PLAYABLE_SCENARIOS.find(scenario => scenario.id === 'first_ecosystem');
assert.equal(herdRescue?.name, 'Herd Rescue');
assert.equal(herdRescue?.targetSeconds, 120);
assert.equal(herdRescue?.maxStress, 60);
assert.equal(herdRescue?.guidedLoop, true);
assert.match(herdRescue?.steps?.[0] || '', /^Observe ·/);
assert.match(herdRescue?.steps?.[1] || '', /^Influence ·/);
assert.match(herdRescue?.steps?.[2] || '', /^Preserve ·/);
assert.equal(buildScenarioObjectives(herdRescue).find(goal => goal.type === 'stress_cap')?.target, 60);

const propPlayground = PLAYABLE_SCENARIOS.find(scenario => scenario.id === 'prop_playground');
assert.match(propPlayground?.objective || '', /^Place 4 props/i);

const mutationGoals = buildScenarioObjectives(mutationShowcase);
assert.equal(mutationGoals.find(goal => goal.type === 'variant_alive')?.target, 3);

const invalidScenario = { ...mutationShowcase, id: 'invalid', minVariants: 4 };
assert.equal(validatePlayableScenarioDefinitions([invalidScenario])[0]?.issues.length, 1);

console.log('Scenario contract checks passed');
