import { domCache } from './dom-cache.js';
import { gameState } from './game-state.js';
import { eventSystem, GameEvents } from './event-system.js';
import { renderIcon } from './icon-glyphs.js';

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
        return `<option value="${scenario.id}">${escapeHtml(scenario.name)}${suffix}</option>`;
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
    // Guard the reset itself, not only the disabled button: a running scenario
    // is discarded by startScenario, so it must be left explicitly first.
    const current = this.playableScenarios.getSnapshot?.();
    if (current?.active && current?.state === 'running') return;
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
    // Start rebuilds the world from the scenario's setup, so pressing it during
    // a live run silently discarded that run. A finished run is already saved,
    // so only a running one blocks Start: leave it first, then start again.
    const startBtn = domCache.get('playableScenarioStart');
    const liveRun = !!data.active && data.state === 'running';
    if (startBtn) {
      startBtn.disabled = liveRun;
      startBtn.title = liveRun ? 'Leave the active run before starting another' : 'Start selected scenario';
    }

    if (select && scenario?.id) {
      select.value = scenario.id;
    }

    const stateLabel = data.active
      ? `${renderIcon(scenario.icon, { className: 'director-state-glyph' })} ${escapeHtml(scenario.name)} · ${formatTime(data.elapsed)} / ${formatTime(data.targetSeconds)}`
      : 'Pick a scenario to start a real run';

    const guidedStates = this._getGuidedLoopStates(data);
    const guidedDoneCount = guidedStates ? guidedStates.filter(Boolean).length : 0;
    const guided = !!(scenario?.guidedLoop && scenario?.steps?.length);
    // One primary objective is visible at a time: the first unfinished card.
    // The rest, the full expedition checklist and the other steps sit behind
    // the Details disclosure, so the director fits the right column.
    const objectiveList = objectiveCards.slice(0, 4);
    const primaryIndex = Math.max(
      0,
      objectiveList.findIndex(card => card.level !== 'complete')
    );
    const otherCards = objectiveList.filter((_, index) => index !== primaryIndex);
    const renderObjectiveCard = card => `
            <div class="director-objective-card ${escapeHtml(card.level || 'active')}">
              <span class="objective-mark">${renderIcon(card.icon)}</span>
              <span class="objective-text">
                <strong>${escapeHtml(card.description || card.label)}</strong>
                <em>${escapeHtml(card.value || `${Math.round((card.progress || 0) * 100)}%`)}</em>
              </span>
              <span class="objective-ring" style="--objective-progress:${Math.round((card.progress || 0) * 100)}%"></span>
            </div>`;
    const primaryObjective = objectiveList[primaryIndex]
      ? `<div class="director-objectives" aria-label="Primary objective">${renderObjectiveCard(objectiveList[primaryIndex])}</div>`
      : '';
    const otherObjectives = otherCards.length
      ? `<div class="director-objectives" aria-label="Other objectives">${otherCards.map(renderObjectiveCard).join('')}</div>`
      : '';
    const nextStepIndex = guided && guidedStates ? scenario.steps.findIndex((_, index) => !guidedStates[index]) : -1;
    const nextStep =
      nextStepIndex >= 0
        ? `<div class="director-next-step"><span class="guided-loop-index">${nextStepIndex + 1}</span><span><b>Next</b>${escapeHtml(scenario.steps[nextStepIndex])}</span></div>`
        : '';
    const steps =
      scenario?.steps?.length && !scenario?.guidedLoop
        ? `<div class="director-steps">${scenario.steps.map(step => `<span>${escapeHtml(step)}</span>`).join('')}</div>`
        : '';
    const guidedLoop = guided
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
    const why = director.why ? `<p class="director-copy">${escapeHtml(director.why)}</p>` : '';
    const detailsBody = `${why}${otherObjectives}${guidedLoop}${steps}`;
    const detailsSummary =
      [
        otherCards.length ? `${otherCards.length} more objective${otherCards.length === 1 ? '' : 's'}` : '',
        guided ? `${guidedDoneCount}/${scenario.steps.length} steps` : ''
      ]
        .filter(Boolean)
        .join(' · ') || 'Details';
    const details = detailsBody.trim()
      ? `<details class="director-details"${this._directorDetailsOpen ? ' open' : ''}>
          <summary>${escapeHtml(detailsSummary)}</summary>
          ${detailsBody}
        </details>`
      : '';
    if (!root.dataset.detailsBound) {
      root.dataset.detailsBound = 'true';
      // toggle does not bubble, so the panel root listens in the capture phase
      // and remembers the disclosure state across the re-renders.
      root.addEventListener(
        'toggle',
        event => {
          if (event.target?.classList?.contains('director-details')) this._directorDetailsOpen = event.target.open;
        },
        true
      );
    }

    root.innerHTML = `
      <div class="director-art" style="--scenario-frame:${artFrame}" aria-hidden="true"></div>
      ${primaryObjective}
      <div class="director-status ${escapeHtml(director.level || 'stable')}">
        <div class="director-state">${stateLabel}</div>
        <div class="director-headline">${escapeHtml(director.headline || 'Choose a scenario')}</div>
        <div class="director-action">${escapeHtml(director.nextAction || '')}</div>
      </div>
      <div class="director-progress" aria-label="Scenario progress">
        <div class="director-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="director-metrics">
        <span><b>${metrics.alive ?? 0}</b> alive</span>
        <span title="predators"><b>${metrics.predators ?? 0}</b> pred</span>
        <span><b>${metrics.food ?? 0}</b> food</span>
        <span><b>${Math.round(metrics.averageStress ?? 0)}</b> stress</span>
      </div>
      ${nextStep}
      ${details}
    `;

    // Keep the scenario picker's clear counts fresh after a finished run.
    this._renderPlayableOptions();
  };
}
