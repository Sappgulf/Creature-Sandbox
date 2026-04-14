import { CreatureConfig } from './creature-config.js';

export const NAME_SUGGESTIONS = [
  'Fizz',
  'Pebble',
  'Wiggle',
  'Pip',
  'Bloop',
  'Ziggy',
  'Sprout',
  'Nib',
  'Mochi',
  'Skitter',
  'Jelly',
  'Nimbus',
  'Gizmo',
  'Sprocket',
  'Noodle'
];

export function pickNameSuggestion(seed) {
  const idx = Math.abs(Math.floor(seed)) % NAME_SUGGESTIONS.length;
  const tag = Math.abs(Math.floor(seed * 37)) % 99;
  return `${NAME_SUGGESTIONS[idx]}-${tag}`;
}

export function determineSenseType(genes) {
  const r = genes.hue / 360;
  if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.NORMAL_MAX) return 'normal';
  if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.CHEMICAL_MAX) return 'chemical';
  if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.THERMAL_MAX) return 'thermal';
  return 'echolocation';
}

export function resolveDietRole(genes) {
  const diet = genes?.diet ?? (genes?.predator ? 1.0 : 0.0);
  if (diet > 0.7) {
    return 'predator-lite';
  }
  if (diet >= 0.3) {
    return Math.random() < 0.55 ? 'scavenger' : 'herbivore';
  }
  return 'herbivore';
}

export function calculateAttractiveness(genes) {
  return (genes.speed * 0.3 +
    genes.sense * 0.002 +
    (2 - genes.metabolism) * 0.2 +
    (genes.predator ? genes.aggression * 0.2 : 1 - genes.metabolism * 0.3));
}

export function pickDesiredTraits(genes) {
  return {
    speed: genes.speed > 1.2,
    sense: genes.sense > 100,
    health: true,
    predator: genes.predator
  };
}
