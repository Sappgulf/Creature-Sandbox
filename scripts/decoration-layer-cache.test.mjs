import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DecorationLayerCache, getTerrainLayerKey } from '../creature-sim/src/decoration-layer-cache.js';

function snapshot() {
  return {
    source: [{ x: 2, y: 3 }],
    revision: 0,
    season: 'spring',
    phase: 0.25,
    width: 1280,
    height: 800,
    matrix: [1, 0, 0, 1, -20, -30],
    smoothing: true,
    quality: 'low'
  };
}

test('terrain cache uses the original twenty seasonal buckets and seed identity', () => {
  const world = { width: 4000, height: 2800, worldSeed: 'seed' };
  assert.equal(getTerrainLayerKey(world, 'spring', 0.024), '4000|2800|spring|0|seed');
  assert.equal(getTerrainLayerKey(world, 'spring', 0.026), '4000|2800|spring|1|seed');
  assert.equal(getTerrainLayerKey(world, 'spring', 0.074), '4000|2800|spring|1|seed');
  assert.equal(getTerrainLayerKey(world, 'spring', 0.076), '4000|2800|spring|2|seed');
  const cache = new DecorationLayerCache();
  const state = { ...snapshot(), phase: 0 };
  let paints = 0;
  const build = () => {
    paints++;
    return {};
  };
  state.revision = getTerrainLayerKey(world, 'spring', 0.026);
  cache.getOrBuild(state, build);
  state.revision = getTerrainLayerKey(world, 'spring', 0.074);
  cache.getOrBuild(state, build);
  assert.equal(paints, 1);
  state.revision = getTerrainLayerKey(world, 'spring', 0.076);
  cache.getOrBuild(state, build);
  assert.equal(paints, 2);
  world.worldSeed = 'next';
  assert.notEqual(getTerrainLayerKey(world, 'spring', 0.076), state.revision);
});

test('stationary scenery reuses a single surface while the palette is unchanged', () => {
  const cache = new DecorationLayerCache();
  const state = snapshot();
  let paints = 0;
  const build = () => {
    paints++;
    return { id: 'surface' };
  };
  const first = cache.getOrBuild(state, build);
  state.phase += 0.0001;
  assert.equal(cache.getOrBuild(state, build), first);
  assert.equal(paints, 1);
});

test('camera, viewport, source, palette and asset changes repaint the cached layer', () => {
  for (const mutate of [
    s => {
      s.matrix[4]++;
    },
    s => {
      s.matrix[0] = 2;
    },
    s => {
      s.width++;
    },
    s => {
      s.source = s.source.slice();
    },
    s => {
      s.source.push({ x: 4, y: 5 });
    },
    s => {
      s.phase += 0.01;
    },
    s => {
      s.season = 'winter';
    },
    s => {
      s.revision++;
    },
    s => {
      s.smoothing = false;
    },
    s => {
      s.quality = 'high';
    }
  ]) {
    const cache = new DecorationLayerCache();
    const state = snapshot();
    let paints = 0;
    const surface = {};
    const build = prior => {
      if (paints) assert.equal(prior, surface);
      paints++;
      return surface;
    };
    cache.getOrBuild(state, build);
    mutate(state);
    cache.getOrBuild(state, build);
    assert.equal(paints, 2);
  }
});

test('palette sampling has a bounded fade error and keeps season endpoints', () => {
  const cache = new DecorationLayerCache();
  const state = snapshot();
  for (const phase of [0, 0.001, 0.499, 0.5, 0.999, 1]) {
    state.phase = phase;
    cache.getOrBuild(state, (_prior, palette) => {
      assert.equal(palette.currentSeason, state.season);
      assert.ok(Math.abs(palette.seasonPhase - phase) <= 1 / 1024);
      if (phase === 0 || phase === 1) assert.equal(palette.seasonPhase, phase);
      return {};
    });
  }
});

test('unavailable surfaces retry and invalid dimensions do not allocate', () => {
  const cache = new DecorationLayerCache();
  const state = snapshot();
  let paints = 0;
  assert.equal(
    cache.getOrBuild(state, () => {
      paints++;
      return null;
    }),
    null
  );
  assert.ok(
    cache.getOrBuild(state, () => {
      paints++;
      return {};
    })
  );
  assert.equal(paints, 2);
  state.width = Infinity;
  assert.equal(
    cache.getOrBuild(state, () => {
      throw new Error('must not allocate');
    }),
    null
  );
});

test('subpixel camera easing reuses padded scenery with the exact pan offset', () => {
  const cache = new DecorationLayerCache();
  const state = { ...snapshot(), panMargin: 2 };
  let paints = 0;
  const build = () => {
    paints++;
    return {};
  };
  cache.getOrBuild(state, build);
  state.matrix[4] += 0.375;
  state.matrix[5] -= 1.25;
  cache.getOrBuild(state, build);
  assert.equal(paints, 1);
  assert.deepEqual(cache.offset, { x: -1.625, y: -3.25 });
  state.matrix[4] += 2;
  cache.getOrBuild(state, build);
  assert.equal(paints, 2);
  assert.deepEqual(cache.offset, { x: -2, y: -2 });
  state.matrix[0] += 0.001;
  cache.getOrBuild(state, build);
  assert.equal(paints, 3);
});
