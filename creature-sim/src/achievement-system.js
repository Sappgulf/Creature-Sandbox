// Achievement System - Goals, progression, XP, and challenges

import { eventSystem, GameEvents } from './event-system.js';
import { configManager } from './config-manager.js';
import { ACHIEVEMENTS_DATA, ACHIEVEMENTS_DATA_VERSION } from './achievements-data.js';

const SAVE_KEY = 'achievements';
const SAVE_VERSION = 2;

export class AchievementSystem {
  constructor() {
    this.achievements = new Map();
    this.unlocked = new Set();
    this.progress = new Map(); // id -> progress state
    this.xp = 0;
    this.level = 1;
    this.notificationStylesInjected = false;
    this.enabled = true;
    this.notificationsEnabled = true;
    this.autoSaveEnabled = true;
    this.xpMultiplier = 1.0;

    this._subscriptions = [];
    this._lastWorldTime = null;
    
    this.refreshConfig();
    configManager.onChange('achievements', () => this.refreshConfig());

    this.defineAchievements();
    this.loadProgress();
    this.setupEventListeners();
  }

  refreshConfig() {
    this.enabled = !!configManager.get('achievements', 'enabled', true);
    this.notificationsEnabled = !!configManager.get('achievements', 'notifications', true);
    this.autoSaveEnabled = !!configManager.get('achievements', 'autoSave', true);
    const multiplier = Number(configManager.get('achievements', 'rewards.xpMultiplier', 1.0));
    this.xpMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1.0;
  }

  defineAchievements() {
    for (const def of ACHIEVEMENTS_DATA) {
      if (!def) continue;

      if (Array.isArray(def.tiers) && def.tiers.length) {
        for (const tier of def.tiers) {
          const derived = {
            ...def,
            ...tier,
            id: tier.id || `${def.id}_${tier.suffix || tier.goal || ''}`.replace(/_+$/, ''),
            name: tier.name || def.name,
            description: tier.description || def.description,
            icon: tier.icon || def.icon,
            xp: tier.xp ?? def.xp ?? 0,
            type: tier.type || def.type || 'milestone',
            trigger: tier.trigger || def.trigger,
            goal: tier.goal ?? def.goal,
            repeatable: tier.repeatable ?? def.repeatable,
            secret: tier.secret ?? def.secret,
            sustain: tier.sustain || def.sustain,
            eventPredicate: tier.eventPredicate || def.eventPredicate,
            check: tier.check || def.check,
            tiers: undefined
          };
          this.addAchievement(derived);
        }
      } else {
        this.addAchievement(def);
      }
    }
  }

  validateDefinition(def) {
    const issues = [];
    if (!def.id || typeof def.id !== 'string') issues.push('id');
    if (def.name !== undefined && typeof def.name !== 'string') issues.push('name');
    if (def.description !== undefined && typeof def.description !== 'string') issues.push('description');
    if (def.icon !== undefined && typeof def.icon !== 'string') issues.push('icon');
    if (def.type !== undefined && typeof def.type !== 'string') issues.push('type');
    if (def.xp !== undefined && typeof def.xp !== 'number') issues.push('xp');
    if (def.trigger !== undefined && typeof def.trigger !== 'string') issues.push('trigger');
    if (def.goal !== undefined && typeof def.goal !== 'number') issues.push('goal');
    if (def.sustain !== undefined && typeof def.sustain !== 'object') issues.push('sustain');

    if (issues.length) {
      console.warn(`Invalid achievement definition for ${def.id || '<unknown>'}:`, issues, def);
    }
  }

  addAchievement(def) {
    this.validateDefinition(def);

    const goal =
      Number(def.goal) ||
      (def.sustain?.duration ? Number(def.sustain.duration) : null);

    this.achievements.set(def.id, {
      ...def,
      xp: Number(def.xp) || 0,
      unlocked: false,
      unlockedAt: null
    });

    this.progress.set(def.id, {
      current: 0,
      goal,
      startedAt: null,
      lastUpdatedAt: null,
      timesUnlocked: 0
    });
  }

