// Regression tests for bugs found and fixed during the 2026-07 audit passes.
// Each test is named after the defect it guards so a future revert shows up
// as a named failure instead of a silent behavior change.
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
import { fillSnapshotPool } from '../creature-sim/src/snapshot-pool.js';
import { SimulationProxy } from '../creature-sim/src/simulation-proxy.js';
import { SaveSystem } from '../creature-sim/src/save-system.js';
import { eventSystem, GameEvents } from '../creature-sim/src/event-system.js';
import { TutorialSystem } from '../creature-sim/src/tutorial-system.js';
import { packCreature, unpackCreature, createCreatureBuffer } from '../creature-sim/src/simulation-state.js';
import { collectGameplayMetrics } from '../creature-sim/src/gameplay-objectives.js';

function makeFakeWorkerProxy() {
  const priorWindow = globalThis.window;
  globalThis.window = priorWindow || {};
  const sentMessages = [];
  const proxy = new SimulationProxy(
    class {
      constructor() {
        this.onmessage = null;
        this.onerror = null;
      }
      postMessage(msg) {
        sentMessages.push(msg);
      }
    }
  );
  globalThis.window = priorWindow;
  return { proxy, sentMessages };
}

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
// world-disaster.js / Scenario Lab: queued scenarios with a zero-second delay
// must still receive a scheduled time so the normal simulation tick can start
// them, and the public World facade must expose the cancel/clear commands used
// by the UI.
// ----------------------------------------------------------------------------
test('world-disaster: zero-delay queued scenarios start on the next scheduler pass and can be cancelled', () => {
  const world = new World(400, 400);

  assert.equal(
    world.triggerDisaster('plague', { queue: true, delay: 0, duration: 2, manual: true }),
    true,
    'queueing a valid scenario should succeed'
  );
  assert.equal(world.getPendingDisasters().length, 1, 'queued scenario should be visible through World');
  assert.equal(world.getPendingDisasters()[0].scheduledFor, world.t, 'zero-delay scenario should have a schedule');

  world.disaster.processScheduledDisasters();

  assert.equal(world.getPendingDisasters().length, 0, 'scheduled scenario should leave the queue when started');
  assert.equal(world.getActiveDisaster()?.type, 'plague', 'scheduled scenario should become active');
  world.cancelDisaster();
  assert.equal(world.getActiveDisaster(), null, 'active scenario should be cancellable through World');
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

test('session-goals: manual spawn progress follows explicit player spawn events', () => {
  const sessionGoals = new SessionGoals({});
  sessionGoals.resetForNewSession({ refreshGoals: false });

  eventSystem.emit(GameEvents.CREATURE_BORN, { parentId: null });
  assert.equal(sessionGoals.manualSpawns, 0, 'simulation births should not count as manual spawns');

  eventSystem.emit(GameEvents.CREATURE_SPAWN, { type: 'aquatic' });
  assert.equal(sessionGoals.manualSpawns, 1, 'an explicit player spawn should count once');
});

test('session-goals: a fresh sandbox favors goals available in the opener', () => {
  const sessionGoals = new SessionGoals({});
  sessionGoals.resetForNewSession();

  const openerGoalTypes = new Set([
    'population',
    'food_collected',
    'births',
    'survival_time',
    'manual_spawns',
    'creature_throws'
  ]);
  const goals = sessionGoals.getGoals();

  assert.equal(goals.length, 3, 'a new session should still expose three goals');
  assert.ok(
    goals.every(goal => openerGoalTypes.has(goal.type)),
    `starter goals should use visible opener actions, got ${goals.map(goal => goal.type).join(', ')}`
  );
});

test('world-ecosystem: auto-balance honors mode population and food thresholds', () => {
  const world = new World(400, 400);
  world.t = 120;
  world.autoBalanceSettings = {
    enabled: true,
    minPopulation: 12,
    targetPredatorRatio: 0.24,
    maxPredators: 16,
    targetFoodFraction: 0.8,
    minFoodAbsolute: 40
  };
  world.ecosystem.lastEcoStats = {
    herbivores: 5,
    predators: 0,
    omnivores: 0,
    foodCount: 0
  };

  let herbivoreSpawns = 0;
  let emergencyFoodTarget = null;
  const originalSpawnManual = world.creatureManager.spawnManual;
  const originalEmergencyFood = world.ecosystem.addEmergencyFood.bind(world.ecosystem);
  world.creatureManager.spawnManual = (_x, _y, predator) => {
    if (!predator) herbivoreSpawns += 1;
    return {};
  };
  world.ecosystem.addEmergencyFood = (target, count) => {
    emergencyFoodTarget = { target, count };
    return originalEmergencyFood(target, count);
  };

  world.ecosystem.autoBalanceEcosystem(60);

  world.creatureManager.spawnManual = originalSpawnManual;
  assert.ok(herbivoreSpawns > 0, 'a population below the mode floor should receive a gentle herbivore pulse');
  assert.deepEqual(
    emergencyFoodTarget,
    { target: 40, count: 0 },
    'food recovery should use the configured absolute floor, not the old hard-coded ratio'
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

test('camera: invalid pan/zoom state recovers to a finite centered view', () => {
  const camera = new Camera({ worldWidth: 1000, worldHeight: 800, viewportWidth: 400, viewportHeight: 300, zoom: 1 });

  camera.x = Number.NaN;
  camera.y = Number.POSITIVE_INFINITY;
  camera.targetX = Number.NaN;
  camera.targetY = Number.NEGATIVE_INFINITY;
  camera.zoom = Number.NaN;
  camera.targetZoom = Number.POSITIVE_INFINITY;
  camera.update(1 / 60);

  assert.ok(Number.isFinite(camera.x) && Number.isFinite(camera.y), 'camera position should remain finite');
  assert.ok(Number.isFinite(camera.targetX) && Number.isFinite(camera.targetY), 'camera targets should recover');
  assert.ok(Number.isFinite(camera.zoom) && camera.zoom > 0, 'camera zoom should remain finite and positive');
  assert.ok(Math.abs(camera.x - 500) < 1, `camera should recover near world center, got ${camera.x}`);
  assert.ok(Math.abs(camera.y - 400) < 1, `camera should recover near world center, got ${camera.y}`);
});

// ----------------------------------------------------------------------------
// worker-simulation.js: sendSnapshot() allocated a brand-new array and new
// objects for food/corpses every tick. fillSnapshotPool reuses objects in
// place instead — this guards that the reuse never leaves stale data behind.
// ----------------------------------------------------------------------------
test('snapshot-pool: reused entries are fully overwritten, not merged with stale fields', () => {
  const pool = [];
  fillSnapshotPool(pool, [{ x: 1, y: 1, extra: 'stale' }], (entry, src) => {
    entry.x = src.x;
    entry.y = src.y;
    // Note: does not copy `extra` — simulates a real assign fn that only
    // sets the fields it cares about.
  });
  // Reuse the same pool for a new source with different content and shape.
  fillSnapshotPool(pool, [{ x: 5, y: 5 }], (entry, src) => {
    entry.x = src.x;
    entry.y = src.y;
  });

  assert.equal(pool.length, 1);
  assert.equal(pool[0].x, 5);
  assert.equal(pool[0].y, 5);
});

test('snapshot-pool: shrinking the source drops the extra pooled entries', () => {
  const pool = [];
  fillSnapshotPool(pool, [{ v: 1 }, { v: 2 }, { v: 3 }], (entry, src) => {
    entry.v = src.v;
  });
  assert.equal(pool.length, 3);

  fillSnapshotPool(pool, [{ v: 9 }], (entry, src) => {
    entry.v = src.v;
  });

  assert.equal(pool.length, 1, `pool should shrink to match the new source length, got ${pool.length}`);
  assert.equal(pool[0].v, 9);
});

test('snapshot-pool: growing the source reuses existing entries and adds new ones', () => {
  const pool = [];
  fillSnapshotPool(pool, [{ v: 1 }], (entry, src) => {
    entry.v = src.v;
  });
  const firstEntryRef = pool[0];

  fillSnapshotPool(pool, [{ v: 10 }, { v: 20 }, { v: 30 }], (entry, src) => {
    entry.v = src.v;
  });

  assert.equal(pool.length, 3);
  assert.equal(pool[0], firstEntryRef, 'existing entry object should be reused in place, not replaced');
  assert.deepEqual(
    pool.map(p => p.v),
    [10, 20, 30]
  );
});

// ----------------------------------------------------------------------------
// simulation-proxy.js / worker-simulation.js / save-system.js: worker-mode
// saves (the shipping default) silently dropped childrenOf, nests,
// restZones, sandbox props, and disaster state because SimulationProxy
// never exposed them — and reset _nextId to 1 on load, causing creature ID
// collisions after any post-load reproduction. Fixed via a request/response
// round trip (REQUEST_WORLD_EXTRAS / WORLD_EXTRAS) the proxy awaits before
// save-system.js reads world.* fields.
// ----------------------------------------------------------------------------
test('simulation-proxy: getters default to safe empty values before any save-extras fetch', () => {
  const { proxy } = makeFakeWorkerProxy();

  assert.deepEqual(proxy.childrenOf, new Map());
  assert.deepEqual(proxy.nests, []);
  assert.deepEqual(proxy.restZones, []);
  assert.equal(proxy._nextId, 1);
  assert.deepEqual(proxy.sandbox.serialize(), []);
  assert.equal(proxy.disaster.activeDisaster, null);
});

test('simulation-proxy: requestSaveExtras() sends REQUEST_WORLD_EXTRAS and populates getters from the response', () => {
  const { proxy, sentMessages } = makeFakeWorkerProxy();
  proxy.handleMessage({ data: { type: 'READY' } });

  // Note: intentionally not awaiting the returned promise here — the cache
  // it resolves from is populated synchronously inside handleMessage below,
  // so reading the getters directly after that call is sufficient and
  // avoids needing async support in this file's synchronous test runner.
  proxy.requestSaveExtras();

  assert.ok(
    sentMessages.some(m => m.type === 'REQUEST_WORLD_EXTRAS'),
    'should send a REQUEST_WORLD_EXTRAS message to the worker'
  );

  proxy.handleMessage({
    data: {
      type: 'WORLD_EXTRAS',
      data: {
        _nextId: 4521,
        biomeSeed: 0.777,
        chaosBaseLevel: 0.6,
        restZones: [{ id: 'r1', x: 10, y: 20, radius: 50 }],
        nests: [{ id: 'n1', x: 30, y: 40, radius: 60, capacity: 4, comfort: 0.5, createdAt: 12, createdBy: 7 }],
        sandboxProps: [{ id: 'p1', type: 'bounce', x: 5, y: 5 }],
        childrenOf: [{ parentId: 1, childIds: [2, 3] }],
        disasterPending: [{ type: 'storm', delay: 5 }]
      }
    }
  });

  assert.equal(proxy._nextId, 4521, 'a real _nextId should survive the round trip, not reset to 1');
  assert.equal(proxy.nests.length, 1);
  assert.equal(proxy.restZones.length, 1);
  assert.equal(proxy.sandbox.serialize().length, 1);
  assert.deepEqual(proxy.childrenOf.get(1), new Set([2, 3]), 'childrenOf should reconstruct as a real Map of Sets');
  assert.equal(proxy.disaster.pendingDisasters.length, 1);
  assert.equal(proxy.biomeGenerator.seed, 0.777, 'biome seed should update for save reproducibility');
});

test('simulation-proxy: Scenario Lab commands and pending state use the worker protocol', () => {
  const { proxy, sentMessages } = makeFakeWorkerProxy();
  proxy.handleMessage({ data: { type: 'READY' } });

  proxy.triggerDisaster('plague', { queue: true, delay: 5 });
  proxy.cancelDisaster();
  proxy.cancelPendingDisaster(42);
  proxy.clearPendingDisasters();

  assert.deepEqual(
    sentMessages.slice(-4).map(message => message.type),
    ['TRIGGER_DISASTER', 'CANCEL_DISASTER', 'CANCEL_PENDING_DISASTER', 'CLEAR_PENDING_DISASTERS'],
    'Scenario Lab actions should map to explicit worker commands'
  );

  proxy.handleMessage({
    data: {
      type: 'STATE_UPDATE',
      t: 12,
      count: 0,
      creatureBuffer: new ArrayBuffer(0),
      food: [],
      corpses: [],
      activeDisaster: null,
      pendingDisasters: [{ id: 42, type: 'plague', scheduledFor: 17 }]
    }
  });

  assert.equal(proxy.getPendingDisasters().length, 1, 'pending worker state should reach the proxy');
  assert.equal(proxy.getPendingDisasters()[0].id, 42);
});

test('save-system: serialize() called after prepareForSave() captures worker-only fields (no more silent data loss)', () => {
  const { proxy } = makeFakeWorkerProxy();
  proxy.handleMessage({ data: { type: 'READY' } });
  proxy.worldSnapshot.creatures = [];
  proxy.worldSnapshot.food = [];
  proxy.worldSnapshot.corpses = [];

  proxy.requestSaveExtras();
  proxy.handleMessage({
    data: {
      type: 'WORLD_EXTRAS',
      data: {
        _nextId: 999,
        biomeSeed: 0.42,
        chaosBaseLevel: 0.5,
        restZones: [{ id: 'r1', x: 1, y: 1, radius: 10 }],
        nests: [{ id: 'n1', x: 2, y: 2, radius: 10, capacity: 3, comfort: 0.4, createdAt: 0, createdBy: null }],
        sandboxProps: [],
        childrenOf: [{ parentId: 5, childIds: [6] }],
        disasterPending: []
      }
    }
  });

  const saveSystem = new SaveSystem();
  const saveData = saveSystem.serialize(proxy, { x: 0, y: 0, zoom: 1 }, null, null, {});

  assert.equal(saveData.world._nextId, 999, 'save should capture the real _nextId, preventing ID collisions on reload');
  assert.equal(saveData.world.nests.length, 1, 'save should capture nests instead of silently dropping them');
  assert.equal(saveData.world.restZones.length, 1, 'save should capture rest zones instead of silently dropping them');
  assert.equal(
    saveData.world.childrenOf.length,
    1,
    'save should capture lineage (childrenOf) instead of silently dropping it'
  );
});

test('scenario-editor: does not duplicate Scenario Lab status id', () => {
  const source = fs.readFileSync(new URL('../creature-sim/src/scenario-editor.js', import.meta.url), 'utf8');
  assert.match(source, /id="scenario-editor-status"/);
  assert.doesNotMatch(source, /id="scenario-status"/);
});

test('tutorial-system: replay clears saved progress and restarts at the first step', () => {
  const store = new Map();
  const priorLocalStorage = globalThis.localStorage;
  const priorWindow = globalThis.window;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.setTimeout = () => 0;

  try {
    const tutorial = new TutorialSystem();
    const shown = [];
    tutorial.showStep = step => {
      tutorial.currentStep = step;
      shown.push(step?.id);
    };
    tutorial.hideCurrentStep = () => {};
    tutorial.setupListeners = () => {};
    tutorial.initTooltips = () => {};

    // Every step auto-advances on a timer and is marked complete as it passes,
    // so an idle first session ends here even if the player did nothing.
    store.set('tutorial_completed', JSON.stringify([...tutorial.steps.map(s => s.id), 'all']));

    tutorial.start();
    assert.equal(shown.length, 0, 'a finished tutorial should not re-enter through start()');

    tutorial.restart();
    assert.equal(shown[0], tutorial.steps[0].id, 'replay should re-enter at the first step, not resume at the end');
    assert.equal(tutorial.stepIndex, 0, 'replay should reset the step index');
    assert.equal(tutorial.active, true, 'replay should leave the tutorial active');
    assert.deepEqual(
      JSON.parse(store.get('tutorial_completed')),
      [],
      'replay should clear persisted progress so steps are not skipped again'
    );
  } finally {
    globalThis.localStorage = priorLocalStorage;
    globalThis.window = priorWindow;
  }
});

test('tutorial replay is reachable from the overflow menu', () => {
  const html = fs.readFileSync(new URL('../creature-sim/index.html', import.meta.url), 'utf8');
  const strip = fs.readFileSync(new URL('../creature-sim/src/control-strip.js', import.meta.url), 'utf8');
  const panels = fs.readFileSync(new URL('../creature-sim/src/ui-controller-panels.js', import.meta.url), 'utf8');

  // The only prior affordance lived in #hud-action-bank, which is hidden
  // legacy markup with no listener, so the tutorial could never be replayed.
  assert.match(html, /data-action="replay-tutorial"/);
  assert.match(strip, /action === 'replay-tutorial'/);
  assert.match(strip, /onReplayTutorial/);
  // The handler must drive the step tutorial, not only the touch-gesture card.
  assert.match(panels, /this\.tutorial\?\.restart/);
});

test('simulation-state: worker snapshot carries stress and hunger, so objective metrics are not stuck at 0', () => {
  const genes = makeGenes({ predator: false, diet: 0 });
  const creature = new Creature(50, 50, genes);
  creature.needs = { ...(creature.needs || {}), stress: 37.5, hunger: 82.25 };

  const buffer = createCreatureBuffer(1);
  packCreature(creature, buffer, 0);
  const unpacked = unpackCreature(buffer, 0);

  // The packed layout had no slot for either, so unpacked creatures reached
  // computeMetrics() with no `needs` at all and every stress/hunger-gated
  // objective, advisory and health score read a constant 0.
  assert.ok(unpacked.needs, 'unpacked creature should expose needs');
  assert.ok(Math.abs(unpacked.needs.stress - 37.5) < 0.01, 'stress should survive the buffer round trip');
  assert.ok(Math.abs(unpacked.needs.hunger - 82.25) < 0.01, 'hunger should survive the buffer round trip');

  const metrics = collectGameplayMetrics({ creatures: [unpacked], food: [], t: 0 });
  assert.ok(metrics.averageStress > 0, 'averageStress should reflect snapshot creatures, not default to 0');
  assert.ok(metrics.averageHunger > 0, 'averageHunger should reflect snapshot creatures, not default to 0');
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
