import { isPredatorFromGenes } from './creature-genetics-helpers.js';
import { eventSystem, GameEvents } from './event-system.js';

export const ToolModes = Object.freeze({
  INSPECT: 'inspect',
  FOOD: 'food',
  SPAWN: 'spawn',
  ERASE: 'erase',
  PROP: 'prop'
});

/**
 * Action types for undo/redo system
 */
const ActionType = {
  SPAWN_CREATURE: 'spawn_creature',
  ERASE_CREATURES: 'erase_creatures',
  ADD_FOOD: 'add_food',
  PLACE_PROP: 'place_prop',
  REMOVE_PROP: 'remove_prop',
  CALM_ZONE: 'calm_zone',
  CHAOS_NUDGE: 'chaos_nudge',
  GOD_FOOD: 'god_food'
};

export class ToolController {
  constructor(world, camera, options = {}) {
    this.world = world;
    this.camera = camera;
    this.onActionFeedback = options.onActionFeedback || null;
    this.mode = ToolModes.INSPECT;
    this.brushSize = 26;
    this.minBrushSize = 8;
    this.maxBrushSize = 120;

    // Undo/redo history
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 50;

    // Sandbox prop defaults
    this.propType = 'bounce';
  }

  setMode(mode) {
    this.mode = mode;
  }

  setBrushSize(size) {
    const next = Math.max(this.minBrushSize, Math.min(this.maxBrushSize, size));
    this.brushSize = next;
    return this.brushSize;
  }

  setPropType(type) {
    if (!type) return this.propType;
    this.propType = type;
    return this.propType;
  }

  adjustBrushSize(delta) {
    return this.setBrushSize(this.brushSize + delta);
  }

  _notifyActionFeedback(message, type = 'warning') {
    if (typeof this.onActionFeedback === 'function') {
      this.onActionFeedback(message, type);
    }
  }

  _hasExplicitGenes(genes) {
    return genes != null && typeof genes === 'object' && Object.keys(genes).length > 0;
  }

  _matchesSpawnAction(creature, action) {
    if (!creature || creature.alive === false) return false;
    if (this._hasExplicitGenes(action.genes)) return true;
    if (action.creatureType === 'predator' || action.predator) {
      return isPredatorFromGenes(creature.genes);
    }
    if (
      action.creatureType === 'herbivore' ||
      action.creatureType === 'omnivore' ||
      action.creatureType === 'aquatic'
    ) {
      return !isPredatorFromGenes(creature.genes);
    }
    return true;
  }

  _queryCreaturesNearby(x, y, radius, filterFn = null) {
    let candidates = [];
    if (typeof this.world.queryCreatures === 'function') {
      candidates = this.world.queryCreatures(x, y, radius) || [];
    } else if (Array.isArray(this.world.creatures)) {
      const radiusSq = radius * radius;
      candidates = this.world.creatures.filter(creature => {
        if (!creature || creature.alive === false) return false;
        const dx = creature.x - x;
        const dy = creature.y - y;
        return dx * dx + dy * dy <= radiusSq;
      });
    }

    if (typeof filterFn === 'function') {
      candidates = candidates.filter(filterFn);
    }

    candidates.sort((a, b) => {
      const da = (a.x - x) ** 2 + (a.y - y) ** 2;
      const db = (b.x - x) ** 2 + (b.y - y) ** 2;
      return da - db;
    });

    return candidates;
  }

  apply(localX, localY, opts = {}) {
    const { shiftKey = false } = opts;
    const { x, y } = this.camera.screenToWorld(localX, localY);
    switch (this.mode) {
      case ToolModes.FOOD:
        this.scatterFood(x, y, shiftKey ? 2 : 10);
        break;
      case ToolModes.SPAWN:
        this.spawnCreature(x, y, shiftKey);
        break;
      case ToolModes.ERASE:
        this.eraseAt(x, y);
        break;
      case ToolModes.PROP:
        this.placeProp(x, y);
        break;
      default:
        break;
    }
  }

  /**
   * Push action to undo stack
   */
  pushAction(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Clear redo stack when new action is performed
    this.redoStack = [];
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) return false;

