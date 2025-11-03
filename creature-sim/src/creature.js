import { clamp, rand, randn, dist2, wrap } from './utils.js';
import { BehaviorConfig } from './behavior.js';

const TAU = Math.PI * 2;
const TRAIL_INTERVAL = 0.12;
const TRAIL_MAX = 24;
const LOG_MAX = 12;

export class Creature {
  constructor(x, y, genes, isChild=false) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.dir = rand(0, TAU);
    this.energy = isChild ? 18 : 24;
    this.age = 0;
    this.alive = true;
    this.genes = genes;
    this.size = 3.5 + (genes.predator ? 1.5 : 0);
    this.target = null;
    this.id = null;       // set by World.addCreature
    this.parentId = null; // set by World.addCreature

    this.maxHealth = genes.predator ? 18 : 12;
    this.health = this.maxHealth;
    this.stats = { food: 0, kills: 0, births: 0, damageTaken: 0, damageDealt: 0 };
    this.trail = [{ x, y }];
    this.trailTimer = 0;
    this.log = [];
    this.logVersion = 0;
    this.personality = {
      packInstinct: clamp(genes.packInstinct ?? (genes.predator ? 0.55 : 0), 0, 1),
      ambushDelay: Math.max(0, genes.ambushDelay ?? (genes.predator ? 0.6 : 0.15)),
      aggression: clamp(genes.aggression ?? (genes.predator ? 1.15 : 0.85), 0.4, 2.2),
      ambushTimer: 0,
      huntCooldown: 0,
      lastSignalAt: -Infinity,
      currentTargetId: null,
      attackCooldown: 0
    };
    this.effects = {
      herdBuff: 0,
      herdIntensity: 0,
      adrenaline: 0,
      adrenalineBoost: 0,
      adrenalineCooldown: 0,
      bleed: 0,
      bleedStacks: 0,
      recentDamage: 0,
      hitFlash: 0
    };
    
    // Cache expensive calculations
    this._cachedBaseBurn = null;
    this._senseRadius2Cache = null;
    this._halfFovRad = (genes.fov * 0.5) * Math.PI / 180; // Cache FOV in radians
    
    // FEATURE 2: Learning & Memory
    const memoryCapacity = Math.floor(10 + (genes.sense / 50)); // 10-14 memories
    this.memory = {
      capacity: memoryCapacity,
      locations: [], // { x, y, type, strength, timestamp }
      decayRate: 0.05 // strength decays per second
    };
    
    // FEATURE 4: Social Behaviors
    this.social = {
      herdMates: [], // nearby same-species creatures
      packTarget: null, // shared target for pack hunting
      offspring: [], // child IDs (recent)
      lastReproduction: -Infinity
    };
    
