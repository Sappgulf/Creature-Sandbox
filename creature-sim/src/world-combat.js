/**
 * World Combat System - Handles predation, damage, and combat mechanics
 */
import { rand, clamp, dist2 } from './utils.js';
import { CreatureTuning } from './creature-tuning.js';
import { eventSystem, GameEvents } from './event-system.js';

export class WorldCombat {
  constructor(world) {
    this.world = world;
    this.initialize();
  }

  initialize() {
    console.debug('⚔️ World combat system initialized');
  }

  // Attempt predation at location
  tryPredation(predator) {
    if (!predator.alive) return null;

    const prey = this.findPrey(predator, 120);
    if (!prey) return null;

    return this.executeAttack(predator, prey);
  }

  // Find suitable prey for predator
  findPrey(predator, radius = 120) {
    const candidates = [];

    for (const c of this.world.creatures) {
      if (!c.alive || c === predator) continue;
      if (dist2(predator.x, predator.y, c.x, c.y) > radius * radius) continue;

      // Check if predator can eat this creature
      const predatorDiet = predator.genes.diet ?? (predator.genes.predator ? 1.0 : 0.0);
      const preyDiet = c.genes.diet ?? (c.genes.predator ? 1.0 : 0.0);

      // Predators can eat herbivores and smaller omnivores
      // Omnivores can eat herbivores and small creatures
      // Herbivores can't eat other creatures
      const canEat = (predatorDiet > 0.7) || // Predator
        (predatorDiet > 0.3 && predatorDiet < 0.7 && preyDiet < 0.3) || // Omnivore eating herbivore
        (predatorDiet > 0.3 && predatorDiet < 0.7 && c.size < predator.size * 0.8); // Omnivore eating smaller creature

      if (canEat) {
        candidates.push(c);
      }
    }

    if (candidates.length === 0) return null;

    // Choose closest prey
    let bestPrey = null;
    let bestDist = Infinity;

    for (const prey of candidates) {
      const dist = dist2(predator.x, predator.y, prey.x, prey.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestPrey = prey;
      }
    }

    return bestPrey;
  }

  // Execute attack between predator and prey
  executeAttack(predator, prey) {
    if (!predator.alive || !prey.alive) return null;

    // Calculate attack success
    const predatorStrength = predator.size * predator.energy / predator.maxHealth;
    const preyStrength = prey.size * prey.energy / prey.maxHealth;

    const attackRoll = rand();
    const successChance = clamp(predatorStrength / (predatorStrength + preyStrength), 0.1, 0.9);

    if (attackRoll < successChance) {
      // Attack succeeds
      const damage = this.calculateDamage(predator, prey);
      const appliedDamage = this.applyDamage(prey, damage, { attacker: predator, attackType: 'predation' });

      predator.energy = Math.min(predator.energy + appliedDamage * 0.7, predator.energy * 1.2); // Energy gain
      predator.stats.kills++;
      this.setAttackCooldown(predator, 0.9);

      // Predator signals (pheromone communication)
      this.registerPredatorSignal(predator.x, predator.y, appliedDamage * 0.1, 5, predator.id);

      return { success: true, damage: appliedDamage, prey };
    } else {
      // Attack fails - possible counterattack
      if (rand() < 0.3) { // 30% chance of counterattack
        const counterDamage = this.calculateDamage(prey, predator) * 0.5;
        this.applyDamage(predator, counterDamage, { attacker: prey, attackType: 'counterattack' });
      }

      this.setAttackCooldown(predator, 0.7);
      return { success: false, prey };
    }
  }

  // Calculate damage for attack
  calculateDamage(attacker, defender) {
    const baseDamage = attacker.size * 1.6;
    const strengthBonus = clamp(attacker.energy / attacker.maxHealth, 0.6, 1.35);
    const defensePenalty = clamp(defender.health / defender.maxHealth, 0.2, 1);

    return baseDamage * strengthBonus * (1 - defensePenalty * 0.45);
  }

  // Apply damage to target
  applyDamage(target, amount, ctx = {}) {
    if (!target.alive) return 0;

    // Use the target's recordDamage method to handle scaling, caps, and I-frames
    const actualDamage = target.recordDamage(amount, ctx);
    if (actualDamage <= 0) return 0;

    if (ctx.attacker) {
      ctx.attacker.stats.damageDealt += actualDamage;
    }

    // Apply special effects based on attack type
    if (ctx.attackType === 'predation') {
      this.applyPredatorEffects(ctx.attacker, target, actualDamage);
    } else if (ctx.attackType === 'counterattack') {
      this.applyHerdBuff(target, ctx.attacker, actualDamage);
    }

    // Trigger visual damage effects
    this.triggerDamageEffects(target, actualDamage, ctx);

    // Check if target died (recordDamage sets alive=false)
    if (!target.alive) {
      if (ctx.attacker) {
        try {
          eventSystem.emit(GameEvents.CREATURE_KILLED, {
            attacker: ctx.attacker,
            prey: target,
            attackType: ctx.attackType || 'combat',
            worldTime: this.world.t
          });
        } catch (e) {
          console.warn('Failed to emit creature killed event:', e);
        }
      }
      this.handleCreatureDeath(target, ctx);
    }

    return actualDamage;
  }

