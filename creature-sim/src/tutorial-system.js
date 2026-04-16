// Tutorial System - Guided onboarding experience
// Progressive unlocks, tooltips, and interactive guidance

import { eventSystem, GameEvents } from './event-system.js';

const DEFAULT_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Creature Sandbox',
    text: 'Follow five quick moves to get oriented, then explore the world at your own pace.',
    highlight: null,
    autoAdvance: true,
    autoAdvanceDelay: 2400
  },
  {
    id: 'spawn',
    title: 'Spawn Your First Creature',
    text: 'Tap the spawn button or press S to add creatures to the world. Every ecosystem starts with just one!',
    highlight: ['#ctrl-spawn'],
    waitFor: { type: 'spawn', count: 1 },
    autoAdvance: true,
    autoAdvanceDelay: 12000
  },
  {
    id: 'camera',
    title: 'Move the Camera',
    text: 'Scroll to zoom. Middle-click or Alt-drag to pan across the world.',
    highlight: ['#view'],
    waitFor: { type: 'zoom', count: 1 },
    autoAdvance: true,
    autoAdvanceDelay: 9000
  },
  {
    id: 'inspect',
    title: 'Inspect a Creature',
    text: 'Click or tap any creature to follow it, inspect its stats, and see what it is doing.',
    highlight: ['#view'],
    waitFor: { type: 'select', count: 1 },
    autoAdvance: true,
    autoAdvanceDelay: 10000
  },
  {
    id: 'pause',
    title: 'Pause and Compare',
    text: 'Press Space or tap Pause to freeze time, then compare how the ecosystem changes.',
    highlight: ['#ctrl-pause', '#watch-pause'],
    waitFor: { type: 'keypress', key: 'Space', count: 1 },
    autoAdvance: true,
    autoAdvanceDelay: 9000
  },
  {
    id: 'god-mode',
    title: 'Try God Mode',
    text: 'Open God Mode to place food, calm the world, or nudge chaos. More holds Analytics, Moments, and Help.',
    highlight: ['#ctrl-god', '#watch-god-mode'],
    waitFor: { type: 'god_mode_action', count: 1 },
    autoAdvance: true,
    autoAdvanceDelay: 11000
  }
];

const TOOLTIP_CONFIG = {
  '#ctrl-pause': { text: 'Pause or resume simulation', shortcut: 'Space' },
  '#ctrl-speed': { text: 'Adjust simulation speed', shortcut: '1-4' },
  '#ctrl-food': { text: 'Paint food on the world', shortcut: 'F' },
  '#ctrl-spawn': { text: 'Spawn creatures', shortcut: 'S' },
  '#ctrl-watch': { text: 'Follow creatures automatically', shortcut: 'W' },
  '#ctrl-god': { text: 'God mode tools', shortcut: 'G' },
  '#ctrl-more': { text: 'More options menu', shortcut: 'M' },
  '#watch-pause': { text: 'Pause or resume', shortcut: 'Space' },
  '#watch-speed': { text: 'Adjust watch speed', shortcut: '1-4' },
  '#watch-follow': { text: 'Toggle creature follow', shortcut: 'F' },
  '#watch-moments': { text: 'View notable events', shortcut: 'M' },
  '#watch-god-mode': { text: 'Toggle god mode', shortcut: 'G' },
  '#god-tool-food': { text: 'Place food sources', shortcut: null },
  '#god-tool-calm': { text: 'Create calm zones', shortcut: null },
  '#god-tool-chaos': { text: 'Add chaos events', shortcut: null },
  '#god-tool-spawn': { text: 'Spawn creatures', shortcut: null },
  '#god-tool-prop': { text: 'Place sandbox props', shortcut: null },
  '#god-tool-remove': { text: 'Remove creatures', shortcut: null }
};

export class TutorialSystem {
  constructor(options = {}) {
    this.completed = new Set();
    this.currentStep = null;
    this.steps = Array.isArray(options.steps) && options.steps.length ? options.steps : DEFAULT_STEPS;

    this.stepIndex = 0;
    this.active = false;
    this.skipRequested = false;
    this._listenersBound = false;
    this._pendingAdvanceTimeout = null;

    this.tooltipsDismissed = new Set();
    this._tooltipOverlay = null;
    this._tooltipElements = new Map();
    this._hoverListeners = [];

    // Event listeners tracking
    this.listeners = {
      zoom: 0,
      select: 0,
      keypress: {},
      god_mode_action: 0,
      spawn: 0
    };
  }

