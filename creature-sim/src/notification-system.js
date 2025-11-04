// Toast notification system for milestones and events

export class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.milestones = {
      population: [50, 100, 250, 500, 1000, 2500, 5000],
      extinctionWarning: 10,
      herbivoreExtinct: true,
      predatorExtinct: true
    };
    this.triggeredMilestones = new Set();
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

  addNotification({ type = 'info', title = '', message = '', duration = 3000 }) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
      createdAt: performance.now(),
      duration,
      opacity: 1.0
    };
    
    this.notifications.push(notification);
    
    // Limit to 5 notifications
    if (this.notifications.length > 5) {
      this.notifications.shift();
    }
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
    
    const startY = viewportHeight - 120; // Above bottom
    const spacing = 60;
    
    for (let i = 0; i < this.notifications.length; i++) {
      const notif = this.notifications[i];
      const y = startY - (i * spacing);
      
      this._drawNotification(ctx, notif, viewportWidth / 2, y);
    }
    
    ctx.restore();
  }

  _drawNotification(ctx, notif, x, y) {
    ctx.save();
    ctx.globalAlpha = notif.opacity;
    
    // Background
    const width = 280;
    const height = 50;
    ctx.fillStyle = notif.type === 'warning' 
      ? 'rgba(248, 113, 113, 0.95)' 
      : 'rgba(34, 197, 94, 0.95)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    
    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
    
    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(notif.title, x, y - 10);
    
    // Message
    ctx.font = '12px sans-serif';
    ctx.fillText(notif.message, x, y + 8);
    
    ctx.restore();
  }

  reset() {
    this.notifications = [];
    this.triggeredMilestones.clear();
  }
}

