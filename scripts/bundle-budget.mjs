import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'dist', 'assets');
const maxChunkBytes = Number(process.env.CREATURE_MAX_JS_CHUNK_BYTES || 300_000);
const maxChunkGzipBytes = Number(process.env.CREATURE_MAX_JS_CHUNK_GZIP_BYTES || 100_000);
const maxMainChunkBytes = Number(process.env.CREATURE_MAX_MAIN_CHUNK_BYTES || 510_000);
const maxMainChunkGzipBytes = Number(process.env.CREATURE_MAX_MAIN_CHUNK_GZIP_BYTES || 150_000);

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

const mainChunk = results.find(r => r.file.startsWith('index-') && r.file.endsWith('.js'));

const oversized = results.filter(result => {
  const isMain = result === mainChunk;
  const maxBytes = isMain ? maxMainChunkBytes : maxChunkBytes;
  const maxGzip = isMain ? maxMainChunkGzipBytes : maxChunkGzipBytes;
  return result.bytes > maxBytes || result.gzipBytes > maxGzip;
});

assert.deepStrictEqual(oversized, [], `JS chunk budget exceeded: ${JSON.stringify(oversized)}`);

console.log(
  `Bundle budget passed: ${results.map(result => `${result.file} ${result.bytes}B/${result.gzipBytes}B gzip`).join(', ')}`
);

// Advisory-only (non-failing): total JS size across dist/assets.
const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);
const totalGzipBytes = results.reduce((sum, result) => sum + result.gzipBytes, 0);
const advisoryMaxTotalBytes = Number(process.env.CREATURE_ADVISORY_TOTAL_JS_BYTES || 1_500_000);
if (totalBytes > advisoryMaxTotalBytes) {
  console.warn(
    `Advisory: total JS ${totalBytes}B (${totalGzipBytes}B gzip) exceeds advisory budget ${advisoryMaxTotalBytes}B (non-failing)`
  );
}

// Advisory-only (non-failing): index CSS size in dist/assets.
try {
  const cssEntries = (await fs.readdir(assetsDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.startsWith('index-') && entry.name.endsWith('.css'))
    .map(entry => entry.name)
    .sort();
  const advisoryMaxCssBytes = Number(process.env.CREATURE_ADVISORY_CSS_BYTES || 150_000);
  for (const file of cssEntries) {
    const buffer = await fs.readFile(path.join(assetsDir, file));
    if (buffer.length > advisoryMaxCssBytes) {
      console.warn(
        `Advisory: index CSS ${file} ${buffer.length}B exceeds advisory budget ${advisoryMaxCssBytes}B (non-failing)`
      );
    }
  }
} catch (error) {
  console.warn(`Advisory: unable to check index CSS size (non-failing): ${error.message}`);
}

// Advisory-only (non-failing): .map files shipped in dist.
try {
  const distDir = path.join(repoRoot, 'dist');
  const mapFiles = [];
  const walk = async dir => {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.map')) {
        mapFiles.push(path.relative(distDir, absolute));
      }
    }
  };
  await walk(distDir);
  if (mapFiles.length > 0) {
    console.warn(
      `Advisory: ${mapFiles.length} .map file(s) shipped in dist (non-failing): ${mapFiles.sort().join(', ')}`
    );
  }
} catch (error) {
  console.warn(`Advisory: unable to check .map files in dist (non-failing): ${error.message}`);
}
