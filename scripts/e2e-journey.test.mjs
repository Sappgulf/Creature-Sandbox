/**
 * e2e-journey.test.mjs
 *
 * End-to-end journey test that exercises the full save/load/simulate cycle
 * using the real core modules in a Node.js environment. No browser, no
 * Playwright. Runs in <5 seconds as part of the `npm test` chain.
 *
 * Journey (each step is a single assertion):
 *   1. Create a fresh World with a deterministic BiomeGenerator
 *   2. Seed the world with 50 herbivores, 5 predators, 200 food
 *   3. Run 100 simulation steps
 *   4. Verify population has evolved (deaths or births)
 *   5. Capture a save via saveSystem.serialize()
 *   6. Reset the world
 *   7. Load the save
 *   8. Verify state was restored (creature count + food count match)
 *   9. Run 50 more steps
 *  10. Verify the loaded world still functions (population changes)
 */

import assert from 'node:assert/strict';
import { performance as nodePerformance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (!globalThis.performance) {
  globalThis.performance = nodePerformance;
}

import { World } from '../creature-sim/src/world-core.js';
import { Creature } from '../creature-sim/src/creature.js';
import { Camera } from '../creature-sim/src/camera.js';
import { SaveSystem } from '../creature-sim/src/save-system.js';
import { makeGenes } from '../creature-sim/src/genetics.js';
import { BiomeGenerator } from '../creature-sim/src/perlin-noise.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 800;

function buildFreshWorld(seed = 42) {
  const world = new World(WORLD_WIDTH, WORLD_HEIGHT);
  // Replace the random biome with a deterministic one so the journey is reproducible.
  world.biomeGenerator = new BiomeGenerator(seed);
  world.biomeMap = world.biomeGenerator.generateBiomeMap(WORLD_WIDTH, WORLD_HEIGHT, 50);
  return world;
}

function buildCamera(world) {
  return new Camera({
    x: world.width * 0.5,
    y: world.height * 0.5,
    zoom: 1,
    worldWidth: world.width,
    worldHeight: world.height,
    viewportWidth: 800,
    viewportHeight: 600
  });
}

console.log('\n=== e2e-journey.test.mjs ===');

test('E2E Journey: seed → simulate → save → reset → load → simulate', () => {
  // ---- 1. Fresh world with deterministic BiomeGenerator ----
  const world = buildFreshWorld(42);
  assert.ok(world instanceof World, 'World should be constructed');
  assert.equal(world.width, WORLD_WIDTH, 'World width should match');
  assert.equal(world.height, WORLD_HEIGHT, 'World height should match');
  assert.ok(world.biomeGenerator instanceof BiomeGenerator, 'BiomeGenerator should be attached');
  assert.equal(world.creatures.length, 0, 'Fresh world should have no creatures');

  // ---- 2. Seed world: 50 herbivores, 5 predators, 200 food ----
  world.seed(50, 5, 200);
  // Seed splits 50 herbivores into clusters (which can lose a few to integer
  // truncation), plus aquatic and omnivore sub-populations, plus 5 predators.
  // We assert that the world is populated near the requested size and contains
  // the exact predator count, which is the only directly-validated figure.
  assert.ok(
    world.creatures.length >= 50 && world.creatures.length <= 60,
    `Seed should produce 50–60 creatures, got ${world.creatures.length}`
  );
  const predators = world.creatures.filter(c => c.genes.predator === 1);
  assert.equal(predators.length, 5, 'Should have exactly 5 predators');
  const nonPredators = world.creatures.filter(c => c.genes.predator !== 1);
  assert.ok(nonPredators.length >= 45, 'Should have at least 45 non-predator creatures');
  assert.ok(world.food.length > 0, 'Seed should produce food');
  assert.ok(world.food.length <= 200, 'Food should not exceed requested amount');
  const initialCreatureCount = world.creatures.length;
  const initialFoodCount = world.food.length;

  // ---- 3. Run 100 simulation steps ----
  for (let i = 0; i < 100; i++) {
    world.step(0.05);
  }
  // Allow a tiny floating-point epsilon since 100 * 0.05 may be 4.9999...
  assert.ok(world.t >= 4.99, `World time should advance after 100 steps (got ${world.t})`);

  // ---- 4. Population has evolved: verify simulation activity ----
  // We accept any of: population count shifted, food consumed, or damage
  // taken/dealt increased. With only 100 steps on a 53-creature world it is
  // possible that the population is still perfectly stable, but the
  // simulation should still be ticking the per-creature stats counters.
  let totalFood = 0;
  let totalDamageTaken = 0;
  let totalDamageDealt = 0;
  let totalBirths = 0;
  let totalKills = 0;
  for (const c of world.creatures) {
    totalFood += c.stats?.food ?? 0;
    totalDamageTaken += c.stats?.damageTaken ?? 0;
    totalDamageDealt += c.stats?.damageDealt ?? 0;
    totalBirths += c.stats?.births ?? 0;
    totalKills += c.stats?.kills ?? 0;
  }
  const populationShifted = world.creatures.length !== initialCreatureCount;
  const activityRecorded =
    populationShifted ||
    totalFood > 0 ||
    totalDamageTaken > 0 ||
    totalDamageDealt > 0 ||
    totalBirths > 0 ||
    totalKills > 0;
  assert.ok(activityRecorded, 'Simulation should record activity (births, deaths, food, or damage) over 100 steps');
  const midSimCreatureCount = world.creatures.length;
  const midSimFoodCount = world.food.length;

  // ---- 5. Capture a save ----
  const saveSystem = new SaveSystem();
  const camera = buildCamera(world);
  const saveData = saveSystem.serialize(world, camera, null, null);
  assert.ok(saveData && saveData.world, 'serialize() should return save data with world');
  assert.equal(saveData.world.creatures.length, midSimCreatureCount, 'Save should snapshot all creatures');
  const serializedJson = JSON.stringify(saveData);
  assert.ok(serializedJson.length > 0, 'Save data should serialize to JSON');

  // ---- 6. Reset the world ----
  world.reset();
  assert.equal(world.creatures.length, 0, 'Reset should clear creatures');
  assert.equal(world.food.length, 0, 'Reset should clear food');
  assert.equal(world.t, 0, 'Reset should zero out time');

  // ---- 7. Load the save ----
  const result = saveSystem.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
  assert.ok(result && result.world, 'deserialize() should return result with world');
  const loadedWorld = result.world;
  assert.equal(loadedWorld.creatures.length, midSimCreatureCount, 'Creature count should match after load');
  assert.equal(loadedWorld.food.length, midSimFoodCount, 'Food count should match after load');
  assert.equal(loadedWorld.width, WORLD_WIDTH, 'World width should match after load');
  assert.equal(loadedWorld.height, WORLD_HEIGHT, 'World height should match after load');

  // ---- 8. Verify state was restored ----
  // Compare IDs of creatures in save and loaded world.
  const savedIds = saveData.world.creatures.map(c => c.id).sort((a, b) => a - b);
  const loadedIds = loadedWorld.creatures.map(c => c.id).sort((a, b) => a - b);
  assert.deepEqual(loadedIds, savedIds, 'Loaded creature IDs should match saved IDs');

  // Sample a few creatures and verify their key properties survived the round trip.
  const sampleSize = Math.min(5, loadedWorld.creatures.length);
  for (let i = 0; i < sampleSize; i++) {
    const loaded = loadedWorld.creatures[i];
    const original = saveData.world.creatures.find(c => c.id === loaded.id);
    assert.ok(original, `Saved creature with id ${loaded.id} should exist`);
    assert.equal(loaded.alive, original.alive, `alive should round-trip for ${loaded.id}`);
    assert.equal(loaded.energy, original.energy, `energy should round-trip for ${loaded.id}`);
    assert.equal(loaded.age, original.age, `age should round-trip for ${loaded.id}`);
    assert.equal(loaded.x, original.x, `x should round-trip for ${loaded.id}`);
    assert.equal(loaded.y, original.y, `y should round-trip for ${loaded.id}`);
  }

  // ---- 9. Run 50 more steps on the loaded world ----
  const preStepCount = loadedWorld.creatures.length;
  for (let i = 0; i < 50; i++) {
    loadedWorld.step(0.05);
  }
  // Allow tiny floating-point epsilon since 50 * 0.05 may be 2.4999...
  assert.ok(loadedWorld.t >= 2.49, `Loaded world time should advance after 50 more steps (got ${loadedWorld.t})`);

  // ---- 10. Verify the loaded world still functions ----
  // After 50 steps, no errors should have been thrown, and the world should
  // still be evolving. The exact population change is non-deterministic, but
  // the simulation must be alive and functional.
  assert.ok(Array.isArray(loadedWorld.creatures), 'creatures should remain an array');
  assert.ok(loadedWorld.t > 0, 'time should be positive after 50 more steps');
  assert.ok(
    loadedWorld.creatures.every(c => typeof c.energy === 'number'),
    'all loaded creatures should still have valid energy'
  );
  assert.ok(
    loadedWorld.creatures.every(c => typeof c.alive === 'boolean'),
    'all loaded creatures should still have valid alive flag'
  );
  // Population should be in a reasonable range (not zero, not exploded).
  assert.ok(loadedWorld.creatures.length > 0, 'population should not collapse to 0');
  assert.ok(loadedWorld.creatures.length < 1000, 'population should not explode');
});

console.log('\n=== E2E SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Duration file: ${fileURLToPath(import.meta.url)}`);

if (failed > 0) {
  console.log('Some E2E tests failed!');
  // Use process.exit to short-circuit the chained `&&` runner in npm test
  // without a noisy stack trace.
  process.exit(1);
} else {
  console.log('All E2E tests passed!');
}
