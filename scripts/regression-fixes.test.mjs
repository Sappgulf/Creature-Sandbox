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
import { ControlStripController } from '../creature-sim/src/control-strip.js';
import { SPEED_OPTIONS, SPEED_LABELS } from '../creature-sim/src/game-state.js';
import { CreatureAgentTuning } from '../creature-sim/src/creature-agent-constants.js';
import { resolveDietRole } from '../creature-sim/src/creature-genetics-helpers.js';
import { angleDelta } from '../creature-sim/src/utils.js';
import { getAffinity, adjustAffinity } from '../creature-sim/src/creature-agent-needs.js';
import { CreatureConfig } from '../creature-sim/src/creature-config.js';
import { ToolController } from '../creature-sim/src/tools.js';

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

test('control-strip: battery saver caps speed instead of freezing it at 1x', () => {
  const cycleSpeed = ControlStripController.prototype.cycleSpeed;
  const run = (batterySaver, presses) => {
    const seen = [];
    const ctx = {
      speedIndex: 1, // 1x, the startup speed
      mobilePrefs: { batterySaver },
      syncSpeedIndexFromState() {},
      updateSpeedButton() {
        seen.push(this.speedIndex);
      },
      buzz() {}
    };
    for (let i = 0; i < presses; i++) cycleSpeed.call(ctx);
    return seen;
  };

  // Clamping after the increment meant 1 -> 2 -> back to 1 on every press, so
  // the control never moved and 0.5x was unreachable even though the cap
  // allows it.
  const capped = run(true, 4);
  assert.ok(new Set(capped).size > 1, 'battery saver must not freeze the speed control');
  assert.ok(
    capped.every(i => i <= 1),
    'battery saver must still cap speed at 1x'
  );
  assert.ok(capped.includes(0), 'battery saver should still allow 0.5x');

  const full = run(false, 4);
  assert.deepEqual(new Set(full), new Set([2, 3, 0, 1]), 'without battery saver every speed should be reachable');
});

test('styles: inspector sits above its own modal scrim, and its controls meet the touch floor', () => {
  const css = fs.readFileSync(new URL('../creature-sim/styles.css', import.meta.url), 'utf8');

  // Opening the inspector sets body.panel-open (ui-controller.js), which shows
  // .panel-overlay. The overlay is pointer-events:auto, so while the inspector
  // was below it every tap landed on the scrim and the panel could not be used
  // or even closed on a phone.
  const overlayZ = /\.panel-overlay\s*\{[^}]*z-index:\s*(\d+)/s.exec(css);
  const inspectorZ = /#inspector\s*\{\s*z-index:\s*(\d+)/s.exec(css);
  assert.ok(overlayZ, 'panel-overlay should declare a z-index');
  assert.ok(inspectorZ, 'inspector should declare a z-index above the scrim');
  assert.ok(
    Number(inspectorZ[1]) > Number(overlayZ[1]),
    `inspector z-index (${inspectorZ?.[1]}) must exceed the scrim (${overlayZ?.[1]})`
  );

  // The pointer:coarse block raises controls to the 44px floor; the
  // inspector's own buttons were left out of it.
  const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));
  for (const id of ['#btn-close-inspector', '#btn-minimize-inspector', '#btn-pin', '#btn-export']) {
    assert.ok(coarse.includes(id), `${id} should be raised to the touch-target floor on coarse pointers`);
  }
});

