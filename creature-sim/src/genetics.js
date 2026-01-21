import { clamp, randn } from './utils.js';

// ============================================================================
// ADVANCED GENETICS SYSTEM
// ============================================================================
// Features:
// 1. Diploid genetics (two alleles per gene: dominant/recessive)
// 2. Sexual reproduction with Mendelian inheritance
// 3. Mutation types: beneficial, harmful, neutral
// 4. Genetic disorders
// 5. Sexual dimorphism (male/female differences)
// ============================================================================

// Genetic disorders with their effects
export const GENETIC_DISORDERS = {
  ALBINISM: {
    name: 'Albinism',
    emoji: '🤍',
    chance: 0.02, // 2% chance if both alleles recessive
    effects: {
      hue: 0, // White color
      sense: 0.7, // Reduced vision
      metabolism: 1.15 // Higher metabolism (sun sensitivity)
    }
  },
  HEMOPHILIA: {
    name: 'Hemophilia',
    emoji: '🩸',
    chance: 0.015, // 1.5% chance, sex-linked (males more affected)
    effects: {
      grit: 0.1, // Very low bleed resistance
      health: 0.75 // Reduced max health
    }
  },
  GIGANTISM: {
    name: 'Gigantism',
    emoji: '🦕',
    chance: 0.01, // 1% chance
    effects: {
      size: 1.8, // 80% larger
      metabolism: 1.5, // Much higher energy needs
      speed: 0.85 // Slower
    }
  },
  DWARFISM: {
    name: 'Dwarfism',
    emoji: '🐁',
    chance: 0.01, // 1% chance
    effects: {
      size: 0.6, // 40% smaller
      metabolism: 0.7, // Lower energy needs
      sense: 1.2 // Better senses (compensatory)
    }
  },
  HYPERMETABOLISM: {
    name: 'Hypermetabolism',
    emoji: '⚡',
    chance: 0.025, // 2.5% chance
    effects: {
      metabolism: 2.0, // Double energy consumption
      speed: 1.3, // Faster movement
      aggression: 1.4 // More aggressive (always hungry)
    }
  }
};

// Mutation types with their probabilities and effects
export const MUTATION_TYPES = {
  NEUTRAL: { weight: 0.70, multiplier: 1.0, label: 'Neutral' },
  BENEFICIAL: { weight: 0.15, multiplier: 1.4, label: 'Beneficial ✨' },
  HARMFUL: { weight: 0.15, multiplier: 1.6, label: 'Harmful ☠️', negative: true }
};

/**
 * Create a diploid gene structure with two alleles
 */
export function makeGenes(seed={}) {
  const predator = seed.predator ?? 0;
  const diet = seed.diet ?? (predator ? 1.0 : 0.0);

  // Determine sex (50/50 split unless specified)
  const sex = seed.sex ?? (Math.random() < 0.5 ? 'male' : 'female');

  // Create diploid genes (two alleles per trait)
  // Format: { allele1: value, allele2: value, expressed: dominant_value }
  const genes = {
    sex: sex, // XX = female, XY = male

    // Core physical traits (diploid)
    speed: createDiploidTrait(seed.speed, 0.8, 0.2, 2.0),
    fov: createDiploidTrait(seed.fov, 70, 20, 160),
    sense: createDiploidTrait(seed.sense, 90, 20, 200),
    metabolism: createDiploidTrait(seed.metabolism, 1, 0.4, 2.0),

    // Color (polygenic - average of both alleles)
    hue: {
      allele1: seed.hue ?? Math.floor(Math.random()*360),
      allele2: seed.hue ?? Math.floor(Math.random()*360),
      expressed: null // Will be calculated
    },

    // Diet (co-dominant)
    diet: {
      allele1: seed.diet ?? diet,
      allele2: seed.diet ?? diet,
      expressed: null
    },

    // Behavioral traits (diploid with varying dominance)
    packInstinct: createDiploidTrait(seed.packInstinct, predator ? 0.55 : 0, 0, 1),
    ambushDelay: createDiploidTrait(seed.ambushDelay, predator ? 0.6 : 0.15, 0, 5),
    aggression: createDiploidTrait(seed.aggression, predator ? 1.15 : 0.85, 0.4, 2.2),
    spines: createDiploidTrait(seed.spines, predator ? 0.06 : 0.5, 0, 1),
    herdInstinct: createDiploidTrait(seed.herdInstinct, predator ? 0.12 : 0.6, 0, 1),
    panicPheromone: createDiploidTrait(seed.panicPheromone, predator ? 0.08 : 0.65, 0, 1),
    grit: createDiploidTrait(seed.grit, predator ? 0.65 : 0.1, 0, 1),
    nocturnal: createDiploidTrait(seed.nocturnal, 0.5, 0, 1),
    aquatic: createDiploidTrait(seed.aquatic, predator ? 0.04 : 0.12, 0, 1),

    // Legacy compatibility
    predator: predator,

    // Genetic disorders
    disorders: seed.disorders || [],

    // Mutation tracking
    mutations: seed.mutations || []
  };

  // Calculate expressed traits
  calculateExpressedGenes(genes);

  // Check for genetic disorders
  checkForDisorders(genes);

  return genes;
}

