#!/usr/bin/env node
/**
 * Ecosystem balance probe (headless, deterministic stepping).
 *
 * Starts a New Sandbox, the Herd Rescue expedition, or any playable scenario in
 * the live dev build, then steps the simulation at its fixed dt (no rendering).
 * Sandbox runs sample population, food, hunger and death causes over a fixed
 * span. Scenario runs read the director's own outcome: complete, failed, or
 * missed at targetSeconds (plus a grace window). Used for the 2026-10-14
 * balance pass; rerun it to check any change to food, ageing, breeding,
 * scenario tuning or game modes.
 *
 * Sandbox rows also count adults, mates (adults holding a mate sense), births
 * (courtship spawns), refills (auto-balance spawns) and mean step time in ms.
 *
 * Usage (dev server running first, `npm run dev`):
 *   node scripts/ecosystem-balance-probe.mjs                          # New Sandbox, 600s
 *   node scripts/ecosystem-balance-probe.mjs --start=guided --seconds=120 --assist
 *   node scripts/ecosystem-balance-probe.mjs --scenario=winter_survival
 *   node scripts/ecosystem-balance-probe.mjs --scenario=drought_rescue --assist --food-rate=0.3
 *   node scripts/ecosystem-balance-probe.mjs --mode=chill --seconds=300
 *   node scripts/ecosystem-balance-probe.mjs --report=knob           # mode food knobs, no run
 *
 * Options:
 *   --start=sandbox|guided   New Sandbox (default) or the Herd Rescue button
 *   --scenario=ID            start a playable scenario through the director
 *   --mode=ID                apply a gameplay mode before the run
 *   --seconds=N              sandbox: simulated seconds to run (default 600)
 *   --chunk=N                sandbox: seconds between table rows (default 60)
 *   --grace=N                scenario: seconds past targetSeconds to keep running (default 60)
 *   --assist                 paint a 12-food brush click near the herd every 10s
 *   --food-rate=X            override environment.foodRateMultiplier after start
 *   --report=knob            print each mode's food growth readout and exit
 *   --quiet                  print only the RESULT line
 *   --url=URL                dev server (default CREATURE_PROBE_URL or http://localhost:8000)
 *
 * The last line is always `RESULT {json}`, so batch runners can aggregate runs.
 * Runs on the main thread (`?devtools=1&worker=0`) because it reads window.world.
 */
import { chromium } from 'playwright';