test('speed ladder is shared, so the +/- shortcuts cannot desync from the HUD', () => {
  // input-manager used integer arithmetic clamped to 1..5 against the HUD's
  // discrete ladder, producing 3 and 5 — speeds the control cannot display —
  // and never refreshing the button, so the sim ran at 5x while it read 1x.
  const inputManager = fs.readFileSync(new URL('../creature-sim/src/input-manager.js', import.meta.url), 'utf8');
  const controlStrip = fs.readFileSync(new URL('../creature-sim/src/control-strip.js', import.meta.url), 'utf8');

  assert.equal(SPEED_OPTIONS.length, SPEED_LABELS.length, 'every speed needs a label');
  assert.doesNotMatch(
    inputManager,
    /fastForward\s*=\s*Math\.(min|max)\(\s*\d+\s*,\s*gameState\.fastForward/,
    'speed shortcuts must step the shared ladder, not do free arithmetic on fastForward'
  );
  assert.match(inputManager, /SPEED_OPTIONS/, 'input-manager should use the shared ladder');
  assert.match(inputManager, /eventSystem\.emit\('game:speed'/, 'speed changes must be announced so the HUD re-syncs');
  assert.match(
    controlStrip,
    /eventSystem\.on\('game:speed'/,
    'the control strip must listen for keyboard speed changes'
  );
  // Neither module should define its own copy of the ladder any more.
  assert.doesNotMatch(controlStrip, /const SPEED_OPTIONS\s*=/, 'the ladder should live in one place');
});

test('help panel documents the digit keys that actually exist', () => {
  const html = fs.readFileSync(new URL('../creature-sim/index.html', import.meta.url), 'utf8');
  const inputManager = fs.readFileSync(new URL('../creature-sim/src/input-manager.js', import.meta.url), 'utf8');

  // 1-5 are god-mode tool select, or camera bookmarks outside god mode; the
  // bookmark branch returns before the switch, so the emotion/sensory/
  // intelligence/mating rows described keys that could never fire, and the
  // advertised 5-8 heatmap keys were never bound at all.
  assert.doesNotMatch(html, /<kbd>5-8<\/kbd>/, 'heatmap keys 5-8 are not bound anywhere');
  assert.match(html, /Recall camera bookmark/, 'camera bookmarks should be documented');
  assert.match(inputManager, /cameraBookmarks\.load/, 'camera bookmarks should still be bound');
});

test('campaign level cards are operable by keyboard, not mouse only', () => {
  const bootstrap = fs.readFileSync(new URL('../creature-sim/src/app-bootstrap.js', import.meta.url), 'utf8');

  // The cards were plain divs carrying only a click handler: never in the tab
  // order, and announced as text rather than as controls.
  assert.match(bootstrap, /role="button" tabindex="0"/, 'unlocked cards need button semantics');
  assert.match(bootstrap, /aria-disabled="true"/, 'locked cards should say they are unavailable');
  assert.match(bootstrap, /aria-label="\$\{label/, 'cards need an accessible name');
  assert.match(
    bootstrap,
    /card\.addEventListener\('keydown'/,
    'a div claiming role=button must handle Enter and Space itself'
  );
});

test('range sliders meet the touch-target floor on coarse pointers', () => {
  const css = fs.readFileSync(new URL('../creature-sim/styles.css', import.meta.url), 'utf8');
  const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));

  // The base rule is a 6px-tall control, which is the whole drag target: 17 of
  // them across the gene editor, inspector and Scenario Lab.
  assert.match(css, /input\[type='range'\]\s*\{[^}]*height:\s*6px/s, 'the base slider is still a 6px track');
  assert.match(coarse, /input\[type='range'\]/, 'sliders must be enlarged on coarse pointers');
  assert.match(coarse, /height:\s*44px/, 'the coarse hit area should reach the 44px floor');
});

test('foragers can actually reach food: consume range is not smaller than their approach distance', () => {
  // Creatures slow to MIN_ARRIVE_SPEED inside ARRIVE_RADIUS and are pushed
  // apart by herd separation, so they settle tens of pixels from their target.
  // At an 8px bite range only 4.5% of attempts landed: intake ran far under
  // drain, food accumulated uneaten and the population starved amid plenty.
  const { CONSUME_RANGE } = CreatureAgentTuning.FOOD;
  assert.ok(CONSUME_RANGE >= 20, `consume range ${CONSUME_RANGE} is too tight for foragers to ever reach food`);
  assert.ok(
    CONSUME_RANGE < CreatureAgentTuning.SENSES.OVERCROWD_RADIUS,
    'consume range should stay well inside sensing ranges rather than vacuuming the map'
  );
});

test('needs.stress is coupled to the ecosystem layer, not overwritten by it', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/creature-agent-needs.js', import.meta.url), 'utf8');

  // needs.stress = clamp(ecoStress, 0, 100) threw away overcrowding, territory
  // pressure, calm zones and rest decay on every tick, leaving the agent-level
  // stress model — and the flee/rest goal scores that read it — inert.
  assert.doesNotMatch(
    src,
    /needs\.stress\s*=\s*clamp\(\s*ecoStress/,
    'the ecosystem reading must not overwrite accumulated stress'
  );
  assert.match(src, /STRESS_ECO_COUPLING/, 'the two stress models should be coupled at a bounded rate');
  assert.ok(
    CreatureAgentTuning.NEEDS.STRESS_ECO_COUPLING > 0,
    'coupling rate must be positive so ecosystem stress still influences the agent'
  );
});

test('resting conserves energy even outside a rest zone', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/creature.js', import.meta.url), 'utf8');

  // Recovery is gated on being inside a rest zone or nest, and a default world
  // seeds only a handful: 41 of 64 creatures were in the REST goal while just 5
  // were sheltered, so the rest stopped foraging and idled at full metabolic
  // burn until they starved with food going uneaten.
  assert.match(src, /_restingUnsheltered/, 'settled-but-unsheltered rest must be tracked');
  assert.match(src, /REST_BURN_MULT/, 'unsheltered rest must reduce metabolic burn');
  const mult = CreatureAgentTuning.NEEDS.REST_BURN_MULT;
  assert.ok(mult > 0 && mult < 1, `REST_BURN_MULT ${mult} should conserve fuel without being free`);
});

test('auto-balance can out-pace a die-off instead of only nominally holding its floor', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/world-ecosystem.js', import.meta.url), 'utf8');

  // It ran once a minute and added at most four herbivores, against die-offs an
  // order of magnitude larger, and gave up entirely below five creatures —
  // exactly when the advertised minPopulation floor mattered most.
  const interval = /balanceCheckInterval\s*=\s*(\d+)/.exec(src);
  assert.ok(interval && Number(interval[1]) <= 30, 'balance checks must run often enough to matter');
  assert.doesNotMatch(src, /if \(total < 5 \|\|/, 'the floor should not be abandoned during a crash');
  const pulse = /Math\.min\((\d+), Math\.ceil\(deficit \* ([0-9.]+)\)\)/.exec(src);
  assert.ok(pulse, 'refill pulse should scale with the deficit');
  assert.ok(Number(pulse[1]) >= 5, 'refill pulse cap was too small to recover a population');
});

test('full predators can actually reach the hunting branch', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/creature.js', import.meta.url), 'utf8');

  // creature.js hunts when `diet > 0.7 && dietRole !== 'predator-lite'`, but
  // resolveDietRole returned 'predator-lite' for every diet > 0.7 creature, so
  // the two conditions were mutually exclusive: world.tryPredation was dead
  // code, no creature ever attacked prey, and the inspector labelled flagged
  // predators "Predator-lite". Measured before the fix: 0 of 64 creatures could
  // reach the branch, and a 240s run logged zero predation attempts.
  assert.match(src, /dietRole !== 'predator-lite'/, 'the hunting guard is the behaviour under test');

  assert.equal(resolveDietRole({ predator: true }), 'predator', 'a flagged predator must be a full hunter');
  assert.equal(resolveDietRole({ diet: 0.95 }), 'predator', 'very carnivorous genes must be a full hunter');
  assert.notEqual(
    resolveDietRole({ predator: true }),
    'predator-lite',
    'flagged predators must not be excluded from their own hunting branch'
  );

  // The lighter chase path must stay reachable too, or _applyPredatorLiteChase
  // becomes the dead branch instead.
  assert.equal(resolveDietRole({ diet: 0.75 }), 'predator-lite', 'the lite carnivore band must still exist');
});

test('steering turns the short way round', () => {
  // Herd and homebody steering did `dir += (target - dir) * k` with no
  // wrapping. `dir` accumulates unbounded while atan2 returns (-PI, PI], so the
  // raw difference could exceed a full rotation and the creature turned the
  // long way — or spun — instead of easing toward the target heading.
  const near = Math.PI - 0.1;
  const across = -Math.PI + 0.1;
  assert.ok(Math.abs(angleDelta(near, across)) < 0.3, 'crossing the PI boundary should be a short turn');
  assert.ok(Math.abs(across - near) > 6, 'the unwrapped difference is the bug being guarded against');

  assert.ok(Math.abs(angleDelta(0, Math.PI * 4 + 0.2) - 0.2) < 1e-9, 'multiple turns should reduce to the remainder');
  for (const [a, b] of [
    [0, 1],
    [1, 0],
    [-3, 3],
    [3, -3],
    [0, Math.PI]
  ]) {
    const d = angleDelta(a, b);
    assert.ok(d > -Math.PI - 1e-9 && d <= Math.PI + 1e-9, `angleDelta(${a}, ${b}) = ${d} must stay within a half turn`);
  }
});

test('herd forces reach the steering target instead of being overwritten', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/creature-behavior.js', import.meta.url), 'utf8');

  // updateHerdBehavior runs after updateMovement has already steered and called
  // applyMovement, so mutating `dir` there was undone by steerToward on the
  // next frame. The whole herd system was a no-op: sweeping radius and weights
  // changed clustering by less than run-to-run noise. It now publishes a
  // heading that updateMovement blends into its steering target.
  assert.doesNotMatch(
    src,
    /dir \+= angleDelta\(this\.creature\.dir, forceAngle\)/,
    'herd force must not be applied to dir after movement has run'
  );
  assert.match(src, /_herdHeading = Math\.atan2/, 'herd behaviour should publish a heading');
  assert.match(src, /applyHerdSteering\(desiredAngle\)/, 'movement should blend that heading into its target');

  const blend = CreatureConfig.MOVEMENT.HERD_STEER_BLEND;
  assert.ok(blend > 0 && blend < 1, `HERD_STEER_BLEND ${blend} must influence steering without overriding foraging`);
});