  get isActive() {
    return this.active;
  }

  // Start tutorial (first time players)
  start() {
    this.loadProgress();
    this.loadTooltipDismissals();
    if (this.completed.has('all') || this.active) {
      this.initTooltips();
      return; // Already completed
    }

    this.active = true;
    this.skipRequested = false;
    this._resetProgressCounters();
    this.stepIndex = this.getNextIncompleteStepIndex(0);
    if (this.stepIndex >= this.steps.length) {
      this.complete();
      return;
    }
    this.showStep(this.steps[this.stepIndex]);

    // Setup global listeners for tutorial tracking
    this.setupListeners();
  }

  // Skip tutorial
  skip() {
    this.skipRequested = true;
    this.clearPendingAdvance();
    this.hideCurrentStep();
    this.active = false;
    this.completed.add('all');
    this.saveProgress();
    this._notifyCompletion('skipped');
  }

  // Show a tutorial step
  showStep(step) {
    if (!step) {
      this.complete();
      return;
    }

    this.clearPendingAdvance();
    this.currentStep = step;
    this.ensureOverlay();

    const overlay = this._overlay;
    const title = overlay?.querySelector('#tutorial-title');
    const text = overlay?.querySelector('#tutorial-text');
    const progress = overlay?.querySelector('#tutorial-progress');
    const nextBtn = overlay?.querySelector('#tutorial-next');

    if (overlay) {
      overlay.dataset.step = step.id || '';
      overlay.style.display = 'block';
    }
    if (title) title.textContent = step.title || 'Tutorial';
    if (text) text.textContent = step.text || '';
    if (progress) {
      progress.textContent = `Step ${Math.min(this.stepIndex + 1, this.steps.length)} of ${this.steps.length}`;
    }
    if (nextBtn) {
      nextBtn.textContent = this.stepIndex >= this.steps.length - 1 ? 'Finish' : 'Next';
    }

    // Highlight element if specified
    if (step.highlight) {
      this.highlightElement(step.highlight);
    } else {
      this.hideHighlight();
    }

    // Auto-advance if configured
    if (step.autoAdvance) {
      this._pendingAdvanceTimeout = window.setTimeout(() => {
        if (this.currentStep?.id === step.id) {
          this.nextStep();
        }
      }, step.autoAdvanceDelay || 3000);
    }
  }

  // Update is called from the main loop so keep it lightweight
  update(_dt, _world) {
    if (!this.active || !this.currentStep) return;

    // Keep overlay visible while active
    const overlay = this._overlay || document.getElementById('tutorial-overlay');
    if (overlay && overlay.style.display === 'none') {
      overlay.style.display = 'block';
    }

    // Reposition highlight each frame (elements might move)
    if (this.currentStep.highlight) {
      this.highlightElement(this.currentStep.highlight);
    }
  }

  // Highlight an element on screen
  highlightElement(target) {
    const highlight = document.getElementById('tutorial-highlight');
    if (!highlight) return;

    const element = this.resolveHighlightTarget(target);

    if (element) {
      const rect = element.getBoundingClientRect();
      highlight.style.display = 'block';
      highlight.style.left = `${rect.left - 5}px`;
      highlight.style.top = `${rect.top - 5}px`;
      highlight.style.width = `${rect.width + 10}px`;
      highlight.style.height = `${rect.height + 10}px`;
    } else {
      highlight.style.display = 'none';
    }
  }

  hideHighlight() {
    const highlight = document.getElementById('tutorial-highlight');
    if (highlight) {
      highlight.style.display = 'none';
    }
  }

