import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const includeProduction = process.argv.includes('--production');
const startedAt = new Date().toISOString();
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commands = [
  ['git', ['status', '--short', '--branch']],
  ['git', ['diff', '--check']],
  ['node', ['--check', 'scripts/browser-smoke.mjs']],
  ['node', ['--check', 'scripts/scenario-balance-smoke.mjs']],
  ['node', ['--check', 'scripts/production-vitals-smoke.mjs']],
  ['node', ['--check', 'scripts/release-evidence-board.mjs']],
  ['node', ['--check', 'scripts/release-proof.mjs']],
  ['node', ['--check', 'scripts/vercel-deploy-proof.mjs']],
  ['node', ['--check', 'vite.config.js']],
  [npmCmd, ['run', 'lint']],
  [npmCmd, ['test']],
  [npmCmd, ['run', 'build']],
  [npmCmd, ['run', 'check:bundle']],
  [npmCmd, ['run', 'smoke:browser']],
  [npmCmd, ['run', 'smoke:main']],
  [npmCmd, ['run', 'smoke:worker']],
  [npmCmd, ['run', 'smoke:scenarios']],
  ...(includeProduction ? [
    [npmCmd, ['run', 'proof:vercel']],
    [npmCmd, ['run', 'smoke:production']],
    [npmCmd, ['run', 'smoke:production:vitals']]
  ] : []),
  [npmCmd, ['run', 'evidence:release']]
];

const results = [];

function labelFor(command, args) {
  return [command, ...args].join(' ');
}

for (const [command, args] of commands) {
  const label = labelFor(command, args);
  console.log(`\n[release-proof] ${label}`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  });
  const durationMs = Date.now() - started;
  const passed = result.status === 0;
  results.push({ command: label, passed, status: result.status, durationMs });
  if (!passed) {
    await writeSummary(false);
    process.exit(result.status || 1);
  }
}

await writeSummary(true);
console.log('\nRelease proof passed.');

async function writeSummary(passed) {
  const outDir = path.join(repoRoot, 'output', 'release-proof');
  await fs.mkdir(outDir, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    startedAt,
    includeProduction,
    passed,
    results
  };
  await fs.writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, 'summary.md'), markdown(summary));
}

function markdown(summary) {
  const rows = summary.results.map((item) =>
    `| ${item.command} | ${item.passed ? 'pass' : 'fail'} | ${item.durationMs} |`
  ).join('\n');
  return `# Release Proof

Generated: ${summary.generatedAt}

Production lanes: ${summary.includeProduction ? 'included' : 'skipped'}

Result: ${summary.passed ? 'passed' : 'failed'}

| Command | Result | Duration ms |
| --- | --- | --- |
${rows}
`;
}
