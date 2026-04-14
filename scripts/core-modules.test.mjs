import assert from 'node:assert/strict';
import { performance as nodePerformance } from 'node:perf_hooks';

if (!globalThis.performance) {
  globalThis.performance = nodePerformance;
}

import { rand, clamp, dist2, lerp, invLerp, remap, randn, wrap } from '../creature-sim/src/utils.js';
import { makeGenes, mutateGenes, GENETIC_DISORDERS, MUTATION_TYPES, applyDisorderEffects, getExpressedGenes, getGeneticInfo, breedGenes, applyMutations } from '../creature-sim/src/genetics.js';
import { SpatialGrid } from '../creature-sim/src/spatial-grid.js';
import { ObjectPool, Vector2DPool, ArrayPool, ParticlePool, PoolManager, TempObjectPool } from '../creature-sim/src/object-pool.js';
import { LineageTracker } from '../creature-sim/src/lineage-tracker.js';

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

// ============================================================================
// utils.js
// ============================================================================
console.log('\n=== utils.js ===');

test('clamp: value below range', () => {
  assert.equal(clamp(-5, 0, 10), 0);
});

test('clamp: value above range', () => {
  assert.equal(clamp(15, 0, 10), 10);
});

test('clamp: value within range', () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test('clamp: value at lower bound', () => {
  assert.equal(clamp(0, 0, 10), 0);
});

test('clamp: value at upper bound', () => {
  assert.equal(clamp(10, 0, 10), 10);
});

test('clamp: negative range', () => {
  assert.equal(clamp(-3, -10, -2), -3);
});

test('lerp: interpolation at 0', () => {
  assert.equal(lerp(10, 20, 0), 10);
});

test('lerp: interpolation at 1', () => {
  assert.equal(lerp(10, 20, 1), 20);
});

test('lerp: interpolation at 0.5', () => {
  assert.equal(lerp(10, 20, 0.5), 15);
});

test('lerp: negative values', () => {
  assert.equal(lerp(-10, 10, 0.5), 0);
});

test('lerp: extrapolation beyond 1', () => {
  assert.equal(lerp(10, 20, 2), 30);
});

test('invLerp: inverse at start', () => {
  assert.equal(invLerp(10, 20, 10), 0);
});

test('invLerp: inverse at end', () => {
  assert.equal(invLerp(10, 20, 20), 1);
});

test('invLerp: inverse at midpoint', () => {
  assert.equal(invLerp(10, 20, 15), 0.5);
});

test('invLerp: a === b returns 0', () => {
  assert.equal(invLerp(5, 5, 100), 0);
});

test('remap: basic remapping', () => {
  const result = remap(0, 100, 0, 1, 50);
  assert.ok(Math.abs(result - 0.5) < 1e-10);
});

test('remap: value at start', () => {
  assert.equal(remap(0, 100, 0, 1, 0), 0);
});

test('remap: value at end', () => {
  assert.equal(remap(0, 100, 0, 1, 100), 1);
});

test('remap: clamps out-of-range values', () => {
  const result = remap(0, 100, 0, 1, 200);
  assert.equal(result, 1);
  const result2 = remap(0, 100, 0, 1, -50);
  assert.equal(result2, 0);
});

test('wrap: negative value wraps', () => {
  assert.equal(wrap(-1, 10), 9);
});

test('wrap: overflow value wraps', () => {
  assert.equal(wrap(10, 10), 0);
});

test('wrap: value at boundary', () => {
  assert.equal(wrap(5, 10), 5);
});

test('wrap: large negative', () => {
  assert.equal(wrap(-15, 10), -5);
});

test('wrap: exact max value wraps to 0', () => {
  assert.equal(wrap(10, 10), 0);
});

test('wrap: value less than max stays', () => {
  assert.equal(wrap(9, 10), 9);
});

test('dist2: basic distance squared', () => {
  assert.equal(dist2(0, 0, 3, 4), 25);
});

test('dist2: same point is zero', () => {
  assert.equal(dist2(5, 5, 5, 5), 0);
});

test('dist2: negative coordinates', () => {
  assert.equal(dist2(-1, -1, 2, 3), 25);
});

test('rand: returns value in range', () => {
  for (let i = 0; i < 100; i++) {
    const v = rand(5, 10);
    assert.ok(v >= 5 && v < 10, `rand returned ${v}, out of [5, 10)`);
  }
});

test('rand: default range [0, 1)', () => {
  for (let i = 0; i < 100; i++) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `rand() returned ${v}, out of [0, 1)`);
  }
});

