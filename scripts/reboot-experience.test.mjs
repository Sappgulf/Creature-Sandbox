import assert from 'node:assert/strict';
import {
  FIELD_GUIDE_PHASES,
  buildEcosystemStory,
  buildObjectiveRail,
  resolveFieldGuidePhase
} from '../creature-sim/src/upgrade-data.js';

const makeWorld = ({ alive = 0, food = 0, stress = 0, predators = 0 } = {}) => ({
  food: Array.from({ length: food }, () => ({})),
  creatures: Array.from({ length: alive }, (_, index) => ({
    id: index + 1,
    alive: true,
    genes: { predator: index < predators },
    needs: { stress }
  }))
});

const observeStory = buildEcosystemStory(makeWorld());
assert.equal(observeStory.phase, 'observe');
assert.equal(observeStory.phaseLabel, FIELD_GUIDE_PHASES.observe.label);

const stableStory = buildEcosystemStory(makeWorld({ alive: 24, food: 180 }));
assert.equal(stableStory.phase, 'discover');
assert.equal(stableStory.level, 'stable');

const pressuredStory = buildEcosystemStory(makeWorld({ alive: 24, food: 12 }));
assert.equal(pressuredStory.phase, 'influence');
assert.equal(pressuredStory.level, 'strained');

const activeScenario = buildObjectiveRail(
  { active: true, state: 'running', scenario: { name: 'Wetland Watch', objective: 'Keep the marsh alive.' } },
  []
);
assert.equal(activeScenario.phase, 'influence');
assert.equal(activeScenario.phaseKicker, 'MAKE ONE NUDGE');

const completedScenario = buildObjectiveRail(
  { active: true, state: 'complete', scenario: { name: 'Wetland Watch' } },
  []
);
assert.equal(completedScenario.phase, 'preserve');

const fallbackObjective = buildObjectiveRail(null, []);
assert.equal(fallbackObjective.phase, 'observe');

assert.equal(resolveFieldGuidePhase({ aliveCount: 10, level: 'watch' }).id, 'influence');
assert.equal(resolveFieldGuidePhase({ aliveCount: 10 }).id, 'discover');

console.log('Reboot experience checks passed');
