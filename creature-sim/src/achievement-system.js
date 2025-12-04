// Achievement System - Goals, progression, XP, and challenges

export class AchievementSystem {
  constructor() {
    this.achievements = new Map();
    this.xp = 0;
    this.level = 1;
    this.unlocked = new Set();
    this.notificationStylesInjected = false;
    
    // Define achievements
    this.defineAchievements();
    
    // Load progress
    this.loadProgress();
  }

  defineAchievements() {
    // Discovery achievements (one-time events)
    this.addAchievement({
      id: 'first_predator',
      name: 'Apex Predator',
      description: 'Witness a predator successfully hunt prey',
      icon: '🦁',
      xp: 10,
      type: 'discovery',
      check: (world) => {
        // Check if any creature has kills > 0
        if (!world || !world.creatures) return false;
        return world.creatures.some(c => c && c.stats && c.stats.kills > 0);
      }
    });

    this.addAchievement({
      id: 'speciation',
      name: 'New Species',
      description: 'See genetic clustering create distinct groups',
      icon: '🧬',
      xp: 15,
      type: 'discovery'
    });

    this.addAchievement({
      id: 'extinction',
      name: 'Mass Extinction',
      description: 'All creatures die (natural selection)',
      icon: '☠️',
      xp: 5,
      type: 'discovery',
      check: (world) => world && world.creatures && world.creatures.length === 0 && world.t > 30
    });

    this.addAchievement({
      id: 'super_lineage',
      name: 'Dynasty',
      description: 'One family reaches 50+ descendants',
      icon: '👑',
      xp: 25,
      type: 'milestone',
      check: (world, tracker) => {
        if (!tracker || !world || !world.creatures) return false;
        try {
          let maxDescendants = 0;
          for (const creature of world.creatures) {
            if (!creature || !creature.id) continue;
            try {
              const root = tracker.getRoot(world, creature.id);
              if (root && world.descendantsOf) {
                const descendants = world.descendantsOf(root);
                if (descendants && descendants.size > maxDescendants) {
                  maxDescendants = descendants.size;
                }
              }
            } catch (e) {
              // Skip this creature if lineage check fails
              continue;
            }
          }
          return maxDescendants >= 50;
        } catch (e) {
          return false;
        }
      }
    });

    this.addAchievement({
      id: 'ancient_one',
      name: 'Ancient',
      description: 'A creature survives 200+ seconds',
      icon: '🦕',
      xp: 20,
      type: 'milestone',
      check: (world) => world && world.creatures && world.creatures.some(c => c && c.age >= 200)
    });

    this.addAchievement({
      id: 'population_100',
      name: 'Thriving Ecosystem',
      description: 'Population reaches 100 creatures',
      icon: '🌿',
      xp: 15,
      type: 'milestone',
      check: (world) => world && world.creatures && world.creatures.length >= 100
    });

    this.addAchievement({
      id: 'population_500',
      name: 'Population Explosion',
      description: 'Population reaches 500 creatures',
      icon: '💥',
      xp: 30,
      type: 'milestone',
      check: (world) => world && world.creatures && world.creatures.length >= 500
    });

    this.addAchievement({
      id: 'balanced_ecosystem',
      name: 'Perfect Balance',
      description: 'Maintain 3+ species types for 5 minutes',
      icon: '⚖️',
      xp: 25,
      type: 'challenge'
    });

    this.addAchievement({
      id: 'tutorial_complete',
      name: 'Learned the Ropes',
      description: 'Complete the tutorial',
      icon: '🎓',
      xp: 10,
      type: 'discovery'
    });

    this.addAchievement({
      id: 'god_intervention',
      name: 'Divine Intervention',
      description: 'Use god mode tools 10 times',
      icon: '⚡',
      xp: 10,
      type: 'milestone',
      check: () => (window.godModeActionCount || 0) >= 10
    });
  }

  addAchievement(def) {
    this.achievements.set(def.id, {
      ...def,
      unlocked: false,
      unlockedAt: null
    });
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

  /**
   * Update method - alias for check() for compatibility with game loop
   * @param {Object} world - The world object
   * @param {Object} tracker - Optional lineage tracker
   */
  update(world, tracker = null) {
    this.check(world, tracker);
  }

  // Check and unlock achievements
  check(world, tracker = null) {
    if (!world || !world.creatures) return; // Safety check
    
    try {
      for (const [id, achievement] of this.achievements) {
        if (!achievement || achievement.unlocked) continue;
        
        let shouldUnlock = false;
        
        if (achievement.check) {
          try {
            shouldUnlock = achievement.check(world, tracker);
          } catch (e) {
            console.warn(`Achievement check failed for ${id}:`, e);
            shouldUnlock = false;
          }
        }
        
        if (shouldUnlock) {
          this.unlock(id);
        }
      }
    } catch (e) {
      console.warn('Achievement system error:', e);
    }
  }

  // Unlock an achievement
  unlock(id) {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.unlocked) return;
    
    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();
    this.unlocked.add(id);
    this.xp += achievement.xp;
    
    // Level up calculation (every 100 XP = 1 level)
    const newLevel = Math.floor(this.xp / 100) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      console.log(`🎉 Level Up! Now level ${this.level}`);
    }
    
    // Show notification
    this.showNotification(achievement);
    
    // Save progress
    this.saveProgress();
    
    console.log(`🏆 Achievement Unlocked: ${achievement.name} (+${achievement.xp} XP)`);
  }

  // Show achievement notification
  showNotification(achievement) {
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
    return {
      total,
      unlocked,
      percentage: (unlocked / total) * 100,
      xp: this.xp,
      level: this.level,
      nextLevelXP: this.level * 100
    };
  }

  // Save progress to localStorage
  saveProgress() {
    try {
      const data = {
        unlocked: Array.from(this.unlocked),
        xp: this.xp,
        level: this.level,
        achievements: {}
      };
      
      for (const [id, achievement] of this.achievements) {
        if (achievement.unlocked) {
          data.achievements[id] = {
            unlockedAt: achievement.unlockedAt
          };
        }
      }
      
      localStorage.setItem('achievements', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save achievements:', e);
    }
  }

  // Load progress from localStorage
  loadProgress() {
    try {
      const saved = localStorage.getItem('achievements');
      if (saved) {
        const data = JSON.parse(saved);
        this.unlocked = new Set(data.unlocked || []);
        this.xp = data.xp || 0;
        this.level = data.level || 1;
        
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
      }
    } catch (e) {
      console.warn('Failed to load achievements:', e);
    }
  }
}
