// Regression tests for bugs found and fixed during the 2026-07 audit passes.
// Each test is named after the defect it guards so a future revert shows up
// as a named failure instead of a silent behavior change.
import assert from 'node:assert/strict';
import { performance as nodePerformance } from 'node:perf_hooks';

if (!globalThis.performance) {
  globalThis.performance = nodePerformance;
}

import { makeGenes } from '../creature-sim/src/genetics.js';
import { World } from '../creature-sim/src/world-core.js';
import { Creature } from '../creature-sim/src/creature.js';
import { Camera } from '../creature-sim/src/camera.js';
import { SessionGoals } from '../creature-sim/src/session-goals.js';
import { CampaignSystem } from '../creature-sim/src/campaign-system.js';
import { GameplayModes } from '../creature-sim/src/gameplay-modes.js';
import { NotificationSystem } from '../creature-sim/src/notification-system.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log('\n=== regression-fixes.test.mjs ===');

// ----------------------------------------------------------------------------
// creature-behavior.js: undefined maxEnergy produced NaN energyRatio, which
// silently disabled starvation-driven foraging/hunting urgency.
// ----------------------------------------------------------------------------
test('creature-behavior: starving predator attempts foraging before falling back to hunting', () => {
  const genes = makeGenes({ predator: true, diet: 1 });
  const predator = new Creature(100, 100, genes);
  predator.maxEnergy = undefined; // matches production default — Creature never sets this
  predator.energy = 1; // critical energy: energyRatio must evaluate to ~0.01, not NaN

  const world = new World(400, 400);

  let foragingAttempted = false;
  const original = predator.behaviorSystem.selectForagingTarget.bind(predator.behaviorSystem);
  predator.behaviorSystem.selectForagingTarget = (...args) => {
    foragingAttempted = true;
    return original(...args);
  };

  predator.behaviorSystem.selectNewTarget(world);

  // A pure predator's "normal energy" branch only calls selectHuntingTarget,
  // never selectForagingTarget. Only the critical-energy branch (energyRatio
  // < 0.2) tries foraging first. If maxEnergy is undefined and unguarded,
  // energy / undefined = NaN, "NaN < 0.2" is false, and this branch is
  // skipped entirely — foragingAttempted would stay false.
  assert.equal(
    foragingAttempted,
    true,
    'critical-energy predator should attempt foraging first (energyRatio must not be NaN)'
  );
});

// ----------------------------------------------------------------------------
// world-combat.js: predator's post-kill energy was capped against maxHealth
// instead of maxEnergy, which could actively drain a healthy predator's
// energy immediately after a successful kill.
// ----------------------------------------------------------------------------
test("world-combat: a successful kill never reduces the predator's energy", () => {
  const world = new World(400, 400);
  const attackerGenes = makeGenes({ predator: true, diet: 1 });
  const attacker = new Creature(50, 50, attackerGenes);
  attacker.energy = 90;
  attacker.maxEnergy = 100;
  attacker.maxHealth = 25; // deliberately much lower, matching the real game's typical health cap

  const preyGenes = makeGenes({ predator: false, diet: 0 });
  const prey = new Creature(55, 55, preyGenes);
  prey.energy = 50;

  world.combat.handleCreatureDeath(prey, { attacker });

  assert.ok(
    attacker.energy >= 90,
    `a successful kill should never reduce a healthy predator's energy below its pre-kill value, got ${attacker.energy}`
  );
});

// ----------------------------------------------------------------------------
// world-disaster.js: `a || 0 + b` operator-precedence bug froze screen-shake
// intensity at its first tiny value instead of accumulating over time.
// ----------------------------------------------------------------------------
test('world-disaster: screen shake accumulates across frames during intense disasters', () => {
  const world = new World(400, 400);
  const intenseDisaster = { type: 'storm', intensity: 2 };

  world.disaster.applyVisualEffects(1, intenseDisaster);
  const afterFirst = world.screenShake;
  world.disaster.applyVisualEffects(1, intenseDisaster);
  const afterSecond = world.screenShake;

  assert.ok(afterFirst > 0, 'first tick should register some shake');
  assert.ok(
    afterSecond > afterFirst,
    `screen shake should keep accumulating across frames, got ${afterFirst} then ${afterSecond}`
  );
});

