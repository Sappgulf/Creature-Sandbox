/**
 * Replay Panel Controller
 * Renders the replay panel UI and binds it to the ReplaySystem instance.
 */

import { setText } from './safe-html.js';

const REPLAY_PANEL_ID = 'replay-panel';

export class ReplayPanelController {
  /**
   * @param {Object} options
   * @param {import('./replay-system.js').ReplaySystem} options.replay
   * @param {Function} options.onClose
   */
  constructor({ replay, onClose } = {}) {
    this.replay = replay;
    this.onClose = typeof onClose === 'function' ? onClose : () => {};
    this.panel = null;
    this.list = null;
    this.scrubber = null;
    this.speedLabel = null;
    this.cursorLabel = null;
    this.unsubscribe = null;
  }

  initialize() {
    this.panel = document.getElementById(REPLAY_PANEL_ID);
    if (!this.panel) {
      console.warn('ReplayPanelController: #replay-panel not found in DOM');
      return false;
    }
    this.list = this.panel.querySelector('#replay-snapshot-list');
    this.scrubber = this.panel.querySelector('#replay-scrubber');
    this.speedLabel = this.panel.querySelector('#replay-speed-value');
    this.cursorLabel = this.panel.querySelector('#replay-cursor');
    this._bindControls();
    if (this.replay) {
      this.unsubscribe = this.replay.subscribe(() => this.render());
      this.render();
    }
    return true;
  }

  destroy() {
    if (typeof this.unsubscribe === 'function') this.unsubscribe();
    this.unsubscribe = null;
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

  _bindControls() {
    if (!this.panel) return;
    const closeBtn = this.panel.querySelector('#replay-close');
    const playBtn = this.panel.querySelector('#replay-play');
    const stepBack = this.panel.querySelector('#replay-step-back');
    const stepForward = this.panel.querySelector('#replay-step-forward');
    const speedUp = this.panel.querySelector('#replay-speed-up');
    const speedDown = this.panel.querySelector('#replay-speed-down');
    const resetBtn = this.panel.querySelector('#replay-reset');
    const shareBtn = this.panel.querySelector('#replay-share');
    const liveBtn = this.panel.querySelector('#replay-live');

    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
    if (playBtn) playBtn.addEventListener('click', () => this.replay?.setPlaying(!this.replay.playing));
    if (stepBack) stepBack.addEventListener('click', () => this.replay?.step(-1));
    if (stepForward) stepForward.addEventListener('click', () => this.replay?.step(1));
    if (speedUp) speedUp.addEventListener('click', () => this.replay?.setSpeed((this.replay?.speed || 1) * 2));
    if (speedDown) speedDown.addEventListener('click', () => this.replay?.setSpeed((this.replay?.speed || 1) / 2));
    if (resetBtn)
      resetBtn.addEventListener('click', () => {
        this.replay?.reset();
        this.replay?.clearStorage();
      });
    if (liveBtn) liveBtn.addEventListener('click', () => this.replay?.scrubTo(-1));
    if (shareBtn) shareBtn.addEventListener('click', () => this._share());
    if (this.scrubber) {
      this.scrubber.addEventListener('input', event => {
        const value = Number(event.target.value);
        this.replay?.scrubTo(value);
      });
    }
  }

  render() {
    if (!this.panel || this.panel.classList.contains('hidden')) return;
    const state = this.replay?.snapshotState?.() || { size: 0, cursor: -1, playing: false, speed: 1 };
    const snapshots = this.replay?.snapshots || [];
    if (this.scrubber) {
      const max = Math.max(0, state.size - 1);
      this.scrubber.max = String(max);
      const cursor = state.cursor < 0 ? max : state.cursor;
      this.scrubber.value = String(cursor);
    }
    if (this.speedLabel) {
      setText(this.speedLabel, `${state.speed.toFixed(2).replace(/\.00$/, '')}×`);
    }
    if (this.cursorLabel) {
      const total = state.size;
      const idx = state.cursor < 0 ? total - 1 : state.cursor;
      const idxLabel = total > 0 ? `${idx + 1}/${total}` : '0/0';
      setText(this.cursorLabel, idxLabel);
    }
    const playBtn = this.panel.querySelector('#replay-play');
    if (playBtn) {
      setText(playBtn, state.playing ? '⏸ Pause' : '▶ Play');
      playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
    }
    this._renderList(snapshots, state.cursor);
  }

  _renderList(snapshots, cursor) {
    if (!this.list) return;
    if (!snapshots.length) {
      this.list.innerHTML =
        '<div class="muted tiny">Snapshots appear every 5 seconds. Keep the simulation running.</div>';
      return;
    }
    const rows = snapshots
      .map((snapshot, index) => {
        const isActive = index === cursor;
        const summary = snapshot?.payload?.summary || {};
        return `
        <div class="replay-snapshot-row${isActive ? ' active' : ''}" data-index="${index}">
          <span class="replay-snapshot-time">${formatTime(snapshot.t)}</span>
          <span class="replay-snapshot-stat">Pop ${summary.population ?? 0}</span>
          <span class="replay-snapshot-stat">Pred ${summary.predators ?? 0}</span>
          <span class="replay-snapshot-stat">Food ${summary.food ?? 0}</span>
        </div>`;
      })
      .join('');
    this.list.innerHTML = rows;
  }

  _share() {
    if (!this.replay) return;
    const payload = this.replay.exportJSON();
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creature-sim-replay-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Replay share failed:', error);
    }
  }
}

function formatTime(t) {
  const total = Math.max(0, Math.floor(Number(t) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
