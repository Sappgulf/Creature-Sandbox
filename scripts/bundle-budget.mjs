import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'dist', 'assets');
const maxChunkBytes = Number(process.env.CREATURE_MAX_JS_CHUNK_BYTES || 640_000);
const maxChunkGzipBytes = Number(process.env.CREATURE_MAX_JS_CHUNK_GZIP_BYTES || 190_000);

const entries = await fs.readdir(assetsDir, { withFileTypes: true });
const jsFiles = entries
  .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
  .map(entry => entry.name)
  .sort();

assert.ok(jsFiles.length > 0, 'dist/assets should include JavaScript chunks after build');

const results = [];
for (const file of jsFiles) {
  const absolute = path.join(assetsDir, file);
  const buffer = await fs.readFile(absolute);
  const gzip = zlib.gzipSync(buffer);
  results.push({
    file,
    bytes: buffer.length,
    gzipBytes: gzip.length
  });
}

const oversized = results.filter(result =>
  result.bytes > maxChunkBytes || result.gzipBytes > maxChunkGzipBytes
);

assert.deepEqual(
  oversized,
  [],
  `JS chunk budget exceeded: ${JSON.stringify(oversized)}`
);

console.log(`Bundle budget passed: ${results.map(result => `${result.file} ${result.bytes}B/${result.gzipBytes}B gzip`).join(', ')}`);
