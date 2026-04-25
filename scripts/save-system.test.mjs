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

// Edge case: empty world preserves structure
const emptyWorld = new World(100, 80);
emptyWorld.reset();
emptyWorld.t = 0;
emptyWorld.creatureManager._nextId = 0;
const emptySave = saveSystem.serialize(emptyWorld, camera, null, null);
assert.equal(emptySave.world.creatures.length, 0, 'empty world should have no creatures');
assert.equal(emptySave.world.food.length, 0, 'empty world should have no food');

// Edge case: world with creatures of different types
const multiWorld = new World(100, 80);
multiWorld.reset();
multiWorld.spawnCreatureType('herbivore', 30, 40);
multiWorld.spawnCreatureType('predator', 70, 60);
multiWorld.spawnCreatureType('omnivore', 50, 30);
const multiSave = saveSystem.serialize(multiWorld, camera, null, null);
assert.equal(multiSave.world.creatures.length, 3, 'should save 3 creatures');

// High-value regression: active systems round-trip together.
const systemsWorld = new World(400, 300);
systemsWorld.reset();
systemsWorld.spawnCreatureType('herbivore', 120, 140);
const remembered = systemsWorld.creatures[0];
remembered.temperament = {
  boldness: 0.2,
  sociability: 0.7,
  calmness: 0.8,
  curiosity: 0.4
};
remembered.quirks = ['homebody', 'night_owl'];
remembered.memory = {
  capacity: 12,
  nextId: 3,
  locations: [
    { id: 1, x: 130, y: 144, type: 'food', tag: 'food', strength: 0.9, timestamp: 4 },
    { id: 2, x: 90, y: 100, type: 'danger', tag: 'danger', strength: 0.5, timestamp: 5 }
  ]
};
systemsWorld.food = [{ x: 155, y: 165, energy: 2.5, bites: 3, biteEnergy: 0.5, type: 'berry', scentRadius: 110 }];
systemsWorld.sandbox?.addProp?.('spring', 180, 190, { strength: 1.7 });
if (systemsWorld.events) {
  systemsWorld.events.activeEvent = {
    type: 'food_bloom',
    label: 'Food bloom',
    remaining: 12,
    duration: 30
  };
  systemsWorld.events.cooldown = 6;
  systemsWorld.eventModifiers = { foodGrowth: 1.4, stress: 0.8 };
}

const systemsSave = saveSystem.serialize(systemsWorld, camera, null, null);
const systemsResult = saveSystem.deserialize(systemsSave, World, Creature, Camera, makeGenes, BiomeGenerator);
const restoredCreature = systemsResult.world.creatures[0];
assert.deepEqual(restoredCreature.quirks, ['homebody', 'night_owl'], 'quirks should round-trip');
assert.equal(restoredCreature.temperament.calmness, 0.8, 'temperament should round-trip');
assert.equal(restoredCreature.memory.locations.length, 2, 'memory locations should round-trip');
assert.equal(restoredCreature.memory.locations[0].type, 'food', 'memory type should round-trip');
assert.equal(systemsResult.world.food[0].bites, 3, 'food bites should round-trip');
assert.equal(systemsResult.world.sandbox.props.length, 1, 'sandbox props should round-trip');
assert.equal(systemsResult.world.sandbox.props[0].type, 'spring', 'sandbox prop type should round-trip');
assert.equal(systemsResult.world.events.activeEvent.type, 'food_bloom', 'active world event should round-trip');
assert.equal(systemsResult.world.eventModifiers.foodGrowth, 1.4, 'event modifiers should round-trip');

console.log('Save system tests passed.');
