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

  addDiseasePulse(x, y) {
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
      pulse: 0
    });
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
      } else if (p.type === 'season') {
        p.opacity = lifeRatio;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vy -= 4 * dt;
      } else if (p.type === 'disease') {
        p.opacity = lifeRatio * 0.8;
        p.size += dt * 28;
        p.pulse = (p.pulse ?? 0) + dt * 6;
      } else if (p.type === 'venom') {
        p.opacity = lifeRatio;
        p.vx *= 0.9;
        p.vy *= 0.9;
      } else if (p.type === 'play') {
        p.opacity = lifeRatio;
        p.vx *= 0.88;
        p.vy *= 0.88;
      } else if (p.type === 'elder') {
        p.opacity = lifeRatio * 0.7;
        p.size += dt * 20;
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
      } else if (p.type === 'season') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'disease') {
        ctx.strokeStyle = `rgba(120,255,150,${p.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.25 * (1 + Math.sin(p.pulse ?? 0) * 0.2), 0, Math.PI * 2);
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
