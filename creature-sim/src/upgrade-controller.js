import { gameState } from './game-state.js';
import {
  DISCOVERY_MILESTONES,
  FOLLOW_TARGET_MODES,
  READABILITY_MODES,
  SANDBOX_RECIPES,
  buildBondsSummary,
  buildEcosystemStory,
  buildObjectiveRail,
  buildScenarioResult,
  buildWorldPostcard,
  getCreatureEmotion,
  getLifeStageDisplay
} from './upgrade-data.js';

const STORAGE_PREFIX = 'creature-sandbox-upgrades';

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}:${key}`) || '') || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private contexts.
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    char =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]
  );
}

function randAround(center, radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;
  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance
  };
}

export class UpgradeController {
  constructor({
    world,
    camera,
    playableScenarios,
    sessionGoals,
    notifications,
    audio,
    moments,
    renderer,
    canvas,
    tools,
    uiController
  } = {}) {
    this.world = world;
    this.camera = camera;
    this.playableScenarios = playableScenarios;
    this.sessionGoals = sessionGoals;
    this.notifications = notifications;
    this.audio = audio;
    this.moments = moments;
    this.renderer = renderer;
    this.canvas = canvas;
    this.tools = tools;
    this.uiController = uiController;
    this.panel = null;
    this.lastUpdate = 0;
    this.discoveryJournal = readJson('journal', []);
    this.seedGallery = readJson('seed-gallery', []);
    this.nicknames = readJson('nicknames', {});
    this.activeReadabilityMode = readJson('readability-mode', 'normal');
    this.lastPostcard = null;
    this.lastBalanceProbe = null;
    this._lastPanelSignature = '';
  }

  init() {
    this.panel = document.getElementById('upgrade-panel');
    if (this.uiController) {
      this.uiController.upgradeController = this;
    }
    document.body.dataset.readabilityMode = this.activeReadabilityMode;

    window.addEventListener('creature:toggle-upgrades-panel', () => this.togglePanel());
    document.getElementById('btn-upgrade-close')?.addEventListener('click', () => this.setPanelVisible(false));
    document
      .getElementById('upgrade-postcard-export')
      ?.addEventListener('click', () => this.createPostcard({ announce: true }));
    document.getElementById('upgrade-save-seed')?.addEventListener('click', () => this.saveSeedEntry());
    this.panel?.addEventListener('click', event => {
      const button = event.target.closest('[data-upgrade-action]');
      if (!button) return;
      const action = button.dataset.upgradeAction;
      const value = button.dataset.value;
      if (action === 'recipe') this.applyRecipe(value);
      if (action === 'follow') this.setFollowMode(value);
      if (action === 'readability') this.setReadabilityMode(value);
      if (action === 'quick-action') this.runQuickAction(value);
      if (action === 'start-scenario') {
        this.startScenario(value);
        this.renderPanel();
        return;
      }
      if (action === 'focus-result') {
        this.focusScenarioResult();
        return;
      }
      if (action === 'nickname') {
        const creature = this.getSelectedCreature();
        const input = this.panel?.querySelector('#upgrade-nickname-input');
        if (creature && input) this.setNickname(creature.id, input.value);
      }
      this.renderPanel();
    });

    this.renderPanel();
  }

  serialize() {
    return {
      discoveryJournal: this.discoveryJournal,
      seedGallery: this.seedGallery.slice(0, 12),
      nicknames: this.nicknames,
      activeReadabilityMode: this.activeReadabilityMode,
      lastPostcard: this.lastPostcard,
      lastBalanceProbe: this.lastBalanceProbe
    };
  }

  restore(data = {}) {
    if (!data || typeof data !== 'object') return false;
    this.discoveryJournal = Array.isArray(data.discoveryJournal) ? data.discoveryJournal : this.discoveryJournal;
    this.seedGallery = Array.isArray(data.seedGallery) ? data.seedGallery : this.seedGallery;
    this.nicknames = data.nicknames && typeof data.nicknames === 'object' ? data.nicknames : this.nicknames;
    this.lastPostcard = data.lastPostcard || this.lastPostcard;
    this.lastBalanceProbe = data.lastBalanceProbe || this.lastBalanceProbe;
    if (data.activeReadabilityMode) this.setReadabilityMode(data.activeReadabilityMode, { announce: false });
    writeJson('journal', this.discoveryJournal);
    writeJson('seed-gallery', this.seedGallery);
    writeJson('nicknames', this.nicknames);
    return true;
  }

  update(dt = 0) {
    this.lastUpdate += dt;
    if (this.lastUpdate < 1) return;
    this.lastUpdate = 0;
    this.scanDiscoveries();
    this.updateObjectiveRail();
    this.renderPanel({ passive: true });
  }

  getSnapshot() {
    const playable = this.playableScenarios?.getSnapshot?.() ?? null;
    const goals = this.sessionGoals?.getGoals?.() ?? [];
    return {
      ecosystemStory: buildEcosystemStory(this.world, playable),
      objectiveRail: buildObjectiveRail(playable, goals),
      scenarioResult: buildScenarioResult(playable),
      recipes: SANDBOX_RECIPES.map(recipe => ({ id: recipe.id, label: recipe.label })),
      readabilityMode: this.activeReadabilityMode,
      readabilityModes: READABILITY_MODES.map(mode => mode.id),
      followModes: FOLLOW_TARGET_MODES.map(mode => mode.id),
      discoveryJournal: this.discoveryJournal.slice(0, 12),
      seedGallery: this.seedGallery.slice(0, 8),
      lastPostcard: this.lastPostcard,
      balanceProbe: this.lastBalanceProbe,
      scenarioHistory: this.getScenarioHistory()
    };
  }

  getCreaturePresentation(creature) {
    return {
      lifeStage: getLifeStageDisplay(creature),
      emotion: getCreatureEmotion(creature),
      nickname: this.nicknames?.[creature?.id] || null,
      bonds: buildBondsSummary(creature, this.world)
    };
  }

  buildPanelSignature() {
    const playable = this.playableScenarios?.getSnapshot?.() ?? null;
    const result = buildScenarioResult(playable);
    const selected = this.getSelectedCreature();
    const history = this.getScenarioHistory(3);
    const creatures = this.world?.creatures || [];
    const food = this.world?.food || [];
    const stress = creatures.length
      ? creatures.reduce((sum, creature) => sum + Number(creature?.needs?.stress || 0), 0) / creatures.length
      : 0;
    return JSON.stringify({
      selected: selected?.id || null,
      nickname: selected ? this.nicknames?.[selected.id] || '' : '',
      scenario: playable?.scenario?.id || null,
      scenarioState: playable?.state || null,
      result: result ? `${result.state}:${result.score}:${result.medal}` : null,
      history: history.map(item => `${item.scenarioId}:${item.score}:${item.medal}:${item.completedAt}`).join('|'),
      discoveries: this.discoveryJournal.length,
      seeds: this.seedGallery.length,
      readability: this.activeReadabilityMode,
      postcard: this.lastPostcard?.createdAt || null,
      balance: this.lastBalanceProbe?.checkedAt || null,
      aliveBucket: Math.round(creatures.filter(creature => creature?.alive !== false).length / 5),
      foodBucket: Math.round(food.length / 10),
      stressBucket: Math.round(stress / 5)
    });
  }

  getRailModeChip() {
    if (gameState.godModeActive) {
      const tool = String(gameState.godModeTool || 'food').replaceAll('_', ' ');
      return {
        id: 'god',
        label: `God: ${tool}`,
        icon: '✨'
      };
    }
    if (gameState.watchModeEnabled) {
      return {
        id: gameState.watchModeFollow ? 'follow' : 'watch',
        label: gameState.watchModeFollow ? 'Following' : 'Watch',
        icon: gameState.watchModeFollow ? '🎯' : '👁️'
      };
    }
    return null;
  }

  getWorldRhythmChip() {
    const environment = this.world?.environment;
    const season = environment?.getSeasonInfo?.() || {
      label: this.world?.currentSeason || 'Season',
      icon: '🌍'
    };
    const hour = Number(environment?.timeOfDay ?? this.world?.timeOfDay ?? 12);
    const timeLabel = hour < 5 || hour >= 21 ? 'Night' : hour < 8 ? 'Dawn' : hour >= 18 ? 'Dusk' : 'Day';
    const foodRate = environment?.getSeasonModifier?.('food');
    const foodLabel = Number.isFinite(foodRate) ? ` · Food ${Math.round(foodRate * 100)}%` : '';
    return {
      label: `${season.icon || '🌍'} ${season.label || season.name || 'Season'} · ${timeLabel}${foodLabel}`,
      shortLabel: `${season.icon || '🌍'} ${timeLabel}`
    };
  }

  getSelectedCreature() {
    const id = gameState.selectedId || gameState.pinnedId;
    if (id == null) return null;
    return (
      this.world?.getAnyCreatureById?.(id) || (this.world?.creatures || []).find(creature => creature.id === id) || null
    );
  }

  setNickname(creatureId, name) {
    if (!creatureId) return false;
    const clean = String(name || '')
      .trim()
      .slice(0, 28);
    if (clean) this.nicknames[creatureId] = clean;
    else delete this.nicknames[creatureId];
    writeJson('nicknames', this.nicknames);
    this.renderPanel();
    return true;
  }

  setReadabilityMode(modeId, { announce = true } = {}) {
    const mode = READABILITY_MODES.find(item => item.id === modeId) || READABILITY_MODES[0];
    this.activeReadabilityMode = mode.id;
    document.body.dataset.readabilityMode = mode.id;
    writeJson('readability-mode', mode.id);
    if (announce) this.notifications?.show?.(`View mode: ${mode.label}`, 'info', 1600);
  }

  runQuickAction(actionId) {
    if (actionId === 'paint_food') {
      this.tools?.setMode?.('food');
      this.uiController?.updateToolIndicator?.('food');
      this.notifications?.show?.('Food brush ready', 'info', 1200);
      return true;
    }

    if (actionId === 'calm_zone') {
      this.uiController?.setGodModeActive?.(true, { source: 'upgrade' });
      this.uiController?.setGodTool?.('calm', { source: 'upgrade', announce: true });
      return true;
    }

    if (actionId === 'watch_herd') {
      if (!gameState.watchModeEnabled) {
        this.uiController?.onWatchModeToggle?.();
        if (!gameState.watchModeEnabled) gameState.watchModeEnabled = true;
      }
      gameState.watchModeFollow = false;
      this.uiController?.updateWatchModeUI?.();
      this.notifications?.show?.('Watching the herd', 'info', 1200);
      return true;
    }

    return false;
  }

  setFollowMode(modeId) {
    const target = this.pickFollowTarget(modeId);
    if (!target) {
      this.notifications?.show?.('No matching creature to follow yet', 'warning', 1800);
      return null;
    }
    gameState.selectCreature(target.id);
    gameState.pinnedId = target.id;
    gameState.watchModeEnabled = true;
    gameState.watchModeFollow = true;
    if (this.camera) {
      this.camera.targetX = target.x;
      this.camera.targetY = target.y;
    }
    const mode = FOLLOW_TARGET_MODES.find(item => item.id === modeId);
    this.notifications?.show?.(
      `${mode?.icon || '👁️'} Following ${mode?.label || 'creature'} #${target.id}`,
      'info',
      1900
    );
    return target;
  }

  pickFollowTarget(modeId) {
    const creatures = (this.world?.creatures || []).filter(creature => creature?.alive !== false);
    if (!creatures.length) return null;
    if (modeId === 'youngest')
      return creatures.reduce((best, item) => (item.age < best.age ? item : best), creatures[0]);
    if (modeId === 'stressed') {
      return creatures.reduce((best, item) => {
        const stress = Number(item.needs?.stress ?? item.ecosystem?.stress ?? 0);
        const bestStress = Number(best.needs?.stress ?? best.ecosystem?.stress ?? 0);
        return stress > bestStress ? item : best;
      }, creatures[0]);
    }
    if (modeId === 'hunter') {
      return creatures.reduce((best, item) => {
        const score = (item.genes?.predator ? 10 : 0) + Number(item.stats?.kills ?? 0);
        const bestScore = (best.genes?.predator ? 10 : 0) + Number(best.stats?.kills ?? 0);
        return score > bestScore ? item : best;
      }, creatures[0]);
    }
    if (modeId === 'alpha') {
      return creatures.reduce((best, item) => {
        const itemScore =
          Number(item.age ?? 0) +
          Number(item.energy ?? 0) * 0.2 +
          Number(item.stats?.kills ?? 0) * 8 +
          Number(item.children?.length ?? 0) * 5;
        const bestScore =
          Number(best.age ?? 0) +
          Number(best.energy ?? 0) * 0.2 +
          Number(best.stats?.kills ?? 0) * 8 +
          Number(best.children?.length ?? 0) * 5;
        return itemScore > bestScore ? item : best;
      }, creatures[0]);
    }
    if (modeId === 'lineage' && gameState.lineageRootId) {
      return this.world?.getAnyCreatureById?.(gameState.lineageRootId) || null;
    }
    return creatures.find(item => !item.parentId) || creatures[0];
  }

  applyRecipe(recipeId) {
    const recipe = SANDBOX_RECIPES.find(item => item.id === recipeId);
    if (!recipe || !this.world) return false;
    const setup = recipe.setup;
    const center = { x: this.world.width * 0.5, y: this.world.height * 0.5 };
    const radius = recipeId === 'tiny_toybox' ? 280 : 560;

    this.world.reset?.();
    this.world.lineageTracker?.reset?.();
    if (Array.isArray(this.world.food)) this.world.food.length = 0;
    if (Array.isArray(this.world.corpses)) this.world.corpses.length = 0;
    this.world.sandbox?.clear?.();
    gameState.selectedId = null;
    gameState.pinnedId = null;

    for (const type of ['herbivore', 'omnivore', 'predator', 'aquatic', 'flying', 'burrowing']) {
      const count = setup[type] || 0;
      for (let index = 0; index < count; index++) {
        const pos = randAround(center, radius);
        this.world.spawnCreatureType?.(type, pos.x, pos.y);
      }
    }

    for (let index = 0; index < (setup.food || 0); index++) {
      const pos = randAround(center, radius * 1.1);
      this.world.addFood?.(pos.x, pos.y);
    }

    for (let index = 0; index < (setup.calmZones || 0); index++) {
      const pos = randAround(center, radius * 0.7);
      this.world.addCalmZone?.(pos.x, pos.y, 150, 35, 0.65);
    }

    (setup.props || []).forEach(type => {
      const pos = randAround(center, radius * 0.5);
      this.world.sandbox?.addProp?.(type, pos.x, pos.y);
    });

    if (this.camera) {
      this.camera.x = center.x;
      this.camera.y = center.y;
      this.camera.targetX = center.x;
      this.camera.targetY = center.y;
      this.camera.zoom = Math.max(this.camera.minZoom || 0.1, Math.min(0.72, this.camera.maxZoom || 3));
      this.camera.targetZoom = this.camera.zoom;
    }

    this.notifications?.show?.(`${recipe.icon} Loaded ${recipe.label}`, 'success', 2400);
    this.audio?.playUISound?.('success');
    this.lastPostcard = null;
    this.saveSeedEntry(recipe.label);
    this.renderPanel();
    return true;
  }

  createPostcard({ announce = false } = {}) {
    const playable = this.playableScenarios?.getSnapshot?.() ?? null;
    const seed = window.location.hash?.replace(/^#/, '') || '';
    const postcard = buildWorldPostcard({
      world: this.world,
      playableSnapshot: playable,
      moments: this.moments,
      seed
    });
    if (this.canvas?.toDataURL) {
      postcard.thumbnail = this.makeCanvasThumbnail();
    }
    this.lastPostcard = postcard;
    if (announce) this.notifications?.show?.('World postcard ready', 'success', 1800);
    this.renderPanel();
    return postcard;
  }

  makeCanvasThumbnail() {
    try {
      const source = this.canvas;
      const thumb = document.createElement('canvas');
      thumb.width = 240;
      thumb.height = 135;
      const ctx = thumb.getContext('2d');
      ctx.drawImage(source, 0, 0, thumb.width, thumb.height);
      return thumb.toDataURL('image/png', 0.72);
    } catch {
      return null;
    }
  }

  saveSeedEntry(label = 'Saved World') {
    const postcard = this.createPostcard();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      savedAt: new Date().toISOString(),
      seed: postcard.seed || window.location.hash?.replace(/^#/, '') || '',
      population: postcard.population,
      season: postcard.season,
      caption: postcard.caption
    };
    this.seedGallery = [entry, ...this.seedGallery].slice(0, 12);
    writeJson('seed-gallery', this.seedGallery);
    this.notifications?.show?.('Seed saved to local gallery', 'success', 1800);
    this.renderPanel();
    return entry;
  }

  runBalanceProbe(seconds = 180) {
    const story = buildEcosystemStory(this.world, this.playableScenarios?.getSnapshot?.());
    this.lastBalanceProbe = {
      seconds,
      sampledAt: new Date().toISOString(),
      status: story.level,
      metrics: story.metrics,
      pass: story.metrics.alive >= 20 && story.metrics.foodPerCreature >= 2 && story.metrics.stress < 75
    };
    this.renderPanel();
    return this.lastBalanceProbe;
  }

  getScenarioHistory(limit = 6) {
    const progress = this.playableScenarios?.progress || {};
    return Object.values(progress)
      .flatMap(entry => {
        const history = Array.isArray(entry?.history) ? entry.history : [];
        const runs = history.length ? history : entry?.lastResult ? [entry.lastResult] : [];
        const bestScore = Number(entry?.bestScore ?? Math.max(0, ...runs.map(item => Number(item?.score || 0))));
        const bestSeconds = Number(entry?.bestSeconds ?? 0) || null;
        const completions = Number(entry?.completions || runs.length || 0);
        return runs.map((result, index) => {
          const score = Number(result?.score || 0);
          const seconds = Number(result?.seconds || 0);
          const scoreDelta = score - bestScore;
          const isBestScore = score >= bestScore;
          const timeDelta = bestSeconds && seconds ? seconds - bestSeconds : null;
          return {
            ...result,
            bestScore,
            bestSeconds,
            completions,
            scoreDelta,
            timeDelta,
            isBestScore,
            historyIndex: index + 1
          };
        });
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
      .slice(0, limit);
  }

  startScenario(id) {
    const snapshot = this.playableScenarios?.startScenario?.(id, { announce: true }) ?? null;
    this.uiController?.updateSessionMetaVisibility?.();
    this.uiController?.renderPlayableDirector?.(snapshot);
    return snapshot;
  }

  buildActionCards(story) {
    const cards = [
      {
        id: 'paint_food',
        label: story.metrics.foodPerCreature < 3 ? 'Paint Food' : 'Feed Cluster',
        detail: story.metrics.foodPerCreature < 3 ? 'Food pressure is the next fix.' : 'Top up the busiest herd.',
        icon: '🌿'
      },
      {
        id: 'calm_zone',
        label: 'Calm Zone',
        detail: story.metrics.stress > 55 ? 'Stress is high enough to intervene.' : 'Prepare a soft landing area.',
        icon: '🫧'
      },
      {
        id: 'watch_herd',
        label: 'Watch Herd',
        detail: 'Switch into the quieter nature-guide view.',
        icon: '👁️'
      }
    ];
    return cards
      .map(
        card => `
      <button class="upgrade-card action-card" data-upgrade-action="quick-action" data-value="${escapeHtml(card.id)}">
        <span>${escapeHtml(card.icon)}</span><strong>${escapeHtml(card.label)}</strong><em>${escapeHtml(card.detail)}</em>
      </button>
    `
      )
      .join('');
  }

  scanDiscoveries() {
    const known = new Set(this.discoveryJournal.map(item => item.id));
    const creatures = this.world?.creatures || [];
    const moments = this.moments?.moments || [];
    const checks = {
      first_birth: () =>
        Number(this.moments?.summary?.births ?? 0) > 0 || creatures.some(creature => creature.parentId),
      first_elder: () => creatures.some(creature => creature.ageStage === 'elder' || creature.lifeStage === 'elder'),
      first_mutation: () =>
        creatures.some(creature => (creature.disorders || []).length || creature.rareMutations?.length),
      first_hunt: () =>
        creatures.some(creature => Number(creature.stats?.kills ?? 0) > 0) ||
        moments.some(moment => String(moment.type).includes('hunt')),
      first_migration: () => moments.some(moment => String(moment.type).includes('migration')),
      first_scenario_complete: () => this.playableScenarios?.getSnapshot?.()?.state === 'complete'
    };

    for (const milestone of DISCOVERY_MILESTONES) {
      if (known.has(milestone.id)) continue;
      if (checks[milestone.id]?.()) {
        this.discoveryJournal.unshift({
          ...milestone,
          worldTime: Number(this.world?.t?.toFixed?.(1) ?? this.world?.t ?? 0),
          unlockedAt: new Date().toISOString()
        });
        known.add(milestone.id);
      }
    }
    this.discoveryJournal = this.discoveryJournal.slice(0, 24);
    writeJson('journal', this.discoveryJournal);
  }

  updateObjectiveRail() {
    const rail = document.getElementById('objective-rail');
    if (!rail) return;
    const story = buildEcosystemStory(this.world, this.playableScenarios?.getSnapshot?.());
    const objective = buildObjectiveRail(
      this.playableScenarios?.getSnapshot?.(),
      this.sessionGoals?.getGoals?.() ?? []
    );
    const modeChip = this.getRailModeChip();
    const rhythmChip = this.getWorldRhythmChip();
    rail.dataset.level = story.level;
    rail.dataset.mode = modeChip?.id || 'none';
    rail.innerHTML = `
      <span class="objective-icon">${escapeHtml(objective.icon)}</span>
      <span class="objective-copy">
        <strong>${escapeHtml(objective.title)}</strong>
        <em>${escapeHtml(objective.action)}</em>
      </span>
      <span class="objective-status">
        ${modeChip ? `<span class="objective-mode">${escapeHtml(modeChip.icon)} ${escapeHtml(modeChip.label)}</span>` : ''}
        <span class="objective-progress">${Math.round(objective.progress)}%</span>
        <span class="objective-world" data-short="${escapeHtml(rhythmChip.shortLabel)}">${escapeHtml(rhythmChip.label)}</span>
      </span>
    `;
  }

  togglePanel() {
    this.setPanelVisible(this.panel?.classList.contains('hidden'));
  }

  setPanelVisible(visible, { focusResult = false } = {}) {
    if (!this.panel) return;
    if (visible) {
      this.uiController?.closeMajorPanels?.('upgrade-panel');
      if (gameState.godModeActive) {
        this.uiController?.setGodModeActive?.(false, { source: 'upgrade-panel' });
      }
    }
    this.panel.classList.toggle('hidden', !visible);
    this.panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) {
      this.renderPanel();
      if (focusResult) this.focusScenarioResult({ smooth: false });
    }
  }

  focusScenarioResult({ smooth = true } = {}) {
    const target = this.panel?.querySelector('#upgrade-scenario-result');
    if (!target) return false;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        block: 'start',
        behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto'
      });
      target.classList.add('result-focused');
      window.setTimeout(() => target.classList.remove('result-focused'), 900);
    });
    return true;
  }

  renderPanel({ passive = false } = {}) {
    if (!this.panel) return;
    if (passive && this.panel.classList.contains('hidden')) return;
    const panelSignature = this.buildPanelSignature();
    if (passive && panelSignature === this._lastPanelSignature) return;
    const story = buildEcosystemStory(this.world, this.playableScenarios?.getSnapshot?.());
    const result = buildScenarioResult(this.playableScenarios?.getSnapshot?.());
    const selected = this.getSelectedCreature();
    const selectedPresentation = selected ? this.getCreaturePresentation(selected) : null;
    const nickname = selected ? this.nicknames?.[selected.id] || '' : '';
    const recipeMarkup = SANDBOX_RECIPES.map(
      recipe => `
      <button class="upgrade-card" data-upgrade-action="recipe" data-value="${escapeHtml(recipe.id)}">
        <span>${escapeHtml(recipe.icon)}</span><strong>${escapeHtml(recipe.label)}</strong><em>${escapeHtml(recipe.description)}</em>
        <small>${Number(recipe.setup?.herbivore || 0) + Number(recipe.setup?.omnivore || 0) + Number(recipe.setup?.predator || 0) + Number(recipe.setup?.aquatic || 0) + Number(recipe.setup?.flying || 0) + Number(recipe.setup?.burrowing || 0)} creatures · ${Number(recipe.setup?.food || 0)} food</small>
      </button>
    `
    ).join('');
    const followMarkup = FOLLOW_TARGET_MODES.map(
      mode => `
      <button class="chip" data-upgrade-action="follow" data-value="${escapeHtml(mode.id)}">${escapeHtml(mode.icon)} ${escapeHtml(mode.label)}</button>
    `
    ).join('');
    const modeMarkup = READABILITY_MODES.map(
      mode => `
      <button class="chip ${this.activeReadabilityMode === mode.id ? 'active' : ''}" data-upgrade-action="readability" data-value="${escapeHtml(mode.id)}">${escapeHtml(mode.label)}</button>
    `
    ).join('');
    const journalMarkup = this.discoveryJournal.length
      ? this.discoveryJournal
        .slice(0, 6)
        .map(
          item =>
            `<li>${escapeHtml(item.icon)} <strong>${escapeHtml(item.label)}</strong><span>${Math.round(item.worldTime || 0)}s</span></li>`
        )
        .join('')
      : '<li class="muted">Discoveries will appear as the ecosystem develops.</li>';
    const seedMarkup = this.seedGallery.length
      ? this.seedGallery
        .slice(0, 5)
        .map(
          item =>
            `<li><strong>${escapeHtml(item.label)}</strong><span>${Number(item.population) || 0} creatures · ${escapeHtml(item.season)}</span></li>`
        )
        .join('')
      : '<li class="muted">Save favorite worlds to build a local seed gallery.</li>';
    const scenarioHistory = this.getScenarioHistory();
    const historyMarkup = scenarioHistory.length
      ? scenarioHistory
        .map(
          item => `
        <li class="scenario-history-item">
          <span class="scenario-history-main">
            <strong>${escapeHtml(item.icon || '🎯')} ${escapeHtml(item.scenarioName || 'Scenario')}</strong>
            <em>${escapeHtml(item.medal || 'Run')} · ${Number(item.score || 0)} · ${Math.round(Number(item.seconds || 0) / 60)}m</em>
          </span>
          <span class="scenario-history-meta">
            ${Number(item.alive || 0)} alive · ${Number(item.food || 0)} food · ${Number(item.stress || 0)} stress
            <span class="scenario-history-badge">${item.isBestScore ? 'Best' : `${item.scoreDelta > 0 ? '+' : ''}${Number(item.scoreDelta || 0)} vs best`}</span>
            ${item.timeDelta == null ? '' : `<span class="scenario-history-badge">${item.timeDelta <= 0 ? 'Fastest' : `+${Math.round(item.timeDelta)}s`}</span>`}
          </span>
          <button class="chip ghost" data-upgrade-action="start-scenario" data-value="${escapeHtml(item.scenarioId)}">Retry</button>
        </li>
      `
        )
        .join('')
      : '<li class="muted">Completed runs will appear here with score, medal, and retry controls.</li>';
    const postcard =
      this.lastPostcard ||
      buildWorldPostcard({
        world: this.world,
        playableSnapshot: this.playableScenarios?.getSnapshot?.(),
        moments: this.moments,
        seed: window.location.hash?.replace(/^#/, '') || ''
      });
    const scenarioResultMarkup = result
      ? `
      <div class="scenario-result-card" data-state="${escapeHtml(result.state)}">
        <div class="scenario-result-head">
          <span>${escapeHtml(result.label)}</span>
          <strong>${escapeHtml(result.medal)} · ${Number(result.score) || 0}</strong>
        </div>
        <p>${escapeHtml(result.summary)}</p>
        <div class="scenario-result-stats">
          ${(result.statCards || [])
    .map(
      item => `
            <span data-tone="${escapeHtml(item.tone)}">
              <em>${escapeHtml(item.label)}</em>
              <strong>${escapeHtml(item.value)}</strong>
            </span>
          `
    )
    .join('')}
        </div>
        <div class="scenario-result-foot">
          <span>${result.discoveries?.length ? escapeHtml(result.discoveries.join(', ')) : 'No special discoveries yet'}</span>
          <em>${escapeHtml(result.nextAction)}</em>
        </div>
        ${result.scenarioId ? `<button class="chip ghost scenario-result-retry" data-upgrade-action="start-scenario" data-value="${escapeHtml(result.scenarioId)}">Retry ${escapeHtml(result.scenarioName || 'Scenario')}</button>` : ''}
      </div>
    `
      : '<p class="muted">Start a scenario to earn a medal summary.</p>';

    const body = this.panel.querySelector('#upgrade-panel-body');
    if (!body) return;
    body.innerHTML = `
      <section class="upgrade-section upgrade-story" data-level="${story.level}">
        <h3>${escapeHtml(story.headline)}</h3>
        <p>${escapeHtml(story.action)}</p>
        <div class="upgrade-metrics">
          <span>${story.metrics.alive} alive</span>
          <span>${story.metrics.food} food</span>
          <span>${story.metrics.stress} stress</span>
        </div>
        ${result ? '<div class="upgrade-story-actions"><button class="chip" data-upgrade-action="focus-result">🏁 Result</button></div>' : ''}
      </section>
      <section id="upgrade-scenario-result" class="upgrade-section upgrade-result-section" tabindex="-1">
        <h3>Scenario Result</h3>
        ${scenarioResultMarkup}
      </section>
      <section class="upgrade-section">
        <h3>Run History</h3>
        <ul class="upgrade-list scenario-history-list">${historyMarkup}</ul>
      </section>
      <section class="upgrade-section">
        <h3>Action Cards</h3>
        <div class="upgrade-grid">${this.buildActionCards(story)}</div>
      </section>
      <section class="upgrade-section">
        <h3>Favorite Creature</h3>
        ${
  selected
    ? `
          <div class="upgrade-selected">
            <strong>#${selected.id} · ${escapeHtml(selectedPresentation.lifeStage.icon)} ${escapeHtml(selectedPresentation.lifeStage.label)} · ${escapeHtml(selectedPresentation.emotion.icon)} ${escapeHtml(selectedPresentation.emotion.label)}</strong>
            <span>${escapeHtml(selectedPresentation.bonds.label)}</span>
          </div>
          <div class="upgrade-nickname">
            <input id="upgrade-nickname-input" type="text" maxlength="28" value="${escapeHtml(nickname)}" aria-label="Creature nickname" placeholder="Nickname this creature" />
            <button class="chip" data-upgrade-action="nickname">Save</button>
          </div>
        `
    : '<p class="muted">Select or pin a creature to nickname it and review its bonds.</p>'
}
      </section>
      <section class="upgrade-section">
        <h3>Recipe Presets</h3>
        <div class="upgrade-grid">${recipeMarkup}</div>
      </section>
      <section class="upgrade-section">
        <h3>Follow Camera</h3>
        <div class="chip-row">${followMarkup}</div>
      </section>
      <section class="upgrade-section">
        <h3>Readability</h3>
        <div class="chip-row">${modeMarkup}</div>
      </section>
      <section class="upgrade-section two-col">
        <div><h3>Discovery Journal</h3><ul class="upgrade-list">${journalMarkup}</ul></div>
        <div><h3>Seed Gallery</h3><ul class="upgrade-list">${seedMarkup}</ul></div>
      </section>
      <section class="upgrade-section">
        <h3>World Postcard</h3>
        <p>${escapeHtml(postcard.caption)}</p>
        <div class="upgrade-metrics">
          <span>${Number(postcard.population) || 0} creatures</span>
          <span>${escapeHtml(postcard.season)}</span>
          <span>${escapeHtml(postcard.strongestEvent)}</span>
        </div>
      </section>
    `;
    this._lastPanelSignature = panelSignature;
  }
}
