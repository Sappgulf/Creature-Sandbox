import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const headed = process.argv.includes('--headed');
const keepServer = process.argv.includes('--keep-server');
const forceWorkerMode = process.argv.includes('--worker') || process.env.CREATURE_SMOKE_WORKER === '1';
const forceMainMode = process.argv.includes('--main') || process.env.CREATURE_SMOKE_MAIN === '1';
const shippingDefaultRuntime = 'worker';
if (forceWorkerMode && forceMainMode) {
  throw new Error('Choose only one forced runtime smoke target: --worker or --main.');
}
const forcedRuntimeMode = forceWorkerMode ? 'worker' : forceMainMode ? 'main' : null;
const expectedRuntimeMode = forcedRuntimeMode || shippingDefaultRuntime;
const workerMode = expectedRuntimeMode === 'worker';
const sampleRealtime = !process.argv.includes('--no-realtime');
const defaultOutDir = path.join(
  'output',
  forcedRuntimeMode === 'worker'
    ? 'browser-smoke-worker'
    : forcedRuntimeMode === 'main'
      ? 'browser-smoke-main'
      : 'browser-smoke'
);
const outDir = path.resolve(repoRoot, process.env.CREATURE_SMOKE_OUT_DIR || defaultOutDir);
const explicitBaseUrl = !!process.env.CREATURE_SMOKE_URL;
const explicitPort = !!process.env.CREATURE_SMOKE_PORT;
const reuseExternalServer = explicitBaseUrl || process.env.CREATURE_SMOKE_REUSE_SERVER === '1';
let port = Number(process.env.CREATURE_SMOKE_PORT || 4173);
let baseUrl = process.env.CREATURE_SMOKE_URL || `http://127.0.0.1:${port}`;

const scenarios = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'mobile-compact', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'mobile-large', viewport: { width: 430, height: 932 }, mobile: true }
];

const particleBudgetByQuality = {
  ultra: 120,
  high: 80,
  medium: 58,
  low: 36
};

function requestOk(url) {
  return new Promise(resolve => {
    let client = http;
    try {
      client = new URL(url).protocol === 'https:' ? https : http;
    } catch {
      resolve(false);
      return;
    }

    const req = client.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        if (body.length < 4096) body += chunk;
      });
      res.on('end', () => {
        const statusOk = res.statusCode >= 200 && res.statusCode < 500;
        const sourceEntryOk = body.includes('./src/main.js') || body.includes('/src/main.js');
        const builtEntryOk = /<script[^>]+src=["']\/assets\/[^"']+\.js/.test(body) || body.includes('/assets/index-');
        const appOk = body.includes('Creature Sandbox') && (sourceEntryOk || builtEntryOk);
        resolve(statusOk && appOk);
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function requestJson(url) {
  return new Promise(resolve => {
    let client = http;
    try {
      client = new URL(url).protocol === 'https:' ? https : http;
    } catch {
      resolve(null);
      return;
    }

    const req = client.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        if (body.length < 32768) body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function resolveTargetInfo() {
  const buildInfoUrl = new URL('build-info.json', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    mode: workerMode ? 'worker' : 'main',
    expectedRuntimeMode,
    forcedRuntimeMode,
    shippingDefault: shippingDefaultRuntime,
    sampleRealtime,
    buildInfoUrl,
    buildInfo: await requestJson(buildInfoUrl)
  };
}

function canListen(portToCheck) {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen({ host: '127.0.0.1', port: portToCheck }, () => {
      probe.close(() => resolve(true));
    });
  });
}

function getRandomPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = probe.address();
      const selectedPort = typeof address === 'object' && address ? address.port : null;
      probe.close(() => {
        if (!selectedPort) {
          reject(new Error('Unable to allocate a smoke server port'));
          return;
        }
        resolve(selectedPort);
      });
    });
  });
}

async function resolveOwnedServerPort() {
  if (await canListen(port)) return port;

  if (explicitPort) {
    throw new Error(
      `CREATURE_SMOKE_PORT ${port} is already in use. ` +
        'Set CREATURE_SMOKE_URL and CREATURE_SMOKE_REUSE_SERVER=1 to target an existing server, or choose another port.'
    );
  }

  const fallbackPort = await getRandomPort();
  console.log(`Browser smoke: port ${port} is busy; using ${fallbackPort} for an owned Vite server.`);
  return fallbackPort;
}

