import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import fs from 'node:fs/promises';
import path from 'node:path';

const chunkMap = [
  {
    name: 'vendor-ui',
    paths: ['/src/dom-cache.js', '/src/ui.js', '/src/ui-controller.js', '/src/ui-controller-panels.js', '/src/ui-controller-spawn.js', '/src/ui-controller-watch.js', '/src/ui-controller-god-mode.js', '/src/ui-controller-game-mode.js', '/src/ui-controller-achievements.js', '/src/ui-controller-exports.js', '/src/control-strip.js', '/src/hud-menu.js', '/src/menu-model.js']
  },
  {
    name: 'vendor-analytics',
    paths: ['/src/analytics.js', '/src/enhanced-analytics.js', '/src/enhanced-analytics-loader.js', '/src/mini-graphs.js', '/src/heatmap-system.js']
  },
  {
    name: 'vendor-campaign',
    paths: ['/src/campaign-system.js', '/src/scenario-editor.js', '/src/session-goals.js', '/src/challenge-system.js', '/src/gameplay-modes.js']
  },
  {
    name: 'vendor-creature-advanced',
    paths: ['/src/personality-system.js', '/src/family-bonds.js', '/src/memory-learning.js', '/src/advanced-genetics.js', '/src/advanced-predator-prey-ai.js', '/src/enhanced-behaviors.js']
  },
  {
    name: 'vendor-world-advanced',
    paths: ['/src/world-disaster.js', '/src/world-ecosystem.js', '/src/world-events.js', '/src/world-enhancements.js', '/src/seasonal-events.js', '/src/ecosystem-health.js']
  },
  {
    name: 'vendor-effects',
    paths: ['/src/particle-system.js', '/src/visual-effects.js', '/src/procedural-sounds.js', '/src/audio-system.js']
  }
];

function manualChunks(id) {
  for (const chunk of chunkMap) {
    if (chunk.paths.some(p => id.endsWith(p))) {
      return chunk.name;
    }
  }
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    await Promise.all(entries.map((entry) => copyRecursive(path.join(src, entry), path.join(dest, entry))));
    return;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

function copyCreatureStaticAssets() {
  return {
    name: 'copy-creature-static-assets',
    apply: 'build',
    async closeBundle() {
      const root = path.resolve('creature-sim');
      const outDir = path.resolve('dist');
      await Promise.all([
        copyRecursive(path.join(root, 'sw.js'), path.join(outDir, 'sw.js')),
        copyRecursive(path.join(root, 'manifest.json'), path.join(outDir, 'manifest.json')),
        copyRecursive(path.join(root, 'assets', 'sprites'), path.join(outDir, 'assets', 'sprites'))
      ]);
    }
  };
}

export default defineConfig(({ mode }) => ({
  root: 'creature-sim',
  server: {
    port: 8000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks
      },
      plugins: mode === 'analyze' ? [visualizer({ open: true, gzipSize: true, filename: '../dist/stats.html' })] : []
    }
  },
  plugins: [copyCreatureStaticAssets()],
}));
