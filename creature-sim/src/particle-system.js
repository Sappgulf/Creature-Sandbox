// Particle System for visual effects
// Handles birth sparkles, death markers, sleep particles, etc.
// OPTIMIZED: Uses object pooling to reduce GC pressure

import { poolManager } from './object-pool.js';

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
    this.screenShake = { x: 0, y: 0, intensity: 0 };
    // Performance tracking
    this._particleCreated = 0;
    this._particleReleased = 0;
    this._particleRemoved = 0;
  }

  /**
   * Get a particle from the pool and initialize common properties
   * @returns {Object} Pooled particle object
   */
  _getPooledParticle() {
    return poolManager.getParticle();
  }

  /**
   * Release a particle back to the pool
   * @param {Object} particle - Particle to release
   */
  _releaseParticle(particle) {
    if (particle) {
      poolManager.releaseParticle(particle);
      this._particleReleased++;
    }
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
    const sparkleCount = 12;
    const hueBase = diet > 0.7 ? 0 : diet > 0.3 ? 45 : 120;

    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const speed = 40 + Math.random() * 20;
      const p = this._getPooledParticle();
      p.type = 'sparkle';
      p.category = 'sparkle';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 15;
      p.life = 1.0 + Math.random() * 0.3;
      p.maxLife = 1.3;
      p.size = 2 + Math.random() * 3;
      p.color = `hsl(${hueBase + Math.random() * 30}, 100%, 70%)`;
      p.twinkle = true;
      p.opacity = 1;
      this.particles.push(p);
    }

    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.5;
    ring.maxLife = 0.5;
    ring.size = 5;
    ring.expandRate = 80;
    ring.color = `hsl(${hueBase}, 80%, 60%)`;
    ring.opacity = 0.8;
    this.particles.push(ring);
  }

  // Add death gravestone marker with enhanced visuals
  addDeathMarker(x, y, creatureName, diet = 0) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const p = this._getPooledParticle();
      p.type = 'dust';
      p.category = 'dust';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * (20 + Math.random() * 15);
      p.vy = Math.sin(angle) * (20 + Math.random() * 15) - 10;
      p.life = 0.6 + Math.random() * 0.4;
      p.maxLife = 1.0;
      p.size = 3 + Math.random() * 4;
      p.color = diet > 0.7 ? '#aa4444' : diet > 0.3 ? '#88aa44' : '#88aa88';
      p.opacity = 0.8;
      this.particles.push(p);
    }

    const ghost = this._getPooledParticle();
    ghost.type = 'ghost';
    ghost.category = 'ghost';
    ghost.x = x;
    ghost.y = y;
    ghost.vx = 0;
    ghost.vy = -8;
    ghost.life = 1.5;
    ghost.maxLife = 1.5;
    ghost.size = 14;
    ghost.hue = diet > 0.7 ? 0 : diet > 0.3 ? 45 : 120;
    ghost.opacity = 0.5;
    ghost.fadeInTime = 0.1;
    this.particles.push(ghost);

    const grave = this._getPooledParticle();
    grave.type = 'gravestone';
    grave.category = 'gravestone';
    grave.x = x;
    grave.y = y;
    grave.vx = 0;
    grave.vy = 0;
    grave.life = 5.0;
    grave.maxLife = 5.0;
    grave.size = 12;
    grave.opacity = 1.0;
    grave.name = creatureName;
    grave.fadeInTime = 0.3;
    this.particles.push(grave);
  }

  // Add sleep Zzz particles
  addSleepParticle(x, y) {
    const p = this._getPooledParticle();
    p.type = 'sleep';
    p.category = 'sleep';
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 5;
    p.vy = -15 - Math.random() * 10;
    p.life = 1.5;
    p.maxLife = 1.5;
    p.size = 8;
    p.text = 'Z';
    p.opacity = 0.8;
    this.particles.push(p);
  }

  // Weather particles - rain, snow, wind streaks
  _addWeatherParticles(originX, originY, weatherType, intensity = 1) {
    const count = Math.floor(5 * intensity);
    for (let i = 0; i < count; i++) {
      const x = originX + (Math.random() - 0.5) * 300;
      const y = originY + (Math.random() - 0.5) * 200;
      const p = this._getPooledParticle();
      p.type = 'weather';
      p.category = weatherType;
      p.x = x;
      p.y = y;

      if (weatherType === 'rain') {
        p.vx = -80 + Math.random() * 20;
        p.vy = 150 + Math.random() * 50;
        p.life = 0.8;
        p.maxLife = 0.8;
        p.size = 1.5;
        p.color = 'rgba(150, 180, 255, 0.5)';
        p.opacity = 0.5;
      } else if (weatherType === 'snow') {
        p.vx = -20 + Math.random() * 40;
        p.vy = 30 + Math.random() * 20;
        p.life = 2 + Math.random();
        p.maxLife = 3;
        p.size = 2 + Math.random() * 2;
        p.color = 'rgba(255, 255, 255, 0.7)';
        p.opacity = 0.7;
      } else if (weatherType === 'wind') {
        p.vx = 150 + Math.random() * 100;
        p.vy = -10 + Math.random() * 20;
        p.life = 0.5;
        p.maxLife = 0.5;
        p.size = 1;
        p.color = 'rgba(200, 220, 255, 0.3)';
        p.opacity = 0.3;
      }
      this.particles.push(p);
    }
  }

  // Add combat hit effects (blood splatter)
  addCombatHit(x, y, damage, isKill = false) {
    const particleCount = isKill ? 15 : 8;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 30 + 20) * (damage / 10);
      const p = this._getPooledParticle();
      p.type = 'blood';
      p.category = 'blood';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.size = 2 + Math.random() * 2;
      p.color = isKill ? '#cc0000' : '#ff4444';
      p.opacity = 1.0;
      this.particles.push(p);
    }
  }

  // Add food absorption particles (green particles flowing to creature)
  addFoodAbsorption(foodX, foodY, creatureX, creatureY) {
    const particleCount = 5;
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const p = this._getPooledParticle();
      p.type = 'food';
      p.category = 'food';
      p.x = foodX + (Math.random() - 0.5) * 8;
      p.y = foodY + (Math.random() - 0.5) * 8;
      p.targetX = creatureX;
      p.targetY = creatureY;
      p.vx = 0;
      p.vy = 0;
      p.life = 0.4;
      p.maxLife = 0.4;
      p.size = 2 + Math.random() * 2;
      p.color = '#44ff44';
      p.opacity = 1.0;
      p.delay = t * 0.05;
      this.particles.push(p);
    }
  }

  // Add evolution milestone effect (golden glow)
  addEvolutionEffect(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const p = this._getPooledParticle();
      p.type = 'evolution';
      p.category = 'evolution';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * 40;
      p.vy = Math.sin(angle) * 40;
      p.life = 1.2;
      p.maxLife = 1.2;
      p.size = 3 + Math.random() * 2;
      p.color = `hsl(45, 100%, ${50 + Math.random() * 30}%)`;
      p.opacity = 1.0;
      this.particles.push(p);
    }
  }

  // Add healing effect (green plus signs)
  addHealEffect(x, y) {
    for (let i = 0; i < 6; i++) {
      const p = this._getPooledParticle();
      p.type = 'heal';
      p.category = 'heal';
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -20 - Math.random() * 20;
      p.life = 0.8;
      p.maxLife = 0.8;
      p.size = 10 + Math.random() * 4;
      p.text = '+';
      p.opacity = 1.0;
      p.color = '#44ff44';
      this.particles.push(p);
    }
  }

  // Season transition shimmer
  addSeasonShift(label, _config) {
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
      const p = this._getPooledParticle();
      p.type = 'season';
      p.category = 'season';
      p.x = (Math.random() - 0.5) * 400;
      p.y = (Math.random() - 0.5) * 250;
      p.vx = Math.cos(angle) * 18;
      p.vy = Math.sin(angle) * 18;
      p.life = 1.8;
      p.maxLife = 1.8;
      p.size = 6 + Math.random() * 8;
      p.color = tint;
      p.label = label ?? 'Season Shift';
      p.opacity = 1.0;
      this.particles.push(p);
    }
  }

  addDiseasePulse(x, y, color = '#7fff7f') {
    const disease = this._getPooledParticle();
    disease.type = 'disease';
    disease.category = 'disease';
    disease.x = x;
    disease.y = y;
    disease.vx = 0;
    disease.vy = 0;
    disease.life = 1.2;
    disease.maxLife = 1.2;
    disease.size = 16;
    disease.opacity = 1.0;
    disease.pulse = 0;
    disease.color = color;
    this.particles.push(disease);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 30 + Math.random() * 20;
      const p = this._getPooledParticle();
      p.type = 'contagion';
      p.category = 'contagion';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.8;
      p.maxLife = 0.8;
      p.size = 2 + Math.random() * 2;
      p.color = color;
      p.opacity = 0.8;
      this.particles.push(p);
    }
  }

  addVenomStrike(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      const p = this._getPooledParticle();
      p.type = 'venom';
      p.category = 'venom';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.6;
      p.maxLife = 0.6;
      p.size = 3 + Math.random() * 2;
      p.color = '#6CFF7C';
      p.opacity = 1.0;
      this.particles.push(p);
    }
  }

  addEatEffect(x, y, color = '#88ff88') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.45;
    ring.maxLife = 0.45;
    ring.size = 5;
    ring.expandRate = 70;
    ring.color = color;
    ring.opacity = 0.75;
    this.particles.push(ring);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const speed = 24 + Math.random() * 18;
      const p = this._getPooledParticle();
      p.type = 'sparkle';
      p.category = 'sparkle';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 8;
      p.life = 0.55 + Math.random() * 0.15;
      p.maxLife = 0.7;
      p.size = 1.6 + Math.random() * 1.8;
      p.color = color;
      p.opacity = 1;
      p.twinkle = true;
      this.particles.push(p);
    }
  }

  addBondEffect(x, y, color = '#ff9ad5') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.6;
    ring.maxLife = 0.6;
    ring.size = 6;
    ring.expandRate = 60;
    ring.color = color;
    ring.opacity = 0.7;
    this.particles.push(ring);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const speed = 18 + Math.random() * 16;
      const p = this._getPooledParticle();
      p.type = 'sparkle';
      p.category = 'sparkle';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 6;
      p.life = 0.75 + Math.random() * 0.2;
      p.maxLife = 0.95;
      p.size = 1.5 + Math.random() * 1.5;
      p.color = color;
      p.opacity = 1;
      this.particles.push(p);
    }
  }

  addPanicEffect(x, y, color = '#ffb347') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.35;
    ring.maxLife = 0.35;
    ring.size = 8;
    ring.expandRate = 90;
    ring.color = color;
    ring.opacity = 0.9;
    this.particles.push(ring);

    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 45;
      const p = this._getPooledParticle();
      p.type = 'dust';
      p.category = 'dust';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 14;
      p.life = 0.65 + Math.random() * 0.25;
      p.maxLife = 0.9;
      p.size = 1.8 + Math.random() * 2.2;
      p.color = color;
      p.opacity = 0.85;
      this.particles.push(p);
    }
  }

  addMigrationEffect(x, y, color = '#9ad9ff') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.7;
    ring.maxLife = 0.7;
    ring.size = 10;
    ring.expandRate = 50;
    ring.color = color;
    ring.opacity = 0.6;
    this.particles.push(ring);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 22 + Math.random() * 20;
      const p = this._getPooledParticle();
      p.type = 'play';
      p.category = 'play';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 6;
      p.life = 0.8 + Math.random() * 0.2;
      p.maxLife = 1;
      p.size = 1.8 + Math.random() * 1.6;
      p.color = color;
      p.opacity = 1;
      this.particles.push(p);
    }
  }

  addNestEffect(x, y, color = '#7FDB6A') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.65;
    ring.maxLife = 0.65;
    ring.size = 7;
    ring.expandRate = 55;
    ring.color = color;
    ring.opacity = 0.75;
    this.particles.push(ring);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const speed = 16 + Math.random() * 12;
      const p = this._getPooledParticle();
      p.type = 'sparkle';
      p.category = 'sparkle';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 5;
      p.life = 0.7 + Math.random() * 0.25;
      p.maxLife = 0.95;
      p.size = 1.6 + Math.random() * 1.4;
      p.color = color;
      p.opacity = 1;
      p.twinkle = true;
      this.particles.push(p);
    }
  }

  addScarcityEffect(x, y, color = '#9ca3af') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.75;
    ring.maxLife = 0.75;
    ring.size = 9;
    ring.expandRate = 45;
    ring.color = color;
    ring.opacity = 0.5;
    this.particles.push(ring);

    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 18 + Math.random() * 18;
      const p = this._getPooledParticle();
      p.type = 'dust';
      p.category = 'dust';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 4;
      p.life = 0.8 + Math.random() * 0.25;
      p.maxLife = 1;
      p.size = 1.7 + Math.random() * 1.8;
      p.color = color;
      p.opacity = 0.7;
      this.particles.push(p);
    }
  }

  addMutationEffect(x, y, color = '#c084fc') {
    const ring = this._getPooledParticle();
    ring.type = 'ring';
    ring.category = 'ring';
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.life = 0.5;
    ring.maxLife = 0.5;
    ring.size = 4;
    ring.expandRate = 85;
    ring.color = color;
    ring.opacity = 0.8;
    this.particles.push(ring);

    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 26 + Math.random() * 22;
      const p = this._getPooledParticle();
      p.type = 'sparkle';
      p.category = 'sparkle';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 10;
      p.life = 0.7 + Math.random() * 0.2;
      p.maxLife = 0.95;
      p.size = 1.8 + Math.random() * 1.8;
      p.color = color;
      p.opacity = 1;
      p.twinkle = true;
      this.particles.push(p);
    }
  }

  addLevelUpEffect(x, y) {
    this.addEvolutionEffect(x, y, 45);
  }

  addHealingEffect(x, y) {
    this.addHealEffect(x, y);
  }

  addTerritoryMarker(x, y, color = '#ff6b6b') {
    const territory = this._getPooledParticle();
    territory.type = 'territory';
    territory.category = 'territory';
    territory.x = x;
    territory.y = y;
    territory.vx = 0;
    territory.vy = 0;
    territory.life = 1.1;
    territory.maxLife = 1.1;
    territory.size = 14;
    territory.color = color;
    territory.opacity = 0.9;
    this.particles.push(territory);

    for (let i = 0; i < 4; i++) {
      const p = this._getPooledParticle();
      p.type = 'sparkle';
      p.category = 'sparkle';
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = -10 - Math.random() * 15;
      p.life = 0.6 + Math.random() * 0.2;
      p.maxLife = 0.8;
      p.size = 1.4 + Math.random() * 1.2;
      p.color = color;
      p.opacity = 1;
      p.twinkle = false;
      this.particles.push(p);
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
      case 'weather_rain':
        this._addWeatherParticles(x, y, 'rain', options.intensity || 1);
        break;
      case 'weather_snow':
        this._addWeatherParticles(x, y, 'snow', options.intensity || 1);
        break;
      case 'weather_wind':
        this._addWeatherParticles(x, y, 'wind', options.intensity || 1);
        break;
      case 'combat':
      case 'hit':
        this.addCombatHit(x, y, options.damage || 5, options.isKill || false);
        break;
      case 'food':
        if (options.targetX !== undefined && options.targetY !== undefined) {
          this.addFoodAbsorption(x, y, options.targetX, options.targetY);
        } else {
          this.addEatEffect(x, y, options.color || '#88ff88');
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
      case 'eat':
        this.addEatEffect(x, y, options.color || '#88ff88');
        break;
      case 'bond':
        this.addBondEffect(x, y, options.color || '#ff9ad5');
        break;
      case 'panic':
        this.addPanicEffect(x, y, options.color || '#ffb347');
        break;
      case 'migration':
        this.addMigrationEffect(x, y, options.color || '#9ad9ff');
        break;
      case 'nest':
        this.addNestEffect(x, y, options.color || '#7FDB6A');
        break;
      case 'scarcity':
        this.addScarcityEffect(x, y, options.color || '#9ca3af');
        break;
      case 'region-thriving':
        this.addNestEffect(x, y, options.color || '#34d399');
        break;
      case 'region-depleted':
        this.addScarcityEffect(x, y, options.color || '#a3a3a3');
        break;
      default:
        // Default to sparkle effect for unknown types
        this.addBirthEffect(x, y, options.diet || 0);
    }
  }

  /**
   * Update all particles
   * OPTIMIZED: Uses swap-and-pop pattern for O(1) removal + releases dead particles to pool
   */
  update(dt) {
    const particles = this.particles;
    let writeIdx = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this._releaseParticle(p);
        this._particleRemoved++;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const lifeRatio = p.life / p.maxLife;

      this._updateParticleByType(p, dt, lifeRatio);

      if (writeIdx !== i) {
        particles[writeIdx] = p;
      }
      writeIdx++;
    }

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
      const p = this._getPooledParticle();
      p.type = 'play';
      p.category = 'play';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5;
      p.maxLife = 0.5;
      p.size = 2 + Math.random() * 2;
      p.color = '#9AD9FF';
      p.opacity = 1.0;
      this.particles.push(p);
    }
  }

  addElderAura(x, y) {
    const p = this._getPooledParticle();
    p.type = 'elder';
    p.category = 'elder';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = 1.6;
    p.maxLife = 1.6;
    p.size = 22;
    p.opacity = 1.0;
    this.particles.push(p);
  }

  /**
   * Add bubbles for drowning effect or swimming
   */
  addBubbles(x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      const p = this._getPooledParticle();
      p.type = 'bubble';
      p.category = 'bubble';
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = (Math.random() - 0.5) * 15;
      p.vy = -20 - Math.random() * 30;
      p.life = 0.8 + Math.random() * 0.4;
      p.maxLife = 1.2;
      p.size = 2 + Math.random() * 3;
      p.opacity = 0.7;
      this.particles.push(p);
    }
  }

  addImpactRing(x, y, { color = 'rgba(147, 197, 253, 1)', size = 8 } = {}) {
    const p = this._getPooledParticle();
    p.type = 'ripple';
    p.category = 'ripple';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = 0.55;
    p.maxLife = 0.55;
    p.size = size;
    p.color = color;
    p.opacity = 0.6;
    this.particles.push(p);
  }

  /**
   * Add swimming ripple effect
   */
  addSwimRipple(x, y) {
    const p = this._getPooledParticle();
    p.type = 'ripple';
    p.category = 'ripple';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = 0.6;
    p.maxLife = 0.6;
    p.size = 5;
    p.opacity = 0.5;
    this.particles.push(p);
  }

  draw(ctx, _camera = null) {
    // Camera parameter is optional - particles are drawn in world space
    // If camera transform is needed, it should be applied before calling draw
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity || 1.0;

      if (p.type === 'sparkle') {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
        const fadeIn = p.fadeInTime ? Math.min(1, (p.maxLife - p.life) / p.fadeInTime) : 1;
        ctx.globalAlpha = p.opacity * fadeIn * Math.min(1, p.life / 1.5);
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
        ctx.globalAlpha = p.opacity;
      } else if (p.type === 'ghost') {
        // Ghost silhouette - translucent shape that fades and rises
        const fadeIn = p.fadeInTime ? Math.min(1, (p.maxLife - p.life) / p.fadeInTime) : 1;
        const fadeOut = Math.min(1, p.life / (p.maxLife * 0.6));
        ctx.globalAlpha = p.opacity * fadeIn * fadeOut;
        ctx.fillStyle = `hsla(${p.hue}, 60%, 70%, ${0.3 * fadeOut})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${p.hue}, 40%, 85%, ${0.5 * fadeOut})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.size * 0.3, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.opacity;
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
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'evolution') {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
      } else if (p.type === 'weather') {
        // Enhanced weather particle rendering using category
        if (p.category === 'rain') {
          // Rain - elongated drops with motion blur
          ctx.save();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
          ctx.stroke();
          ctx.restore();
        } else if (p.category === 'snow') {
          // Snow - soft fluffy flakes with sparkle
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          // Snow sparkle
          if (Math.random() > 0.95) {
            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (p.category === 'wind') {
          // Wind - horizontal streaks
          ctx.save();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 0.03, p.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();
        } else {
          // Generic weather
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
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
    for (const p of this.particles) {
      this._releaseParticle(p);
    }
    this.particles = [];
    this.screenShake = { x: 0, y: 0, intensity: 0 };
  }
}
