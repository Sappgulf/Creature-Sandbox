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
    const next = new Float32Array(this.grid.length);
    for (let y=0;y<this.h;y++){
      for (let x=0;x<this.w;x++){
        let s = this.get(x,y)*(1-this.diffuse);
        s += this.diffuse*0.25*(this.get(x+1,y)+this.get(x-1,y)+this.get(x,y+1)+this.get(x,y-1));
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
    this.food = [];
    this.pheromone = new ScalarField(width, height, 20, 0.992, 0.18);
    this.temperature = new ScalarField(width, height, 40, 1.0, 0.0);
    this.t = 0;

    // lineage + registry
    this._nextId = 1;
    this.childrenOf = new Map(); // id -> Set(childIds)
    this.registry = new Map();

    // init temperature bands
    for (let y=0;y<this.temperature.h;y++){
      for (let x=0;x<this.temperature.w;x++){
        const nx=(x/this.temperature.w - 0.5), ny=(y/this.temperature.h - 0.5);
        const r=Math.sqrt(nx*nx+ny*ny);
        this.temperature.grid[this.temperature.idx(x,y)] = clamp(0.7 - r, 0.0, 0.7);
      }
    }
  }

  addCreature(creature, parentId=null){
    creature.id = this._nextId++;
    creature.parentId = parentId;
    this.creatures.push(creature);
    this.registry.set(creature.id, creature);
    if (parentId) {
      if (!this.childrenOf.has(parentId)) this.childrenOf.set(parentId, new Set());
      this.childrenOf.get(parentId).add(creature.id);
    }
    return creature.id;
  }

  seed(nHerb=60, nPred=6, nFood=180) {
    for (let i=0;i<nHerb;i++) {
      this.addCreature(new Creature(rand(0,this.width), rand(0,this.height), makeGenes()), null);
    }
    for (let i=0;i<nPred;i++) {
      const g = makeGenes({ predator:1, speed:1.1, metabolism:1.2, hue:0 });
      this.addCreature(new Creature(rand(0,this.width), rand(0,this.height), g), null);
    }
    for (let i=0;i<nFood;i++) this.addFood(rand(0,this.width), rand(0,this.height), rand(1,2));
  }

  addFood(x,y,r=1.5){ this.food.push({x,y,r}); }

  nearbyFood(x,y,radius){ return this.food; }

  tryEatFoodAt(x,y,reach=8) {
    for (let i=0;i<this.food.length;i++){
      const f=this.food[i]; const dx=f.x-x, dy=f.y-y;
      if (dx*dx+dy*dy <= (reach+f.r)*(reach+f.r)) { this.food.splice(i,1); return true; }
    }
    return false;
  }

  tryPredation(pred) {
    let best=-1, bestD2=80*80;
    for (let i=0;i<this.creatures.length;i++){
      const c=this.creatures[i];
      if (!c.alive || c===pred) continue;
      if (c.genes.predator) continue;
      const dx=c.x-pred.x, dy=c.y-pred.y, d2=dx*dx+dy*dy;
      if (d2<bestD2) { bestD2=d2; best=i; }
    }
    if (best>=0){ const vic=this.creatures[best]; vic.alive=false; return vic; }
    return null;
  }

  dropPheromone(x,y,val=1.0){
    this.pheromone.add(Math.floor(x/this.pheromone.cell), Math.floor(y/this.pheromone.cell), val);
  }

  tempPenaltyAt(x,y){
    const v=this.temperature.get(Math.floor(x/this.temperature.cell), Math.floor(y/this.temperature.cell));
    const season=0.2*Math.sin(this.t*0.05);
    const comfort=clamp(v+season,0,0.8);
    return (0.5-comfort)*0.5;
  }

  spawnChild(parent){
    const childGenes = mutateGenes(parent.genes, 0.05);
    const child = new Creature(parent.x, parent.y, childGenes, true);
    const childId = this.addCreature(child, parent.id);
    if (typeof parent.noteBirth === 'function') {
      parent.noteBirth(childId, this.t);
    }
  }

  /** Fast nearest creature search (linear; good enough for hundreds). */
  nearestCreature(x,y,maxDistPx=30){
    let best=null, bestD2=maxDistPx*maxDistPx;
    for (const c of this.creatures){
      if (!c.alive) continue;
      const dx=c.x-x, dy=c.y-y, d2=dx*dx+dy*dy;
      if (d2<bestD2){ bestD2=d2; best=c; }
    }
    return best;
  }

  /** Compute all descendants of rootId (BFS over childrenOf). */
  descendantsOf(rootId){
    const out=new Set([rootId]);
    const q=[rootId];
    while(q.length){
      const id=q.shift();
      const kids=this.childrenOf.get(id);
      if (!kids) continue;
      for (const k of kids){ if (!out.has(k)){ out.add(k); q.push(k); } }
    }
    return out;
  }

  getCreatureById(id){ return this.creatures.find(c=>c.id===id); }

  getAnyCreatureById(id){ return this.registry.get(id) ?? null; }

  getAncestors(id, maxDepth=12) {
    const chain = [];
    let current = this.getAnyCreatureById(id);
    let depth = 0;
    while (current && current.parentId && depth < maxDepth) {
      const parent = this.getAnyCreatureById(current.parentId);
      if (!parent) break;
      chain.push(parent);
      current = parent;
      depth++;
    }
    return chain;
  }

  buildLineageOverview(rootId, maxDepth=6) {
    if (!rootId) return null;
    const visited = new Set([rootId]);
    const queue = [{ id: rootId, depth: 0 }];
    const levels = [];
    let aliveDesc = 0;

    while (queue.length) {
      const { id, depth } = queue.shift();
      if (depth > maxDepth) continue;
      if (!levels[depth]) levels[depth] = [];
      const node = this.getAnyCreatureById(id);
      if (node) {
        levels[depth].push(node);
        if (depth > 0 && node.alive) aliveDesc++;
      }
      const kids = this.childrenOf.get(id);
      if (!kids) continue;
      for (const childId of kids) {
        if (visited.has(childId)) continue;
        visited.add(childId);
        queue.push({ id: childId, depth: depth + 1 });
      }
    }

    const totalDesc = Math.max(0, visited.size - 1);
    const levelSummaries = levels.slice(1).map((nodes, idx) => {
      const alive = nodes.filter(c => c && c.alive).length;
      const sample = nodes.slice(0, 3).map(c => c ? c.id : null);
      return {
        depth: idx + 1,
        total: nodes.length,
        alive,
        sample
      };
    });

    return {
      root: this.getAnyCreatureById(rootId) ?? null,
      totalDesc,
      aliveDesc,
      levels: levelSummaries
    };
  }

  step(dt){
    this.t += dt;
    if (Math.random()<0.3) this.addFood(rand(0,this.width), rand(0,this.height), 1.4);
    this.pheromone.step();
    for (let c of this.creatures) c.update(dt, this);
    this.creatures = this.creatures.filter(c=>c.alive);
  }

  draw(ctx, opts={}){
    const {
      selectedId=null,
      pinnedId=null,
      lineageRootId=null
    } = opts;

    // food
    ctx.fillStyle = '#7fd36a';
    for (let f of this.food){ ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,Math.PI*2); ctx.fill(); }

    // pheromone overlay (very faint)
    const cell=this.pheromone.cell;
    for (let y=0;y<this.pheromone.h;y++){
      for (let x=0;x<this.pheromone.w;x++){
        const v=this.pheromone.get(x,y);
        if (v<0.05) continue;
        ctx.fillStyle=`rgba(120,180,255,${Math.min(0.15, v*0.05)})`;
        ctx.fillRect(x*cell,y*cell,cell,cell);
      }
    }

    // precompute lineage set for glow
    const lineageSet = lineageRootId ? this.descendantsOf(lineageRootId) : null;

    // creatures
    for (let c of this.creatures){
      const isSelected = (c.id===selectedId);
      const isPinned = (pinnedId != null && c.id === pinnedId);
      const inLineage = lineageSet ? lineageSet.has(c.id) : false;
      const showTrail = isSelected || isPinned || inLineage;
      c.draw(ctx, { isSelected, isPinned, inLineage, showTrail });
    }
  }
}