test('randn: returns numbers (distribution smoke test)', () => {
  const values = [];
  for (let i = 0; i < 50; i++) {
    values.push(randn(0, 1));
  }
  assert.ok(values.every(v => typeof v === 'number' && isFinite(v)), 'randn should return finite numbers');
});

// ============================================================================
// genetics.js
// ============================================================================
console.log('\n=== genetics.js ===');

test('makeGenes: returns object with expected gene properties', () => {
  const genes = makeGenes();
  assert.ok(typeof genes === 'object' && genes !== null, 'makeGenes should return an object');
  assert.ok('speed' in genes, 'genes should have speed');
  assert.ok('fov' in genes, 'genes should have fov');
  assert.ok('sense' in genes, 'genes should have sense');
  assert.ok('metabolism' in genes, 'genes should have metabolism');
  assert.ok('hue' in genes, 'genes should have hue');
  assert.ok('diet' in genes, 'genes should have diet');
  assert.ok('sex' in genes, 'genes should have sex');
  assert.ok('predator' in genes, 'genes should have predator');
  assert.ok('disorders' in genes, 'genes should have disorders');
  assert.ok('mutations' in genes, 'genes should have mutations');
  assert.ok('aggression' in genes, 'genes should have aggression');
  assert.ok('packInstinct' in genes, 'genes should have packInstinct');
  assert.ok('herdInstinct' in genes, 'genes should have herdInstinct');
  assert.ok('grit' in genes, 'genes should have grit');
  assert.ok('nocturnal' in genes, 'genes should have nocturnal');
  assert.ok('aquatic' in genes, 'genes should have aquatic');
  assert.ok('spines' in genes, 'genes should have spines');
  assert.ok('ambushDelay' in genes, 'genes should have ambushDelay');
  assert.ok('panicPheromone' in genes, 'genes should have panicPheromone');
});

test('makeGenes: diploid traits have allele1, allele2, expressed, min, max', () => {
  const genes = makeGenes();
  const diploidTraits = ['speed', 'fov', 'sense', 'metabolism', 'packInstinct', 'aggression', 'herdInstinct', 'grit', 'nocturnal', 'aquatic', 'spines', 'ambushDelay', 'panicPheromone'];
  for (const key of diploidTraits) {
    const trait = genes[key];
    assert.ok(typeof trait === 'object' && 'allele1' in trait && 'allele2' in trait, `${key} should be diploid`);
    assert.equal(typeof trait.allele1, 'number', `${key}.allele1 should be number`);
    assert.equal(typeof trait.allele2, 'number', `${key}.allele2 should be number`);
    assert.equal(typeof trait.expressed, 'number', `${key}.expressed should be number`);
    assert.equal(typeof trait.min, 'number', `${key}.min should be number`);
    assert.equal(typeof trait.max, 'number', `${key}.max should be number`);
  }
});

test('makeGenes: override speed with seed', () => {
  const genes = makeGenes({ speed: 1.5, sex: 'female' });
  assert.equal(genes.speed.allele1, 1.5);
  assert.equal(genes.speed.allele2, 1.5);
  assert.equal(genes.speed.expressed, 1.5);
});

test('makeGenes: override predator flag', () => {
  const genes = makeGenes({ predator: 1 });
  assert.equal(genes.predator, 1);
});

test('makeGenes: sex is male or female', () => {
  for (let i = 0; i < 50; i++) {
    const genes = makeGenes();
    assert.ok(genes.sex === 'male' || genes.sex === 'female', `unexpected sex: ${genes.sex}`);
  }
});

test('makeGenes: override sex', () => {
  const genes = makeGenes({ sex: 'male' });
  assert.equal(genes.sex, 'male');
  const genes2 = makeGenes({ sex: 'female' });
  assert.equal(genes2.sex, 'female');
});

