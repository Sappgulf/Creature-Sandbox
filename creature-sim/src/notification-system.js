// Toast notification system for milestones and events
// Redesigned for minimal, non-intrusive notifications

export class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.milestones = {
      population: [100, 250, 500, 1000, 2500, 5000],
      extinctionWarning: 10,
      herbivoreExtinct: true,
      predatorExtinct: true
    };
    this.triggeredMilestones = new Set();
    this._lastPopulations = { herbivores: 0, predators: 0 };
    this._firstEventToasts = new Set();

    // === NEW: Notification filtering ===
    this.showPerformanceAlerts = false;
    this.showMilestones = true;
    this.showAchievements = true;
    this.maxVisible = 3;
    this.defaultDuration = 2500;
    this.renderDomToasts = false;
    this.queue = [];
    this.recentMessages = new Map();
  }

  checkMilestones(world) {
    const pop = world.creatures.length;

    // Population milestones
    for (const milestone of this.milestones.population) {
      if (pop >= milestone && !this.triggeredMilestones.has(`pop_${milestone}`)) {
        this.addNotification({
          type: 'milestone',
          title: '🎉 Population Milestone!',
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

    // Species composition milestones
    let herbivores = 0;
    let predators = 0;
    for (let i = 0; i < world.creatures.length; i++) {
      if (world.creatures[i].genes?.predator) predators++;
      else herbivores++;
    }

    if (herbivores === 0 && pop > 0 && !this.triggeredMilestones.has('herbivore_extinct')) {
      this.addNotification({ type: 'warning', title: 'Herbivores Extinct!', message: 'Only predators remain. Ecosystem collapsing.', duration: 5000 });
      this.triggeredMilestones.add('herbivore_extinct');
    }
    if (herbivores > 0) this.triggeredMilestones.delete('herbivore_extinct');

    if (predators === 0 && pop > 0 && !this.triggeredMilestones.has('predator_extinct')) {
      this.addNotification({ type: 'info', title: 'Predators Extinct', message: 'Only herbivores remain. Peaceful times.', duration: 4000 });
      this.triggeredMilestones.add('predator_extinct');
    }
    if (predators > 0) this.triggeredMilestones.delete('predator_extinct');

    // First-event toasts
    if (pop >= 2 && !this._firstEventToasts.has('first_birth')) {
      this.addNotification({ type: 'milestone', title: '', message: 'Your ecosystem is growing!', duration: 3000 });
      this._firstEventToasts.add('first_birth');
    }

    this._lastPopulations = { herbivores, predators };
  }

  addNotification({ type = 'info', title = '', message = '', duration = null }) {
    // === NEW: Filter notifications by type ===
    if (type === 'performance' && !this.showPerformanceAlerts) return;
    if (type === 'warning' && message.includes('FPS') && !this.showPerformanceAlerts) return;
    if (type === 'milestone' && !this.showMilestones) return;
    if (type === 'achievement' && !this.showAchievements) return;
    if (this._isDuplicateToast(type, message)) return;

    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
      createdAt: performance.now(),
      duration: duration || this.defaultDuration,
      priority: this._priorityForType(type),
      opacity: 0,
      slideIn: 0
    };

    if (this.notifications.length >= this.maxVisible) {
      const lowestIndex = this._lowestVisiblePriorityIndex();
      const lowest = this.notifications[lowestIndex];
      if (lowest && notification.priority > lowest.priority) {
        const [deferred] = this.notifications.splice(lowestIndex, 1, notification);
        this.queue.unshift(deferred);
        this._announce(notification);
      } else if (this.queue.length < 8) {
        this.queue.push(notification);
      }
    } else {
      this.notifications.push(notification);
      this._announce(notification);
    }

    // Also create an accessible DOM toast
    this._createDomToast(notification);
  }

  _priorityForType(type) {
    const priorities = {
      error: 6,
      warning: 5,
      achievement: 4,
      milestone: 4,
      success: 3,
      event: 3,
      info: 2,
      performance: 1
    };
    return priorities[type] ?? 2;
  }

  _lowestVisiblePriorityIndex() {
    let lowestIndex = 0;
    let lowestPriority = Infinity;
    this.notifications.forEach((notification, index) => {
      const priority = notification.priority ?? this._priorityForType(notification.type);
      if (priority < lowestPriority) {
        lowestPriority = priority;
        lowestIndex = index;
      }
    });
    return lowestIndex;
  }

  _isDuplicateToast(type, message) {
    const key = `${type}:${message}`;
    const now = performance.now();
    const last = this.recentMessages.get(key) || 0;
    for (const [existingKey, timestamp] of this.recentMessages) {
      if (now - timestamp > 10000) this.recentMessages.delete(existingKey);
    }
    this.recentMessages.set(key, now);
    return now - last < 1400;
  }

  _announce(notif) {
    const announcer = document.getElementById('sim-announcer');
    if (!announcer) return;
    const text = notif.title ? `${notif.title} ${notif.message}`.trim() : notif.message;
    // Narrative events for screen readers: milestones, warnings, achievements, and key ecosystem events
    const narrativeTypes = new Set(['warning', 'milestone', 'achievement', 'info', 'event']);
    if (narrativeTypes.has(notif.type)) {
      announcer.textContent = text;
      // Auto-clear after a short delay so repeated events are announced
      setTimeout(() => {
        if (announcer.textContent === text) announcer.textContent = '';
      }, 6000);
    }
  }

  /**
   * Announce a narrative ecosystem event for screen readers.
   * @param {string} message
   * @param {string} [type='info']
   */
  announceNarrative(message, _type = 'info') {
    const announcer = document.getElementById('sim-announcer');
    if (!announcer) return;
    announcer.textContent = message;
    setTimeout(() => {
      if (announcer.textContent === message) announcer.textContent = '';
    }, 8000);
  }

  _createDomToast(notif) {
    if (typeof document === 'undefined') return;
    if (!this.renderDomToasts) return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-label', 'Notifications');
      container.style.cssText = 'position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:3000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `toast toast-${notif.type}`;
    el.style.cssText = 'padding:10px 18px;border-radius:999px;font:600 13px system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.4);backdrop-filter:blur(8px);opacity:0;transform:translateY(-12px);transition:opacity 0.25s ease,transform 0.25s ease;max-width:320px;text-align:center;pointer-events:auto;';

    const colors = {
      warning: { bg: 'rgba(245,158,11,0.92)', text: '#1a1a1a' },
      milestone: { bg: 'rgba(34,197,94,0.92)', text: '#ffffff' },
      achievement: { bg: 'rgba(139,92,246,0.92)', text: '#ffffff' },
      success: { bg: 'rgba(34,197,94,0.92)', text: '#ffffff' },
      error: { bg: 'rgba(239,68,68,0.92)', text: '#ffffff' },
      info: { bg: 'rgba(15,23,42,0.94)', text: '#e2e8f0' },
      performance: { bg: 'rgba(220,38,38,0.9)', text: '#ffffff' }
    };
    const color = colors[notif.type] || colors.info;
    el.style.background = color.bg;
    el.style.color = color.text;
    el.style.border = '1px solid rgba(255,255,255,0.15)';

    const text = notif.title ? `${notif.title} ${notif.message}`.trim() : notif.message;
    el.textContent = text;

    container.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });

    // Remove after duration
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-12px)';
      setTimeout(() => el.remove(), 300);
    }, notif.duration);
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

  update(_dt) {
    const now = performance.now();

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const notif = this.notifications[i];
      const age = now - notif.createdAt;

      // Slide in during first 200ms
      if (age < 200) {
        notif.slideIn = age / 200;
        notif.opacity = notif.slideIn;
      } else if (age < notif.duration - 400) {
        // Fully visible
        notif.slideIn = 1;
        notif.opacity = 1;
      } else if (age < notif.duration) {
        // Fade out in last 400ms
        notif.opacity = (notif.duration - age) / 400;
        notif.slideIn = 1;
      }

      // Remove expired notifications
      if (age >= notif.duration) {
        this.notifications.splice(i, 1);
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next.createdAt = performance.now();
          this.notifications.push(next);
          this._announce(next);
        }
      }
    }
  }

  draw(ctx, viewportWidth, _viewportHeight, options = {}) {
    if (this.notifications.length === 0) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const layoutWidth = Number(options.layoutWidth || viewportWidth);
    const layoutHeight = Number(options.layoutHeight || _viewportHeight);
    const pixelRatio = layoutWidth > 0 ? viewportWidth / layoutWidth : 1;
    const compactViewport = layoutWidth <= 520;
    const objectiveRailVisible = !!options.objectiveRailVisible;
    const bottomChrome = Number(options.bottomChrome || 0);
    const visibleCount = Math.min(this.notifications.length, compactViewport ? 1 : this.maxVisible);
    const startY = (compactViewport ? 112 : 100) * pixelRatio;
    const spacing = (compactViewport ? 38 : 44) * pixelRatio;
    const railAwareTypes = new Set(['info', 'milestone', 'success', 'event']);

    for (let i = 0; i < visibleCount; i++) {
      const notif = this.notifications[i];
      const priority = notif.priority ?? this._priorityForType(notif.type);
      const useEdgeLane = objectiveRailVisible && railAwareTypes.has(notif.type) && priority <= 4;
      const cssX = useEdgeLane
        ? (compactViewport ? layoutWidth / 2 : Math.max(150, layoutWidth - 172))
        : layoutWidth / 2;
      const cssY = useEdgeLane
        ? Math.max(
          compactViewport ? 150 : 132,
          layoutHeight - Math.max(bottomChrome, compactViewport ? 92 : 72) - (compactViewport ? 52 : 58) - (i * (compactViewport ? 34 : 42))
        )
        : ((compactViewport ? 112 : 100) + (i * (compactViewport ? 38 : 44)));
      const x = cssX * pixelRatio;
      const y = useEdgeLane ? cssY * pixelRatio : startY + (i * spacing);

      this._drawNotification(ctx, notif, x, y, viewportWidth, {
        layoutWidth,
        pixelRatio,
        edgeLane: useEdgeLane
      });
    }

    ctx.restore();
  }

  _drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  _fitText(ctx, text, maxWidth) {
    const label = String(text || '').trim();
    if (!label || ctx.measureText(label).width <= maxWidth) return label;

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

  _drawNotification(ctx, notif, x, y, viewportWidth = 1024, options = {}) {
    ctx.save();
    ctx.globalAlpha = notif.opacity * 0.95;

    // Apply slide-in animation (slide down from above)
    const pixelRatio = Number(options.pixelRatio || 1);
    const layoutWidth = Number(options.layoutWidth || viewportWidth);
    const slideOffset = (1 - (notif.slideIn || 1)) * -20 * pixelRatio;
    y += slideOffset;

    // Compact pill design
    const compactViewport = layoutWidth <= 520;
    const width = compactViewport
      ? Math.min(210 * pixelRatio, viewportWidth - (56 * pixelRatio))
      : (options.edgeLane ? 230 : 260) * pixelRatio;
    const height = (compactViewport ? 30 : 38) * pixelRatio;
    const radius = height / 2;

    // Enhanced colors with better contrast
    const colors = {
      warning: { bg: 'rgba(245, 158, 11, 0.92)', text: '#1a1a1a', glow: 'rgba(245, 158, 11, 0.3)' },
      milestone: { bg: 'rgba(34, 197, 94, 0.92)', text: '#ffffff', glow: 'rgba(34, 197, 94, 0.3)' },
      achievement: { bg: 'rgba(139, 92, 246, 0.92)', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.3)' },
      success: { bg: 'rgba(34, 197, 94, 0.92)', text: '#ffffff', glow: 'rgba(34, 197, 94, 0.3)' },
      error: { bg: 'rgba(239, 68, 68, 0.92)', text: '#ffffff', glow: 'rgba(239, 68, 68, 0.3)' },
      info: { bg: 'rgba(15, 23, 42, 0.94)', text: '#e2e8f0', glow: 'rgba(0, 212, 255, 0.15)' },
      performance: { bg: 'rgba(220, 38, 38, 0.9)', text: '#ffffff', glow: 'rgba(220, 38, 38, 0.3)' }
    };
    const color = colors[notif.type] || colors.info;

    // Rounded pill background with subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x - width / 2, y - height / 2, width, height, radius);
    } else {
      this._drawRoundedRect(ctx, x - width / 2, y - height / 2, width, height, radius);
    }
    ctx.fillStyle = color.bg;
    ctx.fill();

    // Subtle border glow
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Combined title + message on single line
    ctx.fillStyle = color.text;
    ctx.font = `600 ${(compactViewport ? 12 : 13) * pixelRatio}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayText = notif.title
      ? `${notif.title} ${notif.message}`.trim()
      : notif.message;
    const fittedText = this._fitText(ctx, displayText, width - (30 * pixelRatio));
    ctx.fillText(fittedText, x, y);

    ctx.restore();
  }

  reset() {
    this.notifications = [];
    this.queue = [];
    this.recentMessages.clear();
    this.triggeredMilestones.clear();
    this._firstEventToasts.clear();
    this._lastPopulations = { herbivores: 0, predators: 0 };
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