function readOption(name, fallback) {
  const hit = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const hasFlag = name => process.argv.includes(`--${name}`);

const START = readOption('start', 'sandbox');
const SCENARIO = readOption('scenario', null);
const MODE = readOption('mode', null);
const SECONDS = Number(readOption('seconds', 600));
const CHUNK = Number(readOption('chunk', 60));
const GRACE = Number(readOption('grace', 60));
const ASSIST = hasFlag('assist');
const QUIET = hasFlag('quiet');
const REPORT = readOption('report', null);
const FOOD_RATE = readOption('food-rate', null);
const BASE_URL = readOption('url', process.env.CREATURE_PROBE_URL || 'http://localhost:8000');

if (!['sandbox', 'guided'].includes(START)) {
  throw new Error(`--start must be sandbox or guided, got ${START}`);
}
if (REPORT !== null && REPORT !== 'knob') {
  throw new Error(`--report must be knob, got ${REPORT}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error.message)));

await page.goto(`${BASE_URL.replace(/\/$/, '')}/?devtools=1&worker=0`, { waitUntil: 'load' });
await page.waitForFunction(
  () => typeof window.advanceTime === 'function' && !!window.world && !!window.gameLoop && !!window.gameDirector,
  null,
  { timeout: 30000 }
);
await page.click(START === 'guided' && !SCENARIO ? '#btn-guided-run' : '#btn-new-game');
await page.waitForTimeout(400);

const result = await page.evaluate(
  ({ SECONDS, CHUNK, GRACE, ASSIST, FOOD_RATE, SCENARIO, MODE, REPORT }) => {
    const world = window.world;
    const loop = window.gameLoop;
    const sim = loop.playableScenarios;
    const dt = loop.fixedDt || 1 / 60;

    if (REPORT === 'knob') {
      // Each mode is applied to the same live world, so the readouts differ only by the mode's knob.
      const sequence = ['chill', 'chill', 'balanced', 'frontier', 'mayhem', 'balanced'];
      const knob = sequence.map(id => {
        window.gameplayModes.applyMode(id, { announce: false });
        return {
          mode: id,
          environmentMultiplier: world.environment.foodRateMultiplier,
          foodGrowthRate: Number(world.ecosystem.foodGrowthRate().toFixed(4))
        };
      });
      return { knob };
    }

    if (MODE) window.gameplayModes.applyMode(MODE, { announce: false });

    let scenario = null;
    if (SCENARIO) {
      window.gameDirector.startScenario(SCENARIO, { announce: false });
      const run = sim.activeRun;
      if (!run) return { error: `scenario ${SCENARIO} did not start` };
      scenario = run.scenario;
    }
    if (FOOD_RATE !== null && world.environment) world.environment.foodRateMultiplier = FOOD_RATE;
    const foodRateStart = world.environment?.foodRateMultiplier;

    // Births and refills are counted at the spawn entry points after any scenario
    // setup. Refills are auto-balance spawns (creatureManager.spawnManual); with no
    // player input they are the only manual spawns in a run.
    let births = 0;
    let refills = 0;
    let stepMs = 0;
    let stepCount = 0;
    const manager = world.creatureManager;
    const spawnChild = manager.spawnChild.bind(manager);
    manager.spawnChild = (...args) => {
      births++;
      return spawnChild(...args);
    };
    const spawnManual = manager.spawnManual.bind(manager);
    manager.spawnManual = (...args) => {
      refills++;
      return spawnManual(...args);
    };

    const living = () => world.creatures.filter(c => c.alive !== false);
    const herd = () => living().filter(c => !c.genes.predator);
    const causes = {};
    const seenDead = new Set();
    const tallyDeaths = () => {
      for (const creature of world.recentlyDead || []) {
        if (seenDead.has(creature.id)) continue;
        seenDead.add(creature.id);
        const key = creature.deathCause || 'unknown';
        causes[key] = (causes[key] || 0) + 1;
      }
    };
    const nearestFood = (creature, food) => {
      let best = Infinity;
      for (const item of food) best = Math.min(best, Math.hypot(item.x - creature.x, item.y - creature.y));
      return best;
    };
    const rows = [];
    const sample = () => {
      const alive = living();
      const hungry = alive.filter(c => (c.needs?.hunger || 0) >= 35);
      const distances = hungry
        .slice(0, 60)
        .map(c => nearestFood(c, world.food))
        .sort((a, b) => a - b);
      const mean = (items, pick) =>
        items.length ? items.reduce((sum, item) => sum + pick(item), 0) / items.length : 0;
      rows.push({
        t: Math.round(world.t),
        alive: alive.length,
        predators: alive.filter(c => c.genes.predator).length,
        food: world.food.length,
        energy: +mean(alive, c => c.energy || 0).toFixed(1),
        hunger: +mean(alive, c => c.needs?.hunger || 0).toFixed(1),
        hungryPct: alive.length ? Math.round((hungry.length / alive.length) * 100) : 0,
        foodDistHungry: distances.length ? Math.round(distances[Math.floor(distances.length / 2)]) : 0,
        stress: +mean(alive, c => c.needs?.stress || 0).toFixed(1),
        deaths: seenDead.size,
        adults: alive.filter(c => c.ageStage === 'adult').length,
        mates: alive.filter(c => c.senses?.mate).length,
        births,
        refills
      });
    };
    const pickMetrics = metrics =>
      metrics
        ? {
            alive: metrics.alive,
            food: metrics.food,
            predators: metrics.predators,
            averageStress: Math.round((metrics.averageStress || 0) * 10) / 10,
            babies: metrics.babies,
            variants: metrics.variants,
            maxGeneration: metrics.maxGeneration,
            propPlacements: metrics.propPlacements
          }
        : null;

    const target = scenario ? Number(scenario.targetSeconds) : 0;
    const limit = scenario ? target + GRACE : SECONDS;
    const steps = scenario ? Number.MAX_SAFE_INTEGER : Math.round(SECONDS / dt);
    const chunkSteps = Math.round(CHUNK / dt);
    const assistSteps = Math.round(10 / dt);
    let painted = 0;
    let atTarget = null;
    window.gameState.paused = false;
    sample();
    for (let i = 1; i <= steps; i++) {
      if (ASSIST && i % assistSteps === 0) {
        const cs = herd();
        if (cs.length) {
          const cx = cs.reduce((sum, c) => sum + c.x, 0) / cs.length;
          const cy = cs.reduce((sum, c) => sum + c.y, 0) / cs.length;
          // One paint click: twelve items inside a 26-unit brush around the herd.
          for (let k = 0; k < 12; k++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 13;
            world.addFood(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance);
            painted++;
          }
        }
      }
      const stepStart = performance.now();
      loop.step(dt);
      stepMs += performance.now() - stepStart;
      stepCount++;
      if (scenario) {
        sim.update(dt);
        const run = sim.activeRun;
        if (run && !atTarget && run.elapsed >= target) atTarget = pickMetrics(sim.getSnapshot().metrics);
        if (!run || run.completed || run.failed || run.elapsed >= limit) {
          tallyDeaths();
          sample();
          break;
        }
      }
      tallyDeaths();
      if (i % chunkSteps === 0) sample();
    }

    const run = sim.activeRun;
    const outcome = scenario ? (run?.completed ? 'complete' : run?.failed ? 'failed' : 'missed') : 'n/a';
    return {
      rows,
      causes,
      painted,
      births,
      refills,
      stepMsAvg: stepCount ? Math.round((stepMs / stepCount) * 1000) / 1000 : 0,
      foodRateStart,
      foodRateEnd: world.environment?.foodRateMultiplier,
      scenario: scenario
        ? {
            id: scenario.id,
            targetSeconds: target,
            minAlive: scenario.minAlive ?? null,
            minFood: scenario.minFood ?? null,
            minPredators: scenario.minPredators ?? null,
            maxStress: scenario.maxStress ?? null,
            minBabies: scenario.minBabies ?? null,
            minVariants: scenario.minVariants ?? null,
            minProps: scenario.minProps ?? null,
            minGeneration: scenario.minGeneration ?? null
          }
        : null,
      outcome,
      elapsed: run ? Math.round(run.elapsed * 10) / 10 : null,
      completedAt: run?.completed ? Math.round(run.elapsed * 10) / 10 : null,
      atTarget,
      finalMetrics: pickMetrics(sim.getSnapshot().metrics)
    };
  },
  {
    SECONDS,
    CHUNK,
    GRACE,
    ASSIST,
    FOOD_RATE: FOOD_RATE === null ? null : Number(FOOD_RATE),
    SCENARIO,
    MODE,
    REPORT
  }
);

if (result.error) {
  console.log(`ERROR ${result.error}`);
} else if (REPORT === 'knob') {
  if (!QUIET) {
    console.log('mode\tenvironmentMultiplier\tfoodGrowthRate');
    for (const row of result.knob) console.log([row.mode, row.environmentMultiplier, row.foodGrowthRate].join('\t'));
  }
} else {
  if (!QUIET) {
    console.log(
      `start=${START} scenario=${SCENARIO ?? '-'} mode=${MODE ?? '-'} assist=${ASSIST} foodRate=${result.foodRateStart} painted=${result.painted} outcome=${result.outcome}`
    );
    console.log(
      't\talive\tadults\tmates\tpred\tfood\tenergy\thunger\thungry%\tfoodDist\tstress\tdeaths\tbirths\trefills'
    );
    for (const row of result.rows) {
      console.log(
        [
          row.t,
          row.alive,
          row.adults,
          row.mates,
          row.predators,
          row.food,
          row.energy,
          row.hunger,
          row.hungryPct,
          row.foodDistHungry,
          row.stress,
          row.deaths,
          row.births,
          row.refills
        ].join('\t')
      );
    }
    console.log('CAUSES', JSON.stringify(result.causes));
  }
}
const summary = {
  start: SCENARIO ? 'scenario' : START,
  scenario: SCENARIO,
  mode: MODE,
  assist: ASSIST,
  report: REPORT,
  foodRateStart: result.foodRateStart ?? null,
  foodRateEnd: result.foodRateEnd ?? null,
  scenarioInfo: result.scenario ?? null,
  outcome: result.outcome ?? null,
  elapsed: result.elapsed ?? null,
  completedAt: result.completedAt ?? null,
  atTarget: result.atTarget ?? null,
  finalMetrics: result.finalMetrics ?? null,
  knob: result.knob ?? null,
  causes: result.causes ?? null,
  births: result.births ?? null,
  refills: result.refills ?? null,
  stepMsAvg: result.stepMsAvg ?? null,
  pageErrors
};
console.log(`RESULT ${JSON.stringify(summary)}`);

await browser.close();
