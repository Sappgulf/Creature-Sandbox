/**
 * Touch-first Onboarding Flow
 *
 * A multi-step guided tour for mobile users that replaces the single-card
 * gesture hint. Shows 3 cards in sequence (pan/zoom, inspect, spawn/tools)
 * and persists completion so it only ever runs once per device.
 *
 * Completion is stored in `localStorage['creature-touch-onboarding-done']`.
 * Public API:
 *   - `touchOnboarding.shouldShow()`  - quick check used by bootstrap
 *   - `touchOnboarding.show({ force } = {})` - render the flow
 *   - `touchOnboarding.reset()` - clear the flag (used by Replay Tutorial)
 */

const STORAGE_KEY = 'creature-touch-onboarding-done';

const STEPS = [
  {
    icon: '👆',
    accent: 'cyan',
    title: 'Pan & Zoom',
    text: 'Drag to pan. Pinch to zoom.'
  },
  {
    icon: '🔍',
    accent: 'purple',
    title: 'Inspect',
    text: 'Tap a creature to see its genes. Long-press to grab and throw.'
  },
  {
    icon: '✨',
    accent: 'amber',
    title: 'Spawn & Tools',
    text: 'Tap the 🦌 button to spawn. Long-press the world to enter God Mode.'
  }
];

class TouchOnboarding {
  constructor() {
    this.shown = false;
    this.currentStep = 0;
    this.overlay = null;
    this.card = null;
    this.titleEl = null;
    this.textEl = null;
    this.stepEl = null;
    this.iconEl = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.doneBtn = null;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchStartT = 0;
    this._keyHandler = null;
  }

