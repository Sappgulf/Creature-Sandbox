/**
 * Campaign System - Manages campaign levels, progression, and objectives
 *
 * Features:
 * - 7 progressive levels with unique objectives
 * - Progress tracking via localStorage
 * - Win/lose condition checking
 * - Level-specific world configurations
 */

import { eventSystem, GameEvents } from './event-system.js';

/**
 * Campaign Level Definitions
 */
export const CAMPAIGN_LEVELS = [
  {
    id: 1,
    name: 'First Steps',
    subtitle: 'Tutorial',
    description: 'Learn the basics of the ecosystem. Grow your population to 25 creatures.',
    difficulty: 'easy',
    icon: '🌱',
    unlocked: true, // First level always unlocked

    objectives: {
      primary: {
        type: 'population',
        target: 25,
        description: 'Reach 25 creatures'
      },
      timeLimit: 0, // No time limit
      secondary: [
        { type: 'no_extinctions', description: 'Keep at least 1 creature alive at all times' }
      ]
    },

    worldConfig: {
      width: 2000,
      height: 1400,
      initialCreatures: 5,
      initialFood: 80,
      foodRespawnRate: 1.2,
      seasonSpeed: 0.01,
      disastersEnabled: false,
      predatorsEnabled: false
    },

    tutorial: {
      enabled: true,
      hints: [
        'Creatures automatically seek food and reproduce when healthy.',
        'Watch the population counter in the top-left.',
        'Green dots are food - creatures need it to survive and reproduce.'
      ]
    },

    rewards: {
      xp: 50,
      achievement: 'campaign_first_steps'
    }
  },

  {
    id: 2,
    name: 'Survival',
    subtitle: 'Resource Management',
    description: 'Survive for 3 minutes with limited food resources.',
    difficulty: 'normal',
    icon: '⏱️',
    unlocked: false,

    objectives: {
      primary: {
        type: 'survival_time',
        target: 180, // 3 minutes in seconds
        description: 'Survive for 3 minutes'
      },
      failConditions: [
        { type: 'extinction', description: 'All creatures die' }
      ]
    },

    worldConfig: {
      width: 2500,
      height: 1800,
      initialCreatures: 15,
      initialFood: 40,
      foodRespawnRate: 0.5, // Scarce food
      maxFood: 100,
      seasonSpeed: 0.02,
      disastersEnabled: false,
      predatorsEnabled: false
    },

    rewards: {
      xp: 100,
      achievement: 'campaign_survival'
    }
  },

  {
    id: 3,
    name: "Predator's Rise",
    subtitle: 'Natural Selection',
    description: 'Evolve a successful predator lineage with at least 3 kills.',
    difficulty: 'normal',
    icon: '🦁',
    unlocked: false,

    objectives: {
      primary: {
        type: 'predator_kills',
        target: 3,
        description: 'A predator achieves 3 kills'
      },
      timeLimit: 300, // 5 minutes
      secondary: [
        { type: 'min_population', target: 10, description: 'Keep at least 10 creatures alive' }
      ]
    },

    worldConfig: {
      width: 3000,
      height: 2000,
      initialCreatures: 20,
      initialPredators: 2,
      initialFood: 100,
      foodRespawnRate: 0.8,
      seasonSpeed: 0.015,
      disastersEnabled: false,
      predatorsEnabled: true
    },

    rewards: {
      xp: 150,
      achievement: 'campaign_predator'
    }
  },

  {
    id: 4,
    name: 'The Plague',
    subtitle: 'Disease Outbreak',
    description: 'Survive a disease outbreak. At least 10 creatures must survive.',
    difficulty: 'hard',
    icon: '🦠',
    unlocked: false,

    objectives: {
      primary: {
        type: 'survive_disease',
        target: 10,
        description: 'Have 10+ creatures survive the plague'
      },
      timeLimit: 240, // 4 minutes
      failConditions: [
        { type: 'population_below', target: 5, description: 'Population drops below 5' }
      ]
    },

    worldConfig: {
      width: 3000,
      height: 2000,
      initialCreatures: 30,
      initialFood: 120,
      foodRespawnRate: 0.9,
      seasonSpeed: 0.015,
      disastersEnabled: true,
      predatorsEnabled: false,
      triggerDisease: {
        delay: 15, // Start disease after 15 seconds
        type: 'fever',
        initialInfections: 5
      }
    },

    rewards: {
      xp: 200,
      achievement: 'campaign_plague'
    }
  },

  {
    id: 5,
    name: 'Harsh Winter',
    subtitle: 'Seasonal Challenge',
    description: 'Survive through a full winter season without going extinct.',
    difficulty: 'hard',
    icon: '❄️',
    unlocked: false,

    objectives: {
      primary: {
        type: 'survive_season',
        targetSeason: 'winter',
        description: 'Survive through winter'
      },
      timeLimit: 0,
      secondary: [
        { type: 'min_population_end', target: 15, description: 'End with 15+ creatures' }
      ]
    },

    worldConfig: {
      width: 3500,
      height: 2400,
      initialCreatures: 25,
      initialFood: 150,
      foodRespawnRate: 0.7,
      seasonSpeed: 0.03, // Faster seasons
      startSeason: 'autumn', // Start in autumn, winter is coming
      disastersEnabled: false,
      predatorsEnabled: false
    },

    rewards: {
      xp: 200,
      achievement: 'campaign_winter'
    }
  },

  {
    id: 6,
    name: 'Aquatic Evolution',
    subtitle: 'Water World',
    description: 'Evolve aquatic creatures. Have 5 creatures with high aquatic affinity survive in water.',
    difficulty: 'hard',
    icon: '🐟',
    unlocked: false,

    objectives: {
      primary: {
        type: 'aquatic_creatures',
        target: 5,
        minAquaticAffinity: 0.6,
        description: 'Have 5 aquatic creatures (60%+ affinity)'
      },
      timeLimit: 360 // 6 minutes
    },

    worldConfig: {
      width: 3500,
      height: 2400,
      initialCreatures: 20,
      initialFood: 100,
      foodRespawnRate: 0.8,
      seasonSpeed: 0.015,
      disastersEnabled: false,
      predatorsEnabled: false,
      waterBiomeBoost: true, // Increase water biome generation
      initialAquaticCreatures: 3 // Start with some semi-aquatic creatures
    },

    rewards: {
      xp: 250,
      achievement: 'campaign_aquatic'
    }
  },

  {
    id: 7,
    name: 'Ecosystem Master',
    subtitle: 'Final Challenge',
    description: 'Maintain a balanced ecosystem of 100 creatures for 2 minutes straight.',
    difficulty: 'expert',
    icon: '🏆',
    unlocked: false,

    objectives: {
      primary: {
        type: 'stable_population',
        target: 100,
        duration: 120, // Must maintain for 2 minutes
        description: 'Maintain 100+ creatures for 2 minutes'
      },
      timeLimit: 600, // 10 minutes max
      secondary: [
        { type: 'biodiversity', target: 0.5, description: 'Maintain genetic diversity above 50%' }
      ]
    },

    worldConfig: {
      width: 4000,
      height: 2800,
      initialCreatures: 40,
      initialPredators: 3,
      initialFood: 200,
      foodRespawnRate: 1.0,
      seasonSpeed: 0.02,
      disastersEnabled: true,
      disasterFrequency: 0.5, // Less frequent
      predatorsEnabled: true
    },

    rewards: {
      xp: 500,
      achievement: 'campaign_master'
    }
  }
];

