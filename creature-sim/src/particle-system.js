// Particle System for visual effects
// Handles birth sparkles, death markers, sleep particles, etc.

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
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

  // Add creature shadow (static, updated each frame)
  addShadow(x, y, size) {
    // Shadows are not particles, they're drawn directly
    // This is just for consistency if needed later
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
      }

      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

