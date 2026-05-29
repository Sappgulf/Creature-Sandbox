/**
 * Bootstrap Runtime Selection
 * Handles worker vs main-thread fallback decision with storage + query param support.
 * Extracted from app-bootstrap.js for clarity and testability.
 */

const RUNTIME_MODE_STORAGE_KEY = 'creature-sandbox-runtime-mode';
const DEFAULT_RUNTIME_MODE = 'worker';

export function normalizeRuntimeMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  if (mode === '1' || mode === 'true' || mode === 'worker') return 'worker';
  if (mode === '0' || mode === 'false' || mode === 'main') return 'main';
  return null;
}

export function readStoredRuntimeMode() {
  try {
    return normalizeRuntimeMode(window.localStorage?.getItem(RUNTIME_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredRuntimeMode(mode) {
  const normalized = normalizeRuntimeMode(mode);
  if (!normalized) return null;
  try {
    window.localStorage?.setItem(RUNTIME_MODE_STORAGE_KEY, normalized);
  } catch {
    return null;
  }
  return normalized;
}

export function getRuntimeModePreference() {
  if (typeof window === 'undefined') {
    return { mode: DEFAULT_RUNTIME_MODE, source: 'default', stored: null };
  }
  const params = new URLSearchParams(window.location.search);
  const queryMode = normalizeRuntimeMode(params.get('worker'));
  if (queryMode) {
    return { mode: queryMode, source: 'query', stored: readStoredRuntimeMode() };
  }
  const stored = readStoredRuntimeMode();
  if (stored) {
    return { mode: stored, source: 'storage', stored };
  }
  return { mode: DEFAULT_RUNTIME_MODE, source: 'default', stored: null };
}

export const RUNTIME_DEFAULT = DEFAULT_RUNTIME_MODE;
