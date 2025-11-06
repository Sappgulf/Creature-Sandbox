import { clamp, rand, randn, dist2, wrap } from './utils.js';
import { BehaviorConfig } from './behavior.js';
import { getExpressedGenes, applyDisorderEffects } from './genetics.js';

const TAU = Math.PI * 2;
const TRAIL_INTERVAL = 0.12;
const TRAIL_MAX = 24;
const LOG_MAX = 12;

export class Creature {
  constructor(x, y, genes, isChild=false) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.dir = rand(0, TAU);
    this.energy = isChild ? 28 : 40; // BALANCED: More starting energy!
    this.age = 0;
    this.alive = true;
    
    // OPTIMIZATION: Only process genetics if diploid genes detected
    const hasDiploidGenes = genes.speed && typeof genes.speed === 'object' && 'expressed' in genes.speed;
    
    if (hasDiploidGenes) {
      // Store original diploid genes
      this.genesRaw = genes;
      
      // Apply disorder effects and get expressed phenotype
      const modifiedGenes = applyDisorderEffects(genes);
      this.genes = getExpressedGenes(modifiedGenes);
      
      // Store sex and genetic info
      this.sex = genes.sex || 'female';
      this.disorders = genes.disorders || [];
      this.mutations = genes.mutations || [];
    } else {
      // Old haploid genes - use directly for compatibility
      this.genes = genes;
      this.genesRaw = null;
      this.sex = genes.sex || 'female';
      this.disorders = [];
      this.mutations = [];
    }
    
    // NEW: Age stages (baby → juvenile → adult → elder)
    this.ageStage = isChild ? 'baby' : 'adult';
    this.baseSize = null; // Will be set below
    
    // NEW: Size based on diet (omnivores are medium-sized)
    const diet = this.genes.diet ?? (this.genes.predator ? 1.0 : 0.0);
    const isOmnivore = diet > 0.3 && diet < 0.7;
    this.baseSize = isOmnivore ? 4.0 : (3.5 + (this.genes.predator ? 1.5 : 0));
    
    // Apply disorder size modifiers
    if (this.genesRaw && this.genesRaw.sizeModifier) {
      this.baseSize *= this.genesRaw.sizeModifier;
    }
    
    // Age-based size multiplier
    const ageSizeMultiplier = this._getAgeSizeMultiplier();
    this.size = this.baseSize * ageSizeMultiplier;
    
    // Parent tracking for parental care
    this.children = []; // Track offspring
    
    this.target = null;
    this.id = null;       // set by World.addCreature
    this.parentId = null; // set by World.addCreature

    this.maxHealth = this.genes.predator ? 18 : 12;
    
    // Apply disorder health modifiers
    if (this.genesRaw.healthModifier) {
      this.maxHealth *= this.genesRaw.healthModifier;
    }
    
