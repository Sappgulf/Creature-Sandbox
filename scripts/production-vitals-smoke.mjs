import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(repoRoot, process.env.CREATURE_VITALS_OUT_DIR || path.join('output', 'production-vitals'));
const baseUrl = process.env.CREATURE_VITALS_URL || 'https://creature-sandbox.vercel.app';

const contexts = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false },
  { name: 'mobile-compact', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }
];

const budgets = {
  seededWorldMs: 8000,
  firstContentfulPaintMs: 3000,
  largestContentfulPaintMs: 5000,
  cumulativeLayoutShift: 0.1,
  longTaskTotalMs: 350,
  registeredSprites: 20
};

function httpClientFor(url) {
  return new URL(url).protocol === 'https:' ? https : http;
}

function requestOk(url) {
  return new Promise((resolve) => {
    let client;
    try {
      client = httpClientFor(url);
    } catch {
      resolve(false);
      return;
    }

    const req = client.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        if (body.length < 8192) body += chunk;
      });
      res.on('end', () => {
        const statusOk = res.statusCode >= 200 && res.statusCode < 500;
        const builtEntryOk = /<script[^>]+src=["']\/assets\/[^"']+\.js/.test(body) ||
          body.includes('/assets/index-');
        resolve(statusOk && body.includes('Creature Sandbox') && builtEntryOk);
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function requestJson(url) {
  return new Promise((resolve) => {
    let client;
    try {
      client = httpClientFor(url);
    } catch {
      resolve(null);
      return;
    }

    const req = client.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
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
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function waitForPageCondition(page, condition, label, timeoutMs = 15000) {
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

async function readGameState(page) {
  const text = await page.evaluate(() => window.render_game_to_text?.() || '{}');
  return JSON.parse(text);
}

async function collectVitals(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paintEntries = performance.getEntriesByType('paint');
    const paintByName = Object.fromEntries(
      paintEntries.map((entry) => [entry.name, Number(entry.startTime.toFixed(1))])
    );
    const vitals = window.__creatureVitals || {};
    const lcp = Number.isFinite(vitals.lcp) && vitals.lcp > 0 ? Number(vitals.lcp.toFixed(1)) : null;
    const cls = Number.isFinite(vitals.cls) ? Number(vitals.cls.toFixed(4)) : 0;
    const longTasks = Array.isArray(vitals.longTasks) ? vitals.longTasks.slice(0, 12) : [];
    const longTaskTotalMs = longTasks.reduce((total, entry) => total + Number(entry.duration || 0), 0);
    const domContentLoadedMs = navigation
      ? Number((navigation.domContentLoadedEventEnd - navigation.startTime).toFixed(1))
      : null;
    const loadEventMs = navigation && navigation.loadEventEnd > 0
      ? Number((navigation.loadEventEnd - navigation.startTime).toFixed(1))
      : null;

    return {
      firstPaintMs: paintByName['first-paint'] ?? null,
      firstContentfulPaintMs: paintByName['first-contentful-paint'] ?? vitals.fcp ?? null,
      largestContentfulPaintMs: lcp,
      cumulativeLayoutShift: cls,
      longTaskTotalMs: Number(longTaskTotalMs.toFixed(1)),
      longTasks,
      domContentLoadedMs,
      loadEventMs
    };
  });
}

function summarizeState(state) {
  return {
    homeVisible: state.ui?.homeVisible ?? null,
    totalCreatures: state.summary?.totalCreatures ?? null,
    totalFood: state.summary?.totalFood ?? null,
    workerMode: state.systems?.workerMode ?? null,
    workerReady: state.systems?.workerReady ?? null,
    workerPendingMessages: state.systems?.workerPendingMessages ?? null,
    registeredSprites: state.systems?.registeredSprites ?? null,
    scalarFieldStepInterval: state.systems?.scalarFieldStepInterval ?? null,
    canvas: state.perf?.canvas ?? null
  };
}

function assertContext(result) {
  const fcp = Number(result.vitals.firstContentfulPaintMs);
  assert.equal(result.consoleMessages.length, 0, `${result.name}: browser console should stay warning/error free`);
  assert.equal(result.state.homeVisible, false, `${result.name}: smoke mode should skip the home screen`);
  assert.ok(Number(result.state.totalCreatures || 0) > 0, `${result.name}: seeded world should contain creatures`);
  assert.equal(result.state.workerMode, true, `${result.name}: production should use worker runtime`);
  assert.equal(result.state.workerReady, true, `${result.name}: worker runtime should be ready`);
  assert.equal(Number(result.state.workerPendingMessages || 0), 0, `${result.name}: worker queue should drain`);
  assert.ok(
    Number(result.state.registeredSprites || 0) >= budgets.registeredSprites,
    `${result.name}: production should register sprite assets`
  );
  assert.ok(Number.isFinite(fcp) && fcp <= budgets.firstContentfulPaintMs, `${result.name}: FCP should stay inside budget`);
  if (result.vitals.largestContentfulPaintMs != null) {
    assert.ok(
      result.vitals.largestContentfulPaintMs <= budgets.largestContentfulPaintMs,
      `${result.name}: LCP should stay inside budget`
    );
  }
  assert.ok(
    result.vitals.cumulativeLayoutShift <= budgets.cumulativeLayoutShift,
    `${result.name}: CLS should stay inside budget`
  );
  assert.ok(
    result.vitals.longTaskTotalMs <= budgets.longTaskTotalMs,
    `${result.name}: long tasks should stay inside budget`
  );
  assert.ok(result.seededWorldMs <= budgets.seededWorldMs, `${result.name}: seeded world should be ready quickly`);
}

async function runContext(browser, target, contextConfig) {
  console.log(`Production vitals smoke: ${contextConfig.name}`);
  const context = await browser.newContext({
    viewport: contextConfig.viewport,
    deviceScaleFactor: contextConfig.deviceScaleFactor,
    isMobile: contextConfig.isMobile,
    hasTouch: contextConfig.isMobile
  });
  await context.addInitScript(() => {
    window.__creatureVitals = {
      fcp: null,
      lcp: null,
      cls: 0,
      longTasks: []
    };

    const observe = (type, handler) => {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) handler(entry);
        });
        observer.observe({ type, buffered: true });
      } catch {
        // Browser support differs by entry type; missing optional observers do not
        // block the vitals lane as long as the required timing metrics are present.
      }
    };

    observe('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        window.__creatureVitals.fcp = entry.startTime;
      }
    });
    observe('largest-contentful-paint', (entry) => {
      window.__creatureVitals.lcp = entry.startTime;
    });
    observe('layout-shift', (entry) => {
      if (!entry.hadRecentInput) window.__creatureVitals.cls += entry.value || 0;
    });
    observe('longtask', (entry) => {
      window.__creatureVitals.longTasks.push({
        name: entry.name,
        startTime: Number(entry.startTime.toFixed(1)),
        duration: Number(entry.duration.toFixed(1))
      });
    });
  });

  const page = await context.newPage();
  const consoleMessages = [];
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', (error) => {
    consoleMessages.push({ type: 'pageerror', text: error.message });
  });

  const url = `${target.baseUrl}/?smoke=1&v=production-vitals-${Date.now()}-${contextConfig.name}`;
  const navigationStarted = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitForPageCondition(page, () => typeof window.render_game_to_text === 'function', 'render_game_to_text');
  await waitForPageCondition(page, () => {
    const state = JSON.parse(window.render_game_to_text());
    return state.ui?.homeVisible === false &&
      state.summary?.totalCreatures > 0 &&
      state.systems?.workerReady === true &&
      Number(state.systems?.workerPendingMessages || 0) === 0 &&
      Number(state.systems?.registeredSprites || 0) >= 20;
  }, 'production seeded worker world');
  const seededWorldMs = Date.now() - navigationStarted;
  await page.waitForTimeout(1800);

  const state = await readGameState(page);
  const vitals = await collectVitals(page);
  const screenshotPath = path.join(outDir, `${contextConfig.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const result = {
    name: contextConfig.name,
    viewport: contextConfig.viewport,
    seededWorldMs,
    vitals,
    state: summarizeState(state),
    consoleMessages,
    screenshot: path.relative(repoRoot, screenshotPath)
  };
  console.log(
    `  ${contextConfig.name}: FCP ${vitals.firstContentfulPaintMs ?? 'n/a'}ms, ` +
    `LCP ${vitals.largestContentfulPaintMs ?? 'n/a'}ms, CLS ${vitals.cumulativeLayoutShift}, ` +
    `long tasks ${vitals.longTaskTotalMs}ms, ready ${seededWorldMs}ms`
  );
  assertContext(result);
  await context.close();
  return result;
}

await fs.mkdir(outDir, { recursive: true });
const appOk = await requestOk(baseUrl);
if (!appOk) {
  throw new Error(`Expected production Creature Sandbox at ${baseUrl}, but it did not respond with a built app.`);
}

const buildInfoUrl = new URL('build-info.json', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
const target = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  buildInfoUrl,
  buildInfo: await requestJson(buildInfoUrl)
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const contextConfig of contexts) {
    results.push(await runContext(browser, target, contextConfig));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    passed: true,
    target,
    budgets,
    contexts: results,
    aggregate: {
      maxSeededWorldMs: Math.max(...results.map((item) => item.seededWorldMs)),
      maxFirstContentfulPaintMs: Math.max(...results.map((item) => Number(item.vitals.firstContentfulPaintMs || 0))),
      maxLargestContentfulPaintMs: Math.max(...results.map((item) => Number(item.vitals.largestContentfulPaintMs || 0))),
      maxCumulativeLayoutShift: Math.max(...results.map((item) => Number(item.vitals.cumulativeLayoutShift || 0))),
      maxLongTaskTotalMs: Math.max(...results.map((item) => Number(item.vitals.longTaskTotalMs || 0)))
    }
  };

  await fs.writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(
    path.join(outDir, 'summary.md'),
    `# Production Vitals Smoke\n\n` +
    `Target: ${baseUrl}\n\n` +
    `Build SHA: ${target.buildInfo?.sha || 'unknown'}\n\n` +
    `| Context | Ready ms | FCP ms | LCP ms | CLS | Long tasks ms |\n` +
    `| --- | --- | --- | --- | --- | --- |\n` +
    results.map((item) =>
      `| ${item.name} | ${item.seededWorldMs} | ${item.vitals.firstContentfulPaintMs ?? 'n/a'} | ` +
      `${item.vitals.largestContentfulPaintMs ?? 'n/a'} | ${item.vitals.cumulativeLayoutShift} | ${item.vitals.longTaskTotalMs} |`
    ).join('\n') +
    '\n'
  );
  console.log(`Production vitals smoke passed: ${results.map((item) => item.name).join(', ')}`);
} finally {
  if (browser) await browser.close();
}
