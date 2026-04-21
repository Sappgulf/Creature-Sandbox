import { defineConfig } from 'vite';

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

export default defineConfig({
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
      }
    }
  },
});