  setupEventListeners() {
    // Kill events (predation)
    if (GameEvents.CREATURE_KILLED) {
      this._subscriptions.push(
        eventSystem.on(GameEvents.CREATURE_KILLED, (event) => {
          this.handleTrigger('kill', 1, event);
        })
      );
    }

    // Birth events (future-proof)
    this._subscriptions.push(
      eventSystem.on(GameEvents.CREATURE_BORN, (event) => {
        this.handleTrigger('birth', 1, event);
      })
    );

    // God mode actions
    if (GameEvents.GOD_MODE_ACTION) {
      this._subscriptions.push(
        eventSystem.on(GameEvents.GOD_MODE_ACTION, (event) => {
          this.handleTrigger('god_action', 1, event);
        })
      );
    }

    // Direct XP awards (campaign rewards, etc.)
    if (GameEvents.ACHIEVEMENT_XP) {
      this._subscriptions.push(
        eventSystem.on(GameEvents.ACHIEVEMENT_XP, (event) => {
          this.awardXP(event?.amount);
        })
      );
    }

    // World update (state + sustain checks)
    this._subscriptions.push(
      eventSystem.on(GameEvents.WORLD_UPDATE, (event) => {
        const world = event?.world;
        const context = event?.context || null;
        if (world) this.update(world, context);
      })
    );
  }

  /**
   * Update method - can be called per-frame, but work is throttled by world time.
   * @param {Object} world - The world object
   * @param {Object|any} trackerOrContext - Optional lineage tracker or context object
   */
  update(world, trackerOrContext = null) {
    if (!world || !this.enabled) return;

    // Back-compat: if second arg isn't an object, treat it as tracker
    const context =
      trackerOrContext &&
      typeof trackerOrContext === 'object' &&
      !Array.isArray(trackerOrContext)
        ? trackerOrContext
        : { tracker: trackerOrContext };

    const tracker =
      context.tracker ||
      context.lineageTracker ||
      world.lineageTracker ||
      null;
    const analytics = context.analytics || null;

    const ctx = { ...context, tracker, analytics };

    const nowT = Number(world.t) || 0;
    const dt =
      this._lastWorldTime == null ? 0 : Math.max(0, nowT - this._lastWorldTime);
    this._lastWorldTime = nowT;

    this.checkState(world, ctx, dt);
  }

  checkState(world, ctx, dt) {
    if (!this.enabled) return;
    this.updateSustainProgress(world, ctx, dt);

    for (const [id, achievement] of this.achievements) {
      if (!achievement || achievement.unlocked) continue;

      // Trigger-based checks that rely on world snapshot
      if (achievement.trigger === 'population' && achievement.goal) {
        const pop = world.creatures?.length || 0;
        this.setProgress(id, pop, { world, ctx });
      }

      if (achievement.check) {
        let shouldUnlock = false;
        try {
          shouldUnlock = achievement.check(world, ctx.tracker || null, ctx);
        } catch (e) {
          console.warn(`Achievement check failed for ${id}:`, e);
        }
        if (shouldUnlock) {
          this.unlock(id, { world, ctx });
        }
      }
    }
  }

  updateSustainProgress(world, ctx, dt) {
    if (!this.enabled) return;
    if (!dt) return;

    for (const [id, achievement] of this.achievements) {
      if (!achievement?.sustain || achievement.unlocked) continue;

      const sustain = achievement.sustain;

      if (sustain.key === 'speciesTypes') {
        const types = this.countSpeciesTypes(world);
        if (types >= (sustain.min || 1)) {
          this.incrementProgress(id, dt, { world, ctx });
        } else {
          this.resetProgress(id);
        }
      }
    }
  }

  countSpeciesTypes(world) {
    const creatures = world?.creatures || [];
    const set = new Set();

    if (world.ecosystem?.getCreatureSpeciesKey) {
      for (const c of creatures) {
        if (!c) continue;
        set.add(world.ecosystem.getCreatureSpeciesKey(c));
      }
      return set.size;
    }

    for (const c of creatures) {
      if (!c?.genes) continue;
      const diet = c.genes.diet ?? (c.genes.predator ? 1.0 : 0.0);
      if (diet < 0.3) set.add('herbivore');
      else if (diet > 0.7) set.add('predator');
      else set.add('omnivore');
    }

    return set.size;
  }

