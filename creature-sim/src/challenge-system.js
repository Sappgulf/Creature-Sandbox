/**
 * Dynamic Challenge System - Procedural objectives and rewards
 */

import { eventSystem, GameEvents } from './event-system.js';
import { clamp } from './utils.js';
import { geneValue, isPredatorFromGenes } from './creature-genetics-helpers.js';

function isChallengeCreatureAlive(creature) {
  return !!creature && creature.alive !== false;
}

export class ChallengeSystem {
  constructor({ sessionGoals = null, notifications = null, audio = null } = {}) {
    this.sessionGoals = sessionGoals;
    this.notifications = notifications;
    this.audio = audio;
    this.challenges = [];
    this.completedChallenges = [];
    this.completedGoalIds = new Set();
    this.recentGoalCompletions = [];
    this.points = 0;
    this.level = 1;
    this.nextLevelPoints = 100;

    this._unsubscribeGoalCompleted = eventSystem.on(GameEvents.SESSION_GOAL_COMPLETED, goal => {
      this.completeSessionGoal(goal);
    });
  }

  /**
   * Generate a new random challenge
   */
  generateChallenge(_world) {
    const challengeTypes = [
      // Population challenges
      {
        type: 'population',
        title: 'Population Boom',
        description: 'Reach {target} total creatures',
        target: () => 50 + Math.floor(Math.random() * 100),
        check: (world, target) => world.creatures.filter(isChallengeCreatureAlive).length >= target,
        points: 50
      },
      {
        type: 'predator_balance',
        title: 'Predator Balance',
        description: 'Maintain {target} predators for 60 seconds',
        target: () => 5 + Math.floor(Math.random() * 10),
        check: (world, target, challenge, dt) => {
          const predCount = world.creatures.filter(
            c => isChallengeCreatureAlive(c) && isPredatorFromGenes(c.genes)
          ).length;
          if (predCount >= target) {
            challenge.elapsed = (challenge.elapsed || 0) + dt;
            challenge.progress = clamp(challenge.elapsed / 60, 0, 1);
            return challenge.progress >= 1;
          }
          challenge.elapsed = 0;
          challenge.progress = 0;
          return false;
        },
        points: 75
      },
      // Diversity challenges
      {
        type: 'genetic_diversity',
        title: 'Genetic Diversity',
        description: 'Have {target} distinct hue groups',
        target: () => 5 + Math.floor(Math.random() * 5),
        check: (world, target) => {
          const hues = new Set(
            world.creatures.filter(isChallengeCreatureAlive).map(c => Math.floor(geneValue(c.genes, 'hue', 0) / 30))
          );
          return hues.size >= target;
        },
        points: 60
      },
      // Survival challenges
      {
        type: 'elder_survival',
        title: 'Elder Wisdom',
        description: 'Have {target} elder creatures alive',
        target: () => 3 + Math.floor(Math.random() * 5),
        check: (world, target) => {
          return world.creatures.filter(c => isChallengeCreatureAlive(c) && c.ageStage === 'elder').length >= target;
        },
        points: 80
      },
      // Ecosystem challenges
      {
        type: 'ecosystem_health',
        title: 'Thriving Ecosystem',
        description: 'Maintain ecosystem health above {target}% for 30s',
        target: () => 70 + Math.floor(Math.random() * 20),
        check: (world, target, challenge, dt) => {
          const health = world.ecosystemHealth?.overall ?? 0;
          if (health >= target) {
            challenge.elapsed = (challenge.elapsed || 0) + dt;
            challenge.progress = clamp(challenge.elapsed / 30, 0, 1);
            return challenge.progress >= 1;
          }
          challenge.elapsed = 0;
          challenge.progress = 0;
          return false;
        },
        points: 90
      },
      // Special events
      {
        type: 'speed_evolution',
        title: 'Speed Demons',
        description: 'Evolve {target} creatures with speed > 1.5',
        target: () => 3 + Math.floor(Math.random() * 7),
        check: (world, target) => {
          return (
            world.creatures.filter(c => isChallengeCreatureAlive(c) && geneValue(c.genes, 'speed', 0) > 1.5).length >=
            target
          );
        },
        points: 70
      },
      {
        type: 'mega_sense',
        title: 'Super Senses',
        description: 'Evolve a creature with sense range > {target}',
        target: () => 150 + Math.floor(Math.random() * 100),
        check: (world, target) => {
          return world.creatures.some(c => isChallengeCreatureAlive(c) && geneValue(c.genes, 'sense', 0) >= target);
        },
        points: 65
      }
    ];

    const template = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    const target = template.target();

    return {
      id: Date.now() + Math.random(),
      type: template.type,
      title: template.title,
      description: template.description.replace('{target}', target),
      target,
      check: template.check,
      points: template.points,
      progress: 0,
      startTime: Date.now(),
      completed: false
    };
  }

