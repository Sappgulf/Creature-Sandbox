import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance as nodePerformance } from 'node:perf_hooks';

import { SaveSystem } from '../creature-sim/src/save-system.js';
import { World } from '../creature-sim/src/world-core.js';
import { Creature } from '../creature-sim/src/creature.js';
import { Camera } from '../creature-sim/src/camera.js';
import { makeGenes } from '../creature-sim/src/genetics.js';
import { BiomeGenerator } from '../creature-sim/src/perlin-noise.js';

if (!globalThis.performance) {
  globalThis.performance = nodePerformance;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const saveSystem = new SaveSystem();

function buildWorldWithZeroes() {
  const world = new World(100, 80);
  world.reset();

  world.t = 0;
  if (world.environment) {
    world.environment.seasonPhase = 0;
    world.environment.timeOfDay = 0;
    world.environment.dayLength = 0;
  }
  world.creatureManager._nextId = 0;

  const creature = new Creature(10, 20, makeGenes(), false);
  creature.id = 1;
  creature.parentId = null;
  creature.vx = 0;
  creature.vy = 0;
  creature.dir = 0;
  creature.energy = 0;
  creature.age = 0;
  creature.maxHealth = 10;
  creature.health = 0;
  creature.alive = false;
  creature.deathTime = 1;
  creature.deathCause = 'test';
  creature.killedBy = 99;
  creature.personality = {
    ...creature.personality,
    packInstinct: 0.91,
    ambushDelay: 3.3,
    aggression: 1.8,
    attackCooldown: 0.7,
    idleTempo: 1.25,
    playfulness: 0.88
  };

  world.creatures = [creature];
  world.registry.clear();
  world.registry.set(creature.id, creature);
  world.childrenOf.clear();
  world.childrenOf.set(creature.id, new Set([2]));

  world.food = [{ x: 1, y: 2, energy: 0 }];
  world.corpses = [{ x: 3, y: 4, energy: 0, age: 0, isPredator: false }];

  const camera = new Camera({
    x: 0,
    y: 0,
    zoom: 0.5,
    worldWidth: world.width,
    worldHeight: world.height,
    viewportWidth: 800,
    viewportHeight: 600
  });

  return { world, camera };
}

function assertZeroPreservation(result, {
  expectedNextId = 0,
  expectedDayNightEnabled = true,
  expectedPersonality = null
} = {}) {
  assert.equal(result.world.timeOfDay, 0, 'timeOfDay should preserve 0');
  assert.equal(result.world.dayLength, 0, 'dayLength should preserve 0');
  assert.equal(result.world.environment.timeOfDay, 0, 'environment timeOfDay should preserve 0');
  assert.equal(result.world.environment.dayLength, 0, 'environment dayLength should preserve 0');
  assert.equal(result.world.environment.seasonPhase, 0, 'environment seasonPhase should preserve 0');
  assert.equal(result.world.environment.dayNightEnabled, expectedDayNightEnabled, 'environment dayNightEnabled should preserve value');
  assert.equal(result.world.t, 0, 'world.t should preserve 0');
  assert.equal(result.world.seasonPhase, 0, 'seasonPhase should preserve 0');
  assert.equal(result.world.creatureManager._nextId, expectedNextId, '_nextId should preserve value');

  const creature = result.world.creatures[0];
  assert.equal(creature.energy, 0, 'energy should preserve 0');
  assert.equal(creature.health, 0, 'health should preserve 0');
  assert.equal(creature.vx, 0, 'vx should preserve 0');
  assert.equal(creature.vy, 0, 'vy should preserve 0');
  assert.equal(creature.dir, 0, 'dir should preserve 0');
  assert.equal(creature.alive, false, 'alive should preserve false');
  assert.equal(creature.deathTime, 1, 'deathTime should preserve value');
  if (expectedPersonality) {
    assert.equal(creature.personality.packInstinct, expectedPersonality.packInstinct, 'personality packInstinct should round-trip');
    assert.equal(creature.personality.ambushDelay, expectedPersonality.ambushDelay, 'personality ambushDelay should round-trip');
    assert.equal(creature.personality.aggression, expectedPersonality.aggression, 'personality aggression should round-trip');
    assert.equal(creature.personality.attackCooldown, expectedPersonality.attackCooldown, 'personality attackCooldown should round-trip');
    assert.equal(creature.personality.idleTempo, expectedPersonality.idleTempo, 'personality idleTempo should round-trip');
    assert.equal(creature.personality.playfulness, expectedPersonality.playfulness, 'personality playfulness should round-trip');
  }

  assert.equal(result.world.food[0].energy, 0, 'food energy should preserve 0');
  assert.equal(result.world.corpses[0].energy, 0, 'corpse energy should preserve 0');
}

const { world, camera } = buildWorldWithZeroes();
const saveData = saveSystem.serialize(world, camera, null, null);
assert.equal(saveData.world.timeOfDay, 0, 'serialized timeOfDay should be 0');
assert.equal(saveData.world.dayLength, 0, 'serialized dayLength should be 0');

const roundTrip = saveSystem.deserialize(saveData, World, Creature, Camera, makeGenes, BiomeGenerator);
assertZeroPreservation(roundTrip, {
  expectedNextId: 0,
  expectedDayNightEnabled: true,
  expectedPersonality: {
    packInstinct: 0.91,
    ambushDelay: 3.3,
    aggression: 1.8,
    attackCooldown: 0.7,
    idleTempo: 1.25,
    playfulness: 0.88
  }
});

const fixturePath = path.join(__dirname, 'fixtures', 'save-v2.json');
const fixtureRaw = await fs.readFile(fixturePath, 'utf8');
const fixtureData = JSON.parse(fixtureRaw);
const fixtureResult = saveSystem.deserialize(fixtureData, World, Creature, Camera, makeGenes, BiomeGenerator);
assertZeroPreservation(fixtureResult, { expectedNextId: 2, expectedDayNightEnabled: false });
assert.equal(fixtureResult.world.biomeGenerator.seed, 0, 'biomeSeed should preserve 0');

console.log('Save system tests passed.');
