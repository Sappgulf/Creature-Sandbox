import assert from 'node:assert/strict';
import {
  PLAYABLE_SCENARIOS,
  buildScenarioObjectives,
  validatePlayableScenarioDefinitions
} from '../creature-sim/src/playable-scenarios.js';
import { getObjectiveProgress } from '../creature-sim/src/gameplay-objectives.js';

assert.deepEqual(validatePlayableScenarioDefinitions(), []);

const nurseryWatch = PLAYABLE_SCENARIOS.find(scenario => scenario.id === 'nursery_watch');
assert.ok(nurseryWatch, 'nursery_watch scenario should exist');
assert.equal(nurseryWatch?.minBabies, 8);
assert.equal(nurseryWatch?.minGeneration, 2);
const nurseryGoals = buildScenarioObjectives(nurseryWatch);
assert.equal(nurseryGoals.find(goal => goal.type === 'baby_count')?.target, 8);
assert.equal(getObjectiveProgress('baby_count', 8, { babies: 4 }), 0.5);
assert.equal(getObjectiveProgress('baby_count', 8, { babies: 12 }), 1.5);

const stormChasers = PLAYABLE_SCENARIOS.find(scenario => scenario.id === 'storm_chasers');
assert.ok(stormChasers, 'storm_chasers scenario should exist');
assert.equal(stormChasers?.tuning?.disasters, true);
assert.ok(stormChasers?.minPredators >= 1, 'storm chasers should require predators');

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
assert.match(herdRescue?.steps?.[2] || '', /^Discover ·/);
assert.match(herdRescue?.steps?.[herdRescue.steps.length - 1] || '', /^Preserve ·/);
assert.equal(buildScenarioObjectives(herdRescue).find(goal => goal.type === 'stress_cap')?.target, 60);

const propPlayground = PLAYABLE_SCENARIOS.find(scenario => scenario.id === 'prop_playground');
assert.match(propPlayground?.objective || '', /^Place 4 props/i);

const mutationGoals = buildScenarioObjectives(mutationShowcase);
assert.equal(mutationGoals.find(goal => goal.type === 'variant_alive')?.target, 3);

const invalidScenario = { ...mutationShowcase, id: 'invalid', minVariants: 4 };
assert.equal(validatePlayableScenarioDefinitions([invalidScenario])[0]?.issues.length, 1);

console.log('Scenario contract checks passed');