  handleTrigger(trigger, amount, event) {
    if (!this.enabled) return;
    for (const [id, achievement] of this.achievements) {
      if (!achievement || achievement.unlocked) continue;
      if (achievement.trigger !== trigger) continue;
      if (achievement.eventPredicate) {
        let matches = false;
        try {
          matches = achievement.eventPredicate(event);
        } catch (e) {
          console.warn(`Achievement event predicate failed for ${id}:`, e);
          matches = false;
        }
        if (!matches) continue;
      }
      this.incrementProgress(id, amount, { event });
    }
  }

  setProgress(id, value, meta = {}) {
    const prog = this.progress.get(id);
    const achievement = this.achievements.get(id);
    if (!prog || !achievement) return;

    const goal = prog.goal || Number(achievement.goal) || 0;
    if (goal) prog.goal = goal;

    const next = Math.max(0, Number(value) || 0);
    if (next === prog.current) return;

    prog.current = next;
    prog.lastUpdatedAt = Date.now();
    if (!prog.startedAt) prog.startedAt = prog.lastUpdatedAt;

    this.emitProgress(id);

    if (goal && prog.current >= goal) {
      this.unlock(id, { world: meta.world, ctx: meta.ctx, event: meta.event });
    }
  }

  incrementProgress(id, delta, meta = {}) {
    const prog = this.progress.get(id);
    const achievement = this.achievements.get(id);
    if (!prog || !achievement) return;

    const goal =
      prog.goal ||
      Number(achievement.goal) ||
      Number(achievement.sustain?.duration) ||
      0;
    if (goal) prog.goal = goal;

    const prev = prog.current;
    const next = Math.max(0, prev + (Number(delta) || 0));
    if (next === prev) return;

    prog.current = next;
    prog.lastUpdatedAt = Date.now();
    if (!prog.startedAt) prog.startedAt = prog.lastUpdatedAt;

    this.emitProgress(id);

    if (goal && prog.current >= goal) {
      this.unlock(id, { world: meta.world, ctx: meta.ctx, event: meta.event });
    }
  }

  resetProgress(id) {
    const prog = this.progress.get(id);
    const achievement = this.achievements.get(id);
    if (!prog || !achievement) return;
    if (prog.current === 0) return;

    prog.current = 0;
    prog.startedAt = null;
    prog.lastUpdatedAt = Date.now();
    this.emitProgress(id);
  }

  xpForLevel(level) {
    if (level <= 1) return 0;
    const base = 100;
    return Math.floor(base * Math.pow(level - 1, 1.35));
  }

  awardXP(amount, { save = true } = {}) {
    if (!this.enabled) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    this.xp += value * this.xpMultiplier;

    const newLevel = this.getLevelFromXP(this.xp);
    if (newLevel > this.level) {
      this.level = newLevel;
      console.log(`🎉 Level Up! Now level ${this.level}`);
    }

    if (save && this.autoSaveEnabled) {
      this.saveProgress();
    }
  }

  getLevelFromXP(xp) {
    let level = 1;
    while (xp >= this.xpForLevel(level + 1)) level++;
    return level;
  }

