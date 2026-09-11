import { domCache } from './dom-cache.js';
import { gameState } from './game-state.js';
import { eventSystem, GameEvents } from './event-system.js';

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

    // Guided-loop checklist state. The steps used to render as static
    // decoration; these flags let the panel check them off as the player acts.
    this._guidedInfluenceDone = false;
    this._playableOptionSignature = '';
    eventSystem.on(GameEvents.SCENARIO_STARTED, () => {
      this._guidedInfluenceDone = false;
    });
    eventSystem.on(GameEvents.FOOD_DROP, () => {
      this._guidedInfluenceDone = true;
    });

    if (select) {
      this._renderPlayableOptions();
    }

    if (startBtn) {
      startBtn.addEventListener('click', this.boundHandlers.onPlayableScenarioStart);
    }

    const leaveBtn = document.getElementById('playable-scenario-leave');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        const left = this.gameDirector?.leaveScenario?.() ?? this.playableScenarios?.leaveRun?.() ?? false;
        if (left) {
          this.renderPlayableDirector();
          this.dismissInteractionHint?.();
        }
      });
    }

    this.renderPlayableDirector();
  };

  UIController.prototype._renderPlayableOptions = function () {
    const select = domCache.get('playableScenarioSelect');
    if (!select || !this.playableScenarios) return;
    const scenarios = this.playableScenarios.getScenarios();
    // Rebuild only when clear counts change, and preserve the current pick.
    const signature = scenarios.map(s => `${s.id}:${s.progress?.completions || 0}`).join('|');
    if (signature === this._playableOptionSignature) return;
    this._playableOptionSignature = signature;
    const current = select.value;
    select.innerHTML = scenarios
      .map(scenario => {
        const progress = scenario.progress || {};
        const suffix = progress.completions
          ? ` (${progress.completions} clear${progress.completions === 1 ? '' : 's'})`
          : '';
        return `<option value="${scenario.id}">${scenario.icon} ${escapeHtml(scenario.name)}${suffix}</option>`;
      })
      .join('');
    if (current) select.value = current;
  };

  UIController.prototype._getGuidedLoopStates = function (data) {
    if (!data?.active || !data?.scenario?.guidedLoop) return null;
    const calmZones = this.world?.environment?.calmZones?.length || 0;
    const restZones = this.world?.restZones?.length || 0;
    return [!!gameState.selectedId, !!this._guidedInfluenceDone, !!gameState.pinnedId, calmZones > 0 || restZones > 0];
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

    const leaveBtn = document.getElementById('playable-scenario-leave');
    if (leaveBtn) {
      leaveBtn.classList.toggle('hidden', !data.active);
      leaveBtn.setAttribute('aria-hidden', data.active ? 'false' : 'true');
    }

    if (select && scenario?.id) {
      select.value = scenario.id;
    }

    const stateLabel = data.active
      ? `${scenario.icon || '🎯'} ${escapeHtml(scenario.name)} · ${formatTime(data.elapsed)} / ${formatTime(data.targetSeconds)}`
      : 'Pick a scenario to start a real run';

    const steps =
      scenario?.steps?.length && !scenario?.guidedLoop
        ? `<div class="director-steps">${scenario.steps.map(step => `<span>${escapeHtml(step)}</span>`).join('')}</div>`
        : '';
    const guidedStates = this._getGuidedLoopStates(data);
    const guidedDoneCount = guidedStates ? guidedStates.filter(Boolean).length : 0;
    const guidedLoop =
      scenario?.guidedLoop && scenario?.steps?.length
        ? `<section class="director-guided-loop" aria-label="Guided expedition loop">
          <div class="guided-loop-heading"><span>First expedition</span><em>${guidedDoneCount}/${scenario.steps.length} done</em></div>
          <ol>
            ${scenario.steps
              .map((step, index) => {
                const done = !!guidedStates?.[index];
                return `
              <li class="${done ? 'done' : ''}"${done ? ' aria-label="Completed"' : ''}><span class="guided-loop-index">${
                done ? '✓' : index + 1
              }</span><strong>${escapeHtml(step)}</strong></li>`;
              })
              .join('')}
          </ol>
        </section>`
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
      ${guidedLoop}
      ${steps}
    `;

    // Keep the scenario picker's clear counts fresh after a finished run.
    this._renderPlayableOptions();
  };
}
