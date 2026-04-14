/**
 * Dynamic Challenge System - Procedural objectives and rewards
 */

export class ChallengeSystem {
  constructor() {
    this.challenges = [];
    this.completedChallenges = [];
    this.points = 0;
    this.level = 1;
    this.nextLevelPoints = 100;
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
        check: (world, target) => world.creatures.length >= target,
        points: 50
      },
      {
        type: 'predator_balance',
        title: 'Predator Balance',
        description: 'Maintain {target} predators for 60 seconds',
        target: () => 5 + Math.floor(Math.random() * 10),
        check: (world, target, challenge) => {
          const predCount = world.creatures.filter(c => c.genes.predator).length;
          if (predCount >= target) {
            challenge.progress = (challenge.progress || 0) + 1/60;
            return challenge.progress >= 1;
          }
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
          const hues = new Set(world.creatures.map(c => Math.floor(c.genes.hue / 30)));
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
          return world.creatures.filter(c => c.ageStage === 'elder').length >= target;
        },
        points: 80
      },
      // Ecosystem challenges
      {
        type: 'ecosystem_health',
        title: 'Thriving Ecosystem',
        description: 'Maintain ecosystem health above {target}% for 30s',
        target: () => 70 + Math.floor(Math.random() * 20),
        check: (world, target, challenge) => {
          const health = world.ecosystemHealth?.overall ?? 0;
          if (health >= target) {
            challenge.progress = (challenge.progress || 0) + 1/30;
            return challenge.progress >= 1;
          }
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
          return world.creatures.filter(c => c.genes.speed > 1.5).length >= target;
        },
        points: 70
      },
      {
        type: 'mega_sense',
        title: 'Super Senses',
        description: 'Evolve a creature with sense range > {target}',
        target: () => 150 + Math.floor(Math.random() * 100),
        check: (world, target) => {
          return world.creatures.some(c => c.genes.sense >= target);
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
  update(world) {
    // Generate new challenges if needed
    if (this.challenges.length < 3) {
      this.challenges.push(this.generateChallenge(world));
    }

    // Check challenge completion
    for (const challenge of this.challenges) {
      if (challenge.completed) continue;

      if (challenge.check(world, challenge.target, challenge)) {
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

  /**
   * Level up
   */
  levelUp() {
    this.level++;
    this.nextLevelPoints = Math.floor(this.nextLevelPoints * 1.5);
    console.debug(`⭐ Level up! Now level ${this.level}`);
  }

  /**
   * Get current active challenges
   */
  getActiveChallenges() {
    return this.challenges.filter(c => !c.completed);
  }

  /**
   * Get recently completed challenges
   */
  getRecentCompletions() {
    return this.challenges.filter(c => c.completed);
  }

  /**
   * Draw challenge UI
   */
  draw(ctx, x, y) {
    const active = this.getActiveChallenges();
    const recent = this.getRecentCompletions();

    ctx.save();
    ctx.font = '14px sans-serif';

    // Draw level and points
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Level ${this.level} - ${this.points}/${this.nextLevelPoints} pts`, x, y);

    let offsetY = y + 25;

    // Draw active challenges
    for (const challenge of active) {
      ctx.fillStyle = 'rgba(40, 40, 60, 0.8)';
      ctx.fillRect(x, offsetY, 250, 40);

      ctx.fillStyle = '#ffdd88';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(challenge.title, x + 5, offsetY + 15);

      ctx.fillStyle = '#cccccc';
      ctx.font = '11px sans-serif';
      ctx.fillText(challenge.description, x + 5, offsetY + 30);

      // Progress bar if applicable
      if (challenge.progress) {
        ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
        ctx.fillRect(x + 5, offsetY + 35, 240 * challenge.progress, 3);
      }

      offsetY += 45;
    }

    // Draw recently completed
    for (const challenge of recent) {
      ctx.fillStyle = 'rgba(60, 180, 60, 0.9)';
      ctx.fillRect(x, offsetY, 250, 35);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`✓ ${challenge.title}`, x + 5, offsetY + 15);

      ctx.fillStyle = '#ffff88';
      ctx.font = '11px sans-serif';
      ctx.fillText(`+${challenge.points} points!`, x + 5, offsetY + 28);

      offsetY += 40;
    }

    ctx.restore();
  }
}

export const challengeSystem = new ChallengeSystem();
