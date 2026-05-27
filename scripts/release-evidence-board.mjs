import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output');
const boardJsonPath = path.join(outputDir, 'release-evidence-board.json');
const boardMdPath = path.join(outputDir, 'release-evidence-board.md');
const summaryMdPath = path.join(outputDir, 'release-summary.md');

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

function oneLine(value) {
  return value ? value.replace(/\s*\n\s*/g, ' | ') : null;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function frameSummary(summary = []) {
  return summary.map((item) => ({
    scenario: item.scenario,
    avgFrameMs: item.framePacing?.avgFrameMs ?? null,
    p95FrameMs: item.framePacing?.p95FrameMs ?? null,
    nonDrawImagePerFrameMs: item.framePacing?.mainThread?.profiledNonDrawImagePerFrameMs ?? null,
    quality: item.perf?.renderer?.quality ?? item.framePacing?.qualityEnd ?? null,
    scenarioResultComplete: item.scenarioResult?.complete === true
  }));
}

function readinessGate(name, readiness, staleBuild) {
  if (staleBuild || !readiness) return false;
  const completedScenarioResults = readiness.completedScenarioResultFlow?.passed === true;
  if (!completedScenarioResults) return false;

  if (name === 'main-browser') {
    return readiness.mode === 'main' && readiness.status === 'fallback-proof';
  }

  if (name === 'worker-browser') {
    return readiness.mode === 'worker' &&
      readiness.status === 'candidate-opt-in' &&
      readiness.defaultReadiness?.safeToDefaultWorker === true;
  }

  return readiness.mode === 'worker' &&
    readiness.status === 'shipping-default' &&
    readiness.defaultReadiness?.safeToDefaultWorker === true;
}

async function lane(name, folder, { requiredBuildSha = null } = {}) {
  const dir = path.join(outputDir, folder);
  const summary = await readJson(path.join(dir, 'summary.json'));
  const readiness = await readJson(path.join(dir, 'runtime-readiness.json'));
  const target = await readJson(path.join(dir, 'target.json'));
  const buildSha = target?.buildInfo?.sha ?? null;
  const staleBuild = !!requiredBuildSha && buildSha !== requiredBuildSha;
  const present = Array.isArray(summary) && !staleBuild;
  const scenarioCountOk = present && summary.length >= 3;
  const readinessOk = scenarioCountOk && readinessGate(name, readiness, staleBuild);
  const expectedShots = [
    'home-desktop.png',
    'desktop.png',
    'desktop-clean.png',
    folder.includes('worker') ? 'desktop-upgrade-result.png' : 'desktop-upgrade-result.png',
    'mobile-compact.png',
    'mobile-large.png'
  ];
  const screenshots = {};
  for (const shot of expectedShots) {
    screenshots[shot] = await exists(path.join(dir, shot));
  }
  const scenarios = Array.isArray(summary) ? summary.length : 0;
  return {
    name,
    folder: path.relative(repoRoot, dir),
    present,
    staleBuild,
    buildSha,
    target,
    scenarios,
    passed: readinessOk,
    mode: readiness?.mode ?? null,
    readinessStatus: staleBuild ? null : (readiness?.status ?? null),
    shippingDefault: readiness?.shippingDefault ?? null,
    workerCandidate: staleBuild ? null : (readiness?.workerCandidate ?? null),
    workerDefaultReady: staleBuild ? null : (readiness?.defaultReadiness?.safeToDefaultWorker ?? null),
    completedScenarioResultFlow: staleBuild ? null : (readiness?.completedScenarioResultFlow?.passed ?? null),
    frames: staleBuild ? [] : frameSummary(summary || []),
    screenshots
  };
}

async function scenarioBalanceLane() {
  const summary = await readJson(path.join(outputDir, 'scenario-balance', 'summary.json'));
  const scenarios = Array.isArray(summary?.scenarios) ? summary.scenarios : [];
  return {
    name: 'scenario-balance',
    folder: path.join('output', 'scenario-balance'),
    present: scenarios.length > 0,
    scenarios: scenarios.length,
    passed: scenarios.length >= 2,
    readinessStatus: scenarios.length >= 2 ? 'balance-proof' : null,
    workerCandidate: null,
    workerDefaultReady: null,
    completedScenarioResultFlow: null,
    frames: [],
    screenshots: Object.fromEntries(
      scenarios.map((item) => [path.basename(item.screenshot || `${item.id}.png`), true])
    ),
    balance: scenarios
  };
}

function postureFrom(lanes) {
  const local = lanes.find((item) => item.name === 'local-browser');
  const main = lanes.find((item) => item.name === 'main-browser');
  const worker = lanes.find((item) => item.name === 'worker-browser');
  const production = lanes.find((item) => item.name === 'production-browser');
  const scenarioBalance = lanes.find((item) => item.name === 'scenario-balance');
  const requiredLanes = [local, main, worker, production, scenarioBalance];
  const missing = lanes.filter((item) => !item.present).map((item) => item.name);
  const blocked = lanes
    .filter((item) => item.present && item.passed === false)
    .map((item) => `${item.name} (${item.readinessStatus || 'proof gate failed'})`);
  const workerReady = local?.mode === 'worker' && local?.readinessStatus === 'shipping-default';
  const workerHeld = local?.mode !== 'worker' || local?.workerDefaultReady === false;
  return {
    readyForPush: requiredLanes.every((item) => item?.passed === true),
    missingProof: missing,
    blockedProof: blocked,
    defaultRuntime: local?.shippingDefault || 'worker',
    workerPromotion: workerReady ? 'shipping-default' : 'held',
    releaseNotes: [
      local?.passed ? 'Shipping-default browser smoke artifacts are present and realtime-ready.' : 'Shipping-default browser smoke artifacts are missing or not realtime-ready.',
      main?.passed ? 'Main-thread fallback smoke artifacts are present.' : 'Main-thread fallback smoke artifacts are missing or failed fallback proof.',
      worker?.passed ? 'Forced worker smoke artifacts are present and candidate-ready.' : 'Forced worker smoke artifacts are missing or failed candidate proof.',
      production?.passed
        ? 'Production browser smoke artifacts match this commit and include realtime worker readiness proof.'
        : (production?.staleBuild
          ? `Production browser smoke is stale for this commit (artifact SHA ${production.buildSha || 'unknown'}).`
          : (production?.present
            ? `Production browser smoke is present but not release-ready (${production.readinessStatus || 'unknown readiness'}).`
            : 'Production browser smoke artifacts are optional until a production smoke run is requested.')),
      scenarioBalance?.present ? 'New scenario balance-soak artifacts are present.' : 'New scenario balance-soak artifacts are missing.',
      workerReady
        ? 'Worker runtime is the shipping default with explicit main-thread fallback proof.'
        : (workerHeld
          ? 'Worker default evidence missed a gate; treat this as a release blocker and keep explicit main-thread fallback proof current.'
          : 'Worker runtime proof is missing a default-readiness decision.')
    ]
  };
}

function markdown(board) {
  const rows = board.lanes.map((item) => {
    const result = item.present ? 'present' : (item.staleBuild ? `stale (${item.buildSha || 'unknown'})` : 'missing');
    const worker = item.workerDefaultReady === null ? 'n/a' : String(item.workerDefaultReady);
    const resultFlow = item.completedScenarioResultFlow === null ? 'n/a' : String(item.completedScenarioResultFlow);
    return `| ${item.name} | ${result} | ${item.readinessStatus || 'n/a'} | ${worker} | ${resultFlow} | ${item.scenarios} |`;
  }).join('\n');
  const frameRows = board.lanes.flatMap((item) =>
    item.frames.map((frame) =>
      `| ${item.name} | ${frame.scenario} | ${frame.avgFrameMs ?? 'n/a'} | ${frame.p95FrameMs ?? 'n/a'} | ${frame.nonDrawImagePerFrameMs ?? 'n/a'} | ${frame.quality || 'n/a'} | ${frame.scenarioResultComplete} |`
    )
  ).join('\n');
  const balanceRows = board.lanes
    .find((item) => item.name === 'scenario-balance')
    ?.balance
    ?.map((item) =>
      `| ${item.id} | ${item.runtime} | ${item.elapsed} | ${item.progress} | ${item.metrics?.alive ?? 'n/a'} | ${item.metrics?.food ?? 'n/a'} | ${item.metrics?.predators ?? 'n/a'} | ${item.metrics?.averageStress ?? 'n/a'} |`
    )
    .join('\n') || '';

  return `# Release Evidence Board

Generated: ${board.generatedAt}

Commit: ${board.git.sha || 'unknown'}

Branch: ${board.git.branch || 'unknown'}

Status: ${board.git.statusLine || 'unknown'}

## Proof Lanes

| Lane | Artifact | Readiness | Worker default ready | Result flow | Scenarios |
| --- | --- | --- | --- | --- | --- |
${rows}

## Frame Evidence

| Lane | Scenario | Avg ms | P95 ms | Non-draw ms/frame | Quality | Result flow |
| --- | --- | --- | --- | --- | --- | --- |
${frameRows || '| n/a | n/a | n/a | n/a | n/a | n/a | n/a |'}

## Scenario Balance

| Scenario | Runtime | Elapsed | Progress | Alive | Food | Predators | Stress |
| --- | --- | --- | --- | --- | --- | --- | --- |
${balanceRows || '| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |'}

## Release Posture

Default runtime: ${board.posture.defaultRuntime}

Worker promotion: ${board.posture.workerPromotion}

Missing proof: ${board.posture.missingProof.length ? board.posture.missingProof.join(', ') : 'none'}

Blocked proof: ${board.posture.blockedProof.length ? board.posture.blockedProof.join(', ') : 'none'}

${board.posture.releaseNotes.map((note) => `- ${note}`).join('\n')}
`;
}

function compactSummaryMarkdown(board) {
  const laneByName = new Map(board.lanes.map((item) => [item.name, item]));
  const laneLine = (name, label = name) => {
    const item = laneByName.get(name);
    if (!item) return `- ${label}: missing`;
    if (item.staleBuild) return `- ${label}: stale (${item.buildSha || 'unknown'})`;
    if (!item.present) return `- ${label}: missing`;

    const status = item.passed
      ? (item.readinessStatus || 'passed')
      : `blocked (${item.readinessStatus || 'proof gate failed'})`;
    const frames = item.frames
      ?.filter((frame) => frame.avgFrameMs != null || frame.p95FrameMs != null)
      ?.map((frame) => `${frame.scenario} avg ${frame.avgFrameMs ?? 'n/a'}ms p95 ${frame.p95FrameMs ?? 'n/a'}ms`)
      ?.join('; ');
    return `- ${label}: ${status}${frames ? ` (${frames})` : ''}`;
  };

  return `# Creature Sandbox Release Summary

Commit: ${board.git.sha || 'unknown'}

Branch: ${board.git.branch || 'unknown'}

Status: ${board.git.statusLine || 'unknown'}

Default runtime: ${board.posture.defaultRuntime}

Worker promotion: ${board.posture.workerPromotion}

Missing proof: ${board.posture.missingProof.length ? board.posture.missingProof.join(', ') : 'none'}

Blocked proof: ${board.posture.blockedProof.length ? board.posture.blockedProof.join(', ') : 'none'}

## Lanes

${[
    laneLine('local-browser', 'Local shipping-default smoke'),
    laneLine('main-browser', 'Main-thread fallback smoke'),
    laneLine('worker-browser', 'Forced worker smoke'),
    laneLine('production-browser', 'Production realtime smoke'),
    laneLine('scenario-balance', 'Scenario balance soak')
  ].join('\n')}
`;
}

await fs.mkdir(outputDir, { recursive: true });

const gitSha = runGit(['rev-parse', 'HEAD']);
const lanes = [
  await lane('local-browser', 'browser-smoke'),
  await lane('main-browser', 'browser-smoke-main'),
  await lane('worker-browser', 'browser-smoke-worker'),
  await lane('production-browser', 'browser-smoke-production', { requiredBuildSha: gitSha }),
  await scenarioBalanceLane()
];

const board = {
  generatedAt: new Date().toISOString(),
  git: {
    sha: gitSha,
    branch: runGit(['branch', '--show-current']),
    statusLine: oneLine(runGit(['status', '--short', '--branch'])),
    upstream: runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  },
  lanes,
  posture: postureFrom(lanes)
};

await fs.writeFile(boardJsonPath, `${JSON.stringify(board, null, 2)}\n`);
await fs.writeFile(boardMdPath, markdown(board));
await fs.writeFile(summaryMdPath, compactSummaryMarkdown(board));

console.log(`Release evidence board written to ${path.relative(repoRoot, boardJsonPath)}`);
console.log(`Release summary written to ${path.relative(repoRoot, summaryMdPath)}`);
