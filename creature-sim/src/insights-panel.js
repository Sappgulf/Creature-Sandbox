/**
 * Insights Panel Controller — Renders the insights feed and binds to an
 * `InsightsEngine` instance.
 */

import { escapeHtml } from './safe-html.js';

const PANEL_ID = 'insights-panel';

export class InsightsPanelController {
  /**
   * @param {Object} options
   * @param {import('./insights-engine.js').InsightsEngine} options.engine
   * @param {Function} [options.onClose]
   */
  constructor({ engine, onClose } = {}) {
    this.engine = engine;
    this.onClose = typeof onClose === 'function' ? onClose : () => {};
    this.panel = null;
    this.feed = null;
    this._unsub = null;
  }

  initialize() {
    this.panel = document.getElementById(PANEL_ID);
    if (!this.panel) {
      console.warn('InsightsPanelController: #insights-panel not found in DOM');
      return false;
    }
    this.feed = this.panel.querySelector('#insights-feed');
    const closeBtn = this.panel.querySelector('#insights-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
    this._unsub = this.engine?.subscribe?.(() => this.render());
    this.render();
    return true;
  }

  destroy() {
    if (typeof this._unsub === 'function') this._unsub();
    this._unsub = null;
  }

  show() {
    if (!this.panel) return;
    this.panel.classList.remove('hidden');
    this.panel.setAttribute('aria-hidden', 'false');
    this.render();
  }

  hide() {
    if (!this.panel) return;
    this.panel.classList.add('hidden');
    this.panel.setAttribute('aria-hidden', 'true');
  }

  toggle() {
    if (!this.panel) return;
    if (this.panel.classList.contains('hidden')) this.show();
    else this.hide();
  }

  render() {
    if (!this.feed) return;
    const items = Array.isArray(this.engine?.insights) ? this.engine.insights : [];
    if (items.length === 0) {
      this.feed.innerHTML =
        '<div class="insights-empty">Insights appear as the ecosystem evolves. Keep watching!</div>';
      return;
    }
    this.feed.innerHTML = items
      .map(
        item => `
        <div class="insight-item ${escapeHtml(item.type || '')}">
          <span class="insight-icon" aria-hidden="true">${escapeHtml(item.icon || '✨')}</span>
          <span class="insight-text">${escapeHtml(item.text || '')}</span>
          <span class="insight-time">${formatTime(item.worldTime)}</span>
        </div>`
      )
      .join('');
  }
}

function formatTime(t) {
  const total = Math.max(0, Math.floor(Number(t) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
