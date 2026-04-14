/**
 * Control Strip Controller - Unified bottom control bar for mobile-first UI
 * Replaces the legacy top HUD with a thumb-friendly bottom control strip
 */
import { gameState } from './game-state.js';
import { eventSystem } from './event-system.js';

// Speed multipliers for cycling
const SPEED_OPTIONS = [0.5, 1, 2, 4];
const SPEED_LABELS = ['0.5×', '1×', '2×', '4×'];

export class ControlStripController {
  constructor(options = {}) {
    this.world = options.world;
    this.camera = options.camera;
    this.tools = options.tools;
    this.uiController = options.uiController;
    this.renderer = options.renderer;

    // State
    this.currentSpawnType = 'herbivore';
    this.speedIndex = 1; // Default to 1×
    this.isWatchMode = !!gameState.watchModeEnabled;
    this.isGodMode = !!gameState.godModeActive;

    // Drawer states
    this.spawnDrawerOpen = false;
    this.overflowDrawerOpen = false;
    this.mobilePrefs = this.loadMobilePrefs();

    // Initialize
    this.lastUIStateSignature = '';
    this.cacheElements();
    this.bindEvents();
    this.updateUI({ force: true });
  }

  cacheElements() {
    // Control strip
    this.controlStrip = document.getElementById('control-strip');
    this.ctrlPause = document.getElementById('ctrl-pause');
    this.ctrlSpeed = document.getElementById('ctrl-speed');
    this.ctrlFood = document.getElementById('ctrl-food');
    this.ctrlSpawn = document.getElementById('ctrl-spawn');
    this.ctrlWatch = document.getElementById('ctrl-watch');
    this.ctrlGod = document.getElementById('ctrl-god');
    this.ctrlMore = document.getElementById('ctrl-more');

    // Spawn drawer
    this.spawnDrawer = document.getElementById('spawn-drawer');
    this.spawnDrawerClose = document.getElementById('spawn-drawer-close');
    this.spawnDrawerConfirm = document.getElementById('spawn-drawer-confirm');
    this.spawnCards = this.spawnDrawer?.querySelectorAll('.spawn-card');

    // Overflow drawer
    this.overflowDrawer = document.getElementById('overflow-drawer');
    this.overflowDrawerClose = document.getElementById('overflow-drawer-close');
    this.menuItems = this.overflowDrawer?.querySelectorAll('.menu-item');

    // Watch strip
    this.watchStrip = document.getElementById('watch-strip');
    this.watchPause = document.getElementById('watch-pause');
    this.watchSpeed = document.getElementById('watch-speed');
    this.watchFollow = document.getElementById('watch-follow');
    this.watchRecenter = document.getElementById('watch-recenter');
    this.watchMoments = document.getElementById('watch-moments');
    this.watchGodMode = document.getElementById('watch-god-mode');
    this.watchExit = document.getElementById('watch-exit');
  }