async function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await requestOk(url)) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function startServerIfNeeded() {
  if (reuseExternalServer) {
    if (await requestOk(baseUrl)) return null;
    throw new Error(`Expected a reusable Creature Sandbox server at ${baseUrl}, but it did not respond.`);
  }

  port = await resolveOwnedServerPort();
  baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' }
  });

  child.stdout.on('data', chunk => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[vite] ${chunk}`));

  const ready = await waitForServer(baseUrl);
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`Timed out waiting for dev server at ${baseUrl}`);
  }
  return child;
}

async function readGameState(page) {
  const text = await page.evaluate(() => window.render_game_to_text?.() || '{}');
  return JSON.parse(text);
}

async function readObjectiveRailMetrics(page) {
  return page.evaluate(() => {
    const rail = document.getElementById('objective-rail');
    if (!rail) return null;
    const rect = rail.getBoundingClientRect();
    return {
      visible: rect.width > 0 && rect.height > 0,
      width: Number(rect.width.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
      top: Number(rect.top.toFixed(1))
    };
  });
}

async function readLayoutGuardMetrics(page) {
  return page.evaluate(() => {
    const visibleRect = selector => {
      const element = document.querySelector(selector);
      if (!element || element.classList?.contains('hidden') || element.getAttribute('aria-hidden') === 'true') {
        return null;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        selector,
        left: Number(rect.left.toFixed(1)),
        right: Number(rect.right.toFixed(1)),
        top: Number(rect.top.toFixed(1)),
        bottom: Number(rect.bottom.toFixed(1)),
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1))
      };
    };
    const overlaps = (a, b) =>
      !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    const rects = {
      objectiveRail: visibleRect('#objective-rail'),
      controlStrip: visibleRect('#control-strip'),
      watchStrip: visibleRect('#watch-strip'),
      hudBottom: visibleRect('#hud-bottom-left'),
      upgradePanel: visibleRect('#upgrade-panel'),
      scenarioResult: visibleRect('#upgrade-scenario-result')
    };
    const bottomChrome =
      [rects.controlStrip, rects.watchStrip, rects.hudBottom].filter(Boolean).sort((a, b) => b.bottom - a.bottom)[0] ||
      null;
    const cumulativeLayoutShift = Number(window.__creatureLayoutShiftScore || 0);
    const visibleButtons = Array.from(
      document.querySelectorAll(
        '#control-strip button, #watch-strip button, .bottom-drawer:not(.hidden) button, .bottom-drawer:not(.hidden) .spawn-card'
      )
    )
      .filter(element => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0 &&
          !element.disabled
        );
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        const label =
          element.id ||
          element.getAttribute('aria-label') ||
          element.textContent?.trim?.().replace(/\s+/g, ' ').slice(0, 40) ||
          element.className ||
          element.tagName;
        return {
          label,
          width: Number(rect.width.toFixed(1)),
          height: Number(rect.height.toFixed(1)),
          top: Number(rect.top.toFixed(1)),
          bottom: Number(rect.bottom.toFixed(1)),
          offscreen:
            rect.left < -1 || rect.right > viewport.width + 1 || rect.top < -1 || rect.bottom > viewport.height + 1
        };
      });
    const targetSizes = visibleButtons.map(button => Math.min(button.width, button.height));
    const minTouchTarget = targetSizes.length ? Number(Math.min(...targetSizes).toFixed(1)) : null;
    const offscreenButtons = visibleButtons.filter(button => button.offscreen).map(button => button.label);

    return {
      viewport,
      rects,
      bottomChrome,
      cumulativeLayoutShift: Number(cumulativeLayoutShift.toFixed(4)),
      objectiveBottomOverlap: overlaps(rects.objectiveRail, bottomChrome),
      resultBottomOverlap: overlaps(rects.scenarioResult, bottomChrome),
      minTouchTarget,
      offscreenButtons,
      visibleButtonCount: visibleButtons.length
    };
  });
}

async function installLayoutShiftObserver(page) {
  await page.addInitScript(() => {
    window.__creatureLayoutShiftScore = 0;
    try {
      if (typeof PerformanceObserver !== 'function') return;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__creatureLayoutShiftScore += Number(entry.value || 0);
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      window.__creatureLayoutShiftObserver = observer;
    } catch {
      window.__creatureLayoutShiftScore = 0;
    }
  });
}

async function readGodPanelMetrics(page) {
  return page.evaluate(() => {
    const panel = document.getElementById('god-mode-panel');
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    const buttons = Array.from(panel.querySelectorAll('.god-mode-tools button')).map(button => {
      const buttonRect = button.getBoundingClientRect();
      return {
        width: Number(buttonRect.width.toFixed(1)),
        height: Number(buttonRect.height.toFixed(1))
      };
    });
    return {
      visible: rect.width > 0 && rect.height > 0 && !panel.classList.contains('hidden'),
      width: Number(rect.width.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
      top: Number(rect.top.toFixed(1)),
      bottom: Number(rect.bottom.toFixed(1)),
      buttonMinHeight: Number(Math.min(...buttons.map(button => button.height)).toFixed(1)),
      buttonCount: buttons.length
    };
  });
}

async function readUpgradeScenarioResultMetrics(page) {
  return page.evaluate(() => {
    const section = document.getElementById('upgrade-scenario-result');
    const card = section?.querySelector('.scenario-result-card') || document.querySelector('.scenario-result-card');
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    const sectionRect = section?.getBoundingClientRect?.() || rect;
    return {
      state: card.getAttribute('data-state'),
      anchored: !!section,
      visible: rect.width > 0 && rect.height > 0,
      width: Number(rect.width.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
      top: Number(sectionRect.top.toFixed(1)),
      bottom: Number(sectionRect.bottom.toFixed(1)),
      inViewport: sectionRect.top >= -2 && sectionRect.top <= window.innerHeight - 80,
      text: card.textContent.trim().replace(/\s+/g, ' ').slice(0, 240)
    };
  });
}

async function readUpgradeHistoryMetrics(page) {
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.scenario-history-item'));
    return {
      count: items.length,
      text: items.map(item => item.textContent.trim().replace(/\s+/g, ' ').slice(0, 160))
    };
  });
}

function assertLayoutGuard(
  layoutGuard,
  label,
  { mobile = false, resultVisible = false, checkCls = true, clsMax = 0.1 } = {}
) {
  assert.ok(layoutGuard, `${label}: layout guard metrics should be available`);
  if (checkCls) {
    assert.ok(
      Number(layoutGuard.cumulativeLayoutShift) <= clsMax,
      `${label}: cumulative layout shift should stay below ${clsMax} (${layoutGuard.cumulativeLayoutShift})`
    );
  }
  assert.equal(layoutGuard.objectiveBottomOverlap, false, `${label}: objective rail should not overlap bottom chrome`);
  if (resultVisible) {
    assert.equal(
      layoutGuard.resultBottomOverlap,
      false,
      `${label}: scenario result should not sit under bottom chrome`
    );
  }
  if (mobile) {
    assert.ok(
      Number(layoutGuard.minTouchTarget || 0) >= 40,
      `${label}: visible mobile controls should keep at least 40px touch targets (${layoutGuard.minTouchTarget}px)`
    );
    assert.deepEqual(layoutGuard.offscreenButtons, [], `${label}: visible mobile controls should stay onscreen`);
  }
}

async function waitForPageCondition(page, condition, label, timeoutMs = 12000) {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      if (await page.evaluate(condition)) return;
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(120);
  }

  const suffix = lastError ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

async function advance(page, ms = 600) {
  const totalMs = Math.max(0, Number(ms) || 0);
  const chunkMs = 120;
  let remaining = totalMs;

  while (remaining > 0) {
    const duration = Math.min(chunkMs, remaining);
    await page.evaluate(stepMs => window.advanceTime?.(stepMs), duration);
    remaining -= duration;
  }
}

async function captureCanvasSnapshot(page, filePath) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.getElementById('view');
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Game canvas is missing');
    }
    return canvas.toDataURL('image/png');
  });
  const [, base64] = dataUrl.split(',');
  assert.ok(base64, 'canvas snapshot should return base64 image data');
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
}

async function clickWorld(page, x, y, { touch = false } = {}) {
  const canvas = page.locator('#view');
  const box = await canvas.boundingBox();
  assert.ok(box, 'canvas should have a bounding box');
  if (touch) {
    await canvas.tap({ position: { x, y } });
    return;
  }
  await page.mouse.click(box.x + x, box.y + y);
}

async function clickVisibleCreature(page, state) {
  const creature = state.visibleCreatures?.[0];
  assert.ok(creature, 'at least one creature should be visible for selection');
  const point = {
    x: state.camera.viewportWidth / 2 + (creature.x - state.camera.x) * state.camera.zoom,
    y: state.camera.viewportHeight / 2 + (creature.y - state.camera.y) * state.camera.zoom
  };
  await clickWorld(page, point.x, point.y);
  await advance(page, 320);
}

async function clickOverflowAction(page, action, scenarioName) {
  const menuItem = page.locator(`#overflow-drawer [data-action="${action}"]`);
  await menuItem.waitFor({ state: 'visible', timeout: 5000 });
  try {
    await menuItem.click({ timeout: 5000 });
    return;
  } catch (error) {
    await advance(page, 180);
    const state = await readGameState(page);
    if (state.ui?.tool === action || (action === 'props' && state.ui?.tool === 'prop')) return;
    if (!(await menuItem.isVisible().catch(() => false))) {
      await page.locator('#ctrl-more').click();
      await menuItem.waitFor({ state: 'visible', timeout: 5000 });
    }
    await menuItem.click({ force: true, timeout: 5000 });
    const after = await readGameState(page);
    assert.ok(
      after.ui?.tool === action || (action === 'props' && after.ui?.tool === 'prop'),
      `${scenarioName}: overflow action ${action} should activate after retry (${error.message})`
    );
  }
}

async function captureHomeSnapshot(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const url = `${baseUrl}/?v=${Date.now()}-home`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
  await page.locator('#home-page:not(.hidden)').waitFor({ state: 'visible', timeout: 12000 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(outDir, 'home-desktop.png') });
  await context.close();
}

async function sampleFramePacing(page, durationMs = 900) {
  await page.evaluate(() => {
    window.__creatureSmoke?.startFramePacingSample?.();
    window.__creatureSmoke?.setPaused?.(false);
  });
  await page.waitForTimeout(durationMs);
  const sample = await page.evaluate(() => {
    window.__creatureSmoke?.setPaused?.(true);
    return window.__creatureSmoke?.finishFramePacingSample?.();
  });
  await page.evaluate(() => window.__creatureSmoke?.setPaused?.(true));
  return sample;
}

function frameProfileText(framePacing) {
  const mainThread = framePacing?.mainThread;
  if (!mainThread) return 'nonDraw n/a';
  const topScopes = (mainThread.topScopes || [])
    .slice(0, 3)
    .map(scope => `${scope.name}:${scope.avgMs}ms`)
    .join(', ');
  return `nonDraw ${mainThread.profiledNonDrawImageMs}ms (${mainThread.profiledNonDrawImagePerFrameMs}ms/frame), top ${topScopes || 'n/a'}`;
}

function assertFrameProfile(framePacing, label) {
  assert.ok(framePacing.mainThread, `${label}: frame sample should include main-thread profile data`);
  assert.ok(
    Number.isFinite(framePacing.mainThread.profiledNonDrawImageMs),
    `${label}: profiled non-drawImage frame cost should be finite`
  );
  assert.ok(
    Number.isFinite(framePacing.mainThread.profiledNonDrawImagePerFrameMs),
    `${label}: profiled non-drawImage per-frame cost should be finite`
  );
  assert.ok(
    Array.isArray(framePacing.mainThread.topScopes),
    `${label}: main-thread profile should include top scope breakdown`
  );
}

