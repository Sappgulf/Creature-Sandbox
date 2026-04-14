/**
 * Input Touch - Mobile/touch specific event handling
 */
import { gameState } from './game-state.js';
import { eventSystem, GameEvents } from './event-system.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';

export function applyInputTouchMethods(InputManager) {

  /**
   * Handle mobile tap events
   */
  InputManager.prototype.onMobileTap = function(e) {
    const detail = e.detail;
    if (!detail) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = detail.x - rect.left - rect.width / 2;
    const sy = detail.y - rect.top - rect.height / 2;
    const { x, y } = this.camera.screenToWorld(sx, sy);

    let nearest = null;
    let minDist = 40 / this.camera.zoom;

    for (const c of this.world.creatures) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    }

    if (nearest) {
      this._selectCreatureWithCamera(nearest, { preferZoom: 1.02 });
      if (typeof nearest.reactToPoke === 'function') {
        nearest.reactToPoke({ x, y });
      }
      if (gameState.selectionPulseUntil === null) {
        gameState.selectionPulseUntil = 0;
      }
      gameState.selectionPulseUntil = performance.now() + 400;
    }
  };

  /**
   * Schedule god mode hold gesture
   */
  InputManager.prototype.scheduleGodHold = function(e) {
    this.clearGodHold();
    this.godHoldPointerId = e.pointerId;
    this.godHoldStart = { x: e.clientX, y: e.clientY };
    this.godHoldTimeout = window.setTimeout(() => {
      this.godHoldTriggered = true;
      eventSystem.emit(GameEvents.GOD_MODE_TOGGLE, { source: 'gesture' });
    }, 650);
  };

  /**
   * Clear god mode hold gesture
   */
  InputManager.prototype.clearGodHold = function() {
    if (this.godHoldTimeout) {
      window.clearTimeout(this.godHoldTimeout);
      this.godHoldTimeout = null;
    }
    this.godHoldPointerId = null;
    this.godHoldStart = null;
    this.godHoldTriggered = false;
  };

  /**
   * Handle god mode action
   */
  InputManager.prototype.handleGodModeAction = function(x, y, isDrag) {
    const tool = gameState.godModeTool || 'food';
    const dragEnabled = tool === 'food' || tool === 'calm' || tool === 'prop' || tool === 'remove';
    if (isDrag && !dragEnabled) return;
    if (!this._allowGodAction(tool, x, y, isDrag)) return;

    switch (tool) {
      case 'food': {
        if (isDrag) {
          this.world.addFood?.(x, y, 2.2, 'grass');
        } else {
          const patch = this.world.ecosystem?.addFoodPatch?.(x, y, {
            radius: CreatureAgentTuning.GOD_MODE.FOOD_RADIUS,
            fertility: 1.2,
            stock: CreatureAgentTuning.FOOD_PATCHES.START_STOCK * 1.8,
            tag: 'god'
          });
          if (patch && this.world.ecosystem?.spawnFoodFromPatch) {
            for (let i = 0; i < 4; i++) {
              this.world.ecosystem.spawnFoodFromPatch(patch);
            }
          }
        }
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'food', x, y });
        break;
      }
      case 'calm': {
        this.world.addCalmZone(
          x,
          y,
          CreatureAgentTuning.GOD_MODE.CALM_RADIUS * (isDrag ? 0.72 : 1),
          CreatureAgentTuning.GOD_MODE.CALM_DURATION * (isDrag ? 0.55 : 1),
          CreatureAgentTuning.GOD_MODE.CALM_STRENGTH
        );
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'calm', x, y });
        break;
      }
      case 'chaos': {
        this.world.triggerChaosNudge(
          CreatureAgentTuning.GOD_MODE.CHAOS_INTENSITY,
          CreatureAgentTuning.GOD_MODE.CHAOS_DURATION
        );
        this.world.environment?.triggerWindBurst?.(
          CreatureAgentTuning.GOD_MODE.CHAOS_INTENSITY,
          CreatureAgentTuning.GOD_MODE.CHAOS_DURATION
        );
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'chaos', x, y });
        break;
      }
      case 'spawn': {
        const limit = CreatureAgentTuning.MATING.POPULATION_HARD_CAP;
        if (this.world.creatures.length >= limit) {
          eventSystem.emit(GameEvents.NOTIFICATION, {
            message: 'Population at limit. Let them breathe.',
            type: 'warning',
            duration: 2000
          });
          break;
        }
        const type = gameState.selectedCreatureType || 'herbivore';
        this.world.spawnCreatureType(type, x, y);
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'spawn', x, y });
        break;
      }
      case 'prop': {
        const propType = gameState.selectedPropType || this.tools?.propType || 'bounce';
        const prop = this.tools?.placeProp?.(x, y, { type: propType });
        if (prop) {
          eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'prop', x, y, propType });
        }
        break;
      }
      case 'remove': {
        const target = this._findCreatureAt(x, y, 34 / this.camera.zoom);
        if (target) {
          target.alive = false;
          target.deathTime = this.world.t;
          target.deathCause = 'god';
          target.killedBy = 'god';
          this.world.creatureManager.removeCreature(target);
          eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'remove', id: target.id });
          break;
        }
        const removedProp = this.world.sandbox?.removeNearestProp?.(x, y, 48 / this.camera.zoom);
        if (removedProp) {
          eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'remove-prop', id: removedProp.id, propType: removedProp.type });
        }
        break;
      }
      default:
        break;
    }
  };

  /**
   * Set god tool
   */
  InputManager.prototype._setGodTool = function(tool, source = 'hotkey') {
    if (!tool) return;
    eventSystem.emit('god:tool-changed', { tool, source });
    if (gameState.godModeTool !== tool) {
      gameState.godModeTool = tool;
    }
  };

  /**
   * Allow god action based on rate limiting
   */
  InputManager.prototype._allowGodAction = function(tool, x, y, isDrag) {
    const now = performance.now();
    const interval = this.godActionIntervals[tool] ?? 120;
    const state = this.godActionState;
    if (state.lastTool !== tool) {
      state.lastTool = tool;
      state.nextAt = 0;
      state.lastX = x;
      state.lastY = y;
    }
    if (now < state.nextAt) {
      return false;
    }
    if (isDrag) {
      const minDistance = this.godDragDistanceBase / Math.max(0.6, this.camera.zoom || 1);
      const distance = Math.hypot(x - state.lastX, y - state.lastY);
      if (distance < minDistance) {
        return false;
      }
    }
    state.nextAt = now + interval;
    state.lastX = x;
    state.lastY = y;
    return true;
  };

}