  ensureNotificationStyles() {
    if (this.notificationStylesInjected) return;
    if (typeof document === 'undefined') return;
    
    // Avoid duplicating the style tag if it already exists
    if (document.getElementById('achievement-notification-styles')) {
      this.notificationStylesInjected = true;
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'achievement-notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    this.notificationStylesInjected = true;
  }

  // Unlock an achievement
  unlock(id, context = {}) {
    if (!this.enabled) return;
    const achievement = this.achievements.get(id);
    if (!achievement) return;

    const prog = this.progress.get(id);

    if (achievement.unlocked && !achievement.repeatable) return;

    if (!achievement.repeatable) {
      achievement.unlocked = true;
      achievement.unlockedAt = Date.now();
      this.unlocked.add(id);
    }

    if (prog) {
      prog.timesUnlocked = (prog.timesUnlocked || 0) + 1;
      if (prog.goal) prog.current = prog.goal;
      prog.lastUpdatedAt = Date.now();
    }

    const xpGained = Number(achievement.xp) || 0;
    this.awardXP(xpGained, { save: false });

    const world = context.world;

    try {
      eventSystem.emit(GameEvents.ACHIEVEMENT_UNLOCKED, {
        id,
        name: achievement.name,
        xp: xpGained,
        icon: achievement.icon,
        type: achievement.type,
        unlockedAt: achievement.unlockedAt || Date.now(),
        worldTime: world?.t,
        population: world?.creatures?.length,
        biomeSeed: world?.biomeGenerator?.seed
      });
    } catch (e) {
      console.warn('Failed to emit achievement event:', e);
    }
    
    // Show notification
    this.showNotification(achievement);
    
    if (achievement.repeatable) {
      this.resetProgress(id);
    }

    // Save progress
    if (this.autoSaveEnabled) {
      this.saveProgress();
    }
    
    console.log(`🏆 Achievement Unlocked: ${achievement.name} (+${achievement.xp} XP)`);
  }

  // Show achievement notification
  showNotification(achievement) {
    if (!this.notificationsEnabled) return;
    // If the central NotificationSystem exists, let it handle display via events
    if (typeof window !== 'undefined' &&
        window.notifications &&
        typeof window.notifications.show === 'function') {
      return;
    }
    if (typeof document === 'undefined' || !document.body) return;
    this.ensureNotificationStyles();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-content">
        <div class="achievement-title">Achievement Unlocked!</div>
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-xp">+${achievement.xp} XP</div>
      </div>
    `;
    
    // Style it
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      display: flex;
      align-items: center;
      gap: 15px;
      animation: slideInRight 0.3s ease-out;
      min-width: 300px;
    `;
    
    // Icon style
    const icon = notification.querySelector('.achievement-icon');
    icon.style.cssText = `
      font-size: 40px;
      line-height: 1;
    `;
    
    // Content styles
    const title = notification.querySelector('.achievement-title');
    title.style.cssText = `
      font-size: 12px;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    
    const name = notification.querySelector('.achievement-name');
    name.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      margin: 5px 0;
    `;
    
    const xp = notification.querySelector('.achievement-xp');
    xp.style.cssText = `
      font-size: 14px;
      opacity: 0.8;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  }

  // Get achievement progress for UI
  getProgress() {
    const total = this.achievements.size;
    const unlocked = this.unlocked.size;

    const items = [];
    for (const [id, achievement] of this.achievements) {
      const prog = this.progress.get(id);
      const goal = prog?.goal || Number(achievement.goal) || null;
      const current = prog?.current || 0;
      const percent = goal ? Math.min(1, current / goal) : (achievement.unlocked ? 1 : 0);
      const visibleUnlocked = achievement.unlocked || (prog?.timesUnlocked || 0) > 0;

      items.push({
        id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        type: achievement.type,
        xp: achievement.xp,
        secret: !!achievement.secret,
        unlocked: visibleUnlocked,
        unlockedAt: achievement.unlockedAt,
        progress: {
          current,
          goal,
          percent,
          timesUnlocked: prog?.timesUnlocked || 0
        }
      });
    }

    return {
      total,
      unlocked,
      percentage: total > 0 ? (unlocked / total) * 100 : 0,
      xp: this.xp,
      level: this.level,
      nextLevelXP: this.xpForLevel(this.level + 1),
      items,
      dataVersion: ACHIEVEMENTS_DATA_VERSION
    };
  }

  emitProgress(id) {
    const achievement = this.achievements.get(id);
    const prog = this.progress.get(id);
    if (!achievement || !prog) return;

    const goal = prog.goal || Number(achievement.goal) || null;
    const percent = goal ? Math.min(1, prog.current / goal) : (achievement.unlocked ? 1 : 0);

    try {
      eventSystem.emit(GameEvents.ACHIEVEMENT_PROGRESS, {
        id,
        name: achievement.name,
        type: achievement.type,
        current: prog.current,
        goal,
        percent
      });
    } catch {
      // Silent
    }
  }

  // Save progress to localStorage
  saveProgress() {
    if (!this.autoSaveEnabled) return;
    try {
      const data = {
        version: SAVE_VERSION,
        dataVersion: ACHIEVEMENTS_DATA_VERSION,
        unlocked: Array.from(this.unlocked),
        xp: this.xp,
        level: this.level,
        achievements: {},
        progress: {}
      };
      
      for (const [id, achievement] of this.achievements) {
        const prog = this.progress.get(id);

        if (prog) {
          data.progress[id] = {
            current: prog.current,
            goal: prog.goal,
            startedAt: prog.startedAt,
            lastUpdatedAt: prog.lastUpdatedAt,
            timesUnlocked: prog.timesUnlocked
          };
        }

        if (achievement.unlocked) {
          data.achievements[id] = {
            unlockedAt: achievement.unlockedAt,
            timesUnlocked: prog?.timesUnlocked || 1
          };
        }
      }
      
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save achievements:', e);
    }
  }

  // Load progress from localStorage
  loadProgress() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        let data = JSON.parse(saved);
        data = this.migrateSave(data);

        const unlockedIds = Array.isArray(data.unlocked) ? data.unlocked : [];
        this.unlocked = new Set(unlockedIds.filter(id => this.achievements.has(id)));

        this.xp = Number(data.xp) || 0;
        this.level = this.getLevelFromXP(this.xp);
        
        // Restore achievement states
        for (const id of this.unlocked) {
          const achievement = this.achievements.get(id);
          if (achievement) {
            achievement.unlocked = true;
            if (data.achievements?.[id]) {
              achievement.unlockedAt = data.achievements[id].unlockedAt;
            }
          }
        }

        // Restore progress states
        const savedProgress = data.progress || {};
        for (const [id, prog] of this.progress) {
          const sp = savedProgress[id];
          if (!sp) continue;
          prog.current = Number(sp.current) || 0;
          prog.goal = Number(sp.goal) || prog.goal;
          prog.startedAt = sp.startedAt || prog.startedAt;
          prog.lastUpdatedAt = sp.lastUpdatedAt || prog.lastUpdatedAt;
          prog.timesUnlocked = Number(sp.timesUnlocked) || prog.timesUnlocked || 0;
        }
      }
    } catch (e) {
      console.warn('Failed to load achievements:', e);
    }
  }

  migrateSave(data) {
    if (!data || typeof data !== 'object') return data;
    const version = Number(data.version) || 1;
    if (version >= SAVE_VERSION) return data;

    // v1 -> v2 migration
    return {
      version: SAVE_VERSION,
      dataVersion: data.dataVersion || ACHIEVEMENTS_DATA_VERSION,
      unlocked: Array.isArray(data.unlocked) ? data.unlocked : [],
      xp: Number(data.xp) || 0,
      level: Number(data.level) || 1,
      achievements: data.achievements || {},
      progress: {}
    };
  }

  // Reset all achievements (used by UI)
  resetAll() {
    this.unlocked.clear();
    this.xp = 0;
    this.level = 1;
    this._lastWorldTime = null;

    for (const [id, achievement] of this.achievements) {
      achievement.unlocked = false;
      achievement.unlockedAt = null;
      const prog = this.progress.get(id);
      if (prog) {
        prog.current = 0;
        prog.startedAt = null;
        prog.lastUpdatedAt = null;
        prog.timesUnlocked = 0;
      }
      this.emitProgress(id);
    }

    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
    this.saveProgress();
  }

  // Debug helpers (safe no-ops in production)
  debugTrigger(trigger, amount = 1, event = {}) {
    this.handleTrigger(trigger, amount, event);
  }

  debugUnlock(id, world = null) {
    this.unlock(id, { world });
  }
}