    const action = this.undoStack.pop();
    this.redoStack.push(action);

    switch (action.type) {
      case ActionType.SPAWN_CREATURE:
        // Remove the spawned creature
        this.undoSpawnCreature(action);
        break;
      case ActionType.ERASE_CREATURES:
        // Restore erased creatures
        this.undoEraseCreatures(action);
        break;
      case ActionType.ADD_FOOD:
        // Remove added food
        this.undoAddFood(action);
        break;
      case ActionType.PLACE_PROP:
        this.undoPlaceProp(action);
        break;
      case ActionType.REMOVE_PROP:
        this.undoRemoveProp(action);
        break;
      case ActionType.CALM_ZONE:
        this.undoCalmZone(action);
        break;
      case ActionType.CHAOS_NUDGE:
        this.undoChaosNudge(action);
        break;
      case ActionType.GOD_FOOD:
        this.undoAddFood(action);
        break;
    }

    return true;
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) return false;

    const action = this.redoStack.pop();
    this.undoStack.push(action);

    switch (action.type) {
      case ActionType.SPAWN_CREATURE:
        // Re-spawn the creature
        this.redoSpawnCreature(action);
        break;
      case ActionType.ERASE_CREATURES:
        // Re-erase the creatures
        this.redoEraseCreatures(action);
        break;
      case ActionType.ADD_FOOD:
        // Re-add the food
        this.redoAddFood(action);
        break;
      case ActionType.PLACE_PROP:
        this.redoPlaceProp(action);
        break;
      case ActionType.REMOVE_PROP:
        this.redoRemoveProp(action);
        break;
      case ActionType.CALM_ZONE:
        this.redoCalmZone(action);
        break;
      case ActionType.CHAOS_NUDGE:
        this.redoChaosNudge(action);
        break;
      case ActionType.GOD_FOOD:
        this.redoAddFood(action);
        break;
    }

    return true;
  }

  recordCalmZone(zone) {
    if (!zone) return;
    this.pushAction({
      type: ActionType.CALM_ZONE,
      zone: {
        id: zone.id,
        x: zone.x,
        y: zone.y,
        radius: zone.radius,
        strength: zone.strength,
        duration: zone.t
      }
    });
  }

  undoCalmZone(action) {
    const zones = this.world.environment?.calmZones;
    if (!Array.isArray(zones) || !action.zone) return;
    const idx = zones.findIndex(zone => zone.id === action.zone.id);
    if (idx >= 0) zones.splice(idx, 1);
  }

  redoCalmZone(action) {
    if (!action.zone || !this.world.addCalmZone) return;
    this.world.addCalmZone(
      action.zone.x,
      action.zone.y,
      action.zone.radius,
      action.zone.duration,
      action.zone.strength
    );
  }

  recordChaosNudge(snapshot) {
    if (!snapshot) return;
    this.pushAction({
      type: ActionType.CHAOS_NUDGE,
      snapshot
    });
  }

  undoChaosNudge(action) {
    const snap = action.snapshot;
    if (!snap || !this.world.chaos) return;
    this.world.chaosBaseLevel = snap.chaosBaseLevel ?? this.world.chaosBaseLevel;
    this.world.chaosNudge = snap.chaosNudge ? { ...snap.chaosNudge } : null;
    const intensity = this.world.chaosNudge?.intensity || 0;
    const fade =
      this.world.chaosNudge?.duration > 0 ? (this.world.chaosNudge.timer || 0) / this.world.chaosNudge.duration : 0;
    this.world._applyChaosLevel?.(this.world.chaosBaseLevel + intensity * fade);
  }

  redoChaosNudge(action) {
    const snap = action.snapshot;
    if (!snap?.applied) return;
    this.world.triggerChaosNudge?.(snap.applied.intensity, snap.applied.duration);
    if (snap.applied.windIntensity) {
      this.world.environment?.triggerWindBurst?.(snap.applied.windIntensity, snap.applied.duration);
    }
  }

  recordGodFood(foodItems) {
    if (!Array.isArray(foodItems) || foodItems.length === 0) return;
    this.pushAction({
      type: ActionType.GOD_FOOD,
      food: foodItems
    });
  }

  snapshotChaosBeforeNudge(intensity, duration) {
    return {
      chaosBaseLevel: this.world.chaosBaseLevel,
      chaosNudge: this.world.chaosNudge ? { ...this.world.chaosNudge } : null,
      applied: { intensity, duration, windIntensity: intensity }
    };
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  scatterFood(x, y, amount = 10) {
    const addedFood = [];
    for (let i = 0; i < amount; i++) {
      const fx = x + (Math.random() - 0.5) * this.brushSize;
      const fy = y + (Math.random() - 0.5) * this.brushSize;
      const food = this.world.addFood(fx, fy, 1.2);
      if (food) {
        addedFood.push(food);
      }
    }

    if (addedFood.length > 0) {
      this.pushAction({
        type: ActionType.ADD_FOOD,
        food: addedFood
      });
      this._reactToFoodDrop(x, y);
      eventSystem.emit(GameEvents.FOOD_DROP, { count: addedFood.length, x, y });
    }
  }

  undoAddFood(action) {
    for (const food of action.food) {
      if (typeof this.world.removeFood === 'function') {
        this.world.removeFood(food.id);
        continue;
      }

      const idx = this.world.food.indexOf(food);
      if (idx !== -1) {
        this.world.food.splice(idx, 1);
        this.world.foodGrid.remove(food);
      }
    }
  }

  redoAddFood(action) {
    for (const food of action.food) {
      if (!this.world.food.includes(food)) {
        this.world.food.push(food);
        this.world.foodGrid.add(food);
      }
    }
  }

  placeProp(x, y, options = {}) {
    const type = options.type || this.propType || 'bounce';
    const prop = this.world.sandbox?.addProp?.(type, x, y, options);
    if (!prop) return null;

    this.pushAction({
      type: ActionType.PLACE_PROP,
      prop: {
        id: prop.id,
        type: prop.type,
        x: prop.x,
        y: prop.y,
        radius: prop.radius,
        strength: prop.strength,
        color: prop.color
      }
    });

    return prop;
  }

  eraseAt(x, y) {
    const removedProp = this.world.sandbox?.removeNearestProp?.(x, y, this.brushSize * 0.65);
    if (removedProp) {
      this.pushAction({
        type: ActionType.REMOVE_PROP,
        prop: {
          id: removedProp.id,
          type: removedProp.type,
          x: removedProp.x,
          y: removedProp.y,
          radius: removedProp.radius,
          strength: removedProp.strength,
          color: removedProp.color
        }
      });
      return;
    }

    this.eraseCreatures(x, y);
  }

  undoPlaceProp(action) {
    if (!action.prop) return;
    this.world.sandbox?.removePropById?.(action.prop.id);
  }

  redoPlaceProp(action) {
    if (!action.prop) return;
    this.world.sandbox?.addProp?.(action.prop.type, action.prop.x, action.prop.y, action.prop);
  }

  undoRemoveProp(action) {
    if (!action.prop) return;
    this.world.sandbox?.addProp?.(action.prop.type, action.prop.x, action.prop.y, action.prop);
  }

  redoRemoveProp(action) {
    if (!action.prop) return;
    this.world.sandbox?.removePropById?.(action.prop.id);
  }

  _reactToFoodDrop(x, y) {
    const nearby = this.world.queryCreatures?.(x, y, this.brushSize * 1.2) || [];
    if (!nearby.length) return;
    let reacted = 0;
    for (const creature of nearby) {
      if (reacted >= 4) break;
      if (typeof creature.reactToDrop === 'function') {
        creature.reactToDrop({ x, y });
        reacted += 1;
      }
    }
  }

  spawnCreature(x, y, options = {}) {
    const normalizedOptions = options && typeof options === 'object' ? options : { predator: Boolean(options) };
    const { type = 'herbivore', predator = false, genes = null } = normalizedOptions;

    const creature = this._spawnForAction({
      x,
      y,
      type,
      predator,
      genes
    });

    // Record undo even when worker proxy returns null synchronously.
    this.pushAction({
      type: ActionType.SPAWN_CREATURE,
      creatureId: creature?.id ?? null,
      x,
      y,
      creatureType: type,
      predator,
      genes: this._hasExplicitGenes(genes) ? { ...genes } : null
    });
  }

  _resolveSpawnedCreatureId(action) {
    if (action?.creatureId != null) {
      return action.creatureId;
    }

    const nearby = this._queryCreaturesNearby(action.x, action.y, 20, candidate =>
      this._matchesSpawnAction(candidate, action)
    );
    return nearby[0]?.id ?? null;
  }

  undoSpawnCreature(action) {
    const targetId = this._resolveSpawnedCreatureId(action);
    if (targetId != null && typeof this.world.killCreature === 'function') {
      this.world.killCreature(targetId);
      return true;
    }

    const creature = targetId != null ? this.world.getAnyCreatureById?.(targetId) : null;
    if (creature) {
      creature.alive = false;
      creature.deathTime = this.world.t;
      this.world.creatureManager?.removeCreature?.(creature);
      if (this.world.gridDirty !== undefined) {
        this.world.gridDirty = true;
      }
      return true;
    }

    this._notifyActionFeedback('Could not undo spawn — no matching creature found');
    return false;
  }

  redoSpawnCreature(action) {
    const creature = this._spawnForAction(action);
    if (creature) {
      // Update action with new creature ID
      action.creatureId = creature.id;
    }
  }

  eraseCreatures(x, y) {
    const candidates = this._queryCreaturesNearby(x, y, this.brushSize * 0.7);
    if (candidates.length === 0) return;

    // Store creature data for undo
    const erasedData = candidates.map(c => ({
      id: c.id,
      x: c.x,
      y: c.y,
      genes: { ...(c.genesRaw || c.genes) },
      energy: c.energy,
      health: c.health,
      age: c.age,
      restoredId: null
    }));

    // Erase creatures
    candidates.forEach(c => {
      if (typeof this.world.killCreature === 'function') {
        this.world.killCreature(c.id);
        // Visually hide immediately to feel responsive
        c.alive = false;
      } else {
        c.alive = false;
      }
    });

    if (this.world.gridDirty !== undefined) {
      this.world.gridDirty = true;
    }

    this.pushAction({
      type: ActionType.ERASE_CREATURES,
      creatures: erasedData
    });
  }

  undoEraseCreatures(action) {
    // Restore erased creatures
    for (const data of action.creatures) {
      const creature = this.world.spawnManualWithGenes?.(data.x, data.y, data.genes) ?? null;
      if (creature) {
        creature.energy = data.energy;
        creature.health = data.health;
        creature.age = data.age;
        data.restoredId = creature.id;
      } else if (typeof this.world.spawnManualWithGenes === 'function') {
        // Worker proxy restores asynchronously; snapshot will pick up the respawn.
        data.restoredId = null;
      } else {
        data.restoredId = null;
      }
    }
  }

  redoEraseCreatures(action) {
    // Re-erase by finding creatures from restored ids or nearby positions
    for (const data of action.creatures) {
      const targetId = data.restoredId ?? data.id;

      if (typeof this.world.killCreature === 'function' && targetId) {
        this.world.killCreature(targetId);
        continue;
      }

      let creature = targetId ? this.world.getAnyCreatureById(targetId) : null;

      if (!creature) {
        const nearby = this._queryCreaturesNearby(data.x, data.y, 20);
        creature = nearby[0] || null;
      }

      if (creature) {
        creature.alive = false;
        creature.deathTime = this.world.t;
        this.world.creatureManager.removeCreature(creature);
      }
    }
  }

  _spawnForAction(action) {
    const genes = this._hasExplicitGenes(action.genes) ? { ...action.genes } : null;

    if (genes && typeof this.world.spawnManualWithGenes === 'function') {
      return this.world.spawnManualWithGenes(action.x, action.y, genes);
    }

    if (typeof this.world.spawnCreatureType === 'function' && action.creatureType) {
      return this.world.spawnCreatureType(action.creatureType, action.x, action.y);
    }

    return this.world.spawnManual(action.x, action.y, action.predator);
  }
}