/**
 * Create a diploid trait with two alleles
 */
function createDiploidTrait(seedValue, defaultValue, min, max) {
  if (seedValue !== undefined) {
    return {
      allele1: seedValue,
      allele2: seedValue,
      expressed: seedValue,
      min: min,
      max: max
    };
  }

  // Random alleles with slight variation
  const base = defaultValue + randn(0, defaultValue * 0.1);
  const allele1 = clamp(base + randn(0, defaultValue * 0.15), min, max);
  const allele2 = clamp(base + randn(0, defaultValue * 0.15), min, max);

  return {
    allele1: allele1,
    allele2: allele2,
    expressed: Math.max(allele1, allele2), // Dominant allele
    min: min,
    max: max
  };
}

/**
 * Calculate which alleles are expressed (phenotype from genotype)
 */
function calculateExpressedGenes(genes) {
  // Most traits: dominant allele is expressed (max value)
  for (const key of Object.keys(genes)) {
    const trait = genes[key];
    if (trait && typeof trait === 'object' && 'allele1' in trait && 'allele2' in trait) {
      if (key === 'hue') {
        // Color is polygenic (average of both alleles)
        trait.expressed = Math.floor((trait.allele1 + trait.allele2) / 2) % 360;
      } else if (key === 'diet') {
        // Diet is co-dominant (average)
        trait.expressed = (trait.allele1 + trait.allele2) / 2;
      } else {
        // Most traits: dominant allele (max value wins)
        trait.expressed = Math.max(trait.allele1, trait.allele2);
      }
    }
  }

  // Sexual dimorphism: males and females have different trait expressions
  if (genes.sex === 'male') {
    // Males: Higher speed, aggression, lower metabolism
    genes.speed.expressed *= 1.1;
    genes.aggression.expressed *= 1.15;
    genes.metabolism.expressed *= 0.95;
  } else {
    // Females: Higher sense, grit, metabolism (for reproduction)
    genes.sense.expressed *= 1.08;
    genes.grit.expressed = Math.min(1, genes.grit.expressed * 1.12);
    genes.metabolism.expressed *= 1.05;
  }
}

/**
 * Check for genetic disorders based on allele combinations
 */
function checkForDisorders(genes) {
  genes.disorders = [];

  // Check each disorder
  for (const [key, disorder] of Object.entries(GENETIC_DISORDERS)) {
    let hasDisorder = false;

    if (key === 'HEMOPHILIA') {
      // Hemophilia is sex-linked (X chromosome)
      // Males (XY) only need one recessive allele
      // Females (XX) need two recessive alleles
      if (genes.sex === 'male') {
        hasDisorder = Math.random() < disorder.chance * 2;
      } else {
        hasDisorder = Math.random() < disorder.chance * 0.5;
      }
    } else {
      // Other disorders: need two recessive alleles
      hasDisorder = Math.random() < disorder.chance;
    }

    if (hasDisorder) {
      genes.disorders.push(key);
    }
  }
}

