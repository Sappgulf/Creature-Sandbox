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
const outDir = path.join(repoRoot, 'output', 'browser-smoke');
const headed = process.argv.includes('--headed');
const keepServer = process.argv.includes('--keep-server');
const explicitPort = process.env.CREATURE_SMOKE_PORT != null;
const explicitBaseUrl = process.env.CREATURE_SMOKE_URL != null;
let port = Number(process.env.CREATURE_SMOKE_PORT || 4173);
let baseUrl = process.env.CREATURE_SMOKE_URL || `http://127.0.0.1:${port}`;

const scenarios = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'mobile-compact', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'mobile-large', viewport: { width: 430, height: 932 }, mobile: true }
];

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
        const appOk = body.includes('Creature Sandbox') && body.includes('./src/main.js');
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

async function startServerIfNeeded() {
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
    console.log(`Browser smoke: port ${previousPort} is serving another app; using ${port}`);
  }

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

async function assertNoInvalidVisibleText(page, scenarioName) {
  const visibleText = await page.locator('body').innerText({ timeout: 5000 });
  assert.doesNotMatch(
    visibleText,
    /\b(?:NaN|undefined)\b/,
    `${scenarioName}: visible UI should not expose invalid values`
  );
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
  await assertNoInvalidVisibleText(page, scenario.name);
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-clean.png`) });

  const director = await page.evaluate(() => window.__creatureSmoke.startScenario('first_ecosystem'));
  const playable = director?.playable || director;
  assert.ok(playable?.active, `${scenario.name}: playable scenario should start`);
  assert.equal(playable.scenario.id, 'first_ecosystem', `${scenario.name}: playable scenario id should be reflected`);
  assert.ok((director?.objectives?.cards?.length || 0) >= 2, `${scenario.name}: director should expose objective cards`);
  await advance(page, 600);
  state = await readGameState(page);
  assert.ok(state.playable?.active, `${scenario.name}: text state should include playable scenario`);
  assert.ok(state.director?.objectives?.cards?.length >= 2, `${scenario.name}: text state should include director objectives`);
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
  assert.equal(state.ui.selectedId, state.selectedCreature.id, `${scenario.name}: text state should expose the selected creature id`);
  assert.equal(state.selectedCreature.isSelected, true, `${scenario.name}: selected creature payload should mark selected creature`);
  assert.equal(state.selectedCreature.isFavorite, false, `${scenario.name}: selecting should not silently favorite the creature`);
  assert.equal(Number.isFinite(state.selectedCreature.needs?.curiosity), true, `${scenario.name}: curiosity should be a finite selected-creature metric`);
  assert.ok(state.selectedCreature.story?.reason, `${scenario.name}: selected creature payload should explain current behavior`);
  assert.equal(state.selectedCreature.affordances?.canFavorite, true, `${scenario.name}: selected creature payload should expose favorite affordance`);
  assert.doesNotMatch(
    await page.locator('#selected-info').textContent(),
    /\bNaN\b/,
    `${scenario.name}: selected creature card should never render NaN`
  );
  await assertNoInvalidVisibleText(page, scenario.name);
  if (scenario.mobile) {
    const favoriteResult = await page.evaluate(() => window.__creatureSmoke.toggleSelectedFavorite());
    assert.equal(favoriteResult.ok, true, `${scenario.name}: smoke favorite fallback should favorite the selected creature`);
  } else {
    await page.locator('#inspector:not(.hidden)').waitFor({ state: 'visible', timeout: 5000 });
    assert.match(
      await page.locator('#btn-pin').textContent(),
      /Favorite/,
      `${scenario.name}: inspector should label the favorite action truthfully`
    );
    await page.locator('#btn-pin').click();
  }
  await advance(page, 120);
  state = await readGameState(page);
  assert.equal(state.ui.favoriteCreatureId, state.selectedCreature.id, `${scenario.name}: favorite action should set favorite creature id`);
  assert.equal(state.selectedCreature.isFavorite, true, `${scenario.name}: selected payload should reflect favorite state after action`);
  if (!scenario.mobile) {
    assert.match(
      await page.locator('#btn-pin').textContent(),
      /Unfavorite/,
      `${scenario.name}: favorite action should become reversible after activation`
    );
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
    assert.ok(
      overflowBox.width <= 500,
      `${scenario.name}: desktop overflow menu should stay compact`
    );
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
  await page.locator('[data-action="props"]').click();
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
  await assertNoInvalidVisibleText(page, scenario.name);
  await page.screenshot({ path: path.join(outDir, `${scenario.name}-god.png`) });

  console.log(`  ${scenario.name}: moments and god tools`);
  await page.locator('#watch-moments').click();
  await page.locator('#moments-panel').waitFor({ state: 'visible', timeout: 5000 });
  await advance(page, 240);
  state = await readGameState(page);
  assert.ok(state.moments.count >= 1, `${scenario.name}: moments panel should have recorded scenario moments`);
  assert.ok(state.moments.summary?.peakPopulation >= state.summary.totalCreatures, `${scenario.name}: moments summary should track population`);
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
    const toolState = await page.evaluate((nextTool) => window.__creatureSmoke.setGodTool(nextTool), tool);
    assert.equal(toolState.active, true, `${scenario.name}: god tool ${tool} should activate god mode`);
    assert.equal(toolState.tool, tool, `${scenario.name}: god tool ${tool} should be reflected in smoke state`);
    assert.ok(toolState.hint.toLowerCase().includes(tool), `${scenario.name}: god tool ${tool} should update the panel hint`);
    await clickWorld(page, actionPoint.x, actionPoint.y, { touch: scenario.mobile });
    await advance(page, 260);
  }
  state = await readGameState(page);
  assert.ok(state.summary.totalFood >= beforeGod.food, `${scenario.name}: god food should preserve or increase food`);
  assert.ok(state.systems.calmZones >= beforeGod.calmZones, `${scenario.name}: god calm should add calm coverage`);
  assert.ok(state.systems.chaosNudge >= beforeGod.chaosNudge, `${scenario.name}: god chaos should register a nudge`);
  assert.ok(state.summary.totalProps >= beforeGod.props, `${scenario.name}: god prop/remove should leave prop accounting valid`);

  console.log(`  ${scenario.name}: save/load and perf`);
  const roundTrip = await page.evaluate(() => window.__creatureSmoke.saveRoundTrip());
  assert.equal(roundTrip.ok, true, `${scenario.name}: save/load roundtrip should report ok`);
  assert.ok(roundTrip.after.creatures >= beforeSpawn, `${scenario.name}: roundtrip should preserve creatures`);
  assert.ok(roundTrip.after.food >= beforeFood, `${scenario.name}: roundtrip should preserve food`);
  assert.equal(roundTrip.after.playable, 'first_ecosystem', `${scenario.name}: roundtrip should preserve active playable scenario`);
  assert.ok(roundTrip.after.metadata?.scenario?.id === 'first_ecosystem', `${scenario.name}: roundtrip metadata should expose scenario preview`);

  const slotPreview = await page.evaluate(() => window.__creatureSmoke.saveSlotPreview(1));
  assert.equal(slotPreview.ok, true, `${scenario.name}: save slot preview should be readable`);
  assert.equal(slotPreview.info.preview.scenario.id, 'first_ecosystem', `${scenario.name}: slot preview should include scenario`);
  assert.ok(slotPreview.info.preview.population >= beforeSpawn, `${scenario.name}: slot preview should include population`);
  assert.match(slotPreview.info.preview.thumbnail || '', /^data:image\/png;base64,/, `${scenario.name}: slot preview should include a canvas thumbnail`);

  const upgrades = await page.evaluate(() => {
    const recipeOk = window.__creatureSmoke.applyRecipe('peaceful_meadow');
    const mode = window.__creatureSmoke.setReadabilityMode('contrast');
    const follow = window.__creatureSmoke.setFollowMode('youngest');
    const postcard = window.__creatureSmoke.createPostcard();
    const balance = window.__creatureSmoke.runBalanceProbe(120);
    const nicknameOk = window.__creatureSmoke.setSelectedNickname('Scout');
    const actionOk = window.__creatureSmoke.runUpgradeAction('paint_food');
    return { recipeOk, mode, follow, postcard, balance, nicknameOk, actionOk, state: window.__creatureSmoke.upgradeState() };
  });
  assert.equal(upgrades.recipeOk, true, `${scenario.name}: sandbox recipe should apply`);
  assert.equal(upgrades.mode.readabilityMode, 'contrast', `${scenario.name}: readability mode should update smoke state`);
  assert.equal(upgrades.follow.ok, true, `${scenario.name}: follow mode should select a creature`);
  assert.ok(upgrades.postcard.population > 0, `${scenario.name}: postcard should include population`);
  assert.equal(typeof upgrades.balance.pass, 'boolean', `${scenario.name}: balance probe should report pass/fail`);
  assert.equal(upgrades.nicknameOk, true, `${scenario.name}: selected creature nickname should save`);
  assert.equal(upgrades.actionOk, true, `${scenario.name}: upgrade action card should run`);
  assert.ok(upgrades.state.recipes.length >= 4, `${scenario.name}: upgrade state should expose recipe presets`);

  const perf = await page.evaluate(() => window.__creatureSmoke.perfBudget());
  assert.ok(perf.canvas.width > 0 && perf.canvas.height > 0, `${scenario.name}: canvas should be measurable`);
  assert.ok(perf.rendered > 0, `${scenario.name}: smoke perf should report live rendered objects`);
  assert.ok(perf.totalObjects >= perf.rendered, `${scenario.name}: smoke perf total should cover rendered objects`);
  assert.equal(perf.rendered, perf.renderer.rendered, `${scenario.name}: smoke rendered count should come from renderer stats`);
  assert.equal(perf.culled, perf.renderer.culled, `${scenario.name}: smoke culled count should come from renderer stats`);
  assert.equal(perf.timing?.mode, 'deterministic-step', `${scenario.name}: smoke perf should label deterministic timing`);
  assert.ok(perf.timing.advanceCalls > 0, `${scenario.name}: smoke perf should count deterministic advances`);
  assert.ok(Number.isFinite(perf.timing.frameTimeMs), `${scenario.name}: smoke perf should expose finite sampled frame time`);
  assert.ok(perf.assets.registeredSprites >= 20, `${scenario.name}: sprite manifest should be loaded`);
  assert.ok(perf.assets.tintedSpriteVariants <= 260, `${scenario.name}: tinted sprite cache should stay bounded`);
  assert.ok(perf.world.creatures <= 220, `${scenario.name}: smoke population should stay inside perf budget`);

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
  await captureHomeSnapshot(browser);
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