    // FEATURE 9: Migration
    this.migration = {
      instinct: clamp(genes.herdInstinct ?? 0.5, 0, 1), // how likely to migrate
      targetBiome: null, // which biome to migrate to
      lastMigration: -Infinity,
      settled: false
    };
  }

  baseBurn() {
    // Cache this expensive calculation since genes don't change
    if (this._cachedBaseBurn === null) {
      const g = this.genes;
      const moveCost = 0.35 * g.speed * g.speed;
      const senseCost = 0.08 * (g.fov/90) + 0.06 * (g.sense/100);
      this._cachedBaseBurn = (0.4 * g.metabolism) + moveCost + senseCost;
    }
    return this._cachedBaseBurn;
  }

  seek(foodList, pheromone) {
    let best = null, bestD2 = Infinity;
    const senseRadius = this.genes.sense * (0.7 + BehaviorConfig.forageWeight * 0.6);
    const senseRadius2 = senseRadius * senseRadius;
    
    // Optimize: pre-compute values outside loop
    const myX = this.x, myY = this.y, myDir = this.dir;
    const halfFov = this._halfFovRad; // Use cached FOV
    const forageWeight = BehaviorConfig.forageWeight;
    
    for (let i = 0; i < foodList.length; i++) {
      const f = foodList[i];
      const dx = f.x - myX, dy = f.y - myY;
      const d2 = dx*dx + dy*dy; // Inline dist2 to avoid function call
      if (d2 > senseRadius2) continue;
      
      const ang = Math.atan2(dy, dx);
      const delta = Math.atan2(Math.sin(ang - myDir), Math.cos(ang - myDir));
      if (Math.abs(delta) > halfFov) continue;
      
      const bias = forageWeight > 0 ? d2 / forageWeight : d2;
      if (bias < bestD2) { bestD2 = bias; best = f; }
    }
    
    if (!best && pheromone) {
      const gx = Math.floor(myX/pheromone.cell);
      const gy = Math.floor(myY/pheromone.cell);
      const here = pheromone.get(gx,gy);
      let maxVal = here, target = null;
      for (let oy=-1; oy<=1; oy++) {
        for (let ox=-1; ox<=1; ox++) {
          if (!ox && !oy) continue;
          const v = pheromone.get(gx+ox, gy+oy);
          if (v > maxVal) { 
            maxVal = v; 
            target = {x:(gx+ox+0.5)*pheromone.cell, y:(gy+oy+0.5)*pheromone.cell}; 
          }
        }
      }
      best = target || null;
    }
    this.target = best;
  }

  hunt(world, dt) {
    const persona = this.personality;
    persona.huntCooldown = Math.max(0, persona.huntCooldown - dt);

    const detectionRadius = this.genes.sense * (0.55 + persona.aggression * 0.35);
    const prey = world.findPrey(this, detectionRadius);
    if (prey && prey.alive) {
      if (persona.currentTargetId !== prey.id) {
        persona.currentTargetId = prey.id;
        persona.ambushTimer = persona.ambushDelay;
      }
      this.target = { x: prey.x, y: prey.y, creatureId: prey.id };
      if (persona.packInstinct > 0.35 && persona.huntCooldown <= 0) {
        const strength = clamp(0.45 + persona.packInstinct, 0.45, 1.6);
        world.registerPredatorSignal(prey.x, prey.y, strength, 5.5, this.id);
        persona.huntCooldown = 4.5 - Math.min(persona.packInstinct, 0.9);
        persona.lastSignalAt = world.t;
      }
      return;
    }

    const signal = persona.packInstinct > 0.25
      ? world.samplePredatorSignal(this.x, this.y, detectionRadius * 1.15, this.id)
      : null;
    if (signal) {
      this.target = { x: signal.x, y: signal.y, signal: true, strength: signal.strength };
      persona.currentTargetId = null;
      return;
    }

    this.target = null;
    persona.currentTargetId = null;
  }

  update(dt, world) {
    if (!this.alive) return;
    this.age += dt;
    
    // Call feature update methods
    if (this._updateMemory) this._updateMemory(dt, world);
    if (this._updateSocialBehavior) this._updateSocialBehavior(world);
    if (this._updateMigration) this._updateMigration(world, dt);
    
    const eff = this.effects;

    if (eff) {
      eff.hitFlash = Math.max(0, eff.hitFlash - dt);
      if (eff.herdBuff > 0) {
        eff.herdBuff = Math.max(0, eff.herdBuff - dt);
        if (eff.herdBuff <= 0) eff.herdIntensity = 0;
      }
      if (eff.adrenaline > 0) {
        eff.adrenaline = Math.max(0, eff.adrenaline - dt);
        if (eff.adrenaline <= 0) eff.adrenalineBoost = 0;
      }
      if (eff.adrenalineCooldown > 0) {
        eff.adrenalineCooldown = Math.max(0, eff.adrenalineCooldown - dt);
      }
      if (eff.bleed > 0) {
        const bleedRate = 0.45 + (eff.bleedStacks || 0) * 0.28;
        const bleedDamage = bleedRate * dt;
        if (bleedDamage > 0) {
          this.health = Math.max(0, this.health - bleedDamage);
          this.stats.damageTaken += bleedDamage;
          this.energy = Math.max(0, this.energy - bleedDamage * 0.1);
        }
        eff.bleed = Math.max(0, eff.bleed - dt);
        if (eff.bleed <= 0) eff.bleedStacks = 0;
      }
      if (eff.recentDamage > 0) {
        eff.recentDamage = Math.max(0, eff.recentDamage - dt);
      }
    }

    if (this.health < this.maxHealth) {
      const regenBase = this.genes.predator ? 0.9 : 1.6;
      const energyFactor = clamp(this.energy / 24, 0.3, 1.2);
      const grit = this.genes.grit ?? 0;
      let penalty = 1;
      if (eff) {
        if (eff.recentDamage > 0) {
          penalty -= Math.min(0.55, (0.45 - grit * 0.25));
        }
        if (eff.bleed > 0) {
          penalty -= Math.min(0.5, (eff.bleedStacks || 0) * 0.18 * (1 - grit * 0.35));
        }
      }
      penalty = clamp(penalty, 0.14, 1);
      this.health = Math.min(this.maxHealth, this.health + regenBase * energyFactor * penalty * dt);
    }

    if (eff) {
      const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
      if (healthRatio < 0.35 && eff.adrenaline <= 0 && eff.adrenalineCooldown <= 0) {
        const baseBoost = 0.35 + (this.genes.panicPheromone ?? 0) * 0.45 + (eff.herdIntensity ?? 0) * 0.2;
        eff.adrenaline = 2.6;
        eff.adrenalineBoost = baseBoost;
        eff.adrenalineCooldown = 7;
      }
    }

    let wanderScale = 0.05 * BehaviorConfig.wanderWeight;
    if (this.genes.predator) {
      this.hunt(world, dt);
      if (this.personality.currentTargetId) {
        const tracked = world.getAnyCreatureById(this.personality.currentTargetId);
        if (tracked && tracked.alive) {
          this.target = { x: tracked.x, y: tracked.y, creatureId: tracked.id };
        }
      }
      wanderScale *= clamp(1 - this.personality.aggression * 0.25, 0.25, 1);
    } else {
      this.seek(world.nearbyFood(this.x,this.y,this.genes.sense), world.pheromone);
    }

    if (this.genes.predator && this.personality.ambushTimer > 0) {
      this.personality.ambushTimer = Math.max(0, this.personality.ambushTimer - dt);
    }

    let desiredAngle = this.dir + randn(0, wanderScale);
    if (this.target) desiredAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    const aggressiveTurn = this.genes.predator && this.target && this.target.creatureId != null && this.personality.ambushTimer <= 0;
    const turnClamp = aggressiveTurn ? 0.22 : 0.15;
    let delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -turnClamp, turnClamp);

    const restFactor = BehaviorConfig.restWeight * clamp(1 - this.energy / 36, 0, 1);
    const aggressionFactor = this.genes.predator ? clamp(this.personality.aggression, 0.4, 2.2) : 1;
    let baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    if (this.genes.predator) baseSpeed *= 0.85 + aggressionFactor * 0.25;
    let speedScalar = clamp(1 - restFactor * 0.6, 0.15, 1);
    let speedBoost = 1;
    if (eff?.herdBuff > 0 && !this.genes.predator) {
      speedBoost += eff.herdIntensity;
    }
    if (eff?.adrenaline > 0) {
      speedBoost += eff.adrenalineBoost;
    }
    if (eff?.bleed > 0) {
      speedBoost -= Math.min(0.3, 0.08 * (eff.bleedStacks || 0));
    }
    speedScalar *= clamp(speedBoost, 0.6, 1.9);
    if (this.genes.predator) {
      if (this.personality.ambushTimer > 0 && this.target && this.target.creatureId != null) {
        speedScalar *= 0.25 + 0.15 * aggressionFactor;
      } else if (this.target && this.target.creatureId != null) {
        speedScalar *= 1.05 + aggressionFactor * 0.15;
      } else if (this.target && this.target.signal) {
        speedScalar *= 0.9 + this.personality.packInstinct * 0.35;
      }
    }

    const spd = baseSpeed * speedScalar;
    this.vx = Math.cos(this.dir) * spd;
    this.vy = Math.sin(this.dir) * spd;
    this.x = wrap(this.x + this.vx*dt, world.width);
    this.y = wrap(this.y + this.vy*dt, world.height);

    this.updateTrail(dt);

    if (this.genes.predator) {
      this.personality.attackCooldown = Math.max(0, this.personality.attackCooldown - dt);
      const attackResult = this.personality.attackCooldown <= 0 ? world.tryPredation(this) : null;
      if (attackResult?.victim) {
        if (attackResult.killed) {
          this.energy += 18;
          this.stats.kills += 1;
          this.logEvent(attackResult.victim?.id != null ? `Claimed prey #${attackResult.victim.id}` : 'Claimed prey', world.t);
          const victim = attackResult.victim;
          if (victim && typeof victim.logEvent === 'function') {
            victim.logEvent(this.id != null ? `Killed by predator #${this.id}` : 'Killed by predator', world.t);
          }
          if (this.stats.kills === 5) {
            world.lineageTracker?.noteMilestone(world, this, 'claimed 5 hunts');
          }
          this.target = null;
        } else if (attackResult.damage > 0) {
          this.logEvent(`Bit prey for ${attackResult.damage.toFixed(1)}`, world.t);
        }
      }
      if (!this.alive) return;
    } else {
      const eaten = world.tryEatFoodAt(this.x, this.y, 8);
      if (eaten) {
        this.energy += 6;
        this.health = Math.min(this.maxHealth, this.health + 1.5);
        this.stats.food += 1;
        this.logEvent('Foraged food', world.t);
        world.dropPheromone(this.x, this.y, 0.5);
        
        // FEATURE 2: Remember successful food location
        if (this.rememberLocation) {
          this.rememberLocation(this.x, this.y, 'food', 0.8, world.t);
        }
        
        if (this.stats.food === 20) {
          world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
        }
      }
    }

    const tempPenalty = world.tempPenaltyAt(this.x, this.y);
    let energyDrain = this.baseBurn() + tempPenalty;
    if (eff?.adrenaline > 0) energyDrain += 2.6 + eff.adrenalineBoost * 2;
    if (eff?.herdBuff > 0 && !this.genes.predator) energyDrain += eff.herdIntensity * 0.8;
    if (eff?.bleed > 0) energyDrain += 0.35 + (eff.bleedStacks || 0) * 0.4;
    if (this.genes.predator) {
      const aggressionTax = Math.max(0, (aggressionFactor - 1) * 0.18);
      energyDrain += aggressionTax;
    }
    this.energy -= energyDrain * dt;

    if (this.health <= 0) {
      this.alive = false;
      this.logEvent('Bled out', world.t);
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
      return;
    }

    if (!this.genes.predator && this.energy > 36) {
      this.energy *= 0.55;
      world.spawnChild(this);
    }

    if (this.energy <= 0 || this.age > 300) {
      this.alive = false;
      this.logEvent(this.energy <= 0 ? 'Energy collapse' : 'Old age', world.t);
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
    }
  }

  updateTrail(dt) {
    this.trailTimer += dt;
    if (this.trailTimer >= TRAIL_INTERVAL) {
      this.trailTimer = 0;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
  }

  logEvent(message, time, meta=null) {
    this.log.push({ message, time, meta });
    if (this.log.length > LOG_MAX) this.log.shift();
    this.logVersion += 1;
  }

  noteBirth(childId, time) {
    this.stats.births += 1;
    this.logEvent(`Spawned child #${childId}`, time);
  }

  getBadges() {
    const badges = [];
    const g = this.genes;
    if (g.speed >= 1.45) badges.push('Swift');
    if (g.sense >= 150) badges.push('Scout');
    if (g.metabolism <= 0.6) badges.push('Efficient');
    if (this.age >= 120) badges.push('Elder');
    if (!g.predator && this.stats.food >= 15) badges.push('Grazer');
    if (g.predator && this.stats.kills >= 3) badges.push('Apex');
    if (this.energy >= 35) badges.push('Charged');
    return badges;
  }

  draw(ctx, opts={}) {
    const {
      isSelected=false,
      isPinned=false,
      inLineage=false,
      showTrail=false,
      showVision=false,
      clusterHue=null
    } = opts;
    const effects = this.effects ?? null;

    if (showTrail && this.trail.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i=1;i<this.trail.length;i++) {
        const pt = this.trail[i];
        ctx.lineTo(pt.x, pt.y);
      }
      const trailColor = inLineage ? 'rgba(123,198,255,0.35)' : (isSelected || isPinned) ? 'rgba(255,240,180,0.35)' : 'rgba(200,210,255,0.18)';
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = inLineage ? 1.4 : 1;
      ctx.stroke();
      ctx.restore();
    }

    // Draw vision cone if enabled
    if (showVision && (isSelected || isPinned)) {
      ctx.save();
      
      // Sense radius (full circle)
      const senseRadius = this.genes.sense;
      ctx.beginPath();
      ctx.arc(this.x, this.y, senseRadius, 0, TAU);
      const hasTarget = this.target !== null;
      const senseColor = hasTarget 
        ? (this.genes.predator ? 'rgba(255,100,100,0.08)' : 'rgba(100,255,100,0.08)')
        : 'rgba(200,200,255,0.05)';
      ctx.fillStyle = senseColor;
      ctx.fill();
      ctx.strokeStyle = hasTarget 
        ? (this.genes.predator ? 'rgba(255,100,100,0.25)' : 'rgba(100,255,100,0.25)')
        : 'rgba(200,200,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // FOV cone
      const halfFov = this._halfFovRad;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, senseRadius, this.dir - halfFov, this.dir + halfFov);
      ctx.closePath();
      ctx.fillStyle = hasTarget
        ? (this.genes.predator ? 'rgba(255,80,80,0.12)' : 'rgba(80,255,80,0.12)')
        : 'rgba(255,255,150,0.08)';
      ctx.fill();
      ctx.strokeStyle = hasTarget
        ? (this.genes.predator ? 'rgba(255,80,80,0.4)' : 'rgba(80,255,80,0.4)')
        : 'rgba(255,255,150,0.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      
      ctx.restore();
    }

    const g = this.genes;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.dir);

    if (effects?.recentDamage > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 5, 0, TAU);
      ctx.strokeStyle = `rgba(255,96,96,${clamp(effects.recentDamage / 2.6, 0.15, 0.55)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const displayHue = clusterHue !== null ? clusterHue : g.hue;
    
    if (inLineage) {
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fillStyle = `hsla(${displayHue},100%,70%,0.18)`;
      ctx.fill();
    }

    const baseLight = g.predator ? 45 : 60;
    const flash = effects ? effects.hitFlash : 0;
    const lightness = Math.min(85, baseLight + flash * 90);
    ctx.fillStyle = `hsl(${displayHue},85%,${lightness}%)`;
    ctx.beginPath();
    ctx.moveTo(6,0);
    ctx.lineTo(-4,3.5);
    ctx.lineTo(-4,-3.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `hsla(${displayHue},90%,80%,${0.65 + flash * 0.4})`;
    ctx.lineWidth = 1;
    const r = clamp(this.energy/40, 0.2, 1.0) * (3+this.size);
    ctx.beginPath();
    ctx.arc(0,0,r,0,TAU);
    ctx.stroke();

    if (isPinned) {
      ctx.strokeStyle = 'rgba(140,200,255,0.9)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3,2]);
      ctx.beginPath();
      ctx.arc(0,0,r+4.5,0,TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,255,220,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0,0,r+7,0,TAU);
      ctx.stroke();
    }

    ctx.restore();

    if (this.maxHealth > 0) {
      const hpRatio = clamp(this.health / this.maxHealth, 0, 1);
      const barWidth = 12;
      const barHeight = 2;
      const x = this.x - barWidth / 2;
      const y = this.y - this.size - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = this.genes.predator ? 'rgba(255,120,120,0.85)' : 'rgba(120,255,160,0.85)';
      ctx.fillRect(x, y, barWidth * hpRatio, barHeight);
    }
  }
}
