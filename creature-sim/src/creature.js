import { clamp, rand, randn, dist2, wrap } from './utils.js';

const TAU = Math.PI*2;

export class Creature {
  constructor(x, y, genes, opts={}) {
    const {
      isChild=false,
      id=0,
      lineageId=id,
      parentId=null
    } = opts;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.dir = rand(0, TAU);
    this.energy = isChild ? 18 : 24;       // starting energy pool
    this.age = 0;
    this.alive = true;
    this.genes = genes;
    this.size = 3.5 + (genes.predator?1.5:0); // preds slightly bigger
    this.target = null;
    this.id = id;
    this.parentId = parentId;
    this.lineageId = lineageId;
    this.energyHistory = [this.energy];
    this.energyVersion = 0;
    this.stats = {
      food: 0,
      kills: 0,
      births: 0
    };
  }

  // Energy model (per second, dt in seconds):
  // Base burn ∝ metabolism
  // Movement cost ∝ speed^2
  // Sensing cost ∝ (fov/90) + (sense/100)
  // Temperature penalty applied by world
  baseBurn() {
    const g = this.genes;
    const moveCost = 0.35 * g.speed * g.speed;
    const senseCost = 0.08 * (g.fov/90) + 0.06 * (g.sense/100);
    return (0.4 * g.metabolism) + moveCost + senseCost; // units energy/sec
  }

  seek(foodList, pheromone, width, height) {
    // Simple steering: scan nearest item within sense radius and field-of-view
    let best = null, bestD2 = Infinity;
    for (let f of foodList) {
      const d2 = dist2(this.x,this.y,f.x,f.y);
      if (d2 > this.genes.sense*this.genes.sense) continue;
      const ang = Math.atan2(f.y - this.y, f.x - this.x);
      let delta = Math.atan2(Math.sin(ang - this.dir), Math.cos(ang - this.dir));
      if (Math.abs(delta) * 180/Math.PI > this.genes.fov*0.5) continue;
      if (d2 < bestD2) { bestD2 = d2; best = f; }
    }
    // fallback: follow pheromone gradient (very coarse)
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

    // Sense & steer
    this.seek(world.nearbyFood(this.x,this.y,this.genes.sense), world.pheromone, world.width, world.height);

    // Steering towards target
    let desiredAngle = this.dir + randn(0, 0.05); // wander
    if (this.target) desiredAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    let delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -0.15, 0.15);

    // Move
    const spd = this.genes.speed * 40; // px/sec
    this.vx = Math.cos(this.dir) * spd;
    this.vy = Math.sin(this.dir) * spd;
    this.x = wrap(this.x + this.vx*dt, world.width);
    this.y = wrap(this.y + this.vy*dt, world.height);

    // Eat (herbivores eat food; predators eat herbivores)
    if (this.genes.predator) {
      const victim = world.tryPredation(this);
      if (victim) {
        this.energy += 18;
        this.stats.kills += 1;
      }
    } else {
      const eaten = world.tryEatFoodAt(this.x, this.y, 8);
      if (eaten) {
        this.energy += 6;
        this.stats.food += 1;
        world.dropPheromone(this.x, this.y, 0.5);
      }
    }

    // Energy drain + temperature penalty
    const tempPenalty = world.tempPenaltyAt(this.x, this.y); // 0..0.5 typical
    this.energy -= (this.baseBurn() + tempPenalty) * dt;

    // Reproduce
    if (!this.genes.predator && this.energy > 36) {
      this.energy *= 0.55; // cost to parent
      this.stats.births += 1;
      world.spawnChild(this);
    }

    // Death
    if (this.energy <= 0 || this.age > 300) {
      this.alive = false;
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5); // recycle
    }

    this.recordEnergy();
  }

  recordEnergy(maxSamples=240) {
    const history = this.energyHistory;
    history.push(this.energy);
    if (history.length > maxSamples) history.shift();
    this.energyVersion += 1;
  }

  draw(ctx, opts={}) {
    const {
      fillStyle,
      energyRing,
      isSelected=false,
      isLineageMate=false
    } = opts;
    const g = this.genes;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.dir);
    ctx.fillStyle = fillStyle ?? `hsl(${g.hue},85%,${g.predator?45:60}%)`;
    ctx.beginPath();
    // simple triangle body
    ctx.moveTo(6,0);
    ctx.lineTo(-4,3.5);
    ctx.lineTo(-4,-3.5);
    ctx.closePath();
    ctx.fill();

    const ringColor = energyRing ?? `hsla(${g.hue},90%,80%,0.65)`;
    // energy ring
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1;
    const r = clamp(this.energy/40, 0.2, 1.0) * (3+this.size);
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.stroke();

    if (isLineageMate && !isSelected) {
      ctx.strokeStyle = 'rgba(153,215,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0,0,r+2.5,0,TAU);
      ctx.stroke();
    }

    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,252,200,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0,0,r+3.2,0,TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,178,102,0.75)';
      ctx.setLineDash([2.5,2.5]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0,0,r+6,0,TAU);
      ctx.stroke();
    }

    ctx.restore();
  }
}
