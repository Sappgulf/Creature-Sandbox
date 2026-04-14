/**
 * Simulation State - Defines the binary memory layout for creature synchronization.
 * This allows super-fast data transfer between the worker and main thread.
 */

// Each creature takes 16 floats in the buffer
// (Packed as Float32Array)
export const CREATURE_STRIDE = 16;

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
  LUCKY: 15     // Flags (mutation, etc)
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
  buffer[o + LAYOUT.PREDATOR] = creature.genes.predator ? 1 : 0;
  buffer[o + LAYOUT.DIET] = creature.genes.diet || 0;
  buffer[o + LAYOUT.HUE] = creature.genes.hue || 0;
  buffer[o + LAYOUT.ALIVE] = creature.alive ? 1 : 0;

  // Pack age stage
  let stage = 2; // adult
  if (creature.ageStage === 'baby') stage = 0;
  else if (creature.ageStage === 'juvenile') stage = 1;
  else if (creature.ageStage === 'elder') stage = 3;
  buffer[o + LAYOUT.AGE_STAGE] = stage;

  buffer[o + LAYOUT.LUCKY] = creature.genes._luckyMutation ? 1 : 0;
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
    genes: {
      predator: buffer[o + LAYOUT.PREDATOR] > 0.5,
      diet: buffer[o + LAYOUT.DIET],
      hue: buffer[o + LAYOUT.HUE],
      _luckyMutation: buffer[o + LAYOUT.LUCKY] > 0.5
    }
  };
}
