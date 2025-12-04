// Toast notification system for milestones and events
// Redesigned for minimal, non-intrusive notifications

export class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.milestones = {
      population: [100, 250, 500, 1000, 2500, 5000], // Removed 50, less spam
      extinctionWarning: 10,
      herbivoreExtinct: true,
      predatorExtinct: true
    };
    this.triggeredMilestones = new Set();
    
    // === NEW: Notification filtering ===
    this.showPerformanceAlerts = false;  // Hide FPS warnings by default
    this.showMilestones = true;
    this.showAchievements = true;
    this.maxVisible = 3;  // Reduced from 5
    this.defaultDuration = 2500;  // Shorter duration
  }

  checkMilestones(world) {
    const pop = world.creatures.length;
    
    // Population milestones
    for (const milestone of this.milestones.population) {
      if (pop >= milestone && !this.triggeredMilestones.has(`pop_${milestone}`)) {
        this.addNotification({
          type: 'milestone',
          title: `🎉 Population Milestone!`,
          message: `${pop} creatures alive!`,
          duration: 4000
        });
        this.triggeredMilestones.add(`pop_${milestone}`);
      }
    }
    
    // Extinction warning
    if (pop <= this.milestones.extinctionWarning && pop > 0 && !this.triggeredMilestones.has('extinction_warning')) {
      this.addNotification({
        type: 'warning',
        title: '⚠️ Extinction Warning!',
        message: `Only ${pop} creatures remaining!`,
        duration: 6000
      });
      this.triggeredMilestones.add('extinction_warning');
    }
    
    // Reset extinction warning if population recovers
    if (pop > this.milestones.extinctionWarning + 20) {
      this.triggeredMilestones.delete('extinction_warning');
    }
  }

  addNotification({ type = 'info', title = '', message = '', duration = null }) {
    // === NEW: Filter notifications by type ===
    if (type === 'performance' && !this.showPerformanceAlerts) return;
    if (type === 'warning' && message.includes('FPS') && !this.showPerformanceAlerts) return;
    if (type === 'milestone' && !this.showMilestones) return;
    if (type === 'achievement' && !this.showAchievements) return;
    
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
      createdAt: performance.now(),
      duration: duration || this.defaultDuration,
      opacity: 1.0
    };
    
    this.notifications.push(notification);
    
    // Limit notifications
    while (this.notifications.length > this.maxVisible) {
      this.notifications.shift();
    }
  }

  /**
   * Show a notification (convenience method)
   * @param {string} message - The message to display
   * @param {string} type - The type of notification (info, warning, achievement, performance, etc.)
   * @param {number} duration - How long to display in ms
   */
  show(message, type = 'info', duration = null) {
    this.addNotification({
      type,
      title: '',
      message,
      duration: duration || this.defaultDuration
    });
  }
  
  /**
   * Configure notification visibility
   */
  configure({ showPerformanceAlerts, showMilestones, showAchievements } = {}) {
    if (showPerformanceAlerts !== undefined) this.showPerformanceAlerts = showPerformanceAlerts;
    if (showMilestones !== undefined) this.showMilestones = showMilestones;
    if (showAchievements !== undefined) this.showAchievements = showAchievements;
  }

  update(dt) {
    const now = performance.now();
    
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const notif = this.notifications[i];
      const age = now - notif.createdAt;
      
      // Start fading in last 500ms
      if (age >= notif.duration - 500) {
        notif.opacity = (notif.duration - age) / 500;
      }
      
      // Remove expired notifications
      if (age >= notif.duration) {
        this.notifications.splice(i, 1);
      }
    }
  }

  draw(ctx, viewportWidth, viewportHeight) {
    if (this.notifications.length === 0) return;
    
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Position at top center - less intrusive, out of gameplay area
    const startY = 100;
    const spacing = 44;  // Tighter spacing for compact pills
    
    for (let i = 0; i < this.notifications.length; i++) {
      const notif = this.notifications[i];
      const y = startY + (i * spacing);
      
      this._drawNotification(ctx, notif, viewportWidth / 2, y);
    }
    
    ctx.restore();
  }

  _drawNotification(ctx, notif, x, y) {
    ctx.save();
    ctx.globalAlpha = notif.opacity * 0.95;
    
    // Smaller, more compact design
    const width = 240;
    const height = 36;
    const radius = 18;
    
    // Color based on type - more subtle colors
    const colors = {
      warning: { bg: 'rgba(251, 191, 36, 0.9)', text: '#1a1a1a' },
      milestone: { bg: 'rgba(34, 197, 94, 0.9)', text: '#ffffff' },
      achievement: { bg: 'rgba(139, 92, 246, 0.9)', text: '#ffffff' },
      info: { bg: 'rgba(18, 21, 29, 0.92)', text: '#e4e7eb' },
      performance: { bg: 'rgba(239, 68, 68, 0.85)', text: '#ffffff' }
    };
    const color = colors[notif.type] || colors.info;
    
    // Rounded pill background with subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, radius);
    ctx.fillStyle = color.bg;
    ctx.fill();
    
    // Subtle border glow
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Combined title + message on single line
    ctx.fillStyle = color.text;
    ctx.font = '600 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const displayText = notif.title 
      ? `${notif.title} ${notif.message}`.trim()
      : notif.message;
    ctx.fillText(displayText, x, y);
    
    ctx.restore();
  }

  reset() {
    this.notifications = [];
    this.triggeredMilestones.clear();
  }
}

// Lightweight type guard to verify a notification system instance
export function isNotificationSystem(candidate) {
  return !!candidate &&
    typeof candidate.show === 'function' &&
    typeof candidate.update === 'function' &&
    typeof candidate.draw === 'function' &&
    Array.isArray(candidate.notifications);
}