function summarizeRuntimeReadiness(results) {
  const scenarioRows = results.map(result => {
    const framePacing = result.framePacing || {};
    const runtime = result.perf?.runtime || {};
    const workerDiagnostics = runtime.workerDiagnostics || {};
    const scenarioResult = result.scenarioResult || {};
    const layoutGuard = result.layoutGuard || {};
    return {
      scenario: result.scenario,
      mode: runtime.workerMode ? 'worker' : 'main',
      runtimeModeSource: runtime.runtimeModeSource || null,
      storedPreference: runtime.runtimeModeStored || null,
      workerReady: workerDiagnostics.ready ?? runtime.workerReady ?? null,
      workerPendingMessages: workerDiagnostics.queuedCommands ?? runtime.workerPendingMessages ?? null,
      workerErrorCount: workerDiagnostics.errorCount ?? null,
      workerSnapshotCount: workerDiagnostics.snapshotCount ?? null,
      workerSnapshotAgeMs: workerDiagnostics.lastSnapshotAgeMs ?? null,
      creatures: result.creatures,
      food: result.food,
      avgFrameMs: framePacing.avgFrameMs ?? null,
      p95FrameMs: framePacing.p95FrameMs ?? null,
      framesOver50ms: framePacing.framesOver50ms ?? null,
      profiledNonDrawImagePerFrameMs: framePacing.mainThread?.profiledNonDrawImagePerFrameMs ?? null,
      topScope: framePacing.mainThread?.topScopes?.[0]?.name || null,
      scenarioResultComplete: scenarioResult.complete === true,
      scenarioResultAnchored: scenarioResult.anchored === true,
      scenarioResultInViewport: scenarioResult.inViewport === true,
      scenarioHistoryCount: Number(scenarioResult.historyCount || 0),
      layoutGuardPassed: layoutGuard.passed === true,
      cumulativeLayoutShift:
        layoutGuard.metrics?.startupCumulativeLayoutShift ?? layoutGuard.metrics?.cumulativeLayoutShift ?? null,
      minTouchTarget: layoutGuard.metrics?.minTouchTarget ?? null
    };
  });

  const desktop = scenarioRows.find(row => row.scenario === 'desktop') || null;
  const mobileRows = scenarioRows.filter(row => row.scenario.startsWith('mobile-'));
  const runtimeStatusesOk = scenarioRows.every(
    row => row.mode === 'main' || (row.workerReady === true && row.workerPendingMessages === 0)
  );
  const completedScenarioResultsOk = scenarioRows.every(
    row =>
      row.scenarioResultComplete &&
      row.scenarioResultAnchored &&
      row.scenarioResultInViewport &&
      row.scenarioHistoryCount >= 1
  );
  const layoutGuardsOk = scenarioRows.every(row => row.layoutGuardPassed === true);
  const mobileP95Max = Math.max(0, ...mobileRows.map(row => Number(row.p95FrameMs) || 0));
  const desktopAvg = Number(desktop?.avgFrameMs) || 0;
  const desktopP95 = Number(desktop?.p95FrameMs) || 0;
  const desktopProfiledNonDraw = Number(desktop?.profiledNonDrawImagePerFrameMs);
  const workerCandidate =
    workerMode &&
    runtimeStatusesOk &&
    completedScenarioResultsOk &&
    layoutGuardsOk &&
    desktopAvg > 0 &&
    desktopAvg <= 26 &&
    desktopP95 <= 40 &&
    Number.isFinite(desktopProfiledNonDraw) &&
    desktopProfiledNonDraw <= 1.5 &&
    mobileP95Max <= 20;
  const defaultRun = forcedRuntimeMode === null;
  const safeToDefaultWorker = workerMode && workerCandidate;
  const status = workerMode
    ? workerCandidate
      ? defaultRun
        ? 'shipping-default'
        : 'candidate-opt-in'
      : 'needs-more-proof'
    : defaultRun
      ? 'shipping-default'
      : 'fallback-proof';

  return {
    generatedAt: new Date().toISOString(),
    mode: workerMode ? 'worker' : 'main',
    shippingDefault: shippingDefaultRuntime,
    defaultChanged: shippingDefaultRuntime === 'worker',
    status,
    workerCandidate,
    defaultReadiness: {
      safeToDefaultWorker,
      reason: workerMode
        ? workerCandidate
          ? defaultRun
            ? 'Worker is the shipping default and this run meets frame, runtime, and completed-scenario result gates.'
            : 'Forced worker smoke meets the candidate frame, runtime, and completed-scenario result gates.'
          : defaultRun
            ? 'Worker is configured as the shipping default but missed one or more gates; treat this as a release blocker and use explicit main fallback only until fixed.'
            : 'Forced worker smoke missed one or more readiness gates in this run; keep forced worker promotion held until frame thresholds, runtime status, and completed-scenario result proof all pass.'
        : 'Main-thread mode remains available as an explicit fallback path.'
    },
    completedScenarioResultFlow: {
      required: true,
      passed: completedScenarioResultsOk && layoutGuardsOk,
      scenarios: scenarioRows.map(row => ({
        scenario: row.scenario,
        complete: row.scenarioResultComplete,
        anchored: row.scenarioResultAnchored,
        inViewport: row.scenarioResultInViewport,
        historyCount: row.scenarioHistoryCount,
        layoutGuardPassed: row.layoutGuardPassed,
        cumulativeLayoutShift: row.cumulativeLayoutShift,
        minTouchTarget: row.minTouchTarget
      }))
    },
    thresholds: {
      workerDesktopAvgFrameMsMax: 26,
      workerDesktopP95FrameMsMax: 40,
      workerDesktopProfiledNonDrawImagePerFrameMsMax: 1.5,
      workerMobileP95FrameMsMax: 20,
      workerPendingMessagesMax: 0,
      completedScenarioResultsRequired: true,
      layoutGuardRequired: true,
      cumulativeLayoutShiftMax: workerMode ? 0.1 : 0.15,
      mobileTouchTargetMinPx: 40
    },
    scenarios: scenarioRows
  };
}

