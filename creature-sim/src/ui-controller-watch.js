import { gameState } from './game-state.js';
import { domCache } from './dom-cache.js';

export function applyUiWatchMethods(UIController) {
  UIController.prototype.bindWatchControls = function() {
    const momentsPanel = domCache.get('momentsPanel') || document.getElementById('moments-panel');
    const momentsList = domCache.get('momentsList') || document.getElementById('moments-list');
    const momentsSummary = domCache.get('momentsSummary') || document.getElementById('moments-summary');
    const momentsClose = domCache.get('momentsClose') || document.getElementById('moments-close');

    if (this.moments?.bindDom) {
      this.moments.bindDom({
        panel: momentsPanel,
        listEl: momentsList,
        summaryEl: momentsSummary,
        closeBtn: momentsClose
      });
    }
  };

  UIController.prototype.onWatchModeToggle = function() {
    gameState.watchModeEnabled = !gameState.watchModeEnabled;
    if (gameState.watchModeEnabled) {
      const speed = Math.min(2, Math.max(0.5, gameState.fastForward || 1));
      gameState.setWatchSpeed(speed);
    }
    this.updateWatchModeUI();
    this.updateSandboxUiVisibility();
  };

  UIController.prototype.onWatchPause = function() {
    this.onPause();
  };

  UIController.prototype.onWatchSpeed = function() {
    gameState.cycleWatchSpeed();
    this.updateWatchModeUI();
  };

  UIController.prototype.onWatchFollow = function() {
    const hasFollow = this.camera.followMode !== 'free';
    if (hasFollow) {
      this.camera.followMode = 'free';
      this.camera.followTarget = null;
      gameState.watchModeFollow = false;
      this.updateWatchModeUI();
      return;
    }

    const autoTarget = this.autoDirector?.getLastFocusTarget?.();
    const targetId = gameState.selectedId ?? autoTarget?.creatureId ?? null;
    if (!targetId) {
      if (this.hasNotifications()) {
        this.notifications.show('Select a creature to follow', 'info', 1800);
      }
      return;
    }

    this.camera.followMode = 'smooth-follow';
    this.camera.followTarget = targetId;
    gameState.watchModeFollow = true;
    this.updateWatchModeUI();
  };

  UIController.prototype.onWatchMoments = function() {
    this.moments?.togglePanel?.();
  };

  UIController.prototype.onWatchGodMode = function() {
    this.onGodModeToggle();
  };

  UIController.prototype.onWatchRecenter = function() {
    this.autoDirector?.recenter?.();
    this.updateWatchModeUI();
  };

  UIController.prototype.updateWatchModeUI = function() {
    const watchStrip = domCache.get('watchStrip');
    const watchToggleBtn = domCache.get('watchModeBtn');
    const watchSpeedBtn = domCache.get('watchSpeedBtn');
    const watchFollowBtn = domCache.get('watchFollowBtn');
    const watchRecenterBtn = domCache.get('watchRecenterBtn');
    const controlStrip = document.getElementById('control-strip');

    document.body.classList.toggle('watch-mode', !!gameState.watchModeEnabled);

    const watchSpeeds = [0.5, 1, 2];
    const speedIndex = watchSpeeds.indexOf(gameState.fastForward);
    if (speedIndex >= 0) {
      gameState.watchSpeedIndex = speedIndex;
    }

    if (watchStrip) {
      watchStrip.classList.toggle('hidden', !gameState.watchModeEnabled);
      watchStrip.setAttribute('aria-hidden', gameState.watchModeEnabled ? 'false' : 'true');
    }

    if (controlStrip) {
      controlStrip.classList.toggle('hidden', !!gameState.watchModeEnabled);
      controlStrip.setAttribute('aria-hidden', gameState.watchModeEnabled ? 'true' : 'false');
    }

    if (watchToggleBtn) {
      watchToggleBtn.setAttribute('aria-pressed', gameState.watchModeEnabled ? 'true' : 'false');
      watchToggleBtn.textContent = gameState.watchModeEnabled ? '👁️ Watch' : '🧭 Watch';
    }

    if (watchSpeedBtn) {
      const info = gameState.getWatchSpeedInfo();
      watchSpeedBtn.textContent = info.label;
      watchSpeedBtn.setAttribute('aria-label', `Watch speed ${info.label}`);
    }

    if (watchFollowBtn) {
      const isFollowing = this.camera.followMode !== 'free';
      watchFollowBtn.classList.toggle('active', isFollowing);
      watchFollowBtn.setAttribute('aria-pressed', isFollowing ? 'true' : 'false');
    }

    if (watchRecenterBtn) {
      const isSuspended = performance.now() < (gameState.autoDirectorOverrideUntil || 0);
      watchRecenterBtn.classList.toggle('active', isSuspended);
      watchRecenterBtn.setAttribute('aria-label', isSuspended ? 'Re-center to auto director' : 'Auto director active');
    }
  };
}