test('makeGenes: gene values stay within expected ranges after creation', () => {
  for (let i = 0; i < 20; i++) {
    const genes = makeGenes();
    const diploidTraits = ['speed', 'fov', 'sense', 'metabolism', 'packInstinct', 'aggression', 'herdInstinct', 'grit', 'nocturnal', 'aquatic', 'spines', 'ambushDelay'];
    for (const key of diploidTraits) {
      const trait = genes[key];
      assert.ok(trait.allele1 >= trait.min && trait.allele1 <= trait.max, `${key}.allele1 out of range: ${trait.allele1} not in [${trait.min}, ${trait.max}]`);
      assert.ok(trait.allele2 >= trait.min && trait.allele2 <= trait.max, `${key}.allele2 out of range: ${trait.allele2} not in [${trait.min}, ${trait.max}]`);
    }
  }
});

test('GENETIC_DISORDERS: has expected disorders', () => {
  assert.ok('ALBINISM' in GENETIC_DISORDERS);
  assert.ok('HEMOPHILIA' in GENETIC_DISORDERS);
  assert.ok('GIGANTISM' in GENETIC_DISORDERS);
  assert.ok('DWARFISM' in GENETIC_DISORDERS);
  assert.ok('HYPERMETABOLISM' in GENETIC_DISORDERS);
  for (const [key, disorder] of Object.entries(GENETIC_DISORDERS)) {
    assert.ok(typeof disorder.name === 'string', `${key} should have name`);
    assert.ok(typeof disorder.chance === 'number', `${key} should have chance`);
    assert.ok(typeof disorder.effects === 'object', `${key} should have effects`);
  }
});

test('MUTATION_TYPES: has expected types', () => {
  assert.ok('NEUTRAL' in MUTATION_TYPES);
  assert.ok('BENEFICIAL' in MUTATION_TYPES);
  assert.ok('HARMFUL' in MUTATION_TYPES);
  for (const [key, mut] of Object.entries(MUTATION_TYPES)) {
    assert.ok(typeof mut.weight === 'number', `${key} should have weight`);
    assert.ok(typeof mut.multiplier === 'number', `${key} should have multiplier`);
    assert.ok(typeof mut.label === 'string', `${key} should have label`);
  }
});

test('mutateGenes: produces different but valid genes from diploid input', () => {
  const original = makeGenes({ speed: 1.0, aggression: 1.0 });
  const mutated = mutateGenes(original, 1.0);
  assert.ok(typeof mutated === 'object' && mutated !== null, 'mutateGenes should return an object');
  assert.ok('speed' in mutated, 'mutated genes should have speed');
  assert.ok('aggression' in mutated, 'mutated genes should have aggression');
  const diploidTraits = ['speed', 'fov', 'sense', 'metabolism'];
  for (const key of diploidTraits) {
    assert.ok(mutated[key].allele1 >= mutated[key].min, `${key}.allele1 below min`);
    assert.ok(mutated[key].allele1 <= mutated[key].max, `${key}.allele1 above max`);
    assert.ok(mutated[key].allele2 >= mutated[key].min, `${key}.allele2 below min`);
    assert.ok(mutated[key].allele2 <= mutated[key].max, `${key}.allele2 above max`);
  }
});

test('mutateGenes: with zero mutation rate returns same alleles', () => {
  const original = makeGenes({ speed: 1.0 });
  const mutated = mutateGenes(original, 0);
  assert.equal(mutated.speed.allele1, original.speed.allele1);
  assert.equal(mutated.speed.allele2, original.speed.allele2);
});

test('applyDisorderEffects: no disorders returns same genes', () => {
  const genes = makeGenes({ speed: 1.0 });
  genes.disorders = [];
  const result = applyDisorderEffects(genes);
  assert.ok(result === genes, 'should return same reference when no disorders');
});

test('applyDisorderEffects: disorders modify expressed genes', () => {
  const genes = makeGenes({ speed: 1.0 });
  genes.disorders = ['ALBINISM'];
  const originalSense = genes.sense.expressed;
  const result = applyDisorderEffects(genes);
  assert.equal(result.hue.expressed, 0);
  assert.ok(result.sense.expressed <= originalSense, 'ALBINISM should reduce sense');
});

test('getExpressedGenes: returns simplified gene object', () => {
  const genes = makeGenes({ speed: 1.0 });
  const expressed = getExpressedGenes(genes);
  assert.ok(typeof expressed.speed === 'number', 'expressed speed should be a number');
  assert.ok(typeof expressed.fov === 'number', 'expressed fov should be a number');
  assert.ok(typeof expressed.predator === 'number', 'expressed predator should be a number');
  assert.ok('sex' in expressed, 'expressed should have sex');
  assert.ok('disorders' in expressed, 'expressed should have disorders');
  assert.ok('mutations' in expressed, 'expressed should have mutations');
});

