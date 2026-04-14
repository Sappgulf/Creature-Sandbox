import { defineConfig } from 'vite';

export default defineConfig({
  root: 'creature-sim',
  server: {
    port: 8000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
  },
});