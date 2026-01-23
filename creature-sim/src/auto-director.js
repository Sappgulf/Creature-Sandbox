import { eventSystem, GameEvents } from './event-system.js';
import { gameState } from './game-state.js';
import { clamp } from './utils.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';

export class AutoDirector {
  constructor({ world, camera } = {}) {
    this.world = world;
    this.camera = camera;
    this.enabled = true;
    this.cooldownSeconds = 2.4;
    this.lastFocusAt = -Infinity;
    this.lastFocus = null;
    this.eventCooldowns = new Map();
    this.eventCooldownSeconds = {
      [GameEvents.CREATURE_BORN]: 1.6,
      [GameEvents.CREATURE_EAT]: 1.8,
      [GameEvents.CREATURE_BOND]: 2.2,
      [GameEvents.CREATURE_PANIC]: 3.0,
      [GameEvents.CREATURE_OVERCROWD]: 3.0,
      [GameEvents.WORLD_FOOD_SCARCITY]: 4.5,
      [GameEvents.WORLD_MIGRATION_START]: 5.0,
      [GameEvents.WORLD_MIGRATION_SETTLED]: 5.5,
      [GameEvents.NEST_ESTABLISHED]: 4.5,
      [GameEvents.WORLD_REGION_DEPLETED]: 5.5,
      [GameEvents.WORLD_REGION_THRIVING]: 5.5,
      [GameEvents.PREDATOR_LITE_CHASE]: 3.2
    };

    this._bindEvents();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  clearOverride() {
    gameState.autoDirectorOverrideUntil = 0;
  }

  recenter() {
    this.clearOverride();
    if (!this.camera) return;
    const target = this.lastFocus || { x: this.world?.width * 0.5, y: this.world?.height * 0.5 };
    if (target?.x != null && target?.y != null) {
      this._travelTo(target.x, target.y, { zoomMultiplier: 1.0, reason: 'recenter' });
    }
  }

  getLastFocusTarget() {
    return this.lastFocus;
  }

  canDirect() {
    if (!this.enabled || !gameState.watchModeEnabled || !gameState.autoDirectorEnabled) return false;
    if (!this.camera || !this.world) return false;
    if (this.camera.followMode !== 'free') return false;
    const now = performance.now();
    return now >= (gameState.autoDirectorOverrideUntil || 0);
  }

  _bindEvents() {
    eventSystem.on(GameEvents.CREATURE_BORN, (data) => {
      const creature = data?.creature;
      if (creature) {
        this.focusOnEvent(GameEvents.CREATURE_BORN, creature.x, creature.y, {
          creatureId: creature.id,
          zoomMultiplier: 1.1
        });
      }
    });

    eventSystem.on(GameEvents.CREATURE_EAT, (data) => {
      const creature = data?.creature;
      if (creature && data?.hungry) {
        this.focusOnEvent(GameEvents.CREATURE_EAT, creature.x, creature.y, {
          creatureId: creature.id,
          zoomMultiplier: 1.05
        });
      }
    });

    eventSystem.on(GameEvents.CREATURE_BOND, (data) => {
      const creature = data?.creature;
      if (creature) {
        this.focusOnEvent(GameEvents.CREATURE_BOND, creature.x, creature.y, {
          creatureId: creature.id,
          zoomMultiplier: 1.08
        });
      }
    });

    eventSystem.on(GameEvents.CREATURE_PANIC, (data) => {
      const creature = data?.creature;
      if (creature) {
        this.focusOnEvent(GameEvents.CREATURE_PANIC, creature.x, creature.y, {
          creatureId: creature.id,
          zoomMultiplier: 1.18
        });
      }
    });

    eventSystem.on(GameEvents.CREATURE_OVERCROWD, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.CREATURE_OVERCROWD, data.x, data.y, {
        zoomMultiplier: 0.95
      });
    });

    eventSystem.on(GameEvents.WORLD_FOOD_SCARCITY, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.WORLD_FOOD_SCARCITY, data.x, data.y, {
        zoomMultiplier: 0.92
      });
    });

    eventSystem.on(GameEvents.WORLD_MIGRATION_START, (data) => {
      if (!data) return;
      if (data.count != null && data.count < CreatureAgentTuning.MIGRATION.FOCUS_GROUP_MIN) return;
      this.focusOnEvent(GameEvents.WORLD_MIGRATION_START, data.x, data.y, {
        zoomMultiplier: 0.9
      });
    });

    eventSystem.on(GameEvents.WORLD_MIGRATION_SETTLED, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.WORLD_MIGRATION_SETTLED, data.x, data.y, {
        zoomMultiplier: 1.05
      });
    });

    eventSystem.on(GameEvents.NEST_ESTABLISHED, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.NEST_ESTABLISHED, data.x, data.y, {
        zoomMultiplier: 1.1
      });
    });

    eventSystem.on(GameEvents.WORLD_REGION_DEPLETED, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.WORLD_REGION_DEPLETED, data.x, data.y, {
        zoomMultiplier: 0.92
      });
    });

    eventSystem.on(GameEvents.WORLD_REGION_THRIVING, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.WORLD_REGION_THRIVING, data.x, data.y, {
        zoomMultiplier: 0.95
      });
    });

    eventSystem.on(GameEvents.PREDATOR_LITE_CHASE, (data) => {
      if (!data) return;
      this.focusOnEvent(GameEvents.PREDATOR_LITE_CHASE, data.x, data.y, {
        zoomMultiplier: 1.02
      });
    });
  }

  focusOnEvent(eventKey, x, y, { creatureId = null, zoomMultiplier = 1 } = {}) {
    if (!this.canDirect() || x == null || y == null) return;
    if (!this._cooldownReady(eventKey)) return;

    const now = performance.now();
    if (now - this.lastFocusAt < this.cooldownSeconds * 1000) return;

    this.lastFocusAt = now;
    this.lastFocus = { x, y, creatureId, reason: eventKey };
    this._travelTo(x, y, { zoomMultiplier, reason: eventKey });
  }

  _travelTo(x, y, { zoomMultiplier = 1, reason = '' } = {}) {
    if (!this.camera) return;
    const currentZoom = this.camera.targetZoom ?? this.camera.zoom ?? 1;
    const desired = clamp(currentZoom * zoomMultiplier, this.camera.minZoom ?? 0.2, this.camera.maxZoom ?? 3);
    const maxStep = 0.35;
    const nextZoom = clamp(currentZoom + clamp(desired - currentZoom, -maxStep, maxStep), this.camera.minZoom, this.camera.maxZoom);
    this.camera.targetZoom = nextZoom;
    const duration = reason === GameEvents.CREATURE_PANIC ? 1.1 : 1.6;
    if (typeof this.camera.startTravel === 'function') {
      this.camera.startTravel(x, y, duration);
    } else {
      this.camera.focusOn(x, y);
    }
  }

  _cooldownReady(eventKey) {
    const now = performance.now();
    const cooldown = (this.eventCooldownSeconds[eventKey] ?? 2.5) * 1000;
    const last = this.eventCooldowns.get(eventKey) ?? -Infinity;
    if (now - last < cooldown) return false;
    this.eventCooldowns.set(eventKey, now);
    return true;
  }
}

export default AutoDirector;