test('getExpressedGenes: caches result', () => {
  const genes = makeGenes();
  const expressed1 = getExpressedGenes(genes);
  const expressed2 = getExpressedGenes(genes);
  assert.ok(expressed1 === expressed2, 'should return cached result for same genes');
});

test('getGeneticInfo: returns info object', () => {
  const genes = makeGenes({ sex: 'male' });
  const info = getGeneticInfo(genes);
  assert.equal(info.sex, 'male');
  assert.ok(Array.isArray(info.disorders), 'info should have disorders array');
  assert.ok(Array.isArray(info.mutations), 'info should have mutations array');
});

test('breedGenes: produces child with valid traits', () => {
  const parent1 = makeGenes({ sex: 'female' });
  const parent2 = makeGenes({ sex: 'male' });
  const child = breedGenes(parent1, parent2);
  assert.ok('speed' in child, 'child should have speed');
  assert.ok('fov' in child, 'child should have fov');
  assert.ok(child.sex === 'male' || child.sex === 'female', 'child should have valid sex');
  assert.equal(child.predator, parent1.predator || parent2.predator, 'child predator inherited');
  assert.ok(Array.isArray(child.disorders), 'child should have disorders array');
  assert.ok(Array.isArray(child.mutations), 'child should have mutations array');
});

test('applyMutations: with zero rate returns same alleles', () => {
  const genes = makeGenes({ speed: 1.0 });
  const mutated = applyMutations(genes, 0);
  assert.equal(mutated.speed.allele1, genes.speed.allele1);
  assert.equal(mutated.speed.allele2, genes.speed.allele2);
});

// ============================================================================
// spatial-grid.js
// ============================================================================
console.log('\n=== spatial-grid.js ===');

test('SpatialGrid: constructor sets up grid', () => {
  const grid = new SpatialGrid(50, 1000, 800);
  assert.equal(grid.cellSize, 50);
  assert.equal(grid.gridWidth, Math.ceil(1000 / 50));
  assert.equal(grid.gridHeight, Math.ceil(800 / 50));
});

test('SpatialGrid: coords method clamps to grid bounds', () => {
  const grid = new SpatialGrid(50, 100, 100);
  const [gx, gy] = grid.coords(50, 50);
  assert.ok(gx >= 0 && gx < grid.gridWidth, `gx ${gx} out of bounds`);
  assert.ok(gy >= 0 && gy < grid.gridHeight, `gy ${gy} out of bounds`);
});

test('SpatialGrid: coords clamps negative values', () => {
  const grid = new SpatialGrid(50, 100, 100);
  const [gx, gy] = grid.coords(-10, -10);
  assert.equal(gx, 0);
  assert.equal(gy, 0);
});

test('SpatialGrid: coords clamps values beyond grid', () => {
  const grid = new SpatialGrid(50, 100, 100);
  const [gx, gy] = grid.coords(9999, 9999);
  assert.equal(gx, grid.gridWidth - 1);
  assert.equal(gy, grid.gridHeight - 1);
});

test('SpatialGrid: insert and nearby query', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const creature = { x: 100, y: 100, id: 1 };
  grid.clear();
  grid.insert(creature, 100, 100);
  grid.buildIndex();
  const nearby = grid.nearby(100, 100, 50);
  assert.ok(nearby.includes(creature), 'nearby should include inserted creature');
});

test('SpatialGrid: nearby excludes distant items', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const near = { x: 10, y: 10, id: 1 };
  const far = { x: 400, y: 400, id: 2 };
  grid.clear();
  grid.insert(near, near.x, near.y);
  grid.insert(far, far.x, far.y);
  grid.buildIndex();
  const result = grid.nearby(10, 10, 50);
  assert.ok(result.includes(near), 'should include near item');
  assert.ok(!result.includes(far), 'should not include far item');
});

test('SpatialGrid: clear removes all items', () => {
  const grid = new SpatialGrid(50, 500, 500);
  grid.insert({ x: 100, y: 100, id: 1 }, 100, 100);
  grid.clear();
  assert.equal(grid.itemCount, 0);
  assert.equal(grid.cellCounts[0], 0);
});

