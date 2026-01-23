import { eventSystem, GameEvents } from './event-system.js';
import { clamp } from './utils.js';

export class MomentsSystem {
  constructor({ world, camera, notifications } = {}) {
    this.world = world;
    this.camera = camera;
    this.notifications = notifications;
    this.moments = [];
    this.maxMoments = 60;
    this.cooldowns = new Map();
    this.summary = {
      births: 0,
      deaths: 0,
      peakPopulation: world?.creatures?.length ?? 0,
      peakStress: 0,
      peakStressAt: null,
      migrations: 0,
      largestMigration: 0
    };
    this.lastSummaryStoredAt = 0;
    this.panel = null;
    this.listEl = null;
    this.summaryEl = null;
    this._listBound = false;
    this._migrationCooldowns = new Map();

    this._bindEvents();
  }

  bindDom({ panel, listEl, summaryEl, closeBtn } = {}) {
    if (panel) this.panel = panel;
    if (listEl) this.listEl = listEl;
    if (summaryEl) this.summaryEl = summaryEl;

    if (closeBtn && !closeBtn.dataset.boundMoments) {
      closeBtn.addEventListener('click', () => this.closePanel());
      closeBtn.dataset.boundMoments = 'true';
    }

    if (this.listEl && !this._listBound) {
      this.listEl.addEventListener('click', (event) => {
        const row = event.target.closest('.moment-row');
        if (!row) return;
        const id = row.dataset.momentId;
        const moment = this.moments.find(item => item.id === id);
        if (!moment || moment.x == null || moment.y == null) return;
        if (typeof this.camera?.startTravel === 'function') {
          this.camera.startTravel(moment.x, moment.y, 1.3);
        } else if (this.camera?.focusOn) {
          this.camera.focusOn(moment.x, moment.y);
        }
      });
      this._listBound = true;
    }

    this.render();
  }

  togglePanel() {
    if (!this.panel) return;
    if (this.panel.classList.contains('hidden')) {
      this.openPanel();
    } else {
      this.closePanel();
    }
  }

  openPanel() {
    if (!this.panel) return;
    this.panel.classList.remove('hidden');
    this.panel.setAttribute('aria-hidden', 'false');
    this.render();
  }

  closePanel() {
    if (!this.panel) return;
    this.panel.classList.add('hidden');
    this.panel.setAttribute('aria-hidden', 'true');
  }

  logMoment({ type, icon, text, x, y, worldTime }) {
    const now = worldTime ?? this.world?.t ?? 0;
    if (!this._cooldownReady(type, now)) return;

    const entry = {
      id: `moment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      icon,
      text,
      x,
      y,
      worldTime: now
    };

    this.moments.unshift(entry);
    if (this.moments.length > this.maxMoments) {
      this.moments.pop();
    }
    this.render();
  }

  render() {
    if (this.panel && this.panel.classList.contains('hidden')) return;
    this.renderList();
    this.renderSummary();
  }

  renderList() {
    if (!this.listEl) return;
    if (!this.moments.length) {
      this.listEl.innerHTML = '<div class="muted tiny">Moments will appear as the world unfolds.</div>';
      return;
    }

    this.listEl.innerHTML = this.moments.map((moment) => `
      <button class="moment-row" data-moment-id="${moment.id}" type="button" aria-label="${moment.text}">
        <span class="moment-icon">${moment.icon || '✨'}</span>
        <span class="moment-text">${moment.text}</span>
        <span class="moment-time">${this._formatTime(moment.worldTime)}</span>
      </button>
    `).join('');
  }

  renderSummary() {
    if (!this.summaryEl) return;
    const summary = this.summary;
    const stressLabel = summary.peakStressAt ? `${Math.round(summary.peakStress)} @ ${this._formatTime(summary.peakStressAt)}` : '—';

    this.summaryEl.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item"><span>Peak Pop</span><strong>${summary.peakPopulation}</strong></div>
        <div class="summary-item"><span>Births</span><strong>${summary.births}</strong></div>
        <div class="summary-item"><span>End-of-life</span><strong>${summary.deaths}</strong></div>
        <div class="summary-item"><span>Peak Stress</span><strong>${stressLabel}</strong></div>
        <div class="summary-item"><span>Biggest Migration</span><strong>${summary.largestMigration || 0}</strong></div>
      </div>
    `;

    const now = performance.now();
    if (now - this.lastSummaryStoredAt > 8000) {
      this.lastSummaryStoredAt = now;
      this.storeSummary();
    }
  }

  storeSummary() {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        ...this.summary,
        storedAt: Date.now()
      };
      window.localStorage?.setItem('creature-sim-last-summary', JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to store session summary:', error);
    }
  }

  updateStatsFromWorld(world) {
    if (!world) return;
    const pop = world.creatures?.length ?? 0;
    if (pop > this.summary.peakPopulation) {
      this.summary.peakPopulation = pop;
    }
    this._detectMigration(world);
  }

