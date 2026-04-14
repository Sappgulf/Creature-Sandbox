import { domCache } from './dom-cache.js';

export function applyUiGameModeMethods(UIController) {
  UIController.prototype.bindGameplayModeControls = function() {
    if (!this.gameplayModes) return;
    const modeSelect = domCache.get('modeSelect');
    const modeApplyBtn = domCache.get('modeApplyBtn');
    const modeCycleBtn = domCache.get('modeCycleBtn');

    if (modeSelect) {
      modeSelect.innerHTML = this.gameplayModes.getModes()
        .map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`)
        .join('');
      modeSelect.value = this.gameplayModes.getActiveMode()?.id;
    }

    if (modeApplyBtn) {
      modeApplyBtn.addEventListener('click', this.boundHandlers.onModeChange);
    }

    if (modeCycleBtn) {
      modeCycleBtn.addEventListener('click', this.boundHandlers.onModeCycle);
    }

    this.renderGameMode();
  };

  UIController.prototype.onModeChange = function() {
    const select = domCache.get('modeSelect');
    if (!select || !this.gameplayModes) return;
    const value = select.value;
    this.gameplayModes.applyMode(value);
    this.renderGameMode();
    this.dismissInteractionHint();
  };

  UIController.prototype.onModeCycle = function() {
    if (!this.gameplayModes) return;
    this.gameplayModes.cycleMode(1);
    const select = domCache.get('modeSelect');
    if (select) {
      select.value = this.gameplayModes.getActiveMode()?.id;
    }
    this.renderGameMode();
    this.dismissInteractionHint();
  };

  UIController.prototype.renderGameMode = function(modeData = null) {
    const active = modeData || this.gameplayModes?.getActiveMode?.();
    const nameEl = domCache.get('modeName');
    const descEl = domCache.get('modeDescription');
    const tagsEl = domCache.get('modeTags');
    const select = domCache.get('modeSelect');

    if (!active) return;
    if (nameEl) nameEl.textContent = `${active.icon ?? '⚙️'} ${active.name}`;
    if (descEl) descEl.textContent = active.description || '';
    if (tagsEl) {
      tagsEl.innerHTML = (active.tags || []).map(tag => `<span class="pill">${tag}</span>`).join('');
    }
    if (select && active.id) {
      select.value = active.id;
    }
  };

  UIController.prototype.bindSessionGoalControls = function() {
    const refreshBtn = domCache.get('refreshGoalsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', this.boundHandlers.onRefreshGoals);
    }
    this.renderSessionGoals();
  };

  UIController.prototype.onRefreshGoals = function() {
    if (!this.sessionGoals) return;
    this.sessionGoals.refresh();
    this.renderSessionGoals();
  };

  UIController.prototype.renderSessionGoals = function(goals = null) {
    const container = domCache.get('goalList');
    const card = domCache.get('goalCard');
    const goalData = goals || this.sessionGoals?.getGoals?.() || [];
    if (!container) return;

    if (!goalData.length) {
      container.innerHTML = '<div class="muted tiny">Goals will appear after the world starts running.</div>';
      return;
    }

    container.innerHTML = goalData.map(goal => {
      const percent = Math.min(100, Math.round((goal.progress || 0) * 100));
      const complete = goal.completed || percent >= 100;
      return `
        <div class="goal-row ${complete ? 'complete' : ''}">
          <div class="goal-row-header">
            <span class="goal-icon">${goal.icon || '🎯'}</span>
            <div class="goal-text">
              <div class="goal-desc">${goal.description}</div>
              <div class="goal-meta">${complete ? 'Complete' : `${percent}%`}</div>
            </div>
          </div>
          <div class="goal-progress">
            <div class="goal-progress-fill" style="width:${percent}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    if (card && goalData.some(g => g.completed)) {
      card.classList.add('celebrate');
      setTimeout(() => card.classList.remove('celebrate'), 600);
    }
  };

  UIController.prototype.onCampaignToggle = function() {
    // Campaign panel toggle handled in main.js (kept for unified menu model)
  };
}
