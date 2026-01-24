import { clamp, rand } from './utils.js';
import { eventSystem, GameEvents } from './event-system.js';

const DEFAULT_MODIFIERS = {
  foodGrowth: 1,
  activity: 1,
  stress: 1,
  migration: 1
};

export class WorldEvents {
  constructor(world) {
    this.world = world;
    this.activeEvent = null;
    this.cooldown = 90; // seconds until another event can start
    this.elapsed = 0;
    this.definitions = {
      food_bloom: {
        label: 'Food Bloom',
        duration: 40,
        cooldown: 140,
        modifiers: { foodGrowth: 1.5 },
        icon: '🌿'
      },
      drought_light: {
        label: 'Dry Spell',
        duration: 45,
        cooldown: 160,
        modifiers: { foodGrowth: 0.7, stress: 1.1 },
        icon: '☀️'
      },
      storm: {
        label: 'Stormfront',
        duration: 35,
        cooldown: 150,
        modifiers: { activity: 0.9, stress: 1.05 },
        icon: '🌩️'
      },
      calm_night: {
        label: 'Calm Night',
        duration: 50,
        cooldown: 140,
        modifiers: { stress: 0.82, migration: 0.95 },
        icon: '🌙'
      },
      migration_wave: {
        label: 'Migration Wave',
        duration: 55,
        cooldown: 170,
        modifiers: { activity: 1.05, migration: 1.2 },
        icon: '🧭'
      }
    };
  }

  resetModifiers() {
    this.world.eventModifiers = { ...DEFAULT_MODIFIERS };
  }

  update(dt) {
    this.elapsed += dt;
    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.activeEvent) {
      this.activeEvent.remaining -= dt;
      if (this.activeEvent.remaining <= 0) {
        this.endEvent();
      }
      return;
    }

    // Rare chance to start an event (very low probability per second)
    const triggerChance = 0.0007 * dt; // ~1 event every ~25-30 minutes on average
    if (this.cooldown <= 0 && Math.random() < triggerChance) {
      this.startRandomEvent();
    }
  }

  startRandomEvent() {
    const keys = Object.keys(this.definitions);
    if (!keys.length) return;
    const type = keys[Math.floor(rand() * keys.length)];
    this.beginEvent(type);
  }

  beginEvent(type) {
    const def = this.definitions[type];
    if (!def) return;

    this.activeEvent = {
      type,
      label: def.label,
      icon: def.icon,
      remaining: def.duration,
      duration: def.duration
    };
    this.cooldown = def.cooldown;

    // Apply modifiers safely
    this.world.eventModifiers = {
      foodGrowth: clamp(def.modifiers.foodGrowth ?? 1, 0.6, 1.6),
      activity: clamp(def.modifiers.activity ?? 1, 0.85, 1.2),
      stress: clamp(def.modifiers.stress ?? 1, 0.7, 1.25),
      migration: clamp(def.modifiers.migration ?? 1, 0.8, 1.35)
    };

    try {
      eventSystem.emit(GameEvents.WORLD_SEASON_CHANGE, { // reuse channel for light announcements
        type: 'world_event',
        event: this.activeEvent
      });
    } catch (_) {
      // Non-critical
    }
  }

  endEvent() {
    if (!this.activeEvent) return;
    this.activeEvent = null;
    this.resetModifiers();
  }
}
