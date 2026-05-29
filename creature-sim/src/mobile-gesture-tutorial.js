/**
 * Mobile Gesture Tutorial
 * Shows a one-time hint overlay for pan/zoom/inspect on first mobile launch.
 */

const TUTORIAL_KEY = 'creature-sim-gesture-tutorial-shown';

export class MobileGestureTutorial {
  constructor() {
    this.shown = false;
  }

  shouldShow() {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.has('smoke') || params.has('autostart') || params.has('autosandbox')) {
      return false;
    }
    const isMobile = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isMobile) return false;
    try {
      const alreadyShown = localStorage.getItem(TUTORIAL_KEY);
      if (alreadyShown) return false;
    } catch {
      // Ignore storage errors
    }
    return true;
  }

  show() {
    if (this.shown || !this.shouldShow()) return;
    this.shown = true;

    const overlay = document.createElement('div');
    overlay.id = 'mobile-gesture-tutorial';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Gesture tutorial');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 5000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
      animation: fadeIn 0.3s ease;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--bg-elevated, #121925);
      border: 1px solid var(--glass-border, rgba(151,183,212,0.16));
      border-radius: var(--radius-lg, 16px);
      padding: 24px; max-width: 320px; width: 86vw;
      box-shadow: var(--shadow-hard, 0 12px 48px rgba(0,0,0,0.6));
      text-align: center; color: var(--text-primary, #e8eaed);
      font-family: var(--font-sans, system-ui, sans-serif);
    `;

    card.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 12px;">📱</div>
      <h2 style="margin: 0 0 8px; font-size: 18px;">Sandbox Controls</h2>
      <p style="margin: 0 0 16px; color: var(--text-secondary, #9aa3b8); font-size: 13px; line-height: 1.5;">
        Swipe with one finger to pan.<br>
        Pinch with two fingers to zoom.<br>
        Long-press a creature to inspect.
      </p>
      <button id="gesture-tutorial-dismiss" style="
        background: var(--accent-primary, #39d5ff);
        color: var(--text-inverse, #0c0f18);
        border: none; border-radius: 999px;
        padding: 10px 24px; font-weight: 600; font-size: 14px;
        cursor: pointer;
      ">Got it</button>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const dismiss = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 250);
      try {
        localStorage.setItem(TUTORIAL_KEY, '1');
      } catch {
        // Ignore
      }
    };

    card.querySelector('#gesture-tutorial-dismiss').addEventListener('click', dismiss);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) dismiss();
    });
  }
}

export const mobileGestureTutorial = new MobileGestureTutorial();
