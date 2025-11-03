import { rand, clamp } from './utils.js';
import { makeGenes, mutateGenes } from './genetics.js';
import { Creature } from './creature.js';

class ScalarField {
  constructor(w, h, cell, decay=0.985, diffuse=0.15) {
    this.w = Math.ceil(w/cell);
    this.h = Math.ceil(h/cell);
    this.cell = cell;
    this.decay = decay;
    this.diffuse = diffuse;
    this.grid = new Float32Array(this.w*this.h);
  }
  idx(x,y) { return (y*this.w + x); }
  inb(x,y){ return x>=0 && y>=0 && x<this.w && y<this.h; }
  get(x,y){ return this.inb(x,y) ? this.grid[this.idx(x,y)] : 0; }
  add(x,y,val){ if (this.inb(x,y)) this.grid[this.idx(x,y)] += val; }
  step() {
    // diffusion + decay (very cheap Jacobi-ish pass)
    const next = new Float32Array(this.grid.length);
    for (let y=0;y<this.h;y++){
      for (let x=0;x<this.w;x++){
        let s = this.get(x,y)* (1-this.diffuse);
        s += this.diffuse * 0.25 * (this.get(x+1,y)+this.get(x-1,y)+this.get(x,y+1)+this.get(x,y-1));
        next[this.idx(x,y)] = s * this.decay;
      }
    }
    this.grid = next;
  }
}

export class World {
  constructor(width, height) {
    this.width = width; this.height = height;
    this.creatures = [];
    this.food = []; // {x,y,r}
    this.pheromone = new ScalarField(width, height, 20, 0.992, 0.18);
    this.temperature = new ScalarField(width, height, 40, 1.0, 0.0);
    this.t = 0;

    // init temperature bands (cool edges, warm center)
    for (let y=0;y<this.temperature.h;y++){
      for (let x=0;x<this.temperature.w;x++){
        const nx = (x/this.temperature.w - 0.5);
        const ny = (y/this.temperature.h - 0.5);
        const r = Math.sqrt(nx*nx+ny*ny);
        this.temperature.grid[this.temperature.idx(x,y)] = clamp(0.7 - r, 0.0, 0.7); // 0..0.7 comfort
      }
    }
  }

  seed(nHerb=60, nPred=6, nFood=180) {
    for (let i=0;i<nHerb;i++) {
      const c = new Creature(rand(0,this.width), rand(0,this.height), makeGenes(), false);
      this.creatures.push(c);
    }
    for (let i=0;i<nPred;i++) {
      const g = makeGenes({ predator:1, speed:1.1, metabolism:1.2, hue:0 });
      const c = new Creature(rand(0,this.width), rand(0,this.height), g, false);
      this.creatures.push(c);
    }
    for (let i=0;i<nFood;i++) this.addFood(rand(0,this.width), rand(0,this.height), rand(1,2));
  }

  addFood(x,y,r=1.5){ this.food.push({x,y,r}); }

  nearbyFood(x,y,radius) {
    // simple coarse filter (you can spatial-hash later)
    return this.food;
  }

  tryEatFoodAt(x,y,reach=8) {
    for (let i=0;i<this.food.length;i++){
      const f = this.food[i];
      const dx = f.x - x, dy = f.y - y;
      if (dx*dx + dy*dy <= (reach+f.r)*(reach+f.r)) {
        // consume
        this.food.splice(i,1);
        return true;
      }
    }
    return false;
  }

  tryPredation(pred) {
    // predators eat nearest non-pred within short radius
    let best = -1, bestD2 = 80*80;
    for (let i=0;i<this.creatures.length;i++){
      const c = this.creatures[i];
      if (!c.alive || c === pred) continue;
      if (c.genes.predator) continue;
      const dx = c.x - pred.x, dy = c.y - pred.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    if (best >= 0) {
      const vic = this.creatures[best];
      vic.alive = false;
      return vic;
    }
    return null;
  }

  dropPheromone(x,y,val=1.0) {
    this.pheromone.add(Math.floor(x/this.pheromone.cell), Math.floor(y/this.pheromone.cell), val);
  }

  tempPenaltyAt(x,y) {
    // higher comfort -> lower penalty; invert and scale
    const v = this.temperature.get(Math.floor(x/this.temperature.cell), Math.floor(y/this.temperature.cell));
    // seasonal oscillation
    const season = 0.2 * Math.sin(this.t * 0.05);
    const comfort = clamp(v + season, 0, 0.8);
    return (0.5 - comfort) * 0.5; // 0..~0.5
  }

  spawnChild(parent) {
    const childGenes = mutateGenes(parent.genes, 0.05);
    const c = new Creature(parent.x, parent.y, childGenes, true);
    this.creatures.push(c);
  }

  step(dt) {
    this.t += dt;
    // light food respawn with chance
    if (Math.random() < 0.3) this.addFood(rand(0,this.width), rand(0,this.height), 1.4);

    // pheromone evolution
    this.pheromone.step();

    // update creatures
    for (let c of this.creatures) c.update(dt, this);
    // remove dead
    this.creatures = this.creatures.filter(c=>c.alive);
  }

  draw(ctx) {
    // food
    ctx.fillStyle = '#7fd36a';
    for (let f of this.food) {
      ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fill();
    }

    // pheromone overlay (very faint)
    const cell = this.pheromone.cell;
    for (let y=0;y<this.pheromone.h;y++){
      for (let x=0;x<this.pheromone.w;x++){
        const v = this.pheromone.get(x,y);
        if (v < 0.05) continue;
        ctx.fillStyle = `rgba(120,180,255,${Math.min(0.15, v*0.05)})`;
        ctx.fillRect(x*cell, y*cell, cell, cell);
      }
    }

    // creatures
    for (let c of this.creatures) c.draw(ctx);
  }
}
