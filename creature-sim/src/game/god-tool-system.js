import { gameState } from '../game-state.js';

// Single source of truth for the god-mode panel tools. Exactly the ten tools
// rendered as panel buttons (see #god-mode-panel in index.html, in order):
// six Tools followed by four Powers. Consumers (panel hints, stats labels,
// tutorial tooltips, digit hotkeys) must derive from here instead of keeping
// local copies.
export const GOD_TOOL_REGISTRY = Object.freeze([
  {
    id: 'food',
    icon: '🍃',
    label: 'Food',
    hint: '1 Food: green brush preview. Tap for a patch, drag for scattered bites.',
    tooltip: 'Place food sources',
    shortcut: null,
    digit: '1',
    mode: 'food',
    undoable: true,
    mobile: true,
    desktop: true
  },
  {
    id: 'calm',
    icon: '🌊',
    label: 'Calm',
    hint: '2 Calm: blue radius preview. Paint rest zones around stressed groups.',
    tooltip: 'Create calm zones',
    shortcut: null,
    digit: '2',
    mode: 'god',
    undoable: false,
    mobile: true,
    desktop: true
  },
  {
    id: 'chaos',
    icon: '⚡',
    label: 'Chaos',
    hint: '3 Chaos: purple pulse preview. Tap once, then watch recovery.',
    tooltip: 'Add chaos events',
    shortcut: null,
    digit: '3',
    mode: 'god',
    undoable: false,
    mobile: true,
    desktop: true
  },
  {
    id: 'spawn',
    icon: '🧬',
    label: 'Spawn',
    hint: '4 Spawn: small placement preview. Places the selected creature type.',
    tooltip: 'Spawn creatures',
    shortcut: null,
    digit: '4',
    mode: 'spawn',
    undoable: true,
    mobile: true,
    desktop: true
  },
  {
    id: 'prop',
    icon: '🧱',
    label: 'Prop',
    hint: '5 Prop: violet placement preview. Uses the selected sandbox prop.',
    tooltip: 'Place sandbox props',
    shortcut: null,
    digit: '5',
    mode: 'prop',
    undoable: true,
    mobile: true,
    desktop: true
  },
  {
    id: 'remove',
    icon: '🧹',
    label: 'Remove',
    hint: '6 Remove: red eraser preview. Removes the nearest creature or prop.',
    tooltip: 'Remove creatures',
    shortcut: null,
    digit: '6',
    mode: 'erase',
    undoable: true,
    mobile: true,
    desktop: true,
    aliases: ['erase']
  },
  {
    id: 'bless',
    icon: '✨',
    label: 'Bless',
    hint: '7 Bless: heals and energizes creatures near the tap.',
    tooltip: 'Heal and energize creatures',
    shortcut: '7',
    digit: '7',
    mode: 'god',
    undoable: false,
    mobile: true,
    desktop: true
  },
  {
    id: 'curse',
    icon: '💀',
    label: 'Curse',
    hint: '8 Curse: weakens and drains energy from creatures near the tap.',
    tooltip: 'Weaken and drain creatures',
    shortcut: '8',
    digit: '8',
    mode: 'god',
    undoable: false,
    mobile: true,
    desktop: true
  },
  {
    id: 'attract',
    icon: '🧲',
    label: 'Attract',
    hint: '9 Attract: pulls nearby creatures toward the tap.',
    tooltip: 'Pull creatures toward a point',
    shortcut: '9',
    digit: '9',
    mode: 'god',
    undoable: false,
    mobile: true,
    desktop: true
  },
  {
    id: 'repel',
    icon: '💨',
    label: 'Repel',
    hint: '0 Repel: pushes nearby creatures away from the tap.',
    tooltip: 'Push creatures away from a point',
    shortcut: '0',
    digit: '0',
    mode: 'god',
    undoable: false,
    mobile: true,
    desktop: true
  }
]);

// Inspect is the canvas "no god tool" state, not a panel tool: it has no
// panel button, no digit hotkey, and handleGodModeAction has no case for it
// (it would hit default). It stays out of the registry but must keep working
// as the normalize/setTool exit path and unknown-id fallback.
const INSPECT_TOOL = Object.freeze({
  id: 'inspect',
  icon: '🔎',
  label: 'Inspect',
  mode: 'inspect',
  undoable: false,
  mobile: true,
  desktop: true
});

function normalizeTool(id) {
  const requested = String(id || 'inspect');
  if (requested === 'inspect') return INSPECT_TOOL;
  const match = GOD_TOOL_REGISTRY.find(tool => tool.id === requested || tool.aliases?.includes(requested));
  return match || INSPECT_TOOL;
}

export class GodToolSystem {
  constructor({ tools = null, uiController = null } = {}) {
    this.tools = tools;
    this.uiController = uiController;
    this.lastAction = null;
  }

  list({ progression = null } = {}) {
    const unlocks = progression?.getSnapshot?.()?.unlocks?.tools || null;
    if (!unlocks) return GOD_TOOL_REGISTRY.slice();
    // Alias-aware so legacy 'erase' unlocks still match the 'remove' entry.
    // Stale unlocks ('inspect', 'grab', 'weather') match nothing by design.
    return GOD_TOOL_REGISTRY.filter(
      tool => unlocks.includes(tool.id) || tool.aliases?.some(alias => unlocks.includes(alias))
    );
  }

  setTool(id, { announce = false, source = 'god-tool-system' } = {}) {
    const tool = normalizeTool(id);
    if (tool.mode === 'inspect') {
      this.uiController?.setGodModeActive?.(false, { source });
      this.tools?.setMode?.('inspect');
      return tool;
    }

    if (tool.mode === 'food' || tool.mode === 'spawn' || tool.mode === 'erase' || tool.mode === 'prop') {
      this.tools?.setMode?.(tool.mode);
    }

    // Registry ids already equal the gameState tool ids ('remove' included,
    // with 'erase' kept as a legacy alias), so no remapping is needed.
    const godTool = tool.id;
    this.uiController?.setGodModeActive?.(true, { source });
    this.uiController?.setGodTool?.(godTool, { source, announce });
    gameState.godModeTool = godTool;
    return tool;
  }

  recordAction(action = {}) {
    this.lastAction = {
      action: action.action || action.type || 'unknown',
      at: Date.now()
    };
  }

  getSnapshot({ progression = null } = {}) {
    return {
      active: !!gameState.godModeActive,
      tool: gameState.godModeActive ? gameState.godModeTool : this.tools?.mode || 'inspect',
      tools: this.list({ progression }).map(tool => ({
        id: tool.id,
        icon: tool.icon,
        label: tool.label,
        undoable: tool.undoable,
        mobile: tool.mobile,
        desktop: tool.desktop
      })),
      canUndo: !!this.tools?.canUndo?.(),
      canRedo: !!this.tools?.canRedo?.(),
      lastAction: this.lastAction
    };
  }

  serialize() {
    return {
      tool: gameState.godModeTool,
      active: !!gameState.godModeActive,
      canvasTool: this.tools?.mode || 'inspect'
    };
  }

  restore(data = {}) {
    if (!data || typeof data !== 'object') return false;
    if (data.canvasTool) this.tools?.setMode?.(data.canvasTool);
    if (data.tool) gameState.godModeTool = data.tool;
    gameState.godModeActive = !!data.active;
    return true;
  }
}
