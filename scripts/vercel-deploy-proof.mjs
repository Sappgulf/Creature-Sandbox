import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'output', 'vercel-deploy-proof');
const targetUrl = process.env.CREATURE_VERCEL_URL || 'https://creature-sandbox.vercel.app';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    passed: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

function request(method, url) {
  return new Promise(resolve => {
    const req = https.request(url, { method, timeout: 20000 }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        if (body.length < 65536) body += chunk;
      });
      res.on('end', () => {
        resolve({
          url,
          method,
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', error => resolve({ url, method, error: error.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, method, error: 'timeout' });
    });
    req.end();
  });
}

await fs.mkdir(outDir, { recursive: true });

const version = run('vercel', ['--version']);
const inspect = run('vercel', ['inspect', targetUrl, '--timeout', '20s']);
const head = await request('HEAD', targetUrl);
const buildInfo = await request('GET', new URL('/build-info.json', targetUrl).toString());
let parsedBuildInfo = null;
try {
  parsedBuildInfo = buildInfo.body ? JSON.parse(buildInfo.body) : null;
} catch {
  parsedBuildInfo = null;
}

const summary = {
  generatedAt: new Date().toISOString(),
  targetUrl,
  version,
  inspect,
  head: {
    statusCode: head.statusCode ?? null,
    error: head.error ?? null,
    contentType: head.headers?.['content-type'] ?? null,
    cacheControl: head.headers?.['cache-control'] ?? null,
    deploymentId: head.headers?.['x-vercel-id'] ?? null
  },
  buildInfo: {
    statusCode: buildInfo.statusCode ?? null,
    error: buildInfo.error ?? null,
    parsed: parsedBuildInfo
  }
};

const passed =
  version.passed &&
  inspect.passed &&
  Number(head.statusCode || 0) >= 200 &&
  Number(head.statusCode || 0) < 400 &&
  Number(buildInfo.statusCode || 0) >= 200 &&
  Number(buildInfo.statusCode || 0) < 300 &&
  !!parsedBuildInfo?.sha;

summary.passed = passed;

await fs.writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(outDir, 'summary.md'), markdown(summary));

console.log(`Vercel deploy proof written to ${path.relative(repoRoot, path.join(outDir, 'summary.json'))}`);
if (!passed) {
  console.error('Vercel deploy proof failed.');
  process.exit(1);
}

function markdown(item) {
  return `# Vercel Deploy Proof

Generated: ${item.generatedAt}

Target: ${item.targetUrl}

Result: ${item.passed ? 'passed' : 'failed'}

## CLI

- Version: ${item.version.stdout || item.version.stderr || 'n/a'}
- Inspect: ${item.inspect.passed ? 'passed' : 'failed'}

## HTTP

- HEAD: ${item.head.statusCode || item.head.error || 'n/a'}
- Vercel id: ${item.head.deploymentId || 'n/a'}
- Build SHA: ${item.buildInfo.parsed?.sha || 'n/a'}
- Build generated: ${item.buildInfo.parsed?.generatedAt || 'n/a'}
`;
}
