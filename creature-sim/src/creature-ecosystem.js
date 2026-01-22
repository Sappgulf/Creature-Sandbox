/**
 * Creature Ecosystem System
 * Lightweight internal state updates for emergent behavior.
 */
import { clamp } from './utils.js';

export const ECOSYSTEM_STATES = Object.freeze({
  CALM: 'calm',
  CURIOUS: 'curious',
  STRESSED: 'stressed',
  PANICKED: 'panicked',
  RESTING: 'resting'
});

export function createEcosystemState(overrides = {}) {
  return {
    stress: overrides.stress ?? 18,
    energy: overrides.energy ?? 70,
    curiosity: overrides.curiosity ?? 55,
    stability: overrides.stability ?? 70,
    state: overrides.state ?? ECOSYSTEM_STATES.CALM
  };
}

export class CreatureEcosystemSystem {
  constructor(world) {
    this.world = world;
    this._tickAccumulator = 0;
  }

  update(dt) {
    if (!this.world || !this.world.creatures?.length) return;
    this._tickAccumulator += dt;
    if (this._tickAccumulator < 0.2) return;

    const step = clamp(this._tickAccumulator, 0.1, 0.5);
    this._tickAccumulator = 0;

    for (const creature of this.world.creatures) {
      if (!creature || !creature.alive || !creature.ecosystem) continue;
      this.updateCreature(creature, step);
    }
  }

  updateCreature(creature, dt) {
    const eco = creature.ecosystem;
    const speed = Math.hypot(creature.vx || 0, creature.vy || 0);
    const idle = speed < 6 && !creature.isGrabbed;

    const nearby = this._getNearbyCreatures(creature, 70);
    const crowdedCount = Math.max(0, nearby.length - 1);
    const crowdPressure = clamp((crowdedCount - 3) / 6, 0, 1);

    const biome = this.world.getBiomeAt?.(creature.x, creature.y);
    const inCalmBiome = biome?.type === 'meadow' || biome?.type === 'wetland';

    const calmBonus = inCalmBiome ? 1.2 : 1;
    const idleEnergyGain = idle ? 6.5 : 1.5;
    const moveEnergyDrain = idle ? 0.6 : 3.2;

    eco.energy = clamp(eco.energy + (idleEnergyGain - moveEnergyDrain) * dt, 0, 100);
    eco.stability = clamp(
      eco.stability + (idle ? 4.5 : 1.2) * calmBonus * dt - crowdPressure * 4 * dt,
      0,
      100
    );

    const stressDecay = idle ? 4.2 : 2.2;
    const energyStress = eco.energy < 35 ? 2.8 : 0;
    eco.stress = clamp(
      eco.stress + (crowdPressure * 6.5 + energyStress - stressDecay * calmBonus) * dt,
      0,
      100
    );

    const curiosityGain = idle ? 2.8 : 0.8;
    const curiosityPenalty = eco.stress > 55 ? 3.4 : 1.1;
    eco.curiosity = clamp(
      eco.curiosity + (curiosityGain - curiosityPenalty) * dt,
      0,
      100
    );

    this.applySocialContagion(eco, nearby, dt);
    eco.state = this._deriveState(eco);
  }

  registerEvent(creature, type, payload = {}) {
    const eco = creature?.ecosystem;
    if (!eco) return;

    switch (type) {
      case 'impact': {
        const intensity = clamp(payload.intensity ?? 0.4, 0, 1.5);
        eco.stress = clamp(eco.stress + intensity * 18, 0, 100);
        eco.stability = clamp(eco.stability - intensity * 14, 0, 100);
        eco.energy = clamp(eco.energy - intensity * 8, 0, 100);
        break;
      }
      case 'poke': {
        const intensity = clamp(payload.intensity ?? 0.4, 0, 1.2);
        eco.curiosity = clamp(eco.curiosity + intensity * 12, 0, 100);
        eco.stress = clamp(eco.stress + intensity * 6, 0, 100);
        break;
      }
      case 'rest': {
        eco.stress = clamp(eco.stress - 12, 0, 100);
        eco.energy = clamp(eco.energy + 10, 0, 100);
        eco.stability = clamp(eco.stability + 6, 0, 100);
        break;
      }
      default:
        break;
    }

    eco.state = this._deriveState(eco);
  }

  applySocialContagion(eco, nearby, dt) {
    if (!nearby?.length) return;

    let stressed = 0;
    let panicked = 0;
    let calm = 0;

    for (const neighbor of nearby) {
      if (!neighbor.ecosystem || !neighbor.alive) continue;
      const state = neighbor.ecosystem.state;
      if (state === ECOSYSTEM_STATES.PANICKED) panicked++;
      else if (state === ECOSYSTEM_STATES.STRESSED) stressed++;
      else if (state === ECOSYSTEM_STATES.CALM || state === ECOSYSTEM_STATES.RESTING) calm++;
    }

    if (panicked === 0 && stressed === 0 && calm === 0) return;

    const stressDelta = panicked * 1.4 + stressed * 0.6 - calm * 0.4;
    const stabilityDelta = calm * 0.5 - panicked * 0.6;

    eco.stress = clamp(eco.stress + stressDelta * dt, 0, 100);
    eco.stability = clamp(eco.stability + stabilityDelta * dt, 0, 100);
  }

  _getNearbyCreatures(creature, radius) {
    const manager = this.world.creatureManager;
    if (!manager?.queryCreatures) return [];
    return manager.queryCreatures(creature.x, creature.y, radius);
  }

  _deriveState(eco) {
    if (eco.energy < 28 && eco.stress < 35) return ECOSYSTEM_STATES.RESTING;
    if (eco.stress > 78 || eco.stability < 25) return ECOSYSTEM_STATES.PANICKED;
    if (eco.stress > 55) return ECOSYSTEM_STATES.STRESSED;
    if (eco.curiosity > 65 && eco.stress < 45) return ECOSYSTEM_STATES.CURIOUS;
    return ECOSYSTEM_STATES.CALM;
  }
}

export default CreatureEcosystemSystem;
