import assert from 'node:assert/strict';
import {
  getCreatureAnimationDetails,
  getCreatureAssetKey,
  getCreatureHue,
  getCreatureRenderSize,
  getCreatureSpriteColor
} from '../creature-sim/src/creature-presentation.js';
import { getLandscapeLandmarks, getBiomeTint } from '../creature-sim/src/renderer-biome.js';

assert.equal(getCreatureAssetKey({ ageStage: 'baby', genes: { predator: true, diet: 1 } }), 'creature_baby');
assert.equal(getCreatureAssetKey({ ageStage: 'adult', genes: { predator: true, diet: 0.9 } }), 'creature_predator');
assert.equal(getCreatureAssetKey({ ageStage: 'adult', traits: { creatureType: 'flying' } }), 'creature_flying');
assert.equal(getCreatureAssetKey({ ageStage: 'adult', genes: { diet: 0.5 } }), 'creature_omnivore');
assert.equal(getCreatureAssetKey({ ageStage: 'adult', genes: { diet: 0.1 } }), 'creature_herbivore');

assert.equal(getCreatureHue({ genes: { hue: 361 } }), 0);
assert.equal(getCreatureSpriteColor({ genes: { hue: 120, predator: false } }), 'hsl(120, 85%, 60%)');

const idle = getCreatureAnimationDetails({ animation: { state: 'idle', speedRatio: 0.5 } });
const running = getCreatureAnimationDetails({ animation: { state: 'running', speedRatio: 1.2 } });
assert.equal(idle.state, 'idle');
assert.equal(running.state, 'running');
assert.ok(running.speedScale > idle.speedScale);

const ordinarySize = getCreatureRenderSize({ energy: 20, size: 2 }, { zoom: 1 });
const focusedSize = getCreatureRenderSize({ energy: 20, size: 2 }, { zoom: 1, isSelected: true });
assert.ok(ordinarySize >= 24);
assert.ok(focusedSize >= 30);

const landmarks = getLandscapeLandmarks(4000, 2800);
assert.equal(landmarks.length, 7);
assert.ok(landmarks.every(landmark => landmark.x >= 0 && landmark.x <= 4000));
assert.ok(landmarks.every(landmark => landmark.y >= 0 && landmark.y <= 2800));
assert.ok(landmarks.every(landmark => Number.isFinite(landmark.radius) && landmark.radius > 0));

assert.match(getBiomeTint('desert'), /168/);
assert.match(getBiomeTint('jungle'), /42, 98, 70/);
assert.match(getBiomeTint('tundra'), /92, 112, 132/);
assert.match(getBiomeTint('savanna'), /158, 132, 72/);
assert.notEqual(getBiomeTint('ocean'), getBiomeTint('grassland'));

console.log('Creature presentation checks passed');
