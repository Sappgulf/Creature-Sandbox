import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'output', 'realtime-smoke');
const keepServer = process.argv.includes('--keep-server');
const headed = process.argv.includes('--headed');
const explicitPort = process.env.CREATURE_SMOKE_PORT != null;
const explicitBaseUrl = process.env.CREATURE_SMOKE_URL != null;
let port = Number(process.env.CREATURE_SMOKE_PORT || 4173);
let baseUrl = process.env.CREATURE_SMOKE_URL || `http://127.0.0.1:${port}`;

const durationMs = Number(process.env.CREATURE_REALTIME_SMOKE_MS || 6500);
const minFps = Number(process.env.CREATURE_REALTIME_MIN_FPS || 18);
const maxFrameTimeMs = Number(process.env.CREATURE_REALTIME_MAX_FRAME_MS || 85);
const reusePreviewBuild = process.env.CREATURE_REALTIME_REUSE_BUILD === '1';

function probeServer(url) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (body.length < 4096) body += chunk;
      });
      res.on('end', () => {
        const statusOk = res.statusCode >= 200 && res.statusCode < 500;
        const appOk = body.includes('Creature Sandbox') &&
          body.includes('/assets/') &&
          !body.includes('/@vite/client');
        finish({ reachable: true, statusOk, appOk, statusCode: res.statusCode, body });
      });
    });
    req.on('error', (error) => finish({
      reachable: false,
      statusOk: false,
      appOk: false,
      error: error.code || error.message
    }));
    req.setTimeout(800, () => {
      req.destroy();
      finish({
        reachable: false,
        statusOk: false,
        appOk: false,
        error: 'timeout'
      });
    });
  });
}

async function requestOk(url) {
  const probe = await probeServer(url);
  return probe.statusOk && probe.appOk;
}

function canListen(candidatePort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(candidatePort, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) {
  for (let candidate = startPort; candidate < startPort + 40; candidate += 1) {
    if (await canListen(candidate)) return candidate;
  }
  throw new Error(`Could not find an available smoke port starting at ${startPort}`);
}

async function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await requestOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' }
    });
    child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
    child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

async function ensurePreviewBuild() {
  if (!reusePreviewBuild) {
    console.log('Realtime smoke: building production preview assets');
    await runCommand('npm', ['run', 'build'], 'build');
    return;
  }

  try {
    await fs.access(path.join(repoRoot, 'dist', 'index.html'));
    await fs.access(path.join(repoRoot, 'dist', 'sw.js'));
    await fs.access(path.join(repoRoot, 'dist', 'assets', 'sprites', 'sprite-manifest.json'));
  } catch {
    console.log('Realtime smoke: cached preview build missing required assets; rebuilding');
    await runCommand('npm', ['run', 'build'], 'build');
  }
}

async function startServerIfNeeded() {
  if (!explicitBaseUrl) {
    await ensurePreviewBuild();
  }

  const probe = await probeServer(baseUrl);
  if (probe.statusOk && probe.appOk) return null;

  if (explicitBaseUrl) {
    throw new Error(`CREATURE_SMOKE_URL did not serve Creature Sandbox at ${baseUrl}`);
  }

  if (probe.reachable && !probe.appOk) {
    if (explicitPort) {
      throw new Error(`CREATURE_SMOKE_PORT ${port} is reachable but is not serving Creature Sandbox`);
    }
    const previousPort = port;
    port = await findAvailablePort(port + 1);
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Realtime smoke: port ${previousPort} is serving another app; using ${port}`);
  }

  const child = spawn(
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' }
    }
  );

  child.stdout.on('data', (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[preview] ${chunk}`));

  const ready = await waitForServer(baseUrl);
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`Timed out waiting for dev server at ${baseUrl}`);
  }
  return child;
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

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out during ${label} after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function readGameState(page) {
  return JSON.parse(await withTimeout(
    page.evaluate(() => window.render_game_to_text?.() || '{}'),
    4000,
    'read game state'
  ));
}

async function collectPerfSamples(page, sampleCount = 5, spacingMs = 1000) {
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    console.log(`Realtime smoke: perf sample ${index + 1}/${sampleCount}`);
    await page.waitForTimeout(spacingMs);
    samples.push(await withTimeout(
      page.evaluate(() => window.__creatureSmoke.perfBudget()),
      4000,
      `perf sample ${index + 1}`
    ));
  }
  return samples;
}