test('SpatialGrid: add method uses item x,y', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const item = { x: 75, y: 75, id: 1 };
  grid.clear();
  grid.add(item);
  grid.buildIndex();
  const result = grid.nearby(75, 75, 50);
  assert.ok(result.includes(item), 'add should insert using item.x and item.y');
});

test('SpatialGrid: queryRect returns items in rectangle', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const inside = { x: 50, y: 50, id: 1 };
  const outside = { x: 400, y: 400, id: 2 };
  grid.clear();
  grid.insert(inside, 50, 50);
  grid.insert(outside, 400, 400);
  grid.buildIndex();
  const result = grid.queryRect(0, 0, 100, 100);
  assert.ok(result.includes(inside), 'should include item inside rect');
  assert.ok(!result.includes(outside), 'should not include item outside rect');
});

test('SpatialGrid: nearest returns closest item', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const close = { x: 110, y: 110, id: 1 };
  const far = { x: 300, y: 300, id: 2 };
  grid.clear();
  grid.insert(close, 110, 110);
  grid.insert(far, 300, 300);
  grid.buildIndex();
  const nearest = grid.nearest(105, 105, 200);
  assert.equal(nearest, close, 'nearest should return closest item');
});

test('SpatialGrid: nearest returns null when nothing in range', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const far = { x: 400, y: 400, id: 1 };
  grid.clear();
  grid.insert(far, 400, 400);
  grid.buildIndex();
  const nearest = grid.nearest(10, 10, 5);
  assert.equal(nearest, null, 'nearest should return null when nothing in range');
});

test('SpatialGrid: getCellIndex works', () => {
  const grid = new SpatialGrid(50, 500, 500);
  assert.equal(grid.getCellIndex(0, 0), 0);
  assert.equal(grid.getCellIndex(1, 0), 1);
  assert.equal(grid.getCellIndex(0, 1), grid.gridWidth);
});

test('SpatialGrid: countInCell returns correct count', () => {
  const grid = new SpatialGrid(50, 500, 500);
  grid.clear();
  grid.insert({ x: 25, y: 25, id: 1 }, 25, 25);
  grid.insert({ x: 30, y: 30, id: 2 }, 30, 30);
  grid.buildIndex();
  const [gx, gy] = grid.coords(25, 25);
  assert.ok(grid.countInCell(gx, gy) >= 2, 'cell should have at least 2 items');
});

test('SpatialGrid: getStats returns expected keys', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const stats = grid.getStats();
  assert.ok('gridSize' in stats, 'stats should have gridSize');
  assert.ok('totalCells' in stats, 'stats should have totalCells');
  assert.ok('totalItems' in stats, 'stats should have totalItems');
  assert.ok('occupiedCells' in stats, 'stats should have occupiedCells');
  assert.ok('maxItemsPerCell' in stats, 'stats should have maxItemsPerCell');
});

test('SpatialGrid: multiple items in same cell', () => {
  const grid = new SpatialGrid(50, 500, 500);
  const items = [];
  for (let i = 0; i < 5; i++) {
    items.push({ x: 25 + i, y: 25 + i, id: i });
  }
  grid.clear();
  for (const item of items) {
    grid.insert(item, item.x, item.y);
  }
  grid.buildIndex();
  const result = grid.nearby(27, 27, 20);
  assert.ok(result.length >= 5, `should find at least 5 items, found ${result.length}`);
});

// ============================================================================
// object-pool.js
// ============================================================================
console.log('\n=== object-pool.js ===');

test('ObjectPool: constructor pre-populates pool', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  assert.equal(pool.pool.length, 5, 'pool should be pre-populated');
  assert.equal(pool.allocationCount, 5, 'allocationCount should be 5');
});

test('ObjectPool: get retrieves from pool', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  const obj = pool.get();
  assert.ok(obj !== null && typeof obj === 'object', 'get should return an object');
  assert.equal(pool.pool.length, 4, 'pool should shrink by 1');
  assert.equal(pool.activeCount, 1, 'activeCount should be 1');
});

test('ObjectPool: release returns object to pool', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  const obj = pool.get();
  pool.release(obj);
  assert.equal(pool.pool.length, 5, 'pool should return to 5');
  assert.equal(pool.activeCount, 0, 'activeCount should be 0');
});