test('every vegetation type can actually spawn', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/world-ecosystem.js', import.meta.url), 'utf8');

  // spawnChance summed to 1.005 and the roll was rand() in [0, 1), so the
  // running total already hit 1.0 at 'fruit'. golden_fruit sat in a band that
  // could never be rolled and had never appeared in any world.
  assert.match(src, /totalWeight/, 'the food roll must normalise its weights rather than assume they sum to 1');

  const types = /vegetationTypes = \{([\s\S]*?)\n    \};/.exec(src);
  assert.ok(types, 'vegetation table should be readable');
  const chances = [...types[1].matchAll(/spawnChance:\s*([0-9.]+)/g)].map(m => Number(m[1]));
  assert.ok(chances.length >= 4, 'expected the full vegetation table');
  const total = chances.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) > 1e-9, 'this guard matters precisely because the weights do not sum to 1');
});

test('worker snapshot carries the variant genes the metrics count', () => {
  const state = fs.readFileSync(new URL('../creature-sim/src/simulation-state.js', import.meta.url), 'utf8');
  const world = fs.readFileSync(new URL('../creature-sim/src/world-core.js', import.meta.url), 'utf8');

  // collectGameplayMetrics counts aquatic/flying/burrowing straight off genes,
  // and none of them were in the packed layout, so variantsAlive read 0 in the
  // worker runtime no matter what was in the world.
  for (const key of ['AQUATIC', 'FLYING', 'BURROWING']) {
    assert.ok(state.includes(`${key}:`), `${key} must be part of the creature layout`);
  }

  // spawnFlying and spawnBurrowing were implemented but never seeded, and the
  // default genes sit near 0.08, far under the 0.4/0.6 thresholds, so neither
  // type could appear by drift either.
  assert.match(world, /spawnFlying\(/, 'flying creatures should be seeded into a world');
  assert.match(world, /spawnBurrowing\(/, 'burrowing creatures should be seeded into a world');
});

test('satiety does not outrun fuel', () => {
  // Base burn averages ~0.88/s and HUNGER_RATE is 1.0/s. At a relief of 1.85 a
  // 5-energy bite bought 9.25s of satiety against 5s of energy, so creatures
  // stopped foraging while still energy-poor and ran a quiet deficit — food
  // accumulated uneaten beside starving animals. Keeping relief at or below
  // the hunger rate makes hunger and energy deplete in step.
  const { HUNGER_RELIEF_PER_ENERGY, HUNGER_RATE } = CreatureAgentTuning.NEEDS;
  assert.ok(
    HUNGER_RELIEF_PER_ENERGY <= HUNGER_RATE + 1e-9,
    `relief ${HUNGER_RELIEF_PER_ENERGY} must not exceed the hunger rate ${HUNGER_RATE}`
  );
  assert.ok(HUNGER_RELIEF_PER_ENERGY > 0, 'eating must still relieve hunger');
});

test('mating range does not sit on the herd separation distance', () => {
  // Both were 18: herd repulsion pushed pairs apart at exactly the distance
  // mating required them to close to.
  assert.ok(
    CreatureAgentTuning.MATING.RANGE > CreatureConfig.MOVEMENT.HERD_SEPARATION,
    `mating range ${CreatureAgentTuning.MATING.RANGE} must clear herd separation ${CreatureConfig.MOVEMENT.HERD_SEPARATION}`
  );
});

test('creatures remember who they like and who they do not', () => {
  const a = { id: 1 };

  assert.equal(getAffinity(a, 2), 0, 'a stranger starts neutral');

  adjustAffinity(a, 2, 0.4);
  adjustAffinity(a, 2, 0.4);
  assert.ok(getAffinity(a, 2) > 0.7, 'shared time should build warmth');

  adjustAffinity(a, 3, -0.5);
  assert.ok(getAffinity(a, 3) < 0, 'bad company should sour the relationship');

  adjustAffinity(a, 2, 5);
  adjustAffinity(a, 3, -5);
  assert.ok(getAffinity(a, 2) <= 1 && getAffinity(a, 3) >= -1, 'affinity stays within -1..1');

  // Memory is bounded, and the weakest-held relationship is the one forgotten.
  const cap = CreatureAgentTuning.MATING.AFFINITY_MEMORY;
  for (let id = 10; id < 10 + cap * 2; id++) adjustAffinity(a, id, 0.01);
  assert.ok(a.bonds.size <= cap, `bond memory should stay within ${cap}, got ${a.bonds.size}`);
  assert.ok(a.bonds.has(2), 'a strongly held relationship should survive the cull');
});

test('mate choice is swayed by affinity, not distance alone', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/creature-agent-needs.js', import.meta.url), 'utf8');

  // Picking whoever was nearest each frame made senses.mate flip constantly,
  // which reset the bond timer before it could ever reach BOND_TIME.
  assert.match(src, /AFFINITY_MATE_PULL/, 'mate scoring should weigh affinity against distance');
  assert.match(src, /AFFINITY_PROXIMITY_GAIN/, 'affinity must be able to grow outside courtship');

  // Without a proximity path, affinity could only grow during a bond — but a
  // bond needs affinity to complete, so nothing could ever start.
  assert.ok(CreatureAgentTuning.MATING.AFFINITY_PROXIMITY_GAIN > 0, 'familiarity must build from sharing space');
  assert.ok(CreatureAgentTuning.MATING.AFFINITY_PROXIMITY_SPITE > 0, 'hard times must be able to sour a pair');
});

test("herd cohesion answers to the herd's need for food", () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/creature-behavior.js', import.meta.url), 'utf8');

  assert.match(src, /cohesionNeed/, 'cohesion should scale with hunger');
  assert.match(src, /HERD_HUNGER_SPREAD/, 'the hunger response should be tunable');
  const spread = CreatureConfig.MOVEMENT.HERD_HUNGER_SPREAD;
  assert.ok(spread > 0 && spread <= 1, `HERD_HUNGER_SPREAD ${spread} should loosen but not invert cohesion`);

  // Separation and alignment keep the group orderly; only the pull toward the
  // centre gives way to foraging.
  assert.match(src, /separationForce\.x \* W\.HERD_SEPARATION_WEIGHT/, 'separation should stay unscaled');
  assert.match(src, /cohesionForce\.x \* cohesionWeight/, 'cohesion should use the hunger-scaled weight');
});

