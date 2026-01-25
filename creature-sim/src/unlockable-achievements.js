/**
 * Enhanced Achievement & Unlockables System
 * Tracks milestones and unlocks new content and features
 */

export class UnlockableAchievements {
  constructor() {
    this.achievements = this.defineAchievements();
    this.unlockedAchievements = new Set();
    this.progress = {};
    this.unlocks = {
      biomes: new Set(['forest', 'grassland']), // Starting biomes
      creatures: new Set(['herbivore', 'predator', 'omnivore']), // Starting types
      features: new Set(['basic_controls']),
      tools: new Set(['spawn', 'food']),
      challenges: new Set(),
      skins: new Set(['default']),
      particles: new Set(['basic']),
      soundPacks: new Set(['default'])
    };
  }

  /**
   * Define all achievements with unlock rewards
   */
  defineAchievements() {
    return [
      // Population Achievements
      {
        id: 'pop_25',
        name: 'Growing Colony',
        description: 'Reach 25 creatures',
        category: 'population',
        check: (world) => world.creatures.length >= 25,
        reward: { type: 'tool', value: 'heal' },
        points: 10
      },
      {
        id: 'pop_50',
        name: 'Thriving Ecosystem',
        description: 'Reach 50 creatures',
        category: 'population',
        check: (world) => world.creatures.length >= 50,
        reward: { type: 'tool', value: 'boost' },
        points: 20
      },
      {
        id: 'pop_100',
        name: 'Megafauna Paradise',
        description: 'Reach 100 creatures',
        category: 'population',
        check: (world) => world.creatures.length >= 100,
        reward: { type: 'feature', value: 'advanced_analytics' },
        points: 50
      },
      
      // Genetic Achievements
      {
        id: 'first_mutation',
        name: 'Evolution in Action',
        description: 'Witness a rare genetic mutation',
        category: 'genetics',
        check: (world) => world.creatures.some(c => c.rareMutations && c.rareMutations.length > 0),
        reward: { type: 'feature', value: 'gene_viewer' },
        points: 15
      },
      {
        id: 'legendary_mutation',
        name: 'Legendary Lineage',
        description: 'Create a creature with a legendary mutation',
        category: 'genetics',
        check: (world) => world.creatures.some(c => 
          c.rareMutations?.some(m => m.rarity === 'legendary')
        ),
        reward: { type: 'skin', value: 'cosmic' },
        points: 75
      },
      {
        id: 'chimera',
        name: 'Against Nature',
        description: 'Witness the mythic Chimera mutation',
        category: 'genetics',
        check: (world) => world.creatures.some(c => c.genes?.chimera),
        reward: { type: 'particles', value: 'mythic' },
        points: 100
      },
      
      // Survival Achievements
      {
        id: 'elder_5',
        name: 'Wisdom of Ages',
        description: 'Have 5 elders alive simultaneously',
        category: 'survival',
        check: (world) => world.creatures.filter(c => c.ageStage === 'elder').length >= 5,
        reward: { type: 'biome', value: 'ancient_grove' },
        points: 30
      },
      {
        id: 'generation_10',
        name: 'Dynasty',
        description: 'Reach generation 10',
        category: 'survival',
        check: (world) => world.creatures.some(c => c.generation >= 10),
        reward: { type: 'feature', value: 'family_tree' },
        points: 40
      },
      
      // Ecosystem Achievements
      {
        id: 'balanced_ecosystem',
        name: 'Perfect Balance',
        description: 'Maintain 10-20 predators with 50+ herbivores for 60s',
        category: 'ecosystem',
        isTimeBased: true,
        duration: 60,
        check: (world) => {
          const preds = world.creatures.filter(c => c.genes?.predator).length;
          const herbs = world.creatures.filter(c => !c.genes?.predator).length;
          return preds >= 10 && preds <= 20 && herbs >= 50;
        },
        reward: { type: 'biome', value: 'eden' },
        points: 60
      },
      {
        id: 'diversity_master',
        name: 'Genetic Tapestry',
        description: 'Have 10 distinct hue families',
        category: 'ecosystem',
        check: (world) => {
          const hues = new Set(world.creatures.map(c => Math.floor((c.genes?.hue ?? 0) / 36)));
          return hues.size >= 10;
        },
        reward: { type: 'particles', value: 'rainbow' },
        points: 35
      },
      
      // Behavior Achievements
      {
        id: 'pack_hunter',
        name: 'Apex Predators',
        description: 'Witness coordinated pack hunting',
        category: 'behavior',
        check: (world) => world.packHuntingOccurred === true,
        reward: { type: 'feature', value: 'behavior_analytics' },
        points: 25
      },
      {
        id: 'schooling',
        name: 'Safety in Numbers',
        description: 'Observe a school of 15+ herbivores',
        category: 'behavior',
        check: (world) => {
          // Check for clusters of herbivores
          const herbs = world.creatures.filter(c => !c.genes?.predator);
          if (herbs.length < 15) return false;
          
          // Simple clustering check
          return herbs.some(h1 => 
            herbs.filter(h2 => {
              const dx = h1.x - h2.x;
              const dy = h1.y - h2.y;
              return dx * dx + dy * dy < 100 * 100;
            }).length >= 15
          );
        },
        reward: { type: 'feature', value: 'social_network_view' },
        points: 20
      },
      
      // Biome Achievements
      {
        id: 'adaptation_master',
        name: 'Master of Environment',
        description: 'Have a creature adapted to 5 biomes',
        category: 'biome',
        check: (world) => world.creatures.some(c => 
          c.biomeAdaptations && Object.keys(c.biomeAdaptations).length >= 5
        ),
        reward: { type: 'biome', value: 'nexus' },
        points: 55
      },
      
      // Special Achievements
      {
        id: 'speed_demon',
        name: 'Speedster',
        description: 'Evolve a creature with speed > 2.0',
        category: 'special',
        check: (world) => world.creatures.some(c => (c.genes?.speed ?? 1) > 2.0),
        reward: { type: 'particles', value: 'speed_lines' },
        points: 30
      },
      {
        id: 'mega_sense',
        name: 'All-Seeing',
        description: 'Evolve a creature with sense > 250',
        category: 'special',
        check: (world) => world.creatures.some(c => (c.genes?.sense ?? 100) > 250),
        reward: { type: 'feature', value: 'omniscient_view' },
        points: 35
      },
      {
        id: 'personality_collector',
        name: 'Personality Study',
        description: 'Observe 10 different personality quirks',
        category: 'special',
        check: (world, system) => {
          const quirks = new Set();
          world.creatures.forEach(c => {
            c.personality?.quirks?.forEach(q => quirks.add(q.name));
          });
          return quirks.size >= 10;
        },
        reward: { type: 'feature', value: 'personality_inspector' },
        points: 40
      },
      
      // Mastery Achievements
      {
        id: 'first_ascension',
        name: 'Transcendence',
        description: 'Reach challenge level 10',
        category: 'mastery',
        check: (world, system) => system?.challengeSystem?.level >= 10,
        reward: { type: 'skin', value: 'ascended' },
        points: 80
      },
      {
        id: 'collector',
        name: 'Achievement Hunter',
        description: 'Unlock 25 achievements',
        category: 'mastery',
        check: (world, system) => system?.unlockedAchievements?.size >= 25,
        reward: { type: 'soundPack', value: 'premium' },
        points: 90
      },
      {
        id: 'master',
        name: 'Ecosystem Master',
        description: 'Unlock all achievements',
        category: 'mastery',
        check: (world, system) => {
          const totalAchievements = system?.achievements?.length ?? 0;
          return system?.unlockedAchievements?.size >= totalAchievements - 1; // -1 for this achievement
        },
        reward: { type: 'skin', value: 'master' },
        points: 200
      }
    ];
  }