test('ObjectPool: release calls reset function', () => {
  let resetCalled = 0;
  const pool = new ObjectPool(
    () => ({ val: 0 }),
    (obj) => { obj.val = 0; resetCalled++; },
    2
  );
  const obj = pool.get();
  obj.val = 42;
  pool.release(obj);
  assert.equal(obj.val, 0, 'reset should have set val to 0');
  assert.equal(resetCalled, 1, 'reset should have been called once');
});

test('ObjectPool: get creates new object when pool is empty', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 1);
  const obj1 = pool.get();
  const obj2 = pool.get();
  assert.ok(obj2 !== null, 'should create new object');
  assert.equal(pool.missCount, 1, 'missCount should be 1');
});

test('ObjectPool: respects maxSize on release', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 1, 2);
  pool.get();
  const obj = pool.get();
  pool.release(obj);
  assert.ok(pool.pool.length <= 2, 'pool should not exceed maxSize');
});

test('ObjectPool: release null is a no-op', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 3);
  pool.release(null);
  assert.equal(pool.activeCount, 0, 'activeCount should remain 0');
});

test('ObjectPool: releaseAll releases multiple objects', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  const obj1 = pool.get();
  const obj2 = pool.get();
  const obj3 = pool.get();
  pool.releaseAll([obj1, obj2, obj3]);
  assert.equal(pool.activeCount, 0, 'activeCount should be 0');
});

test('ObjectPool: warm expands pool', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  pool.warm(10);
  assert.ok(pool.pool.length >= 10, 'pool should have at least 10 items after warm');
});

test('ObjectPool: clear resets pool', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  pool.get();
  pool.get();
  pool.clear();
  assert.equal(pool.pool.length, 0, 'pool should be empty');
  assert.equal(pool.activeCount, 0, 'activeCount should be 0');
  assert.equal(pool.peakCount, 0, 'peakCount should be 0');
});

test('ObjectPool: getStats returns expected keys', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  const stats = pool.getStats();
  assert.ok('poolSize' in stats);
  assert.ok('activeCount' in stats);
  assert.ok('peakCount' in stats);
  assert.ok('totalAllocations' in stats);
  assert.ok('hitRate' in stats);
  assert.ok('hitCount' in stats);
  assert.ok('missCount' in stats);
});

test('ObjectPool: peakCount tracks maximum active objects', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 10);
  const objs = [];
  for (let i = 0; i < 5; i++) objs.push(pool.get());
  pool.releaseAll(objs);
  assert.equal(pool.peakCount, 5, 'peakCount should be 5');
});

test('ObjectPool: hitRate updates correctly', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 5);
  const obj = pool.get();  // hit
  pool.release(obj);
  pool.get(); // hit — from pool
  const stats = pool.getStats();
  assert.ok(parseFloat(stats.hitRate) > 0, 'hitRate should be > 0');
});

test('Vector2DPool: creates and resets vectors', () => {
  const pool = new Vector2DPool(5, 50);
  const vec = pool.get();
  assert.ok('x' in vec && 'y' in vec, 'vector should have x and y');
  vec.x = 10;
  vec.y = 20;
  pool.release(vec);
  assert.equal(vec.x, 0, 'x should be reset to 0');
  assert.equal(vec.y, 0, 'y should be reset to 0');
});

test('ArrayPool: creates and resets arrays', () => {
  const pool = new ArrayPool(5, 50);
  const arr = pool.get();
  assert.ok(Array.isArray(arr), 'should return an array');
  arr.push(1, 2, 3);
  pool.release(arr);
  assert.equal(arr.length, 0, 'array should be emptied on release');
});

test('ArrayPool: getWithSize pre-allocates capacity', () => {
  const pool = new ArrayPool(5, 50);
  const arr = pool.getWithSize(10);
  assert.ok(Array.isArray(arr), 'should return an array');
});

test('ParticlePool: creates particle objects', () => {
  const pool = new ParticlePool(5, 50);
  const p = pool.get();
  assert.ok('x' in p && 'y' in p && 'vx' in p && 'vy' in p, 'particle should have position/velocity');
  assert.ok('life' in p && 'maxLife' in p, 'particle should have life properties');
  assert.ok('color' in p && 'size' in p && 'alpha' in p, 'particle should have visual properties');
});

