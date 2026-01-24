import { clamp } from './utils.js';

// Temperament helpers (values 0..1, clamped)
export function generateTemperament(seed = {}) {
  const base = () => Math.random();
  return {
    boldness: clamp(seed.boldness ?? base(), 0, 1),
    sociability: clamp(seed.sociability ?? base(), 0, 1),
    calmness: clamp(seed.calmness ?? base(), 0, 1),
    curiosity: clamp(seed.curiosity ?? base(), 0, 1)
  };
}

export function blendTemperament(parentA, parentB) {
  const safe = (val) => clamp(val, 0, 1);
  const jitter = () => (Math.random() - 0.5) * 0.12; // small bounded mutation
  const avg = (a, b) => ((a ?? 0.5) + (b ?? 0.5)) * 0.5;

  return {
    boldness: safe(avg(parentA?.boldness, parentB?.boldness) + jitter()),
    sociability: safe(avg(parentA?.sociability, parentB?.sociability) + jitter()),
    calmness: safe(avg(parentA?.calmness, parentB?.calmness) + jitter()),
    curiosity: safe(avg(parentA?.curiosity, parentB?.curiosity) + jitter())
  };
}

// Quirk catalog and helpers
export const QUIRK_LIBRARY = [
  { id: 'wanderer', label: 'Wanderer' },
  { id: 'homebody', label: 'Homebody' },
  { id: 'squeamish', label: 'Squeamish' },
  { id: 'sturdy', label: 'Sturdy' },
  { id: 'bouncy', label: 'Bouncy' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'greedy', label: 'Greedy' },
  { id: 'night_owl', label: 'Night Owl' },
  { id: 'social_butterfly', label: 'Social Butterfly' }
];

const QUIRK_WEIGHTS = {
  wanderer: 1.1,
  homebody: 1.0,
  squeamish: 0.9,
  sturdy: 0.9,
  bouncy: 0.8,
  dramatic: 0.7,
  greedy: 1.0,
  night_owl: 0.8,
  social_butterfly: 1.0
};

export function rollQuirks(max = 2) {
  const pool = [...QUIRK_LIBRARY];
  const chosen = [];
  const count = Math.random() < 0.25 ? 1 : 2; // 0–2 quirks, biased to 1
  const target = Math.min(max, count);

  for (let i = 0; i < target && pool.length; i++) {
    const totalWeight = pool.reduce((sum, q) => sum + (QUIRK_WEIGHTS[q.id] ?? 1), 0);
    let pick = Math.random() * totalWeight;
    let selectedIndex = 0;
    for (let j = 0; j < pool.length; j++) {
      const weight = QUIRK_WEIGHTS[pool[j].id] ?? 1;
      if (pick <= weight) {
        selectedIndex = j;
        break;
      }
      pick -= weight;
    }
    chosen.push(pool[selectedIndex].id);
    pool.splice(selectedIndex, 1);
  }

  return chosen;
}

export function inheritQuirks(parentA, parentB) {
  const inherited = [];
  const addSafe = (id) => {
    if (id && !inherited.includes(id) && inherited.length < 2) {
      inherited.push(id);
    }
  };

  if (parentA?.quirks?.length) {
    addSafe(parentA.quirks[Math.floor(Math.random() * parentA.quirks.length)]);
  }
  if (parentB?.quirks?.length && Math.random() < 0.6) {
    addSafe(parentB.quirks[Math.floor(Math.random() * parentB.quirks.length)]);
  }

  while (inherited.length < 2) {
    const roll = rollQuirks(1)[0];
    addSafe(roll);
    if (Math.random() < 0.4) break;
  }

  return inherited;
}
