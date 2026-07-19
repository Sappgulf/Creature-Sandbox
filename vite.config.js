import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const chunkMap = [
  {
    name: 'vendor-ui',
    paths: [
      '/src/dom-cache.js',
      '/src/ui.js',
      '/src/ui-controller.js',
      '/src/ui-controller-panels.js',
      '/src/ui-controller-spawn.js',
      '/src/ui-controller-watch.js',
      '/src/ui-controller-god-mode.js',
      '/src/ui-controller-game-mode.js',
      '/src/ui-controller-achievements.js',
      '/src/ui-controller-exports.js',
      '/src/control-strip.js'
    ]
  },
  {
    name: 'vendor-analytics',
    paths: [
      '/src/analytics.js',
      '/src/enhanced-analytics.js',
      '/src/enhanced-analytics-loader.js',
      '/src/mini-graphs.js',
      '/src/heatmap-system.js'
    ]
  },
  {
    name: 'vendor-campaign',
    paths: [
      '/src/campaign-system.js',
      '/src/scenario-editor.js',
      '/src/session-goals.js',
      '/src/challenge-system.js',
      '/src/gameplay-modes.js'
    ]
  },
  {
    name: 'vendor-creature-advanced',
    paths: [
      '/src/personality-system.js',
      '/src/family-bonds.js',
      '/src/memory-learning.js',
      '/src/advanced-genetics.js',
      '/src/advanced-predator-prey-ai.js',
      '/src/enhanced-behaviors.js',
      '/src/god-powers.js'
    ]
  },
  {
    name: 'vendor-world-advanced',
    paths: [
      '/src/world-disaster.js',
      '/src/world-ecosystem.js',
      '/src/world-events.js',
      '/src/world-enhancements.js',
      '/src/seasonal-events.js',
      '/src/ecosystem-health.js'
    ]
  },
  {
    name: 'vendor-effects',
    paths: ['/src/particle-system.js', '/src/visual-effects.js', '/src/audio-system.js']
  },
  {
    name: 'vendor-creature-render',
    paths: [
      '/src/creature-render.js',
      '/src/creature-behavior.js',
      '/src/creature-physics.js',
      '/src/creature-reactions.js'
    ]
  },
  {
    name: 'vendor-save',
    paths: ['/src/save-system.js', '/src/save-migration.js', '/src/runtime-save-metadata.js']
  }
];

function manualChunks(id) {
  const cleanId = id.split('?')[0];
  for (const chunk of chunkMap) {
    if (chunk.paths.some(p => cleanId.endsWith(p))) {
      return chunk.name;
    }
  }
}

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    closeBundle() {
      const appRoot = path.join(__dirname, 'creature-sim');
      const outDir = path.join(__dirname, 'dist');
      fs.cpSync(path.join(appRoot, 'assets'), path.join(outDir, 'assets'), {
        recursive: true
      });
      fs.copyFileSync(path.join(appRoot, 'manifest.json'), path.join(outDir, 'manifest.json'));

      const sha =
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: __dirname,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
      fs.writeFileSync(
        path.join(outDir, 'build-info.json'),
        `${JSON.stringify({ sha, generatedAt: new Date().toISOString() }, null, 2)}\n`
      );

      // Copy and patch service worker with hashed shell assets + a
      // build-specific cache version, so a stale worker never precaches a
      // mismatched module graph and every real deploy invalidates old caches.
      const swSrc = path.join(appRoot, 'sw.js');
      const swDest = path.join(outDir, 'sw.js');
      if (fs.existsSync(swSrc)) {
        const assetsDir = path.join(outDir, 'assets');
        const shellAssets = ['/', '/index.html', '/styles.css'];
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          const entryJs = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
          const entryCss = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
          if (entryJs) shellAssets.push(`/assets/${entryJs}`);
          if (entryCss) shellAssets.push(`/assets/${entryCss}`);
          // vendor-* chunks (manualChunks above) and the simulation worker
          // script are part of the initial module graph, not on-demand
          // feature panels (gene-editor, debug-console, etc.) — precache
          // those too so a cold offline load doesn't 404 on them.
          const coreChunks = files.filter(
            f => (f.startsWith('vendor-') || f.startsWith('worker-simulation-')) && f.endsWith('.js')
          );
          for (const chunk of coreChunks) shellAssets.push(`/assets/${chunk}`);
        }
        let swContent = fs.readFileSync(swSrc, 'utf8');
        swContent = swContent.replace('self.__SHELL_ASSETS__', JSON.stringify(shellAssets));
        swContent = swContent.replace('self.__CACHE_VERSION__', JSON.stringify(sha.slice(0, 12)));
        fs.writeFileSync(swDest, swContent);
      }
    }
  };
}

export default defineConfig(({ mode }) => ({
  root: 'creature-sim',
  server: {
    port: 8000
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks
      },
      plugins: [
        copyRuntimeAssets(),
        ...(mode === 'analyze' ? [visualizer({ open: true, gzipSize: true, filename: '../dist/stats.html' })] : [])
      ]
    }
  }
}));