// ----------------------------------------------------------------------------
// session-goals.js: goals compared cumulative session totals directly
// against a freshly-rolled target, so goals could complete instantly from
// progress made before the goal even existed.
// ----------------------------------------------------------------------------
test('session-goals: cumulative goal progress is baselined at goal-creation time', () => {
  const sessionGoals = new SessionGoals({});
  const goal = { type: 'food_collected', target: 50, baseline: null };

  // Player already has 200 cumulative food collected from before this goal existed.
  const firstProgress = sessionGoals._calculateProgress(goal, { foodCollected: 200 });
  assert.ok(
    firstProgress < 0.01,
    `a freshly-baselined goal should start near 0% progress regardless of prior cumulative totals, got ${firstProgress}`
  );

  const secondProgress = sessionGoals._calculateProgress(goal, { foodCollected: 210 });
  assert.ok(
    Math.abs(secondProgress - 10 / 50) < 1e-9,
    `progress should track only the delta since baseline (10/50), got ${secondProgress}`
  );
});

// ----------------------------------------------------------------------------
// campaign-system.js: "Predator's Rise" only checked currently-alive
// creatures, so a predator reaching the kill target and then dying made the
// objective permanently unwinnable.
// ----------------------------------------------------------------------------
test('campaign-system: predator_kills objective stays satisfied after the qualifying predator dies', () => {
  const campaign = new CampaignSystem();
  const world = new World(400, 400);
  const genes = makeGenes({ predator: true, diet: 1 });
  const predator = new Creature(50, 50, genes);
  predator.stats.kills = 5;
  world.creatures = [predator];

  const objective = { type: 'predator_kills', target: 5 };
  assert.equal(
    campaign.checkObjective(objective, world, 0),
    true,
    'objective should be satisfied once a predator reaches the target kill count'
  );

  // The predator dies and is fully removed from the world's creature list.
  world.creatures = [];

  assert.equal(
    campaign.checkObjective(objective, world, 0),
    true,
    'objective should remain satisfied even after the qualifying predator is gone'
  );
});

// ----------------------------------------------------------------------------
// gameplay-modes.js: disasterIntensity set by frontier/mayhem leaked into
// chill/balanced because those modes never reset it.
// ----------------------------------------------------------------------------
test('gameplay-modes: disasterIntensity resets when switching away from frontier/mayhem', () => {
  const world = new World(400, 400);
  const modes = new GameplayModes(world);

  modes.applyMode('mayhem');
  assert.equal(world.disasterIntensity, 1.35, 'mayhem should set its elevated disaster intensity');

  modes.applyMode('balanced');
  assert.equal(
    world.disasterIntensity,
    1,
    `balanced mode should reset disaster intensity, got ${world.disasterIntensity}`
  );
});

// ----------------------------------------------------------------------------
// notification-system.js: the priority-preemption path pushed onto the
// deferred queue with no cap, unlike the sibling enqueue path.
// ----------------------------------------------------------------------------
test('notification-system: priority-preemption path respects the deferred queue cap', () => {
  const notifications = new NotificationSystem();
  notifications.maxVisible = 1;

  // Pre-fill the deferred queue right up to its documented 8-item cap.
  for (let i = 0; i < 8; i++) {
    notifications.queue.push({ id: `filler-${i}`, type: 'info', priority: 1 });
  }
  // Occupy the single visible slot with a low-priority notification that
  // a new high-priority one will preempt.
  notifications.notifications.push({ id: 'visible-low', type: 'info', priority: 1 });

  notifications.addNotification({ type: 'error', title: '', message: 'preempt-me' });

  assert.ok(
    notifications.queue.length <= 8,
    `deferred queue must never exceed its 8-item cap, got ${notifications.queue.length}`
  );
});

// ----------------------------------------------------------------------------
// camera.js: underlying clamp math relied on by the mobile-support.js fix
// (touch pan/pinch/double-tap now call _clampTargets after mutating
// targetX/targetY/targetZoom directly).
// ----------------------------------------------------------------------------
test('camera: _clampTargets keeps the pan target within world bounds', () => {
  const camera = new Camera({ worldWidth: 1000, worldHeight: 800, viewportWidth: 400, viewportHeight: 300, zoom: 1 });

  camera.targetX = 999999;
  camera.targetY = -999999;
  camera._clampTargets();

  assert.ok(camera.targetX < 1200, `targetX should be clamped near world bounds, got ${camera.targetX}`);
  assert.ok(camera.targetY > -200, `targetY should be clamped near world bounds, got ${camera.targetY}`);
});

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  console.log('Some tests failed!');
  process.exit(1);
} else {
  console.log('All tests passed!');
}