  /**
   * Update achievement progress
   */
  update(world, systems = {}) {
    for (const achievement of this.achievements) {
      if (this.unlockedAchievements.has(achievement.id)) continue;
      
      // Initialize progress for time-based achievements
      if (achievement.isTimeBased && !this.progress[achievement.id]) {
        this.progress[achievement.id] = 0;
      }
      
      // Check achievement condition
      const conditionMet = achievement.check(world, this);
      
      if (achievement.isTimeBased) {
        if (conditionMet) {
          this.progress[achievement.id] += 1/60; // Assume 60 FPS
          if (this.progress[achievement.id] >= achievement.duration) {
            this.unlockAchievement(achievement, world);
          }
        } else {
          this.progress[achievement.id] = 0;
        }
      } else if (conditionMet) {
        this.unlockAchievement(achievement, world);
      }
    }
  }

  /**
   * Unlock an achievement and apply rewards
   */
  unlockAchievement(achievement, world) {
    this.unlockedAchievements.add(achievement.id);
    
    console.log(`🏆 Achievement Unlocked: ${achievement.name}`);
    console.log(`   ${achievement.description}`);
    console.log(`   +${achievement.points} points`);
    
    // Apply reward
    if (achievement.reward) {
      this.applyReward(achievement.reward);
      console.log(`   🎁 Unlocked: ${achievement.reward.type} - ${achievement.reward.value}`);
    }
    
    // Trigger achievement notification
    if (world.notificationSystem) {
      world.notificationSystem.show(
        `🏆 ${achievement.name}`,
        `${achievement.description}\n+${achievement.points} pts`,
        3000,
        'achievement'
      );
    }
  }

