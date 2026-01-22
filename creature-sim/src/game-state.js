/**
 * Game State Manager - Centralized state management.
 * Replaces scattered global variables with organized state.
 *
 * Provides a single source of truth for:
 * - Game flow (paused, started, speed)
 * - Selection state (selectedId, pinnedId, lineageRootId)
 * - Input state (painting, panning)
 * - UI visibility (inspector, panels)
 * - Performance metrics (FPS, rendered/culled counts)
 *
 * @example
 * import { gameState } from './game-state.js';
 *
 * gameState.togglePause();
 * gameState.selectCreature(42);
 * if (gameState.paused) { ... }
 */
export class GameState {
  constructor() {
    this.reset();
  }

  /**
   * Reset game state to initial values
   */
  reset() {
    // Core game state
    this.gameStarted = false;
    this.paused = false;
    this.fastForward = 1;
    this.timeScale = 1;
    this.accumulator = 0;
    this.fps = 0;

    // Selection state
    this.selectedId = null;
    this.pinnedId = null;
    this.lineageRootId = null;
    this.selectionPulseUntil = null;
    this.hoveredId = null;

    // Input state
    this.painting = false;
    this.panning = false;
    this.travelDrag = null;
    this.travelPreview = null;
    this.lastPointer = { x: 0, y: 0 };

    // UI state
    this.inspectorVisible = true;
    this.scenarioPanelVisible = false;
    this.featuresPanelVisible = false;
    this.sessionMetaVisible = true;

    // Spawn state
    this.selectedCreatureType = null;
    this.selectedPropType = 'bounce';
    this.spawnMode = false;
    this.geneEditorSpawnMode = false;

    // Performance tracking
    this.renderedCount = 0;
    this.culledCount = 0;
    this.analyticsVersion = -1;
    this.scenarioQueueVersion = -1;
    this.lastScenarioQueueRender = 0;
    this.hudBottomHeight = 0;
    this.hudBottomMeasuredAt = 0;

    // Mobile state
    this.mobileSpeedIndex = 1; // 0=0.5x, 1=1x, 2=2x, 3=4x
  }

  /**
   * Get current game state snapshot
   */
  getSnapshot() {
    return {
      gameStarted: this.gameStarted,
      paused: this.paused,
      fastForward: this.fastForward,
      selectedId: this.selectedId,
      pinnedId: this.pinnedId,
      lineageRootId: this.lineageRootId,
      inspectorVisible: this.inspectorVisible,
      fps: this.fps,
      renderedCount: this.renderedCount,
      culledCount: this.culledCount
    };
  }

  /**
   * Set multiple state properties at once
   */
  setState(updates) {
    Object.assign(this, updates);
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  /**
   * Select a creature
   */
  selectCreature(id) {
    this.selectedId = id;
    if (id && this.pinnedId !== id) {
      this.pinnedId = id;
    }
  }

  /**
   * Pin/unpin current selection
   */
  togglePin() {
    if (this.selectedId) {
      this.pinnedId = this.pinnedId === this.selectedId ? null : this.selectedId;
    }
  }

  /**
   * Set lineage root
   */
  setLineageRoot(id) {
    if (id !== null && this.lineageRootId === id) {
      this.lineageRootId = null;
    } else {
      this.lineageRootId = id;
    }
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.selectedId = null;
    this.pinnedId = null;
    this.lineageRootId = null;
  }

  /**
   * Set spawn mode
   */
  setSpawnMode(type = null) {
    this.selectedCreatureType = type;
    this.spawnMode = type !== null;
    this.geneEditorSpawnMode = false; // Cancel gene editor mode
  }

  /**
   * Set gene editor spawn mode
   */
  setGeneEditorSpawnMode(enabled) {
    this.geneEditorSpawnMode = enabled;
    if (enabled) {
      this.spawnMode = false; // Cancel normal spawn mode
    }
  }

  /**
   * Toggle inspector visibility
   */
  toggleInspector() {
    this.inspectorVisible = !this.inspectorVisible;
  }

  /**
   * Set inspector visibility
   */
  setInspectorVisible(visible) {
    this.inspectorVisible = visible;
  }

  /**
   * Update mobile speed setting
   */
  cycleMobileSpeed() {
    const speeds = [0.5, 1, 2, 4];
    this.mobileSpeedIndex = (this.mobileSpeedIndex + 1) % speeds.length;
    this.fastForward = speeds[this.mobileSpeedIndex];
  }

  /**
   * Get mobile speed display info
   */
  getMobileSpeedInfo() {
    const speeds = [0.5, 1, 2, 4];
    const emojis = ['🐌', '⚡', '⚡⚡', '⚡⚡⚡'];
    const labels = ['0.5×', '1×', '2×', '4×'];
    return {
      speed: speeds[this.mobileSpeedIndex],
      emoji: emojis[this.mobileSpeedIndex],
      label: labels[this.mobileSpeedIndex]
    };
  }

  /**
   * Update performance metrics
   */
  updatePerformance(rendered, culled, draws) {
    this.renderedCount = rendered;
    this.culledCount = culled;
    if (draws !== undefined) {
      this.drawsCount = draws;
    }
  }

  /**
   * Check if game is ready to run
   */
  isReady() {
    return this.gameStarted;
  }

  /**
   * Mark game as started
   */
  startGame() {
    this.gameStarted = true;
  }
}

// Global game state instance
export const gameState = new GameState();
