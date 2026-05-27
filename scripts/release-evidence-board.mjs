import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output');
const boardJsonPath = path.join(outputDir, 'release-evidence-board.json');
const boardMdPath = path.join(outputDir, 'release-evidence-board.md');

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

async function lane(name, folder) {
  const dir = path.join(outputDir, folder);
  const summary = await readJson(path.join(dir, 'summary.json'));
  const readiness = await readJson(path.join(dir, 'runtime-readiness.json'));
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
    present: Array.isArray(summary),
    scenarios,
    passed: Array.isArray(summary) && scenarios >= 3,
    readinessStatus: readiness?.status ?? null,
    shippingDefault: readiness?.shippingDefault ?? null,
    workerCandidate: readiness?.workerCandidate ?? null,
    workerDefaultReady: readiness?.defaultReadiness?.safeToDefaultWorker ?? null,
    completedScenarioResultFlow: readiness?.completedScenarioResultFlow?.passed ?? null,
    frames: frameSummary(summary || []),
    screenshots
  };
}

function postureFrom(lanes) {
  const local = lanes.find((item) => item.name === 'local-browser');
  const worker = lanes.find((item) => item.name === 'worker-browser');
  const production = lanes.find((item) => item.name === 'production-browser');
  const missing = lanes.filter((item) => !item.present).map((item) => item.name);
  const workerReady = worker?.workerDefaultReady === true;
  const workerHeld = worker?.workerDefaultReady === false;
  return {
    readyForPush: local?.present === true && worker?.present === true,
    missingProof: missing,
    defaultRuntime: local?.shippingDefault || 'main',
    workerPromotion: workerReady ? 'candidate-ready' : 'held',
    releaseNotes: [
      local?.present ? 'Local browser smoke artifacts are present.' : 'Local browser smoke artifacts are missing.',
      worker?.present ? 'Worker smoke artifacts are present.' : 'Worker smoke artifacts are missing.',
      production?.present ? 'Production browser smoke artifacts are present.' : 'Production browser smoke artifacts are optional until a production smoke run is requested.',
      workerReady
        ? 'Worker runtime proof is ready for promotion review.'
        : (workerHeld
          ? 'Worker runtime remains opt-in until the release owner explicitly promotes it.'
          : 'Worker runtime proof is missing a default-readiness decision.')
    ]
  };
}

function markdown(board) {
  const rows = board.lanes.map((item) => {
    const result = item.present ? 'present' : 'missing';
    const worker = item.workerDefaultReady === null ? 'n/a' : String(item.workerDefaultReady);
    const resultFlow = item.completedScenarioResultFlow === null ? 'n/a' : String(item.completedScenarioResultFlow);
    return `| ${item.name} | ${result} | ${item.readinessStatus || 'n/a'} | ${worker} | ${resultFlow} | ${item.scenarios} |`;
  }).join('\n');
  const frameRows = board.lanes.flatMap((item) =>
    item.frames.map((frame) =>
      `| ${item.name} | ${frame.scenario} | ${frame.avgFrameMs ?? 'n/a'} | ${frame.p95FrameMs ?? 'n/a'} | ${frame.nonDrawImagePerFrameMs ?? 'n/a'} | ${frame.quality || 'n/a'} | ${frame.scenarioResultComplete} |`
    )
  ).join('\n');

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

## Release Posture

Default runtime: ${board.posture.defaultRuntime}

Worker promotion: ${board.posture.workerPromotion}

Missing proof: ${board.posture.missingProof.length ? board.posture.missingProof.join(', ') : 'none'}

${board.posture.releaseNotes.map((note) => `- ${note}`).join('\n')}
`;
}

await fs.mkdir(outputDir, { recursive: true });

const lanes = [
  await lane('local-browser', 'browser-smoke'),
  await lane('worker-browser', 'browser-smoke-worker'),
  await lane('production-browser', 'browser-smoke-production')
];

const board = {
  generatedAt: new Date().toISOString(),
  git: {
    sha: runGit(['rev-parse', 'HEAD']),
    branch: runGit(['branch', '--show-current']),
    statusLine: oneLine(runGit(['status', '--short', '--branch'])),
    upstream: runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  },
  lanes,
  posture: postureFrom(lanes)
};

await fs.writeFile(boardJsonPath, `${JSON.stringify(board, null, 2)}\n`);
await fs.writeFile(boardMdPath, markdown(board));

console.log(`Release evidence board written to ${path.relative(repoRoot, boardJsonPath)}`);
