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
    this.nextGrid = new Float32Array(this.w*this.h); // Double buffer to avoid allocation
  }
  idx(x,y) { return (y*this.w + x); }
  inb(x,y){ return x>=0 && y>=0 && x<this.w && y<this.h; }
  get(x,y){ return this.inb(x,y) ? this.grid[this.idx(x,y)] : 0; }
  add(x,y,val){ if (this.inb(x,y)) this.grid[this.idx(x,y)] += val; }
  step() {
    // Use double buffering - swap instead of allocate
    const diffuse025 = this.diffuse * 0.25;
    const oneMinusDiffuse = 1 - this.diffuse;
    
    for (let y=0;y<this.h;y++){
      for (let x=0;x<this.w;x++){
        let s = this.get(x,y) * oneMinusDiffuse;
        s += diffuse025 * (this.get(x+1,y)+this.get(x-1,y)+this.get(x,y+1)+this.get(x,y-1));
        this.nextGrid[this.idx(x,y)] = s * this.decay;
      }
    }
    // Swap buffers instead of creating new array
    const temp = this.grid;
    this.grid = this.nextGrid;
    this.nextGrid = temp;
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
    
    // Disaster system
    this.disasterCooldown = 0;
    this.activeDisaster = null;
    this.disasterDuration = 0;
    this.disasters = {
      meteorStorm: { name: 'Meteor Storm', duration: 5, cooldown: 180 },
      iceAge: { name: 'Ice Age', duration: 60, cooldown: 240 },
      plague: { name: 'Plague', duration: 30, cooldown: 200 },
      drought: { name: 'Drought', duration: 30, cooldown: 150 }
    };

    // Biome system
    this.biomes = this._createBiomes();
    this.predatorSignals = [];
    this.environment = this._defaultEnvironment();
    this.eventSystem = this._createEventSystem();
    this.lineagePulse = this._createLineagePulse();
    this.ecoStats = { meanHealth: 0.6, predatorRatio: 0.2, biomass: 0, lastUpdate: 0 };

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
    this.environment = this._defaultEnvironment();
    this.eventSystem = this._createEventSystem();
    this.predatorSignals = [];
    this.lineagePulse = this._createLineagePulse();
    this.ecoStats = { meanHealth: 0.6, predatorRatio: 0.2, biomass: 0, lastUpdate: 0 };
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
    // Use spatial grid for faster lookup instead of iterating all food
    const candidates = this.foodGrid.nearby(x, y, reach*1.1);
    for (const f of candidates) {
      if (dist2(f.x, f.y, x, y) <= reach2) {
        // Remove from main array
        const idx = this.food.indexOf(f);
        if (idx !== -1) {
          this.food.splice(idx, 1);
          this.gridDirty = true;
          return true;
        }
      }
    }
    return false;
  }

  tryPredation(pred) {
    this.ensureSpatial();
    const attackRange = 14;
    const attackRange2 = attackRange * attackRange;
    const targetId = pred?.personality?.currentTargetId ?? null;
    let victim = null;
    let bestD2 = attackRange2;

    if (targetId) {
      const tracked = this.getAnyCreatureById(targetId);
      if (tracked && tracked.alive && !tracked.genes.predator) {
        const d2 = dist2(tracked.x, tracked.y, pred.x, pred.y);
        if (d2 <= attackRange2) {
          victim = tracked;
          bestD2 = d2;
        }
      }
    }

    if (!victim) {
      const candidates = this.creatureGrid.nearby(pred.x, pred.y, attackRange);
      for (const c of candidates) {
        if (!c.alive || c === pred) continue;
        if (c.genes.predator) continue;
        const d2 = dist2(c.x, c.y, pred.x, pred.y);
        if (d2 <= attackRange2 && d2 < bestD2) {
          bestD2 = d2;
          victim = c;
        }
      }
    }
    if (!victim) return null;

    const damage = this._predatorDamage(pred, victim);
    const applied = this._applyDamage(victim, damage, { attacker: pred, type: 'bite' });

    if (pred.personality) {
      pred.personality.attackCooldown = this._predatorAttackCooldown(pred);
      pred.personality.currentTargetId = victim.id ?? null;
      pred.personality.ambushTimer = 0;
    }

    if (!applied) return null;

    this._triggerPanicResponse(victim, pred, applied.damage);

    const reflect = this._herbivoreReflectDamage(victim, pred, applied.damage);
    if (reflect > 0) {
      const retaliation = this._applyDamage(pred, reflect, { attacker: victim, type: 'spine' });
      if (retaliation?.damage > 0) {
        this._inflictBleed(pred, victim.genes.spines ?? 0);
      }
    }

    if (applied.killed && pred.personality) {
      pred.personality.currentTargetId = null;
    }

    return { victim, damage: applied.damage, killed: applied.killed };
  }

  findPrey(pred, radius=120) {
    this.ensureSpatial();
    const searchRadius = Math.max(20, radius);
    const candidates = this.creatureGrid.nearby(pred.x, pred.y, searchRadius);
    let best = null;
    let bestScore = searchRadius * searchRadius;
    for (const c of candidates) {
      if (!c.alive || c === pred) continue;
      if (c.genes.predator) continue;
      const d2 = dist2(c.x, c.y, pred.x, pred.y);
      if (d2 < bestScore) {
        bestScore = d2;
        best = c;
      }
    }
    return best;
  }

  dropPheromone(x,y,val=1.0){
    this.pheromone.add(Math.floor(x/this.pheromone.cell), Math.floor(y/this.pheromone.cell), val);
  }

  registerPredatorSignal(x, y, strength=1, ttl=5, sourceId=null) {
    const safeStrength = clamp(strength, 0, 2);
    const safeTtl = Math.max(0.5, ttl);
    this.predatorSignals.push({
      x,
      y,
      strength: safeStrength,
      ttl: safeTtl,
      sourceId,
      bornAt: this.t
    });
    if (this.predatorSignals.length > 64) {
      this.predatorSignals.splice(0, this.predatorSignals.length - 64);
    }
  }

  samplePredatorSignal(x, y, radius=140, excludeSource=null) {
    if (!this.predatorSignals.length) return null;
    const r2 = radius*radius;
    let best = null;
    let bestScore = 0;
    for (const sig of this.predatorSignals) {
      if (excludeSource != null && sig.sourceId === excludeSource) continue;
      if (sig.ttl <= 0 || sig.strength <= 0) continue;
      const d2 = dist2(sig.x, sig.y, x, y);
      if (d2 > r2) continue;
      const score = sig.strength / Math.max(0.35, Math.sqrt(d2));
      if (score > bestScore) {
        bestScore = score;
        best = sig;
      }
    }
    return best;
  }

  _applyDamage(target, amount, ctx={}) {
    if (!target || !target.alive) return null;
    const dmg = Math.max(0, amount);
    if (dmg <= 0) return { damage: 0, killed: false };

    target.health = Math.max(0, target.health - dmg);
    target.stats.damageTaken = (target.stats.damageTaken ?? 0) + dmg;
    const attacker = ctx.attacker ?? null;
    if (attacker && attacker !== target) {
      attacker.stats.damageDealt = (attacker.stats.damageDealt ?? 0) + dmg;
      attacker.effects && (attacker.effects.hitFlash = Math.max(attacker.effects.hitFlash ?? 0, 0.18));
    }

    if (target.effects) {
      target.effects.recentDamage = Math.min(2.6, (target.effects.recentDamage ?? 0) + 1.2);
      target.effects.hitFlash = Math.max(target.effects.hitFlash ?? 0, 0.3 + Math.min(0.2, dmg * 0.02));
    }

    if (ctx.type === 'bite') {
      if (typeof target.logEvent === 'function') {
        target.logEvent(attacker?.id != null ? `Bitten by predator #${attacker.id}` : 'Bitten by predator', this.t, { damage: dmg });
      }
      if (attacker) {
        const fleeAngle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
        target.dir = fleeAngle;
      }
      target.target = null;
      if (target.personality) target.personality.currentTargetId = null;
    }

    let killed = false;
    if (target.health <= 0 && ctx.allowDeath !== false) {
      target.alive = false;
      this.gridDirty = true;
      killed = true;
      if (ctx.type === 'bite' && attacker?.genes?.predator) {
        this.lineageTracker?.noteMilestone(this, attacker, `hunted #${target.id}`);
      }
    }

    return { damage: dmg, killed };
  }

  _herbivoreReflectDamage(victim, pred, incomingDamage) {
    if (!victim || victim.genes.predator) return 0;
    const spines = victim.genes.spines ?? 0;
    if (spines <= 0.05) return 0;
    const herd = victim.effects?.herdIntensity ?? 0;
    const reflectScale = clamp(0.25 + spines * 0.6 + herd * 0.35, 0.1, 0.7);
    const reflect = incomingDamage * reflectScale;
    return Math.max(0, reflect);
  }

  _applyHerdBuff(victim, predator, magnitude) {
    if (!victim || victim.genes.predator) return;
    const herd = victim.genes.herdInstinct ?? 0;
    if (herd <= 0.05) return;
    const radius = 90 + herd * 80;
    const allies = this.queryCreatures(victim.x, victim.y, radius);
    if (!allies.length) return;
    const duration = 2.5 + herd * 2.2;
    const intensity = 0.12 + herd * 0.45;
    for (const ally of allies) {
      if (ally.genes.predator) continue;
      ally.effects = ally.effects ?? {};
      ally.effects.herdBuff = Math.max(ally.effects.herdBuff ?? 0, duration);
      ally.effects.herdIntensity = Math.max(ally.effects.herdIntensity ?? 0, intensity);
      if (ally !== victim && ally.effects.adrenalineCooldown <= 1.5) {
        ally.effects.adrenaline = Math.max(ally.effects.adrenaline ?? 0, 1.2);
        ally.effects.adrenalineBoost = Math.max(ally.effects.adrenalineBoost ?? 0, 0.25 + herd * 0.2);
        ally.effects.adrenalineCooldown = Math.max(ally.effects.adrenalineCooldown ?? 0, 3.5);
      }
    }
  }

  _triggerPanicResponse(victim, predator, damage) {
    if (!victim || victim.genes.predator) return;
    const panic = victim.genes.panicPheromone ?? 0;
    if (panic > 0) {
      const intensity = 0.6 + panic * 0.8 + Math.min(0.45, damage / Math.max(6, victim.maxHealth ?? 12));
      this.dropPheromone(victim.x, victim.y, intensity);
    }
    this._applyHerdBuff(victim, predator, damage);
  }

  _inflictBleed(pred, severity) {
    if (!pred || !pred.alive || severity <= 0) return;
    const eff = pred.effects;
    if (!eff) return;
    const stacks = clamp(severity * 2.2, 0.4, 2.6);
    eff.bleed = Math.min(6, (eff.bleed ?? 0) + 2 + severity * 2.4);
    eff.bleedStacks = Math.min(5, (eff.bleedStacks ?? 0) + stacks);
    eff.hitFlash = Math.max(eff.hitFlash ?? 0, 0.22);
  }

  updateEcoStats() {
    const stats = this.ecoStats ?? (this.ecoStats = { meanHealth: 0.6, predatorRatio: 0.2, biomass: 0, lastUpdate: 0 });
    const total = this.creatures.length;
    if (!total) {
      stats.meanHealth = 0;
      stats.predatorRatio = 0;
      stats.biomass = 0;
      stats.lastUpdate = this.t;
      return;
    }
    let healthFraction = 0;
    let predators = 0;
    let biomass = 0;
    for (const c of this.creatures) {
      const maxH = Math.max(1, c.maxHealth ?? 1);
      const currentH = Math.max(0, Math.min(maxH, c.health ?? maxH));
      healthFraction += currentH / maxH;
      if (c.genes.predator) predators++;
      biomass += maxH;
    }
    stats.meanHealth = clamp(healthFraction / total, 0, 1);
    stats.predatorRatio = clamp(predators / total, 0, 1);
    stats.biomass = biomass;
    stats.lastUpdate = this.t;
  }

  tempPenaltyAt(x,y){
    const base=this.temperature.get(Math.floor(x/this.temperature.cell), Math.floor(y/this.temperature.cell));
    const wave = 0.15 * Math.sin(this.seasonPhase + x / this.width * Math.PI * 2);
    const ridge = 0.1 * Math.cos(this.seasonPhase*0.7 + y / this.height * Math.PI * 3);
    const env = this.environment;
    const comfort = clamp(base + wave + ridge + env.tempOffset,0,0.85);
    let penalty = (0.5-comfort)*0.5;
    penalty = penalty * env.tempPenaltyScale + env.tempPenaltyAdd;
    return penalty;
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
    let qIndex = 0; // Use index instead of shift() for O(1) dequeue
    while(qIndex < q.length){
      const id = q[qIndex++];
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
    let qIndex = 0; // Use index instead of shift() for O(1) dequeue
    const levels = [];
    let aliveDesc = 0;

    while (qIndex < queue.length) {
      const { id, depth } = queue[qIndex++];
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
    this.updateEcoStats();
    this.t += dt;
    this.seasonPhase += dt * this.seasonSpeed;
    this.updateSeasonalEvents(dt);
    this.updatePredatorSignals(dt);
    this.updateDisasters(dt);
    this.ensureSpatial();
    
    // Modify food growth based on active disasters
    let foodRateModifier = 1.0;
    if (this.activeDisaster === 'iceAge') foodRateModifier = 0.2;
    if (this.activeDisaster === 'drought') foodRateModifier = 0;
    
    if (this.food.length < this.maxFood && Math.random()<(this.foodGrowthRate() * foodRateModifier)) {
      const spot = this.pickHabitatSpot();
      this.addFood(spot.x, spot.y, 1.2);
    }
    this.pheromone.step();
    for (let c of this.creatures) c.update(dt, this);
    this.creatures = this.creatures.filter(c=>c.alive);
    this.updateLineagePulse(dt);
    this.updateEcoStats();
    this.gridDirty = true;
  }

  foodGrowthRate() {
    const base = 0.18;
    const scarcity = clamp(1 - this.food.length / Math.max(1, this.maxFood), 0, 1);
    return (base + 0.4 * scarcity) * 0.016 * this.environment.foodRateMultiplier;
  }

  updateDisasters(dt) {
    // Update cooldown
    if (this.disasterCooldown > 0) {
      this.disasterCooldown -= dt;
    }

    // Handle active disaster
    if (this.activeDisaster) {
      this.disasterDuration -= dt;
      if (this.disasterDuration <= 0) {
        this.endDisaster();
      } else {
        this.applyDisasterEffects(dt);
      }
      return;
    }

    // Random chance to trigger disaster (0.05% per frame when off cooldown)
    if (this.disasterCooldown <= 0 && this.creatures.length > 10 && Math.random() < 0.0005) {
      this.triggerRandomDisaster();
    }
  }

  triggerRandomDisaster() {
    const types = ['meteorStorm', 'iceAge', 'plague', 'drought'];
    const type = types[Math.floor(Math.random() * types.length)];
    const config = this.disasters[type];
    
    this.activeDisaster = type;
    this.disasterDuration = config.duration;
    this.disasterCooldown = config.cooldown;

    // Log event
    if (this.lineageTracker) {
      this.lineageTracker.events.unshift({
        time: this.t,
        rootId: null,
        title: `⚠️ ${config.name} begins!`
      });
      this.lineageTracker.trim();
    }
  }

  applyDisasterEffects(dt) {
    switch (this.activeDisaster) {
      case 'meteorStorm':
        // Random creatures die
        if (Math.random() < 0.02) {
          const victim = this.creatures[Math.floor(Math.random() * this.creatures.length)];
          if (victim) {
            victim.alive = false;
            victim.logEvent('Killed by meteor', this.t);
          }
        }
        break;

      case 'iceAge':
        // Increased temperature penalty, food scarce (handled in foodGrowthRate)
        for (const c of this.creatures) {
          const extraCold = 0.5 * dt;
          c.energy -= extraCold;
        }
        break;

      case 'plague':
        // Disease spreads between nearby creatures with low grit
        for (const c of this.creatures) {
          if (c.genes.grit < 0.3 && Math.random() < 0.001) {
            const nearby = this.queryCreatures(c.x, c.y, 50);
            for (const n of nearby) {
              if (n !== c && n.genes.grit < 0.4 && Math.random() < 0.1) {
                n.health = Math.max(0, n.health - 0.5);
                n.logEvent('Infected by plague', this.t);
              }
            }
          }
        }
        break;

      case 'drought':
        // No food spawns (handled in step), existing food decays faster
        if (Math.random() < 0.01 && this.food.length > 0) {
          const idx = Math.floor(Math.random() * this.food.length);
          this.food.splice(idx, 1);
          this.gridDirty = true;
        }
        break;
    }
  }

  endDisaster() {
    if (this.lineageTracker && this.activeDisaster) {
      const config = this.disasters[this.activeDisaster];
      this.lineageTracker.events.unshift({
        time: this.t,
        rootId: null,
        title: `✓ ${config.name} ends`
      });
      this.lineageTracker.trim();
    }
    this.activeDisaster = null;
    this.disasterDuration = 0;
  }

  getActiveDisaster() {
    if (!this.activeDisaster) return null;
    return {
      type: this.activeDisaster,
      name: this.disasters[this.activeDisaster].name,
      timeRemaining: this.disasterDuration
    };
  }

  // Integrate disasters with existing event system
  getActiveEvents() {
    const events = [];
    if (this.activeDisaster) {
      events.push({
        name: `⚠️ ${this.disasters[this.activeDisaster].name}`,
        remaining: this.disasterDuration
      });
    }
    return events;
  }

  _createBiomes() {
    // Create 3 horizontal biome bands
    const third = this.height / 3;
    return [
      {
        name: 'Forest',
        y1: 0,
        y2: third,
        foodRate: 1.5,
        tempModifier: 0.15,
        color: 'rgba(45, 80, 22, 0.15)',
        hue: 120
      },
      {
        name: 'Grassland',
        y1: third,
        y2: third * 2,
        foodRate: 1.0,
        tempModifier: 0,
        color: 'rgba(100, 140, 60, 0.12)',
        hue: 90
      },
      {
        name: 'Desert',
        y1: third * 2,
        y2: this.height,
        foodRate: 0.4,
        tempModifier: -0.3,
        color: 'rgba(194, 178, 128, 0.18)',
        hue: 45
      }
    ];
  }

  getBiomeAt(x, y) {
    for (const biome of this.biomes) {
      if (y >= biome.y1 && y < biome.y2) {
        return biome;
      }
    }
    return this.biomes[1]; // Default to middle biome
  }

  pickHabitatSpot() {
    // Pick biome weighted by food rate
    const totalWeight = this.biomes.reduce((sum, b) => sum + b.foodRate, 0);
    let r = Math.random() * totalWeight;
    let selectedBiome = this.biomes[1];
    
    for (const biome of this.biomes) {
      r -= biome.foodRate;
      if (r <= 0) {
        selectedBiome = biome;
        break;
      }
    }
    
    const x = rand(0, this.width);
    const y = rand(selectedBiome.y1, selectedBiome.y2);
    return { x, y };
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
        stats: { ...c.stats },
        health: c.health,
        maxHealth: c.maxHealth
      })),
      food: this.food.map(f => ({ ...f })),
      environment: { ...this.environment },
      activeEvents: this.getActiveEvents(),
      lineagePulse: {
        interval: this.lineagePulse.interval,
        maxPoints: this.lineagePulse.maxPoints,
        series: Array.from(this.lineagePulse.series.entries()).map(([rootId, series]) => ({
          rootId,
          points: series.map(pt => ({ time: pt.time, alive: pt.alive }))
        }))
      }
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
      c.maxHealth = data.maxHealth ?? (c.genes.predator ? 18 : 12);
      c.health = Math.min(c.maxHealth, data.health ?? c.maxHealth);
      c.stats = { food:0, kills:0, births:0, damageTaken:0, damageDealt:0, ...(data.stats ?? {}) };
      this.creatures.push(c);
      this.registry.set(c.id, c);
      if (c.parentId) {
        if (!this.childrenOf.has(c.parentId)) this.childrenOf.set(c.parentId, new Set());
        this.childrenOf.get(c.parentId).add(c.id);
      }
      this._nextId = Math.max(this._nextId, (c.id ?? 0) + 1);
    }
    this.food = (snapshot.food ?? []).map(f => ({ ...f }));

    const envSnapshot = snapshot.environment ?? null;
    if (envSnapshot) {
      this.environment.tempOffset = envSnapshot.tempOffset ?? this.environment.tempOffset;
      this.environment.tempPenaltyScale = envSnapshot.tempPenaltyScale ?? this.environment.tempPenaltyScale;
      this.environment.tempPenaltyAdd = envSnapshot.tempPenaltyAdd ?? this.environment.tempPenaltyAdd;
      this.environment.foodRateMultiplier = envSnapshot.foodRateMultiplier ?? this.environment.foodRateMultiplier;
    } else {
      this.environment = this._defaultEnvironment();
    }

    this.eventSystem = this._createEventSystem();
    const activeEvents = Array.isArray(snapshot.activeEvents) ? snapshot.activeEvents : [];
    for (const evt of activeEvents) {
      const def = this.eventSystem.catalog.find(e => e.key === evt.key);
      if (!def) continue;
      const range = def.duration ?? 20;
      let duration = evt.duration ?? (Array.isArray(range) ? (range[1] ?? range[0]) : range);
      duration = Math.max(6, duration || 12);
      let remaining = evt.remaining ?? duration;
      remaining = clamp(remaining, 0, duration);
      const state = {
        definition: def,
        duration,
        remaining,
        elapsed: duration - remaining,
        startedAt: evt.startedAt ?? (this.t - (duration - remaining)),
        data: evt.data ? { ...evt.data } : {}
      };
      this.eventSystem.active.push(state);
    }
    this._recalculateEnvironment();
    this.predatorSignals = [];
    const pulseSnapshot = snapshot.lineagePulse ?? null;
    if (pulseSnapshot) {
      const pulse = this._createLineagePulse();
      pulse.interval = pulseSnapshot.interval ?? pulse.interval;
      pulse.maxPoints = pulseSnapshot.maxPoints ?? pulse.maxPoints;
      pulse.series = new Map();
      for (const entry of pulseSnapshot.series ?? []) {
        if (!entry || entry.rootId == null || !Array.isArray(entry.points)) continue;
        pulse.series.set(entry.rootId, entry.points.map(pt => ({
          time: pt.time ?? 0,
          alive: pt.alive ?? 0
        })));
      }
      this.lineagePulse = pulse;
      if (this.lineageTracker) this._captureLineagePulse();
    } else {
      this.lineagePulse = this._createLineagePulse();
    }
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

  _defaultEnvironment() {
    return {
      tempOffset: 0,
      tempPenaltyScale: 1,
      tempPenaltyAdd: 0,
      foodRateMultiplier: 1
    };
  }

  _createEventSystem() {
    return {
      catalog: this._buildEventCatalog(),
      active: [],
      rollTimer: 0,
      rollInterval: 8,
      maxConcurrent: 2,
      cooldowns: new Map(),
      history: []
    };
  }

  _buildEventCatalog() {
    return [
      {
        key: 'cold-snap',
        name: 'Cold Snap',
        duration: [24, 36],
        cooldown: 120,
        weight: (world) => 0.8 + Math.max(0, (world.creatures.length - 40) * 0.012),
        effects: {
          tempOffset: -0.2,
          tempPenaltyScale: 1.35,
          tempPenaltyAdd: 0.02,
          foodRateMultiplier: 0.7
        },
        condition: (world) => world.creatures.length >= 12
      },
      {
        key: 'verdant-bloom',
        name: 'Verdant Bloom',
        duration: [18, 26],
        cooldown: 85,
        weight: (world) => {
          const scarcity = clamp(1 - world.food.length / Math.max(1, world.maxFood), 0, 1);
          const health = world.ecoStats?.meanHealth ?? 0.6;
          const damp = clamp(1 - Math.max(0, health - 0.55), 0.35, 1);
          return (0.6 + scarcity * 2.4) * damp;
        },
        effects: {
          tempOffset: 0.12,
          foodRateMultiplier: 1.85
        },
        onStart: (world) => {
          const bursts = 12;
          for (let i = 0; i < bursts; i++) {
            const spot = world.pickHabitatSpot();
            world.addFood(
              (spot.x + rand(-35, 35) + world.width) % world.width,
              (spot.y + rand(-20, 20) + world.height) % world.height,
              rand(0.9, 1.8)
            );
          }
        }
      },
      {
        key: 'meteor-bloom',
        name: 'Comet Bloom',
        duration: [14, 22],
        cooldown: 95,
        weight: 0.85,
        effects: {
          foodRateMultiplier: 1.4,
          tempOffset: 0.05
        },
        onStart: (_world, state) => {
          state.data = { dropTimer: 0, drops: 0 };
        },
        onUpdate: (world, state, dt) => {
          state.data.dropTimer += dt;
          const maxDrops = 10;
          if (state.data.dropTimer >= 2.1 && state.data.drops < maxDrops) {
            state.data.dropTimer = 0;
            state.data.drops += 1;
            const center = world.pickHabitatSpot();
            const cluster = 6;
            for (let i = 0; i < cluster; i++) {
              const angle = Math.random() * Math.PI * 2;
              const radius = rand(0, 55);
              const x = (center.x + Math.cos(angle) * radius + world.width) % world.width;
              const y = (center.y + Math.sin(angle) * radius + world.height) % world.height;
              world.addFood(x, y, rand(1.1, 2.2));
            }
          }
        }
      },
      {
        key: 'dry-season',
        name: 'Dry Season',
        duration: [20, 30],
        cooldown: 110,
        weight: (world) => {
          const plenty = world.food.length / Math.max(1, world.maxFood);
          const health = world.ecoStats?.meanHealth ?? 0.6;
          const healthBias = clamp(health - 0.6, 0, 0.5);
          return clamp(plenty * 2.2 + healthBias * 4.2, 0.4, 4);
        },
        effects: {
          foodRateMultiplier: 0.5,
          tempPenaltyScale: 1.18,
          tempPenaltyAdd: 0.03
        },
        onStart: (_world, state) => {
          state.data = { trimTimer: 0 };
        },
        onUpdate: (world, state, dt) => {
          state.data.trimTimer += dt;
          if (state.data.trimTimer >= 3.2 && world.food.length > world.maxFood * 0.35) {
            state.data.trimTimer = 0;
            const removeCount = Math.min(4, world.food.length);
            for (let i = 0; i < removeCount; i++) {
              const idx = Math.floor(Math.random() * world.food.length);
              if (idx >= 0 && idx < world.food.length) {
                world.food.splice(idx, 1);
              }
            }
            world.gridDirty = true;
          }
        }
      }
    ];
  }

  _createLineagePulse() {
    return {
      interval: 3,
      timer: 0,
      maxPoints: 48,
      series: new Map(),
      topFamilies: [],
      topLimit: 5
    };
  }

  updateSeasonalEvents(dt) {
    const sys = this.eventSystem;
    if (!sys) return;

    const active = [];
    for (const state of sys.active) {
      state.elapsed += dt;
      state.remaining = Math.max(0, state.remaining - dt);
      if (state.definition.onUpdate) {
        state.definition.onUpdate(this, state, dt);
      }
      if (state.remaining <= 0.0001) {
        state.definition.onEnd?.(this, state);
        const cooldown = state.definition.cooldown ?? 60;
        if (cooldown > 0) sys.cooldowns.set(state.definition.key, cooldown);
        sys.history.unshift({
          key: state.definition.key,
          name: state.definition.name,
          endedAt: this.t,
          duration: state.duration
        });
        if (sys.history.length > 8) sys.history.length = 8;
      } else {
        active.push(state);
      }
    }
    sys.active = active;

    if (sys.cooldowns.size) {
      for (const [key, timer] of Array.from(sys.cooldowns.entries())) {
        const next = timer - dt;
        if (next <= 0) sys.cooldowns.delete(key);
        else sys.cooldowns.set(key, next);
      }
    }

    sys.rollTimer += dt;
    if (sys.rollTimer >= sys.rollInterval) {
      sys.rollTimer = 0;
      if (sys.active.length < sys.maxConcurrent) {
        const candidate = this._pickSeasonalEvent();
        if (candidate) this._startSeasonalEvent(candidate);
      }
    }

    this._recalculateEnvironment();
  }

  _startSeasonalEvent(def) {
    const range = def.duration ?? 20;
    let duration = Array.isArray(range) ? rand(range[0], Math.max(range[0], range[1] ?? range[0])) : range;
    duration = Math.max(6, duration);
    const state = {
      definition: def,
      duration,
      remaining: duration,
      elapsed: 0,
      startedAt: this.t,
      data: {}
    };
    def.onStart?.(this, state);
    state.data = state.data ?? {};
    this.eventSystem.active.push(state);
    this.eventSystem.history.unshift({
      key: def.key,
      name: def.name,
      startedAt: this.t
    });
    if (this.eventSystem.history.length > 8) this.eventSystem.history.length = 8;
    this._recalculateEnvironment();
  }

  _pickSeasonalEvent() {
    const sys = this.eventSystem;
    if (!sys) return null;
    const activeKeys = new Set(sys.active.map(s => s.definition.key));
    const candidates = [];
    for (const def of sys.catalog) {
      if (activeKeys.has(def.key)) continue;
      if (sys.cooldowns.has(def.key)) continue;
      if (def.condition && !def.condition(this)) continue;
      const baseWeight = typeof def.weight === 'function' ? def.weight(this) : (def.weight ?? 1);
      const weight = Math.max(0, baseWeight);
      if (weight <= 0) continue;
      candidates.push({ def, weight });
    }
    if (!candidates.length) return null;
    const total = candidates.reduce((acc, cur) => acc + cur.weight, 0);
    let r = Math.random() * total;
    for (const candidate of candidates) {
      r -= candidate.weight;
      if (r <= 0) return candidate.def;
    }
    return candidates[candidates.length - 1].def;
  }

  updatePredatorSignals(dt) {
    if (!this.predatorSignals.length) return;
    const next = [];
    for (const sig of this.predatorSignals) {
      sig.ttl -= dt;
      sig.strength -= dt * 0.12;
      if (sig.ttl > 0 && sig.strength > 0.05) {
        next.push(sig);
      }
    }
    this.predatorSignals = next;
  }

  _predatorDamage(pred, victim) {
    const speedFactor = clamp(pred.genes.speed, 0.2, 2);
    const aggression = pred.personality?.aggression ?? 1;
    const base = pred.genes.predator ? 4.5 : 3.5;
    const damage = base + speedFactor * 1.6 + aggression * 1.4;
    const mitigation = victim.genes.metabolism ? clamp(1.2 - (victim.genes.metabolism * 0.15), 0.65, 1.1) : 1;
    return Math.max(1.5, damage * mitigation);
  }

  _predatorAttackCooldown(pred) {
    const aggression = pred.personality?.aggression ?? 1;
    const cooldown = 1.15 - Math.min(0.6, aggression * 0.28);
    return clamp(cooldown, 0.45, 1.2);
  }

  _recalculateEnvironment() {
    const base = this._defaultEnvironment();
    const env = this.environment;
    env.tempOffset = base.tempOffset;
    env.tempPenaltyScale = base.tempPenaltyScale;
    env.tempPenaltyAdd = base.tempPenaltyAdd;
    env.foodRateMultiplier = base.foodRateMultiplier;

    for (const state of this.eventSystem.active) {
      const fx = state.definition.effects;
      if (!fx) continue;
      if (fx.tempOffset) env.tempOffset += fx.tempOffset;
      if (fx.tempPenaltyScale) env.tempPenaltyScale *= fx.tempPenaltyScale;
      if (fx.tempPenaltyAdd) env.tempPenaltyAdd += fx.tempPenaltyAdd;
      if (fx.foodRateMultiplier) env.foodRateMultiplier *= fx.foodRateMultiplier;
    }

    env.tempPenaltyScale = clamp(env.tempPenaltyScale, 0.2, 3);
    env.foodRateMultiplier = clamp(env.foodRateMultiplier, 0.1, 3);
    env.tempPenaltyAdd = clamp(env.tempPenaltyAdd, -0.2, 0.6);
    env.tempOffset = clamp(env.tempOffset, -0.6, 0.6);
  }

  getActiveEvents() {
    return this.eventSystem.active.map(state => ({
      key: state.definition.key,
      name: state.definition.name,
      remaining: Math.max(0, state.remaining),
      duration: state.duration,
      progress: state.duration > 0 ? clamp(1 - (state.remaining / state.duration), 0, 1) : 1,
      effects: state.definition.effects ?? {},
      startedAt: state.startedAt ?? (this.t - (state.duration - state.remaining)),
      data: state.data ? { ...state.data } : undefined
    }));
  }

  updateLineagePulse(dt) {
    if (!this.lineageTracker) return;
    const pulse = this.lineagePulse;
    if (!pulse) return;
    pulse.timer += dt;
    if (pulse.timer < pulse.interval) return;
    while (pulse.timer >= pulse.interval) {
      pulse.timer -= pulse.interval;
      this._captureLineagePulse();
    }
  }

  _captureLineagePulse() {
    if (!this.lineageTracker) return;
    const pulse = this.lineagePulse;
    if (!pulse) return;
    const aliveMap = new Map();
    for (const creature of this.creatures) {
      if (!creature.alive) continue;
      const rootId = this.lineageTracker.getRoot(this, creature.id);
      if (!rootId) continue;
      aliveMap.set(rootId, (aliveMap.get(rootId) ?? 0) + 1);
    }
    const now = this.t;
    const trackedRoots = new Set([...pulse.series.keys(), ...aliveMap.keys()]);
    const prune = [];
    for (const rootId of trackedRoots) {
      const alive = aliveMap.get(rootId) ?? 0;
      let series = pulse.series.get(rootId);
      if (!series) {
        series = [];
        pulse.series.set(rootId, series);
      }
      series.push({ time: now, alive });
      if (series.length > pulse.maxPoints) series.shift();
      if (alive === 0) {
        const window = Math.min(6, series.length);
        const recentAlive = series.slice(-window).some(pt => pt.alive > 0);
        if (!recentAlive) prune.push(rootId);
      }
    }
    for (const rootId of prune) pulse.series.delete(rootId);

    const entries = [];
    for (const [rootId, series] of pulse.series.entries()) {
      if (!series.length) continue;
      const latest = series[series.length - 1];
      const prev = series.length > 1 ? series[series.length - 2] : latest;
      const peak = series.reduce((max, pt) => Math.max(max, pt.alive), 0);
      entries.push({
        rootId,
        alive: latest.alive,
        delta: latest.alive - (prev?.alive ?? 0),
        peak,
        name: this.lineageTracker?.ensureName(rootId) ?? `Lineage ${rootId}`,
        series
      });
    }
    entries.sort((a, b) => b.alive - a.alive);
    pulse.topFamilies = entries.slice(0, pulse.topLimit);
  }

  getLineagePulse(rootId) {
    if (!rootId || !this.lineagePulse) return null;
    const series = this.lineagePulse.series.get(rootId);
    if (!series || !series.length) return null;
    const latest = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : latest;
    const peak = series.reduce((max, pt) => Math.max(max, pt.alive), 0);
    return {
      rootId,
      name: this.lineageTracker?.ensureName(rootId) ?? `Lineage ${rootId}`,
      series: series.map(pt => ({ time: pt.time, alive: pt.alive })),
      latest,
      delta: latest.alive - (prev?.alive ?? 0),
      peak
    };
  }

  getLineageLeaders(limit=3) {
    if (!this.lineagePulse) return [];
    const max = Math.max(0, limit ?? 3);
    return this.lineagePulse.topFamilies.slice(0, max).map(entry => ({
      rootId: entry.rootId,
      name: entry.name,
      alive: entry.alive,
      delta: entry.delta,
      peak: entry.peak,
      series: entry.series.map(pt => ({ time: pt.time, alive: pt.alive }))
    }));
  }
}
