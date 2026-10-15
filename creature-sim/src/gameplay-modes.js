import { eventSystem, GameEvents } from './event-system.js';

export const GAMEPLAY_MODES = [
  {
    id: 'chill',
    // Absolute food knob (environment.foodRateMultiplier). Mode food was multiplicative
    // in place, so repeated applies compounded and balanced never reset it.
    foodRate: 1.25,
    name: 'Chill Sandbox',
    icon: '🧘',
    description:
      'Maximum food, gentle predators, and no surprise disasters. Perfect for experimentation and sightseeing.',
    tags: ['Relaxed pace', 'Auto-balance+', 'Disasters off'],
    apply(world) {
      if (!world) return;
      world.randomDisasters = false;
      world.disasterCooldown = 9999;
      world.disasterIntensity = 1;
      world.autoBalanceSettings.enabled = true;
      world.autoBalanceSettings.minPopulation = 40;
      world.autoBalanceSettings.targetPredatorRatio = 0.18;
      world.autoBalanceSettings.maxPredators = 10;
      world.autoBalanceSettings.targetFoodFraction = 0.65;
      world.autoBalanceSettings.minFoodAbsolute = 220;
      world.seasonSpeed = 0.012;
      world.dayLength = 140;
    }
  },
  {
    id: 'balanced',
    foodRate: 1,
    name: 'Balanced Evolution',
    icon: '⚖️',
    description: 'Default tuning with seasonal swings, measured disasters, and steady evolution pressure.',
    tags: ['Seasons on', 'Fair disasters', 'Steady growth'],
    apply(world) {
      if (!world) return;
      world.randomDisasters = true;
      // 40s between random disasters (each lasting 90-150s) kept the world in
      // a disaster about half the time; "measured" means a few per session.
      world.disasterCooldown = 180;
      world.disasterIntensity = 1;
      world.autoBalanceSettings.enabled = true;
      world.autoBalanceSettings.minPopulation = 36;
      world.autoBalanceSettings.targetPredatorRatio = 0.24;
      world.autoBalanceSettings.maxPredators = 16;
      world.autoBalanceSettings.targetFoodFraction = 0.5;
      world.autoBalanceSettings.minFoodAbsolute = 180;
      world.seasonSpeed = 0.015;
      world.dayLength = 120;
    }
  },
  {
    id: 'frontier',
    // Base food: frontier's population comes from its minPopulation floor. A 1.05
    // food knob measured no change in population or starvation, so it was not kept.
    foodRate: 1,
    name: 'Frontier Rush',
    icon: '🧭',
    description:
      'A volatile frontier with bigger populations, denser props pressure, and faster day/night cycles for high-replay runs.',
    tags: ['Population+', 'Tempo+', 'Disasters medium'],
    apply(world) {
      if (!world) return;
      world.randomDisasters = true;
      world.disasterCooldown = 24;
      world.disasterIntensity = 1.1;
      world.autoBalanceSettings.enabled = true;
      world.autoBalanceSettings.minPopulation = 54;
      world.autoBalanceSettings.maxPredators = 22;
      world.autoBalanceSettings.targetPredatorRatio = 0.27;
      world.autoBalanceSettings.targetFoodFraction = 0.44;
      world.autoBalanceSettings.minFoodAbsolute = 220;
      world.seasonSpeed = 0.02;
      world.dayLength = 100;
    }
  },
  {
    id: 'mayhem',
    foodRate: 0.8,
    name: 'Cataclysm',
    icon: '🔥',
    description: 'Crank up predator aggression, disasters, and weather for a desperate fight for survival.',
    tags: ['Disasters++', 'Predators hungry', 'Fast seasons'],
    apply(world) {
      if (!world) return;
      world.randomDisasters = true;
      world.disasterCooldown = 10;
      world.disasterIntensity = 1.35;
      world.autoBalanceSettings.enabled = false;
      world.autoBalanceSettings.maxPredators = 28;
      world.seasonSpeed = 0.022;
      world.dayLength = 90;
    }
  }
];

export class GameplayModes {
  constructor(world, { notifications = null, audio = null } = {}) {
    this.world = world;
    this.notifications = notifications;
    this.audio = audio;
    this.activeMode = GAMEPLAY_MODES[1]; // Default to balanced

    this.applyMode(this.activeMode.id, { announce: false });
  }

  getModes() {
    return GAMEPLAY_MODES;
  }

  getActiveMode() {
    return this.activeMode;
  }

  applyMode(id, { announce = true } = {}) {
    const next = GAMEPLAY_MODES.find(m => m.id === id) || GAMEPLAY_MODES[0];
    this.activeMode = next;
    if (typeof next.apply === 'function') {
      next.apply(this.world);
    }
    this.syncFoodRate(next);

    eventSystem.emit(GameEvents.GAME_MODE_CHANGED, {
      id: next.id,
      name: next.name,
      icon: next.icon,
      description: next.description,
      tags: next.tags
    });

    if (announce && this.notifications?.show) {
      this.notifications.show(`${next.icon} ${next.name}`, 'info', 2400);
    }
    if (announce && this.audio?.playUISound) {
      this.audio.playUISound('toggle');
    }
  }

  /**
   * Write the mode's food rate into the world. A world reset rebuilds the
   * environment (back to 1), and a scenario writes its own foodRate, so the
   * sandbox calls this after a reseed and when a scenario run is left.
   */
  syncFoodRate(mode = this.activeMode) {
    const environment = this.world?.environment;
    if (environment && Number.isFinite(mode?.foodRate)) {
      environment.foodRateMultiplier = mode.foodRate;
    }
  }

  cycleMode(direction = 1) {
    const modes = this.getModes();
    const idx = modes.findIndex(m => m.id === this.activeMode?.id);
    const nextIdx = (idx + direction + modes.length) % modes.length;
    this.applyMode(modes[nextIdx].id);
  }
}