/**
 * Apply genetic disorder effects to expressed genes
 * OPTIMIZATION: Only process if disorders exist, minimize object spread
 */
export function applyDisorderEffects(genes) {
  if (!genes.disorders || genes.disorders.length === 0) return genes;

  // OPTIMIZATION: Modify in-place if no disorders
  const disordersCount = genes.disorders.length;
  if (disordersCount === 0) return genes;

  // Only spread if we actually have disorders
  const modifiedGenes = { ...genes };

  for (let i = 0; i < disordersCount; i++) {
    const disorderKey = genes.disorders[i];
    const disorder = GENETIC_DISORDERS[disorderKey];
    if (!disorder) continue;

    // Apply each effect (optimized loop)
    const effects = disorder.effects;
    const effectKeys = Object.keys(effects);
    for (let j = 0, len = effectKeys.length; j < len; j++) {
      const trait = effectKeys[j];
      const multiplier = effects[trait];

      if (trait === 'hue') {
        modifiedGenes.hue.expressed = multiplier;
      } else if (trait === 'size' || trait === 'health') {
        // These are applied in creature.js
        modifiedGenes[trait + 'Modifier'] = multiplier;
      } else if (modifiedGenes[trait] && typeof modifiedGenes[trait] === 'object') {
        modifiedGenes[trait].expressed *= multiplier;
        modifiedGenes[trait].expressed = clamp(
          modifiedGenes[trait].expressed,
          modifiedGenes[trait].min,
          modifiedGenes[trait].max
        );
      }
    }
  }

  return modifiedGenes;
}

/**
 * Sexual reproduction: combine two parents' genes using Mendelian inheritance
 */
export function breedGenes(parent1Genes, parent2Genes, mutationRate = 0.05) {
  const childGenes = {};

  // Determine sex (50/50 from sex chromosomes)
  childGenes.sex = Math.random() < 0.5 ? 'male' : 'female';

  // For each trait, randomly inherit one allele from each parent
  for (const key of Object.keys(parent1Genes)) {
    const trait1 = parent1Genes[key];
    const trait2 = parent2Genes[key];

    // Skip non-genetic properties
    if (key === 'sex' || key === 'disorders' || key === 'mutations' || key === 'predator') {
      continue;
    }

    if (trait1 && typeof trait1 === 'object' && 'allele1' in trait1) {
      // Mendelian inheritance: randomly pick one allele from each parent
      const inheritedAllele1 = Math.random() < 0.5 ? trait1.allele1 : trait1.allele2;
      const inheritedAllele2 = Math.random() < 0.5 ? trait2.allele1 : trait2.allele2;

      childGenes[key] = {
        allele1: inheritedAllele1,
        allele2: inheritedAllele2,
        expressed: null, // Will be calculated
        min: trait1.min,
        max: trait1.max
      };
    }
  }

  // Legacy predator trait
  childGenes.predator = parent1Genes.predator || parent2Genes.predator;

  // Initialize disorder and mutation tracking
  childGenes.disorders = [];
  childGenes.mutations = [];

  // Apply mutations (returns new object, so we use a new const)
  const mutatedChildGenes = applyMutations(childGenes, mutationRate);

  // Calculate expressed traits
  calculateExpressedGenes(mutatedChildGenes);

  // Check for disorders
  checkForDisorders(mutatedChildGenes);

  return mutatedChildGenes;
}

/**
 * Enhanced mutation system with beneficial/harmful/neutral mutations
 */
