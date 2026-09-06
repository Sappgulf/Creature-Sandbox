import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';
import { GOD_TOOL_REGISTRY } from './game/god-tool-system.js';

export function applyUiGodModeMethods(UIController) {
  UIController.prototype.bindGodModeControls = function () {
    const godExitBtn = domCache.get('godModeExit');
    const godTools = [
      domCache.get('godToolFood'),
      domCache.get('godToolCalm'),
      domCache.get('godToolChaos'),
      domCache.get('godToolSpawn'),
      domCache.get('godToolRemove'),
      domCache.get('godToolProp'),
      domCache.get('godToolBless'),
      domCache.get('godToolCurse'),
      domCache.get('godToolAttract'),
      domCache.get('godToolRepel')
    ];

    if (godExitBtn) godExitBtn.addEventListener('click', this.boundHandlers.onGodModeExit);

    for (const btn of godTools) {
      if (!btn) continue;
      btn.addEventListener('click', this.boundHandlers.onGodToolSelect);
    }
  };

  UIController.prototype.onGodModeToggle = function () {
    this.setGodModeActive(!gameState.godModeActive, { source: 'menu' });
  };

  UIController.prototype.onGodModeExit = function () {
    this.setGodModeActive(false, { source: 'panel' });
  };

  UIController.prototype.onGodToolSelect = function (event) {
    const tool = event?.currentTarget?.dataset?.godTool;
    if (!tool) return;
    this.setGodTool(tool, { source: 'panel', announce: false });
  };

  UIController.prototype.setGodModeActive = function (active, { source = 'menu' } = {}) {
    gameState.godModeActive = !!active;
    document.body.classList.toggle('god-mode', gameState.godModeActive);
    if (gameState.godModeActive) {
      const moments = document.getElementById('moments-panel');
      if (moments && !moments.classList.contains('hidden')) {
        moments.classList.add('hidden');
        moments.setAttribute('aria-hidden', 'true');
      }
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
    this.upgradeController?.updateObjectiveRail?.();
  };

  UIController.prototype.setGodTool = function (tool, { source = 'panel', announce = false } = {}) {
    if (!tool) return;
    const changed = gameState.godModeTool !== tool;
    gameState.godModeTool = tool;
    this.updateGodModeUI();
    this.upgradeController?.updateObjectiveRail?.();
    if (!announce || !this.hasNotifications()) return;
    // Single source: labels live on GOD_TOOL_REGISTRY. Same rendered text as
    // the previous inline map; unknown ids still fall back to the raw id.
    const labels = Object.fromEntries(GOD_TOOL_REGISTRY.map(entry => [entry.id, entry.label]));
    const via = source === 'hotkey' ? ' (hotkey)' : '';
    this.notifications.show(`✨ ${labels[tool] || tool}${via}`, 'info', changed ? 900 : 700);
  };

  UIController.prototype.updateGodModeUI = function () {
    const panel = domCache.get('godModePanel');
    const indicator = domCache.get('godModeIndicator');
    const menuBtn = domCache.get('godModeMenuBtn');
    const toolButtons = [
      domCache.get('godToolFood'),
      domCache.get('godToolCalm'),
      domCache.get('godToolChaos'),
      domCache.get('godToolSpawn'),
      domCache.get('godToolRemove'),
      domCache.get('godToolProp'),
      domCache.get('godToolBless'),
      domCache.get('godToolCurse'),
      domCache.get('godToolAttract'),
      domCache.get('godToolRepel')
    ];

    if (panel) {
      if (!gameState.godModeActive) {
        this.blurFocusedDescendant(panel);
      }
      panel.classList.toggle('hidden', !gameState.godModeActive);
      panel.setAttribute('aria-hidden', gameState.godModeActive ? 'false' : 'true');
      panel.dataset.activeTool = gameState.godModeTool || '';
    }
    if (indicator) {
      indicator.classList.toggle('hidden', !gameState.godModeActive);
    }
    if (menuBtn) {
      menuBtn.classList.toggle('active', gameState.godModeActive);
      menuBtn.setAttribute('aria-pressed', gameState.godModeActive ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', gameState.godModeActive ? 'Disable god mode' : 'Enable god mode');
      menuBtn.title = gameState.godModeActive ? 'Disable god mode' : 'Enable god mode';
    }

    for (const btn of toolButtons) {
      if (!btn) continue;
      const tool = btn.dataset.godTool;
      btn.classList.toggle('active', gameState.godModeTool === tool);
      btn.setAttribute('aria-pressed', gameState.godModeTool === tool ? 'true' : 'false');
    }

    if (panel) {
      const hint = panel.querySelector('.god-mode-hint');
      if (hint) {
        // Single source: hint copy lives on GOD_TOOL_REGISTRY. Same rendered
        // text as the previous inline map.
        const hints = Object.fromEntries(GOD_TOOL_REGISTRY.map(entry => [entry.id, entry.hint]));
        hint.textContent = hints[gameState.godModeTool] || 'Tap world to use selected tool. Tap Done to return.';
      }
    }
  };
}
