import { clamp, rand, randn, dist2, wrap } from './utils.js';

const TAU = Math.PI*2;

export class Creature {
  constructor(x, y, genes, isChild=false) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.dir = rand(0, TAU);
    this.energy = isChild ? 18 : 24;
    this.age = 0;
    this.alive = true;
    this.genes = genes;
    this.size = 3.5 + (genes.predator?1.5:0);
    this.target = null;
    this.id = null;       // set by World.addCreature
    this.parentId = null; // set by World.addCreature
  }

  baseBurn() {
    const g = this.genes;
    const moveCost = 0.35 * g.speed * g.speed;
    const senseCost = 0.08 * (g.fov/90) + 0.06 * (g.sense/100);
    return (0.4 * g.metabolism) + moveCost + senseCost;
  }

  seek(foodList, pheromone, width, height) {
    let best = null, bestD2 = Infinity;
    for (let f of foodList) {
      const d2 = dist2(this.x,this.y,f.x,f.y);
      if (d2 > this.genes.sense*this.genes.sense) continue;
      const ang = Math.atan2(f.y - this.y, f.x - this.x);
      let delta = Math.atan2(Math.sin(ang - this.dir), Math.cos(ang - this.dir));
      if (Math.abs(delta) * 180/Math.PI > this.genes.fov*0.5) continue;
      if (d2 < bestD2) { bestD2 = d2; best = f; }
    }
    if (!best && pheromone) {
      const gx = Math.floor(this.x/pheromone.cell);
      const gy = Math.floor(this.y/pheromone.cell);
      const here = pheromone.get(gx,gy);
      let maxVal = here, target = null;
      for (let oy=-1; oy<=1; oy++) for (let ox=-1; ox<=1; ox++) {
        if (!ox && !oy) continue;
        const v = pheromone.get(gx+ox, gy+oy);
        if (v > maxVal) { maxVal = v; target = {x:(gx+ox+0.5)*pheromone.cell, y:(gy+oy+0.5)*pheromone.cell}; }
      }
      best = target || null;
    }
    this.target = best;
  }

  update(dt, world) {
    if (!this.alive) return;
    this.age += dt;
    this.seek(world.nearbyFood(this.x,this.y,this.genes.sense), world.pheromone, world.width, world.height);

    let desiredAngle = this.dir + randn(0, 0.05);
    if (this.target) desiredAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    let delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -0.15, 0.15);

    const spd = this.genes.speed * 40;
    this.vx = Math.cos(this.dir) * spd;
    this.vy = Math.sin(this.dir) * spd;
    this.x = wrap(this.x + this.vx*dt, world.width);
    this.y = wrap(this.y + this.vy*dt, world.height);

    if (this.genes.predator) {
      const victim = world.tryPredation(this);
      if (victim) this.energy += 18;
    } else {
      const eaten = world.tryEatFoodAt(this.x, this.y, 8);
      if (eaten) { this.energy += 6; world.dropPheromone(this.x, this.y, 0.5); }
    }

    const tempPenalty = world.tempPenaltyAt(this.x, this.y);
    this.energy -= (this.baseBurn() + tempPenalty) * dt;

    if (!this.genes.predator && this.energy > 36) {
      this.energy *= 0.55;
      world.spawnChild(this);
    }

    if (this.energy <= 0 || this.age > 300) {
      this.alive = false;
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
    }
  }

  draw(ctx, { isSelected=false, inLineage=false } = {}) {
    const g = this.genes;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.dir);

    // lineage glow underlay
    if (inLineage) {
      ctx.beginPath();
      ctx.arc(0,0, 10, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${g.hue},100%,70%,0.18)`;
      ctx.fill();
    }

    // body
    ctx.fillStyle = `hsl(${g.hue},85%,${g.predator?45:60}%)`;
    ctx.beginPath();
    ctx.moveTo(6,0);
    ctx.lineTo(-4,3.5);
    ctx.lineTo(-4,-3.5);
    ctx.closePath();
    ctx.fill();

    // energy ring
    ctx.strokeStyle = `hsla(${g.hue},90%,80%,0.65)`;
    ctx.lineWidth = 1;
    const r = clamp(this.energy/40, 0.2, 1.0) * (3+this.size);
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.stroke();

    // selection ring
    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0,0, 12, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