/**
 * Campaign System - Manages campaign state and progression
 */
export class CampaignSystem {
  constructor() {
    this.currentLevel = null;
    this.levelProgress = new Map(); // levelId -> { completed, stars, bestTime }
    this.activeObjectiveState = null;
    this.isActive = false;
    this.levelStartTime = 0;
    this.stablePopulationTimer = 0;
    this.winterSurvived = false;
    this.diseaseSurvived = false;

    this.loadProgress();
  }

  /**
   * Load saved progress from localStorage
   */
  loadProgress() {
    try {
      const saved = localStorage.getItem('campaign_progress');
      if (saved) {
        const data = JSON.parse(saved);
        this.levelProgress = new Map(Object.entries(data.progress || {}));

        // Unlock levels based on progress
        CAMPAIGN_LEVELS.forEach((level, index) => {
          if (index === 0) {
            level.unlocked = true;
          } else {
            const prevLevel = CAMPAIGN_LEVELS[index - 1];
            level.unlocked = this.isLevelCompleted(prevLevel.id);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load campaign progress:', e);
    }
  }

  /**
   * Save progress to localStorage
   */
  saveProgress() {
    try {
      const data = {
        progress: Object.fromEntries(this.levelProgress),
        lastPlayed: Date.now()
      };
      localStorage.setItem('campaign_progress', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save campaign progress:', e);
    }
  }

  /**
   * Check if a level is completed
   */
  isLevelCompleted(levelId) {
    const progress = this.levelProgress.get(String(levelId));
    return progress?.completed === true;
  }

  /**
   * Get level by ID
   */
  getLevel(levelId) {
    return CAMPAIGN_LEVELS.find(l => l.id === levelId);
  }

  /**
   * Get all levels with unlock status
   */
  getAllLevels() {
    return CAMPAIGN_LEVELS.map(level => ({
      ...level,
      progress: this.levelProgress.get(String(level.id)) || null
    }));
  }

  /**
   * Start a campaign level
   */
  startLevel(levelId, world) {
    const level = this.getLevel(levelId);
    if (!level) {
      console.error('Invalid level ID:', levelId);
      return false;
    }

    if (!level.unlocked) {
      console.error('Level is locked:', levelId);
      return false;
    }

    this.currentLevel = level;
    this.isActive = true;
    this.levelStartTime = world.t || 0;
    this.stablePopulationTimer = 0;
    this.winterSurvived = false;
    this.diseaseSurvived = false;

    // Initialize objective state
    this.activeObjectiveState = {
      startTime: this.levelStartTime,
      primaryComplete: false,
      secondaryComplete: [],
      failed: false,
      failReason: null
    };

    // Apply world configuration
    this.applyWorldConfig(world, level.worldConfig);

    // Emit event
    eventSystem?.emit(GameEvents.NOTIFICATION, {
      message: `${level.icon} Campaign: ${level.name}`,
      type: 'info',
      duration: 5000
    });

    // Show tutorial hints if enabled
    if (level.tutorial?.enabled && level.tutorial.hints?.length) {
      setTimeout(() => {
        eventSystem?.emit(GameEvents.NOTIFICATION, {
          message: level.tutorial.hints[0],
          type: 'info',
          duration: 8000
        });
      }, 2000);
    }

    return true;
  }

  /**
   * Apply level-specific world configuration
   */
  applyWorldConfig(world, config) {
    // This would typically be called when the world is reset/initialized
    // Store config for world initialization
    this.pendingWorldConfig = config;
  }

  /**
   * Get pending world configuration for level
   */
  getPendingConfig() {
    const config = this.pendingWorldConfig;
    this.pendingWorldConfig = null;
    return config;
  }

  /**
   * Update campaign state (called each frame)
   */
  update(dt, world) {
    if (!this.isActive || !this.currentLevel) return;

    const level = this.currentLevel;
    const elapsed = (world.t || 0) - this.levelStartTime;

    // Check time limit
    if (level.objectives.timeLimit > 0 && elapsed >= level.objectives.timeLimit) {
      if (!this.activeObjectiveState.primaryComplete) {
        this.failLevel('Time limit reached');
        return;
      }
    }

    // Check fail conditions
    if (level.objectives.failConditions) {
      for (const condition of level.objectives.failConditions) {
        if (this.checkFailCondition(condition, world)) {
          this.failLevel(condition.description);
          return;
        }
      }
    }

    // Check primary objective
    if (!this.activeObjectiveState.primaryComplete) {
      if (this.checkObjective(level.objectives.primary, world, dt)) {
        this.activeObjectiveState.primaryComplete = true;
        this.completeLevel(world);
      }
    }
  }

  /**
   * Check if a fail condition is met
   */
  checkFailCondition(condition, world) {
    switch (condition.type) {
      case 'extinction':
        return world.creatures.filter(c => c.alive).length === 0;

      case 'population_below':
        return world.creatures.filter(c => c.alive).length < condition.target;

      default:
        return false;
    }
  }

  /**
   * Check if an objective is met
   */
  checkObjective(objective, world, dt) {
    const aliveCreatures = world.creatures.filter(c => c.alive);

    switch (objective.type) {
      case 'population':
        return aliveCreatures.length >= objective.target;

      case 'survival_time': {
        const elapsed = (world.t || 0) - this.levelStartTime;
        return elapsed >= objective.target;
      }

      case 'predator_kills': {
        const predatorWithKills = aliveCreatures.find(
          c => c.genes?.predator && c.stats?.kills >= objective.target
        );
        return !!predatorWithKills;
      }

      case 'survive_disease': {
        // Check if disease outbreak happened and population survived
        const hasDisease = aliveCreatures.some(c => c.statuses?.has('disease'));
        const hadDisease = this.diseaseSurvived || hasDisease;

        if (hasDisease) {
          this.diseaseSurvived = true;
        }

        // Win if disease happened and we have enough survivors
        if (hadDisease && !hasDisease && aliveCreatures.length >= objective.target) {
          return true;
        }
        return false;
      }

      case 'survive_season': {
        const currentSeason = world.currentSeason;
        if (currentSeason === objective.targetSeason) {
          this.winterSurvived = true;
        }
        // Win if we passed winter and spring has begun
        if (this.winterSurvived && currentSeason === 'spring') {
          return true;
        }
        return false;
      }

      case 'aquatic_creatures': {
        const aquaticCount = aliveCreatures.filter(
          c => (c.aquaticAffinity || c.genes?.aquatic || 0) >= (objective.minAquaticAffinity || 0.6)
        ).length;
        return aquaticCount >= objective.target;
      }

      case 'stable_population': {
        if (aliveCreatures.length >= objective.target) {
          this.stablePopulationTimer += dt;
          if (this.stablePopulationTimer >= objective.duration) {
            return true;
          }
        } else {
          // Reset timer if population drops
          this.stablePopulationTimer = Math.max(0, this.stablePopulationTimer - dt * 2);
        }
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Complete the current level
   */
  completeLevel(world) {
    if (!this.currentLevel) return;

    const level = this.currentLevel;
    const elapsed = (world.t || 0) - this.levelStartTime;

    // Calculate stars (1-3 based on performance)
    let stars = 1;
    if (level.objectives.timeLimit > 0) {
      const timeRatio = elapsed / level.objectives.timeLimit;
      if (timeRatio < 0.5) stars = 3;
      else if (timeRatio < 0.75) stars = 2;
    } else {
      stars = 3; // Full stars for no time limit
    }

    // Save progress
    const existing = this.levelProgress.get(String(level.id)) || {};
    this.levelProgress.set(String(level.id), {
      completed: true,
      stars: Math.max(existing.stars || 0, stars),
      bestTime: Math.min(existing.bestTime || Infinity, elapsed)
    });

    // Unlock next level
    const nextLevel = CAMPAIGN_LEVELS.find(l => l.id === level.id + 1);
    if (nextLevel) {
      nextLevel.unlocked = true;
    }

    this.saveProgress();

    // Emit completion event
    eventSystem?.emit(GameEvents.NOTIFICATION, {
      message: `🎉 Level Complete! ${level.name} - ${'⭐'.repeat(stars)}`,
      type: 'success',
      duration: 8000
    });

    // Award XP if achievement system exists
    if (level.rewards?.xp) {
      eventSystem?.emit(GameEvents.ACHIEVEMENT_XP, { amount: level.rewards.xp });
    }

    // 🎊 CELEBRATION EFFECTS - visual and audio feedback
    // Spawn multiple evolution effects across screen for celebration
    if (world.particles && typeof world.particles.addEvolutionEffect === 'function') {
      const centerX = world.width / 2;
      const centerY = world.height / 2;
      // Create celebratory burst pattern
      for (let i = 0; i < stars * 3; i++) {
        const angle = (i / (stars * 3)) * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        const px = centerX + Math.cos(angle) * distance;
        const py = centerY + Math.sin(angle) * distance;
        setTimeout(() => {
          world.particles.addEvolutionEffect(px, py);
        }, i * 100); // Staggered for cascade effect
      }
    }

    // Play victory sound
    if (world.audio && typeof world.audio.playUISound === 'function') {
      world.audio.playUISound('success');
    }

    this.isActive = false;
  }

  /**
   * Fail the current level
   */
  failLevel(reason) {
    if (!this.currentLevel) return;

    this.activeObjectiveState.failed = true;
    this.activeObjectiveState.failReason = reason;

    eventSystem?.emit(GameEvents.NOTIFICATION, {
      message: `❌ Level Failed: ${reason}`,
      type: 'error',
      duration: 5000
    });

    this.isActive = false;
  }

  /**
   * Exit campaign mode
   */
  exitCampaign() {
    this.currentLevel = null;
    this.isActive = false;
    this.activeObjectiveState = null;
  }

  /**
   * Get current level status for UI
   */
  getStatus() {
    if (!this.currentLevel || !this.isActive) {
      return null;
    }

    return {
      level: this.currentLevel,
      state: this.activeObjectiveState,
      stableTimer: this.stablePopulationTimer
    };
  }

  /**
   * Reset all progress (for testing)
   */
  resetProgress() {
    this.levelProgress.clear();
    CAMPAIGN_LEVELS.forEach((level, index) => {
      level.unlocked = index === 0;
    });
    this.saveProgress();
  }
}

// Global campaign system instance
export const campaignSystem = new CampaignSystem();
