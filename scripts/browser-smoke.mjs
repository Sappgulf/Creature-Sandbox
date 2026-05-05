import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'output', 'browser-smoke');
const headed = process.argv.includes('--headed');
const keepServer = process.argv.includes('--keep-server');
const port = Number(process.env.CREATURE_SMOKE_PORT || 4173);
const baseUrl = process.env.CREATURE_SMOKE_URL || `http://127.0.0.1:${port}`;

const scenarios = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'mobile-compact', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'mobile-large', viewport: { width: 430, height: 932 }, mobile: true }
];

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (body.length < 4096) body += chunk;
      });
      res.on('end', () => {
        const statusOk = res.statusCode >= 200 && res.statusCode < 500;
        const appOk = body.includes('Creature Sandbox') && body.includes('./src/main.js');
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

async function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await requestOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function startServerIfNeeded() {
  if (await requestOk(baseUrl)) return null;

  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' }
    }
  );

  child.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));

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
    await page.evaluate((stepMs) => window.advanceTime?.(stepMs), duration);
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

async function clickWorld(page, x, y) {
  const canvas = page.locator('#view');
  const box = await canvas.boundingBox();
  assert.ok(box, 'canvas should have a bounding box');
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

async function runScenario(browser, scenario) {
  console.log(`Browser smoke: ${scenario.name}`);
  const context = await browser.newContext({
    viewport: scenario.viewport,
    isMobile: scenario.mobile,
    hasTouch: scenario.mobile,
    deviceScaleFactor: scenario.mobile ? 2 : 1
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

  const url = `${baseUrl}/?smoke=1&v=${Date.now()}-${scenario.name}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
  await waitForPageCondition(page, () => typeof window.render_game_to_text === 'function', 'render_game_to_text');
  await waitForPageCondition(page, () => typeof window.__creatureSmoke?.saveRoundTrip === 'function', 'creature smoke hooks');
  await waitForPageCondition(page, () => {
    const state = JSON.parse(window.render_game_to_text());
    return state.ui && state.ui.homeVisible === false && state.summary.totalCreatures > 0;
  }, 'seeded smoke world');
  await page.evaluate(() => window.__creatureSmoke?.setPaused?.(true));

  console.log(`  ${scenario.name}: startup`);
  await advance(page, 900);
  let state = await readGameState(page);
  assert.equal(state.ui.homeVisible, false, `${scenario.name}: home should be hidden for smoke`);
  assert.equal(state.ui.mobileLayout, scenario.mobile, `${scenario.name}: mobile layout should match viewport`);
  assert.ok(state.summary.totalCreatures >= (scenario.mobile ? 35 : 55), `${scenario.name}: should seed creatures`);
  assert.ok(state.summary.totalFood >= (scenario.mobile ? 120 : 200), `${scenario.name}: should seed food`);
  assert.ok(state.visibleCreatures.length > 0, `${scenario.name}: should report visible creatures`);

  const playable = await page.evaluate(() => window.__creatureSmoke.startScenario('first_ecosystem'));
  assert.ok(playable?.active, `${scenario.name}: playable scenario should start`);
  assert.equal(playable.scenario.id, 'first_ecosystem', `${scenario.name}: playable scenario id should be reflected`);
  await advance(page, 600);
  state = await readGameState(page);
  assert.ok(state.playable?.active, `${scenario.name}: text state should include playable scenario`);
  assert.ok(state.playable.director?.nextAction, `${scenario.name}: director should provide a next action`);
  assert.ok(state.playable.metrics.alive >= 25, `${scenario.name}: scenario should seed a viable population`);
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

  console.log(`  ${scenario.name}: spawn`);
  const beforeSpawn = state.summary.totalCreatures;
  await page.locator('#ctrl-spawn').click();
  await page.locator('.spawn-card[data-creature="predator"]').click();
  await page.locator('#spawn-drawer-confirm').click();
  await clickWorld(page, scenario.viewport.width * 0.5, scenario.viewport.height * 0.45);
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
    assert.ok(
      overflowBox.width <= 500,
      `${scenario.name}: desktop overflow menu should stay compact`
    );
  }
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-overflow.png`) });
  await page.locator('#menu-food').click();
  await clickWorld(page, scenario.viewport.width * 0.54, scenario.viewport.height * 0.48);
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
  await page.locator('#overflow-drawer-close').click();

  console.log(`  ${scenario.name}: watch and god`);
  await page.locator('#ctrl-watch').click();
  await advance(page, 240);
  state = await readGameState(page);
  assert.equal(state.ui.watchMode, true, `${scenario.name}: watch mode should toggle on`);
  await page.locator('#watch-strip').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#watch-god-mode').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#watch-god-mode').click();
  await advance(page, 240);
  state = await readGameState(page);
  assert.equal(state.ui.godMode, true, `${scenario.name}: god mode should toggle from watch strip`);

  console.log(`  ${scenario.name}: save/load and perf`);
  const roundTrip = await page.evaluate(() => window.__creatureSmoke.saveRoundTrip());
  assert.equal(roundTrip.ok, true, `${scenario.name}: save/load roundtrip should report ok`);
  assert.ok(roundTrip.after.creatures >= beforeSpawn, `${scenario.name}: roundtrip should preserve creatures`);
  assert.ok(roundTrip.after.food >= beforeFood, `${scenario.name}: roundtrip should preserve food`);

  const perf = await page.evaluate(() => window.__creatureSmoke.perfBudget());
  assert.ok(perf.canvas.width > 0 && perf.canvas.height > 0, `${scenario.name}: canvas should be measurable`);
  assert.ok(perf.assets.registeredSprites >= 20, `${scenario.name}: sprite manifest should be loaded`);

  await captureCanvasSnapshot(page, path.join(outDir, `${scenario.name}.png`));
  await fs.writeFile(path.join(outDir, `${scenario.name}.json`), JSON.stringify({ state, perf, errors }, null, 2));

  assert.deepEqual(errors, [], `${scenario.name}: browser console should stay warning/error free`);
  await context.close();
  return { scenario: scenario.name, creatures: state.summary.totalCreatures, food: state.summary.totalFood, perf };
}

await fs.mkdir(outDir, { recursive: true });

const server = await startServerIfNeeded();
let browser;
try {
  browser = await chromium.launch({ headless: !headed });
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(browser, scenario));
  }
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(`Browser smoke passed: ${results.map(result => result.scenario).join(', ')}`);
} finally {
  if (browser) await browser.close();
  if (server && !keepServer) server.kill('SIGTERM');
}
