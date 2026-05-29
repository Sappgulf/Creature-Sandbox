import { domCache } from './dom-cache.js';

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function applyUiPlayableMethods(UIController) {
  UIController.prototype.bindPlayableControls = function () {
    const select = domCache.get('playableScenarioSelect');
    const startBtn = domCache.get('playableScenarioStart');
    if (!this.playableScenarios) return;

    if (select) {
      select.innerHTML = this.playableScenarios
        .getScenarios()
        .map(scenario => {
          const progress = scenario.progress || {};
          const suffix = progress.completions
            ? ` (${progress.completions} clear${progress.completions === 1 ? '' : 's'})`
            : '';
          return `<option value="${scenario.id}">${scenario.icon} ${escapeHtml(scenario.name)}${suffix}</option>`;
        })
        .join('');
    }

    if (startBtn) {
      startBtn.addEventListener('click', this.boundHandlers.onPlayableScenarioStart);
    }

    this.renderPlayableDirector();
  };

  UIController.prototype.onPlayableScenarioStart = function () {
    if (!this.playableScenarios) return;
    const select = domCache.get('playableScenarioSelect');
    const id = select?.value || this.playableScenarios.getScenarios()[0]?.id;
    const snapshot = this.gameDirector?.startScenario?.(id) || this.playableScenarios.startScenario(id);
    this.updateSessionMetaVisibility?.();
    this.renderPlayableDirector(snapshot);
    this.dismissInteractionHint?.();
  };

  UIController.prototype.renderPlayableDirector = function (snapshot = null) {
    const root = domCache.get('playableDirector');
    const select = domCache.get('playableScenarioSelect');
    if (!root || !this.playableScenarios) return;
    const directorSnapshot = snapshot?.playable ? snapshot : this.gameDirector?.getSnapshot?.() || null;
    const data = snapshot?.playable
      ? snapshot.playable
      : snapshot || directorSnapshot?.playable || this.playableScenarios.getSnapshot();
    const scenario = data.scenario;
    const director = data.director || {};
    const metrics = data.metrics || {};
    const progress = Math.max(0, Math.min(100, Number(data.progress || 0)));
    const artFrame = Math.max(0, Math.min(6, Number(scenario?.artFrame || 0)));
    const objectiveCards = directorSnapshot?.objectives?.cards || [];
    document.body?.classList.toggle('playable-run-active', !!data.active);

    if (select && scenario?.id) {
      select.value = scenario.id;
    }

    const stateLabel = data.active
      ? `${scenario.icon || '🎯'} ${escapeHtml(scenario.name)} · ${formatTime(data.elapsed)} / ${formatTime(data.targetSeconds)}`
      : 'Pick a scenario to start a real run';

    const steps = scenario?.steps?.length
      ? `<div class="director-steps">${scenario.steps.map(step => `<span>${escapeHtml(step)}</span>`).join('')}</div>`
      : '';
    const objectives = objectiveCards.length
      ? `<div class="director-objectives" aria-label="Current objectives">
          ${objectiveCards
    .slice(0, 4)
    .map(
      card => `
            <div class="director-objective-card ${escapeHtml(card.level || 'active')}">
              <span class="objective-mark">${escapeHtml(card.icon || '🎯')}</span>
              <span class="objective-text">
                <strong>${escapeHtml(card.description || card.label)}</strong>
                <em>${escapeHtml(card.value || `${Math.round((card.progress || 0) * 100)}%`)}</em>
              </span>
              <span class="objective-ring" style="--objective-progress:${Math.round((card.progress || 0) * 100)}%"></span>
            </div>
          `
    )
    .join('')}
        </div>`
      : '';

    root.innerHTML = `
      <div class="director-art" style="--scenario-frame:${artFrame}" aria-hidden="true"></div>
      <div class="director-status ${escapeHtml(director.level || 'stable')}">
        <div class="director-state">${stateLabel}</div>
        <div class="director-headline">${escapeHtml(director.headline || 'Choose a scenario')}</div>
        <div class="director-copy">${escapeHtml(director.why || '')}</div>
        <div class="director-action">${escapeHtml(director.nextAction || '')}</div>
      </div>
      <div class="director-progress" aria-label="Scenario progress">
        <div class="director-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="director-metrics">
        <span><b>${metrics.alive ?? 0}</b> alive</span>
        <span><b>${metrics.predators ?? 0}</b> predators</span>
        <span><b>${metrics.food ?? 0}</b> food</span>
        <span><b>${Math.round(metrics.averageStress ?? 0)}</b> stress</span>
      </div>
      ${objectives}
      ${steps}
    `;
  };
}
