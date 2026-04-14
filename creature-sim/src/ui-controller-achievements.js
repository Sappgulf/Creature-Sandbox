import { domCache } from './dom-cache.js';

export function applyUiAchievementsMethods(UIController) {
  UIController.prototype.onAchievementsToggle = function() {
    const panel = domCache.get('achievementsPanel') || document.getElementById('achievements-panel');
    if (panel) {
      if (panel.classList.contains('hidden')) {
        this.closeMajorPanels('achievements-panel');
      }
      const isVisible = this.togglePanelVisibility(panel);
      if (isVisible) {
        this.renderAchievementsPanel();
        this.bindAchievementsControls();
      }
    }
    this.dismissInteractionHint();
  };

  UIController.prototype.onAchievementsReset = function() {
    if (!this.achievements?.resetAll) return;
    const ok = typeof window === 'undefined' ? true : window.confirm('Reset all achievements and XP?');
    if (ok) {
      this.achievements.resetAll();
      this.renderAchievementsPanel();
    }
  };

  UIController.prototype.bindAchievementsControls = function() {
    const filter = document.getElementById('achievements-filter');
    const sort = document.getElementById('achievements-sort');
    const resetBtn = document.getElementById('btn-achievements-reset');

    if (filter && !filter._boundAchievements) {
      filter.addEventListener('change', () => this.renderAchievementsPanel());
      filter._boundAchievements = true;
    }
    if (sort && !sort._boundAchievements) {
      sort.addEventListener('change', () => this.renderAchievementsPanel());
      sort._boundAchievements = true;
    }
    if (resetBtn && !resetBtn._boundAchievements) {
      resetBtn.addEventListener('click', this.boundHandlers.onAchievementsReset);
      resetBtn._boundAchievements = true;
    }
  };

  UIController.prototype.renderAchievementsPanel = function() {
    const panel = document.getElementById('achievements-panel');
    if (!panel || panel.classList.contains('hidden')) return;

    const listEl = document.getElementById('achievements-list');
    const summaryEl = document.getElementById('achievements-summary');
    if (!listEl || !summaryEl || !this.achievements?.getProgress) return;

    const filterValue = document.getElementById('achievements-filter')?.value || 'all';
    const sortValue = document.getElementById('achievements-sort')?.value || 'locked';

    const progress = this.achievements.getProgress();
    let items = Array.isArray(progress.items) ? progress.items.slice() : [];

    if (filterValue !== 'all') {
      items = items.filter(i => i.type === filterValue);
    }

    switch (sortValue) {
      case 'unlocked':
        items.sort((a, b) => (b.unlocked === a.unlocked) ? (b.progress.percent - a.progress.percent) : (b.unlocked - a.unlocked));
        break;
      case 'recent':
        items.sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0));
        break;
      case 'name':
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'locked':
      default:
        items.sort((a, b) => (a.unlocked === b.unlocked) ? (b.progress.percent - a.progress.percent) : (a.unlocked - b.unlocked));
        break;
    }

    const xpTotal = Math.floor(progress.xp || 0);
    const nextLevelXP = Math.max(0, Math.floor(progress.nextLevelXP || 0));
    const levelProgress = nextLevelXP > 0 ? Math.min(1, xpTotal / nextLevelXP) : 1;
    summaryEl.innerHTML = `
      <div class="achievements-summary-row">
        <span>${progress.unlocked}/${progress.total} unlocked</span>
        <span>Level ${progress.level}</span>
        <span>${xpTotal}/${nextLevelXP} XP</span>
        <span>${Math.floor(progress.percentage)}%</span>
      </div>
      <div class="achievements-level-bar">
        <div class="achievements-level-fill" style="width:${Math.round(levelProgress * 100)}%"></div>
      </div>
    `;

    listEl.innerHTML = items.map(item => {
      const isSecretLocked = item.secret && !item.unlocked;
      const name = isSecretLocked ? '???' : item.name;
      const desc = isSecretLocked ? 'Hidden achievement' : (item.description || '');
      const icon = isSecretLocked ? '❓' : (item.icon || '🏅');
      const goal = item.progress.goal;
      const current = item.progress.current;
      const percent = item.progress.percent || 0;
      const progressHtml = goal ? `
        <div class="achievement-progress-bar">
          <div class="achievement-progress-fill" style="width:${Math.round(percent * 100)}%"></div>
        </div>
        <div class="achievement-progress-text">
          <span>${Math.floor(current)}/${goal}</span>
          <span>${Math.round(percent * 100)}%</span>
        </div>
      ` : '';

      return `
        <div class="achievement-item ${item.unlocked ? 'unlocked' : ''}">
          <div class="achievement-icon">${icon}</div>
          <div class="achievement-main">
            <div class="achievement-title-row">
              <div class="achievement-name">${name}</div>
              <div class="achievement-type">${item.type || ''}</div>
            </div>
            <div class="achievement-desc">${desc}</div>
            ${progressHtml}
          </div>
        </div>
      `;
    }).join('');
  };
}
