// Particle System for visual effects
// Handles birth sparkles, death markers, sleep particles, etc.

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
    this.screenShake = { x: 0, y: 0, intensity: 0 };
  }

  // Add birth sparkles
  addBirthEffect(x, y) {
    const sparkleCount = 8;
    for (let i = 0; i < sparkleCount; i++) {
      this.particles.push({
        type: 'sparkle',
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60 - 20, // Upward bias
        life: 0.8,
        maxLife: 0.8,
        size: 2 + Math.random() * 2,
        color: `hsl(${Math.random() * 60 + 45}, 100%, 70%)` // Gold/yellow sparkles
      });
    }
  }

  // Add death gravestone marker
  addDeathMarker(x, y, creatureName) {
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
      name: creatureName
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


  update(dt) {
    // Update all particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update opacity based on life
      const lifeRatio = p.life / p.maxLife;
      
      if (p.type === 'sparkle') {
        p.opacity = lifeRatio;
        p.vy += 80 * dt; // Gravity
        p.vx *= 0.95; // Air resistance
        p.vy *= 0.95;
      } else if (p.type === 'gravestone') {
        // Fade out in last 2 seconds
        if (p.life < 2.0) {
          p.opacity = p.life / 2.0;
        }
      } else if (p.type === 'sleep') {
        p.opacity = lifeRatio * 0.8;
        p.vy += 2 * dt; // Slight upward acceleration
      } else if (p.type === 'blood') {
        p.opacity = lifeRatio;
        p.vy += 100 * dt; // Gravity
        p.vx *= 0.92; // Air resistance
        p.vy *= 0.92;
      } else if (p.type === 'food') {
        // Animate toward target (creature)
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
            p.life = 0; // Absorbed
          }
        }
        p.opacity = lifeRatio;
      } else if (p.type === 'evolution') {
        p.opacity = lifeRatio;
        p.vy += 40 * dt; // Slight gravity
        p.vx *= 0.98;
        p.vy *= 0.98;
      } else if (p.type === 'heal') {
        p.opacity = lifeRatio * 0.9;
        p.vy += 5 * dt; // Slow upward float
      }
      
      // Update screen shake decay
      if (this.screenShake.intensity > 0) {
        this.screenShake.intensity *= 0.85; // Decay quickly
        if (this.screenShake.intensity < 0.1) {
          this.screenShake.intensity = 0;
          this.screenShake.x = 0;
          this.screenShake.y = 0;
        }
      }
    }

    // Limit particle count
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity || 1.0;

      if (p.type === 'sparkle') {
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