  setAttackCooldown(creature, seconds) {
    if (!creature?.personality) return;
    creature.personality.attackCooldown = Math.max(creature.personality.attackCooldown ?? 0, seconds);
  }

  // Apply predator-specific effects
  applyPredatorEffects(predator, victim, damage) {
    // Spines defense
    if (victim.genes.spines && rand() < victim.genes.spines) {
      const spineDamage = damage * 0.3;
      predator.health -= spineDamage;
      predator.stats.damageTaken += spineDamage;
    }

    // Panic pheromone
    if (victim.genes.panicPheromone && rand() < victim.genes.panicPheromone) {
      this.triggerPanicResponse(victim, predator, damage);
    }

    // Venom effects for predators
    if (predator.genes.venom && rand() < 0.4) {
      this.applyPredatorVenom(predator, victim, damage);
    }

    // Bleeding effect
    if (rand() < 0.3) {
      this.inflictBleed(predator, damage * 0.2);
    }
  }

  // Apply herd buff to nearby allies
  applyHerdBuff(victim, predator, magnitude) {
    const allies = this.world.creatureManager?.queryCreatures(victim.x, victim.y, 80) || [];

    for (const ally of allies) {
      if (ally !== victim && ally.alive && ally.genes.herdInstinct > 0.3) {
        const buffStrength = magnitude * ally.genes.herdInstinct * 0.1;
        ally.statuses.set('herd_buff', {
          duration: 10,
          damageReduction: buffStrength,
          speedBoost: buffStrength * 0.5
        });
      }
    }
  }

  // Trigger panic response in nearby creatures
  triggerPanicResponse(victim, predator, damage) {
    const nearby = this.world.creatureManager?.queryCreatures(victim.x, victim.y, 100) || [];

    for (const creature of nearby) {
      if (creature.alive && creature !== victim) {
        creature.statuses.set('panic', {
          duration: 8 + rand() * 4,
          speedMultiplier: 1.5,
          fear: predator
        });
      }
    }
  }

  // Apply venom effects
  applyPredatorVenom(predator, victim, damage) {
    const venomStrength = predator.genes.venom || 0.5;
    victim.statuses.set('venom', {
      duration: 15 + rand() * 10,
      damagePerSecond: damage * venomStrength * 0.1,
      appliedBy: predator.id
    });
  }

  // Inflict bleeding on target
  inflictBleed(attacker, severity) {
    attacker.statuses.set('bleeding', {
      duration: 10 + rand() * 5,
      damagePerSecond: severity,
      stacks: 1
    });
  }

  // Handle creature death
  handleCreatureDeath(creature, ctx = {}) {
    // Create corpse
    if (this.world.corpseSystem) {
      this.world.corpseSystem.createCorpse(creature);
    }

    // Trigger death effects
    if (ctx.attacker) {
      // Predator gets energy boost
      ctx.attacker.energy = Math.min(ctx.attacker.energy + creature.energy * 0.3, ctx.attacker.maxHealth);
    }

    // Notify systems
    if (this.world.lineageTracker) {
      this.world.lineageTracker.onCreatureDied(creature);
    }
  }

  // Trigger visual damage effects
  triggerDamageEffects(target, amount, ctx) {
    target.damageFx.recentDamage = amount;
    target.damageFx.lastDamageTime = this.world.t;

    // Blood splatter particles
    if (this.world.particles && amount > 5) {
      const particleCount = Math.floor(amount / 2);
      for (let i = 0; i < particleCount; i++) {
        const angle = rand() * Math.PI * 2;
        const speed = 20 + rand() * 30;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.world.particles.emit(target.x, target.y, 'blood', { vx, vy });
      }
    }
  }

  // Drop pheromone at location
  dropPheromone(x, y, val = 1.0) {
    this.world.pheromone.add(
      Math.floor(x / this.world.pheromone.cell),
      Math.floor(y / this.world.pheromone.cell),
      val
    );
  }

  // Register predator signal
  registerPredatorSignal(x, y, strength = 1, ttl = 5, sourceId = null) {
    // Store signal in world state for other predators to detect
    if (!this.world.predatorSignals) {
      this.world.predatorSignals = [];
    }

    this.world.predatorSignals.push({
      x, y, strength, ttl,
      sourceId,
      timestamp: this.world.t
    });
  }

  // Sample predator signals in area
  samplePredatorSignal(x, y, radius = 140, excludeSource = null) {
    if (!this.world.predatorSignals) return 0;

    let totalStrength = 0;
    const now = this.world.t;

    // Clean up expired signals
    this.world.predatorSignals = this.world.predatorSignals.filter(signal =>
      now - signal.timestamp < signal.ttl
    );

    for (const signal of this.world.predatorSignals) {
      if (excludeSource && signal.sourceId === excludeSource) continue;

      const dist = dist2(x, y, signal.x, signal.y);
      if (dist <= radius * radius) {
        const falloff = 1 - (dist / (radius * radius));
        totalStrength += signal.strength * falloff;
      }
    }

    return totalStrength;
  }
}
