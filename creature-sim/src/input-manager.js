/**
 * Input Manager - Centralized input handling system
 * Handles keyboard, mouse, touch, and pointer events
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem, GameEvents } from './event-system.js';
import { clamp } from './utils.js';
import { CreatureAgentTuning } from './creature-agent-constants.js';

export class InputManager {
  constructor(canvas, camera, tools, world) {
    this.canvas = canvas;
    this.camera = camera;
    this.tools = tools;
    this.world = world;

    this.boundHandlers = {
      onKeyDown: this.onKeyDown.bind(this),
      onPointerDown: this.onPointerDown.bind(this),
      onPointerMove: this.onPointerMove.bind(this),
      onPointerUp: this.onPointerUp.bind(this),
      onPointerLeave: this.onPointerLeave.bind(this),
      onWheel: this.onWheel.bind(this),
      onBlur: this.onBlur.bind(this),
      onFocus: this.onFocus.bind(this),
      onVisibilityChange: this.onVisibilityChange.bind(this),
      onMobileTap: this.onMobileTap.bind(this)
    };

    // Track if we auto-paused so we can auto-unpause
    this._autoPausedOnBlur = false;

    this.dragState = {
      active: false,
      pending: false,
      creature: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      startTime: 0,
      lastX: 0,
      lastY: 0,
      lastWorldX: 0,
      lastWorldY: 0,
      lastTime: 0,
      velocityX: 0,
      velocityY: 0,
      grabOffsetX: 0,
      grabOffsetY: 0
    };
    this.godHoldTimeout = null;
    this.godHoldPointerId = null;
    this.godHoldTriggered = false;
    this.godHoldStart = null;
    this.godHoldThreshold = 14;
    this.grabActivateMs = 160;
    this.grabActivateMsTouch = 220;
    this.grabMoveThreshold = 7;
    this.grabMoveThresholdTouch = 11;
    this.throwSpeedMin = 55;
    this.throwSpeedMax = 260;
    this.throwImpulseScale = 0.36;
    this.throwImpulseCap = 320;

    this.initialize();
  }

  /**
   * Initialize input event listeners
   */
  initialize() {
    // Keyboard events
    window.addEventListener('keydown', this.boundHandlers.onKeyDown);
    window.addEventListener('blur', this.boundHandlers.onBlur);
    window.addEventListener('focus', this.boundHandlers.onFocus);

    // Visibility change (handles tab switching, minimize, etc.)
    document.addEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);

    // Pointer events (unified mouse/touch)
    this.canvas.addEventListener('pointerdown', this.boundHandlers.onPointerDown);
    this.canvas.addEventListener('pointermove', this.boundHandlers.onPointerMove);
    this.canvas.addEventListener('pointerup', this.boundHandlers.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.boundHandlers.onPointerLeave);
    this.canvas.addEventListener('wheel', this.boundHandlers.onWheel, { passive: false });

    // Mobile touch events
    this.canvas.addEventListener('mobiletap', this.boundHandlers.onMobileTap);
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    window.removeEventListener('keydown', this.boundHandlers.onKeyDown);
    window.removeEventListener('blur', this.boundHandlers.onBlur);
    window.removeEventListener('focus', this.boundHandlers.onFocus);
    document.removeEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);
    this.canvas.removeEventListener('pointerdown', this.boundHandlers.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundHandlers.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundHandlers.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.boundHandlers.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.boundHandlers.onWheel);
    this.canvas.removeEventListener('mobiletap', this.boundHandlers.onMobileTap);
  }

  /**
   * Handle keyboard input
   */
  onKeyDown(e) {
    // Ignore if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Handle meta/cmd key combinations first
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      this.handleCtrlKey(e);
      return;
    }

    // Handle regular keys
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      this.handleRegularKey(e);
    }
  }

  /**
   * Handle Ctrl/Cmd key combinations
   */
  handleCtrlKey(e) {
    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          this.tools?.redo?.();
        } else {
          this.tools?.undo?.();
        }
        break;
      case 'y':
        e.preventDefault();
        this.tools?.redo?.();
        break;
      case 's':
        e.preventDefault();
        // Save handled by main.js saveSystem
        break;
      case 'o':
        e.preventDefault();
        // Load handled by main.js saveSystem
        break;
    }
  }

  /**
   * Handle regular key presses
   */
  handleRegularKey(e) {
    const renderer = this.world?.renderer;
    const analytics = this.world?.analytics;
    const miniGraphs = this.world?.miniGraphs;

    switch (e.key.toLowerCase()) {
      // Core controls
      case ' ':
        gameState.togglePause();
        e.preventDefault();
        break;
      case 'i':
        gameState.toggleInspector();
        this.updateInspectorVisibility();
        break;

      // Tool modes
      case 'f':
        if (e.shiftKey) {
          this.toggleFollowMode();
        } else {
          this.tools.setMode('food');
          eventSystem.emit('tool:changed', { mode: 'food' });
        }
        break;
      case 's':
        this.tools.setMode('spawn');
        eventSystem.emit('tool:changed', { mode: 'spawn' });
        break;
      case 'e':
        this.tools.setMode('erase');
        eventSystem.emit('tool:changed', { mode: 'erase' });
        break;
      case 'x':
        this.tools.setMode('inspect');
        eventSystem.emit('tool:changed', { mode: 'inspect' });
        break;
      case 'p':
        this.tools.setMode('prop');
        eventSystem.emit('tool:changed', { mode: 'prop' });
        break;
      case '[':
        this.tools?.adjustBrushSize?.(-4);
        break;
      case ']':
        this.tools?.adjustBrushSize?.(4);
        break;

      // Speed controls
      case '+':
        gameState.fastForward = Math.min(5, gameState.fastForward + 1);
        break;
      case '-':
        gameState.fastForward = Math.max(1, gameState.fastForward - 1);
        break;

      // Feature toggles
      case 'v':
        if (renderer) {
          renderer.setFeature?.('VISION', !renderer.enableVision);
          const checkbox = domCache.get('toggleVision');
          if (checkbox) checkbox.checked = renderer.enableVision;
        }
        break;
      case 'c':
        if (renderer) {
          renderer.setFeature?.('CLUSTERING', !renderer.enableClustering);
          const checkbox = domCache.get('toggleClustering');
          if (checkbox) checkbox.checked = renderer.enableClustering;
        }
        break;
      case 't':
        if (renderer) {
          renderer.setFeature?.('TERRITORIES', !renderer.enableTerritories);
          const checkbox = domCache.get('toggleTerritories');
          if (checkbox) checkbox.checked = renderer.enableTerritories;
        }
        break;
      case 'm':
        if (renderer) {
          renderer.setFeature?.('MEMORY', !renderer.enableMemory);
          const checkbox = domCache.get('toggleMemory');
          if (checkbox) checkbox.checked = renderer.enableMemory;
        }
        break;
      case 'b':
        if (renderer) {
          renderer.setFeature?.('SOCIAL', !renderer.enableSocialBonds);
          const checkbox = domCache.get('toggleSocial');
          if (checkbox) checkbox.checked = renderer.enableSocialBonds;
        }
        break;
      case 'g':
        if (renderer) {
          renderer.setFeature?.('MIGRATION', !renderer.enableMigration);
          const checkbox = domCache.get('toggleMigration');
          if (checkbox) checkbox.checked = renderer.enableMigration;
        }
        break;

      // Advanced features
      case '1':
        if (renderer) {
          renderer.enableEmotions = !renderer.enableEmotions;
        }
        break;
      case '2':
        if (renderer) {
          renderer.enableSensoryViz = !renderer.enableSensoryViz;
        }
        break;
      case '3':
        if (renderer) {
          renderer.enableIntelligence = !renderer.enableIntelligence;
        }
        break;
      case '4':
        if (renderer) {
          renderer.enableMating = !renderer.enableMating;
        }
        break;

      // UI toggles
      case 'h':
        const statsEl = domCache.get('stats');
        if (statsEl) {
          statsEl.classList.toggle('hidden');
        }
        break;
      case 'l':
        if (miniGraphs) {
          miniGraphs.enabled = !miniGraphs.enabled;
        }
        break;
      case 'n':
        if (renderer) {
          renderer.enableMiniMap = !renderer.enableMiniMap;
        }
        break;
      case 'a':
        if (renderer && miniGraphs) {
          renderer.miniMapAutoHide = !renderer.miniMapAutoHide;
          miniGraphs.autoHide = !miniGraphs.autoHide;
        }
        break;

      // Debug console
      case '`':
      case '~':
        // Debug console toggle handled by debugConsole.toggle()
        e.preventDefault();
        break;

      // Help overlay
      case '?':
        this.toggleShortcutsHelp();
        break;
      case 'q':
        gameState.showQuirks = !gameState.showQuirks;
        break;

      // Escape key
      case 'escape':
        this.handleEscape();
        break;
    }
  }

  /**
   * Toggle keyboard shortcuts help overlay
   */
  toggleShortcutsHelp() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden');
    }
  }

  /**
   * Handle escape key
   */
  handleEscape() {
    // Close shortcuts overlay if open
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');
    if (shortcutsOverlay && !shortcutsOverlay.classList.contains('hidden')) {
      shortcutsOverlay.classList.add('hidden');
      return;
    }

    const mobileSpawnSheet = domCache.get('mobileSpawnSheet');
    const mobileSpawnBackdrop = domCache.get('mobileSpawnBackdrop');
    if (mobileSpawnSheet && !mobileSpawnSheet.classList.contains('hidden')) {
      mobileSpawnSheet.classList.add('hidden');
      mobileSpawnSheet.setAttribute('aria-hidden', 'true');
      if (mobileSpawnBackdrop) {
        mobileSpawnBackdrop.classList.add('hidden');
        mobileSpawnBackdrop.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    // Cancel spawn mode first
    if (gameState.spawnMode) {
      this.cancelSpawnMode();
      return;
    }

    // Clear selections
    if (gameState.lineageRootId !== null) {
      gameState.lineageRootId = null;
    } else if (gameState.pinnedId !== null) {
      gameState.pinnedId = null;
    } else if (gameState.selectedId !== null) {
      gameState.selectedId = null;
    }

    // Show inspector if not visible
    if (!gameState.inspectorVisible) {
      gameState.setInspectorVisible(true);
    }


  }

  /**
   * Cancel spawn mode
   */
  cancelSpawnMode() {
    gameState.setSpawnMode(null);
    this.canvas.style.cursor = 'default';

    const spawnBtn = domCache.get('spawnCreatureBtn');
    if (spawnBtn) {
      spawnBtn.textContent = '🦌 Spawn Creature ▼';
      spawnBtn.classList.remove('active');
    }

    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => item.classList.remove('selected'));
  }

  /**
   * Toggle camera follow mode
   */
  toggleFollowMode() {
    if (!gameState.selectedId) {
      return;
    }

    if (this.camera.followMode === 'free') {
      this.camera.followMode = 'smooth-follow';
      this.camera.followTarget = gameState.selectedId;
    } else {
      this.camera.followMode = 'free';
      this.camera.followTarget = null;
    }
  }

  /**
   * Mark that user has taken control of the camera.
   * Sets PERMANENT override - auto-director won't move camera until user re-enables.
   */
  noteCameraOverride(durationMs = 6000) {
    const now = performance.now();
    gameState.autoDirectorOverrideUntil = now + durationMs;

    // Set permanent override on camera - user has taken control
    if (this.camera?.setUserOverride) {
      this.camera.setUserOverride(true);
    }
  }

  /**
   * Update inspector visibility in UI
   */
  updateInspectorVisibility() {
    const inspector = domCache.get('inspector');
    const showBtn = domCache.get('showInspectorBtn');

    if (gameState.inspectorVisible) {
      if (inspector) inspector.classList.remove('hidden');
      if (showBtn) showBtn.classList.add('hidden');
    } else {
      if (inspector) inspector.classList.add('hidden');
      if (showBtn) showBtn.classList.remove('hidden');
    }
  }

  /**
   * Handle pointer down events
   */
  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const sx = canvasX - rect.width / 2;
    const sy = canvasY - rect.height / 2;
    const worldPos = this.camera.screenToWorld(sx, sy);

    // Handle mini-map clicks first
    if (this.handleMiniMapClick(canvasX, canvasY, e)) {
      return;
    }

    // Update pointer state
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
      this.world.lastPointerWorld = { x: worldPos.x, y: worldPos.y };
    }

    if (this.tools.mode !== 'inspect') {
      this._setHoveredCreature(null);
    }

    // Handle panning (middle mouse or alt key)
    if (e.button === 1 || e.button === 2 || e.altKey || e.metaKey) {
      gameState.panning = true;
      this.noteCameraOverride();
      return;
    }

    if (e.pointerType === 'touch' && e.button === 0) {
      this.scheduleGodHold(e);
    }

    // Handle left click
    if (e.button === 0) {
      gameState.painting = true;

      const allowDrag = !gameState.godModeActive;
      const dragCandidate = allowDrag ? this._prepareCreatureDrag(worldPos.x, worldPos.y, e) : false;
      if (dragCandidate) {
        gameState.travelDrag = null;
        gameState.travelPreview = null;
      }

      // Set up travel drag for inspect mode
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
  }

  /**
   * Handle pointer move events
   */
  onPointerMove(e) {
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
      this.world.lastPointerWorld = { x: worldPos.x, y: worldPos.y };
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
  }

  /**
   * Handle pointer up events
   */
  onPointerUp(e) {
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

    // Handle travel drag completion
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

    // Reset state
    gameState.travelDrag = null;
    gameState.travelPreview = null;
    gameState.painting = false;
    gameState.panning = false;
  }

  /**
   * Handle pointer leave events
   */
  onPointerLeave() {
    this._setHoveredCreature(null);
  }

  /**
   * Handle wheel events for zooming
   */
  onWheel(e) {
    e.preventDefault();
    this.noteCameraOverride();
    this.camera.zoomBy(e.deltaY * 0.0015);
  }

  /**
   * Handle window blur (pause game)
   * Only auto-pause if game was playing - track this so we can auto-unpause
   */
  onBlur() {
    if (!gameState.paused) {
      this._autoPausedOnBlur = true;
      gameState.paused = true;
      // Emit event so UI can update
      eventSystem.emit('game:paused', { reason: 'blur' });
    }
  }

  /**
   * Handle window focus (optionally unpause game)
   */
  onFocus() {
    // Auto-unpause only if we auto-paused on blur
    if (this._autoPausedOnBlur) {
      this._autoPausedOnBlur = false;
      gameState.paused = false;
      // Emit event so UI can update
      eventSystem.emit('game:resumed', { reason: 'focus' });
    }
  }

  /**
   * Handle visibility change (tab switching, minimize)
   */
  onVisibilityChange() {
    if (document.hidden) {
      // Page is hidden - pause if playing
      if (!gameState.paused) {
        this._autoPausedOnBlur = true;
        gameState.paused = true;
        eventSystem.emit('game:paused', { reason: 'visibility' });
      }
    } else {
      // Page is visible - unpause if we auto-paused
      if (this._autoPausedOnBlur) {
        this._autoPausedOnBlur = false;
        gameState.paused = false;
        eventSystem.emit('game:resumed', { reason: 'visibility' });
      }
    }
  }

  /**
   * Handle mobile tap events
   */
  onMobileTap(e) {
    const detail = e.detail;
    const rect = this.canvas.getBoundingClientRect();
    const sx = detail.x - rect.left - this.canvas.width / 2;
    const sy = detail.y - rect.top - this.canvas.height / 2;
    const { x, y } = this.camera.screenToWorld(sx, sy);

    // Find nearest creature
    let nearest = null;
    let minDist = 40 / this.camera.zoom; // Touch-friendly radius

    for (const c of this.world.creatures) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < minDist) {
        minDist = d;
        nearest = c;
      }
    }

    if (nearest) {
      gameState.selectCreature(nearest.id);

      // Enable camera follow mode automatically
      this.camera.followMode = 'smooth-follow';
      this.camera.followTarget = nearest.id;
      this.camera.clearUserOverride(); // Allow camera to follow

      gameState.setInspectorVisible(true);
      const inspector = domCache.get('inspector');
      if (inspector) inspector.classList.remove('minimized');
      if (typeof nearest.reactToPoke === 'function') {
        nearest.reactToPoke({ x, y });
      }
      if (gameState.selectionPulseUntil === null) {
        gameState.selectionPulseUntil = 0;
      }
      gameState.selectionPulseUntil = performance.now() + 400;
    }
  }

  /**
   * Handle mini-map clicks
   */
  handleMiniMapClick(canvasX, canvasY, event) {
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
  }

  /**
   * Handle pointer actions (drawing/spawning/selecting)
   * Handles creature selection, food spawning, etc.
   */
  handlePointerAction(e, isDrag) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Convert to world coordinates
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

    // Handle different tool modes
    const mode = this.tools?.mode || 'inspect';

    switch (mode) {
      case 'food': {
        // Spawn food at click location
        if (!isDrag || Math.random() < 0.3) { // Throttle during drag
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

        // Spawn creature (handled elsewhere via gene editor mode)
        if (gameState.geneEditorSpawnMode) {
          // Gene editor spawn mode - dispatch event
          eventSystem.emit('gene-editor:spawn', { x, y });
          break;
        }

        const selectedType = gameState.selectedCreatureType || 'herbivore';
        if (this.tools?.spawnCreature) {
          this.tools.spawnCreature(x, y, { type: selectedType });
        } else {
          this.world.spawnCreatureType(selectedType, x, y);
        }
        break;
      }

      case 'erase': {
        // Kill creature at location
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
        // Select creature at location (only on initial click, not drag)
        if (!isDrag) {
          const creature = this._findCreatureAt(x, y);
          if (creature) {
            gameState.selectCreature(creature.id);

            // Enable camera follow mode automatically when clicking a creature
            this.camera.followMode = 'smooth-follow';
            this.camera.followTarget = creature.id;
            this.camera.clearUserOverride(); // Allow camera to follow

            // Show selected info
            const selectedInfo = document.getElementById('selected-info');
            if (selectedInfo) selectedInfo.classList.remove('hidden');
            if (typeof creature.reactToPoke === 'function') {
              creature.reactToPoke({ x, y });
            }
            if (gameState.selectionPulseUntil === null) {
              gameState.selectionPulseUntil = 0;
            }
            gameState.selectionPulseUntil = performance.now() + 400;
          } else {
            // Clicked empty space - deselect and stop following
            gameState.selectedId = null;
            this.camera.followMode = 'free';
            this.camera.followTarget = null;
          }
        }
        break;
      }
    }
  }

  scheduleGodHold(e) {
    this.clearGodHold();
    this.godHoldPointerId = e.pointerId;
    this.godHoldStart = { x: e.clientX, y: e.clientY };
    this.godHoldTimeout = window.setTimeout(() => {
      this.godHoldTriggered = true;
      eventSystem.emit(GameEvents.GOD_MODE_TOGGLE, { source: 'gesture' });
    }, 650);
  }

  clearGodHold() {
    if (this.godHoldTimeout) {
      window.clearTimeout(this.godHoldTimeout);
      this.godHoldTimeout = null;
    }
    this.godHoldPointerId = null;
    this.godHoldStart = null;
    this.godHoldTriggered = false;
  }

  handleGodModeAction(x, y, isDrag) {
    if (isDrag) return;
    const tool = gameState.godModeTool || 'food';

    switch (tool) {
      case 'food': {
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
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'food', x, y });
        break;
      }
      case 'calm': {
        this.world.addCalmZone(
          x,
          y,
          CreatureAgentTuning.GOD_MODE.CALM_RADIUS,
          CreatureAgentTuning.GOD_MODE.CALM_DURATION,
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
      case 'remove': {
        const target = this._findCreatureAt(x, y, 34 / this.camera.zoom);
        if (target) {
          target.alive = false;
          target.deathTime = this.world.t;
          target.deathCause = 'god';
          target.killedBy = 'god';
          this.world.creatureManager.removeCreature(target);
          eventSystem.emit(GameEvents.GOD_MODE_ACTION, { action: 'remove', id: target.id });
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Find creature at world coordinates
   */
  _findCreatureAt(x, y, searchRadius = 25 / this.camera.zoom) {
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
  }

  _prepareCreatureDrag(x, y, event) {
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
  }

  _activateCreatureDrag(worldX, worldY) {
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
  }

  _updateCreatureDrag(event) {
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
  }

  _releaseCreatureDrag(event) {
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
  }

  _updateHoverTarget(event) {
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
  }

  _setHoveredCreature(id) {
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
  }

  /**
   * Get default genes for creature type
   */
  _getCreatureGenes(type) {
    switch (type) {
      case 'predator':
        return { diet: 1.0, aggression: 1.5, speed: 1.3, isPredator: 1 };
      case 'omnivore':
        return { diet: 0.5, aggression: 0.8, speed: 1.0, isPredator: 0 };
      case 'herbivore':
      default:
        return { diet: 0.0, aggression: 0.3, speed: 1.0, isPredator: 0 };
    }
  }
}
