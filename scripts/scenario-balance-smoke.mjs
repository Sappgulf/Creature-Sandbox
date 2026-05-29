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
const outDir = path.join(repoRoot, 'output', 'scenario-balance');
let port = Number(process.env.CREATURE_SCENARIO_BALANCE_PORT || 4174);
let baseUrl = process.env.CREATURE_SCENARIO_BALANCE_URL || `http://127.0.0.1:${port}`;
const reuseExternalServer = !!process.env.CREATURE_SCENARIO_BALANCE_URL;
const soakMs = resolveNumberArg('--soak-ms', process.env.CREATURE_SCENARIO_BALANCE_SOAK_MS || 75000);
const runCount = resolveRunCount();

const scenarios = [
  {
    id: 'stress_sanctuary',
    minAlive: 28,
    minFood: 135,
    maxStress: 48
  },
  {
    id: 'scavenger_bridge',
    minAlive: 38,
    minFood: 125,
    minPredators: 4,
    maxStress: 90
  }
];

function resolveRunCount() {
  const argIndex = process.argv.findIndex(arg => arg === '--runs');
  const argValue = argIndex >= 0 ? process.argv[argIndex + 1] : null;
  const inlineArg = process.argv.find(arg => arg.startsWith('--runs='));
  const raw =
    process.env.CREATURE_SCENARIO_BALANCE_RUNS ||
    (inlineArg ? inlineArg.split('=').slice(1).join('=') : null) ||
    argValue ||
    2;
  return Math.max(1, Math.floor(Number(raw) || 2));
}

function resolveNumberArg(name, fallback) {
  const argIndex = process.argv.findIndex(arg => arg === name);
  const argValue = argIndex >= 0 ? process.argv[argIndex + 1] : null;
  const inlineArg = process.argv.find(arg => arg.startsWith(`${name}=`));
  const raw = inlineArg ? inlineArg.split('=').slice(1).join('=') : argValue || fallback;
  return Math.max(1, Math.floor(Number(raw) || Number(fallback) || 1));
}