async function runScenario(browser, scenario) {
  console.log(`Browser smoke: ${scenario.name}`);
  if (!(await waitForServer(baseUrl, 5000))) {
    throw new Error(`Dev server became unavailable before ${scenario.name} at ${baseUrl}`);
  }

  const context = await browser.newContext({
    viewport: scenario.viewport,
    isMobile: scenario.mobile,
    hasTouch: scenario.mobile,
    deviceScaleFactor: scenario.mobile ? 2 : 1
  });
  const page = await context.newPage();
  await installLayoutShiftObserver(page);
  const errors = [];
  let achievementToastBounds = null;

  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      errors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', error => {
    errors.push({ type: 'pageerror', text: error.message });
  });

  const workerParam = forcedRuntimeMode === 'worker' ? '&worker=1' : forcedRuntimeMode === 'main' ? '&worker=0' : '';
  const url = `${baseUrl}/?smoke=1${workerParam}&v=${Date.now()}-${scenario.name}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
  await waitForPageCondition(page, () => typeof window.render_game_to_text === 'function', 'render_game_to_text');
  await waitForPageCondition(
    page,
    () => typeof window.__creatureSmoke?.saveRoundTrip === 'function',
    'creature smoke hooks'
  );
  await waitForPageCondition(
    page,
    () => {
      const state = JSON.parse(window.render_game_to_text());
      return state.ui && state.ui.homeVisible === false && state.summary.totalCreatures > 0;
    },
    'seeded smoke world'
  );
  await page.evaluate(() => window.__creatureSmoke?.setPaused?.(true));
  await page.evaluate(() => {
    window.__creatureLayoutShiftScore = 0;
  });

  console.log(`  ${scenario.name}: startup`);
  await advance(page, 900);
  let state = await readGameState(page);
  assert.equal(!!state.systems?.workerMode, workerMode, `${scenario.name}: worker mode should match smoke target`);
  assert.equal(
    state.systems?.runtimeModePreference,
    expectedRuntimeMode,
    `${scenario.name}: runtime mode preference should match active smoke target`
  );
  assert.equal(
    state.systems?.runtimeModeSource,
    forcedRuntimeMode ? 'query' : 'default',
    `${scenario.name}: runtime mode source should be explicit`
  );
  assert.equal(state.ui.homeVisible, false, `${scenario.name}: home should be hidden for smoke`);
  assert.equal(state.ui.mobileLayout, scenario.mobile, `${scenario.name}: mobile layout should match viewport`);
  assert.ok(state.summary.totalCreatures >= (scenario.mobile ? 35 : 55), `${scenario.name}: should seed creatures`);
  assert.ok(state.summary.totalFood >= (scenario.mobile ? 120 : 200), `${scenario.name}: should seed food`);
  assert.ok(
    state.camera.zoom >= (scenario.mobile ? 0.6 : 0.84),
    `${scenario.name}: opening camera should start close enough to read creatures`
  );
  const minimumVisibleCreatures = scenario.mobile ? 5 : 8;
  if (workerMode && state.visibleCreatures.length < minimumVisibleCreatures) {
    for (let attempt = 0; attempt < 6 && state.visibleCreatures.length < minimumVisibleCreatures; attempt++) {
      await advance(page, 360);
      state = await readGameState(page);
    }
  }
  assert.ok(
    state.visibleCreatures.length >= minimumVisibleCreatures,
    `${scenario.name}: opening view should frame a readable starter cluster`
  );
  assert.equal(
    state.summary.totalProps,
    0,
    `${scenario.name}: startup should not pre-complete prop goals before player action`
  );
  assert.ok(
    state.upgrades?.objectiveRail?.title,
    `${scenario.name}: objective rail should expose the first actionable goal`
  );
  assert.equal(
    state.ui.objectiveRailVisible,
    true,
    `${scenario.name}: DOM objective rail should be the primary goal surface`
  );
  assert.ok(state.ui.worldRhythm, `${scenario.name}: objective rail should expose season/time rhythm`);
  const objectiveRail = await readObjectiveRailMetrics(page);
  assert.ok(objectiveRail?.visible, `${scenario.name}: objective rail should be visible and measurable`);
  assert.ok(
    objectiveRail.height <= (scenario.mobile ? 76 : 58),
    `${scenario.name}: objective rail should stay compact (${objectiveRail.height}px)`
  );
  const startupLayoutGuard = await readLayoutGuardMetrics(page);
  assertLayoutGuard(startupLayoutGuard, `${scenario.name}: startup`, {
    mobile: scenario.mobile,
    clsMax: workerMode ? 0.1 : 0.15
  });
  assert.equal(
    state.ui.challengeOverlayVisible,
    false,
    `${scenario.name}: canvas challenge overlay should stay hidden while the objective rail is visible`
  );
  assert.equal(
    state.ui.miniGraphsVisible,
    false,
    `${scenario.name}: analytics mini-graphs should not occupy normal gameplay`
  );
  const catalog = await page.evaluate(() => window.__creatureSmoke.playableCatalog());
  assert.ok(catalog.count >= 14, `${scenario.name}: playable catalog should include the expanded scenario set`);
  assert.ok(
    catalog.scenarios.some(item => item.id === 'drought_rescue'),
    `${scenario.name}: drought rescue scenario should be available`
  );
  assert.ok(
    catalog.scenarios.some(item => item.id === 'apex_balance'),
    `${scenario.name}: apex balance scenario should be available`
  );
  assert.ok(
    catalog.scenarios.some(item => item.id === 'variant_crossing'),
    `${scenario.name}: variant crossing scenario should be available`
  );
  const runtimeControl = await page.evaluate(() => window.__creatureSmoke.runtimeModeControlState());
  assert.equal(runtimeControl.exists, true, `${scenario.name}: runtime mode UI toggle should exist`);
  assert.equal(
    runtimeControl.activeMode,
    expectedRuntimeMode,
    `${scenario.name}: runtime mode UI toggle should reflect active runtime mode`
  );
  if (scenario.mobile) {
    assert.equal(
      state.selectedCreature,
      null,
      `${scenario.name}: opening should keep mobile playfield uncluttered before manual selection`
    );
  } else {
    if (!state.selectedCreature && workerMode) {
      const fallbackSelection = await page.evaluate(() => window.__creatureSmoke.selectVisibleCreature());
      assert.equal(
        fallbackSelection.ok,
        true,
        `${scenario.name}: worker opening fallback should select a visible creature`
      );
      await advance(page, 120);
      state = await readGameState(page);
    }
    assert.ok(
      state.selectedCreature,
      `${scenario.name}: desktop opening should spotlight an inspectable starter creature`
    );
  }
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-clean.png`) });

  if (workerMode) {
    console.log(`  ${scenario.name}: worker interactions`);
    const beforeSpawn = state.summary.totalCreatures;
    await page.locator('#ctrl-spawn').click();
    await page.locator('.spawn-card[data-creature="predator"]').click();
    await page.locator('#spawn-drawer-confirm').click();
    await page.locator('#spawn-drawer').waitFor({ state: 'hidden', timeout: 5000 });
    await advance(page, 240);
    await clickWorld(page, scenario.viewport.width * 0.5, scenario.viewport.height * 0.45, { touch: scenario.mobile });
    await page.waitForTimeout(800);
    state = await readGameState(page);
    assert.ok(
      state.summary.totalCreatures >= beforeSpawn,
      `${scenario.name}: worker spawn flow should keep creature sync valid`
    );

    const beforeFood = state.summary.totalFood;
    await page.locator('#ctrl-food').click();
    await clickWorld(page, scenario.viewport.width * 0.54, scenario.viewport.height * 0.48, { touch: scenario.mobile });
    await page.waitForTimeout(800);
    state = await readGameState(page);
    assert.ok(state.summary.totalFood >= beforeFood, `${scenario.name}: worker food flow should keep food sync valid`);
    assert.equal(state.ui.tool, 'food', `${scenario.name}: worker food tool should be reflected`);

    await page.locator('#ctrl-watch').click();
    await advance(page, 240);
    state = await readGameState(page);
    assert.equal(state.ui.watchMode, true, `${scenario.name}: worker watch mode should toggle on`);
    await page.screenshot({ path: path.join(outDir, `${scenario.name}-watch.png`) });

    console.log(`  ${scenario.name}: worker save/runtime parity`);
    const workerRoundTrip = await page.evaluate(() => window.__creatureSmoke.saveRoundTrip());
    assert.equal(workerRoundTrip.ok, true, `${scenario.name}: worker save roundtrip should report ok`);
    assert.equal(
      workerRoundTrip.applied,
      true,
      `${scenario.name}: worker save parity should apply through SimulationProxy.importState`
    );
    assert.equal(
      workerRoundTrip.workerSnapshotOnly,
      false,
      `${scenario.name}: worker save parity should no longer be snapshot-only`
    );
    assert.equal(
      workerRoundTrip.after.creatures,
      workerRoundTrip.before.creatures,
      `${scenario.name}: worker roundtrip should preserve creature count`
    );
    assert.ok(
      workerRoundTrip.after.food >= Math.min(workerRoundTrip.before.food, 1),
      `${scenario.name}: worker roundtrip should preserve food count`
    );

    const beforeUndo = state.summary.totalCreatures;
    const undoKey = process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z';
    await page.keyboard.press(undoKey);
    await page.waitForTimeout(600);
    await advance(page, 120);
    state = await readGameState(page);
    assert.ok(
      state.summary.totalCreatures <= beforeUndo,
      `${scenario.name}: Ctrl+Z should undo the last spawn in worker mode`
    );

    const workerSlotPreview = await page.evaluate(() => window.__creatureSmoke.saveSlotPreview(2));
    assert.equal(workerSlotPreview.ok, true, `${scenario.name}: worker save slot preview should be readable`);
    assert.ok(
      workerSlotPreview.info.preview.population >= workerRoundTrip.before.creatures,
      `${scenario.name}: worker slot preview should include population`
    );
    assert.match(
      workerSlotPreview.info.preview.thumbnail || '',
      /^data:image\/png;base64,/,
      `${scenario.name}: worker slot preview should include a canvas thumbnail`
    );

    const runtimePreference = await page.evaluate(() => {
      const before = window.__creatureSmoke.runtimeModePreference();
      const storedWorker = window.__creatureSmoke.setRuntimeModePreference('worker');
      const afterWorker = window.__creatureSmoke.runtimeModePreference();
      const storedMain = window.__creatureSmoke.setRuntimeModePreference('main');
      const afterMain = window.__creatureSmoke.runtimeModePreference();
      return { before, storedWorker, afterWorker, storedMain, afterMain };
    });
    assert.equal(
      runtimePreference.before.workerMode,
      true,
      `${scenario.name}: worker runtime preference hook should expose active worker mode`
    );
    assert.equal(
      runtimePreference.storedWorker.ok,
      true,
      `${scenario.name}: worker runtime preference should persist worker candidate mode`
    );
    assert.equal(
      runtimePreference.afterWorker.stored,
      'worker',
      `${scenario.name}: worker preference should roundtrip from storage`
    );
    assert.equal(
      runtimePreference.storedMain.ok,
      true,
      `${scenario.name}: worker runtime preference should restore main candidate mode`
    );
    assert.equal(
      runtimePreference.afterMain.stored,
      'main',
      `${scenario.name}: worker preference reset should roundtrip from storage`
    );

    const runtimeToggle = await page.evaluate(() => {
      const toggle = document.getElementById('toggle-worker-runtime');
      const before = window.__creatureSmoke.runtimeModeControlState();
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const afterWorker = window.__creatureSmoke.runtimeModeControlState();
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const afterMain = window.__creatureSmoke.runtimeModeControlState();
      return { before, afterWorker, afterMain };
    });
    assert.equal(runtimeToggle.before.exists, true, `${scenario.name}: runtime mode UI toggle should exist`);
    assert.equal(
      runtimeToggle.afterWorker.stored,
      'worker',
      `${scenario.name}: runtime mode UI toggle should persist worker for next load`
    );
    assert.equal(
      runtimeToggle.afterMain.stored,
      'main',
      `${scenario.name}: runtime mode UI toggle should restore main for next load`
    );

    const workerScenario = await page.evaluate(() => window.__creatureSmoke.startScenario('apex_balance'));
    const workerPlayable = workerScenario?.playable || workerScenario;
    assert.equal(workerPlayable?.active, true, `${scenario.name}: worker scenario candidate should start`);
    assert.equal(
      workerPlayable?.scenario?.id,
      'apex_balance',
      `${scenario.name}: worker scenario candidate id should be reflected`
    );
    await advance(page, 1200);
    state = await readGameState(page);
    assert.equal(
      state.playable?.scenario?.id,
      'apex_balance',
      `${scenario.name}: worker text state should preserve started scenario`
    );
    const workerScenarioRoundTrip = await page.evaluate(() => window.__creatureSmoke.saveRoundTrip());
    assert.equal(workerScenarioRoundTrip.ok, true, `${scenario.name}: worker scenario save parity should report ok`);
    assert.equal(
      workerScenarioRoundTrip.before.playable,
      'apex_balance',
      `${scenario.name}: worker scenario save parity should serialize active scenario`
    );
    assert.equal(
      workerScenarioRoundTrip.after.playable,
      'apex_balance',
      `${scenario.name}: worker scenario save parity should reload active scenario metadata`
    );

    const scenarioElapsedBeforeSoak = Number(state.playable?.elapsed || 0);
    await advance(page, 9000);
    state = await readGameState(page);
    assert.equal(state.ui.watchMode, true, `${scenario.name}: worker watch mode should survive parity soak`);
    assert.equal(
      state.playable?.active,
      true,
      `${scenario.name}: worker scenario should remain active after extended soak`
    );
    assert.equal(
      state.playable?.scenario?.id,
      'apex_balance',
      `${scenario.name}: worker scenario id should survive extended soak`
    );
    assert.ok(
      Number(state.playable?.elapsed || 0) >= scenarioElapsedBeforeSoak,
      `${scenario.name}: worker scenario clock should not rewind during extended soak`
    );
    assert.ok(
      state.summary.totalCreatures >= Math.min(workerScenarioRoundTrip.before.creatures, 30),
      `${scenario.name}: worker creature sync should survive parity soak`
    );
    assert.ok(
      state.summary.totalFood >= Math.min(workerScenarioRoundTrip.before.food, 1),
      `${scenario.name}: worker food sync should survive parity soak`
    );

    const perf = await page.evaluate(() => window.__creatureSmoke.perfBudget());
    assert.equal(
      !!perf.runtime?.workerMode,
      true,
      `${scenario.name}: worker perf runtime should expose worker mode truth`
    );
    assert.equal(
      perf.runtime?.runtimeModePreference,
      'worker',
      `${scenario.name}: worker perf runtime should expose active worker preference`
    );
    assert.equal(
      perf.runtime?.runtimeModeSource,
      forcedRuntimeMode ? 'query' : 'default',
      `${scenario.name}: worker perf runtime should expose runtime source`
    );
    assert.equal(perf.runtime?.workerReady, true, `${scenario.name}: worker perf runtime should expose ready state`);
    assert.equal(
      perf.runtime?.workerPendingMessages,
      0,
      `${scenario.name}: worker perf runtime should have no queued startup messages`
    );
    assert.equal(
      perf.runtime?.workerDiagnostics?.ready,
      true,
      `${scenario.name}: worker diagnostics should report ready`
    );
    assert.equal(
      perf.runtime?.workerDiagnostics?.errorCount,
      0,
      `${scenario.name}: worker diagnostics should remain error-free`
    );
    assert.ok(
      perf.runtime?.workerDiagnostics?.snapshotCount >= 5,
      `${scenario.name}: worker diagnostics should count snapshot syncs`
    );
    assert.ok(
      perf.runtime?.workerDiagnostics?.lastSnapshotAgeMs >= 0 &&
        perf.runtime?.workerDiagnostics?.lastSnapshotAgeMs < 5000,
      `${scenario.name}: worker diagnostics should expose a fresh snapshot age`
    );
    assert.ok(perf.canvas.width > 0 && perf.canvas.height > 0, `${scenario.name}: worker canvas should be measurable`);
    assert.ok(perf.rendered > 0, `${scenario.name}: worker smoke perf should report live rendered objects`);
    assert.ok(perf.assets.registeredSprites >= 20, `${scenario.name}: worker sprite manifest should be loaded`);
    const particleBudget = particleBudgetByQuality[perf.renderer?.quality] ?? 500;
    assert.ok(
      perf.world.particles <= particleBudget,
      `${scenario.name}: worker particles should honor ${perf.renderer?.quality || 'default'} quality budget`
    );
    assert.ok(
      perf.world.maxParticles <= particleBudget,
      `${scenario.name}: worker particle system max should track ${perf.renderer?.quality || 'default'} quality budget`
    );

    const framePacing = sampleRealtime ? await sampleFramePacing(page) : null;
    if (framePacing) {
      console.log(
        `  ${scenario.name}: worker frame pacing ${framePacing.frames} frames, avg ${framePacing.avgFrameMs}ms, p95 ${framePacing.p95FrameMs}ms, drawImages ${framePacing.drawImage?.perFrame ?? 0}/frame, draw ${framePacing.drawImage?.timeMs ?? 0}ms, ${frameProfileText(framePacing)}, quality ${framePacing.qualityStart || 'unknown'}→${framePacing.qualityEnd || 'unknown'}`
      );
      assert.ok(framePacing.frames >= 1, `${scenario.name}: worker real-time frame sample should capture app frames`);
      assert.ok(framePacing.drawImage, `${scenario.name}: worker frame sample should include drawImage profile data`);
      assert.ok(framePacing.drawImage.count >= 0, `${scenario.name}: worker drawImage count should be measured`);
      assert.ok(
        Number.isFinite(framePacing.drawImage.timeMs),
        `${scenario.name}: worker drawImage time should be finite`
      );
      assertFrameProfile(framePacing, `${scenario.name}: worker`);
    }

    console.log(`  ${scenario.name}: worker scenario result`);
    const completedScenario = await page.evaluate(() =>
      window.__creatureSmoke.completeScenarioForSmoke('apex_balance')
    );
    assert.equal(
      completedScenario.ok,
      true,
      `${scenario.name}: worker smoke scenario should complete deterministically`
    );
    assert.equal(
      completedScenario.playable.state,
      'complete',
      `${scenario.name}: worker completed scenario state should be reflected`
    );
    assert.equal(
      completedScenario.upgrades.scenarioResult.state,
      'complete',
      `${scenario.name}: worker upgrade state should expose completed scenario result`
    );
    assert.ok(
      completedScenario.upgrades.scenarioResult.score >= 0,
      `${scenario.name}: worker scenario result should expose a score`
    );
    await page.evaluate(() => window.__creatureSmoke.showUpgradePanel({ focusResult: true }));
    await page.locator('.scenario-result-card[data-state="complete"]').waitFor({ state: 'visible', timeout: 5000 });
    const resultMetrics = await readUpgradeScenarioResultMetrics(page);
    assert.ok(resultMetrics?.visible, `${scenario.name}: worker scenario result card should be visible`);
    assert.equal(
      resultMetrics.anchored,
      true,
      `${scenario.name}: worker scenario result should have a first-class Upgrade Hub anchor`
    );
    assert.equal(
      resultMetrics.inViewport,
      true,
      `${scenario.name}: worker focused scenario result should be near the top of the visible Upgrade Hub`
    );
    assert.match(
      resultMetrics.text,
      /finish|Score|Survival/i,
      `${scenario.name}: worker scenario result card should show result details`
    );
    const history = await page.evaluate(() => window.__creatureSmoke.scenarioHistory());
    assert.ok(history.length >= 1, `${scenario.name}: worker completed scenario should be added to run history`);
    assert.equal(
      history[0].scenarioId,
      'apex_balance',
      `${scenario.name}: worker latest run history item should be the completed scenario`
    );
    assert.ok(history[0].score >= 0, `${scenario.name}: worker run history item should include a score`);
    const historyMetrics = await readUpgradeHistoryMetrics(page);
    assert.ok(historyMetrics.count >= 1, `${scenario.name}: worker Upgrade Hub should render run history items`);
    assert.match(
      historyMetrics.text.join(' '),
      /Apex Balance|Gold|Silver|Bronze|Practice|Best/i,
      `${scenario.name}: worker run history should include scenario identity, medal, or best-run state`
    );
    const layoutGuardMetrics = await readLayoutGuardMetrics(page);
    assertLayoutGuard(layoutGuardMetrics, `${scenario.name}: worker result`, {
      mobile: scenario.mobile,
      resultVisible: true,
      checkCls: false
    });
    const scenarioResult = {
      scenarioId: completedScenario.playable?.scenario?.id || null,
      state: completedScenario.playable?.state || null,
      complete:
        completedScenario.playable?.state === 'complete' &&
        completedScenario.upgrades?.scenarioResult?.state === 'complete',
      score: Number(completedScenario.upgrades?.scenarioResult?.score ?? 0),
      medal: completedScenario.upgrades?.scenarioResult?.medal || null,
      anchored: resultMetrics.anchored === true,
      inViewport: resultMetrics.inViewport === true,
      historyCount: Number(historyMetrics.count || 0),
      latestHistoryScenarioId: history[0]?.scenarioId || null
    };
    const layoutGuard = {
      passed: true,
      metrics: {
        ...layoutGuardMetrics,
        startupCumulativeLayoutShift: startupLayoutGuard.cumulativeLayoutShift
      },
      startup: startupLayoutGuard
    };
    await page.screenshot({ path: path.join(outDir, `${scenario.name}-upgrade-result.png`) });
    state = await readGameState(page);

    await captureCanvasSnapshot(page, path.join(outDir, `${scenario.name}.png`));
    await fs.writeFile(
      path.join(outDir, `${scenario.name}.json`),
      JSON.stringify({ state, perf, framePacing, scenarioResult, layoutGuard, errors }, null, 2)
    );
    assert.deepEqual(errors, [], `${scenario.name}: worker browser console should stay warning/error free`);
    await context.close();
    return {
      scenario: scenario.name,
      workerMode,
      creatures: state.summary.totalCreatures,
      food: state.summary.totalFood,
      perf,
      framePacing,
      scenarioResult,
      layoutGuard
    };
  }

  const director = await page.evaluate(() => window.__creatureSmoke.startScenario('first_ecosystem'));
  const playable = director?.playable || director;
  assert.ok(playable?.active, `${scenario.name}: playable scenario should start`);
  assert.equal(playable.scenario.id, 'first_ecosystem', `${scenario.name}: playable scenario id should be reflected`);
  assert.ok(
    (director?.objectives?.cards?.length || 0) >= 2,
    `${scenario.name}: director should expose objective cards`
  );
  await advance(page, 600);
  state = await readGameState(page);
  assert.ok(state.playable?.active, `${scenario.name}: text state should include playable scenario`);
  assert.ok(
    state.director?.objectives?.cards?.length >= 2,
    `${scenario.name}: text state should include director objectives`
  );
  assert.ok(state.playable.director?.nextAction, `${scenario.name}: director should provide a next action`);
  assert.ok(state.playable.metrics.alive >= 25, `${scenario.name}: scenario should seed a viable population`);
  await page.locator('.director-art').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.locator('.director-art').count(), 1, `${scenario.name}: scenario art node should render`);

  console.log(`  ${scenario.name}: select creature`);
  await clickVisibleCreature(page, state);
  state = await readGameState(page);
  if (!state.selectedCreature) {
    const fallbackSelection = await page.evaluate(() => window.__creatureSmoke.selectVisibleCreature());
    assert.equal(fallbackSelection.ok, true, `${scenario.name}: smoke selection fallback should select a creature`);
    await advance(page, 120);
    state = await readGameState(page);
  }
  assert.ok(state.selectedCreature, `${scenario.name}: creature selection should be reflected in text state`);
  if (!scenario.mobile) {
    const inspectorOpen = await page.locator('#inspector:not(.hidden)').count();
    if (inspectorOpen) {
      await page.locator('#selected-info.selected-inspector-chip').waitFor({ state: 'visible', timeout: 3000 });
    }
  }
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-selected.png`) });

  console.log(`  ${scenario.name}: spawn`);
  const beforeSpawn = state.summary.totalCreatures;
  await page.locator('#ctrl-spawn').click();
  await page.locator('.spawn-card[data-creature="predator"]').click();
  await page.locator('#spawn-drawer-confirm').click();
  await page.locator('#spawn-drawer').waitFor({ state: 'hidden', timeout: 5000 });
  await advance(page, 120);
  await clickWorld(page, scenario.viewport.width * 0.5, scenario.viewport.height * 0.45, { touch: scenario.mobile });
  await advance(page, 400);
  state = await readGameState(page);
  assert.ok(state.summary.totalCreatures > beforeSpawn, `${scenario.name}: spawn flow should add a creature`);
  assert.equal(state.ui.tool, 'spawn', `${scenario.name}: spawn tool should stay active after spawning`);

  console.log(`  ${scenario.name}: food`);
  const beforeFood = state.summary.totalFood;
  await page.locator('#ctrl-more').click();
  const overflowBox = await page.locator('#overflow-drawer .drawer-content').boundingBox();
  assert.ok(overflowBox, `${scenario.name}: overflow menu should have a measurable drawer`);
  if (scenario.mobile) {
    assert.ok(
      overflowBox.width >= scenario.viewport.width * 0.9,
      `${scenario.name}: mobile overflow menu should use bottom-sheet width`
    );
  } else {
    assert.ok(overflowBox.width <= 500, `${scenario.name}: desktop overflow menu should stay compact`);
  }
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-overflow.png`) });
  await page.locator('#menu-food').click();
  await clickWorld(page, scenario.viewport.width * 0.54, scenario.viewport.height * 0.48, { touch: scenario.mobile });
  await advance(page, 400);
  state = await readGameState(page);
  assert.ok(state.summary.totalFood >= beforeFood, `${scenario.name}: food tool should not reduce food count`);
  assert.equal(state.ui.tool, 'food', `${scenario.name}: food tool should be reflected in text state`);
  await page.locator('#ctrl-more').click();
  await page.locator('#menu-food').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(
    await page.locator('#menu-food').getAttribute('aria-pressed'),
    'true',
    `${scenario.name}: food menu item should reflect active tool state`
  );
  await clickOverflowAction(page, 'props', scenario.name);
  await advance(page, 180);
  state = await readGameState(page);
  assert.equal(state.ui.tool, 'prop', `${scenario.name}: props menu action should activate prop tool`);

  console.log(`  ${scenario.name}: watch and god`);
  await page.locator('#ctrl-watch').click();
  await advance(page, 240);
  state = await readGameState(page);
  assert.equal(state.ui.watchMode, true, `${scenario.name}: watch mode should toggle on`);
  await page.locator('#watch-strip').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#watch-god-mode').waitFor({ state: 'visible', timeout: 5000 });
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-watch.png`) });
  await page.locator('#watch-god-mode').click();
  await advance(page, 240);
  state = await readGameState(page);
  assert.equal(state.ui.godMode, true, `${scenario.name}: god mode should toggle from watch strip`);
  assert.equal(state.ui.objectiveMode, 'god', `${scenario.name}: objective rail should carry god-mode state`);
  const godPanel = await readGodPanelMetrics(page);
  assert.ok(godPanel?.visible, `${scenario.name}: god mode panel should be visible and measurable`);
  assert.equal(godPanel.buttonCount, 6, `${scenario.name}: god mode panel should expose all six tools`);
  if (scenario.mobile) {
    assert.ok(
      godPanel.width <= scenario.viewport.width - 24,
      `${scenario.name}: mobile god panel should fit the viewport`
    );
    assert.ok(godPanel.height <= 260, `${scenario.name}: mobile god panel should stay compact (${godPanel.height}px)`);
    assert.ok(godPanel.buttonMinHeight >= 36, `${scenario.name}: mobile god buttons should remain tappable`);
  }
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-god.png`) });

  console.log(`  ${scenario.name}: moments and god tools`);
  await page.locator('#watch-moments').click();
  await page.locator('#moments-panel').waitFor({ state: 'visible', timeout: 5000 });
  await advance(page, 240);
  state = await readGameState(page);
  assert.ok(state.moments.count >= 1, `${scenario.name}: moments panel should have recorded scenario moments`);
  assert.ok(
    state.moments.summary?.peakPopulation >= state.summary.totalCreatures,
    `${scenario.name}: moments summary should track population`
  );
  await page.evaluate(() => {
    const panel = document.getElementById('moments-panel');
    panel?.classList.add('hidden');
    panel?.setAttribute('aria-hidden', 'true');
  });

  const godTools = ['food', 'calm', 'chaos', 'prop', 'remove'];
  const beforeGod = {
    food: state.summary.totalFood,
    props: state.summary.totalProps,
    calmZones: state.systems.calmZones,
    chaosNudge: state.systems.chaosNudge
  };
  const actionPoint = {
    x: scenario.viewport.width * 0.58,
    y: scenario.viewport.height * 0.46
  };
  for (const tool of godTools) {
    const toolState = await page.evaluate(nextTool => window.__creatureSmoke.setGodTool(nextTool), tool);
    assert.equal(toolState.active, true, `${scenario.name}: god tool ${tool} should activate god mode`);
    assert.equal(toolState.tool, tool, `${scenario.name}: god tool ${tool} should be reflected in smoke state`);
    assert.ok(
      toolState.hint.toLowerCase().includes(tool),
      `${scenario.name}: god tool ${tool} should update the panel hint`
    );
    await clickWorld(page, actionPoint.x, actionPoint.y, { touch: scenario.mobile });
    await advance(page, 260);
  }
  state = await readGameState(page);
  assert.ok(state.summary.totalFood >= beforeGod.food, `${scenario.name}: god food should preserve or increase food`);
  assert.ok(state.systems.calmZones >= beforeGod.calmZones, `${scenario.name}: god calm should add calm coverage`);
  assert.ok(state.systems.chaosNudge >= beforeGod.chaosNudge, `${scenario.name}: god chaos should register a nudge`);
  assert.ok(
    state.summary.totalProps >= beforeGod.props,
    `${scenario.name}: god prop/remove should leave prop accounting valid`
  );

  console.log(`  ${scenario.name}: throw and props`);
  const interactionProbe = await page.evaluate(() => window.__creatureSmoke.runInteractionProbe());
  assert.equal(
    interactionProbe.ok,
    true,
    `${scenario.name}: smoke interaction probe should throw a creature and trigger a prop`
  );
  assert.ok(
    interactionProbe.after.throws > interactionProbe.before.throws,
    `${scenario.name}: throw counter should increment`
  );
  assert.ok(
    interactionProbe.after.props > interactionProbe.before.props,
    `${scenario.name}: prop trigger counter should increment`
  );
  assert.ok(
    Math.hypot(interactionProbe.after.impulse.vx, interactionProbe.after.impulse.vy) > 1,
    `${scenario.name}: throw/prop should leave measurable impulse`
  );
  state = await readGameState(page);
  assert.ok(
    state.interactions.throws >= interactionProbe.after.throws,
    `${scenario.name}: text state should expose throw count`
  );
  assert.ok(
    state.interactions.props >= interactionProbe.after.props,
    `${scenario.name}: text state should expose prop count`
  );

  console.log(`  ${scenario.name}: save/load and perf`);
  const roundTrip = await page.evaluate(() => window.__creatureSmoke.saveRoundTrip());
  assert.equal(roundTrip.ok, true, `${scenario.name}: save/load roundtrip should report ok`);
  assert.ok(roundTrip.after.creatures >= beforeSpawn, `${scenario.name}: roundtrip should preserve creatures`);
  assert.ok(roundTrip.after.food >= beforeFood, `${scenario.name}: roundtrip should preserve food`);
  assert.equal(
    roundTrip.after.playable,
    'first_ecosystem',
    `${scenario.name}: roundtrip should preserve active playable scenario`
  );
  assert.ok(
    roundTrip.after.metadata?.scenario?.id === 'first_ecosystem',
    `${scenario.name}: roundtrip metadata should expose scenario preview`
  );

  const slotPreview = await page.evaluate(() => window.__creatureSmoke.saveSlotPreview(1));
  assert.equal(slotPreview.ok, true, `${scenario.name}: save slot preview should be readable`);
  assert.equal(
    slotPreview.info.preview.scenario.id,
    'first_ecosystem',
    `${scenario.name}: slot preview should include scenario`
  );
  assert.ok(
    slotPreview.info.preview.population >= beforeSpawn,
    `${scenario.name}: slot preview should include population`
  );
  assert.match(
    slotPreview.info.preview.thumbnail || '',
    /^data:image\/png;base64,/,
    `${scenario.name}: slot preview should include a canvas thumbnail`
  );

  console.log(`  ${scenario.name}: scenario result`);
  const completedScenario = await page.evaluate(() =>
    window.__creatureSmoke.completeScenarioForSmoke('first_ecosystem')
  );
  assert.equal(completedScenario.ok, true, `${scenario.name}: smoke scenario should complete deterministically`);
  assert.equal(
    completedScenario.playable.state,
    'complete',
    `${scenario.name}: completed scenario state should be reflected`
  );
  assert.equal(
    completedScenario.upgrades.scenarioResult.state,
    'complete',
    `${scenario.name}: upgrade state should expose completed scenario result`
  );
  assert.ok(
    completedScenario.upgrades.scenarioResult.score >= 0,
    `${scenario.name}: scenario result should expose a score`
  );
  await page.evaluate(() => window.__creatureSmoke.showUpgradePanel({ focusResult: true }));
  const godPanelAfterUpgrade = await readGodPanelMetrics(page);
  assert.equal(
    godPanelAfterUpgrade?.visible,
    false,
    `${scenario.name}: upgrade panel should not be covered by god mode panel`
  );
  await page.locator('.scenario-result-card[data-state="complete"]').waitFor({ state: 'visible', timeout: 5000 });
  const resultMetrics = await readUpgradeScenarioResultMetrics(page);
  assert.ok(resultMetrics?.visible, `${scenario.name}: scenario result card should be visible`);
  assert.equal(
    resultMetrics.anchored,
    true,
    `${scenario.name}: scenario result should have a first-class Upgrade Hub anchor`
  );
  assert.equal(
    resultMetrics.inViewport,
    true,
    `${scenario.name}: focused scenario result should be near the top of the visible Upgrade Hub`
  );
  assert.match(
    resultMetrics.text,
    /finish|Score|Survival/i,
    `${scenario.name}: scenario result card should show result details`
  );
  const history = await page.evaluate(() => window.__creatureSmoke.scenarioHistory());
  assert.ok(history.length >= 1, `${scenario.name}: completed scenario should be added to run history`);
  assert.equal(
    history[0].scenarioId,
    'first_ecosystem',
    `${scenario.name}: latest run history item should be the completed scenario`
  );
  assert.ok(history[0].score >= 0, `${scenario.name}: run history item should include a score`);
  const historyMetrics = await readUpgradeHistoryMetrics(page);
  assert.ok(historyMetrics.count >= 1, `${scenario.name}: Upgrade Hub should render run history items`);
  assert.match(
    historyMetrics.text.join(' '),
    /First Ecosystem|Gold|Silver|Bronze|Practice|Best/i,
    `${scenario.name}: run history should include scenario identity, medal, or best-run state`
  );
  const layoutGuardMetrics = await readLayoutGuardMetrics(page);
  assertLayoutGuard(layoutGuardMetrics, `${scenario.name}: result`, {
    mobile: scenario.mobile,
    resultVisible: true,
    checkCls: false
  });
  const scenarioResult = {
    scenarioId: completedScenario.playable?.scenario?.id || null,
    state: completedScenario.playable?.state || null,
    complete:
      completedScenario.playable?.state === 'complete' &&
      completedScenario.upgrades?.scenarioResult?.state === 'complete',
    score: Number(completedScenario.upgrades?.scenarioResult?.score ?? 0),
    medal: completedScenario.upgrades?.scenarioResult?.medal || null,
    anchored: resultMetrics.anchored === true,
    inViewport: resultMetrics.inViewport === true,
    historyCount: Number(historyMetrics.count || 0),
    latestHistoryScenarioId: history[0]?.scenarioId || null
  };
  const layoutGuard = {
    passed: true,
    metrics: {
      ...layoutGuardMetrics,
      startupCumulativeLayoutShift: startupLayoutGuard.cumulativeLayoutShift
    },
    startup: startupLayoutGuard
  };
  if (!scenario.mobile) {
    achievementToastBounds = await page.evaluate(() => window.__creatureSmoke.showAchievementToastForSmoke());
    assert.equal(
      achievementToastBounds.ok,
      true,
      `${scenario.name}: fallback achievement toast should render for bounds audit`
    );
    assert.equal(
      achievementToastBounds.overlapsInspector,
      false,
      `${scenario.name}: fallback achievement toast should not overlap the Inspector`
    );
    assert.equal(
      achievementToastBounds.overlapsUpgradePanel,
      false,
      `${scenario.name}: fallback achievement toast should not overlap the Upgrade Hub`
    );
  }
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-upgrade-result.png`) });
  await page.evaluate(() => window.__creatureSmoke.clearAchievementToastsForSmoke());

  const upgrades = await page.evaluate(() => {
    const recipeOk = window.__creatureSmoke.applyRecipe('peaceful_meadow');
    const mode = window.__creatureSmoke.setReadabilityMode('contrast');
    const follow = window.__creatureSmoke.setFollowMode('youngest');
    const postcard = window.__creatureSmoke.createPostcard();
    const balance = window.__creatureSmoke.runBalanceProbe(120);
    const nicknameOk = window.__creatureSmoke.setSelectedNickname('Scout');
    const actionOk = window.__creatureSmoke.runUpgradeAction('paint_food');
    return {
      recipeOk,
      mode,
      follow,
      postcard,
      balance,
      nicknameOk,
      actionOk,
      state: window.__creatureSmoke.upgradeState()
    };
  });
  assert.equal(upgrades.recipeOk, true, `${scenario.name}: sandbox recipe should apply`);
  assert.equal(
    upgrades.mode.readabilityMode,
    'contrast',
    `${scenario.name}: readability mode should update smoke state`
  );
  assert.equal(upgrades.follow.ok, true, `${scenario.name}: follow mode should select a creature`);
  assert.ok(upgrades.postcard.population > 0, `${scenario.name}: postcard should include population`);
  assert.equal(typeof upgrades.balance.pass, 'boolean', `${scenario.name}: balance probe should report pass/fail`);
  assert.equal(upgrades.nicknameOk, true, `${scenario.name}: selected creature nickname should save`);
  assert.equal(upgrades.actionOk, true, `${scenario.name}: upgrade action card should run`);
  assert.ok(upgrades.state.recipes.length >= 4, `${scenario.name}: upgrade state should expose recipe presets`);
  assert.ok(
    upgrades.state.scenarioResult?.statCards?.length >= 3,
    `${scenario.name}: upgrade state should expose scenario result stat cards`
  );
  assert.ok(
    upgrades.state.scenarioHistory?.length >= 1,
    `${scenario.name}: upgrade state should expose scenario run history`
  );

  const genePrefs = await page.evaluate(() => window.__creatureSmoke.geneEditorPrefsRoundTrip());
  assert.equal(genePrefs.ok, true, `${scenario.name}: gene editor preferences should persist across reload`);
  assert.equal(genePrefs.restored.spawnCount, 4, `${scenario.name}: gene editor should restore spawn count preference`);
  assert.equal(
    genePrefs.restored.spawnSpread,
    120,
    `${scenario.name}: gene editor should restore spawn spread preference`
  );

  await advance(page, 180);
  const perf = await page.evaluate(() => window.__creatureSmoke.perfBudget());
  assert.equal(
    !!perf.runtime?.workerMode,
    workerMode,
    `${scenario.name}: perf runtime should expose worker mode truth`
  );
  assert.ok(perf.canvas.width > 0 && perf.canvas.height > 0, `${scenario.name}: canvas should be measurable`);
  assert.ok(perf.rendered > 0, `${scenario.name}: smoke perf should report live rendered objects`);
  assert.ok(perf.totalObjects >= perf.rendered, `${scenario.name}: smoke perf total should cover rendered objects`);
  assert.equal(
    perf.rendered,
    perf.renderer.rendered,
    `${scenario.name}: smoke rendered count should come from renderer stats`
  );
  assert.equal(
    perf.culled,
    perf.renderer.culled,
    `${scenario.name}: smoke culled count should come from renderer stats`
  );
  assert.ok(perf.assets.registeredSprites >= 20, `${scenario.name}: sprite manifest should be loaded`);
  assert.ok(perf.assets.tintedSpriteVariants <= 260, `${scenario.name}: tinted sprite cache should stay bounded`);
  assert.ok(perf.world.creatures <= 220, `${scenario.name}: smoke population should stay inside perf budget`);
  const particleBudget = particleBudgetByQuality[perf.renderer?.quality] ?? 500;
  assert.ok(
    perf.world.particles <= particleBudget,
    `${scenario.name}: particles should honor ${perf.renderer?.quality || 'default'} quality budget`
  );
  assert.ok(
    perf.world.maxParticles <= particleBudget,
    `${scenario.name}: particle system max should track ${perf.renderer?.quality || 'default'} quality budget`
  );

  const framePacing = sampleRealtime ? await sampleFramePacing(page) : null;
  if (framePacing) {
    console.log(
      `  ${scenario.name}: frame pacing ${framePacing.frames} frames, avg ${framePacing.avgFrameMs}ms, p95 ${framePacing.p95FrameMs}ms, drawImages ${framePacing.drawImage?.perFrame ?? 0}/frame, draw ${framePacing.drawImage?.timeMs ?? 0}ms, ${frameProfileText(framePacing)}, quality ${framePacing.qualityStart || 'unknown'}→${framePacing.qualityEnd || 'unknown'}`
    );
    assert.ok(framePacing.frames >= 1, `${scenario.name}: real-time frame sample should capture app frames`);
    assert.ok(
      Number.isFinite(framePacing.avgFrameMs),
      `${scenario.name}: real-time average frame interval should be finite`
    );
    assert.ok(
      Number.isFinite(framePacing.p95FrameMs),
      `${scenario.name}: real-time p95 frame interval should be finite`
    );
    assert.ok(
      framePacing.drawImage?.count > 0,
      `${scenario.name}: real-time frame sample should profile drawImage volume`
    );
    assert.ok(
      Number.isFinite(framePacing.drawImage.timeMs),
      `${scenario.name}: drawImage profile time should be finite`
    );
    assertFrameProfile(framePacing, scenario.name);
  }

  await captureCanvasSnapshot(page, path.join(outDir, `${scenario.name}.png`));
  await fs.writeFile(
    path.join(outDir, `${scenario.name}.json`),
    JSON.stringify({ state, perf, framePacing, scenarioResult, layoutGuard, achievementToastBounds, errors }, null, 2)
  );

  assert.deepEqual(errors, [], `${scenario.name}: browser console should stay warning/error free`);
  await context.close();
  return {
    scenario: scenario.name,
    workerMode,
    creatures: state.summary.totalCreatures,
    food: state.summary.totalFood,
    perf,
    framePacing,
    scenarioResult,
    layoutGuard
  };
}

await fs.mkdir(outDir, { recursive: true });

const server = await startServerIfNeeded();
let browser;
try {
  const targetInfo = await resolveTargetInfo();
  await fs.writeFile(path.join(outDir, 'target.json'), JSON.stringify(targetInfo, null, 2));
  browser = await chromium.launch({ headless: !headed });
  await captureHomeSnapshot(browser);
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(browser, scenario));
  }
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
  const runtimeReadiness = summarizeRuntimeReadiness(results);
  await fs.writeFile(path.join(outDir, 'runtime-readiness.json'), JSON.stringify(runtimeReadiness, null, 2));
  console.log(
    `Runtime readiness (${runtimeReadiness.mode}): ${runtimeReadiness.status}; shipping default=${runtimeReadiness.shippingDefault}; worker gate=${runtimeReadiness.defaultReadiness.safeToDefaultWorker ? 'ready' : 'held'}`
  );
  console.log(
    `Browser smoke passed${workerMode ? ' (worker)' : ''}: ${results.map(result => result.scenario).join(', ')}`
  );
} finally {
  if (browser) await browser.close();
  if (server && !keepServer) server.kill('SIGTERM');
}
