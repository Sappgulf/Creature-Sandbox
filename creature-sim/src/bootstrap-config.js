/**
 * bootstrap-config.js — Platform detection, dev tools, and startup config helpers.
 */
import { getDebugFlags } from './debug-flags.js';

const DESKTOP_STARTUP_SEED = { herbivores: 64, predators: 8, food: 280 };
const MOBILE_STARTUP_SEED = { herbivores: 54, predators: 7, food: 230 };
const COMPACT_MOBILE_STARTUP_SEED = { herbivores: 44, predators: 5, food: 190 };
const MAIN_THREAD_DESKTOP_STARTUP_SEED = { herbivores: 54, predators: 7, food: 240 };
const MAIN_THREAD_MOBILE_STARTUP_SEED = { herbivores: 44, predators: 5, food: 190 };

export function getDevToolsConfig() {
  if (typeof window === 'undefined') return { enabled: false, timingLogs: false, fpsOverlay: false };
  const debugFlags = getDebugFlags();
  const params = new URLSearchParams(window.location.search);
  const enabled = debugFlags.enabled;
  const fpsOverlay =
    enabled && (params.has('fps') || localStorage.getItem('creature-sim-fps') === 'true' || params.has('devtools'));
  const timingLogs = enabled && (params.has('timing') || localStorage.getItem('creature-sim-timing') === 'true');
  const timingLogInterval = Number(params.get('timingInterval') || 5000) || 5000;
  return {
    enabled,
    fpsOverlay,
    timingLogs,
    timingLogInterval,
    spawnDebug: debugFlags.spawnDebug,
    renderDebug: debugFlags.renderDebug
  };
}

export function createDevFpsOverlay(enabled) {
  if (!enabled || typeof document === 'undefined') return null;
  const overlay = document.createElement('div');
  overlay.id = 'dev-fps';
  overlay.className = 'dev-fps';
  overlay.setAttribute('aria-live', 'polite');
  overlay.textContent = 'FPS --';
  document.body.appendChild(overlay);
  return overlay;
}

export function getRuntimeProfile() {
  if (typeof window === 'undefined') {
    return {
      mobile: false,
      compact: false,
      lowMemory: false,
      renderScale: 1,
      defaultZoom: 0.38,
      openingZoom: 0.9,
      startupSeed: DESKTOP_STARTUP_SEED
    };
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  const mobileViewport = coarsePointer || window.matchMedia?.('(max-width: 768px)').matches;
  const shortEdge = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const compactViewport = mobileViewport && shortEdge > 0 && shortEdge <= 430;
  const deviceMemory = Number(navigator.deviceMemory || 0);
  const lowMemory = mobileViewport && deviceMemory > 0 && deviceMemory <= 4;
  const renderScale = mobileViewport ? (compactViewport || lowMemory ? 0.82 : 0.9) : 0.82;

  return {
    mobile: mobileViewport,
    compact: compactViewport,
    lowMemory,
    renderScale,
    defaultZoom: mobileViewport ? 0.4 : 0.38,
    openingZoom: mobileViewport ? (compactViewport ? 0.68 : 0.74) : 0.9,
    startupSeed:
      compactViewport || lowMemory
        ? COMPACT_MOBILE_STARTUP_SEED
        : mobileViewport
          ? MOBILE_STARTUP_SEED
          : DESKTOP_STARTUP_SEED
  };
}

export function getStartupSeedForRuntime(runtimeProfile, useWorker) {
  if (useWorker) return runtimeProfile.startupSeed;
  if (runtimeProfile.mobile) return MAIN_THREAD_MOBILE_STARTUP_SEED;
  return MAIN_THREAD_DESKTOP_STARTUP_SEED;
}
