/**
 * Control Strip Controller - Unified bottom control bar for mobile-first UI
 * Replaces the legacy top HUD with a thumb-friendly bottom control strip
 */
import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';

// Speed multipliers for cycling
const SPEED_OPTIONS = [0.5, 1, 2, 4];
const SPEED_LABELS = ['0.5×', '1×', '2×', '4×'];

export class ControlStripController {
    constructor(options = {}) {
        this.world = options.world;
        this.camera = options.camera;
        this.tools = options.tools;
        this.uiController = options.uiController;

        // State
        this.currentSpawnType = 'herbivore';
        this.speedIndex = 1; // Default to 1×
        this.isWatchMode = false;
        this.isGodMode = false;

        // Drawer states
        this.spawnDrawerOpen = false;
        this.overflowDrawerOpen = false;

        // Initialize
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
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

        this.menuItems?.forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action) this.handleMenuAction(action);
            });
        });

        // Watch strip buttons
        this.watchPause?.addEventListener('click', () => this.togglePause());
        this.watchSpeed?.addEventListener('click', () => this.cycleSpeed());
        this.watchFollow?.addEventListener('click', () => this.toggleFollow());
        this.watchRecenter?.addEventListener('click', () => this.recenterCamera());
        this.watchMoments?.addEventListener('click', () => this.openMoments());
        this.watchGodMode?.addEventListener('click', () => this.toggleGodMode());
        this.watchExit?.addEventListener('click', () => this.exitWatchMode());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    // === PAUSE / PLAY ===
    togglePause() {
        if (!this.world) return;
        gameState.paused = !gameState.paused;
        this.updatePauseButton();
    }

    updatePauseButton() {
        const isPaused = gameState.paused;
        const icon = isPaused ? '▶️' : '⏸️';

        if (this.ctrlPause) {
            this.ctrlPause.querySelector('.ctrl-icon').textContent = icon;
            this.ctrlPause.classList.toggle('active', isPaused);
        }
        if (this.watchPause) {
            this.watchPause.textContent = icon;
            this.watchPause.classList.toggle('active', isPaused);
        }
    }

    // === SPEED ===
    cycleSpeed() {
        this.speedIndex = (this.speedIndex + 1) % SPEED_OPTIONS.length;
        gameState.fastForward = SPEED_OPTIONS[this.speedIndex];
        this.updateSpeedButton();
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
        if (this.tools) {
            this.tools.setTool('food');
            this.ctrlFood?.classList.add('active');
        }
    }

    // === SPAWN DRAWER ===
    openSpawnDrawer() {
        if (!this.spawnDrawer) return;
        this.spawnDrawer.classList.remove('hidden');
        this.spawnDrawer.setAttribute('aria-hidden', 'false');
        this.spawnDrawerOpen = true;
        this.updateSpawnSelection();
    }

    closeSpawnDrawer() {
        if (!this.spawnDrawer) return;
        this.spawnDrawer.classList.add('hidden');
        this.spawnDrawer.setAttribute('aria-hidden', 'true');
        this.spawnDrawerOpen = false;
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
        const icons = { herbivore: '🦌', omnivore: '🦡', predator: '🦁' };
        if (this.ctrlSpawn) {
            this.ctrlSpawn.querySelector('.ctrl-icon').textContent = icons[this.currentSpawnType] || '🦌';
        }
    }

    confirmSpawn() {
        // Set the spawn tool with the selected type using proper gameState method
        if (this.tools) {
            this.tools.setTool('spawn');
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
    }

    closeOverflowDrawer() {
        if (!this.overflowDrawer) return;
        this.overflowDrawer.classList.add('hidden');
        this.overflowDrawer.setAttribute('aria-hidden', 'true');
        this.overflowDrawerOpen = false;
        this.ctrlMore?.setAttribute('aria-expanded', 'false');
    }

    handleMenuAction(action) {
        this.closeOverflowDrawer();

        // Trigger the corresponding legacy button if it exists
        const legacyButtons = {
            'step': 'btn-step',
            'props': 'btn-prop-tool',
            'mode': 'btn-mode',
            'campaign': 'btn-campaign',
            'achievements': 'btn-achievements',
            'gene-editor': 'btn-gene-editor',
            'scenario': 'btn-scenario',
            'features': 'btn-features',
            'eco-health': 'btn-eco-health',
            'analytics': 'analytics-dashboard-toggle',
            'help': null, // Will open shortcuts overlay
            'save': null,
            'load': null
        };

        const buttonId = legacyButtons[action];
        if (buttonId) {
            const btn = document.getElementById(buttonId);
            btn?.click();
        } else if (action === 'help') {
            const shortcutsOverlay = document.getElementById('shortcuts-overlay');
            shortcutsOverlay?.classList.remove('hidden');
        } else if (action === 'save') {
            // Trigger save via keyboard shortcut simulation
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
        } else if (action === 'load') {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true }));
        }
    }

    // === WATCH MODE ===
    toggleWatchMode() {
        this.isWatchMode = !this.isWatchMode;
        this.updateWatchMode();
    }

    exitWatchMode() {
        this.isWatchMode = false;
        this.updateWatchMode();
    }

    updateWatchMode() {
        // Toggle control strip vs watch strip visibility
        if (this.isWatchMode) {
            this.controlStrip?.classList.add('hidden');
            this.watchStrip?.classList.remove('hidden');
            this.watchStrip?.setAttribute('aria-hidden', 'false');

            // Enable watch mode in game state - this allows auto-director to work
            gameState.watchModeEnabled = true;
            gameState.autoDirectorEnabled = true;
            gameState.watchMode = true;

            // Clear camera user override so auto-director can take over
            if (this.camera?.clearUserOverride) {
                this.camera.clearUserOverride();
            }
        } else {
            this.controlStrip?.classList.remove('hidden');
            this.watchStrip?.classList.add('hidden');
            this.watchStrip?.setAttribute('aria-hidden', 'true');

            // Disable watch mode and auto-director
            gameState.watchModeEnabled = false;
            gameState.autoDirectorEnabled = false;
            gameState.watchMode = false;
        }

        this.ctrlWatch?.classList.toggle('active', this.isWatchMode);
    }

    toggleFollow() {
        if (this.camera && typeof this.camera.toggleFollow === 'function') {
            this.camera.toggleFollow();
        }
        this.watchFollow?.classList.toggle('active');
    }

    openMoments() {
        const momentsPanel = document.getElementById('moments-panel');
        momentsPanel?.classList.toggle('hidden');
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

        console.log('🎥 Camera control returned to auto-director');
    }

    // === GOD MODE ===
    toggleGodMode() {
        this.isGodMode = !this.isGodMode;

        const godModePanel = document.getElementById('god-mode-panel');
        const godModeIndicator = document.getElementById('god-mode-indicator');

        if (this.isGodMode) {
            godModePanel?.classList.remove('hidden');
            godModeIndicator?.classList.remove('hidden');
            gameState.godMode = true;
        } else {
            godModePanel?.classList.add('hidden');
            godModeIndicator?.classList.add('hidden');
            gameState.godMode = false;
        }

        this.ctrlGod?.classList.toggle('active', this.isGodMode);
        this.watchGodMode?.classList.toggle('active', this.isGodMode);
    }

    // === KEYBOARD SHORTCUTS ===
    handleKeyboard(e) {
        // Don't handle if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                this.togglePause();
                break;
            case 'f':
                if (!e.ctrlKey && !e.metaKey) {
                    this.activateFoodTool();
                }
                break;
            case 'w':
                this.toggleWatchMode();
                break;
            case 'escape':
                this.closeSpawnDrawer();
                this.closeOverflowDrawer();
                if (this.isGodMode) this.toggleGodMode();
                break;
        }
    }

    // === UI UPDATE ===
    updateUI() {
        this.updatePauseButton();
        this.updateSpeedButton();
        this.updateSpawnSelection();
    }

    // Called by main loop to sync state
    update() {
        // Sync pause state if changed externally
        if (this.ctrlPause) {
            const isPaused = gameState.paused;
            const currentIcon = this.ctrlPause.querySelector('.ctrl-icon')?.textContent;
            const expectedIcon = isPaused ? '▶️' : '⏸️';
            if (currentIcon !== expectedIcon) {
                this.updatePauseButton();
            }
        }
    }
}

export default ControlStripController;