export function applyMutations(genes, mutationRate = 0.05) {
  const mutatedGenes = { ...genes };
  mutatedGenes.mutations = [...(genes.mutations || [])];

  // For each gene, chance of mutation
  for (const key of Object.keys(genes)) {
    const trait = genes[key];

    if (trait && typeof trait === 'object' && 'allele1' in trait && Math.random() < mutationRate) {
      // Determine mutation type
      const mutationType = selectMutationType();
      const mutation = MUTATION_TYPES[mutationType];

      // Randomly mutate one or both alleles
      if (Math.random() < 0.5) {
        mutatedGenes[key].allele1 = mutateValue(
          trait.allele1,
          trait.min,
          trait.max,
          mutation
        );
      } else {
        mutatedGenes[key].allele2 = mutateValue(
          trait.allele2,
          trait.min,
          trait.max,
          mutation
        );
      }

      // Track the mutation
      mutatedGenes.mutations.push({
        trait: key,
        type: mutationType,
        generation: mutatedGenes.mutations.length
      });

      // Keep only recent mutations (last 5)
      if (mutatedGenes.mutations.length > 5) {
        mutatedGenes.mutations.shift();
      }
    }
  }

  return mutatedGenes;
}

/**
 * Select a mutation type based on probabilities
 */
function selectMutationType() {
  const roll = Math.random();
  let cumulative = 0;

  for (const [type, data] of Object.entries(MUTATION_TYPES)) {
    cumulative += data.weight;
    if (roll < cumulative) {
      return type;
    }
  }

  return 'NEUTRAL';
}

/**
 * Mutate a single value
 */
function mutateValue(value, min, max, mutation) {
  const range = max - min;
  const mutationAmount = range * 0.06 * mutation.multiplier;

  let newValue;
  if (mutation.negative) {
    // Harmful mutation: tends to make traits worse
    newValue = value + randn(0, mutationAmount) * (Math.random() < 0.5 ? -1 : 1);
    // Bias toward moving away from optimal range
    if (value > (min + max) / 2) {
      newValue = value + Math.abs(randn(0, mutationAmount));
    } else {
      newValue = value - Math.abs(randn(0, mutationAmount));
    }
  } else {
    // Beneficial or neutral mutation
    newValue = value + randn(0, mutationAmount);
  }

  return clamp(newValue, min, max);
}

/**
 * Legacy function for backward compatibility
 * Converts old asexual mutation to new diploid system
 */
export function mutateGenes(genes, amt=0.06) {
  // If already diploid, use sexual reproduction system
  if (genes.speed && typeof genes.speed === 'object' && 'allele1' in genes.speed) {
    return applyMutations(genes, amt);
  }

  // Convert old haploid genes to diploid
  const diploidGenes = makeGenes(genes);
  return applyMutations(diploidGenes, amt);
}

/**
 * Convert diploid genes to simple format for display/compatibility
 * OPTIMIZATION: Cache results, only recompute when genes change
 */
const expressedGenesCache = new WeakMap();

export function getExpressedGenes(genes) {
  // Check cache first
  const cached = expressedGenesCache.get(genes);
  if (cached) return cached;

  const simple = {
    sex: genes.sex,
    predator: genes.predator,
    disorders: genes.disorders || [],
    mutations: genes.mutations || []
  };

  // OPTIMIZATION: Use for-in loop instead of Object.entries
  for (const key in genes) {
    const value = genes[key];
    if (value && typeof value === 'object' && 'expressed' in value) {
      simple[key] = value.expressed;
    } else if (typeof value !== 'object') {
      simple[key] = value;
    }
  }

  // Cache result
  expressedGenesCache.set(genes, simple);
  return simple;
}

/**
 * Get genetic information for UI display
 */
export function getGeneticInfo(genes) {
  const info = {
    sex: genes.sex,
    sexEmoji: genes.sex === 'male' ? '♂️' : '♀️',
    disorders: genes.disorders || [],
    disorderLabels: (genes.disorders || []).map(d => GENETIC_DISORDERS[d]?.emoji + ' ' + GENETIC_DISORDERS[d]?.name),
    mutations: genes.mutations || [],
    recentMutation: genes.mutations && genes.mutations.length > 0
      ? MUTATION_TYPES[genes.mutations[genes.mutations.length - 1].type]?.label
      : null
  };

  return info;
}