  /**
   * Update active challenges
   */
  update(world, dt = 1 / 60) {
    if (this.sessionGoals) {
      this.pruneRecentGoalCompletions();
      return;
    }

    // Generate new challenges if needed
    if (this.challenges.length < 3) {
      this.challenges.push(this.generateChallenge(world));
    }

    // Check challenge completion
    for (const challenge of this.challenges) {
      if (challenge.completed) continue;

      if (challenge.check(world, challenge.target, challenge, dt)) {
        this.completeChallenge(challenge);
      }
    }

    // Remove old completed challenges
    this.challenges = this.challenges.filter(c => {
      if (c.completed) {
        const timeSinceComplete = Date.now() - c.completedTime;
        return timeSinceComplete < 5000; // Show for 5 seconds
      }
      return true;
    });
  }

  /**
   * Complete a challenge
   */
  completeChallenge(challenge) {
    challenge.completed = true;
    challenge.completedTime = Date.now();

    this.points += challenge.points;
    this.completedChallenges.push(challenge);

    console.debug(`🎯 Challenge completed: ${challenge.title} (+${challenge.points} points)`);

    // Check for level up
    if (this.points >= this.nextLevelPoints) {
      this.levelUp();
    }
  }

  completeSessionGoal(goal) {
    if (!goal?.id || this.completedGoalIds.has(goal.id)) return;
    this.completedGoalIds.add(goal.id);

    const points = this.pointsForGoal(goal);
    const completion = {
      id: goal.id,
      type: goal.type,
      title: 'Goal complete',
      description: goal.description || 'Session goal complete',
      points,
      progress: 1,
      completed: true,
      completedTime: Date.now()
    };

    this.points += points;
    this.completedChallenges.push(completion);
    this.recentGoalCompletions.unshift(completion);
    this.recentGoalCompletions = this.recentGoalCompletions.slice(0, 3);

    if (this.points >= this.nextLevelPoints) {
      this.levelUp();
    }
  }

  pointsForGoal(goal) {
    const target = Number(goal?.target || 0);
    const baseByType = {
      survival_time: 45,
      population: 40,
      predator_kills: 55,
      prop_places: 35,
      god_actions: 30,
      variant_alive: 50,
      lineage_generation: 60
    };
    const base = baseByType[goal?.type] || 35;
    const scale = Number.isFinite(target) ? Math.min(35, Math.floor(target / 8)) : 0;
    return Math.max(20, base + scale);
  }

  /**
   * Level up
   */
  levelUp() {
    this.level++;
    this.nextLevelPoints = Math.floor(this.nextLevelPoints * 1.5);
    console.debug(`⭐ Level up! Now level ${this.level}`);
    this.notifications?.show?.(`Challenge level ${this.level}`, 'achievement', 2400);
    this.audio?.playUISound?.('success');
  }

  /**
   * Get current active challenges
   */
  getActiveChallenges() {
    if (this.sessionGoals) {
      return this.sessionGoals
        .getGoals()
        .filter(goal => !goal.completed)
        .map(goal => ({
          id: goal.id,
          type: goal.type,
          icon: goal.icon || '🎯',
          title: goal.description || 'Complete the active goal',
          description: goal.description,
          points: this.pointsForGoal(goal),
          progress: clamp(Number(goal.progress || 0), 0, 1),
          completed: false
        }));
    }
    return this.challenges.filter(c => !c.completed);
  }

  /**
   * Get recently completed challenges
   */
  getRecentCompletions() {
    if (this.sessionGoals) {
      this.pruneRecentGoalCompletions();
      return this.recentGoalCompletions;
    }
    return this.challenges.filter(c => c.completed);
  }

  pruneRecentGoalCompletions() {
    const now = Date.now();
    this.recentGoalCompletions = this.recentGoalCompletions.filter(item => {
      const completedTime = Number(item.completedTime || 0);
      return now - completedTime < 5000;
    });
  }