  /**
   * Whether the flow should be auto-shown on this boot. Returns false on
   * desktop, during smoke/autostart, or after the user has already
   * completed it once.
   * @returns {boolean}
   */
  shouldShow() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.has('smoke') || params.has('autostart') || params.has('autosandbox')) {
      return false;
    }
    const isMobile = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isMobile) return false;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return false;
    } catch {
      // Storage unavailable — still show, we won't be able to persist anyway
    }
    return true;
  }

  /**
   * Render the onboarding overlay. If `force` is true the flag is ignored
   * and the flow is shown regardless of prior completion.
   * @param {{force?: boolean}} [opts]
   */
  show({ force = false } = {}) {
    if (this.shown) return;
    if (!force && !this.shouldShow()) return;
    this.shown = true;
    this.currentStep = 0;

    // Make sure the markup is present in the document
    this._ensureMarkup();

    this._renderStep();

    this.overlay.classList.remove('hidden');
    this.overlay.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      this.overlay.classList.add('touch-onboarding-visible');
      this.card?.focus({ preventScroll: true });
    });

    this._bindEvents();
  }

  /**
   * Reset the persisted flag so the next call to show() will render again.
   * Used by the "Replay Tutorial" menu item.
   */
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  // === private ===

  _ensureMarkup() {
    const existing = document.getElementById('touch-onboarding');
    if (existing) {
      this.overlay = existing;
      this._cacheChildReferences();
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'touch-onboarding';
    overlay.className = 'touch-onboarding hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Mobile onboarding');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="touch-onboarding-card glass-hero" role="document" tabindex="-1">
        <div class="touch-onboarding-icon" aria-hidden="true"></div>
        <div class="touch-onboarding-step" aria-live="polite"></div>
        <div class="touch-onboarding-title"></div>
        <div class="touch-onboarding-text"></div>
        <div class="touch-onboarding-progress" aria-hidden="true">
          <span class="touch-onboarding-dot" data-step="0"></span>
          <span class="touch-onboarding-dot" data-step="1"></span>
          <span class="touch-onboarding-dot" data-step="2"></span>
        </div>
        <div class="touch-onboarding-actions">
          <button type="button" class="touch-onboarding-prev ghost-btn small" hidden>‹ Back</button>
          <button type="button" class="touch-onboarding-next primary-btn small">Next ›</button>
          <button type="button" class="touch-onboarding-done primary-btn small" hidden>Got it!</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this._cacheChildReferences();
  }

  _cacheChildReferences() {
    if (!this.overlay) return;
    this.card = this.overlay.querySelector('.touch-onboarding-card');
    this.titleEl = this.overlay.querySelector('.touch-onboarding-title');
    this.textEl = this.overlay.querySelector('.touch-onboarding-text');
    this.stepEl = this.overlay.querySelector('.touch-onboarding-step');
    this.iconEl = this.overlay.querySelector('.touch-onboarding-icon');
    this.prevBtn = this.overlay.querySelector('.touch-onboarding-prev');
    this.nextBtn = this.overlay.querySelector('.touch-onboarding-next');
    this.doneBtn = this.overlay.querySelector('.touch-onboarding-done');
    this.dots = Array.from(this.overlay.querySelectorAll('.touch-onboarding-dot'));
  }

  _bindEvents() {
    if (!this.overlay || this.overlay.dataset.bound === 'true') return;
    this.overlay.dataset.bound = 'true';

    this.nextBtn?.addEventListener('click', () => this._next());
    this.prevBtn?.addEventListener('click', () => this._prev());
    this.doneBtn?.addEventListener('click', () => this._complete());

    this.overlay.addEventListener('click', event => {
      if (event.target === this.overlay) {
        // Tap on backdrop completes the flow (we don't want a user stuck
        // behind a card they can't dismiss).
        this._complete();
      }
    });

    // Swipe left/right to navigate between cards
    this.card?.addEventListener(
      'touchstart',
      event => {
        if (!event.touches || event.touches.length === 0) return;
        const touch = event.touches[0];
        this._touchStartX = touch.clientX;
        this._touchStartY = touch.clientY;
        this._touchStartT = Date.now();
      },
      { passive: true }
    );

    this.card?.addEventListener(
      'touchend',
      event => {
        if (this._touchStartX === 0) return;
        const touch = event.changedTouches?.[0];
        if (!touch) {
          this._touchStartX = 0;
          return;
        }
        const dx = touch.clientX - this._touchStartX;
        const dy = touch.clientY - this._touchStartY;
        const dt = Date.now() - this._touchStartT;
        this._touchStartX = 0;
        // Ignore if the swipe was too short, too slow, or too vertical
        if (Math.abs(dx) < 40 || Math.abs(dy) > 60 || dt > 600) return;
        if (dx < 0) this._next();
        else this._prev();
      },
      { passive: true }
    );

    this._keyHandler = event => {
      if (this.overlay?.classList.contains('hidden')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this._next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this._prev();
      } else if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        this._complete();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  _renderStep() {
    const step = STEPS[this.currentStep];
    if (!step) return;

    if (this.titleEl) this.titleEl.textContent = step.title;
    if (this.textEl) this.textEl.textContent = step.text;
    if (this.iconEl) this.iconEl.textContent = step.icon;
    if (this.stepEl) {
      this.stepEl.textContent = `Step ${this.currentStep + 1} of ${STEPS.length}`;
    }

    if (this.card) {
      // Reset accent classes
      this.card.classList.remove(
        'accent-border-cyan',
        'accent-border-purple',
        'accent-border-amber',
        'accent-border-green',
        'accent-border-red'
      );
      this.card.classList.add(`accent-border-${step.accent}`);
    }

    if (this.dots) {
      this.dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === this.currentStep);
      });
    }

    if (this.prevBtn) this.prevBtn.hidden = this.currentStep === 0;
    if (this.nextBtn) this.nextBtn.hidden = this.currentStep === STEPS.length - 1;
    if (this.doneBtn) this.doneBtn.hidden = this.currentStep !== STEPS.length - 1;
  }

  _next() {
    if (this.currentStep >= STEPS.length - 1) {
      this._complete();
      return;
    }
    this.currentStep += 1;
    this._renderStep();
  }

  _prev() {
    if (this.currentStep === 0) return;
    this.currentStep -= 1;
    this._renderStep();
  }

  _complete() {
    if (!this.overlay) return;
    this.overlay.classList.remove('touch-onboarding-visible');
    this.overlay.classList.add('hidden');
    this.overlay.setAttribute('aria-hidden', 'true');
    this.shown = false;
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Ignore
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }
}

export const touchOnboarding = new TouchOnboarding();
export { STORAGE_KEY as TOUCH_ONBOARDING_KEY };
export default touchOnboarding;
