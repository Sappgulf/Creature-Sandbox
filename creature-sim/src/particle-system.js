// Particle System for visual effects
// Handles birth sparkles, death markers, sleep particles, etc.
// OPTIMIZED: Uses swap-and-pop for O(1) particle removal instead of splice O(n)

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
    this.screenShake = { x: 0, y: 0, intensity: 0 };
    // Performance tracking
    this._particleCreated = 0;
    this._particleRemoved = 0;
  }

  /**
   * OPTIMIZATION: Get a particle object, reusing from pool or creating new
   * @returns {Object} Particle object
   */
  _createParticle(type, x, y, vx, vy, life, opts = {}) {
    this._particleCreated++;
    return {
      type,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size: opts.size || 2,
      color: opts.color || '#ffffff',
      opacity: opts.opacity || 1.0,
      ...opts
    };
  }

  // Add birth sparkles with color variation based on creature type
  addBirthEffect(x, y, diet = 0) {
    const sparkleCount = 12; // Increased from 8
    const hueBase = diet > 0.7 ? 0 : diet > 0.3 ? 45 : 120; // Red for predators, yellow for omnivores, green for herbivores
    
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const speed = 40 + Math.random() * 20;
      this.particles.push({
        type: 'sparkle',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15, // Upward bias
        life: 1.0 + Math.random() * 0.3,
        maxLife: 1.3,
        size: 2 + Math.random() * 3,
        color: `hsl(${hueBase + Math.random() * 30}, 100%, 70%)`,
        twinkle: true // Add twinkle effect
      });
    }
    
    // Add burst ring
    this.particles.push({
      type: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      size: 5,
      expandRate: 80, // Expands 80 units per second
      color: `hsl(${hueBase}, 80%, 60%)`,
      opacity: 0.8
    });
  }

  // Add death gravestone marker with enhanced visuals
  addDeathMarker(x, y, creatureName, diet = 0) {
    // Dust cloud on death
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.particles.push({
        type: 'dust',
        x,
        y,
        vx: Math.cos(angle) * (20 + Math.random() * 15),
        vy: Math.sin(angle) * (20 + Math.random() * 15) - 10,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 3 + Math.random() * 4,
        color: diet > 0.7 ? '#aa4444' : diet > 0.3 ? '#88aa44' : '#88aa88',
        opacity: 0.8
      });
    }
    
    // Gravestone marker
    this.particles.push({
      type: 'gravestone',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 5.0, // Lasts 5 seconds
      maxLife: 5.0,
      size: 12,
      opacity: 1.0,
      name: creatureName,
      fadeInTime: 0.3 // Fade in over 0.3 seconds
    });
  }

  // Add sleep Zzz particles
  addSleepParticle(x, y) {
    this.particles.push({
      type: 'sleep',
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: -15 - Math.random() * 10, // Float upward
      life: 1.5,
      maxLife: 1.5,
      size: 8,
      text: 'Z',
      opacity: 0.8
    });
  }

  // Add combat hit effects (blood splatter)
  addCombatHit(x, y, damage, isKill = false) {
    const particleCount = isKill ? 15 : 8;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 30 + 20) * (damage / 10);
      this.particles.push({
        type: 'blood',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color: isKill ? '#cc0000' : '#ff4444',
        opacity: 1.0
      });
    }
  }

  // Add food absorption particles (green particles flowing to creature)
  addFoodAbsorption(foodX, foodY, creatureX, creatureY) {
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      this.particles.push({
        type: 'food',
        x: foodX + (Math.random() - 0.5) * 8,
        y: foodY + (Math.random() - 0.5) * 8,
        targetX: creatureX,
        targetY: creatureY,
        vx: 0,
        vy: 0,
        life: 0.4,
        maxLife: 0.4,
        size: 2 + Math.random() * 2,
        color: '#44ff44',
        opacity: 1.0,
        delay: t * 0.05 // Stagger particles
      });
    }
  }

  // Add evolution milestone effect (golden glow)
  addEvolutionEffect(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this.particles.push({
        type: 'evolution',
        x,
        y,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40,
        life: 1.2,
        maxLife: 1.2,
        size: 3 + Math.random() * 2,
        color: `hsl(45, 100%, ${50 + Math.random() * 30}%)`, // Gold
        opacity: 1.0
      });
    }
  }

  // Add healing effect (green plus signs)
  addHealEffect(x, y) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        type: 'heal',
        x,
        y,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 20, // Float upward
        life: 0.8,
        maxLife: 0.8,
        size: 10 + Math.random() * 4,
        text: '+',
        opacity: 1.0,
        color: '#44ff44'
      });
    }
  }

  // Season transition shimmer
  addSeasonShift(label, config) {
    const palette = {
      spring: '#7FDB6A',
      summer: '#FFD56A',
      autumn: '#FF8C42',
      winter: '#B0E0E6'
    };
    const key = (label || '').toLowerCase();
    const tint = key.includes('winter') ? palette.winter
      : key.includes('autumn') ? palette.autumn
        : key.includes('summer') ? palette.summer
          : palette.spring;
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 40;
      this.particles.push({
        type: 'season',
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 250,
        vx: Math.cos(angle) * 18,
        vy: Math.sin(angle) * 18,
        life: 1.8,
        maxLife: 1.8,
        size: 6 + Math.random() * 8,
        color: tint,
        label: label ?? 'Season Shift',
        opacity: 1.0
      });
    }
  }

  addDiseasePulse(x, y, color = '#7fff7f') {
    // Main expanding ring
    this.particles.push({
      type: 'disease',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 1.2,
      maxLife: 1.2,
      size: 16,
      opacity: 1.0,
      pulse: 0,
      color
    });

    // Add smaller contagion particles spreading outward
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 30 + Math.random() * 20;
      this.particles.push({
        type: 'contagion',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8,
        maxLife: 0.8,
        size: 2 + Math.random() * 2,
        color,
        opacity: 0.8
      });
    }
  }

  addVenomStrike(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      this.particles.push({
        type: 'venom',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6,
        maxLife: 0.6,
        size: 3 + Math.random() * 2,
        color: '#6CFF7C',
        opacity: 1.0
      });
    }
  }

  /**
   * Generic emit method for game-loop compatibility
   * Maps event types to specific particle effects
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Effect type ('birth', 'death', 'combat', 'food', etc.)
   * @param {Object} options - Optional parameters for the effect
   */
  emit(x, y, type, options = {}) {
    switch (type) {
      case 'birth':
        this.addBirthEffect(x, y, options.diet || 0);
        break;
      case 'death':
        this.addDeathMarker(x, y, options.name || 'Unknown', options.diet || 0);
        break;
      case 'combat':
      case 'hit':
        this.addCombatHit(x, y, options.damage || 5, options.isKill || false);
        break;
      case 'food':
        if (options.targetX !== undefined && options.targetY !== undefined) {
          this.addFoodAbsorption(x, y, options.targetX, options.targetY);
        }
        break;
      case 'sleep':
        this.addSleepParticle(x, y);
        break;
      case 'mutation':
        this.addMutationEffect(x, y);
        break;
      case 'levelup':
      case 'level':
        this.addLevelUpEffect(x, y);
        break;
      case 'heal':
        this.addHealingEffect(x, y);
        break;
      case 'territory':
        this.addTerritoryMarker(x, y, options.color || '#ff0000');
        break;
      default:
        // Default to sparkle effect for unknown types
        this.addBirthEffect(x, y, options.diet || 0);
    }
  }

  /**
   * Update all particles
   * OPTIMIZED: Uses swap-and-pop pattern for O(1) removal instead of splice O(n)
   */
  update(dt) {
    const particles = this.particles;
    let writeIdx = 0;

    // Process all particles, keeping alive ones compacted
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;

      // Skip dead particles (they won't be copied)
      if (p.life <= 0) {
        this._particleRemoved++;
        continue;
      }

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update opacity based on life
      const lifeRatio = p.life / p.maxLife;

      // Type-specific updates using lookup for common types
      this._updateParticleByType(p, dt, lifeRatio);

      // Compact: move particle to write position
      if (writeIdx !== i) {
        particles[writeIdx] = p;
      }
      writeIdx++;
    }

    // Truncate array to remove dead particles (O(1))
    particles.length = writeIdx;

    // Update screen shake decay (moved outside particle loop)
    if (this.screenShake.intensity > 0) {
      this.screenShake.intensity *= 0.85;
      if (this.screenShake.intensity < 0.1) {
        this.screenShake.intensity = 0;
        this.screenShake.x = 0;
        this.screenShake.y = 0;
      }
    }

    // Limit particle count by removing oldest (from start)
    if (particles.length > this.maxParticles) {
      const excess = particles.length - this.maxParticles;
      particles.splice(0, excess);
    }
  }

  /**
   * Update particle behavior by type
   * Extracted to reduce update() complexity
   */
  _updateParticleByType(p, dt, lifeRatio) {
    switch (p.type) {
      case 'sparkle':
        p.opacity = lifeRatio;
        if (p.twinkle) {
          p.opacity *= 0.5 + 0.5 * Math.sin(p.life * 20); // Twinkle effect
        }
        p.vy += 80 * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
        break;

      case 'ring':
        p.size += p.expandRate * dt;
        p.opacity = lifeRatio * 0.6;
        break;

      case 'dust':
        p.opacity = lifeRatio * 0.7;
        p.vy += 60 * dt; // Gravity
        p.vx *= 0.88;
        p.vy *= 0.88;
        break;

      case 'gravestone':
        // Fade in effect
        if (p.fadeInTime && (p.maxLife - p.life) < p.fadeInTime) {
          p.opacity = (p.maxLife - p.life) / p.fadeInTime;
        } else if (p.life < 2.0) {
          p.opacity = p.life / 2.0;
        }
        break;

      case 'sleep':
        p.opacity = lifeRatio * 0.8;
        p.vy += 2 * dt;
        break;

      case 'blood':
        p.opacity = lifeRatio;
        p.vy += 100 * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        break;

      case 'food':
        if (p.delay > 0) {
          p.delay -= dt;
        } else {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            p.vx = (dx / dist) * 80;
            p.vy = (dy / dist) * 80;
          } else {
            p.life = 0;
          }
        }
        p.opacity = lifeRatio;
        break;

      case 'evolution':
        p.opacity = lifeRatio;
        p.vy += 40 * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
        break;

      case 'heal':
        p.opacity = lifeRatio * 0.9;
        p.vy += 5 * dt;
        break;

      case 'season':
        p.opacity = lifeRatio;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vy -= 4 * dt;
        break;

      case 'disease':
        p.opacity = lifeRatio * 0.8;
        p.size += dt * 28;
        p.pulse = (p.pulse ?? 0) + dt * 6;
        break;

      case 'contagion':
        p.opacity = lifeRatio * 0.7;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.size *= 0.98;
        break;

      case 'bubble':
        p.opacity = lifeRatio * 0.6;
        p.vx *= 0.95;
        p.vy *= 0.98;
        p.size += dt * 2;
        p.vx += Math.sin(p.life * 10) * 5 * dt;
        break;

      case 'ripple':
        p.opacity = lifeRatio * 0.4;
        p.size += dt * 40;
        break;

      case 'venom':
        p.opacity = lifeRatio;
        p.vx *= 0.9;
        p.vy *= 0.9;
        break;

      case 'play':
        p.opacity = lifeRatio;
        p.vx *= 0.88;
        p.vy *= 0.88;
        break;

      case 'elder':
        p.opacity = lifeRatio * 0.7;
        p.size += dt * 20;
        break;

      // Default: just fade based on life
      default:
        p.opacity = lifeRatio;
    }
  }

  addPlayBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 50;
      this.particles.push({
        type: 'play',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color: '#9AD9FF',
        opacity: 1.0
      });
    }
  }

  addElderAura(x, y) {
    this.particles.push({
      type: 'elder',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 1.6,
      maxLife: 1.6,
      size: 22,
      opacity: 1.0
    });
  }

  /**
   * Add bubbles for drowning effect or swimming
   */
  addBubbles(x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'bubble',
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 15,
        vy: -20 - Math.random() * 30, // Float upward
        life: 0.8 + Math.random() * 0.4,
        maxLife: 1.2,
        size: 2 + Math.random() * 3,
        opacity: 0.7
      });
    }
  }

  addImpactRing(x, y, { color = 'rgba(147, 197, 253, 1)', size = 8 } = {}) {
    this.particles.push({
      type: 'ripple',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.55,
      maxLife: 0.55,
      size,
      color,
      opacity: 0.6
    });
  }

  /**
   * Add swimming ripple effect
   */
  addSwimRipple(x, y) {
    this.particles.push({
      type: 'ripple',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.6,
      maxLife: 0.6,
      size: 5,
      opacity: 0.5
    });
  }

  draw(ctx, camera = null) {
    // Camera parameter is optional - particles are drawn in world space
    // If camera transform is needed, it should be applied before calling draw
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity || 1.0;

      if (p.type === 'sparkle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ring') {
        // Expanding ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'dust') {
        // Dust cloud particles
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'gravestone') {
        // Draw gravestone symbol
        ctx.fillStyle = '#666';
        ctx.font = `${p.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪦', p.x, p.y);

        // Draw creature name below (small text)
        if (p.name && p.opacity > 0.5) {
          ctx.font = '8px Arial';
          ctx.fillStyle = '#999';
          ctx.fillText(p.name, p.x, p.y + 12);
        }
      } else if (p.type === 'sleep') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${p.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'blood') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'food') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'evolution') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === 'heal') {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'season') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'disease') {
        const diseaseColor = p.color || 'rgba(120,255,150,1)';
        ctx.strokeStyle = diseaseColor.replace('1)', `${p.opacity})`).replace(')', `,${p.opacity})`);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.25 * (1 + Math.sin(p.pulse ?? 0) * 0.2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'contagion') {
        // Small floating disease particles
        const color = p.color || '#7fff7f';
        ctx.fillStyle = color;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.type === 'bubble') {
        // Water bubbles
        ctx.strokeStyle = `rgba(147, 197, 253, ${p.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        // Highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.3})`;
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ripple') {
        // Water ripple effect
        const rippleColor = p.color || 'rgba(147, 197, 253, 1)';
        const strokeColor = rippleColor.includes('rgba')
          ? rippleColor.replace('1)', `${p.opacity})`)
          : rippleColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'venom') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'play') {
        ctx.fillStyle = `rgba(154,217,255,${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'elder') {
        const gradient = ctx.createRadialGradient(p.x, p.y, p.size * 0.1, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(255,245,200,${p.opacity})`);
        gradient.addColorStop(1, 'rgba(255,245,200,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Trigger screen shake
  triggerShake(intensity = 5.0) {
    this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
    this.screenShake.x = (Math.random() - 0.5) * intensity;
    this.screenShake.y = (Math.random() - 0.5) * intensity;
  }

  // Get current screen shake offset (for camera)
  getShakeOffset() {
    if (this.screenShake.intensity < 0.1) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.screenShake.intensity,
      y: (Math.random() - 0.5) * this.screenShake.intensity
    };
  }

  clear() {
    this.particles = [];
    this.screenShake = { x: 0, y: 0, intensity: 0 };
  }
}
