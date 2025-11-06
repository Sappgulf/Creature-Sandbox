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
    this.aquaticAffinity = this.genes.aquatic ?? 0;
    
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
    this.parents = [];
    this.currentBiomeType = null;

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
    this.statuses = new Map();
    this.cooldowns = {
      adrenaline: 0,
      familyAid: 0
    };
    this.damageFx = {
      recentDamage: 0,
      hitFlash: 0
    };
    this.statusTimers = {
      diseaseSpread: rand(0.6, 1.2),
      venomTick: 1.2
    };
    this.lifecycle = {
      playCooldown: rand(6, 12),
      playTimer: 0,
      elderAidCooldown: rand(5, 9),
      familyCheck: rand(2.5, 4.5),
      familyAnchor: null
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
    if (!this.statusTimers) {
      this.statusTimers = {
        diseaseSpread: rand(0.6, 1.2),
        venomTick: 1.2
      };
    }
    
    // Update age stage and size based on age
    this._updateAgeStage();
    this.size = this.baseSize * this._getAgeSizeMultiplier();
    
    // Call feature update methods
    if (this._updateMemory) this._updateMemory(dt, world);
    if (this._updateSocialBehavior) this._updateSocialBehavior(world);
    if (this._updateMigration) this._updateMigration(world, dt);
    if (this._updateEmotions) this._updateEmotions(dt, world);
    if (this._updateIntelligence) this._updateIntelligence(dt, world);
    
    this._tickStatusSystem(dt);
    this._processStatusEffects(dt, world);

    if (this.cooldowns.adrenaline > 0) {
      this.cooldowns.adrenaline = Math.max(0, this.cooldowns.adrenaline - dt);
    }

    if (this.damageFx.hitFlash > 0) {
      this.damageFx.hitFlash = Math.max(0, this.damageFx.hitFlash - dt * 2.6);
    }
    if (this.damageFx.recentDamage > 0) {
      this.damageFx.recentDamage = Math.max(0, this.damageFx.recentDamage - dt);
    }

    // Ongoing bleed damage (if any)
    const bleedStatus = this.getStatus('bleed');
    if (bleedStatus) {
      const stacks = Math.max(1, bleedStatus.stacks ?? 1);
      const severity = clamp(bleedStatus.intensity ?? 1, 0.2, 3);
      const bleedRate = (0.35 + stacks * 0.22) * severity;
      const bleedDamage = bleedRate * dt;
      if (bleedDamage > 0) {
        this.health = Math.max(0, this.health - bleedDamage);
        this.stats.damageTaken += bleedDamage;
        this.energy = Math.max(0, this.energy - bleedDamage * 0.08);
      }
    }

    if (this.health < this.maxHealth) {
      const regenBase = this.genes.predator ? 0.9 : 1.6;
      const energyFactor = clamp(this.energy / 24, 0.3, 1.2);
      const grit = this.genes.grit ?? 0;
      let penalty = 1;
      if (this.damageFx.recentDamage > 0) {
        penalty -= Math.min(0.55, (0.45 - grit * 0.25));
      }
      if (bleedStatus) {
        penalty -= Math.min(0.5, (bleedStatus.stacks ?? 0) * 0.18 * (1 - grit * 0.35));
      }
      if (this.getStatus('elder-aid')) {
        const elderAid = this.getStatus('elder-aid');
        penalty += Math.min(0.18, (elderAid.intensity ?? 0) * 0.2);
      }
      penalty = clamp(penalty, 0.14, 1);
      this.health = Math.min(this.maxHealth, this.health + regenBase * energyFactor * penalty * dt);
    }

    const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 1;
    if (healthRatio < 0.35 && !this.hasStatus('adrenaline') && this.cooldowns.adrenaline <= 0) {
      const herdBuff = this.getStatus('herd-buff');
      const baseBoost = 0.35 + (this.genes.panicPheromone ?? 0) * 0.45 + (herdBuff?.intensity ?? 0) * 0.2;
      this.applyStatus('adrenaline', { duration: 2.6, intensity: baseBoost, metadata: { boost: baseBoost } });
      this.cooldowns.adrenaline = 7;
    }

    this._handleLifecycleBehavior(dt, world);
    const currentBiome = world.getBiomeAt ? world.getBiomeAt(this.x, this.y) : null;
    this.currentBiome = currentBiome;
    this.currentBiomeType = currentBiome?.type ?? this.currentBiomeType ?? null;
    const inWetland = currentBiome?.type === 'wetland';
    
    let wanderScale = 0.05 * BehaviorConfig.wanderWeight;
    const diet = this.genes.diet ?? (this.genes.predator ? 1.0 : 0.0);
    const isOmnivore = diet > 0.3 && diet < 0.7;
    const canScavenge = diet >= 0.3; // Omnivores and carnivores can scavenge
    if (this.aquaticAffinity > 0.45 && inWetland) {
      wanderScale *= 0.8;
    }
    
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
    if (this.lifecycle?.playTimer > 0 && !this.target) {
      desiredAngle += Math.sin(this.lifecycle.playTimer * 12 + (this.id ?? 0)) * 0.4;
    }
    if (this.aquaticAffinity > 0.5 && !inWetland && (!this.target || this.target.family)) {
      const wetDir = this._sampleWetlandDirection(world);
      if (wetDir != null) {
        desiredAngle = desiredAngle * 0.7 + wetDir * 0.3;
      }
    }
    const aggressiveTurn = this.genes.predator && this.target && this.target.creatureId != null && this.personality.ambushTimer <= 0;
    const turnClamp = aggressiveTurn ? 0.22 : 0.15;
    let delta = Math.atan2(Math.sin(desiredAngle - this.dir), Math.cos(desiredAngle - this.dir));
    this.dir += clamp(delta, -turnClamp, turnClamp);

    const restFactor = BehaviorConfig.restWeight * clamp(1 - this.energy / 36, 0, 1);
    const aggressionFactor = this.genes.predator ? clamp(this.personality.aggression, 0.4, 2.2) : 1;
    let baseSpeed = this.genes.speed * (this.genes.predator ? 46 : 40);
    if (this.genes.predator) baseSpeed *= 0.85 + aggressionFactor * 0.25;
    if (inWetland) {
      if (this.aquaticAffinity > 0.1) {
        baseSpeed *= 1 + this.aquaticAffinity * 0.32;
      } else {
        baseSpeed *= 0.88;
      }
    } else if (this.aquaticAffinity > 0.5) {
      baseSpeed *= 0.9 - Math.min(0.2, (this.aquaticAffinity - 0.5) * 0.25);
    }
    
    // NEW: Age stage speed modifiers
    switch(this.ageStage) {
      case 'baby': baseSpeed *= 0.6; break; // Babies slower, learning to walk
      case 'juvenile': baseSpeed *= 0.85; break; // Getting faster
      case 'elder': baseSpeed *= 0.9; break; // Slowing down
      // Adults: no modifier (1.0)
    }
    let speedScalar = clamp(1 - restFactor * 0.6, 0.15, 1);
    let speedBoost = 1;
    const herdBuff = this.getStatus('herd-buff');
    const playBurst = this.getStatus('play-burst');
    const elderAid = this.getStatus('elder-aid');
    if (herdBuff && !this.genes.predator) {
      speedBoost += herdBuff.intensity ?? 0;
    }
    const adrenalineStatus = this.getStatus('adrenaline');
    if (adrenalineStatus) {
      const boost = adrenalineStatus.metadata?.boost ?? adrenalineStatus.intensity ?? 0;
      speedBoost += boost;
    }
    if (bleedStatus) {
      speedBoost -= Math.min(0.3, 0.08 * Math.max(bleedStatus.stacks ?? 1, 0));
    }
    if (playBurst) {
      speedBoost += playBurst.intensity ?? 0.25;
    }
    if (elderAid) {
      speedBoost += (elderAid.intensity ?? 0) * 0.08;
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
    
    if (adrenalineStatus) energyDrain += 2.6 + (adrenalineStatus.metadata?.boost ?? adrenalineStatus.intensity ?? 0) * 2;
    if (herdBuff && !this.genes.predator) energyDrain += (herdBuff.intensity ?? 0) * 0.8;
    if (bleedStatus) energyDrain += 0.35 + (bleedStatus.stacks ?? 0) * 0.4;
    if (playBurst) energyDrain += 0.45;
    if (elderAid) energyDrain *= clamp(1 - (elderAid.intensity ?? 0) * 0.2, 0.7, 1);
    if (this.genes.predator) {
      const aggressionTax = Math.max(0, (aggressionFactor - 1) * 0.18);
      energyDrain += aggressionTax;
    }
    if (inWetland) {
      energyDrain *= clamp(1 - this.aquaticAffinity * 0.25 + (this.aquaticAffinity < 0.2 ? 0.12 : 0), 0.65, 1.15);
    } else if (this.aquaticAffinity > 0.4) {
      energyDrain += this.aquaticAffinity * 0.35;
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
      const fertilityFactor = clamp(world.getSeasonModifier ? world.getSeasonModifier('reproduction') : 1, 0, 1.2);
      const reproductionChance = clamp(fertilityFactor, 0, 1);
      if (Math.random() < reproductionChance) {
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
          const scarcity = Math.max(0, 1 - fertilityFactor);
          const abundance = Math.max(0, fertilityFactor - 1);
          const energyMultiplier = clamp(0.55 + scarcity * 0.12 - abundance * 0.08, 0.42, 0.65);
          this.energy *= energyMultiplier;
          if (selectedMate) {
            this.sexuality.lastMated = world.t;
            selectedMate.sexuality.lastMated = world.t;
            // Log successful mating
            this.emotions.confidence = Math.min(1, this.emotions.confidence + 0.1);
          }
          world.spawnChild(this, selectedMate);
        }
      } else if (fertilityFactor < 0.5 && this.emotions) {
        this.emotions.stress = clamp((this.emotions.stress ?? 0) + 0.02, 0, 1);
      }
    }

    if (this.energy <= 0 || this.age > 300) {
      this.alive = false;
      this.logEvent(this.energy <= 0 ? 'Energy collapse' : 'Old age', world.t);
      if (!this.genes.predator) world.addFood(this.x, this.y, 1.5);
    }
  }

  hasStatus(key) {
    return this.statuses.has(key);
  }

  getStatus(key) {
    return this.statuses.get(key) || null;
  }

  getStatusIntensity(key, fallback = 0) {
    const s = this.getStatus(key);
    if (!s) return fallback;
    return s.intensity ?? fallback;
  }

  applyStatus(key, opts = {}) {
    const now = this.statuses.get(key) || { key };
    if (opts.duration !== undefined) now.duration = Math.max(0, opts.duration);
    if (opts.intensity !== undefined) now.intensity = opts.intensity;
    if (opts.stacks !== undefined) {
      now.stacks = Math.max(0, opts.stacks);
    } else if (opts.stackDelta !== undefined) {
      now.stacks = Math.max(0, (now.stacks ?? 0) + opts.stackDelta);
    }
    if (opts.metadata) {
      now.metadata = { ...(now.metadata ?? {}), ...opts.metadata };
    }
    if (opts.source !== undefined) now.source = opts.source;
    now.elapsed = 0;
    this.statuses.set(key, now);
    return now;
  }

  removeStatus(key) {
    this.statuses.delete(key);
  }

  _tickStatusSystem(dt) {
    if (!this.statuses.size) return;
    for (const [key, status] of this.statuses) {
      status.elapsed = (status.elapsed ?? 0) + dt;
      if (status.duration !== undefined) {
        status.duration -= dt;
        if (status.duration <= 0) {
          this.statuses.delete(key);
          continue;
        }
      }
    }
  }

  _processStatusEffects(dt, world) {
    const disease = this.getStatus('disease');
    if (disease) {
      const severity = clamp(disease.intensity ?? 0.6, 0.1, 2.2);
      // Increase stress and reduce energy
      this.energy = Math.max(0, this.energy - severity * 0.5 * dt);
      if (this.emotions) {
        this.emotions.stress = clamp((this.emotions.stress ?? 0) + severity * 0.02 * dt, 0, 1);
        this.emotions.confidence = clamp((this.emotions.confidence ?? 0) - severity * 0.015 * dt, 0, 1);
      }
      // Slight fever damage over time
      this.health = Math.max(0, this.health - severity * 0.12 * dt);
      this.statusTimers.diseaseSpread = (this.statusTimers.diseaseSpread ?? rand(0.8, 1.6)) - dt;
      if (this.statusTimers.diseaseSpread <= 0) {
        this._spreadDisease(world, disease);
        this.statusTimers.diseaseSpread = rand(0.9, 1.8);
      }
    }

    const venom = this.getStatus('venom');
    if (venom) {
      const potency = clamp(venom.intensity ?? 1, 0.2, 3);
      this.statusTimers.venomTick = (this.statusTimers.venomTick ?? 1.2) - dt;
      if (this.statusTimers.venomTick <= 0) {
        const burst = 0.8 + potency * 0.6;
        this.health = Math.max(0, this.health - burst);
        this.stats.damageTaken += burst;
        this.energy = Math.max(0, this.energy - burst * 0.2);
        this.statusTimers.venomTick = 1.1;
        if (typeof this.recordDamage === 'function') {
          this.recordDamage(burst * 1.8);
        }
      }
    }
  }

  _handleLifecycleBehavior(dt, world) {
    if (!world) return;
    this.lifecycle = this.lifecycle || {
      playCooldown: rand(6, 12),
      playTimer: 0,
      elderAidCooldown: rand(5, 9),
      familyCheck: rand(2.5, 4.5),
      familyAnchor: null
    };

    // Juvenile play bursts
    if (this.ageStage === 'juvenile' && !this.genes.predator) {
      this.lifecycle.playCooldown -= dt;
      if (this.lifecycle.playCooldown <= 0 && this.energy > 12) {
        this.lifecycle.playTimer = 0.8;
        this.lifecycle.playCooldown = rand(10, 18);
        this.applyStatus('play-burst', { duration: 0.75, intensity: 0.35 });
        this.energy = Math.max(0, this.energy - 0.8);
        if (this.emotions) {
          this.emotions.joy = clamp((this.emotions.joy ?? 0) + 0.2, 0, 1);
          this.emotions.stress = clamp((this.emotions.stress ?? 0) - 0.05, 0, 1);
        }
        if (world.particles && typeof world.particles.addPlayBurst === 'function') {
          world.particles.addPlayBurst(this.x, this.y);
        }
        if (world.audio && world.audio.ctx) {
          try {
            world.audio.playCreatureSound?.(this, 'play');
          } catch (err) {
            // Ignore audio errors
          }
        }
        this.logEvent?.('Playful sprint', world.t);
      } else {
        this.lifecycle.playTimer = Math.max(0, (this.lifecycle.playTimer ?? 0) - dt);
      }
    } else {
      this.lifecycle.playTimer = Math.max(0, (this.lifecycle.playTimer ?? 0) - dt);
    }

    // Elder support aura
    if (this.ageStage === 'elder' && !this.genes.predator) {
      this.lifecycle.elderAidCooldown -= dt;
      if (this.lifecycle.elderAidCooldown <= 0) {
        this.lifecycle.elderAidCooldown = rand(5.5, 8.5);
        this._emitElderSupport(world);
      }
    }

    // Family anchoring
    if (this.children && this.children.length) {
      this.lifecycle.familyCheck -= dt;
      if (this.lifecycle.familyCheck <= 0) {
        this.lifecycle.familyCheck = rand(3, 5);
        this.lifecycle.familyAnchor = this._selectFamilyAnchor(world);
      }
      if (!this.genes.predator && !this.target && this.lifecycle.familyAnchor) {
        const anchor = this.lifecycle.familyAnchor;
        const dx = anchor.x - this.x;
        const dy = anchor.y - this.y;
        if ((dx * dx + dy * dy) > 45 * 45) {
          this.target = { x: anchor.x, y: anchor.y, family: true };
        }
      }
    }
  }

  _emitElderSupport(world) {
    const radius = clamp(this.genes.sense * 0.7, 60, 150);
    const allies = world.queryCreatures(this.x, this.y, radius)
      .filter(c => c !== this && c.alive && !c.genes.predator);
    if (!allies.length) return;
    const bondStrength = clamp((this.genes.herdInstinct ?? 0.4) + (this.genes.grit ?? 0.2), 0.2, 1);
    for (const ally of allies) {
      const closeness = 1 - Math.min(1, dist2(ally.x, ally.y, this.x, this.y) / (radius * radius));
      const intensity = clamp(0.15 + bondStrength * closeness * 0.6, 0.1, 0.5);
      ally.applyStatus?.('elder-aid', { duration: 4.2, intensity });
      ally.energy = Math.min(48, ally.energy + 1.8 * intensity * 3);
      if (ally.emotions) {
        ally.emotions.confidence = clamp((ally.emotions.confidence ?? 0) + intensity * 0.1, 0, 1);
        ally.emotions.stress = clamp((ally.emotions.stress ?? 0) - intensity * 0.08, 0, 1);
      }
      if (world.particles && typeof world.particles.addElderAura === 'function') {
        world.particles.addElderAura(ally.x, ally.y);
      }
    }
    this.logEvent?.('Shared wisdom with the herd', world.t);
  }

  _selectFamilyAnchor(world) {
    if (!this.children || !this.children.length) return null;
    let best = null;
    let bestScore = Infinity;
    for (const childId of this.children) {
      const child = world.getAnyCreatureById(childId);
      if (!child || !child.alive) continue;
      if (child.ageStage === 'adult') continue;
      const score = child.age;
      if (score < bestScore) {
        bestScore = score;
        best = child;
      }
    }
    if (!best) return null;
    return { x: best.x, y: best.y, id: best.id };
  }

  _sampleWetlandDirection(world) {
    if (!world?.getBiomeAt) return null;
    let bestDir = null;
    let bestScore = 0;
    const radius = 200 + this.aquaticAffinity * 100;
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const tx = this.x + Math.cos(angle) * radius;
      const ty = this.y + Math.sin(angle) * radius;
      const biome = world.getBiomeAt(tx, ty);
      if (!biome) continue;
      let score = biome.type === 'wetland' ? 1.2 : (biome.moisture ?? 0);
      score += (1 - Math.abs(Math.sin(angle - this.dir))) * 0.05;
      if (score > bestScore) {
        bestScore = score;
        bestDir = angle;
      }
    }
    return bestScore > 0.4 ? bestDir : null;
  }

  _spreadDisease(world, disease) {
    if (!world || !disease) return;
    const contagion = clamp(disease.metadata?.contagion ?? 0.35, 0.05, 1.0);
    const severity = clamp(disease.intensity ?? 0.6, 0.1, 2.2);
    const radius = clamp(this.genes.sense * 0.6, 40, 140);
    const neighbors = world.queryCreatures(this.x, this.y, radius);
    if (!neighbors || neighbors.length <= 1) return;
    for (const other of neighbors) {
      if (other === this || !other.alive || typeof other.hasStatus !== 'function') continue;
      if (other.hasStatus('disease')) continue;
      const immunity = clamp(other.genes.grit ?? 0, 0, 1);
      const spreadChance = Math.max(0, contagion * 0.3 + severity * 0.05 - immunity * 0.12);
      if (Math.random() < spreadChance) {
        const duration = rand(18, 32);
        const intensity = clamp(severity * rand(0.6, 1.15), 0.25, 2);
        other.applyStatus('disease', {
          duration,
          intensity,
          metadata: {
            contagion: contagion * 0.9
          }
        });
        if (typeof other.logEvent === 'function') {
          other.logEvent('Caught a sickness', world.t);
        }
        if (world.particles && typeof world.particles.addDiseasePulse === 'function') {
          world.particles.addDiseasePulse(other.x, other.y);
        }
      }
    }
  }

  recordDamage(amount) {
    if (!this.damageFx) this.damageFx = { recentDamage: 0, hitFlash: 0 };
    const ratio = clamp(amount / 10, 0.05, 1);
    this.damageFx.recentDamage = Math.min(2.6, (this.damageFx.recentDamage ?? 0) + ratio * 1.5);
    this.damageFx.hitFlash = Math.max(this.damageFx.hitFlash ?? 0, 0.18 + ratio * 0.35);
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
    if (this.aquaticAffinity > 0.6) badges.push('Amphibious');
    if (this.hasStatus && this.hasStatus('disease')) badges.push('Sick');
    if (this.hasStatus && this.hasStatus('venom')) badges.push('Poisoned');
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
    const damageFx = this.damageFx ?? null;

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

    if (damageFx?.recentDamage > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 5, 0, TAU);
      ctx.strokeStyle = `rgba(255,96,96,${clamp(damageFx.recentDamage / 2.6, 0.15, 0.55)})`;
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
    const flash = damageFx ? damageFx.hitFlash : 0;
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
