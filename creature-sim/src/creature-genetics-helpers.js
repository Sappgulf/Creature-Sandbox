import { CreatureConfig } from './creature-config.js';

/**
 * Read a numeric gene trait from haploid or diploid gene objects.
 * @param {Record<string, unknown>|null|undefined} genes
 * @param {string} key
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function geneValue(genes, key, fallback = 0) {
  const value = genes?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && Number.isFinite(value.expressed)) return value.expressed;
  return fallback;
}

export function isPredatorFromGenes(genes) {
  if (!genes) return false;
  return !!genes.predator || geneValue(genes, 'diet', 0) > 0.7;
}

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
  const r = geneValue(genes, 'hue', 0) / 360;
  if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.NORMAL_MAX) return 'normal';
  if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.CHEMICAL_MAX) return 'chemical';
  if (r < CreatureConfig.GENETICS.SENSE_TYPE_THRESHOLDS.THERMAL_MAX) return 'thermal';
  return 'echolocation';
}

export function resolveDietRole(genes) {
  const diet = geneValue(genes, 'diet', genes?.predator ? 1.0 : 0.0);
  if (diet > 0.7) {
    return 'predator-lite';
  }
  if (diet >= 0.3) {
    return Math.random() < 0.55 ? 'scavenger' : 'herbivore';
  }
  return 'herbivore';
}

export function calculateAttractiveness(genes) {
  const speed = geneValue(genes, 'speed', 1);
  const sense = geneValue(genes, 'sense', 90);
  const metabolism = geneValue(genes, 'metabolism', 1);
  const aggression = geneValue(genes, 'aggression', 0.85);
  return (
    speed * 0.3 + sense * 0.002 + (2 - metabolism) * 0.2 + (genes?.predator ? aggression * 0.2 : 1 - metabolism * 0.3)
  );
}

export function pickDesiredTraits(genes) {
  return {
    speed: geneValue(genes, 'speed', 1) > 1.2,
    sense: geneValue(genes, 'sense', 90) > 100,
    health: true,
    predator: !!genes?.predator
  };
}