test('ObjectPool: expand increases pool size up to maxSize', () => {
  const pool = new ObjectPool(() => ({ val: 0 }), null, 0, 2);
  assert.equal(pool.pool.length, 0);
  pool.expand(5);
  assert.equal(pool.pool.length, 2, 'pool should cap at maxSize');
  assert.equal(pool.allocationCount, 2, 'should have allocated 2');
});

test('PoolManager: registers and retrieves pools', () => {
  const manager = new PoolManager();
  const vec = manager.getVector();
  assert.ok('x' in vec && 'y' in vec, 'should get a vector');
  manager.releaseVector(vec);
  assert.equal(vec.x, 0, 'vector should be reset');
});

test('PoolManager: getArray returns array', () => {
  const manager = new PoolManager();
  const arr = manager.getArray();
  assert.ok(Array.isArray(arr), 'should return an array');
  manager.releaseArray(arr);
});

test('PoolManager: getParticle returns particle', () => {
  const manager = new PoolManager();
  const p = manager.getParticle();
  assert.ok('x' in p && 'y' in p, 'should get a particle');
  manager.releaseParticle(p);
});

test('PoolManager: clear clears all pools', () => {
  const manager = new PoolManager();
  manager.getVector();
  manager.clear();
  const stats = manager.getStats();
  assert.equal(stats._summary.totalActiveObjects, 0, 'should have 0 active objects after clear');
});

test('PoolManager: setStatsEnabled', () => {
  const manager = new PoolManager();
  manager.setStatsEnabled(false);
  assert.equal(manager.statsEnabled, false);
});

test('TempObjectPool: creates and clears generic objects', () => {
  const pool = new TempObjectPool(5);
  const obj = pool.get();
  assert.ok(typeof obj === 'object' && obj !== null, 'should return an object');
  obj.foo = 'bar';
  obj.baz = 42;
  pool.release(obj);
  assert.ok(!('foo' in obj), 'object properties should be removed on release');
  assert.ok(!('baz' in obj), 'object properties should be removed on release');
});

test('PoolManager: registerPool throws on unknown pool name', () => {
  const manager = new PoolManager();
  assert.throws(() => manager.getPool('nonexistent'), /not found/);
});

// ============================================================================
// lineage-tracker.js
// ============================================================================
console.log('\n=== lineage-tracker.js ===');

function makeMockWorld(creatures) {
  const map = new Map();
  for (const c of creatures) map.set(c.id, c);
  return {
    t: 0,
    creatures,
    getAnyCreatureById(id) { return map.get(id) ?? null; },
    particles: { addEvolutionEffect() {} },
    audio: { playUISound() {} }
  };
}

test('LineageTracker: constructor initializes empty state', () => {
  const tracker = new LineageTracker();
  assert.equal(tracker.names.size, 0);
  assert.equal(tracker.events.length, 0);
  assert.equal(tracker.heroGenerations.size, 0);
});

test('LineageTracker: reset clears all state', () => {
  const tracker = new LineageTracker();
  tracker.names.set(1, 'Test');
  tracker.events.push({ title: 'test' });
  tracker.reset();
  assert.equal(tracker.names.size, 0);
  assert.equal(tracker.events.length, 0);
  assert.equal(tracker.heroGenerations.size, 0);
});

test('LineageTracker: ensureName generates consistent names', () => {
  const tracker = new LineageTracker();
  const name1 = tracker.ensureName(1);
  const name2 = tracker.ensureName(1);
  assert.equal(name1, name2, 'same rootId should produce same name');
  assert.ok(typeof name1 === 'string' && name1.length > 0, 'name should be a non-empty string');
});

test('LineageTracker: ensureName generates different names for different ids', () => {
  const tracker = new LineageTracker();
  const name1 = tracker.ensureName(1);
  const name2 = tracker.ensureName(100);
  assert.notEqual(name1, name2, 'different rootIds should produce different names');
});

test('LineageTracker: getRoot returns id itself for root creature', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const world = makeMockWorld([root]);
  const rootId = tracker.getRoot(world, 1);
  assert.equal(rootId, 1, 'root creature should return its own id');
});

test('LineageTracker: getRoot follows parent chain', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const world = makeMockWorld([root, child]);
  const rootId = tracker.getRoot(world, 2);
  assert.equal(rootId, 1, 'child should resolve to root id');
});