  /**
   * Apply unlocked reward
   */
  applyReward(reward) {
    const { type, value } = reward;
    
    if (this.unlocks[type + 's']) {
      this.unlocks[type + 's'].add(value);
    } else if (this.unlocks[type]) {
      this.unlocks[type].add(value);
    }
  }

  /**
   * Check if something is unlocked
   */
  isUnlocked(type, value) {
    const pluralType = type + 's';
    if (this.unlocks[pluralType]) {
      return this.unlocks[pluralType].has(value);
    }
    if (this.unlocks[type]) {
      return this.unlocks[type].has(value);
    }
    return false;
  }

  /**
   * Get achievement progress for UI
   */
  getAchievementProgress() {
    const total = this.achievements.length;
    const unlocked = this.unlockedAchievements.size;
    const percentage = (unlocked / total) * 100;
    
    return {
      total,
      unlocked,
      percentage: percentage.toFixed(1),
      points: this.getTotalPoints()
    };
  }

  /**
   * Get total achievement points
   */
  getTotalPoints() {
    return this.achievements
      .filter(a => this.unlockedAchievements.has(a.id))
      .reduce((sum, a) => sum + a.points, 0);
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory() {
    const categories = {};
    
    for (const achievement of this.achievements) {
      if (!categories[achievement.category]) {
        categories[achievement.category] = [];
      }
      categories[achievement.category].push({
        ...achievement,
        unlocked: this.unlockedAchievements.has(achievement.id),
        progress: this.progress[achievement.id] || 0
      });
    }
    
    return categories;
  }

  /**
   * Draw achievement notification panel
   */
  drawPanel(ctx, x, y, width = 300) {
    const progress = this.getAchievementProgress();
    
    ctx.save();
    ctx.fillStyle = 'rgba(30, 30, 45, 0.9)';
    ctx.fillRect(x, y, width, 60);
    
    // Title
    ctx.fillStyle = '#ffdd88';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('🏆 Achievements', x + 10, y + 20);
    
    // Progress
    ctx.fillStyle = '#cccccc';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${progress.unlocked}/${progress.total} (${progress.percentage}%)`, x + 10, y + 40);
    
    // Points
    ctx.fillStyle = '#88ff88';
    ctx.fillText(`${progress.points} points`, x + width - 90, y + 40);
    
    // Progress bar
    ctx.fillStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.fillRect(x + 10, y + 48, width - 20, 8);
    
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(x + 10, y + 48, (width - 20) * (progress.unlocked / progress.total), 8);
    
    ctx.restore();
  }
}

export const unlockableAchievements = new UnlockableAchievements();