async function verifyOfflineReload(page) {
  console.log('Realtime smoke: verifying service worker install');
  await page.waitForLoadState('load', { timeout: 12000 });
  const registrationState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return { supported: false };
    }
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) {
      await navigator.serviceWorker.register('./sw.js');
    }
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('service-worker-ready-timeout')), 8000))
    ]);
    await new Promise((resolve) => {
      if (navigator.serviceWorker.controller) {
        resolve();
        return;
      }
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
      setTimeout(resolve, 4000);
    });
    const cacheKeys = 'caches' in window ? await caches.keys() : [];
    return {
      supported: true,
      active: !!registration.active,
      controller: !!navigator.serviceWorker.controller,
      scope: registration.scope,
      cacheKeys
    };
  });

  assert.equal(registrationState.supported, true, 'service workers should be supported in Chromium smoke');
  assert.equal(registrationState.active, true, 'service worker should become active');
  assert.ok(registrationState.cacheKeys.some(key => key.startsWith('creature-sandbox-')), 'service worker should create Creature Sandbox caches');

  console.log('Realtime smoke: verifying online service-worker reload');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 });
  await waitForPageCondition(page, () => typeof window.__creatureSmoke?.perfBudget === 'function', 'smoke hooks after online SW reload');
  await waitForPageCondition(page, () => {
    const state = JSON.parse(window.render_game_to_text?.() || '{}');
    return Number(state.systems?.registeredSprites || 0) >= 20;
  }, 'sprite assets cached after online SW reload', 15000);
  console.log('Realtime smoke: verifying offline app shell reload');
  await page.context().setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 });
    await waitForPageCondition(page, () => typeof window.render_game_to_text === 'function', 'offline app shell');
    const title = await page.title();
    assert.match(title, /Creature Sandbox/i, 'offline reload should preserve app document title');
  } finally {
    await page.context().setOffline(false);
  }

  return registrationState;
}

await fs.mkdir(outDir, { recursive: true });

const server = await startServerIfNeeded();
let browser;
try {
  browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    serviceWorkers: 'allow'
  });
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      errors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (error) => {
    errors.push({ type: 'pageerror', text: error.message });
  });

  const url = `${baseUrl}/?smoke=1&realtime=1&v=${Date.now()}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
  await waitForPageCondition(page, () => typeof window.render_game_to_text === 'function', 'render_game_to_text');
  await waitForPageCondition(page, () => typeof window.__creatureSmoke?.perfBudget === 'function', 'perf budget hook');
  await waitForPageCondition(page, () => {
    const state = JSON.parse(window.render_game_to_text());
    return state.ui && state.ui.homeVisible === false && state.summary.totalCreatures > 0;
  }, 'seeded realtime world');
  await page.evaluate(() => window.__creatureSmoke?.setPaused?.(false));

  console.log(`Realtime smoke: sampling ${durationMs}ms animation-frame run`);
  await page.waitForTimeout(Math.max(0, durationMs - 5000));
  const samples = await collectPerfSamples(page, 5, 1000);
  const finalState = await readGameState(page);
  const finalPerf = samples.at(-1);
  const sampledFps = samples.map(sample => Number(sample.timing?.sampledFps || sample.fps || 0)).filter(Number.isFinite);
  const frameTimes = samples.map(sample => Number(sample.timing?.frameTimeMs || 0)).filter(Number.isFinite);
  const averageFps = sampledFps.reduce((sum, value) => sum + value, 0) / Math.max(1, sampledFps.length);
  const worstFrameTime = Math.max(...frameTimes, 0);

  assert.equal(finalPerf.timing.mode, 'animation-frame', 'realtime smoke should measure animation-frame timing');
  assert.equal(finalPerf.timing.advanceCalls, 0, 'realtime smoke should not use deterministic advanceTime');
  assert.ok(averageFps >= minFps, `average sampled FPS should stay >= ${minFps}; got ${averageFps.toFixed(1)}`);
  assert.ok(worstFrameTime <= maxFrameTimeMs, `sampled frame time should stay <= ${maxFrameTimeMs}ms; got ${worstFrameTime.toFixed(1)}ms`);
  assert.ok(finalPerf.rendered > 0, 'realtime smoke should render live objects');
  assert.ok(finalPerf.assets.registeredSprites >= 20, 'sprite manifest should load during realtime smoke');
  assert.ok(finalState.summary.totalCreatures > 0, 'realtime world should keep creatures alive');
  assert.equal(finalState.ui.homeVisible, false, 'realtime smoke should run in the sandbox');

  const serviceWorker = await withTimeout(verifyOfflineReload(page), 40000, 'service-worker offline verification');
  await page.screenshot({ path: path.join(outDir, 'realtime-desktop.png') });
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify({
    url,
    durationMs,
    thresholds: { minFps, maxFrameTimeMs },
    averageFps: Number(averageFps.toFixed(1)),
    worstFrameTime: Number(worstFrameTime.toFixed(1)),
    serviceWorker,
    finalState,
    finalPerf,
    samples,
    errors
  }, null, 2));

  assert.deepEqual(errors, [], 'realtime browser console should stay warning/error free');
  await context.close();
  console.log(`Realtime smoke passed: avg=${averageFps.toFixed(1)}fps worstFrame=${worstFrameTime.toFixed(1)}ms`);
} finally {
  if (browser) await browser.close();
  if (server && !keepServer) server.kill('SIGTERM');
}
