import { initializeApp } from './app-bootstrap.js?v=20260528-tranche8';

// Only register the service worker for real production builds. Vite's dev
// server already serves fresh files with its own HMR; a cache-first SW on
// top of that silently serves stale assets during local development (the
// dev-mode CACHE_VERSION fallback never changes across a dev session, so
// nothing ever invalidates it) -- confusing edits-not-showing-up bugs that
// have nothing to do with the actual code.
const smokeParams = new URLSearchParams(window.location.search);
const skipServiceWorker = smokeParams.has('smoke') || smokeParams.has('autosandbox') || smokeParams.has('autostart');
if (import.meta.env.PROD && !skipServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Silent fail: offline mode is optional
    });
  });
} else if (!import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Not registering in dev prevents new stale caches, but an older local
  // registration can still control this page until it is explicitly removed.
  // Detach it so a reload immediately returns to Vite's fresh/HMR-served files.
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
}

(async function bootstrap() {
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  await initializeApp();
})();
