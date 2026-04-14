import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { eventSystem, GameEvents } from './event-system.js';

export function applyUiGodModeMethods(UIController) {
  UIController.prototype.bindGodModeControls = function() {
    const godExitBtn = domCache.get('godModeExit');
    const godTools = [
      domCache.get('godToolFood'),
      domCache.get('godToolCalm'),
      domCache.get('godToolChaos'),
      domCache.get('godToolSpawn'),
      domCache.get('godToolRemove'),
      domCache.get('godToolProp')
    ];

    if (godExitBtn) godExitBtn.addEventListener('click', this.boundHandlers.onGodModeExit);

    for (const btn of godTools) {
      if (!btn) continue;
      btn.addEventListener('click', this.boundHandlers.onGodToolSelect);
    }
  };

  UIController.prototype.onGodModeToggle = function() {
    this.setGodModeActive(!gameState.godModeActive, { source: 'menu' });
  };

  UIController.prototype.onGodModeExit = function() {
    this.setGodModeActive(false, { source: 'panel' });
  };

  UIController.prototype.onGodToolSelect = function(event) {
    const tool = event?.currentTarget?.dataset?.godTool;
    if (!tool) return;
    this.setGodTool(tool, { source: 'panel', announce: false });
  };

  UIController.prototype.setGodModeActive = function(active, { source = 'menu' } = {}) {
    gameState.godModeActive = !!active;
    if (gameState.godModeActive) {
      this.tools?.setMode?.('inspect');
      gameState.spawnMode = false;
      gameState.geneEditorSpawnMode = false;
      if (!gameState.godModeTool) {
        gameState.godModeTool = 'food';
      }
      this.updateGodModeUI();
      if (this.hasNotifications() && source !== 'gesture') {
        this.notifications.show('✨ God mode on', 'info', 1400);
      }
    } else if (this.hasNotifications() && source !== 'gesture') {
      this.notifications.show('God mode off', 'info', 1200);
    }
    this.updateGodModeUI();
    this.updateSandboxUiVisibility();
  };

  UIController.prototype.setGodTool = function(tool, { source = 'panel', announce = false } = {}) {
    if (!tool) return;
    const changed = gameState.godModeTool !== tool;
    gameState.godModeTool = tool;
    this.updateGodModeUI();
    if (!announce || !this.hasNotifications()) return;
    const labels = {
      food: 'Food',
      calm: 'Calm',
      chaos: 'Chaos',
      spawn: 'Spawn',
      prop: 'Prop',
      remove: 'Remove'
    };
    const via = source === 'hotkey' ? ' (hotkey)' : '';
    this.notifications.show(`✨ ${labels[tool] || tool}${via}`, 'info', changed ? 900 : 700);
  };

  UIController.prototype.updateGodModeUI = function() {
    const panel = domCache.get('godModePanel');
    const indicator = domCache.get('godModeIndicator');
    const toolButtons = [
      domCache.get('godToolFood'),
      domCache.get('godToolCalm'),
      domCache.get('godToolChaos'),
      domCache.get('godToolSpawn'),
      domCache.get('godToolRemove'),
      domCache.get('godToolProp')
    ];

    if (panel) {
      if (!gameState.godModeActive) {
        this.blurFocusedDescendant(panel);
      }
      panel.classList.toggle('hidden', !gameState.godModeActive);
      panel.setAttribute('aria-hidden', gameState.godModeActive ? 'false' : 'true');
    }
    if (indicator) {
      indicator.classList.toggle('hidden', !gameState.godModeActive);
    }

    for (const btn of toolButtons) {
      if (!btn) continue;
      const tool = btn.dataset.godTool;
      btn.classList.toggle('active', gameState.godModeTool === tool);
    }

    if (panel) {
      const hint = panel.querySelector('.god-mode-hint');
      if (hint) {
        const hints = {
          food: '1 Food: paint nourishment into the world.',
          calm: '2 Calm: paint soothing zones.',
          chaos: '3 Chaos: pulse the ecosystem.',
          spawn: '4 Spawn: place selected creature type.',
          prop: '5 Prop: place selected sandbox prop.',
          remove: '6 Remove: erase creature or nearby prop.'
        };
        hint.textContent = hints[gameState.godModeTool] || 'Tap world to use selected tool. Tap Done to return.';
      }
    }
  };

  UIController.prototype.performGodAction = function(action) {
    // Prefer selected creature; fall back to nearest to camera center
    let creature = gameState.selectedId ? this.world.getAnyCreatureById(gameState.selectedId) : null;
    if (!creature || !creature.alive) {
      const cx = this.camera.x;
      const cy = this.camera.y;
      creature = this.world?.creatureManager?.nearestCreature(cx, cy, 120) || null;
    }

    if (!creature || !creature.alive) {
      this.notifications?.show?.('Select a creature first', 'warning', 1200);
      return;
    }

    try {
      switch (action) {
        case 'heal':
          creature.health = creature.maxHealth;
          creature.logEvent('Healed by divine intervention', this.world.t);
          break;

        case 'boost':
          creature.energy = Math.min((creature.energy ?? 0) + 30, creature.maxEnergy ?? 100);
          creature.logEvent('Received energy boost', this.world.t);
          break;

        case 'kill':
          creature.alive = false;
          creature.health = 0;
          creature.deathCause = 'god';
          creature.killedBy = 'god';
          creature.logEvent('Struck down by god', this.world.t);
          gameState.selectedId = null;
          break;

        case 'clone':
          if (this.world.cloneCreature) {
            const clone = this.world.cloneCreature(creature);
            if (clone && this.notifications) {
              this.notifications.show(`Cloned #${creature.id}`, 'info', 1200);
            }
          } else if (this.notifications) {
            this.notifications.show('Clone action unavailable', 'warning', 1200);
          }
          break;
      }

      window.godModeActionCount = (window.godModeActionCount || 0) + 1;

      try {
        eventSystem.emit(GameEvents.GOD_MODE_ACTION, {
          action,
          creatureId: creature.id,
          worldTime: this.world.t
        });
      } catch (e) {
        console.warn('Failed to emit god mode action event:', e);
      }

    } catch (error) {
      console.error(`God action '${action}' failed:`, error);
    }
  };
}
