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

    this.stats = { food: 0, kills: 0, births: 0 };
    this.trail = [{ x, y }];
    this.trailTimer = 0;
    this.log = [];
    this.logVersion = 0;
    
    // Cache expensive calculations
    this._cachedBaseBurn = null;
    this._senseRadius2Cache = null;
    this._halfFovRad = (genes.fov * 0.5) * Math.PI / 180; // Cache FOV in radians
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

  update(dt, world) {
    if (!this.alive) return;
    this.age += dt;

    // Sense & steer
    this.seek(world.nearbyFood(this.x,this.y,this.genes.sense), world.pheromone);

    const wanderScale = 0.05 * BehaviorConfig.wanderWeight;
    let desiredAngle = this.dir + randn(0, wanderScale);
    if (this.target) desiredAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    let delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -0.15, 0.15);

    const restFactor = BehaviorConfig.restWeight * clamp(1 - this.energy / 36, 0, 1);
    const spd = this.genes.speed * 40 * clamp(1 - restFactor * 0.6, 0.15, 1);
    this.vx = Math.cos(this.dir) * spd;
    this.vy = Math.sin(this.dir) * spd;
    this.x = wrap(this.x + this.vx*dt, world.width);
    this.y = wrap(this.y + this.vy*dt, world.height);

    this.updateTrail(dt);

    if (this.genes.predator) {
      const victim = world.tryPredation(this);
      if (victim) {
        this.energy += 18;
        this.stats.kills += 1;
        this.logEvent(victim?.id != null ? `Claimed prey #${victim.id}` : 'Claimed prey', world.t);
        if (victim && typeof victim.logEvent === 'function') {
          victim.logEvent(this.id != null ? `Killed by predator #${this.id}` : 'Killed by predator', world.t);
        }
        if (this.stats.kills === 5) {
          world.lineageTracker?.noteMilestone(world, this, 'claimed 5 hunts');
        }
      }
    } else {
      const eaten = world.tryEatFoodAt(this.x, this.y, 8);
      if (eaten) {
        this.energy += 6;
        this.stats.food += 1;
        this.logEvent('Foraged food', world.t);
        world.dropPheromone(this.x, this.y, 0.5);
        if (this.stats.food === 20) {
          world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
        }
      }
    }

    const tempPenalty = world.tempPenaltyAt(this.x, this.y);
    this.energy -= (this.baseBurn() + tempPenalty) * dt;

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
      showTrail=false
    } = opts;

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

    const g = this.genes;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.dir);

    if (inLineage) {
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fillStyle = `hsla(${g.hue},100%,70%,0.18)`;
      ctx.fill();
    }

    ctx.fillStyle = `hsl(${g.hue},85%,${g.predator?45:60}%)`;
    ctx.beginPath();
    ctx.moveTo(6,0);
    ctx.lineTo(-4,3.5);
    ctx.lineTo(-4,-3.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `hsla(${g.hue},90%,80%,0.65)`;
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
  }
}