function requestOk(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        if (body.length < 4096) body += chunk;
      });
      res.on('end', () => {
        resolve(res.statusCode >= 200 && res.statusCode < 500 && body.includes('Creature Sandbox'));
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
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

async function getRandomPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = probe.address();
      const selectedPort = typeof address === 'object' && address ? address.port : null;
      probe.close(() => {
        if (!selectedPort) reject(new Error('Unable to allocate a scenario balance smoke port'));
        else resolve(selectedPort);
      });
    });
  });
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

  if (!(await canListen(port))) {
    const fallbackPort = await getRandomPort();
    console.log(`Scenario balance smoke: port ${port} is busy; using ${fallbackPort}.`);
    port = fallbackPort;
  }
  baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' }
  });
  child.stdout.on('data', chunk => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[vite] ${chunk}`));
  if (!(await waitForServer(baseUrl))) {
    child.kill('SIGTERM');
    throw new Error(`Timed out waiting for Vite at ${baseUrl}`);
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

async function advance(page, ms) {
  let remaining = Math.max(0, Number(ms) || 0);
  while (remaining > 0) {
    const step = Math.min(500, remaining);
    await page.evaluate(stepMs => window.advanceTime?.(stepMs), step);
    remaining -= step;
  }
}

async function runScenario(browser, scenario, run) {
  console.log(`Scenario balance: ${scenario.id} run ${run}/${runCount}`);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const errors = [];
  const runToken = `${scenario.id}-run-${run}-${Date.now()}`;
  const startedAt = new Date().toISOString();
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      errors.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', error => {
    errors.push({ type: 'pageerror', text: error.message });
  });

  const url = `${baseUrl}/?smoke=1&worker=0&v=scenario-balance-${runToken}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await waitForPageCondition(page, () => typeof window.render_game_to_text === 'function', 'render_game_to_text');
    await waitForPageCondition(
      page,
      () => typeof window.__creatureSmoke?.startScenario === 'function',
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

    const start = await page.evaluate(id => window.__creatureSmoke.startScenario(id), scenario.id);
    assert.equal(
      start?.playable?.scenario?.id || start?.scenario?.id,
      scenario.id,
      `${scenario.id}: scenario should start`
    );
    await advance(page, soakMs);
    const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const metrics = state.playable?.metrics || {};
    const capture = await page.evaluate(
      targetUrl => ({
        url: targetUrl,
        href: window.location.href,
        hash: window.location.hash || '',
        userAgent: navigator.userAgent
      }),
      url
    );
    console.log(
      `  ${scenario.id} run ${run}: elapsed ${Number(state.playable?.elapsed || 0).toFixed(1)}s, ` +
        `alive ${Number(metrics.alive || 0)}, food ${Number(metrics.food || 0)}, ` +
        `predators ${Number(metrics.predators || 0)}, stress ${Number(metrics.averageStress || 0).toFixed(1)}`
    );

    assert.equal(state.playable?.active, true, `${scenario.id}: scenario should remain active during balance soak`);
    assert.notEqual(state.playable?.state, 'failed', `${scenario.id}: scenario should not fail during balance soak`);
    assert.ok(
      Number(state.playable?.elapsed || 0) >= soakMs / 1000 - 5,
      `${scenario.id}: scenario clock should advance`
    );
    assert.ok(Number(metrics.alive || 0) >= scenario.minAlive, `${scenario.id}: population should stay viable`);
    assert.ok(Number(metrics.food || 0) >= scenario.minFood, `${scenario.id}: food should not collapse to zero`);
    if (scenario.minPredators) {
      assert.ok(
        Number(metrics.predators || 0) >= scenario.minPredators,
        `${scenario.id}: predators should remain viable`
      );
    }
    assert.ok(
      Number(metrics.averageStress || 0) <= scenario.maxStress,
      `${scenario.id}: stress should stay recoverable`
    );
    assert.deepEqual(errors, [], `${scenario.id}: browser console should stay warning/error free`);

    const screenshotPath = path.join(outDir, `run-${run}-${scenario.id}.png`);
    await page.screenshot({ path: screenshotPath });
    await fs.writeFile(
      path.join(outDir, `run-${run}-${scenario.id}.json`),
      JSON.stringify(
        {
          scenario,
          run,
          runToken,
          startedAt,
          soakMs,
          capture,
          state,
          errors
        },
        null,
        2
      )
    );
    return {
      id: scenario.id,
      run,
      runToken,
      startedAt,
      soakMs,
      capture,
      runtime: state.systems?.workerMode ? 'worker' : 'main',
      elapsed: Number(state.playable?.elapsed || 0),
      progress: Number(state.playable?.progress || 0),
      metrics: {
        alive: Number(metrics.alive || 0),
        food: Number(metrics.food || 0),
        predators: Number(metrics.predators || 0),
        averageStress: Number(metrics.averageStress || 0)
      },
      screenshot: path.relative(repoRoot, screenshotPath)
    };
  } catch (error) {
    const failurePath = path.join(outDir, `failure-run-${run}-${scenario.id}.png`);
    const state = await page
      .evaluate(() => {
        try {
          return JSON.parse(window.render_game_to_text?.() || '{}');
        } catch {
          return null;
        }
      })
      .catch(() => null);
    await page.screenshot({ path: failurePath }).catch(() => {});
    await fs.writeFile(
      path.join(outDir, `failure-run-${run}-${scenario.id}.json`),
      JSON.stringify(
        {
          scenario,
          run,
          runToken,
          startedAt,
          soakMs,
          url,
          error: error?.message || String(error),
          state,
          errors,
          screenshot: path.relative(repoRoot, failurePath)
        },
        null,
        2
      )
    );
    throw error;
  } finally {
    await context.close();
  }
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function metricRange(results, selector) {
  const values = results.map(selector).filter(value => Number.isFinite(value));
  if (!values.length) {
    return { min: null, max: null, mean: null };
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: Number(mean(values).toFixed(2))
  };
}

function summarizeVariance(results) {
  return scenarios.map(scenario => {
    const scenarioRuns = results.filter(result => result.id === scenario.id);
    const failedRuns = scenarioRuns
      .filter(result => {
        const metrics = result.metrics || {};
        const predatorOk = scenario.minPredators ? Number(metrics.predators || 0) >= scenario.minPredators : true;
        return (
          Number(metrics.alive || 0) < scenario.minAlive ||
          Number(metrics.food || 0) < scenario.minFood ||
          Number(metrics.averageStress || 0) > scenario.maxStress ||
          !predatorOk
        );
      })
      .map(result => result.run);

    return {
      id: scenario.id,
      runs: scenarioRuns.length,
      passRate: scenarioRuns.length
        ? Number(((scenarioRuns.length - failedRuns.length) / scenarioRuns.length).toFixed(3))
        : 0,
      failedRuns,
      alive: metricRange(scenarioRuns, result => result.metrics?.alive),
      food: metricRange(scenarioRuns, result => result.metrics?.food),
      predators: metricRange(scenarioRuns, result => result.metrics?.predators),
      averageStress: metricRange(scenarioRuns, result => result.metrics?.averageStress),
      thresholds: {
        minAlive: scenario.minAlive,
        minFood: scenario.minFood,
        minPredators: scenario.minPredators ?? null,
        maxStress: scenario.maxStress
      }
    };
  });
}

function markdownSummary({
  generatedAt,
  baseUrl: targetBaseUrl,
  runCount: runs,
  soakMs: soakDurationMs,
  results,
  variance
}) {
  const rows = results
    .map(
      item =>
        `| ${item.id} | ${item.run} | ${item.runtime} | ${item.elapsed} | ${item.metrics.alive} | ${item.metrics.food} | ${item.metrics.predators} | ${item.metrics.averageStress} | ${item.runToken} |`
    )
    .join('\n');
  const varianceRows = variance
    .map(
      item =>
        `| ${item.id} | ${item.runs} | ${item.passRate} | ${item.alive.min}-${item.alive.max} | ${item.food.min}-${item.food.max} | ${item.predators.min}-${item.predators.max} | ${item.averageStress.max} | ${item.failedRuns.length ? item.failedRuns.join(', ') : 'none'} |`
    )
    .join('\n');
  return `# Scenario Balance Summary

Generated: ${generatedAt}

Target: ${targetBaseUrl}

Runs: ${runs}

Soak: ${soakDurationMs}ms

Manual 5-run command: \`npm run smoke:scenarios:variance\`

## Runs

| Scenario | Run | Runtime | Elapsed | Alive | Food | Predators | Stress | Token |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Variance

| Scenario | Runs | Pass rate | Alive range | Food range | Predator range | Max stress | Failed runs |
| --- | --- | --- | --- | --- | --- | --- | --- |
${varianceRows}
`;
}

await fs.mkdir(outDir, { recursive: true });
const server = await startServerIfNeeded();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (let run = 1; run <= runCount; run++) {
    for (const scenario of scenarios) {
      results.push(await runScenario(browser, scenario, run));
    }
  }
  const variance = summarizeVariance(results);
  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    baseUrl,
    runs: runCount,
    soakMs,
    scenarios: results,
    variance
  };
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(
    path.join(outDir, 'summary.md'),
    markdownSummary({
      generatedAt,
      baseUrl,
      runCount,
      soakMs,
      results,
      variance
    })
  );
  for (const item of variance) {
    console.log(
      `  variance ${item.id}: runs ${item.runs}, pass ${item.passRate}, ` +
        `alive ${item.alive.min}-${item.alive.max}, food ${item.food.min}-${item.food.max}, ` +
        `predators ${item.predators.min}-${item.predators.max}, stress max ${item.averageStress.max}`
    );
  }
  console.log(`Scenario balance smoke passed: ${runCount}x ${scenarios.map(result => result.id).join(', ')}`);
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
