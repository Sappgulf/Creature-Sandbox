import { geneValue } from './creature-genetics-helpers.js';

/**
 * Simulation State - Defines the binary memory layout for creature synchronization.
 * This allows super-fast data transfer between the worker and main thread.
 */

// Each creature takes 21 floats in the buffer
// (Packed as Float32Array)
export const CREATURE_STRIDE = 21;

export const LAYOUT = {
  ID: 0,
  X: 1,
  Y: 2,
  DIR: 3,
  VX: 4,
  VY: 5,
  ENERGY: 6,
  HEALTH: 7,
  AGE: 8,
  SIZE: 9,
  PREDATOR: 10, // 0 or 1
  DIET: 11,
  HUE: 12,
  ALIVE: 13,
  AGE_STAGE: 14, // Packed int: 0: baby, 1: juvenile, 2: adult, 3: elder
  LUCKY: 15, // Flags (mutation, etc)
  // Needs travel with the creature because objective metrics are computed on
  // the main thread from this snapshot. Without them every stress- and
  // hunger-based objective reads a constant 0 in worker mode, which is the
  // shipping default. Both are 0-100, matching Creature.needs.
  STRESS: 16,
  HUNGER: 17,
  // Variant genes. collectGameplayMetrics counts aquatic/flying/burrowing
  // creatures straight off genes, so without these the worker runtime — the
  // shipping default — reported variantsAlive as 0 no matter what was in the
  // world, which also zeroed the diversity term in biomeHealthScore.
  AQUATIC: 18,
  FLYING: 19,
  BURROWING: 20
};

/**
 * Creates a buffer large enough for N creatures
 */
export function createCreatureBuffer(count) {
  return new Float32Array(count * CREATURE_STRIDE);
}

/**
 * Pack a creature object into the buffer at the given index
 */
export function packCreature(creature, buffer, index) {
  const o = index * CREATURE_STRIDE;
  buffer[o + LAYOUT.ID] = creature.id || 0;
  buffer[o + LAYOUT.X] = creature.x;
  buffer[o + LAYOUT.Y] = creature.y;
  buffer[o + LAYOUT.DIR] = creature.dir;
  buffer[o + LAYOUT.VX] = creature.vx;
  buffer[o + LAYOUT.VY] = creature.vy;
  buffer[o + LAYOUT.ENERGY] = creature.energy;
  buffer[o + LAYOUT.HEALTH] = creature.health;
  buffer[o + LAYOUT.AGE] = creature.age;
  buffer[o + LAYOUT.SIZE] = creature.size || 0;
  buffer[o + LAYOUT.PREDATOR] = creature.genes?.predator ? 1 : 0;
  buffer[o + LAYOUT.DIET] = geneValue(creature.genes, 'diet', creature.genes?.predator ? 1 : 0);
  buffer[o + LAYOUT.HUE] = geneValue(creature.genes, 'hue', 0);
  buffer[o + LAYOUT.ALIVE] = creature.alive ? 1 : 0;

  // Pack age stage
  let stage = 2; // adult
  if (creature.ageStage === 'baby') stage = 0;
  else if (creature.ageStage === 'juvenile') stage = 1;
  else if (creature.ageStage === 'elder') stage = 3;
  buffer[o + LAYOUT.AGE_STAGE] = stage;

  buffer[o + LAYOUT.LUCKY] = creature.genes?._luckyMutation ? 1 : 0;
  buffer[o + LAYOUT.STRESS] = Number(creature.needs?.stress ?? creature.ecosystem?.stress ?? 0);
  buffer[o + LAYOUT.HUNGER] = Number(creature.needs?.hunger ?? 0);
  buffer[o + LAYOUT.AQUATIC] = geneValue(creature.genes, 'aquatic', 0);
  buffer[o + LAYOUT.FLYING] = geneValue(creature.genes, 'flying', 0);
  buffer[o + LAYOUT.BURROWING] = geneValue(creature.genes, 'burrowing', 0);
}

/**
 * Compact a creature for worker→main thread event bridging.
 * @param {any} creature
 * @returns {any}
 */
export function compactCreature(creature) {
  if (!creature || typeof creature !== 'object') return creature ?? null;
  return {
    id: creature.id ?? null,
    x: Number(creature.x ?? 0),
    y: Number(creature.y ?? 0),
    age: Number(creature.age ?? 0),
    energy: Number(creature.energy ?? 0),
    alive: creature.alive !== false,
    species: creature.species || creature.kind || null,
    parentId: creature.parentId ?? null,
    genes: {
      predator: !!creature.genes?.predator,
      diet: geneValue(creature.genes, 'diet', creature.genes?.predator ? 1 : 0),
      hue: geneValue(creature.genes, 'hue', 0),
      speed: geneValue(creature.genes, 'speed', 0),
      sense: geneValue(creature.genes, 'sense', 0)
    }
  };
}

/**
 * Unpack buffer data into a plain object (for renderer)
 */
export function unpackCreature(buffer, index) {
  const o = index * CREATURE_STRIDE;
  const stageInt = buffer[o + LAYOUT.AGE_STAGE];
  const STAGES = ['baby', 'juvenile', 'adult', 'elder'];

  return {
    id: buffer[o + LAYOUT.ID],
    x: buffer[o + LAYOUT.X],
    y: buffer[o + LAYOUT.Y],
    dir: buffer[o + LAYOUT.DIR],
    vx: buffer[o + LAYOUT.VX],
    vy: buffer[o + LAYOUT.VY],
    energy: buffer[o + LAYOUT.ENERGY],
    health: buffer[o + LAYOUT.HEALTH],
    age: buffer[o + LAYOUT.AGE],
    size: buffer[o + LAYOUT.SIZE],
    alive: buffer[o + LAYOUT.ALIVE] > 0.5,
    ageStage: STAGES[stageInt] || 'adult',
    // Shaped as `needs` so main-thread metric code reads worker creatures and
    // real Creature instances through the same path.
    needs: {
      stress: buffer[o + LAYOUT.STRESS],
      hunger: buffer[o + LAYOUT.HUNGER]
    },
    genes: {
      predator: buffer[o + LAYOUT.PREDATOR] > 0.5,
      diet: buffer[o + LAYOUT.DIET],
      hue: buffer[o + LAYOUT.HUE],
      aquatic: buffer[o + LAYOUT.AQUATIC],
      flying: buffer[o + LAYOUT.FLYING],
      burrowing: buffer[o + LAYOUT.BURROWING],
      _luckyMutation: buffer[o + LAYOUT.LUCKY] > 0.5
    }
  };
}
