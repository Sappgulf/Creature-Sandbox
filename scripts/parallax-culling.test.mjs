import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as parallax from '../creature-sim/src/renderer-parallax.js';

function context(matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) {
  return {
    canvas: { width: 100, height: 80 },
    getTransform: () => matrix,
    filter: 'none',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0
  };
}

test('parallax skips invisible static stars and orbs without skipping particle updates', () => {
  const ctx = context({ a: 1, b: 0, c: 0, d: 1, e: -999950, f: -999960 });
  let starStyles = 0,
    gradients = 0;
  Object.defineProperty(ctx, 'fillStyle', {
    set(value) {
      if (typeof value === 'string' && value.startsWith('rgba(200, 220, 255')) starStyles++;
    }
  });
  for (const name of ['save', 'restore', 'translate', 'scale', 'beginPath', 'arc', 'fill']) ctx[name] = () => {};
  ctx.createRadialGradient = () => {
    gradients++;
    return { addColorStop() {} };
  };
  const renderer = {
    camera: { x: 1e6, y: 1e6, zoom: 1 },
    isMobile: false,
    _viewBounds: { x1: 999850, x2: 1000150, y1: 999860, y2: 1000140 }
  };
  parallax.drawParallaxBackground(renderer, ctx, { width: 4000, height: 2800 });
  assert.equal(starStyles, 0);
  assert.equal(gradients, 0);
  assert.equal(renderer._ambientParticles.length, 280);
  assert.ok(
    renderer._ambientParticles.every(p => p.x >= renderer._viewBounds.x1 - 50 && p.x <= renderer._viewBounds.x2 + 50)
  );
});

test('viewport bounds invert actual backing transform including shake, scale and rotation', () => {
  assert.deepEqual(parallax.getCanvasWorldBounds(context({ a: 2, b: 0, c: 0, d: 2, e: -30, f: 10 })), {
    x1: 15,
    x2: 65,
    y1: -5,
    y2: 35
  });
  assert.deepEqual(parallax.getCanvasWorldBounds(context({ a: 0, b: 2, c: -2, d: 0, e: 100, f: 0 })), {
    x1: 0,
    x2: 40,
    y1: 0,
    y2: 50
  });
});

test('invalid transforms and effects conservatively disable visibility culling', () => {
  for (const mutate of [
    ctx => {
      ctx.getTransform = () => ({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 });
    },
    ctx => {
      ctx.canvas.width = Infinity;
    },
    ctx => {
      ctx.shadowBlur = 2;
    },
    ctx => {
      ctx.shadowOffsetX = 3;
    },
    ctx => {
      ctx.filter = 'blur(3px)';
    },
    ctx => {
      delete ctx.getTransform;
    }
  ]) {
    const ctx = context();
    mutate(ctx);
    assert.equal(parallax.getCanvasWorldBounds(ctx), null);
  }
});
