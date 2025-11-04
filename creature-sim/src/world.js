import { rand, clamp, dist2 } from './utils.js';
import { makeGenes, mutateGenes } from './genetics.js';
import { Creature } from './creature.js';
import { SpatialGrid } from './spatial-grid.js';
import { BiomeGenerator } from './perlin-noise.js';
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
    this.corpses = []; // NEW: Dead creatures that scavengers can eat
    this.corpseGrid = new SpatialGrid(40); // NEW: Spatial grid for corpse lookup
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
    this.maxFood = Math.floor((width * height) / 180); // BALANCED: 2x more food for larger world!
    
    // Day/Night cycle system
    this.timeOfDay = 12.0; // 0-24 hours (start at noon)
    this.dayLength = 120; // Real seconds for full day/night cycle
    this.dayNightEnabled = true;
    
    // NEW: Four Seasons System
    this.seasonTime = 0; // Time counter for seasons
    this.seasonDuration = 120; // Real seconds per season (2 minutes each)
    this.currentSeason = 'spring'; // spring, summer, autumn, winter
    this.seasonCycle = ['spring', 'summer', 'autumn', 'winter'];
    this.seasonIndex = 0;
    
    // Disaster system
    this.disasterCooldown = 0;
    this.activeDisaster = null;
    this.disasterDuration = 0;
    this.disasterIntensity = 1;
    this.disasterManual = false;
    this.disasterQueue = [];
    this.disasterQueueVersion = 0;
    this._nextDisasterId = 1;
    this.disasters = {
      meteorStorm: { name: 'Meteor Storm', duration: 5, cooldown: 180 },
      iceAge: { name: 'Ice Age', duration: 60, cooldown: 240 },
      plague: { name: 'Plague', duration: 30, cooldown: 200 },
      drought: { name: 'Drought', duration: 30, cooldown: 150 }
    };
    this.autoBalanceSettings = {
      enabled: true,
      interval: 4,
      minPopulation: 36,
      minHerbivores: 20,
      minOmnivores: 6,
      minPredators: 4,
      maxPredators: 16,
      targetPredatorRatio: 0.24,
      targetFoodFraction: 0.5,
      minFoodAbsolute: 140,
      batchSpawn: 4
    };
    this.autoBalanceAccumulator = 0;

    // UPGRADED: Perlin noise organic biome system (6 types)
    this.biomeGenerator = new BiomeGenerator(Math.random());
    this.biomeMap = this.biomeGenerator.generateBiomeMap(width, height, 50);
    this.biomeCache = new Map(); // Cache biome lookups for performance
    this.biomes = this._createBiomes(); // Keep legacy for gradual migration
    
    this.predatorSignals = [];
    this.environment = this._defaultEnvironment();
    this.eventSystem = this._createEventSystem();
    this.lineagePulse = this._createLineagePulse();
    this.ecoStats = { meanHealth: 0.6, predatorRatio: 0.2, biomass: 0, lastUpdate: 0 };
    
    // Territory system for predators
    this.territories = new Map(); // predatorId -> territory object
    this.territoryConflicts = []; // active conflicts for visualization
    
    // Social behavior tracking
    this.socialBonds = new Map(); // creatureId -> array of bondedIds
    this.offspring = new Map(); // parentId -> array of childIds (recent)
    
    // Migration tracking
    this.migrationTargets = new Map(); // creatureId -> target biome
    this.biomePopulations = new Map(); // track population per biome type
    
    // Environmental decorations (for visual polish)
    this.decorations = this._generateDecorations();

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
      
      // NEW: Birth sparkle effect!
      if (this.particles) {
        this.particles.addBirthEffect(creature.x, creature.y);
      }
    }
    this.gridDirty = true;
    return creature.id;
  }

  attachLineageTracker(tracker) {
    this.lineageTracker = tracker;
  }
  
  // NEW: Attach particle system for visual effects
  attachParticleSystem(particles) {
    this.particles = particles;
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
    this.activeDisaster = null;
    this.disasterDuration = 0;
    this.disasterIntensity = 1;
    this.disasterManual = false;
    this.disasterQueue = [];
    this.disasterQueueVersion = 0;
    this._nextDisasterId = 1;
    this.autoBalanceAccumulator = 0;
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

  spawnOmnivore(x, y) {
    const g = makeGenes({
      predator: 0,
      diet: 0.5,
      speed: 1.05,
      sense: 120,
      metabolism: 0.95,
      hue: 35
    });
    const creature = new Creature(x, y, g, false);
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
    this.updateTerritories(dt);
    this.t += dt;
    this.seasonPhase += dt * this.seasonSpeed;
    
    // Update day/night cycle
    if (this.dayNightEnabled) {
      this.timeOfDay += (dt / this.dayLength) * 24; // Convert dt to hours
      this.timeOfDay = this.timeOfDay % 24; // Wrap at 24 hours
    }
    
    // NEW: Update four seasons system
    this._updateSeasons(dt);
    
    this.updateSeasonalEvents(dt);
    this.updatePredatorSignals(dt);
    this.updateDisasters(dt);
    this.ensureSpatial();
    
    // Modify food growth based on active disasters
    let foodRateModifier = 1.0;
    if (this.activeDisaster === 'iceAge') {
      const intensity = clamp(this.disasterIntensity ?? 1, 0, 5);
      foodRateModifier = Math.max(0, 1 - 0.8 * intensity);
    }
    if (this.activeDisaster === 'drought') {
      const intensity = clamp(this.disasterIntensity ?? 1, 0, 5);
      foodRateModifier = Math.max(0, 1 - 1.0 * intensity);
    }
    
    if (this.food.length < this.maxFood && Math.random()<(this.foodGrowthRate() * foodRateModifier)) {
      const spot = this.pickHabitatSpot();
      this.addFood(spot.x, spot.y, 1.2);
    }
    this.pheromone.step();
    
    // OPTIMIZATION: Update creatures and remove dead ones in single pass
    let writeIndex = 0;
    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i];
      c.update(dt, this);
      if (c.alive) {
        if (writeIndex !== i) {
          this.creatures[writeIndex] = c;
        }
        writeIndex++;
      } else {
        // NEW: Create corpse when creature dies
        this._createCorpse(c);
      }
    }
    // Trim array to new length (avoids filter allocation)
    if (writeIndex < this.creatures.length) {
      this.creatures.length = writeIndex;
    }
    
    // NEW: Update corpses (decay over time)
    this._updateCorpses(dt);
    
    this.updateLineagePulse(dt);
    this.updateEcoStats();
    this.autoBalanceEcosystem(dt);
    this.gridDirty = true;
  }

  foodGrowthRate() {
    const base = 0.18;
    const scarcity = clamp(1 - this.food.length / Math.max(1, this.maxFood), 0, 1);
    
    // NEW: Season-based food growth modifiers
    let seasonMultiplier = 1.0;
    switch(this.currentSeason) {
      case 'spring': seasonMultiplier = 1.5; break; // Abundant growth
      case 'summer': seasonMultiplier = 1.2; break; // Good growth
      case 'autumn': seasonMultiplier = 0.8; break; // Declining
      case 'winter': seasonMultiplier = 0.3; break; // Scarce
    }
    
    return (base + 0.4 * scarcity) * 0.016 * this.environment.foodRateMultiplier * seasonMultiplier;
  }
  
  // NEW: Update seasons cycle
  _updateSeasons(dt) {
    this.seasonTime += dt;
    
    // Change season every seasonDuration seconds
    if (this.seasonTime >= this.seasonDuration) {
      this.seasonTime = 0;
      this.seasonIndex = (this.seasonIndex + 1) % 4;
      this.currentSeason = this.seasonCycle[this.seasonIndex];
      
      // Log season change
      console.log(`🌍 Season changed to: ${this.currentSeason.toUpperCase()}`);
    }
  }
  
  // NEW: Get season info for UI/rendering
  getSeasonInfo() {
    const progress = this.seasonTime / this.seasonDuration;
    return {
      current: this.currentSeason,
      progress: progress,
      timeRemaining: this.seasonDuration - this.seasonTime,
      icon: this._getSeasonIcon(),
      color: this._getSeasonColor()
    };
  }
  
  _getSeasonIcon() {
    switch(this.currentSeason) {
      case 'spring': return '🌸';
      case 'summer': return '☀️';
      case 'autumn': return '🍂';
      case 'winter': return '❄️';
      default: return '🌍';
    }
  }
  
  _getSeasonColor() {
    switch(this.currentSeason) {
      case 'spring': return '#7FDB6A'; // Fresh green
      case 'summer': return '#FFD700'; // Golden
      case 'autumn': return '#FF8C42'; // Orange
      case 'winter': return '#B0E0E6'; // Icy blue
      default: return '#888888';
    }
  }

  updateDisasters(dt) {
    // Update cooldown
    if (this.disasterCooldown > 0) {
      this.disasterCooldown -= dt;
    }

    this._processScheduledDisasters();

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
    this._beginDisaster(type, { manual: false });
  }

  triggerDisaster(type, options={}) {
    const config = this.disasters[type];
    if (!config) return { started: false, queuedId: null };
    const {
      delay = 0,
      startAt = null,
      waitForClear = true
    } = options;
    const queueOptions = { ...options };
    delete queueOptions.delay;
    delete queueOptions.startAt;
    delete queueOptions.waitForClear;

    const shouldQueue = (startAt != null && startAt > this.t) || delay > 0;
    if (shouldQueue) {
      const startTime = startAt != null ? startAt : (this.t + Math.max(0, delay));
      const id = this._nextDisasterId++;
      this.disasterQueue.push({
        id,
        type,
        startTime,
        waitForClear: waitForClear !== false,
        options: queueOptions
      });
      this.disasterQueue.sort((a, b) => a.startTime - b.startTime);
      this.disasterQueueVersion++;
      return { started: false, queuedId: id };
    }

    const started = this._beginDisaster(type, { manual: true, ...queueOptions });
    return { started: !!started, queuedId: null };
  }

  _beginDisaster(type, { duration, intensity=1, manual=false, applyCooldown=true }={}) {
    const config = this.disasters[type];
    if (!config) return false;

    // Cancel any active disaster before starting a new one.
    if (this.activeDisaster) {
      this.endDisaster({ cancelled: true });
    }

    this.activeDisaster = type;
    const baseDuration = duration ?? config.duration;
    this.disasterDuration = Math.max(1, baseDuration);
    this.disasterCooldown = applyCooldown ? config.cooldown : 0;
    this.disasterIntensity = clamp(intensity ?? 1, 0.1, 5);
    this.disasterManual = manual;

    if (this.lineageTracker) {
      const icon = manual ? '🧪' : '⚠️';
      this.lineageTracker.events.unshift({
        time: this.t,
        rootId: null,
        title: `${icon} ${config.name} begins!`
      });
    this.lineageTracker.trim();
  }
  return true;
}

  _processScheduledDisasters() {
    if (!this.disasterQueue.length) return;
    let changed = false;
    this.disasterQueue.sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < this.disasterQueue.length; i++) {
      const item = this.disasterQueue[i];
      if (this.t < item.startTime) break;
      if (item.waitForClear && this.activeDisaster) {
        continue;
      }
      const started = this._beginDisaster(item.type, { manual: true, ...item.options });
      this.disasterQueue.splice(i, 1);
      changed = true;
      if (started) {
        break;
      }
      i--;
    }
    if (changed) {
      this.disasterQueueVersion++;
    }
  }

  getPendingDisasters() {
    if (!this.disasterQueue.length) return [];
    return this.disasterQueue
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .map(item => {
        const config = this.disasters[item.type] ?? {};
        return {
          id: item.id,
          type: item.type,
          name: config.name ?? item.type,
          startsIn: Math.max(0, item.startTime - this.t),
          intensity: item.options?.intensity ?? 1,
          duration: item.options?.duration ?? config.duration ?? 0,
          waitForClear: item.waitForClear !== false
        };
      });
  }

  getPendingDisastersVersion() {
    return this.disasterQueueVersion;
  }

  cancelPendingDisaster(id) {
    const index = this.disasterQueue.findIndex(item => item.id === id);
    if (index === -1) return false;
    this.disasterQueue.splice(index, 1);
    this.disasterQueueVersion++;
    return true;
  }

  clearPendingDisasters() {
    if (!this.disasterQueue.length) return false;
    this.disasterQueue = [];
    this.disasterQueueVersion++;
    return true;
  }

  autoBalanceEcosystem(dt) {
    const cfg = this.autoBalanceSettings;
    if (!cfg?.enabled) return;
    this.autoBalanceAccumulator += dt;
    if (this.autoBalanceAccumulator < cfg.interval) return;
    this.autoBalanceAccumulator = 0;

    let herb = 0, pred = 0, omni = 0;
    for (const c of this.creatures) {
      if (!c.alive) continue;
      if (c.genes.predator) {
        pred++;
        continue;
      }
      const diet = c.genes.diet ?? 0;
      if (diet > 0.3 && diet < 0.7) {
        omni++;
      } else {
        herb++;
      }
    }
    const pop = herb + pred + omni;
    const predatorRatio = pop > 0 ? pred / pop : 0;

    const spawnHerbivores = (count) => {
      const amount = Math.min(cfg.batchSpawn, Math.max(1, count));
      for (let i = 0; i < amount; i++) {
        this.spawnManual(rand(0, this.width), rand(0, this.height), false);
      }
    };
    const spawnOmnivores = (count) => {
      const amount = Math.min(cfg.batchSpawn, Math.max(1, count));
      for (let i = 0; i < amount; i++) {
        this.spawnOmnivore(rand(0, this.width), rand(0, this.height));
      }
    };
    const spawnPredators = (count) => {
      const amount = Math.min(Math.max(1, count), cfg.batchSpawn);
      for (let i = 0; i < amount; i++) {
        this.spawnManual(rand(0, this.width), rand(0, this.height), true);
      }
    };

    if (pop < cfg.minPopulation) {
      spawnHerbivores(cfg.minPopulation - pop);
    }
    if (herb < cfg.minHerbivores) {
      spawnHerbivores(cfg.minHerbivores - herb);
    }
    if (omni < cfg.minOmnivores) {
      spawnOmnivores(cfg.minOmnivores - omni);
    }
    if (pred < cfg.minPredators && herb > cfg.minHerbivores * 1.1) {
      spawnPredators(cfg.minPredators - pred);
    }
    if (predatorRatio < cfg.targetPredatorRatio - 0.1 && pred < cfg.maxPredators && herb > cfg.minHerbivores * 1.3) {
      spawnPredators(1);
    }

    if (pred && predatorRatio > cfg.targetPredatorRatio + 0.08) {
      const penalty = clamp((predatorRatio - cfg.targetPredatorRatio) * 10, 0.2, 2.2);
      for (const c of this.creatures) {
        if (!c.alive || !c.genes.predator) continue;
        c.energy = Math.max(0, c.energy - penalty);
        c.personality && (c.personality.huntCooldown = Math.max(c.personality.huntCooldown, 1.5));
      }
    }

    const desiredFood = Math.max(cfg.minFoodAbsolute, Math.floor(this.maxFood * cfg.targetFoodFraction));
    if (this.food.length < desiredFood) {
      const deficit = desiredFood - this.food.length;
      const spawnCount = Math.min(24, Math.max(4, Math.round(deficit * 0.4)));
      for (let i = 0; i < spawnCount; i++) {
        this.addFood(rand(0, this.width), rand(0, this.height), 1.1);
      }
      this.environment.foodRateMultiplier = clamp(this.environment.foodRateMultiplier + 0.05, 0.6, 2.5);
    } else if (this.food.length > desiredFood * 1.6) {
      this.environment.foodRateMultiplier = clamp(this.environment.foodRateMultiplier - 0.04, 0.45, 1.4);
    }
  }

  applyDisasterEffects(dt) {
    switch (this.activeDisaster) {
      case 'meteorStorm':
        // Random creatures die
        {
          const chance = clamp(0.02 * this.disasterIntensity, 0.002, 0.5);
          if (Math.random() < chance) {
            const victim = this.creatures[Math.floor(Math.random() * this.creatures.length)];
            if (victim) {
              victim.alive = false;
              victim.logEvent('Killed by meteor', this.t);
            }
          }
        }
        break;

      case 'iceAge':
        // Increased temperature penalty, food scarce (handled in foodGrowthRate)
        for (const c of this.creatures) {
          const extraCold = 0.5 * this.disasterIntensity * dt;
          c.energy -= extraCold;
        }
        break;

      case 'plague':
        // Disease spreads between nearby creatures with low grit
        for (const c of this.creatures) {
          const outbreakChance = clamp(0.001 * this.disasterIntensity, 0.0002, 0.05);
          if (c.genes.grit < 0.3 && Math.random() < outbreakChance) {
            const nearby = this.queryCreatures(c.x, c.y, 50);
            for (const n of nearby) {
              const spreadChance = clamp(0.1 * this.disasterIntensity, 0.02, 0.9);
              if (n !== c && n.genes.grit < 0.4 && Math.random() < spreadChance) {
                const damage = 0.5 * this.disasterIntensity;
                n.health = Math.max(0, n.health - damage);
                n.logEvent('Infected by plague', this.t);
              }
            }
          }
        }
        break;

      case 'drought':
        // No food spawns (handled in step), existing food decays faster
        {
          const decayChance = clamp(0.01 * this.disasterIntensity, 0.002, 0.3);
          if (Math.random() < decayChance && this.food.length > 0) {
            const idx = Math.floor(Math.random() * this.food.length);
            this.food.splice(idx, 1);
            this.gridDirty = true;
          }
        }
        break;
    }
  }

  endDisaster({ cancelled=false }={}) {
    if (this.lineageTracker && this.activeDisaster) {
      const config = this.disasters[this.activeDisaster];
      const icon = cancelled ? '⏹️' : '✓';
      this.lineageTracker.events.unshift({
        time: this.t,
        rootId: null,
        title: `${icon} ${config.name} ${cancelled ? 'cancelled' : 'ends'}`
      });
      this.lineageTracker.trim();
    }
    this.activeDisaster = null;
    this.disasterDuration = 0;
    this.disasterIntensity = 1;
    this.disasterManual = false;
  }

  cancelDisaster() {
    if (!this.activeDisaster) return false;
    this.endDisaster({ cancelled: true });
    return true;
  }

  getActiveDisaster() {
    if (!this.activeDisaster) return null;
    return {
      type: this.activeDisaster,
      name: this.disasters[this.activeDisaster].name,
      timeRemaining: this.disasterDuration,
      intensity: this.disasterIntensity,
      manual: this.disasterManual
    };
  }

  // Integrate disasters with existing event system
  getActiveEvents() {
    const events = [];
    if (this.activeDisaster) {
      events.push({
        name: `⚠️ ${this.disasters[this.activeDisaster].name}`,
        remaining: this.disasterDuration,
        intensity: this.disasterIntensity
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

  _generateDecorations() {
    // Generate environmental decorations for visual polish
    // Sample the world and place decorations based on biome type
    const decorations = [];
    const sampleDensity = 80; // Distance between samples
    
    for (let y = 0; y < this.height; y += sampleDensity) {
      for (let x = 0; x < this.width; x += sampleDensity) {
        const biome = this.getBiomeAt(x, y);
        const jitterX = (Math.random() - 0.5) * sampleDensity * 0.8;
        const jitterY = (Math.random() - 0.5) * sampleDensity * 0.8;
        
        // Place decoration based on biome type
        let decoration = null;
        const roll = Math.random();
        
        switch(biome.type) {
          case 'forest':
            if (roll < 0.6) decoration = { type: 'tree', size: 8 + Math.random() * 12, hue: 120 };
            break;
          case 'mountain':
            if (roll < 0.4) decoration = { type: 'rock', size: 6 + Math.random() * 10, hue: 30 };
            break;
          case 'desert':
            if (roll < 0.2) decoration = { type: 'cactus', size: 6 + Math.random() * 8, hue: 90 };
            break;
          case 'wetland':
            if (roll < 0.3) decoration = { type: 'reed', size: 4 + Math.random() * 6, hue: 150 };
            break;
          case 'meadow':
            if (roll < 0.5) decoration = { type: 'flower', size: 3 + Math.random() * 5, hue: 330 };
            break;
        }
        
        if (decoration) {
          decorations.push({
            x: x + jitterX,
            y: y + jitterY,
            ...decoration
          });
        }
      }
    }
    
    return decorations;
  }

  getBiomeAt(x, y) {
    // NEW: Use Perlin noise biome system
    const cacheKey = `${Math.floor(x/50)},${Math.floor(y/50)}`;
    if (this.biomeCache.has(cacheKey)) {
      return this.biomeCache.get(cacheKey);
    }
    
    const biome = this.biomeGenerator.getBiomeAt(x, y, this.width, this.height);
    this.biomeCache.set(cacheKey, biome);
    return biome;
  }
  
  getBiomeIndexAt(x, y) {
    // NEW: Return biome type instead of index
    const biome = this.getBiomeAt(x, y);
    // Map to indices for backwards compatibility
    const typeMap = { forest: 0, grassland: 1, desert: 2, mountain: 3, wetland: 4, meadow: 5 };
    return typeMap[biome.type] ?? 1;
  }

  pickHabitatSpot() {
    // NEW: Pick random location, weighted by biome food rate
    // Sample several points and pick best
    let bestSpot = null;
    let bestScore = -1;
    
    for (let i = 0; i < 5; i++) {
      const x = rand(this.width);
      const y = rand(this.height);
      const biome = this.getBiomeAt(x, y);
      const score = biome.foodRate * (0.8 + Math.random() * 0.4);
      
      if (score > bestScore) {
        bestScore = score;
        bestSpot = { x, y, biome };
      }
    }
    
    // Return the best spot found
    return { x: bestSpot.x, y: bestSpot.y };
  }

  ensureSpatial(){
    if (!this.gridDirty) return;
    this.creatureGrid.clear();
    for (const c of this.creatures) {
      if (c.alive) this.creatureGrid.insert(c, c.x, c.y);
    }
    this.foodGrid.clear();
    for (const f of this.food) this.foodGrid.insert(f, f.x, f.y);
    this.corpseGrid.clear();
    for (const corpse of this.corpses) this.corpseGrid.insert(corpse, corpse.x, corpse.y);
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

  // ============================================================================
  // FEATURE 1: TERRITORY & DOMINANCE SYSTEM
  // ============================================================================
  
  updateTerritories(dt) {
    // Clean up dead territories
    for (const [id] of this.territories.entries()) {
      const owner = this.registry.get(id);
      if (!owner || !owner.alive || !owner.genes.predator) {
        this.territories.delete(id);
      }
    }
    
    // Update/establish territories
    const predators = this.creatures.filter(c => c.genes.predator && c.alive);
    for (const predator of predators) {
      if (this.territories.has(predator.id)) {
        const territory = this.territories.get(predator.id);
        territory.strength = this._calculateTerritorialStrength(predator);
        territory.radius = 60 + (territory.strength * 40);
        territory.x = predator.x;
        territory.y = predator.y;
      } else if (predator.age > 10 && predator.stats.kills >= 1) {
        const strength = this._calculateTerritorialStrength(predator);
        this.territories.set(predator.id, {
          owner: predator.id,
          x: predator.x,
          y: predator.y,
          radius: 60 + (strength * 40),
          strength,
          establishedAt: this.t,
          dominanceRank: 0
        });
      }
    }
    
    // Resolve conflicts
    this._resolveTeritorialConflicts(dt);
    this._updateDominanceRanks();
  }
  
  _calculateTerritorialStrength(predator) {
    const geneScore = (predator.genes.aggression || 1) * 0.3 + 
                      (predator.genes.speed || 1) * 0.2 +
                      (predator.genes.metabolism || 1) * 0.1;
    const healthScore = (predator.health / predator.maxHealth) * 0.2;
    const killScore = Math.min(predator.stats.kills / 10, 1) * 0.2;
    const ageScore = Math.min(predator.age / 60, 1) * 0.1;
    return clamp(geneScore + healthScore + killScore + ageScore, 0.3, 2.5);
  }
  
  _resolveTeritorialConflicts(dt) {
    this.territoryConflicts = [];
    const territories = Array.from(this.territories.values());
    
    for (let i = 0; i < territories.length; i++) {
      for (let j = i + 1; j < territories.length; j++) {
        const t1 = territories[i];
        const t2 = territories[j];
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = t1.radius + t2.radius;
        
        if (distSq < minDist * minDist) {
          const owner1 = this.registry.get(t1.owner);
          const owner2 = this.registry.get(t2.owner);
          
          if (owner1 && owner2 && owner1.alive && owner2.alive) {
            this.territoryConflicts.push({
              x: (t1.x + t2.x) / 2,
              y: (t1.y + t2.y) / 2,
              predator1: t1.owner,
              predator2: t2.owner,
              intensity: 1 - Math.sqrt(distSq) / minDist
            });
            
            if (t1.strength > t2.strength * 1.2) {
              this._applyDominanceEffect(owner2, owner1, dt);
            } else if (t2.strength > t1.strength * 1.2) {
              this._applyDominanceEffect(owner1, owner2, dt);
            }
          }
        }
      }
    }
  }
  
  _applyDominanceEffect(subordinate, dominant, dt) {
    subordinate.energy -= 0.3 * dt;
    const dx = subordinate.x - dominant.x;
    const dy = subordinate.y - dominant.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.1) {
      subordinate.dir = Math.atan2(dy, dx);
      subordinate.personality.huntCooldown = Math.max(subordinate.personality.huntCooldown, 3);
    }
    dominant.energy += 0.1 * dt;
  }
  
  _updateDominanceRanks() {
    const territories = Array.from(this.territories.values())
      .sort((a, b) => b.strength - a.strength);
    territories.forEach((territory, index) => {
      territory.dominanceRank = index + 1;
    });
  }

  // NEW: Corpse system for scavengers
  _createCorpse(creature) {
    const energyValue = Math.max(6, creature.size * 2.5); // Energy a scavenger can get
    const corpse = {
      x: creature.x,
      y: creature.y,
      energy: energyValue,
      maxEnergy: energyValue,
      decay: 0, // 0-1, 1 = fully decayed
      decayRate: 0.02, // decay per second
      size: creature.size * 0.8,
      fromPredator: creature.genes.predator,
      genes: creature.genes // preserve diet info
    };
    this.corpses.push(corpse);
    this.gridDirty = true;
    
    // NEW: Death gravestone marker!
    if (this.particles && this.lineageTracker) {
      const creatureName = this.lineageTracker.getName(creature.id) || `Creature #${creature.id}`;
      this.particles.addDeathMarker(creature.x, creature.y, creatureName);
    }
  }

  _updateCorpses(dt) {
    // Update decay and remove fully decayed corpses
    let writeIndex = 0;
    for (let i = 0; i < this.corpses.length; i++) {
      const corpse = this.corpses[i];
      corpse.decay += corpse.decayRate * dt;
      
      if (corpse.decay < 1.0 && corpse.energy > 0.1) {
        if (writeIndex !== i) {
          this.corpses[writeIndex] = corpse;
        }
        writeIndex++;
      }
    }
    if (writeIndex < this.corpses.length) {
      this.corpses.length = writeIndex;
      this.gridDirty = true;
    }
  }

  findNearbyCorpse(x, y, radius) {
    this.ensureSpatial();
    const candidates = this.corpseGrid.nearby(x, y, radius);
    let best = null;
    let bestD2 = radius * radius;
    for (const corpse of candidates) {
      if (corpse.energy < 0.5) continue; // not enough left
      const d2 = dist2(corpse.x, corpse.y, x, y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = corpse;
      }
    }
    return best;
  }

  tryEatCorpse(scavenger, corpse) {
    if (!corpse || corpse.energy < 0.5) return false;
    
    const eatAmount = Math.min(corpse.energy, 8); // How much the scavenger can eat
    corpse.energy -= eatAmount;
    scavenger.energy += eatAmount;
    
    // Scavenging is rewarding!
    if (scavenger.stats) scavenger.stats.food++;
    scavenger.logEvent?.('Scavenged corpse', this.t);
    scavenger.rememberLocation?.(corpse.x, corpse.y, 'food', 0.7, this.t);
    
    if (corpse.energy < 0.5) {
      // Corpse fully consumed
      const index = this.corpses.indexOf(corpse);
      if (index >= 0) {
        this.corpses.splice(index, 1);
        this.gridDirty = true;
      }
    }
    
    return true;
  }
}