  // Hide current step
  hideCurrentStep() {
    const overlay = this._overlay || document.getElementById('tutorial-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    this.hideHighlight();
  }

  // Move to next step
  nextStep() {
    if (this.currentStep?.id) {
      this.completed.add(this.currentStep.id);
      this.saveProgress();
    }

    const nextIndex = this.getNextIncompleteStepIndex(this.stepIndex + 1);
    if (nextIndex < this.steps.length) {
      this.stepIndex = nextIndex;
      this.showStep(this.steps[this.stepIndex]);
    } else {
      // Tutorial complete!
      this.complete();
    }
  }

  // Complete tutorial
  complete() {
    this.clearPendingAdvance();
    this.hideCurrentStep();
    this.active = false;
    this.completed.add('all');
    this.saveProgress();
    this._notifyCompletion('complete');
    this.initTooltips();

    // Trigger achievement
    if (window.achievements) {
      window.achievements.unlock('tutorial_complete');
    }
  }

  // Setup global listeners for tracking tutorial progress
  setupListeners() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    // Track zoom
    window.addEventListener('wheel', (e) => {
      if (!this.active || this.currentStep?.waitFor?.type !== 'zoom') return;
      const waitFor = this.currentStep.waitFor || {};
      const count = Math.max(1, Number(waitFor.count) || 1);
      const delta = Math.abs(e?.deltaY ?? 0);
      if (delta < 0.5) return;
      this.listeners.zoom += 1;
      if (this.listeners.zoom >= count) {
        this._advanceSoon();
      }
    }, { passive: true });

    // Track keypresses
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (this.currentStep?.waitFor?.type !== 'keypress') return;

      const key = e.code === 'Space' ? 'Space' : e.key.toLowerCase();
      if (this.currentStep?.waitFor?.key === key) {
        e.preventDefault();
        this._advanceSoon();
      }
    });

    eventSystem.on(GameEvents.GOD_MODE_ACTION, () => {
      this.trackGodModeAction();
    });

    eventSystem.on(GameEvents.CREATURE_SPAWN, () => {
      this.trackSpawn();
    });
  }

  // Track creature selection (called from main.js)
  trackSelection() {
    this._progressWaitFor('select');
  }

  // Track god mode action (called from main.js)
  trackGodModeAction() {
    this._progressWaitFor('god_mode_action');
  }

  // Track creature spawn (called from event listener)
  trackSpawn() {
    this._progressWaitFor('spawn');
  }

  // Save progress to localStorage
  saveProgress() {
    try {
      localStorage.setItem('tutorial_completed', JSON.stringify(Array.from(this.completed)));
    } catch (e) {
      console.warn('Failed to save tutorial progress:', e);
    }
  }

  // Load progress from localStorage
  loadProgress() {
    try {
      const saved = localStorage.getItem('tutorial_completed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.completed = new Set(parsed);
        } else if (parsed && typeof parsed === 'object') {
          const completed = Array.isArray(parsed.completed) ? parsed.completed : [];
          this.completed = new Set(completed);
        }
      }
    } catch (e) {
      console.warn('Failed to load tutorial progress:', e);
    }
  }

  // Check if should show tutorial
  shouldShow() {
    return !this.completed.has('all');
  }

  // Initialize hover tooltips for UI elements
  initTooltips() {
    if (this._tooltipsInitialized) return;
    this._tooltipsInitialized = true;
    this._tooltipOverlay = this._createTooltipOverlay();
    document.body.appendChild(this._tooltipOverlay);
    this._bindTooltipListeners();
  }

  _createTooltipOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'tooltip-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
    `;
    return overlay;
  }

  _bindTooltipListeners() {
    for (const [selector, config] of Object.entries(TOOLTIP_CONFIG)) {
      const element = document.querySelector(selector);
      if (!element) continue;
      if (this.tooltipsDismissed.has(selector)) continue;

      const tooltipId = `tooltip-${selector.slice(1)}`;
      const tooltip = document.createElement('div');
      tooltip.id = tooltipId;
      tooltip.className = 'hover-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.innerHTML = `
        <span class="tooltip-text">${config.text}</span>
        ${config.shortcut ? `<kbd class="tooltip-shortcut">${config.shortcut}</kbd>` : ''}
        <button class="tooltip-dismiss" aria-label="Dismiss tooltip">×</button>
      `;
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(15, 23, 42, 0.96);
        color: var(--text-primary, #f8fafc);
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: none;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        max-width: 200px;
        white-space: normal;
      `;

      const textStyle = tooltip.querySelector('.tooltip-text')?.style;
      if (textStyle) textStyle.marginRight = '8px';

      const dismissBtn = tooltip.querySelector('.tooltip-dismiss');
      if (dismissBtn) {
        dismissBtn.style.cssText = `
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          padding: 0;
          font-size: 14px;
          line-height: 1;
          margin-left: 4px;
        `;
        dismissBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.dismissTooltip(selector);
        });
      }

      const shortcutStyle = tooltip.querySelector('.tooltip-shortcut')?.style;
      if (shortcutStyle) {
        shortcutStyle.cssText = `
          display: inline-block;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          font-family: inherit;
          margin-left: 8px;
        `;
      }

      this._tooltipOverlay.appendChild(tooltip);
      this._tooltipElements.set(selector, tooltip);

      const showTooltip = () => {
        if (this.tooltipsDismissed.has(selector)) return;
        const rect = element.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
        requestAnimationFrame(() => {
          tooltip.style.opacity = '1';
          tooltip.style.transform = 'translateY(0)';
        });
      };

      const hideTooltip = () => {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(4px)';
        setTimeout(() => {
          if (tooltip.style.opacity === '0') {
            tooltip.style.display = 'none';
          }
        }, 150);
      };

      element.addEventListener('mouseenter', showTooltip);
      element.addEventListener('mouseleave', hideTooltip);
      element.addEventListener('focus', showTooltip);
      element.addEventListener('blur', hideTooltip);

      this._hoverListeners.push({ element, showTooltip, hideTooltip });
    }
  }

  dismissTooltip(selector) {
    this.tooltipsDismissed.add(selector);
    const tooltip = this._tooltipElements.get(selector);
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(4px)';
      setTimeout(() => {
        tooltip.style.display = 'none';
      }, 150);
    }
    this.saveTooltipDismissals();
  }

  saveTooltipDismissals() {
    try {
      localStorage.setItem('tooltips_dismissed', JSON.stringify(Array.from(this.tooltipsDismissed)));
    } catch (e) {
      console.warn('Failed to save tooltip dismissals:', e);
    }
  }

  loadTooltipDismissals() {
    try {
      const saved = localStorage.getItem('tooltips_dismissed');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.tooltipsDismissed = new Set(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load tooltip dismissals:', e);
    }
  }

  ensureOverlay() {
    if (this._overlay) return this._overlay;

    const overlay = document.getElementById('tutorial-overlay') || document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.innerHTML = `
      <div id="tutorial-content" role="dialog" aria-modal="true" aria-label="Tutorial">
        <div id="tutorial-progress"></div>
        <div id="tutorial-title"></div>
        <div id="tutorial-text"></div>
        <div id="tutorial-actions">
          <button id="tutorial-next" type="button">Next</button>
          <button id="tutorial-skip" type="button">Skip Tutorial</button>
        </div>
      </div>
      <div id="tutorial-highlight"></div>
    `;

    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      pointer-events: none;
      display: none;
    `;

    const content = overlay.querySelector('#tutorial-content');
    content.style.cssText = `
      position: absolute;
      top: clamp(16px, 16vh, 180px);
      left: 50%;
      transform: translateX(-50%);
      width: min(520px, calc(100vw - 24px));
      max-width: 520px;
      padding: 20px 22px 18px;
      border-radius: 18px;
      background: rgba(10, 14, 22, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #f8fafc;
      pointer-events: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(16px);
    `;

    const progress = overlay.querySelector('#tutorial-progress');
    progress.style.cssText = `
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      margin-bottom: 10px;
      border-radius: 999px;
      background: rgba(74, 222, 128, 0.16);
      color: #bbf7d0;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    `;

    const title = overlay.querySelector('#tutorial-title');
    title.style.cssText = `
      font-size: 24px;
      line-height: 1.1;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.02em;
    `;

    const text = overlay.querySelector('#tutorial-text');
    text.style.cssText = `
      font-size: 14px;
      line-height: 1.55;
      color: rgba(226, 232, 240, 0.9);
    `;

    const actions = overlay.querySelector('#tutorial-actions');
    actions.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: 16px;
    `;

    const buttons = overlay.querySelectorAll('#tutorial-actions button');
    buttons.forEach((btn, index) => {
      btn.style.cssText = `
        margin: 0;
        padding: 9px 14px;
        border-radius: 10px;
        border: 1px solid ${index === 0 ? 'rgba(74, 222, 128, 0.35)' : 'rgba(255,255,255,0.12)'};
        background: ${index === 0 ? 'linear-gradient(135deg, #4ade80, #22c55e)' : 'rgba(255,255,255,0.05)'};
        color: #f8fafc;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
      `;
    });

    const highlight = overlay.querySelector('#tutorial-highlight');
    highlight.style.cssText = `
      position: absolute;
      border: 2px solid rgba(74, 222, 128, 0.95);
      border-radius: 14px;
      pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.16), 0 0 28px rgba(74, 222, 128, 0.45);
      transition: opacity 0.25s ease, transform 0.25s ease;
      display: none;
    `;

    content.querySelector('#tutorial-next').addEventListener('click', () => this.nextStep());
    content.querySelector('#tutorial-skip').addEventListener('click', () => this.skip());

    document.body.appendChild(overlay);
    this._overlay = overlay;
    return overlay;
  }

  resolveHighlightTarget(target) {
    const selectors = [];
    if (Array.isArray(target)) {
      selectors.push(...target);
    } else if (target && typeof target === 'object') {
      if (Array.isArray(target.selectors)) selectors.push(...target.selectors);
      if (typeof target.selector === 'string') selectors.push(target.selector);
    } else if (typeof target === 'string') {
      const presets = {
        canvas: ['#view', 'canvas'],
        'btn-pause': ['#ctrl-pause', '#watch-pause'],
        'god-mode-buttons': ['#ctrl-god', '#watch-god-mode', '#god-mode-panel'],
        'analytics-toggle': ['#analytics-dashboard-toggle', '#menu-analytics'],
        'moments-toggle': ['#watch-moments']
      };
      selectors.push(...(presets[target] || [target]));
    }

    for (const selector of selectors) {
      if (!selector) continue;
      const element = document.querySelector(selector);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return element;
    }

    return null;
  }

  clearPendingAdvance() {
    if (this._pendingAdvanceTimeout) {
      clearTimeout(this._pendingAdvanceTimeout);
      this._pendingAdvanceTimeout = null;
    }
  }

  getNextIncompleteStepIndex(startIndex = 0) {
    for (let i = startIndex; i < this.steps.length; i++) {
      if (!this.completed.has(this.steps[i]?.id)) {
        return i;
      }
    }
    return this.steps.length;
  }

  _resetProgressCounters() {
    this.listeners.zoom = 0;
    this.listeners.select = 0;
    this.listeners.keypress = {};
    this.listeners.god_mode_action = 0;
    this.listeners.spawn = 0;
  }

  _advanceSoon(delay = 650) {
    this.clearPendingAdvance();
    this._pendingAdvanceTimeout = window.setTimeout(() => {
      if (!this.active || !this.currentStep) return;
      this.nextStep();
    }, delay);
  }

  _progressWaitFor(type, { key } = {}) {
    if (!this.active || !this.currentStep?.waitFor || this.currentStep.waitFor.type !== type) {
      return false;
    }

    const waitFor = this.currentStep.waitFor;
    const count = Math.max(1, Number(waitFor.count) || 1);

    switch (type) {
      case 'select':
        this.listeners.select += 1;
        if (this.listeners.select >= count) this._advanceSoon();
        return true;
      case 'god_mode_action':
        this.listeners.god_mode_action += 1;
        if (this.listeners.god_mode_action >= count) this._advanceSoon();
        return true;
      case 'spawn':
        this.listeners.spawn += 1;
        if (this.listeners.spawn >= count) this._advanceSoon();
        return true;
      case 'keypress':
        if (waitFor.key && waitFor.key !== key) return false;
        this.listeners.keypress[key] = (this.listeners.keypress[key] || 0) + 1;
        if (this.listeners.keypress[key] >= count) this._advanceSoon(450);
        return true;
      case 'zoom':
        this.listeners.zoom += 1;
        if (this.listeners.zoom >= count) this._advanceSoon();
        return true;
      default:
        return false;
    }
  }

  _notifyCompletion(state = 'complete') {
    if (state === 'complete') {
      try {
        eventSystem.emit(GameEvents.NOTIFICATION, {
          message: 'Tutorial complete',
          type: 'success',
          duration: 2200
        });
      } catch (error) {
        console.warn('Failed to emit tutorial completion notification:', error);
      }
    }
  }
}
