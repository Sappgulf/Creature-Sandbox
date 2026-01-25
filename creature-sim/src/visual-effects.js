/**
 * Enhanced Visual Effects - Polished particles, transitions, and feedback
 */

export class VisualEffects {
  constructor() {
    this.effects = [];
    this.ripples = [];
    this.trails = [];
  }

  /**
   * Create a birth effect - sparkles and expanding circle
   */
  createBirthEffect(x, y, hue) {
    // Expanding circle
    this.effects.push({
      type: 'expand',
      x, y,
      radius: 5,
      maxRadius: 30,
      speed: 60,
      color: `hsl(${hue}, 80%, 70%)`,
      alpha: 1,
      life: 0.5
    });
    
    // Sparkle particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.effects.push({
        type: 'sparkle',
        x, y,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40,
        size: 2 + Math.random() * 2,
        color: `hsl(${hue}, 90%, 80%)`,
        alpha: 1,
        life: 0.6 + Math.random() * 0.4
      });
    }
  }

  /**
   * Create a death effect - fade and particles
   */
  createDeathEffect(x, y, hue, isPredator) {
    // Cross/X mark for death
    this.effects.push({
      type: 'death-mark',
      x, y,
      size: 20,
      rotation: 0,
      rotationSpeed: 2,
      color: isPredator ? '#ff5555' : '#888888',
      alpha: 1,
      life: 1.2
    });
    
    // Falling particles
    for (let i = 0; i < 8; i++) {
      this.effects.push({
        type: 'fall',
        x: x + (Math.random() - 0.5) * 10,
        y,
        vy: 20 + Math.random() * 30,
        size: 1 + Math.random() * 2,
        color: `hsl(${hue}, 60%, 50%)`,
        alpha: 0.8,
        life: 1 + Math.random()
      });
    }
  }

  /**
   * Create eating effect - nom particles
   */
  createEatingEffect(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.effects.push({
        type: 'nom',
        x, y,
        vx: Math.cos(angle) * 20,
        vy: Math.sin(angle) * 20 - 10,
        size: 2 + Math.random(),
        color: color || '#88ff88',
        alpha: 1,
        life: 0.5 + Math.random() * 0.3
      });
    }
  }

  /**
   * Create mating effect - hearts
   */
  createMatingEffect(x, y, hue) {
    for (let i = 0; i < 3; i++) {
      this.effects.push({
        type: 'heart',
        x: x + (Math.random() - 0.5) * 10,
        y: y - 10,
        vy: -30 - Math.random() * 20,
        size: 4 + Math.random() * 3,
        color: `hsl(${hue}, 100%, 70%)`,
        alpha: 1,
        life: 1 + Math.random() * 0.5,
        wobble: Math.random() * Math.PI * 2
      });
    }
  }

  /**
   * Create level up / evolution effect
   */
  createEvolutionEffect(x, y, hue) {
    // Upward spiral
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 4;
      const delay = i * 0.02;
      this.effects.push({
        type: 'spiral',
        x, y,
        angle,
        radius: 5,
        radiusGrowth: 30,
        vy: -50,
        color: `hsl(${hue}, 100%, 60%)`,
        alpha: 1,
        life: 1.5,
        delay
      });
    }
    
    // Star burst
    this.effects.push({
      type: 'starburst',
      x, y,
      rays: 8,
      length: 40,
      color: '#ffffff',
      alpha: 1,
      life: 0.8
    });
  }

  /**
   * Create combat hit effect
   */
  createHitEffect(x, y, damage) {
    // Impact flash
    this.effects.push({
      type: 'flash',
      x, y,
      radius: 15,
      color: '#ff3333',
      alpha: 0.8,
      life: 0.3
    });
    
    // Damage number
    this.effects.push({
      type: 'damage-number',
      x, y: y - 10,
      text: Math.floor(damage).toString(),
      vy: -40,
      color: '#ff5555',
      alpha: 1,
      life: 1
    });
  }

  /**
   * Create water ripple effect
   */
  createRipple(x, y) {
    this.ripples.push({
      x, y,
      radius: 2,
      maxRadius: 30,
      speed: 50,
      alpha: 0.4,
      life: 0.6
    });
  }

  /**
   * Update all effects
   */
  update(dt) {
    // Update effects
    this.effects = this.effects.filter(effect => {
      if (effect.delay) {
        effect.delay -= dt;
        return true;
      }
      
      effect.life -= dt;
      if (effect.life <= 0) return false;
      
      // Update based on type
      switch (effect.type) {
        case 'expand':
          effect.radius += effect.speed * dt;
          effect.alpha = effect.life / 0.5;
          break;
          
        case 'sparkle':
        case 'nom':
        case 'fall':
          effect.x += effect.vx * dt;
          effect.y += effect.vy * dt;
          effect.vy += 50 * dt; // Gravity
          effect.alpha = effect.life;
          break;
          
        case 'heart':
          effect.y += effect.vy * dt;
          effect.wobble += dt * 3;
          effect.alpha = effect.life;
          break;
          
        case 'spiral':
          effect.y += effect.vy * dt;
          effect.radius += effect.radiusGrowth * dt;
          effect.alpha = effect.life / 1.5;
          break;
          
        case 'death-mark':
          effect.rotation += effect.rotationSpeed * dt;
          effect.alpha = effect.life / 1.2;
          break;
          
        case 'flash':
          effect.alpha = effect.life / 0.3;
          break;
          
        case 'damage-number':
          effect.y += effect.vy * dt;
          effect.alpha = effect.life;
          break;
          
        case 'starburst':
          effect.alpha = effect.life / 0.8;
          break;
      }
      
      return true;
    });
    
    // Update ripples
    this.ripples = this.ripples.filter(ripple => {
      ripple.radius += ripple.speed * dt;
      ripple.life -= dt;
      ripple.alpha = (ripple.life / 0.6) * 0.4;
      return ripple.life > 0;
    });
  }

  /**
   * Draw all effects
   */
  draw(ctx) {
    for (const effect of this.effects) {
      if (effect.delay && effect.delay > 0) continue;
      
      ctx.save();
      ctx.globalAlpha = Math.max(0, effect.alpha);
      
      switch (effect.type) {
        case 'expand':
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
          
        case 'sparkle':
        case 'nom':
        case 'fall':
          ctx.fillStyle = effect.color;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'heart':
          ctx.fillStyle = effect.color;
          ctx.translate(effect.x + Math.sin(effect.wobble) * 3, effect.y);
          this.drawHeart(ctx, 0, 0, effect.size);
          break;
          
        case 'spiral':
          ctx.fillStyle = effect.color;
          const sx = effect.x + Math.cos(effect.angle) * effect.radius;
          const sy = effect.y + Math.sin(effect.angle) * effect.radius;
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'death-mark':
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 3;
          ctx.translate(effect.x, effect.y);
          ctx.rotate(effect.rotation);
          ctx.beginPath();
          ctx.moveTo(-effect.size/2, -effect.size/2);
          ctx.lineTo(effect.size/2, effect.size/2);
          ctx.moveTo(effect.size/2, -effect.size/2);
          ctx.lineTo(-effect.size/2, effect.size/2);
          ctx.stroke();
          break;
          
        case 'flash':
          ctx.fillStyle = effect.color;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'damage-number':
          ctx.fillStyle = effect.color;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(effect.text, effect.x, effect.y);
          break;
          
        case 'starburst':
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 2;
          for (let i = 0; i < effect.rays; i++) {
            const angle = (i / effect.rays) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(effect.x, effect.y);
            ctx.lineTo(
              effect.x + Math.cos(angle) * effect.length,
              effect.y + Math.sin(angle) * effect.length
            );
            ctx.stroke();
          }
          break;
      }
      
      ctx.restore();
    }
    
    // Draw ripples
    for (const ripple of this.ripples) {
      ctx.save();
      ctx.globalAlpha = ripple.alpha;
      ctx.strokeStyle = '#5599ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Helper to draw a heart shape
   */
  drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y - size / 2, x - size / 2, y);
    ctx.bezierCurveTo(x - size / 2, y + size / 3, x, y + size / 2, x, y + size);
    ctx.bezierCurveTo(x, y + size / 2, x + size / 2, y + size / 3, x + size / 2, y);
    ctx.bezierCurveTo(x + size / 2, y - size / 2, x, y, x, y + size / 4);
    ctx.fill();
  }

  /**
   * Clear all effects
   */
  clear() {
    this.effects = [];
    this.ripples = [];
  }
}

export const visualEffects = new VisualEffects();
