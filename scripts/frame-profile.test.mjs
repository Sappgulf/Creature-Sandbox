import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDrawImageProbe, summarizeFrameCpu } from '../creature-sim/src/frame-profile.js';

test('CPU subtraction includes only image work inside the profiled game loop', () => {
  let time = 0;
  let inLoop = true;
  class Context {
    drawImage() {
      time += 2;
    }
  }
  const ctx = new Context();
  ctx.canvas = { id: 'view' };
  const original = Context.prototype.drawImage;
  const installed = installDrawImageProbe({ prototype: Context.prototype, now: () => time, inGameLoop: () => inLoop });
  ctx.drawImage();
  inLoop = false;
  ctx.drawImage();
  ctx.drawImage();
  assert.equal(installed.probe.timeMs, 6);
  assert.equal(installed.probe.rootTimeMs, 2);
  const cpu = summarizeFrameCpu({ totalMs: 10, count: 2 }, installed.probe, 1);
  assert.equal(cpu.frames, 2);
  assert.equal(cpu.profiledNonDrawImagePerFrameMs, 4);
  assert.equal(cpu.unscopedDrawImageMs, 4);
  installed.restore();
  assert.equal(Context.prototype.drawImage, original);
});

test('native drawing errors remain visible and still contribute timing', () => {
  let time = 0;
  class Context {
    drawImage() {
      time += 3;
      throw new Error('native failure');
    }
  }
  const ctx = new Context();
  ctx.canvas = { id: 'view' };
  const installed = installDrawImageProbe({ prototype: Context.prototype, now: () => time, inGameLoop: () => true });
  assert.throws(() => ctx.drawImage(), /native failure/);
  assert.equal(installed.probe.rootTimeMs, 3);
  assert.equal(installed.probe.count, 1);
  installed.restore();
});

test('repeated drawing records every call without repeated Canvas DOM-label reads', () => {
  let time = 0;
  let labelReads = 0;
  class Context {
    drawImage() {
      time++;
    }
  }
  const ctx = new Context();
  ctx.canvas = {
    get id() {
      labelReads++;
      return 'view';
    }
  };
  const installed = installDrawImageProbe({ prototype: Context.prototype, now: () => time, inGameLoop: () => true });
  for (let i = 0; i < 1000; i++) ctx.drawImage();
  assert.equal(installed.probe.count, 1000);
  assert.equal(installed.probe.byCanvas.view.count, 1000);
  assert.equal(installed.probe.rootTimeMs, 1000);
  assert.ok(labelReads <= 2, `expected one Canvas-label resolution, got ${labelReads}`);
  installed.restore();
});

test('truncated or missing scope windows cannot report a healthy CPU measurement', () => {
  for (const root of [null, { totalMs: 10, count: 1 }]) {
    const cpu = summarizeFrameCpu(root, { timeMs: 2, rootTimeMs: 2 }, 2);
    assert.equal(cpu.profileComplete, false);
    assert.equal(Number.isFinite(cpu.profiledNonDrawImagePerFrameMs), false);
  }
});
