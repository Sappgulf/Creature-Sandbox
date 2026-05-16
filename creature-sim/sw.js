/**
 * Service Worker for Creature Sandbox
 * Provides offline caching for the game shell and lazy caching for static assets.
 */
const CACHE_VERSION = '2026-05-16-realtime-pwa';
const CACHE_PREFIX = 'creature-sandbox';
const CACHE_SHELL = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`;
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css?v=20260516-audit1',
  './src/main.js?v=20260516-audit1',
  './manifest.json'
];

function appUrl(relativePath) {
  return new URL(relativePath, self.registration.scope).toString();
}

const SHELL_ASSETS = APP_SHELL_ASSETS.map(appUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_SHELL && key !== CACHE_DYNAMIC)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (shouldCacheAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function shouldCacheAsset(request, url) {
  if (request.destination && request.destination !== 'document') return true;
  return /\.(?:css|js|mjs|json|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname);
}

async function precacheShell() {
  const cache = await caches.open(CACHE_SHELL);
  await Promise.allSettled(
    SHELL_ASSETS.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (response && response.ok) {
        await cache.put(url, response);
      }
    })
  );
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse && networkResponse.status === 200) {
      await cache.put(appUrl('./index.html'), networkResponse.clone());
      await cache.put(appUrl('./'), networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request) ||
      await cache.match(appUrl('./index.html')) ||
      await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  if (cached) {
    networkFetch.catch(() => null);
    return cached;
  }

  try {
    return await networkFetch;
  } catch (err) {
    if (request.destination === 'image') {
      return new Response('', { status: 204 });
    }
    throw err;
  }
}
