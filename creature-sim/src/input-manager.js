/**
 * Input Manager - Centralized input handling system
 * Handles keyboard, mouse, touch, and pointer events
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem } from './event-system.js';
import { Creature } from './creature.js';

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
      onWheel: this.onWheel.bind(this),
      onBlur: this.onBlur.bind(this),
      onFocus: this.onFocus.bind(this),
      onVisibilityChange: this.onVisibilityChange.bind(this),
      onMobileTap: this.onMobileTap.bind(this)
    };

    // Track if we auto-paused so we can auto-unpause
    this._autoPausedOnBlur = false;

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
        }
        break;
      case 's':
        this.tools.setMode('spawn');
        break;
      case 'e':
        this.tools.setMode('erase');
        break;
      case 'x':
        this.tools.setMode('inspect');
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
          renderer.enableVision = !renderer.enableVision;
          const checkbox = domCache.get('toggle-vision');
          if (checkbox) checkbox.checked = renderer.enableVision;
        }
        break;
      case 'c':
        if (renderer) {
          renderer.enableClustering = !renderer.enableClustering;
          const checkbox = domCache.get('toggle-clustering');
          if (checkbox) checkbox.checked = renderer.enableClustering;
        }
        break;
      case 't':
        if (renderer) {
          renderer.enableTerritories = !renderer.enableTerritories;
        }
        break;
      case 'm':
        if (renderer) {
          renderer.enableMemory = !renderer.enableMemory;
        }
        break;
      case 'b':
        if (renderer) {
          renderer.enableSocialBonds = !renderer.enableSocialBonds;
        }
        break;
      case 'g':
        if (renderer) {
          renderer.enableMigration = !renderer.enableMigration;
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

    // TODO: Update inspector display
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

    // Handle panning (middle mouse or alt key)
    if (e.button === 1 || e.button === 2 || e.altKey || e.metaKey) {
      gameState.panning = true;
      return;
    }

    // Handle left click
    if (e.button === 0) {
      gameState.painting = true;

      // Set up travel drag for inspect mode
      if (this.tools.mode === 'inspect' && !e.shiftKey) {
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

      // TODO: Handle pointer action
      this.handlePointerAction(e, false);
    }
  }

  /**
   * Handle pointer move events
   */
  onPointerMove(e) {
    if (gameState.panning) {
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

    if (!gameState.painting) return;

    this.handlePointerAction(e, true);
  }

  /**
   * Handle pointer up events
   */
  onPointerUp(e) {
    this.canvas.releasePointerCapture?.(e.pointerId);

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
    } else if (this.tools.mode === 'inspect' && e.button === 0 && !e.shiftKey) {
      this.camera.focusOn(x, y);
    }

    // Reset state
    gameState.travelDrag = null;
    gameState.travelPreview = null;
    gameState.painting = false;
    gameState.panning = false;
  }

  /**
   * Handle wheel events for zooming
   */
  onWheel(e) {
    e.preventDefault();
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
      this.camera.focusOn(nearest.x, nearest.y);
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
          if (this.tools?.eraseCreatures) {
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

      case 'inspect':
      default: {
        // Select creature at location (only on initial click, not drag)
        if (!isDrag) {
          const creature = this._findCreatureAt(x, y);
          if (creature) {
            gameState.selectCreature(creature.id);
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
            // Clicked empty space - deselect
            gameState.selectedId = null;
          }
        }
        break;
      }
    }
  }

  /**
   * Find creature at world coordinates
   */
  _findCreatureAt(x, y) {
    const searchRadius = 25 / this.camera.zoom; // Adjust for zoom level
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
