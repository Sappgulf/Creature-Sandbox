import { domCache } from './dom-cache.js';
import { escapeHtml } from './safe-html.js';

export function applyUiGameModeMethods(UIController) {
  UIController.prototype.bindGameplayModeControls = function () {
    if (!this.gameplayModes) return;
    const modeSelect = domCache.get('modeSelect');
    const modeApplyBtn = domCache.get('modeApplyBtn');
    const modeCycleBtn = domCache.get('modeCycleBtn');

    if (modeSelect) {
      modeSelect.innerHTML = this.gameplayModes
        .getModes()
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

  UIController.prototype.onModeChange = function () {
    const select = domCache.get('modeSelect');
    if (!select || !this.gameplayModes) return;
    const value = select.value;
    this.gameplayModes.applyMode(value);
    this.renderGameMode();
    this.dismissInteractionHint();
  };

  UIController.prototype.onModeCycle = function () {
    if (!this.gameplayModes) return;
    this.gameplayModes.cycleMode(1);
    const select = domCache.get('modeSelect');
    if (select) {
      select.value = this.gameplayModes.getActiveMode()?.id;
    }
    this.renderGameMode();
    this.dismissInteractionHint();
  };

  UIController.prototype.renderGameMode = function (modeData = null) {
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

  UIController.prototype.bindSessionGoalControls = function () {
    const refreshBtn = domCache.get('refreshGoalsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', this.boundHandlers.onRefreshGoals);
    }
    this.renderSessionGoals();
  };

  UIController.prototype.onRefreshGoals = function () {
    if (!this.sessionGoals) return;
    this.sessionGoals.refresh();
    this.renderSessionGoals();
  };

  UIController.prototype.renderSessionGoals = function (goals = null) {
    const container = domCache.get('goalList');
    const card = domCache.get('goalCard');
    const goalData = goals || this.sessionGoals?.getGoals?.() || [];
    if (!container) return;

    if (!goalData.length) {
      container.innerHTML = '<div class="muted tiny">Goals will appear after the world starts running.</div>';
      return;
    }

    container.innerHTML = goalData
      .map(goal => {
        const percent = Math.min(100, Math.round((goal.progress || 0) * 100));
        const complete = goal.completed || percent >= 100;
        return `
        <div class="goal-row ${complete ? 'complete' : ''}">
          <div class="goal-row-header">
            <span class="goal-icon">${escapeHtml(goal.icon || '🎯')}</span>
            <div class="goal-text">
              <div class="goal-desc">${escapeHtml(goal.description)}</div>
              <div class="goal-meta">${complete ? 'Complete' : `${percent}%`}</div>
            </div>
          </div>
          <div class="goal-progress">
            <div class="goal-progress-fill" style="width:${percent}%;"></div>
          </div>
        </div>
      `;
      })
      .join('');

    if (card && goalData.some(g => g.completed)) {
      card.classList.add('celebrate');
      setTimeout(() => card.classList.remove('celebrate'), 600);
    }
  };

  UIController.prototype.onCampaignToggle = async function () {
    const panel = document.getElementById('campaign-panel');
    if (!panel) {
      console.warn('Campaign panel not found in DOM');
      this.notifications?.show?.('Campaign panel unavailable', 'error', 2200);
      return;
    }
    if (!panel.classList.contains('hidden')) {
      this.setPanelVisibility(panel, false);
      this.dismissInteractionHint();
      return;
    }
    this.closeMajorPanels('campaign-panel');
    try {
      const { ensureCampaignSystem } = await import('./bootstrap-lazy-loaders.js');
      const campaignSystem = await ensureCampaignSystem();
      this.renderCampaignLevels(campaignSystem);
      this.setPanelVisibility(panel, true);
    } catch (error) {
      console.error('Campaign panel failed to open:', error);
      this.notifications?.show?.('Campaign panel failed to open', 'error', 2600);
    }
    this.dismissInteractionHint();
  };

  UIController.prototype.renderCampaignLevels = function (campaignSystem) {
    const container = document.getElementById('campaign-levels');
    if (!container) return;
    const levels = campaignSystem?.getAllLevels?.() || [];
    container.innerHTML = levels
      .map(level => {
        const stars = level.progress?.stars || 0;
        const locked = !level.unlocked;
        const tagName = locked ? 'div' : 'button';
        const interactionAttributes = locked ? 'aria-disabled="true"' : 'type="button"';
        const label =
          `${level.name}, ${level.subtitle}. ${level.description} ` +
          `Difficulty ${level.difficulty}. ${stars} of 3 stars.` +
          (locked ? ' Locked.' : '');
        return `
          <${tagName} ${interactionAttributes} class="campaign-level-card ${level.unlocked ? '' : 'locked'} ${level.progress?.completed ? 'completed' : ''}"
               aria-label="${escapeHtml(label)}"
               data-level-id="${escapeHtml(level.id)}">
            <div class="campaign-level-header">
              <span class="campaign-level-icon">${escapeHtml(level.icon)}</span>
              <div class="campaign-level-title">
                <h3 class="campaign-level-name">${escapeHtml(level.name)}</h3>
                <p class="campaign-level-subtitle">${escapeHtml(level.subtitle)}</p>
              </div>
            </div>
            <p class="campaign-level-desc">${escapeHtml(level.description)}</p>
            <div class="campaign-level-footer">
              <span class="campaign-difficulty ${level.difficulty}">${level.difficulty}</span>
              <span class="campaign-stars">
                ${[1, 2, 3].map(i => `<span class="${i <= stars ? 'earned' : ''}">⭐</span>`).join('')}
              </span>
            </div>
          </${tagName}>
        `;
      })
      .join('');

    container.querySelectorAll('.campaign-level-card:not(.locked)').forEach(card => {
      const activate = () => {
        this.startCampaignLevel(Number(card.dataset.levelId));
      };
      card.addEventListener('click', activate);
    });
  };

  UIController.prototype.startCampaignLevel = async function (levelId) {
    try {
      const { ensureCampaignSystem } = await import('./bootstrap-lazy-loaders.js');
      const campaignSystem = await ensureCampaignSystem();
      const level = campaignSystem?.getLevel?.(levelId);
      if (!level) {
        this.notifications?.show?.('Campaign level not found', 'error', 2200);
        return;
      }
      // Mirror the bootstrap opener: stage the world config, reseed, then
      // start tracking without re-applying the config.
      const config = level.worldConfig;
      if (this.world) {
        this.world.pendingCampaignConfig = config;
        this.world.seed?.(config.initialCreatures ?? 10, config.initialPredators ?? 0, config.initialFood ?? 100);
      }
      const started = campaignSystem.startLevel(levelId, this.world, { applyWorldConfig: false });
      if (!started) {
        this.notifications?.show?.('Campaign level is locked', 'warning', 2200);
        return;
      }
      const panel = document.getElementById('campaign-panel');
      panel?.classList.add('hidden');
      panel?.setAttribute('aria-hidden', 'true');
      const progress = document.getElementById('campaign-progress');
      progress?.classList.remove('hidden');
      progress?.setAttribute('aria-hidden', 'false');
      this.notifications?.show?.(`${level.icon || '🏆'} ${level.name} started`, 'success', 2200);
    } catch (error) {
      console.error('Campaign level failed to start:', error);
      this.notifications?.show?.('Campaign level failed to start', 'error', 2600);
    }
  };
}