test('home card art keeps the sprite sheet aspect ratio', () => {
  const css = fs.readFileSync(new URL('../creature-sim/styles.css', import.meta.url), 'utf8');
  const svg = fs.readFileSync(
    new URL('../creature-sim/assets/sprites/ui/ui_scenario_cards.svg', import.meta.url),
    'utf8'
  );

  // The sheet is a horizontal strip mapped with background-size: 700% 100% and
  // positioned by percentage, so the box has to hold the frame's own ratio.
  // A mobile rule set height:48px with aspect-ratio:auto, giving a 2.05:1 box
  // for 1.78:1 art: every frame stretched and the rounded panel baked into
  // each frame stopped lining up with the CSS radius, which is the seam and
  // the off-centre art.
  const dims = /<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/.exec(svg);
  assert.ok(dims, 'sprite sheet should declare its size');
  const frames = [...svg.matchAll(/translate\((\d+) 0\)/g)].map(m => Number(m[1]));
  const frameCount = new Set(frames).size;
  assert.ok(frameCount >= 2, 'sheet should contain multiple frames');

  const frameWidth = Number(dims[1]) / frameCount;
  const frameRatio = frameWidth / Number(dims[2]);
  assert.ok(Math.abs(frameRatio - 16 / 9) < 0.02, `frames are ${frameRatio.toFixed(3)}:1, expected 16:9`);

  // background-size must match the frame count, or the strip lands off-register.
  const bgSize = /background-size:\s*(\d+)%\s+100%/.exec(css);
  assert.ok(bgSize, 'card art should scale the sheet by frame count');
  assert.equal(Number(bgSize[1]), frameCount * 100, 'background-size must equal 100% per frame');

  assert.doesNotMatch(
    css,
    /aspect-ratio:\s*auto;[\s\S]{0,120}?ui_scenario_cards/,
    'card art must keep an explicit ratio'
  );
});

