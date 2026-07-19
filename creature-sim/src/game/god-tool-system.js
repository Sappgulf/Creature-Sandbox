import { gameState } from '../game-state.js';

export const GOD_TOOL_REGISTRY = Object.freeze([
  { id: 'inspect', icon: '🔎', label: 'Inspect', mode: 'inspect', undoable: false, mobile: true, desktop: true },
  { id: 'food', icon: '🍃', label: 'Food', mode: 'food', undoable: true, mobile: true, desktop: true },
  { id: 'spawn', icon: '🧬', label: 'Spawn', mode: 'spawn', undoable: true, mobile: true, desktop: true },
  {
    id: 'erase',
    icon: '🧹',
    label: 'Erase',
    mode: 'erase',
    undoable: true,
    mobile: true,
    desktop: true,
    aliases: ['remove']
  },
  { id: 'calm', icon: '🌊', label: 'Calm', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'chaos', icon: '⚡', label: 'Chaos', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'prop', icon: '🧩', label: 'Prop', mode: 'prop', undoable: true, mobile: true, desktop: true },
  { id: 'weather', icon: '🌦️', label: 'Weather', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'terrain', icon: '⛰️', label: 'Habitat', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'grab', icon: '✋', label: 'Grab', mode: 'god', undoable: true, mobile: true, desktop: true },
  { id: 'bless', icon: '✨', label: 'Bless', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'curse', icon: '💀', label: 'Curse', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'attract', icon: '🧲', label: 'Attract', mode: 'god', undoable: false, mobile: true, desktop: true },
  { id: 'repel', icon: '💨', label: 'Repel', mode: 'god', undoable: false, mobile: true, desktop: true }
]);

function normalizeTool(id) {
  const requested = String(id || 'inspect');
  const match = GOD_TOOL_REGISTRY.find(tool => tool.id === requested || tool.aliases?.includes(requested));
  return match || GOD_TOOL_REGISTRY[0];
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
    return GOD_TOOL_REGISTRY.filter(tool => unlocks.includes(tool.id) || tool.id === 'inspect');
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

    const godTool = tool.aliases?.[0] === 'remove' ? 'remove' : tool.id;
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