  _detectMigration(world) {
    const patches = world.ecosystem?.foodPatches || [];
    if (!patches.length) return;
    const now = world.t ?? 0;
    const minGroup = 5;
    const minSpeed = 8;
    const stockThreshold = 1.2;
    const radiusMultiplier = 1.1;

    for (const patch of patches) {
      if (!patch) continue;
      if (patch.stock > Math.max(stockThreshold, patch.maxStock * 0.25)) continue;
      if (patch.depletedTimer <= 0) continue;

      const lastLogged = this._migrationCooldowns.get(patch.id) ?? -Infinity;
      if (now - lastLogged < 18) continue;

      const crowd = world.creatureManager?.queryCreatures
        ? world.creatureManager.queryCreatures(patch.x, patch.y, patch.radius * radiusMultiplier)
        : [];
      if (crowd.length < minGroup) continue;

      let moving = 0;
      let movingAway = 0;
      let avgX = 0;
      let avgY = 0;
      for (const creature of crowd) {
        if (!creature || !creature.alive) continue;
        avgX += creature.x;
        avgY += creature.y;
        const vx = creature.vx ?? 0;
        const vy = creature.vy ?? 0;
        const speed = Math.hypot(vx, vy);
        if (speed < minSpeed) continue;
        moving++;
        const dx = creature.x - patch.x;
        const dy = creature.y - patch.y;
        if (dx * vx + dy * vy > 0) {
          movingAway++;
        }
      }

      if (moving < minGroup) continue;
      if (movingAway / moving < 0.6) continue;

      avgX /= crowd.length;
      avgY /= crowd.length;
      const count = crowd.length;
      this._migrationCooldowns.set(patch.id, now);
      this.summary.migrations += 1;
      this.summary.largestMigration = Math.max(this.summary.largestMigration, count);

      const payload = {
        x: avgX,
        y: avgY,
        count,
        patchId: patch.id,
        worldTime: now
      };
      eventSystem.emit(GameEvents.WORLD_MIGRATION_START, payload);
      this.logMoment({
        type: GameEvents.WORLD_MIGRATION_START,
        icon: '🧭',
        text: `A migration started (${count})`,
        x: avgX,
        y: avgY,
        worldTime: now
      });
    }
  }

  _bindEvents() {
    eventSystem.on(GameEvents.CREATURE_BORN, (data) => {
      const creature = data?.creature;
      if (!creature) return;
      this.summary.births += 1;
      this.logMoment({
        type: GameEvents.CREATURE_BORN,
        icon: '🐣',
        text: 'A baby was born',
        x: creature.x,
        y: creature.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.CREATURE_DIED, (data) => {
      const creature = data?.creature;
      if (!creature) return;
      this.summary.deaths += 1;
      this.logMoment({
        type: GameEvents.CREATURE_DIED,
        icon: '🌙',
        text: 'A lineage ended',
        x: creature.x,
        y: creature.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.CREATURE_EAT, (data) => {
      if (!data?.hungry || !data.creature) return;
      const creature = data.creature;
      this.logMoment({
        type: GameEvents.CREATURE_EAT,
        icon: '🍃',
        text: 'A hungry creature ate',
        x: creature.x,
        y: creature.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.CREATURE_BOND, (data) => {
      const creature = data?.creature;
      if (!creature) return;
      this.logMoment({
        type: GameEvents.CREATURE_BOND,
        icon: '💞',
        text: 'A mating bond formed',
        x: creature.x,
        y: creature.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.CREATURE_PANIC, (data) => {
      const creature = data?.creature;
      if (!creature) return;
      const stress = clamp(Number(data?.stress ?? creature.ecosystem?.stress ?? 0), 0, 100);
      if (stress > this.summary.peakStress) {
        this.summary.peakStress = stress;
        this.summary.peakStressAt = data?.worldTime ?? this.world?.t ?? 0;
      }
      this.logMoment({
        type: GameEvents.CREATURE_PANIC,
        icon: '😱',
        text: 'A panic spike hit',
        x: creature.x,
        y: creature.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.CREATURE_OVERCROWD, (data) => {
      if (!data) return;
      this.logMoment({
        type: GameEvents.CREATURE_OVERCROWD,
        icon: '👥',
        text: 'Overcrowding surged',
        x: data.x,
        y: data.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.WORLD_FOOD_SCARCITY, (data) => {
      if (!data) return;
      const zone = this._zoneLabel(data.patchId);
      this.logMoment({
        type: GameEvents.WORLD_FOOD_SCARCITY,
        icon: '🥀',
        text: `Food ran low in ${zone}`,
        x: data.x,
        y: data.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.PREDATOR_LITE_CHASE, (data) => {
      if (!data) return;
      this.logMoment({
        type: GameEvents.PREDATOR_LITE_CHASE,
        icon: '🏃',
        text: 'A chase scattered the herd',
        x: data.x,
        y: data.y,
        worldTime: data?.worldTime
      });
    });

    eventSystem.on(GameEvents.WORLD_UPDATE, (data) => {
      const world = data?.world ?? this.world;
      this.updateStatsFromWorld(world);
    });
  }

  _cooldownReady(type, worldTime) {
    const now = worldTime ?? this.world?.t ?? 0;
    const cooldown = this._cooldownFor(type);
    const last = this.cooldowns.get(type) ?? -Infinity;
    if (now - last < cooldown) return false;
    this.cooldowns.set(type, now);
    return true;
  }

  _cooldownFor(type) {
    switch (type) {
      case GameEvents.CREATURE_BORN:
        return 4;
      case GameEvents.CREATURE_DIED:
        return 5;
      case GameEvents.CREATURE_EAT:
        return 5;
      case GameEvents.CREATURE_BOND:
        return 6;
      case GameEvents.CREATURE_PANIC:
        return 6;
      case GameEvents.CREATURE_OVERCROWD:
        return 8;
      case GameEvents.WORLD_FOOD_SCARCITY:
        return 12;
      case GameEvents.WORLD_MIGRATION_START:
        return 12;
      case GameEvents.PREDATOR_LITE_CHASE:
        return 7;
      default:
        return 6;
    }
  }

  _zoneLabel(patchId) {
    if (!patchId) return 'a zone';
    const charCode = 65 + (patchId % 26);
    return `Zone ${String.fromCharCode(charCode)}`;
  }

  _formatTime(worldTime = 0) {
    const total = Math.max(0, Math.floor(worldTime));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
}

export default MomentsSystem;
