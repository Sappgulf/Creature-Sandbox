// @ts-check
/**
 * Seed utilities for sharing world configurations via URL.
 */
const SEED_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Encode a world seed object into a compact URL-safe string.
 * @param {{ herbivores: number, predators: number, food: number, chaos?: number, mode?: string }} seed
 * @returns {string}
 */
export function encodeSeed(seed) {
  const parts = [seed.herbivores.toString(36), seed.predators.toString(36), seed.food.toString(36)];
  if (seed.chaos !== undefined) parts.push(Math.round(seed.chaos * 100).toString(36));
  if (seed.mode) parts.push(seed.mode);
  return parts.join('-');
}

/**
 * Decode a seed string back into a world config object.
 * @param {string} str
 * @returns {{ herbivores: number, predators: number, food: number, chaos?: number, mode?: string } | null}
 */
export function decodeSeed(str) {
  try {
    const parts = str.split('-');
    const result = {
      herbivores: parseInt(parts[0], 36) || 64,
      predators: parseInt(parts[1], 36) || 8,
      food: parseInt(parts[2], 36) || 280
    };
    if (parts[3]) {
      const chaosVal = parseInt(parts[3], 36);
      if (!Number.isNaN(chaosVal)) result.chaos = chaosVal / 100;
    }
    if (parts[4]) result.mode = parts[4];
    return result;
  } catch {
    return null;
  }
}

/**
 * Generate a random friendly seed string.
 * @returns {string}
 */
export function generateRandomSeed() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  }
  return s;
}

/**
 * Read seed from current URL hash or search params.
 * @returns {{ herbivores: number, predators: number, food: number, chaos?: number, mode?: string } | null}
 */
export function getSeedFromUrl() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (hash && hash.startsWith('seed=')) {
    return decodeSeed(hash.slice(5));
  }
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get('seed');
  if (seedParam) return decodeSeed(seedParam);
  return null;
}

/**
 * Write seed into URL hash.
 * @param {string} seedStr
 */
export function setSeedInUrl(seedStr) {
  if (typeof window === 'undefined') return;
  try {
    window.history.replaceState(null, '', `#seed=${seedStr}`);
  } catch {
    // Ignore if history API fails
  }
}
