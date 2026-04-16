/**
 * Input Pointer - Pointer event handling and creature dragging
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem, GameEvents } from './event-system.js';
import { clamp } from './utils.js';
import { getDebugFlags } from './debug-flags.js';

export function applyInputPointerMethods(InputManager) {

  /**
   * Handle pointer down events
   */
  InputManager.prototype.onPointerDown = function(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const sx = canvasX - rect.width / 2;
    const sy = canvasY - rect.height / 2;
    const worldPos = this.camera.screenToWorld(sx, sy);

    if (this.handleMiniMapClick(canvasX, canvasY, e)) {
      return;
    }

    this.canvas.setPointerCapture(e.pointerId);
    if (gameState.lastPointer) {
      gameState.lastPointer.x = e.clientX;
      gameState.lastPointer.y = e.clientY;
    } else {
      gameState.lastPointer = { x: e.clientX, y: e.clientY };
    }
    if (gameState.lastPointerWorld) {
      gameState.lastPointerWorld.x = worldPos.x;
      gameState.lastPointerWorld.y = worldPos.y;
    } else {
      gameState.lastPointerWorld = { x: worldPos.x, y: worldPos.y };
    }
    if (this.world) {
      if (this.world.lastPointerWorld) {
        this.world.lastPointerWorld.x = worldPos.x;
        this.world.lastPointerWorld.y = worldPos.y;
      } else {
        this.world.lastPointerWorld = { x: worldPos.x, y: worldPos.y };
      }
    }

    if (this.tools.mode !== 'inspect') {
      this._setHoveredCreature(null);
    }

    if (e.button === 1 || e.button === 2 || e.altKey || e.metaKey) {
      gameState.panning = true;
      this.noteCameraOverride();
      return;
    }

    if (e.pointerType === 'touch' && e.button === 0) {
      this.scheduleGodHold(e);
    }

    if (e.button === 0) {
      gameState.painting = true;

      const allowDrag = !gameState.godModeActive;
      const dragCandidate = allowDrag ? this._prepareCreatureDrag(worldPos.x, worldPos.y, e) : false;
      if (dragCandidate) {
        gameState.travelDrag = null;
        gameState.travelPreview = null;
      }

      if (this.tools.mode === 'inspect' && !e.shiftKey && !dragCandidate && !gameState.godModeActive) {
        gameState.travelDrag = {
          startX: this.camera.targetX,
          startY: this.camera.targetY,
          active: false,
          latest: null
        };
        gameState.travelPreview = null;
      } else {
        gameState.travelDrag = null;
        gameState.travelPreview = null;
      }


      this.handlePointerAction(e, false);
    }
  };

  /**
   * Handle pointer move events
   */
  InputManager.prototype.onPointerMove = function(e) {
    if (this.godHoldPointerId === e.pointerId && this.godHoldStart) {
      const dx = e.clientX - this.godHoldStart.x;
      const dy = e.clientY - this.godHoldStart.y;
      if (Math.hypot(dx, dy) > this.godHoldThreshold) {
        this.clearGodHold();
      }
    }

    if (this.dragState.active || this.dragState.pending) {
      this.noteCameraOverride();
      this._updateCreatureDrag(e);
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left - rect.width / 2;
    const sy = e.clientY - rect.top - rect.height / 2;
    const worldPos = this.camera.screenToWorld(sx, sy);

    if (gameState.lastPointerWorld) {
      gameState.lastPointerWorld.x = worldPos.x;
      gameState.lastPointerWorld.y = worldPos.y;
    } else {
      gameState.lastPointerWorld = { x: worldPos.x, y: worldPos.y };
    }
    if (this.world) {
      if (this.world.lastPointerWorld) {
        this.world.lastPointerWorld.x = worldPos.x;
        this.world.lastPointerWorld.y = worldPos.y;
      } else {
        this.world.lastPointerWorld = { x: worldPos.x, y: worldPos.y };
      }
    }

    if (gameState.panning) {
      this.noteCameraOverride();
      const dx = e.clientX - gameState.lastPointer.x;
      const dy = e.clientY - gameState.lastPointer.y;
      this.camera.pan(-dx, -dy);
      if (gameState.lastPointer) {
        gameState.lastPointer.x = e.clientX;
        gameState.lastPointer.y = e.clientY;
      } else {
        gameState.lastPointer = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (!gameState.painting) {
      this._updateHoverTarget(e);
    }

    if (!gameState.painting) return;

    this.handlePointerAction(e, true);
  };

  /**
   * Handle pointer up events
   */
  InputManager.prototype.onPointerUp = function(e) {
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.clearGodHold();

    const wasDragging = this.dragState.active;
    if (this.dragState.active || this.dragState.pending) {
      this._releaseCreatureDrag(e);
      this.dragState.pending = false;
      this.dragState.active = false;
      this.dragState.creature = null;
      this.dragState.pointerId = null;
    }
    if (wasDragging) {
      gameState.travelDrag = null;
      gameState.travelPreview = null;
      gameState.painting = false;
      gameState.panning = false;
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left - rect.width / 2;
    const sy = e.clientY - rect.top - rect.height / 2;
    const { x, y } = this.camera.screenToWorld(sx, sy);

    if (gameState.travelDrag && gameState.travelDrag.active && gameState.travelDrag.latest) {
      const dx = gameState.travelDrag.latest.x - gameState.travelDrag.startX;
      const dy = gameState.travelDrag.latest.y - gameState.travelDrag.startY;
      const distance = Math.hypot(dx, dy);
      const duration = Math.min(3.5, Math.max(0.45, distance / 600));

      if (typeof this.camera.startTravel === 'function') {
        this.camera.startTravel(gameState.travelDrag.latest.x, gameState.travelDrag.latest.y, duration);
      } else {
        this.camera.focusOn(gameState.travelDrag.latest.x, gameState.travelDrag.latest.y);
      }
    } else if (this.tools.mode === 'inspect' && e.button === 0 && !e.shiftKey && !gameState.godModeActive) {
      this.camera.focusOn(x, y);
    }

    gameState.travelDrag = null;
    gameState.travelPreview = null;
    gameState.painting = false;
    gameState.panning = false;
  };

  /**
   * Handle pointer leave events
   */
  InputManager.prototype.onPointerLeave = function() {
    this._setHoveredCreature(null);
  };

  /**
   * Handle wheel events for zooming
   */
  InputManager.prototype.onWheel = function(e) {
    e.preventDefault();
    const now = performance.now();
    gameState.autoDirectorOverrideUntil = now + 2000;
    if (this.camera?.setUserOverride) {
      this.camera.setUserOverride(false);
    }
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left - rect.width / 2;
    const sy = e.clientY - rect.top - rect.height / 2;
    const normalizedDelta = clamp(e.deltaY, -120, 120) * 0.0012;
    if (typeof this.camera.zoomByAt === 'function') {
      this.camera.zoomByAt(normalizedDelta, sx, sy);
    } else {
      this.camera.zoomBy(normalizedDelta);
    }
  };

  /**
   * Handle mini-map clicks
   */
  InputManager.prototype.handleMiniMapClick = function(canvasX, canvasY, event) {
    const renderer = this.world?.renderer;
    if (!renderer?.enableMiniMap) return false;

    const bounds = renderer.lastMiniMap;
    if (!bounds) return false;

    if (canvasX < bounds.x || canvasX > bounds.x + bounds.width ||
      canvasY < bounds.y || canvasY > bounds.y + bounds.height) {
      return false;
    }

    if (event.button !== 0) return false;

    gameState.travelDrag = null;
    gameState.travelPreview = null;

    const normalizedX = Math.min(1, Math.max(0, (canvasX - bounds.x) / bounds.width));
    const normalizedY = Math.min(1, Math.max(0, (canvasY - bounds.y) / bounds.height));
    const targetX = normalizedX * bounds.worldWidth;
    const targetY = normalizedY * bounds.worldHeight;

    this.camera.focusOn(targetX, targetY);
    gameState.painting = false;
    gameState.panning = false;

    return true;
  };

  /**
   * Handle pointer actions (drawing/spawning/selecting)
   */
  InputManager.prototype.handlePointerAction = function(e, isDrag) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const sx = canvasX - rect.width / 2;
    const sy = canvasY - rect.height / 2;
    const { x, y } = this.camera.screenToWorld(sx, sy);

    if (this.godHoldTriggered) {
      return;
    }

    if (gameState.godModeActive) {
      this.handleGodModeAction(x, y, isDrag);
      return;
    }

    const mode = this.tools?.mode || 'inspect';

    switch (mode) {
      case 'food': {
        if (!isDrag || Math.random() < 0.3) {
          if (this.tools?.scatterFood) {
            this.tools.scatterFood(x, y, e.shiftKey ? 2 : 10);
          } else {
            this.world.addFood(x, y);
          }
        }
        break;
      }

      case 'spawn': {
        if (isDrag) break;

        if (gameState.geneEditorSpawnMode) {
          eventSystem.emit('gene-editor:spawn', { x, y });
          break;
        }

        const selectedType = gameState.selectedCreatureType || 'herbivore';
        const debugFlags = getDebugFlags();
        if (debugFlags.spawnDebug) {
          console.debug('[Spawn][input]', {
            mode,
            selectedType,
            x: Number(x.toFixed(2)),
            y: Number(y.toFixed(2)),
            hasToolSpawner: Boolean(this.tools?.spawnCreature)
          });
        }
        if (this.tools?.spawnCreature) {
          this.tools.spawnCreature(x, y, { type: selectedType });
        } else {
          this.world.spawnCreatureType(selectedType, x, y);
        }
        break;
      }

      case 'erase': {
        if (!isDrag) {
          if (this.tools?.eraseAt) {
            this.tools.eraseAt(x, y);
          } else if (this.tools?.eraseCreatures) {
            this.tools.eraseCreatures(x, y);
          } else {
            const creature = this._findCreatureAt(x, y);
            if (creature) {
              creature.alive = false;
              creature.deathTime = this.world.t;
            }
          }
        }
        break;
      }
      case 'prop': {
        if (isDrag) break;
        const selectedType = gameState.selectedPropType || this.tools?.propType || 'bounce';
        if (this.tools?.placeProp) {
          this.tools.placeProp(x, y, { type: selectedType });
        }
        break;
      }

      case 'inspect':
      default: {
        if (!isDrag) {
          const creature = this._findCreatureAt(x, y);
          if (creature) {
            this._selectCreatureWithCamera(creature, { preferZoom: 0.92 });

            const selectedInfo = document.getElementById('selected-info');
            if (selectedInfo) selectedInfo.classList.remove('hidden');
            if (typeof creature.reactToPoke === 'function') {
              creature.reactToPoke({ x, y });
            }
            if (gameState.selectionPulseUntil === null) {
              gameState.selectionPulseUntil = 0;
            }
            gameState.selectionPulseUntil = performance.now() + 400;
            this.world?.particles?.addImpactRing?.(creature.x, creature.y, {
              color: 'rgba(123, 183, 255, 1)',
              size: 6
            });
          } else {
            gameState.selectedId = null;
            this.camera.followMode = 'free';
            this.camera.followTarget = null;
          }
        }
        break;
      }
    }
  };

  /**
   * Prepare creature for dragging
   */
  InputManager.prototype._prepareCreatureDrag = function(x, y, event) {
    if (this.tools.mode !== 'inspect' || event.shiftKey) return false;
    const creature = this._findCreatureAt(x, y);
    if (!creature) return false;

    this.dragState.pending = true;
    this.dragState.active = false;
    this.dragState.creature = creature;
    this.dragState.pointerId = event.pointerId;
    this.dragState.startX = event.clientX;
    this.dragState.startY = event.clientY;
    this.dragState.startTime = performance.now();
    this.dragState.lastX = event.clientX;
    this.dragState.lastY = event.clientY;
    this.dragState.lastWorldX = x;
    this.dragState.lastWorldY = y;
    this.dragState.lastTime = this.dragState.startTime;
    this.dragState.velocityX = 0;
    this.dragState.velocityY = 0;
    this.dragState.grabOffsetX = creature.x - x;
    this.dragState.grabOffsetY = creature.y - y;

    return true;
  };

  /**
   * Activate creature drag after threshold
   */
  InputManager.prototype._activateCreatureDrag = function(worldX, worldY) {
    const { creature } = this.dragState;
    if (!creature) return;
    this.dragState.active = true;
    this.dragState.pending = false;
    creature.isGrabbed = true;
    this.canvas.style.cursor = 'grabbing';
    if (typeof creature.reactToGrab === 'function') {
      creature.reactToGrab({ x: worldX, y: worldY });
    }
    creature.grabTarget = creature.grabTarget || { x: worldX, y: worldY };
    creature.grabTarget.x = worldX + this.dragState.grabOffsetX;
    creature.grabTarget.y = worldY + this.dragState.grabOffsetY;
  };

  /**
   * Update creature drag position
   */
  InputManager.prototype._updateCreatureDrag = function(event) {
    if (event.pointerId !== this.dragState.pointerId) return;

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const sx = canvasX - rect.width / 2;
    const sy = canvasY - rect.height / 2;
    const { x: worldX, y: worldY } = this.camera.screenToWorld(sx, sy);

    if (this.dragState.pending) {
      const dx = event.clientX - this.dragState.startX;
      const dy = event.clientY - this.dragState.startY;
      const dist = Math.hypot(dx, dy);
      const heldMs = performance.now() - this.dragState.startTime;
      const moveThreshold = event.pointerType === 'touch' ? this.grabMoveThresholdTouch : this.grabMoveThreshold;
      const activateMs = event.pointerType === 'touch' ? this.grabActivateMsTouch : this.grabActivateMs;
      if (dist >= moveThreshold || heldMs >= activateMs) {
        this._activateCreatureDrag(worldX, worldY);
      } else {
        return;
      }
    }

    const creature = this.dragState.creature;
    if (!creature || !this.dragState.active) return;

    const now = performance.now();
    const dt = Math.max(0.016, (now - this.dragState.lastTime) / 1000);
    const vx = (worldX - this.dragState.lastWorldX) / dt;
    const vy = (worldY - this.dragState.lastWorldY) / dt;

    this.dragState.velocityX = this.dragState.velocityX * 0.6 + vx * 0.4;
    this.dragState.velocityY = this.dragState.velocityY * 0.6 + vy * 0.4;

    this.dragState.lastWorldX = worldX;
    this.dragState.lastWorldY = worldY;
    this.dragState.lastTime = now;

    creature.grabTarget.x = worldX + this.dragState.grabOffsetX;
    creature.grabTarget.y = worldY + this.dragState.grabOffsetY;
  };

  /**
   * Release creature drag
   */
  InputManager.prototype._releaseCreatureDrag = function(event) {
    if (event.pointerId !== this.dragState.pointerId) return;
    const creature = this.dragState.creature;
    if (!creature) return;

    if (this.dragState.active) {
      const throwVX = this.dragState.velocityX;
      const throwVY = this.dragState.velocityY;
      const throwSpeed = Math.hypot(throwVX, throwVY);
      if (throwSpeed >= this.throwSpeedMin) {
        const clampedSpeed = Math.min(throwSpeed, this.throwSpeedMax);
        const speedScale = clampedSpeed / Math.max(throwSpeed, 1);
        const scaledVX = throwVX * speedScale;
        const scaledVY = throwVY * speedScale;
        creature.applyImpulse?.(scaledVX * this.throwImpulseScale, scaledVY * this.throwImpulseScale, {
          decay: 5.4,
          cap: this.throwImpulseCap
        });
        creature.dir = Math.atan2(scaledVY, scaledVX);
        eventSystem.emit(GameEvents.CREATURE_THROWN, { creatureId: creature.id, speed: clampedSpeed });
        const intensity = clamp((clampedSpeed - this.throwSpeedMin) / (this.throwSpeedMax - this.throwSpeedMin), 0, 1);
        const ringSize = 6 + intensity * 12;
        this.world?.particles?.addImpactRing?.(creature.x, creature.y, { color: '#facc15', size: ringSize });
      }
      if (typeof creature.reactToDrop === 'function') {
        creature.reactToDrop({ x: creature.x, y: creature.y });
      }
    }

    creature.isGrabbed = false;
    creature.grabTarget = creature.grabTarget || { x: creature.x, y: creature.y };
    if (event.pointerType === 'touch') {
      this._setHoveredCreature(null);
    } else {
      this._updateHoverTarget(event);
    }
  };

  /**
   * Update hover target
   */
  InputManager.prototype._updateHoverTarget = function(event) {
    if (this.tools.mode !== 'inspect') {
      this._setHoveredCreature(null);
      return;
    }

    if (event.pointerType === 'touch') {
      this._setHoveredCreature(null);
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const sx = canvasX - rect.width / 2;
    const sy = canvasY - rect.height / 2;
    const { x, y } = this.camera.screenToWorld(sx, sy);
    const hoverRadius = 34 / this.camera.zoom;
    const creature = this._findCreatureAt(x, y, hoverRadius);
    this._setHoveredCreature(creature?.id ?? null);
  };

  /**
   * Set hovered creature
   */
  InputManager.prototype._setHoveredCreature = function(id) {
    if (gameState.hoveredId === id) return;
    gameState.hoveredId = id;
    if (this.dragState.active) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (id && this.tools.mode === 'inspect') {
      this.canvas.style.cursor = 'grab';
    } else {
      this.canvas.style.cursor = 'default';
    }
  };

  /**
   * Find creature at world coordinates
   */
  InputManager.prototype._findCreatureAt = function(x, y, searchRadius = 25 / this.camera.zoom) {
    let nearest = null;
    let minDist = searchRadius;

    for (const c of this.world.creatures) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    }

    return nearest;
  };

  /**
   * Select creature with camera
   */
  InputManager.prototype._selectCreatureWithCamera = function(creature, { preferZoom = 0.9 } = {}) {
    if (!creature) return;
    gameState.selectCreature(creature.id);
    this.tutorial?.trackSelection?.();

    this.camera.followMode = 'smooth-follow';
    this.camera.followTarget = creature.id;
    this.camera.clearUserOverride();
    this.camera.focusOn(creature.x, creature.y);

    const targetZoom = clamp(
      Math.max(this.camera.targetZoom || this.camera.zoom || 0.8, preferZoom),
      this.camera.minZoom,
      Math.min(this.camera.maxZoom, 1.35)
    );
    this.camera.setZoom(targetZoom);

    if (gameState.inspectorAutoOpen !== false) {
      gameState.setInspectorVisible(true);
      const inspector = domCache.get('inspector');
      if (inspector) inspector.classList.remove('minimized');
      this.updateInspectorVisibility();
    }
  };

}