    this.health = this.maxHealth;
    this.stats = { food: 0, kills: 0, births: 0, damageTaken: 0, damageDealt: 0 };
    this.trail = [{ x, y }];
    this.trailTimer = 0;
    this.log = [];
    this.logVersion = 0;
    this.personality = {
      packInstinct: clamp(this.genes.packInstinct ?? (this.genes.predator ? 0.55 : 0), 0, 1),
      ambushDelay: Math.max(0, this.genes.ambushDelay ?? (this.genes.predator ? 0.6 : 0.15)),
      aggression: clamp(this.genes.aggression ?? (this.genes.predator ? 1.15 : 0.85), 0.4, 2.2),
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
    
    // NEW: Animation state for visual feedback
    this.animation = {
      state: 'idle', // idle, walking, running, eating, sleeping
      timer: 0, // Animation cycle timer
      bobPhase: Math.random() * Math.PI * 2, // Random start phase for variety
      lastEat: -Infinity,
      eatDuration: 0.5, // Eating animation lasts 0.5s
      sleepTimer: 0 // Time creature has been idle/resting
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
    
    // FEATURE 5: Emotional States
    this.emotions = {
      fear: 0,          // 0-1, increases when attacked/near predators
      hunger: 0,        // 0-1, increases when low energy
      confidence: 0.5,  // 0-1, increases with kills/successful actions
      curiosity: clamp(genes.sense / 150, 0, 1), // exploration drive
      stress: 0,        // 0-1, accumulates from negative events
      contentment: 0.5  // 0-1, decreases stress, increases with food/safety
    };
    
    // FEATURE 6: Sensory Specialization
    this.senseType = this._determineSenseType(genes);
    
    // FEATURE 7: Problem Solving & Intelligence
    this.intelligence = {
      level: clamp((genes.sense / 100) * (genes.metabolism ?? 1), 0, 2), // 0-2
      patterns: [], // learned successful strategies
      experiencePoints: 0,
      learningRate: 0.05
    };
    
    // FEATURE 8: Sexual Selection
    this.sexuality = {
      attractiveness: this._calculateAttractiveness(genes),
      lastMated: -Infinity,
      choosiness: clamp(genes.sense / 120, 0.3, 1), // how picky
      courtshipStyle: Math.random(), // display type
      desiredTraits: this._pickDesiredTraits(genes)
    };
  }
  
  _determineSenseType(genes) {
    // Determine sense type based on genes
    const r = genes.hue / 360; // use hue as determinant
    if (r < 0.25) return 'normal';
    if (r < 0.5) return 'chemical'; // better pheromone tracking
    if (r < 0.75) return 'thermal'; // see through obstacles
    return 'echolocation'; // wider detection
  }
  
  _calculateAttractiveness(genes) {
    // Multi-factor attractiveness
    return (genes.speed * 0.3 + 
            genes.sense * 0.002 + 
            (2 - genes.metabolism) * 0.2 + 
            (genes.predator ? genes.aggression * 0.2 : 1 - genes.metabolism * 0.3));
  }
  
  _pickDesiredTraits(genes) {
    // What this creature finds attractive
    return {
      speed: genes.speed > 1.2,
      sense: genes.sense > 100,
      health: true,
      predator: genes.predator
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
    this._lastWorld = world; // Store for animation system
    
    // Update age stage and size based on age
    this._updateAgeStage();
    this.size = this.baseSize * this._getAgeSizeMultiplier();
    
    // Call feature update methods
    if (this._updateMemory) this._updateMemory(dt, world);
    if (this._updateSocialBehavior) this._updateSocialBehavior(world);
    if (this._updateMigration) this._updateMigration(world, dt);
    if (this._updateEmotions) this._updateEmotions(dt, world);
    if (this._updateIntelligence) this._updateIntelligence(dt, world);
    
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
    const diet = this.genes.diet ?? (this.genes.predator ? 1.0 : 0.0);
    const isOmnivore = diet > 0.3 && diet < 0.7;
    const canScavenge = diet >= 0.3; // Omnivores and carnivores can scavenge
    
    if (this.genes.predator || diet > 0.7) {
      // Carnivores: hunt or scavenge
      this.hunt(world, dt);
      if (this.personality.currentTargetId) {
        const tracked = world.getAnyCreatureById(this.personality.currentTargetId);
        if (tracked && tracked.alive) {
          this.target = { x: tracked.x, y: tracked.y, creatureId: tracked.id };
        }
      }
      
      // NEW: If no prey found and can scavenge, look for corpses
      if (!this.target && canScavenge && this.energy < 30) {
        const corpse = world.findNearbyCorpse(this.x, this.y, this.genes.sense * 0.8);
        if (corpse) {
          this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
        }
      }
      
      wanderScale *= clamp(1 - this.personality.aggression * 0.25, 0.25, 1);
    } else if (isOmnivore) {
      // NEW: Omnivores: eat plants, scavenge corpses
      const foodList = world.nearbyFood(this.x, this.y, this.genes.sense);
      const corpse = world.findNearbyCorpse(this.x, this.y, this.genes.sense * 0.9);
      
      // Prefer corpses when hungry, plants otherwise
      if (corpse && this.energy < 25) {
        this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
      } else {
        this.seek(foodList, world.pheromone);
      }
      
      // If no food found but corpse available, go for it
      if (!this.target && corpse) {
        this.target = { x: corpse.x, y: corpse.y, isCorpse: true, corpse };
      }
    } else {
      // Herbivores: only eat plants
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
    
    // NEW: Age stage speed modifiers
    switch(this.ageStage) {
      case 'baby': baseSpeed *= 0.6; break; // Babies slower, learning to walk
      case 'juvenile': baseSpeed *= 0.85; break; // Getting faster
      case 'elder': baseSpeed *= 0.9; break; // Slowing down
      // Adults: no modifier (1.0)
    }
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
    // REMOVED: No world boundaries - creatures can move freely
    this.x = this.x + this.vx*dt;
    this.y = this.y + this.vy*dt;

    // NEW: Update animation state based on movement
    this._updateAnimationState(spd, world.t);

    this.updateTrail(dt);

    if (this.genes.predator || diet > 0.7) {
      // Carnivores: attack prey
      this.personality.attackCooldown = Math.max(0, this.personality.attackCooldown - dt);
      const attackResult = this.personality.attackCooldown <= 0 ? world.tryPredation(this) : null;
      if (attackResult?.victim) {
        if (attackResult.killed) {
          this.energy += 14; // BALANCED: Less OP, need more strategic hunting
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
      
      // NEW: Try to scavenge corpse if nearby
      if (canScavenge && this.target?.isCorpse && this.target.corpse) {
        if (world.tryEatCorpse(this, this.target.corpse)) {
          this.target = null;
        }
      }
    } else if (isOmnivore) {
      // NEW: Omnivores: eat plants or scavenge
      if (this.target?.isCorpse && this.target.corpse) {
        if (world.tryEatCorpse(this, this.target.corpse)) {
          this.target = null;
        }
      } else {
        const eaten = world.tryEatFoodAt(this.x, this.y, 8);
        if (eaten) {
          // NEW: Use energy from vegetation type!
          const energyGain = eaten.energy || 9;
          this.energy += energyGain;
          this.health = Math.min(this.maxHealth, this.health + energyGain * 0.15);
          this.stats.food += 1;
          this.logEvent(`Foraged ${eaten.type || 'food'}`, world.t);
          world.dropPheromone(this.x, this.y, 0.5);
          
          // NEW: Trigger eating animation
          this.animation.lastEat = world.t;
          this.animation.state = 'eating';
          
          // Audio: Eat sound
          if (world.audio && world.audio.ctx) {
            try {
              world.audio.playCreatureSound(this, 'eat');
            } catch (e) {
              // Ignore audio errors (non-critical)
            }
          }
          
          // Visual: Food absorption particles
          if (world.particles && typeof world.particles.addFoodAbsorption === 'function') {
            world.particles.addFoodAbsorption(eaten.x, eaten.y, this.x, this.y);
          }
          
          // FEATURE 2: Remember successful food location
          if (this.rememberLocation) {
            this.rememberLocation(this.x, this.y, 'food', 0.8, world.t);
          }
          
          if (this.stats.food === 20) {
            world.lineageTracker?.noteMilestone(world, this, 'foraged 20 meals');
          }
        }
      }
    } else {
      // Herbivores: only eat plants
      const eaten = world.tryEatFoodAt(this.x, this.y, 8);
      if (eaten) {
        // NEW: Use energy from vegetation type!
        const energyGain = eaten.energy || 9;
        this.energy += energyGain;
        this.health = Math.min(this.maxHealth, this.health + energyGain * 0.15);
        this.stats.food += 1;
        this.logEvent(`Foraged ${eaten.type || 'food'}`, world.t);
        world.dropPheromone(this.x, this.y, 0.5);
        
        // NEW: Trigger eating animation
        this.animation.lastEat = world.t;
        this.animation.state = 'eating';
        
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
    
    // NEW: Age stage metabolism modifiers
    switch(this.ageStage) {
      case 'baby': energyDrain *= 1.1; break; // Babies need more energy for growth
      case 'juvenile': energyDrain *= 1.05; break; // Still growing
      case 'elder': energyDrain *= 1.15; break; // Elders less efficient
      // Adults: no modifier (1.0)
    }
    
    if (eff?.adrenaline > 0) energyDrain += 2.6 + eff.adrenalineBoost * 2;
    if (eff?.herdBuff > 0 && !this.genes.predator) energyDrain += eff.herdIntensity * 0.8;
    if (eff?.bleed > 0) energyDrain += 0.35 + (eff.bleedStacks || 0) * 0.4;
    if (this.genes.predator) {
      const aggressionTax = Math.max(0, (aggressionFactor - 1) * 0.18);
      energyDrain += aggressionTax;
    }
    
    // Day/Night cycle: nocturnal creatures use less energy at night
    if (world.dayNightEnabled && this.genes.nocturnal !== undefined) {
      const hour = world.timeOfDay % 24;
      const isNight = (hour < 6 || hour >= 20);
      const nocturnalPref = this.genes.nocturnal; // 0=diurnal, 1=nocturnal
      
      if (isNight && nocturnalPref > 0.5) {
        // Nocturnal creatures active at night: bonus efficiency
        energyDrain *= (1.0 - (nocturnalPref - 0.5) * 0.3); // Up to 15% reduction
      } else if (!isNight && nocturnalPref < 0.5) {
        // Diurnal creatures active during day: bonus efficiency
        energyDrain *= (1.0 - (0.5 - nocturnalPref) * 0.3); // Up to 15% reduction
      } else {
        // Active at wrong time: penalty
        const penalty = Math.abs(nocturnalPref - (isNight ? 1 : 0));
        energyDrain *= (1.0 + penalty * 0.2); // Up to 20% increase
      }
    }
    
    this.energy -= energyDrain * dt;

    if (this.health <= 0) {
      this.alive = false;
      this.logEvent('Bled out', world.t);
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
      return;
    }

    // FEATURE 8: Sexual selection for reproduction
    // NEW: Only adults can reproduce, and elders have menopause (can't reproduce after age 270)
    const canReproduce = this.ageStage === 'adult' || (this.ageStage === 'elder' && this.age < 270);
    if (!this.genes.predator && this.energy > 36 && canReproduce) {
      // Look for suitable mate
      const potentialMates = world.queryCreatures(this.x, this.y, this.genes.sense * 2)
        .filter(c => !c.genes.predator && c.alive && c.id !== this.id && c.energy > 30);
      
      let selectedMate = null;
      let bestScore = this.sexuality.choosiness;
      
      for (const mate of potentialMates) {
        if (this.shouldAcceptMate && this.shouldAcceptMate(mate, world.t)) {
          const score = this.evaluateMate(mate);
          if (score > bestScore) {
            bestScore = score;
            selectedMate = mate;
          }
        }
      }
      
      if (selectedMate || potentialMates.length === 0) {
        this.energy *= 0.55;
        if (selectedMate) {
          this.sexuality.lastMated = world.t;
          selectedMate.sexuality.lastMated = world.t;
          // Log successful mating
          this.emotions.confidence = Math.min(1, this.emotions.confidence + 0.1);
        }
        world.spawnChild(this, selectedMate);
      }
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

  // NEW: Get age stage multipliers
  _updateAgeStage() {
    if (this.age < 30) {
      this.ageStage = 'baby';
    } else if (this.age < 60) {
      this.ageStage = 'juvenile';
    } else if (this.age < 240) {
      this.ageStage = 'adult';
    } else {
      this.ageStage = 'elder';
    }
  }
  
  _getAgeSizeMultiplier() {
    switch(this.ageStage) {
      case 'baby': return clamp(0.3 + (this.age / 30) * 0.4, 0.3, 0.7); // 30% → 70%
      case 'juvenile': return clamp(0.7 + ((this.age - 30) / 30) * 0.3, 0.7, 1.0); // 70% → 100%
      case 'adult': return 1.0; // 100%
      case 'elder': return clamp(1.0 - ((this.age - 240) / 60) * 0.1, 0.9, 1.0); // 100% → 90%
      default: return 1.0;
    }
  }
  
  _getAgeStageIcon() {
    switch(this.ageStage) {
      case 'baby': return '🍼';
      case 'juvenile': return '🌱';
      case 'adult': return '⭐';
      case 'elder': return '👴';
      default: return '';
    }
  }
  
  // NEW: Apply visual animation transforms
  _applyAnimationTransform(ctx) {
    const anim = this.animation;
    if (!anim) return;
    
    switch(anim.state) {
      case 'walking':
        // Gentle bobbing motion
        const walkBob = Math.sin(anim.bobPhase) * 0.8;
        ctx.translate(0, walkBob);
        break;
        
      case 'running':
        // Faster, more exaggerated bobbing
        const runBob = Math.sin(anim.bobPhase * 1.5) * 1.5;
        const runTilt = Math.sin(anim.bobPhase * 1.5) * 0.05; // Slight tilt
        ctx.translate(0, runBob);
        ctx.rotate(runTilt);
        break;
        
      case 'eating':
        // Head bob down (pulsing)
        const eatTime = anim.timer % 0.5;
        const eatBob = Math.sin((eatTime / 0.5) * Math.PI) * 2;
        ctx.translate(0, eatBob);
        ctx.scale(1.0 + eatBob * 0.02, 1.0); // Slight stretch
        break;
        
      case 'sleeping':
        // Slow breathing motion
        const breathe = Math.sin(anim.timer * 0.5) * 0.5;
        ctx.scale(1.0 + breathe * 0.05, 1.0 - breathe * 0.05);
        break;
        
      case 'idle':
      default:
        // Subtle idle sway
        const idleSway = Math.sin(anim.timer * 0.3) * 0.3;
        ctx.translate(0, idleSway);
        break;
    }
  }
  
  // NEW: Update animation state based on behavior
  _updateAnimationState(speed, worldTime) {
    const anim = this.animation;
    
    // Update animation timer (used for bobbing/cycles)
    anim.timer += 0.016; // ~60fps equivalent
    anim.bobPhase += speed * 0.02; // Speed affects bob rate
    
    // Check if eating animation is active
    if (worldTime - anim.lastEat < anim.eatDuration) {
      anim.state = 'eating';
      return;
    }
    
    // Check if sleeping (low energy and stationary)
    if (this.energy < 15 && speed < 5) {
      anim.sleepTimer += 0.016;
      if (anim.sleepTimer > 2.0) { // Sleep after 2 seconds of low energy
        anim.state = 'sleeping';
        
        // Emit Zzz particles occasionally
        if (Math.random() < 0.02) { // 2% chance per frame
          const world = this._lastWorld; // Will be set in update()
          if (world && world.particles) {
            world.particles.addSleepParticle(this.x, this.y + this.size);
          }
        }
        return;
      }
    } else {
      anim.sleepTimer = 0;
    }
    
    // Determine walking vs running based on speed
    const baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    const speedRatio = speed / baseSpeed;
    
    if (speedRatio > 0.8) {
      anim.state = 'running'; // Fast movement
    } else if (speedRatio > 0.1) {
      anim.state = 'walking'; // Normal movement
    } else {
      anim.state = 'idle'; // Stationary or very slow
    }
  }

  getBadges() {
    const badges = [];
    const g = this.genes;
    
    // Age stage badge (visual indicator)
    badges.push(this._getAgeStageIcon());
    
    // NEW: Lucky mutation badge!
    if (g._luckyMutation) badges.push('🍀 Lucky');
    
    if (g.speed >= 1.45) badges.push('Swift');
    if (g.sense >= 150) badges.push('Scout');
    if (g.metabolism <= 0.6) badges.push('Efficient');
    if (this.ageStage === 'elder') badges.push('Elder');
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
    
    // OPTIMIZATION: Only apply animation when zoomed in enough or selected
    const shouldAnimate = isSelected || isPinned || (opts.zoom && opts.zoom > 0.8);
    if (shouldAnimate) {
      this._applyAnimationTransform(ctx);
    }
    
    ctx.rotate(this.dir);

    // OPTIMIZATION: Cache size calculation
    const energyRatio = clamp(this.energy/40, 0.2, 1.0);
    const r = energyRatio * (3+this.size);

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
    
    // OPTIMIZATION: Only draw detailed traits when zoomed in significantly
    const showTraitDetails = opts.showTraitVisualization !== false && (isSelected || isPinned || (opts.zoom && opts.zoom > 1.0));
    
    // NEW: Trait visualization - body shape based on metabolism
    const bodyScale = 0.8 + (2 - g.metabolism) * 0.3; // Low metabolism = chunkier
    ctx.save();
    ctx.scale(1, bodyScale);
    ctx.beginPath();
    ctx.moveTo(6,0);
    ctx.lineTo(-4,3.5 / bodyScale);
    ctx.lineTo(-4,-3.5 / bodyScale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = `hsla(${displayHue},90%,80%,${0.65 + flash * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0,0,r,0,TAU);
    ctx.stroke();
    
    // OPTIMIZATION: Only draw detailed trait visualization when zoomed in
    if (showTraitDetails) {
      this._drawTraits(ctx, g, displayHue, r);
    }

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
  
  _drawTraits(ctx, g, hue, r) {
    // Draw visual traits based on genes
    
    // 1. EYES - Size based on sense radius (bigger sense = bigger eyes)
    const eyeSize = clamp(g.sense / 100, 0.6, 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(2, -1.5, eyeSize, 0, TAU);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(2, -1.5, eyeSize * 0.5, 0, TAU);
    ctx.fill();
    
    // 2. SPIKES - Defensive herbivores have spikes
    const spineStrength = g.spines ?? 0;
    if (spineStrength > 0.2) {
      ctx.strokeStyle = `hsl(${hue}, 70%, 40%)`;
      ctx.lineWidth = 1.5;
      const spikeCount = Math.floor(spineStrength * 6) + 2;
      for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * TAU;
        const spikeLength = 2 + spineStrength * 3;
        const x1 = Math.cos(angle + Math.PI * 0.5) * r;
        const y1 = Math.sin(angle + Math.PI * 0.5) * r;
        const x2 = Math.cos(angle + Math.PI * 0.5) * (r + spikeLength);
        const y2 = Math.sin(angle + Math.PI * 0.5) * (r + spikeLength);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    
    // 3. SPEED INDICATOR - Fast creatures have elongated tail/fins
    if (g.speed > 1.2) {
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.6)`;
      ctx.beginPath();
      const tailLength = (g.speed - 1) * 4;
      ctx.moveTo(-4, 0);
      ctx.lineTo(-4 - tailLength, 2);
      ctx.lineTo(-4 - tailLength, -2);
      ctx.closePath();
      ctx.fill();
    }
    
    // 4. PREDATOR TEETH
    if (g.predator || (g.diet && g.diet > 0.7)) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 0.5;
      // Upper teeth
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(4 - i * 1.5, 0.5);
        ctx.lineTo(5 - i * 1.5, 2);
        ctx.lineTo(3 - i * 1.5, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