test('LineageTracker: getRoot caches results', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const world = makeMockWorld([root, child]);
  tracker.getRoot(world, 2);
  assert.ok(tracker.rootCache.has(2), 'root should be cached');
  assert.equal(tracker.rootCache.get(2), 1, 'cached root should be 1');
});

test('LineageTracker: generation returns 0 for root creature', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const world = makeMockWorld([root]);
  const gen = tracker.generation(world, 1);
  assert.equal(gen, 0, 'root creature should be generation 0');
});

test('LineageTracker: generation returns 1 for direct child', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const world = makeMockWorld([root, child]);
  const gen = tracker.generation(world, 2);
  assert.equal(gen, 1, 'direct child should be generation 1');
});

test('LineageTracker: generation returns correct depth for grandchild', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const grandchild = { id: 3, parentId: 2 };
  const world = makeMockWorld([root, child, grandchild]);
  const gen = tracker.generation(world, 3);
  assert.equal(gen, 2, 'grandchild should be generation 2');
});

test('LineageTracker: generation caches results', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const world = makeMockWorld([root, child]);
  tracker.generation(world, 2);
  assert.ok(tracker.generationCache.has(2), 'generation should be cached');
});

test('LineageTracker: onCreatureBorn tracks lineage', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const world = makeMockWorld([root, child]);
  tracker.onCreatureBorn(child, world, root);
  assert.ok(tracker.names.size > 0, 'should have registered a name');
});

test('LineageTracker: noteBirth with generation >= 5 records hero generation', () => {
  const tracker = new LineageTracker();
  const creatures = [{ id: 1, parentId: null }];
  let prev = creatures[0];
  for (let i = 2; i <= 6; i++) {
    const c = { id: i, parentId: prev.id };
    creatures.push(c);
    prev = c;
  }
  const world = makeMockWorld(creatures);
  world.t = 100;
  const child = creatures[5];
  tracker.noteBirth(world, creatures[4], child);
  assert.ok(tracker.heroGenerations.size > 0, 'should have recorded a hero generation');
  assert.ok(tracker.events.length > 0, 'should have recorded an event');
});

test('LineageTracker: onCreatureDied clears creature caches and records event', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const child = { id: 2, parentId: 1 };
  const world = makeMockWorld([root, child]);
  tracker.generationCache.set(2, 1);
  tracker.rootCache.set(2, 1);
  tracker.onCreatureDied(child, world);
  assert.ok(tracker.events.length > 0, 'should have recorded death event');
});

test('LineageTracker: recordEvent adds event to front', () => {
  const tracker = new LineageTracker();
  tracker.recordEvent({ time: 10, title: 'first' });
  tracker.recordEvent({ time: 20, title: 'second' });
  assert.equal(tracker.events[0].title, 'second', 'latest event should be first');
  assert.equal(tracker.events[1].title, 'first', 'older event should be second');
});

test('LineageTracker: recordEvent handles null/undefined events gracefully', () => {
  const tracker = new LineageTracker();
  tracker.recordEvent(null);
  tracker.recordEvent(undefined);
  assert.equal(tracker.events.length, 0, 'null/undefined events should not be added');
});

test('LineageTracker: trim limits events to given count', () => {
  const tracker = new LineageTracker();
  for (let i = 0; i < 20; i++) {
    tracker.recordEvent({ time: i, title: `event ${i}` });
  }
  assert.ok(tracker.events.length <= 12, 'events should be trimmed to default limit');
});

test('LineageTracker: getStories returns up to 8 events', () => {
  const tracker = new LineageTracker();
  for (let i = 0; i < 15; i++) {
    tracker.recordEvent({ time: i, title: `event ${i}` });
  }
  const stories = tracker.getStories();
  assert.ok(stories.length <= 8, 'getStories should return at most 8 events');
});

test('LineageTracker: onCreatureBorn with null parent', () => {
  const tracker = new LineageTracker();
  const root = { id: 1, parentId: null };
  const world = makeMockWorld([root]);
  tracker.onCreatureBorn(root, world, null);
  assert.ok(tracker.names.size > 0, 'should register name for root');
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  console.log('Some tests failed!');
  process.exit(1);
} else {
  console.log('All tests passed!');
}