test('menu rows put their icon in a fixed slot', () => {
  const html = fs.readFileSync(new URL('../creature-sim/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../creature-sim/styles.css', import.meta.url), 'utf8');
  const strip = fs.readFileSync(new URL('../creature-sim/src/control-strip.js', import.meta.url), 'utf8');

  // Emoji sat inline in the label text, so each row's label started wherever
  // that particular glyph happened to end.
  const items = [...html.matchAll(/<button class="menu-item"[^>]*>([\s\S]*?)<\/button>/g)];
  assert.ok(items.length > 10, 'expected the full menu');
  for (const [, body] of items) {
    assert.match(body, /class="menu-item-icon"/, 'every menu row needs its icon slot');
    assert.match(body, /class="menu-item-label"/, 'every menu row needs its label span');
  }
  assert.match(css, /\.menu-item-icon\s*\{[^}]*flex:\s*0 0 22px/s, 'the icon slot must be a fixed width');

  // The three toggles rewrite themselves as state changes; textContent would
  // collapse the row back into one text node and undo the alignment.
  assert.match(strip, /setMenuItemLabel\(/, 'toggle labels must preserve the icon/label structure');
});

test('audio settings persist and muting actually silences everything', async () => {
  const store = new Map();
  const priorStorage = globalThis.localStorage;
  const priorWindow = globalThis.window;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  globalThis.window = globalThis.window || {};

  try {
    const mod = await import('../creature-sim/src/audio-system.js');
    const AudioSystem = mod.AudioSystem || mod.default || Object.values(mod).find(v => typeof v === 'function');
    assert.ok(AudioSystem, 'audio system should be constructible');

    const audio = new AudioSystem();
    let stopped = 0;
    audio.stopMusic = () => {
      stopped += 1;
    };

    // Music is a continuous oscillator; toggleSounds only set a flag, so the
    // drone kept playing and the toggle looked broken.
    audio.toggleSounds(false);
    assert.equal(audio.soundsEnabled, false, 'muting should disable sound');
    assert.ok(stopped > 0, 'muting must stop continuous music, not just gate new sounds');

    audio.setMasterVolume(0);

    // Nothing was persisted at all, so any mute lasted until the next reload.
    const reloaded = new AudioSystem();
    assert.equal(reloaded.soundsEnabled, false, 'mute must survive a reload');
    assert.equal(reloaded.masterVolume, 0, 'volume must survive a reload');
  } finally {
    globalThis.localStorage = priorStorage;
    globalThis.window = priorWindow;
  }
});

test('the master volume slider is bound to master volume, not a phantom category', () => {
  const boot = fs.readFileSync(new URL('../creature-sim/src/app-bootstrap.js', import.meta.url), 'utf8');

  // volumes has no 'master' key, so binding it like the other categories read
  // undefined, displayed 0% however loud the game was, and wrote a dead key.
  assert.doesNotMatch(boot, /bindVolumeSlider\('sound-master'/, 'master is not one of the volume categories');
  assert.match(boot, /bindMasterSlider/, 'master needs its own binding');
  assert.match(boot, /audio\.toggleSounds\(/, 'the sound toggle must go through toggleSounds so it persists');
  assert.match(boot, /audio\.toggleMusic\(/, 'the music toggle must go through toggleMusic so it persists');
});

test('pinch zoom stays anchored to the point between the fingers', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/mobile-support.js', import.meta.url), 'utf8');

  // targetZoom was scaled on its own, which zooms about the top-left of the
  // view, so whatever the player pinched slid out from under them.
  assert.match(src, /worldX = anchorX \/ zoomBefore/, 'zoom must be anchored to the pinch centre');
  assert.match(src, /targetX = worldX - anchorX \/ zoomAfter/, 'the camera must compensate for the zoom');

  // The maths itself: the world point under the anchor must not move.
  const cam = { targetX: 400, targetY: 300, targetZoom: 1 };
  const anchorX = 250;
  const anchorY = 180;
  const worldBefore = { x: anchorX / cam.targetZoom + cam.targetX, y: anchorY / cam.targetZoom + cam.targetY };
  for (const factor of [1.25, 0.8, 2, 0.5]) {
    const zoomBefore = cam.targetZoom;
    const zoomAfter = zoomBefore * factor;
    const worldX = anchorX / zoomBefore + cam.targetX;
    const worldY = anchorY / zoomBefore + cam.targetY;
    cam.targetZoom = zoomAfter;
    cam.targetX = worldX - anchorX / zoomAfter;
    cam.targetY = worldY - anchorY / zoomAfter;
    const after = { x: anchorX / cam.targetZoom + cam.targetX, y: anchorY / cam.targetZoom + cam.targetY };
    assert.ok(Math.abs(after.x - worldBefore.x) < 1e-9, `x drifted at factor ${factor}`);
    assert.ok(Math.abs(after.y - worldBefore.y) < 1e-9, `y drifted at factor ${factor}`);
  }
});

test('accents follow the theme token instead of hardcoded cyan and purple', () => {
  const css = fs.readFileSync(new URL('../creature-sim/styles.css', import.meta.url), 'utf8');

  // --accent-primary is redefined to green further down the sheet, but dozens
  // of glows and gradients hardcoded the old cyan and never followed — most
  // visibly the blue-to-purple primary button on the touch onboarding card.
  assert.match(css, /--accent-primary-rgb:/, 'the accent needs a channel form for rgba() glows');
  assert.doesNotMatch(css, /rgba\(0, 212, 255,/, 'cyan glows should follow the accent token');
  assert.doesNotMatch(css, /linear-gradient\(135deg, #60a5fa, #a78bfa\)/, 'the primary button should be on-theme');
  assert.doesNotMatch(css, /#0099cc/, 'the old blue gradient stop should be gone');
});

test('worker-mode prop transport: proxy sends ADD_PROP/REMOVE_PROP shapes and drops malformed payloads', () => {
  const { proxy, sentMessages } = makeFakeWorkerProxy();
  proxy.handleMessage({ data: { type: 'READY' } });

  proxy.addProp('bounce', 10, 20, { radius: 50 });
  let last = sentMessages[sentMessages.length - 1];
  assert.equal(last.type, 'ADD_PROP');
  assert.deepEqual(last.data, { type: 'bounce', x: 10, y: 20, options: { radius: 50 } });

  proxy.removePropById('p1');
  last = sentMessages[sentMessages.length - 1];
  assert.equal(last.type, 'REMOVE_PROP');
  assert.deepEqual(last.data, { id: 'p1' });

  proxy.removeNearestProp(5, 6, 30);
  last = sentMessages[sentMessages.length - 1];
  assert.equal(last.type, 'REMOVE_PROP');
  assert.deepEqual(last.data, { x: 5, y: 6, radius: 30 });

  // Malformed payloads must warn-and-drop, never reach the worker.
  const before = sentMessages.length;
  proxy.addProp('bounce', Number.NaN, 20);
  proxy.addProp(null, 1, 2);
  proxy.addProp('bounce', 1, 2, { radius: Number.NaN });
  proxy.removeNearestProp(Number.NaN, 1);
  proxy.removePropById(null);
  assert.equal(sentMessages.length, before, 'malformed prop payloads must be dropped instead of sent to the worker');
});

test('worker-mode prop transport: per-tick STATE_UPDATE carries sandboxProps to the renderer/save stub', () => {
  const { proxy } = makeFakeWorkerProxy();
  proxy.handleMessage({
    data: {
      type: 'STATE_UPDATE',
      t: 3,
      count: 0,
      creatureBuffer: new ArrayBuffer(0),
      food: [],
      corpses: [],
      sandboxProps: [{ id: 7, type: 'bounce', x: 1, y: 2 }]
    }
  });

  assert.equal(proxy.sandbox.props.length, 1, 'snapshot props should reach world.sandbox.props for the renderer');
  assert.equal(proxy.sandbox.serialize()[0].id, 7, 'snapshot props should reach serialize() for saves');
});

test('worker-simulation: prop cases validate at the boundary and publish props in snapshots', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/worker-simulation.js', import.meta.url), 'utf8');

  // Without these cases every prop click in worker mode (the default) only
  // touched the snapshot stub and silently did nothing.
  assert.match(src, /case 'ADD_PROP'/, 'worker must handle ADD_PROP');
  assert.match(src, /case 'REMOVE_PROP'/, 'worker must handle REMOVE_PROP');
  assert.match(src, /dropping invalid ADD_PROP/, 'malformed ADD_PROP must warn instead of failing silently');
  assert.match(src, /dropping invalid REMOVE_PROP/, 'malformed REMOVE_PROP must warn instead of failing silently');
  assert.match(src, /world\.sandbox\.addProp\(type, x, y/, 'ADD_PROP must reach the live sandbox');
  assert.match(src, /removePropById\(id\)/, 'REMOVE_PROP with {id} must remove by id');
  assert.match(src, /removeNearestProp\(x, y/, 'REMOVE_PROP with {x,y} must remove nearest');
  assert.match(src, /sendSnapshot\(\)/, 'prop mutations must publish a fresh snapshot');
  assert.match(src, /sandboxProps: world\.sandbox/, 'STATE_UPDATE must carry props to the renderer/save stub');
});

test('worker-mode grab/throw and habitat snapshot messages exist', () => {
  const src = fs.readFileSync(new URL('../creature-sim/src/worker-simulation.js', import.meta.url), 'utf8');
  assert.match(src, /case 'GRAB_CREATURE'/, 'worker must handle grabs');
  assert.match(src, /case 'THROW_CREATURE'/, 'worker must handle throws');
  assert.match(src, /foodPatches: compactFoodPatches/, 'habitat patches must ride the snapshot');
  assert.match(src, /regions: compactRegions/, 'region pressure must ride the snapshot');
});

test('proxy sandbox.addProp forwards to ADD_PROP so scenario setup works in worker mode', () => {
  const { proxy, sentMessages } = makeFakeWorkerProxy();
  proxy.handleMessage({ data: { type: 'READY' } });
  proxy.sandbox.addProp('spring', 40, 50);
  const last = sentMessages[sentMessages.length - 1];
  assert.equal(last.type, 'ADD_PROP');
  proxy.grabCreature(3, 10, 12);
  assert.equal(sentMessages[sentMessages.length - 1].type, 'GRAB_CREATURE');
  proxy.throwCreature(3, 80, -20);
  assert.equal(sentMessages[sentMessages.length - 1].type, 'THROW_CREATURE');
});

test('creature presentation uses packed flying/burrowing/aquatic genes', async () => {
  const { getCreatureAssetKey } = await import('../creature-sim/src/creature-presentation.js');
  assert.equal(getCreatureAssetKey({ genes: { flying: 0.9, diet: 0 } }), 'creature_flying');
  assert.equal(getCreatureAssetKey({ genes: { burrowing: 0.8, diet: 0 } }), 'creature_burrowing');
  assert.equal(getCreatureAssetKey({ genes: { aquatic: 0.7, diet: 0 } }), 'creature_aquatic');
});

test('lineage objectives prefer the pinned founder line', () => {
  const metrics = collectGameplayMetrics(
    {
      creatures: [
        { id: 1, alive: true, genes: { diet: 0 }, generation: 1 },
        { id: 2, alive: true, genes: { diet: 0 }, parentId: 1, generation: 4 },
        { id: 9, alive: true, genes: { diet: 0 }, generation: 12 }
      ],
      lineageTracker: {
        generation: (_world, id) => (id === 2 ? 4 : id === 1 ? 1 : 12),
        getRoot: (_world, id) => (id === 2 || id === 1 ? 1 : 9)
      }
    },
    { founderId: 1 }
  );
  assert.equal(metrics.founderGeneration, 4);
  assert.ok(metrics.maxGeneration >= 4);
});

test('tools: placeProp/eraseAt prefer the worker proxy when present, sandbox otherwise', () => {
  const camera = { screenToWorld: (x, y) => ({ x, y }) };

  const proxyCalls = [];
  const sandboxCalls = [];
  const proxyWorld = {
    addProp: (type, x, y, options) => {
      proxyCalls.push(['add', type, x, y, options]);
      return null;
    },
    removeNearestProp: (x, y, radius) => {
      proxyCalls.push(['remove', x, y, radius]);
      return null;
    },
    sandbox: {
      props: [{ id: 1, type: 'bounce', x: 50, y: 50, radius: 52 }],
      addProp: (...args) => {
        sandboxCalls.push(args);
        return { id: 9 };
      },
      removeNearestProp: (...args) => {
        sandboxCalls.push(args);
        return { id: 1 };
      }
    },
    creatures: [],
    queryCreatures: () => []
  };
  const proxyTools = new ToolController(proxyWorld, camera);
  proxyTools.placeProp(50, 50, { type: 'bounce' });
  assert.equal(proxyCalls.length, 1, 'placeProp should forward once through the proxy');
  assert.equal(proxyCalls[0][0], 'add');
  assert.equal(sandboxCalls.length, 0, 'proxy present: must not touch the local snapshot stub');

  proxyTools.eraseAt(50, 50);
  assert.ok(
    proxyCalls.some(call => call[0] === 'remove'),
    'erase over a snapshot prop should forward REMOVE_PROP'
  );
  assert.equal(sandboxCalls.length, 0, 'proxy present: erase must not touch the local snapshot stub');

  // Erase over empty space falls through to creatures, not props.
  const callsBefore = proxyCalls.length;
  proxyTools.eraseAt(5000, 5000);
  assert.equal(proxyCalls.length, callsBefore, 'erase over empty space must not send REMOVE_PROP');

  // Main-thread fallback still uses the sandbox directly and returns the prop.
  const directCalls = [];
  const directWorld = {
    sandbox: {
      addProp: (type, x, y) => {
        directCalls.push(['add', type, x, y]);
        return { id: 2, type, x, y, radius: 52 };
      },
      removeNearestProp: (x, y) => {
        directCalls.push(['remove', x, y]);
        return null;
      }
    },
    creatures: [],
    queryCreatures: () => []
  };
  const directTools = new ToolController(directWorld, camera);
  const prop = directTools.placeProp(10, 10, { type: 'spring' });
  assert.ok(prop && prop.id === 2, 'main-thread placeProp should return the created prop');
  assert.equal(directCalls[0][0], 'add');
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
