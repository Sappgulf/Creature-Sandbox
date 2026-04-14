/**
 * Input Manager - Centralized input handling system
 * Handles keyboard, mouse, touch, and pointer events
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem } from './event-system.js';

import { CreatureAgentTuning } from './creature-agent-constants.js';

import { applyInputPointerMethods } from './input-pointer.js';
import { applyInputTouchMethods } from './input-touch.js';

export class InputManager {
  constructor(canvas, camera, tools, world) {
    this.canvas = canvas;
    this.camera = camera;
    this.tools = tools;
    this.world = world;
    this.tutorial = null;

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
    this.godActionIntervals = {
      ...(CreatureAgentTuning.GOD_MODE?.ACTION_INTERVAL_MS || {})
    };
    this.godDragDistanceBase = CreatureAgentTuning.GOD_MODE?.DRAG_DISTANCE_BASE || 14;
    this.godActionState = {
      lastTool: null,
      nextAt: 0,
      lastX: 0,
      lastY: 0
    };

    this.initialize();
  }

  /**
   * Initialize input event listeners
   */
  initialize() {
    window.addEventListener('keydown', this.boundHandlers.onKeyDown);
    window.addEventListener('blur', this.boundHandlers.onBlur);
    window.addEventListener('focus', this.boundHandlers.onFocus);

    document.addEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);

    this.canvas.addEventListener('pointerdown', this.boundHandlers.onPointerDown);
    this.canvas.addEventListener('pointermove', this.boundHandlers.onPointerMove);
    this.canvas.addEventListener('pointerup', this.boundHandlers.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.boundHandlers.onPointerLeave);
    this.canvas.addEventListener('wheel', this.boundHandlers.onWheel, { passive: false });

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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      this.handleCtrlKey(e);
      return;
    }

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
        break;
      case 'o':
        e.preventDefault();
        break;
    }
  }

  /**
   * Handle regular key presses
   */
  handleRegularKey(e) {
    const renderer = this.world?.renderer;
    const miniGraphs = this.world?.miniGraphs;
    const godToolHotkeys = {
      '1': 'food',
      '2': 'calm',
      '3': 'chaos',
      '4': 'spawn',
      '5': 'prop',
      '6': 'remove'
    };
    if (gameState.godModeActive) {
      const hotTool = godToolHotkeys[e.key];
      if (hotTool) {
        this._setGodTool(hotTool, 'hotkey');
        e.preventDefault();
        return;
      }
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        if (gameState.togglePause()) {
          eventSystem.emit('game:paused', { reason: 'keyboard' });
        } else {
          eventSystem.emit('game:resumed', { reason: 'keyboard' });
        }
        e.preventDefault();
        break;
      case 'i':
        gameState.toggleInspector();
        gameState.setInspectorAutoOpen(gameState.inspectorVisible);
        this.updateInspectorVisibility();
        break;

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

      case '+':
        gameState.fastForward = Math.min(5, gameState.fastForward + 1);
        break;
      case '-':
        gameState.fastForward = Math.max(1, gameState.fastForward - 1);
        break;

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

      case 'd':
        gameState.showDebugOverlay = !gameState.showDebugOverlay;
        console.debug(`🔧 Debug overlay: ${gameState.showDebugOverlay ? 'ON' : 'OFF'}`);
        break;

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

      case '`':
      case '~':
        e.preventDefault();
        break;

      case '?':
        this.toggleShortcutsHelp();
        break;
      case 'q':
        gameState.showQuirks = !gameState.showQuirks;
        break;

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
      const shouldShow = overlay.classList.contains('hidden');
      overlay.classList.toggle('hidden', !shouldShow);
      overlay.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }
  }

  /**
   * Handle escape key
   */
  handleEscape() {
    const shortcutsOverlay = document.getElementById('shortcuts-overlay');
    if (shortcutsOverlay && !shortcutsOverlay.classList.contains('hidden')) {
      shortcutsOverlay.classList.add('hidden');
      shortcutsOverlay.setAttribute('aria-hidden', 'true');
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

    const closeablePanels = [
      'features-panel',
      'scenario-panel',
      'achievements-panel',
      'gene-editor-panel',
      'eco-health-panel',
      'moments-panel',
      'campaign-panel'
    ];
    for (const panelId of closeablePanels) {
      const panel = document.getElementById(panelId);
      if (!panel || panel.classList.contains('hidden')) continue;
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
      if (panelId === 'features-panel') gameState.featuresPanelVisible = false;
      if (panelId === 'scenario-panel') gameState.scenarioPanelVisible = false;
      return;
    }

    if (gameState.spawnMode) {
      this.cancelSpawnMode();
      return;
    }

    if (gameState.lineageRootId !== null) {
      gameState.lineageRootId = null;
    } else if (gameState.pinnedId !== null) {
      gameState.pinnedId = null;
    } else if (gameState.selectedId !== null) {
      gameState.selectedId = null;
    } else if (gameState.inspectorVisible) {
      gameState.setInspectorVisible(false);
      gameState.setInspectorAutoOpen(false);
      this.updateInspectorVisibility();
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
   */
  noteCameraOverride(durationMs = 6000) {
    const now = performance.now();
    gameState.autoDirectorOverrideUntil = now + durationMs;

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
      if (inspector) inspector.setAttribute('aria-hidden', 'false');
      if (showBtn) {
        showBtn.classList.add('hidden');
        showBtn.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (inspector) inspector.classList.add('hidden');
      if (inspector) inspector.setAttribute('aria-hidden', 'true');
      if (showBtn) {
        showBtn.classList.remove('hidden');
        showBtn.setAttribute('aria-hidden', 'false');
      }
    }
  }

  /**
   * Handle window blur (pause game)
   */
  onBlur() {
    if (!gameState.paused) {
      this._autoPausedOnBlur = true;
      gameState.paused = true;
      eventSystem.emit('game:paused', { reason: 'blur' });
    }
  }

  /**
   * Handle window focus (optionally unpause game)
   */
  onFocus() {
    if (this._autoPausedOnBlur) {
      this._autoPausedOnBlur = false;
      gameState.paused = false;
      eventSystem.emit('game:resumed', { reason: 'focus' });
    }
  }

  /**
   * Handle visibility change (tab switching, minimize)
   */
  onVisibilityChange() {
    if (document.hidden) {
      if (!gameState.paused) {
        this._autoPausedOnBlur = true;
        gameState.paused = true;
        eventSystem.emit('game:paused', { reason: 'visibility' });
      }
    } else {
      if (this._autoPausedOnBlur) {
        this._autoPausedOnBlur = false;
        gameState.paused = false;
        eventSystem.emit('game:resumed', { reason: 'visibility' });
      }
    }
  }

}

applyInputPointerMethods(InputManager);
applyInputTouchMethods(InputManager);
