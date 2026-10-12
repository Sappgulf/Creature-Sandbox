import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeRuntimeReadiness, assertRuntimeReadiness } from './runtime-readiness.mjs';

function results(worker = true) {
  return ['desktop', 'mobile-compact', 'mobile-large'].map(scenario => ({
    scenario,
    perf: { runtime: { workerMode: worker, workerDiagnostics: { ready: true, queuedCommands: 0 } } },
    framePacing: { frames: 53, avgFrameMs: 16.67, p95FrameMs: 16.8, mainThread: { profiledNonDrawImagePerFrameMs: 1 } },
    scenarioResult: { complete: true, anchored: true, inViewport: true, historyCount: 1 },
    layoutGuard: { passed: true, metrics: { cumulativeLayoutShift: 0, minTouchTarget: 44 } }
  }));
}

test('a held worker run fails publication readiness despite completed functional flows', () => {
  const samples = results();
  samples[0].framePacing.avgFrameMs = 60;
  samples[0].framePacing.p95FrameMs = 83.3;
  const readiness = summarizeRuntimeReadiness(samples);
  assert.equal(readiness.completedScenarioResultFlow.passed, true);
  assert.equal(readiness.status, 'needs-more-proof');
  assert.throws(() => assertRuntimeReadiness(readiness), /readiness/i);
});

test('worker readiness honors each existing frame-budget boundary', () => {
  for (const [row, field, limit] of [
    [0, 'avgFrameMs', 26],
    [0, 'p95FrameMs', 40],
    [1, 'p95FrameMs', 20]
  ]) {
    const samples = results();
    samples[row].framePacing[field] = limit;
    assert.doesNotThrow(() => assertRuntimeReadiness(summarizeRuntimeReadiness(samples)));
    samples[row].framePacing[field] = limit + 0.01;
    assert.throws(() => assertRuntimeReadiness(summarizeRuntimeReadiness(samples)), /readiness/i);
  }
  const samples = results();
  samples[0].framePacing.mainThread.profiledNonDrawImagePerFrameMs = 1.5;
  assert.doesNotThrow(() => assertRuntimeReadiness(summarizeRuntimeReadiness(samples)));
  samples[0].framePacing.mainThread.profiledNonDrawImagePerFrameMs = 1.5001;
  assert.throws(() => assertRuntimeReadiness(summarizeRuntimeReadiness(samples)), /readiness/i);
});

test('queues and incomplete or unmeasured contexts keep worker readiness held', () => {
  for (const mutate of [
    s => {
      s[1].perf.runtime.workerDiagnostics.queuedCommands = 1;
    },
    s => {
      s[1].scenarioResult.complete = false;
    },
    s => {
      s[1].layoutGuard.passed = false;
    },
    s => {
      s[1].framePacing.p95FrameMs = null;
    },
    s => {
      s[1].framePacing.p95FrameMs = NaN;
    },
    s => {
      s[1].framePacing.frames = 0;
    },
    s => {
      s[0].framePacing.mainThread.profiledNonDrawImagePerFrameMs = null;
    },
    s => {
      delete s[0].framePacing.mainThread;
    },
    s => {
      s[0].framePacing.mainThread.profiledNonDrawImagePerFrameMs = -1;
    },
    s => {
      s.pop();
    }
  ]) {
    const samples = results();
    mutate(samples);
    assert.throws(() => assertRuntimeReadiness(summarizeRuntimeReadiness(samples)), /readiness/i);
  }
});

test('default and forced worker lanes retain their readiness identities', () => {
  assert.equal(summarizeRuntimeReadiness(results()).status, 'shipping-default');
  assert.equal(summarizeRuntimeReadiness(results(), { forcedRuntimeMode: 'worker' }).status, 'candidate-opt-in');
});

test('main fallback requires completed result and layout proof', () => {
  const samples = results(false);
  const options = { forcedRuntimeMode: 'main' };
  const readiness = summarizeRuntimeReadiness(samples, options);
  assert.equal(readiness.status, 'fallback-proof');
  assert.doesNotThrow(() => assertRuntimeReadiness(readiness));
  samples[2].scenarioResult.complete = false;
  assert.throws(() => assertRuntimeReadiness(summarizeRuntimeReadiness(samples, options)), /readiness/i);
});