  fitLabel(ctx, text, maxWidth) {
    const label = String(text || '').trim();
    if (!label) return '';
    if (ctx.measureText(label).width <= maxWidth) return label;

    const ellipsis = '…';
    let low = 0;
    let high = label.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = `${label.slice(0, mid).trimEnd()}${ellipsis}`;
      if (ctx.measureText(candidate).width <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return `${label.slice(0, Math.max(0, low)).trimEnd()}${ellipsis}`;
  }

  serialize() {
    return {
      points: this.points,
      level: this.level,
      nextLevelPoints: this.nextLevelPoints,
      completedGoalIds: Array.from(this.completedGoalIds),
      completedChallenges: this.completedChallenges.slice(-20).map(challenge => ({
        id: challenge.id,
        type: challenge.type,
        title: challenge.title,
        description: challenge.description,
        points: challenge.points,
        completed: !!challenge.completed,
        completedTime: Number(challenge.completedTime || 0)
      }))
    };
  }

  restore(data) {
    if (!data || typeof data !== 'object') return false;
    this.points = Math.max(0, Number(data.points || 0));
    this.level = Math.max(1, Number(data.level || 1));
    this.nextLevelPoints = Math.max(100, Number(data.nextLevelPoints || 100));
    this.completedGoalIds = new Set(Array.isArray(data.completedGoalIds) ? data.completedGoalIds : []);
    this.completedChallenges = Array.isArray(data.completedChallenges)
      ? data.completedChallenges.filter(Boolean).slice(-20)
      : [];
    this.recentGoalCompletions = [];
    return true;
  }

  /**
   * Draw challenge UI
   */
  draw(ctx, x, y, options = {}) {
    const active = this.getActiveChallenges();
    const recent = this.getRecentCompletions();
    const viewportWidth = Number(options.viewportWidth || ctx.canvas?.width || 0);
    const layoutWidth = Number(options.layoutWidth || viewportWidth);
    const pixelRatio = layoutWidth > 0 ? viewportWidth / layoutWidth : 1;
    const compact = layoutWidth > 0 && layoutWidth < 760;
    const maxVisible = compact ? 1 : 2;
    const visibleActive = active.slice(0, maxVisible);
    const sx = x * pixelRatio;
    const sy = y * pixelRatio;

    ctx.save();
    ctx.textBaseline = 'top';

    const panelWidth = (compact ? Math.min(230, layoutWidth - 20) : 248) * pixelRatio;
    const rowHeight = (compact ? 26 : 29) * pixelRatio;
    const panelHeight =
      (compact ? 22 : 28) * pixelRatio +
      visibleActive.length * rowHeight +
      (recent.length ? (compact ? 18 : 24) * pixelRatio : 0);
    ctx.fillStyle = 'rgba(8, 12, 20, 0.58)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = Math.max(1, pixelRatio);
    ctx.beginPath();
    ctx.roundRect(sx, sy, panelWidth, panelHeight, 12 * pixelRatio);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = `600 ${compact ? 11 * pixelRatio : 12 * pixelRatio}px system-ui, sans-serif`;
    ctx.fillText(
      `Level ${this.level} · ${this.points}/${this.nextLevelPoints} pts`,
      sx + 10 * pixelRatio,
      sy + 7 * pixelRatio
    );

    let offsetY = sy + (compact ? 27 : 31) * pixelRatio;

    for (const challenge of visibleActive) {
      const label = this.fitLabel(
        ctx,
        `${challenge.icon ? `${challenge.icon} ` : ''}${challenge.title}`,
        panelWidth - 20 * pixelRatio
      );
      ctx.fillStyle = 'rgba(250, 204, 21, 0.92)';
      ctx.font = `700 ${11 * pixelRatio}px system-ui, sans-serif`;
      ctx.fillText(label, sx + 10 * pixelRatio, offsetY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(
        sx + 10 * pixelRatio,
        offsetY + 15 * pixelRatio,
        panelWidth - 20 * pixelRatio,
        Math.max(2, 3 * pixelRatio)
      );
      ctx.fillStyle = 'rgba(74, 222, 128, 0.82)';
      ctx.fillRect(
        sx + 10 * pixelRatio,
        offsetY + 15 * pixelRatio,
        (panelWidth - 20 * pixelRatio) * clamp(challenge.progress, 0, 1),
        Math.max(2, 3 * pixelRatio)
      );

      offsetY += rowHeight;
    }

    if (recent.length) {
      const latest = recent[0];
      ctx.fillStyle = 'rgba(74, 222, 128, 0.9)';
      ctx.font = `700 ${compact ? 10 * pixelRatio : 11 * pixelRatio}px system-ui, sans-serif`;
      ctx.fillText(`✓ ${latest.title} +${latest.points}`, sx + 10 * pixelRatio, offsetY);
    }

    ctx.restore();
  }
}

export const challengeSystem = new ChallengeSystem();