  bindEvents() {
    // Control strip buttons
    this.ctrlPause?.addEventListener('click', () => this.togglePause());
    this.ctrlSpeed?.addEventListener('click', () => this.cycleSpeed());
    this.ctrlFood?.addEventListener('click', () => this.activateFoodTool());
    this.ctrlSpawn?.addEventListener('click', () => this.openSpawnDrawer());
    this.ctrlWatch?.addEventListener('click', () => this.toggleWatchMode());
    this.ctrlGod?.addEventListener('click', () => this.toggleGodMode());
    this.ctrlMore?.addEventListener('click', () => this.openOverflowDrawer());

    // Spawn drawer
    this.spawnDrawerClose?.addEventListener('click', () => this.closeSpawnDrawer());
    this.spawnDrawerConfirm?.addEventListener('click', () => this.confirmSpawn());
    this.spawnDrawer?.querySelector('.drawer-backdrop')?.addEventListener('click', () => this.closeSpawnDrawer());

    this.spawnCards?.forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.creature;
        if (type) this.selectSpawnType(type);
      });
    });

    // Overflow drawer
    this.overflowDrawerClose?.addEventListener('click', () => this.closeOverflowDrawer());
    this.overflowDrawer?.querySelector('.drawer-backdrop')?.addEventListener('click', () => this.closeOverflowDrawer());

    this.overflowDrawer?.addEventListener('click', (event) => {
      const item = event.target.closest('.menu-item');
      if (!item) return;
      const action = item.dataset.action;
      if (action) {
        this.handleMenuAction(action);
      }
    });

    // Watch strip buttons are delegated so bindings survive UI refreshes.
    this.watchStrip?.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      switch (button.id) {
        case 'watch-pause':
          this.togglePause();
          break;
        case 'watch-speed':
          this.cycleSpeed();
          break;
        case 'watch-follow':
          this.toggleFollow();
          break;
        case 'watch-recenter':
          this.recenterCamera();
          break;
        case 'watch-moments':
          this.openMoments();
          break;
        case 'watch-god-mode':
          this.toggleGodMode();
          break;
        case 'watch-exit':
          this.exitWatchMode();
          break;
      }
    });

    // Keyboard shortcuts (only actions not handled by InputManager)
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Keep control strip state synced with global events
    eventSystem.on('game:paused', () => this.updatePauseButton());
    eventSystem.on('game:resumed', () => this.updatePauseButton());
    this.applyMobilePrefs({ syncMenu: true });
  }

  loadMobilePrefs() {
    try {
      return {
        focusMode: localStorage.getItem('creature-mobile-focus') === 'true',
        batterySaver: localStorage.getItem('creature-mobile-battery') === 'true',
        haptics: localStorage.getItem('creature-mobile-haptics') !== 'false'
      };
    } catch {
      return { focusMode: false, batterySaver: false, haptics: true };
    }
  }

  saveMobilePref(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage may be unavailable in private browsing contexts.
    }
  }

  buzz(pattern = 12) {
    if (!this.mobilePrefs.haptics) return;
    const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches || ('ontouchstart' in window);
    if (!isTouchDevice) return;
    if (typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  }

  applyMobilePrefs({ syncMenu = false } = {}) {
    document.body.classList.toggle('mobile-focus-mode', this.mobilePrefs.focusMode);

    if (this.mobilePrefs.batterySaver) {
      this.renderer?.performance?.setQualityOverride?.('low');
      if (gameState.fastForward > 1) {
        gameState.fastForward = 1;
      }
    } else {
      this.renderer?.performance?.setQualityOverride?.(null);
    }

    if (syncMenu) {
      this.syncMobileMenuLabels();
    }
  }

  syncMobileMenuLabels() {
    const focusBtn = document.getElementById('menu-mobile-focus');
    const batteryBtn = document.getElementById('menu-mobile-battery');
    const hapticsBtn = document.getElementById('menu-mobile-haptics');
    if (focusBtn) {
      focusBtn.textContent = `${this.mobilePrefs.focusMode ? '✅' : '🧭'} Focus Mode`;
      focusBtn.setAttribute('aria-pressed', this.mobilePrefs.focusMode ? 'true' : 'false');
    }
    if (batteryBtn) {
      batteryBtn.textContent = `${this.mobilePrefs.batterySaver ? '✅' : '🔋'} Battery Saver`;
      batteryBtn.setAttribute('aria-pressed', this.mobilePrefs.batterySaver ? 'true' : 'false');
    }
    if (hapticsBtn) {
      hapticsBtn.textContent = `${this.mobilePrefs.haptics ? '✅' : '📳'} Haptics`;
      hapticsBtn.setAttribute('aria-pressed', this.mobilePrefs.haptics ? 'true' : 'false');
    }
  }

  blurFocusedDescendant(container) {
    const active = document.activeElement;
    if (container && active instanceof HTMLElement && container.contains(active)) {
      active.blur();
    }
  }

  // === PAUSE / PLAY ===
  togglePause() {
    if (this.uiController?.onPause) {
      this.uiController.onPause();
      this.updatePauseButton();
      return;
    }
    const paused = gameState.togglePause();
    eventSystem.emit(paused ? 'game:paused' : 'game:resumed', { reason: 'control-strip' });
    this.updatePauseButton();
    this.buzz(10);
  }

  updatePauseButton() {
    const isPaused = gameState.paused;
    const icon = isPaused ? '▶️' : '⏸️';

    if (this.ctrlPause) {
      this.ctrlPause.querySelector('.ctrl-icon').textContent = icon;
      this.ctrlPause.classList.toggle('active', isPaused);
      this.ctrlPause.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      this.ctrlPause.setAttribute('aria-label', isPaused ? 'Resume simulation' : 'Pause simulation');
    }
    if (this.watchPause) {
      this.watchPause.textContent = icon;
      this.watchPause.classList.toggle('active', isPaused);
      this.watchPause.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      this.watchPause.setAttribute('aria-label', isPaused ? 'Resume simulation' : 'Pause simulation');
    }
  }

  // === SPEED ===
  syncSpeedIndexFromState() {
    const idx = SPEED_OPTIONS.indexOf(gameState.fastForward);
    this.speedIndex = idx >= 0 ? idx : 1;
  }

  cycleSpeed() {
    this.syncSpeedIndexFromState();
    this.speedIndex = (this.speedIndex + 1) % SPEED_OPTIONS.length;
    if (this.mobilePrefs.batterySaver) {
      this.speedIndex = Math.min(this.speedIndex, 1);
    }
    gameState.fastForward = SPEED_OPTIONS[this.speedIndex];
    this.updateSpeedButton();
    this.buzz(8);
  }

  updateSpeedButton() {
    const label = SPEED_LABELS[this.speedIndex];
    if (this.ctrlSpeed) {
      this.ctrlSpeed.querySelector('.ctrl-icon').textContent = label;
    }
    if (this.watchSpeed) {
      this.watchSpeed.textContent = label;
    }
  }

  // === FOOD TOOL ===
  activateFoodTool() {
    if (this.uiController?.onFood) {
      this.uiController.onFood();
      if (this.ctrlFood) {
        this.ctrlFood.classList.add('pulse');
        setTimeout(() => this.ctrlFood?.classList.remove('pulse'), 250);
      }
      return;
    }

    if (this.tools) {
      this.tools.setMode('food');
      eventSystem.emit('tool:changed', { mode: 'food' });
    }
  }

  // === SPAWN DRAWER ===
  openSpawnDrawer() {
    if (!this.spawnDrawer) return;
    this.spawnDrawer.classList.remove('hidden');
    this.spawnDrawer.setAttribute('aria-hidden', 'false');
    this.spawnDrawerOpen = true;
    this.ctrlSpawn?.setAttribute('aria-expanded', 'true');
    this.updateSpawnSelection();
    this.buzz([10, 24, 10]);
  }

  closeSpawnDrawer() {
    if (!this.spawnDrawer) return;
    this.blurFocusedDescendant(this.spawnDrawer);
    this.spawnDrawer.classList.add('hidden');
    this.spawnDrawer.setAttribute('aria-hidden', 'true');
    this.spawnDrawerOpen = false;
    this.ctrlSpawn?.setAttribute('aria-expanded', 'false');
  }

  selectSpawnType(type) {
    this.currentSpawnType = type;
    this.updateSpawnSelection();
  }

  updateSpawnSelection() {
    this.spawnCards?.forEach(card => {
      const isSelected = card.dataset.creature === this.currentSpawnType;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    // Update spawn button icon
    const icons = { herbivore: '🦌', omnivore: '🦡', predator: '🦁', aquatic: '🐠' };
    if (this.ctrlSpawn) {
      this.ctrlSpawn.querySelector('.ctrl-icon').textContent = icons[this.currentSpawnType] || '🦌';
    }
  }

  confirmSpawn() {
    // Set the spawn tool with the selected type using proper gameState method
    if (this.tools) {
      this.tools.setMode('spawn');
      eventSystem.emit('tool:changed', { mode: 'spawn' });
    }
    // Use gameState.setSpawnMode which properly sets selectedCreatureType and spawnMode
    gameState.setSpawnMode(this.currentSpawnType);
    this.closeSpawnDrawer();
  }

  // === OVERFLOW DRAWER ===
  openOverflowDrawer() {
    if (!this.overflowDrawer) return;
    this.overflowDrawer.classList.remove('hidden');
    this.overflowDrawer.setAttribute('aria-hidden', 'false');
    this.overflowDrawerOpen = true;
    this.ctrlMore?.setAttribute('aria-expanded', 'true');
    this.syncMobileMenuLabels();
    this.buzz([8, 18, 8]);
  }

  closeOverflowDrawer() {
    if (!this.overflowDrawer) return;
    this.blurFocusedDescendant(this.overflowDrawer);
    this.overflowDrawer.classList.add('hidden');
    this.overflowDrawer.setAttribute('aria-hidden', 'true');
    this.overflowDrawerOpen = false;
    this.ctrlMore?.setAttribute('aria-expanded', 'false');
  }

  handleMenuAction(action) {
    this.closeOverflowDrawer();

    if (action === 'help') {
      const shortcutsOverlay = document.getElementById('shortcuts-overlay');
      shortcutsOverlay?.classList.remove('hidden');
      shortcutsOverlay?.setAttribute('aria-hidden', 'false');
      return;
    }

    if (action === 'save') {
      // Simulate save shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
      return;
    }

    if (action === 'load') {
      // Simulate load shortcut
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true }));
      return;
    }

    // Direct controller actions
    switch (action) {
      case 'step':
        this.uiController?.onStep();
        break;
      case 'props':
        this.uiController?.onPropTool();
        break;
      case 'mode':
        // Toggle session meta visibility which contains mode selection
        this.uiController?.onSessionMetaToggle();
        break;
      case 'campaign':
        // Campaign toggle is handled by ID in main currently, but we can try generic event or check controller
        // If ui-controller doesn't implement onCampaignToggle fully, we might need to rely on event system
        // But looking at UI controller, onCampaignToggle is empty/commented "handled in main".
        // Let's trigger the event system or keep the button click for JUST campaign if needed,
        // OR better, emit the event directly.
        // However, the legacy button click works because main.js binds it.
        // Let's perform a check for specific complex ones.
        const btnCampaign = document.getElementById('btn-campaign');
        if (btnCampaign) btnCampaign.click();
        break;
      case 'achievements':
        this.uiController?.onAchievementsToggle();
        break;
      case 'gene-editor':
        this.uiController?.onGeneEditorToggle();
        break;
      case 'scenario':
        this.uiController?.onScenarioToggle();
        break;
      case 'features':
        this.uiController?.onFeaturesToggle();
        break;
      case 'eco-health':
        this.uiController?.onEcoHealthToggle();
        break;
      case 'analytics':
        this.uiController?.onAnalyticsToggle();
        break;
      case 'mobile-focus':
        this.mobilePrefs.focusMode = !this.mobilePrefs.focusMode;
        this.saveMobilePref('creature-mobile-focus', this.mobilePrefs.focusMode);
        this.applyMobilePrefs({ syncMenu: true });
        this.buzz(this.mobilePrefs.focusMode ? [12, 20, 16] : 10);
        break;
      case 'mobile-battery':
        this.mobilePrefs.batterySaver = !this.mobilePrefs.batterySaver;
        this.saveMobilePref('creature-mobile-battery', this.mobilePrefs.batterySaver);
        this.applyMobilePrefs({ syncMenu: true });
        this.updateSpeedButton();
        this.buzz(this.mobilePrefs.batterySaver ? [16, 24, 24] : 10);
        break;
      case 'mobile-haptics':
        this.mobilePrefs.haptics = !this.mobilePrefs.haptics;
        this.saveMobilePref('creature-mobile-haptics', this.mobilePrefs.haptics);
        this.syncMobileMenuLabels();
        this.buzz(14);
        break;
    }
  }

  // === WATCH MODE ===
  toggleWatchMode() {
    if (this.uiController?.onWatchModeToggle) {
      this.uiController.onWatchModeToggle();
    } else {
      gameState.watchModeEnabled = !gameState.watchModeEnabled;
    }
    this.updateWatchMode();
  }

  exitWatchMode() {
    if (gameState.watchModeEnabled && this.uiController?.onWatchModeToggle) {
      this.uiController.onWatchModeToggle();
    } else {
      gameState.watchModeEnabled = false;
    }
    this.updateWatchMode();
  }

  updateWatchMode() {
    this.isWatchMode = !!gameState.watchModeEnabled;
    // Toggle control strip vs watch strip visibility
    if (this.isWatchMode) {
      this.blurFocusedDescendant(this.controlStrip);
      this.controlStrip?.classList.add('hidden');
      this.watchStrip?.classList.remove('hidden');
      this.watchStrip?.setAttribute('aria-hidden', 'false');
    } else {
      this.blurFocusedDescendant(this.watchStrip);
      this.controlStrip?.classList.remove('hidden');
      this.watchStrip?.classList.add('hidden');
      this.watchStrip?.setAttribute('aria-hidden', 'true');
    }

    this.ctrlWatch?.classList.toggle('active', this.isWatchMode);
    this.ctrlWatch?.setAttribute('aria-pressed', this.isWatchMode ? 'true' : 'false');
  }

  toggleFollow() {
    if (this.uiController?.onWatchFollow) {
      this.uiController.onWatchFollow();
    } else if (this.camera) {
      const hasFollow = this.camera.followMode !== 'free';
      this.camera.followMode = hasFollow ? 'free' : 'smooth-follow';
      if (hasFollow) {
        this.camera.followTarget = null;
      } else if (gameState.selectedId) {
        this.camera.followTarget = gameState.selectedId;
      }
    }
    this.watchFollow?.classList.toggle('active', this.camera?.followMode !== 'free');
  }

  openMoments() {
    const momentsPanel = document.getElementById('moments-panel');
    if (!momentsPanel) return;
    const visible = momentsPanel.classList.contains('hidden');
    momentsPanel.classList.toggle('hidden', !visible);
    momentsPanel.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  /**
     * Re-enable auto-director camera control.
     * Clears user permanent override so auto-director can move camera again.
     */
  recenterCamera() {
    // Clear camera user override
    if (this.camera?.clearUserOverride) {
      this.camera.clearUserOverride();
    }

    // Clear gameState override
    gameState.autoDirectorOverrideUntil = 0;

    // Visual feedback
    this.watchRecenter?.classList.add('active');
    setTimeout(() => {
      this.watchRecenter?.classList.remove('active');
    }, 300);

    console.debug('🎥 Camera control returned to auto-director');
  }

  // === GOD MODE ===
  toggleGodMode() {
    if (this.uiController?.setGodModeActive) {
      this.uiController.setGodModeActive(!gameState.godModeActive, { source: 'control-strip' });
    } else {
      gameState.godModeActive = !gameState.godModeActive;
    }
    this.isGodMode = !!gameState.godModeActive;

    this.ctrlGod?.classList.toggle('active', this.isGodMode);
    this.watchGodMode?.classList.toggle('active', this.isGodMode);
    this.ctrlGod?.setAttribute('aria-pressed', this.isGodMode ? 'true' : 'false');
    this.watchGodMode?.setAttribute('aria-pressed', this.isGodMode ? 'true' : 'false');
    this.buzz(this.isGodMode ? [12, 20, 12] : 10);
  }

  // === KEYBOARD SHORTCUTS ===
  handleKeyboard(e) {
    // Don't handle if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
      case 'w':
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        this.toggleWatchMode();
        break;
      case 'escape':
        this.closeSpawnDrawer();
        this.closeOverflowDrawer();
        if (gameState.godModeActive) this.toggleGodMode();
        break;
    }
  }

  // === UI UPDATE ===
  computeUIStateSignature() {
    const followMode = this.camera?.followMode || 'free';
    const selectedType = gameState.selectedCreatureType || this.currentSpawnType;
    return [
      gameState.paused ? 1 : 0,
      gameState.fastForward,
      gameState.watchModeEnabled ? 1 : 0,
      gameState.godModeActive ? 1 : 0,
      selectedType,
      followMode
    ].join('|');
  }

  updateUI({ force = false } = {}) {
    const stateSignature = this.computeUIStateSignature();
    if (!force && stateSignature === this.lastUIStateSignature) {
      return;
    }

    if (gameState.selectedCreatureType) {
      this.currentSpawnType = gameState.selectedCreatureType;
    }
    this.syncSpeedIndexFromState();
    this.isGodMode = !!gameState.godModeActive;
    this.updatePauseButton();
    this.updateSpeedButton();
    this.updateWatchMode();
    this.updateSpawnSelection();
    this.watchFollow?.classList.toggle('active', this.camera?.followMode !== 'free');
    this.ctrlGod?.classList.toggle('active', this.isGodMode);
    this.watchGodMode?.classList.toggle('active', this.isGodMode);
    this.ctrlGod?.setAttribute('aria-pressed', this.isGodMode ? 'true' : 'false');
    this.watchGodMode?.setAttribute('aria-pressed', this.isGodMode ? 'true' : 'false');
    this.lastUIStateSignature = this.computeUIStateSignature();
  }

  // Called by main loop to sync state
  update() {
    this.updateUI();
  }
}

export default ControlStripController;
