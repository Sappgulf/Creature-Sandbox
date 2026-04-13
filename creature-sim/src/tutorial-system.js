// Tutorial System - Guided onboarding experience
// Progressive unlocks, tooltips, and interactive guidance

export class TutorialSystem {
  constructor() {
    this.completed = new Set();
    this.currentStep = null;
    this.steps = [
      {
        id: 'welcome',
        title: 'Welcome!',
        text: 'This is an evolution simulator. Watch creatures evolve, survive, and adapt!',
        highlight: null,
        action: null,
        keyRequired: null,
        autoAdvance: true,
        autoAdvanceDelay: 3000
      },
      {
        id: 'camera',
        title: 'Camera Controls',
        text: 'Scroll to zoom in/out. Middle-click or Alt+Drag to pan around the world.',
        highlight: 'canvas',
        action: 'zoom',
        keyRequired: null,
        waitFor: { type: 'zoom', count: 1 }
      },
      {
        id: 'select',
        title: 'Select Creatures',
        text: 'Click on any creature to inspect it and see its genes, stats, and lineage.',
        highlight: 'creature',
        action: 'select',
        keyRequired: null,
        waitFor: { type: 'select', count: 1 }
      },
      {
        id: 'pause',
        title: 'Control Simulation',
        text: 'Press SPACE to pause/play. Use +/- to adjust simulation speed.',
        highlight: 'btn-pause',
        action: null,
        keyRequired: 'Space',
        waitFor: { type: 'keypress', key: 'Space' }
      },
      {
        id: 'features',
        title: 'Explore Features',
        text: 'Press V to see vision cones, C for genetic clustering, T for territories, and more!',
        highlight: null,
        action: null,
        keyRequired: 'v',
        waitFor: { type: 'keypress', key: 'v' }
      },
      {
        id: 'tools',
        title: 'God Mode Tools',
        text: 'Select a creature, then use Heal, Boost, Kill, or Clone buttons to intervene!',
        highlight: 'god-mode-buttons',
        action: 'use_tool',
        keyRequired: null,
        waitFor: { type: 'god_mode_action', count: 1 }
      }
    ];

    this.stepIndex = 0;
    this.active = false;
    this.skipRequested = false;

    // Event listeners tracking
    this.listeners = {
      zoom: 0,
      select: 0,
      keypress: {},
      god_mode_action: 0
    };
  }

  get isActive() {
    return this.active;
  }

  // Start tutorial (first time players)
  start() {
    if (this.completed.has('all')) {
      return; // Already completed
    }

    this.active = true;
    this.stepIndex = 0;
    this.showStep(this.steps[0]);

    // Setup global listeners for tutorial tracking
    this.setupListeners();
  }

  // Skip tutorial
  skip() {
    this.skipRequested = true;
    this.hideCurrentStep();
    this.active = false;
    this.completed.add('all');
    this.saveProgress();
  }

  // Show a tutorial step
  showStep(step) {
    this.currentStep = step;

    // Create tutorial overlay if it doesn't exist
    let overlay = document.getElementById('tutorial-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tutorial-overlay';
      overlay.innerHTML = `
        <div id="tutorial-content">
          <div id="tutorial-title"></div>
          <div id="tutorial-text"></div>
          <div id="tutorial-actions">
            <button id="tutorial-next">Next</button>
            <button id="tutorial-skip">Skip Tutorial</button>
          </div>
        </div>
        <div id="tutorial-highlight"></div>
      `;
      document.body.appendChild(overlay);

      // Style it
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        pointer-events: none;
      `;

      const content = overlay.querySelector('#tutorial-content');
      content.style.cssText = `
        position: absolute;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 500px;
        pointer-events: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      `;

      const highlight = overlay.querySelector('#tutorial-highlight');
      highlight.style.cssText = `
        position: absolute;
        border: 3px solid #4ade80;
        border-radius: 8px;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;

      // Button styles
      const buttons = content.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.style.cssText = `
          margin: 10px 5px 0;
          padding: 8px 16px;
          background: #4ade80;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        `;
      });

      // Event listeners
      content.querySelector('#tutorial-next').addEventListener('click', () => this.nextStep());
      content.querySelector('#tutorial-skip').addEventListener('click', () => this.skip());
    }

    // Update content
    overlay.querySelector('#tutorial-title').textContent = step.title;
    overlay.querySelector('#tutorial-text').textContent = step.text;

    // Highlight element if specified
    if (step.highlight) {
      this.highlightElement(step.highlight);
    } else {
      this.hideHighlight();
    }

    // Auto-advance if configured
    if (step.autoAdvance) {
      setTimeout(() => {
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
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay && overlay.style.display === 'none') {
      overlay.style.display = 'block';
    }

    // Reposition highlight each frame (elements might move)
    if (this.currentStep.highlight) {
      this.highlightElement(this.currentStep.highlight);
    }
  }

  // Highlight an element on screen
  highlightElement(selector) {
    const highlight = document.getElementById('tutorial-highlight');
    if (!highlight) return;

    let element = null;

    // Try different selector strategies
    if (selector === 'canvas') {
      element = document.getElementById('view');
    } else if (selector === 'btn-pause') {
      element = document.querySelector('[data-action="pause"]') || document.querySelector('#btn-pause');
    } else if (selector === 'god-mode-buttons') {
      element = document.querySelector('.god-mode-buttons') || document.querySelector('[data-god-mode]');
    }

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
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    this.hideHighlight();
  }

  // Move to next step
  nextStep() {
    this.completed.add(this.currentStep?.id);

    if (this.stepIndex < this.steps.length - 1) {
      this.stepIndex++;
      this.showStep(this.steps[this.stepIndex]);
    } else {
      // Tutorial complete!
      this.complete();
    }
  }

  // Complete tutorial
  complete() {
    this.hideCurrentStep();
    this.active = false;
    this.completed.add('all');
    this.saveProgress();

    // Trigger achievement
    if (window.achievements) {
      window.achievements.unlock('tutorial_complete');
    }
  }

  // Setup global listeners for tracking tutorial progress
  setupListeners() {
    // Track zoom
    window.addEventListener('wheel', () => {
      if (this.active && this.currentStep?.id === 'camera') {
        this.listeners.zoom++;
        if (this.listeners.zoom >= (this.currentStep.waitFor?.count || 1)) {
          setTimeout(() => this.nextStep(), 1000);
        }
      }
    }, { passive: true });

    // Track keypresses
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;

      const key = e.code === 'Space' ? 'Space' : e.key.toLowerCase();
      if (this.currentStep?.waitFor?.key === key) {
        setTimeout(() => this.nextStep(), 500);
      }
    });
  }

  // Track creature selection (called from main.js)
  trackSelection() {
    if (this.active && this.currentStep?.id === 'select') {
      this.listeners.select++;
      if (this.listeners.select >= (this.currentStep.waitFor?.count || 1)) {
        setTimeout(() => this.nextStep(), 1000);
      }
    }
  }

  // Track god mode action (called from main.js)
  trackGodModeAction() {
    if (this.active && this.currentStep?.id === 'tools') {
      this.listeners.god_mode_action++;
      if (this.listeners.god_mode_action >= (this.currentStep.waitFor?.count || 1)) {
        setTimeout(() => this.nextStep(), 1000);
      }
    }
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
        this.completed = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load tutorial progress:', e);
    }
  }

  // Check if should show tutorial
  shouldShow() {
    return !this.completed.has('all');
  }
}
