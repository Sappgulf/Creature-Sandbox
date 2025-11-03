import { rand, clamp, dist2 } from './utils.js';
import { makeGenes, mutateGenes } from './genetics.js';
import { Creature } from './creature.js';
import { SpatialGrid } from './spatial-grid.js';

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
    this.creatureGrid = new SpatialGrid(48);
    this.foodGrid = new SpatialGrid(36);
    this.gridDirty = true;
    this.lineageTracker = null;
    this.seasonPhase = 0;
    this.seasonSpeed = 0.015;
    this.maxFood = Math.floor((width * height) / 320);

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
    this.gridDirty = true;
    return creature.id;
  }

  attachLineageTracker(tracker) {
    this.lineageTracker = tracker;
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
    this.gridDirty = true;
  }

  reset() {
    this.creatures = [];
    this.food = [];
    this.childrenOf.clear();
    this.registry.clear();
    this._nextId = 1;
    this.gridDirty = true;
    this.t = 0;
    this.seasonPhase = 0;
    this.maxFood = Math.floor((this.width * this.height) / 320);
  }

  addFood(x,y,r=1.5){
    const food = {x,y,r};
    this.food.push(food);
    this.gridDirty = true;
  }

  nearbyFood(x,y,radius){
    this.ensureSpatial();
    const candidates = this.foodGrid.nearby(x,y,radius);
    return candidates;
  }

  tryEatFoodAt(x,y,reach=8) {
    this.ensureSpatial();
    const reach2 = (reach*1.1)*(reach*1.1);
    for (let i=this.food.length-1; i>=0; i--) {
      const f = this.food[i];
      if (dist2(f.x, f.y, x, y) <= reach2) {
        this.food.splice(i,1);
        this.gridDirty = true;
        return true;
      }
    }
    return false;
  }

  tryPredation(pred) {
    this.ensureSpatial();
    const range = 85;
    const candidates = this.creatureGrid.nearby(pred.x, pred.y, range);
    let best = null;
    let bestD2 = range*range;
    for (const c of candidates) {
      if (!c.alive || c === pred) continue;
      if (c.genes.predator) continue;
      const d2 = dist2(c.x, c.y, pred.x, pred.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = c;
      }
    }
    if (best) {
      best.alive = false;
      this.gridDirty = true;
      this.lineageTracker?.noteMilestone(this, pred, `hunted #${best.id}`);
    }
    return best;
  }

  dropPheromone(x,y,val=1.0){
    this.pheromone.add(Math.floor(x/this.pheromone.cell), Math.floor(y/this.pheromone.cell), val);
  }

  tempPenaltyAt(x,y){
    const base=this.temperature.get(Math.floor(x/this.temperature.cell), Math.floor(y/this.temperature.cell));
    const wave = 0.15 * Math.sin(this.seasonPhase + x / this.width * Math.PI * 2);
    const ridge = 0.1 * Math.cos(this.seasonPhase*0.7 + y / this.height * Math.PI * 3);
    const comfort=clamp(base + wave + ridge,0,0.85);
    return (0.5-comfort)*0.5;
  }

  spawnChild(parent){
    const childGenes = mutateGenes(parent.genes, 0.05);
    const child = new Creature(parent.x, parent.y, childGenes, true);
    const childId = this.addCreature(child, parent.id);
    if (typeof parent.noteBirth === 'function') {
      parent.noteBirth(childId, this.t);
    }
    this.lineageTracker?.noteBirth(this, parent, child);
  }

  nearestCreature(x,y,maxDistPx=30){
    this.ensureSpatial();
    const candidates = this.creatureGrid.nearby(x,y,maxDistPx);
    let best = null;
    let bestD2 = maxDistPx*maxDistPx;
    for (const c of candidates) {
      if (!c.alive) continue;
      const d2 = dist2(c.x, c.y, x, y);
      if (d2 < bestD2) { bestD2 = d2; best = c; }
    }
    return best;
  }

  queryCreatures(x,y,radius){
    this.ensureSpatial();
    const rad2 = radius*radius;
    return this.creatureGrid.nearby(x,y,radius).filter(c=>c.alive && dist2(c.x,c.y,x,y)<=rad2);
  }

  spawnManual(x, y, predator=false) {
    const genes = predator ? makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 }) : makeGenes();
    const creature = new Creature(x, y, genes, false);
    this.addCreature(creature, null);
    this.lineageTracker?.ensureName(this.lineageTracker.getRoot(this, creature.id));
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
    this.seasonPhase += dt * this.seasonSpeed;
    this.ensureSpatial();
    if (this.food.length < this.maxFood && Math.random()<this.foodGrowthRate()) {
      const spot = this.pickHabitatSpot();
      this.addFood(spot.x, spot.y, 1.2);
    }
    this.pheromone.step();
    for (let c of this.creatures) c.update(dt, this);
    this.creatures = this.creatures.filter(c=>c.alive);
    this.gridDirty = true;
  }

  foodGrowthRate() {
    const base = 0.18;
    const scarcity = clamp(1 - this.food.length / Math.max(1, this.maxFood), 0, 1);
    return (base + 0.4 * scarcity) * 0.016;
  }

  pickHabitatSpot() {
    const band = (Math.sin(this.seasonPhase) + 1) * 0.5;
    const x = (band * this.width) + rand(-this.width*0.25, this.width*0.25);
    const y = rand(0, this.height);
    return { x: (x + this.width) % this.width, y };
  }

  ensureSpatial(){
    if (!this.gridDirty) return;
    this.creatureGrid.clear();
    for (const c of this.creatures) {
      if (c.alive) this.creatureGrid.insert(c, c.x, c.y);
    }
    this.foodGrid.clear();
    for (const f of this.food) this.foodGrid.insert(f, f.x, f.y);
    this.gridDirty = false;
  }

  exportState() {
    return {
      width: this.width,
      height: this.height,
      time: this.t,
      creatures: this.creatures.map(c => ({
        id: c.id,
        parentId: c.parentId,
        genes: { ...c.genes },
        x: c.x,
        y: c.y,
        dir: c.dir,
        energy: c.energy,
        age: c.age,
        stats: { ...c.stats }
      })),
      food: this.food.map(f => ({ ...f }))
    };
  }

  importState(snapshot) {
    this.reset();
    this.width = snapshot.width ?? this.width;
    this.height = snapshot.height ?? this.height;
    this.t = snapshot.time ?? 0;
    for (const data of snapshot.creatures ?? []) {
      const c = new Creature(data.x, data.y, data.genes ?? makeGenes(), false);
      c.id = data.id;
      c.parentId = data.parentId ?? null;
      c.dir = data.dir ?? 0;
      c.energy = data.energy ?? 24;
      c.age = data.age ?? 0;
      c.stats = { food:0, kills:0, births:0, ...(data.stats ?? {}) };
      this.creatures.push(c);
      this.registry.set(c.id, c);
      if (c.parentId) {
        if (!this.childrenOf.has(c.parentId)) this.childrenOf.set(c.parentId, new Set());
        this.childrenOf.get(c.parentId).add(c.id);
      }
      this._nextId = Math.max(this._nextId, (c.id ?? 0) + 1);
    }
    this.food = (snapshot.food ?? []).map(f => ({ ...f }));
    this.gridDirty = true;
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
