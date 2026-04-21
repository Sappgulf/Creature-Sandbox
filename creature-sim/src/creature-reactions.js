import { clamp } from './utils.js';

export function baseBurn(creature) {
  // Cache this expensive calculation since genes don't change
  if (creature._cachedBaseBurn === null) {
    const g = creature.genes;
    const moveCost = 0.35 * g.speed * g.speed;
    const senseCost = 0.08 * (g.fov / 90) + 0.06 * (g.sense / 100);
    creature._cachedBaseBurn = (0.4 * g.metabolism) + moveCost + senseCost;
  }
  return creature._cachedBaseBurn;
}

export function hasQuirk(creature, id) {
  return Array.isArray(creature.quirks) && creature.quirks.includes(id);
}

export function getQuirkMultiplier(creature, kind) {
  if (!creature.quirks || !creature.quirks.length) return 1;
  let mult = 1;
  for (const q of creature.quirks) {
    switch (kind) {
      case 'wander':
        if (q === 'wanderer') mult *= 1.25;
        if (q === 'homebody') mult *= 0.85;
        break;
      case 'home_pull':
        if (q === 'homebody') mult *= 1.35;
        break;
      case 'stress_crowd':
        if (q === 'squeamish') mult *= 1.25;
        if (q === 'social_butterfly') mult *= 0.85;
        break;
      case 'damage_resist':
        if (q === 'sturdy') mult *= 0.9;
        break;
      case 'night_speed':
        if (q === 'night_owl') mult *= 1.15;
        break;
      case 'day_speed':
        if (q === 'night_owl') mult *= 0.92;
        break;
      case 'cohesion':
        if (q === 'social_butterfly') mult *= 1.2;
        break;
      case 'hunger_bias':
        if (q === 'greedy') mult *= 1.15;
        break;
      default:
        break;
    }
  }
  return mult;
}

export function setMood(creature, icon, duration = 0.6) {
  if (!icon) return;
  creature.mood.icon = icon;
  creature.mood.timer = Math.max(creature.mood.timer, duration);
}

export function reactToPoke(creature, { x = null, y = null } = {}) {
  const intensity = clamp(0.35 + creature.personality.reactivity * 0.7, 0.3, 1.3);
  const worldTime = creature._lastWorld?.t ?? 0;
  if (worldTime - creature._lastPokeAt < 0.75) {
    creature._pokeCombo += 1;
  } else {
    creature._pokeCombo = 1;
  }
  creature._lastPokeAt = worldTime;

  if (creature._pokeCombo >= 3) {
    creature._triggerReaction('overreact', intensity + 0.4, 0.55);
    creature.setMood('😵', 1.1);
    creature._pokeCombo = 0;
  } else {
    creature._triggerReaction('poke', intensity, 0.35);
  }
  if (creature.emotions) {
    creature.emotions.curiosity = clamp(creature.emotions.curiosity + 0.08, 0, 1);
    creature.emotions.confidence = clamp(creature.emotions.confidence + 0.03, 0, 1);
  }
  if (x !== null && y !== null) {
    creature.dir = Math.atan2(y - creature.y, x - creature.x);
  }
  if (creature._lastWorld) {
    creature.logEvent('Poked', creature._lastWorld.t, { source: 'player' });
  }
  creature._lastWorld?.creatureEcosystem?.registerEvent?.(creature, 'poke', { intensity });
}

export function reactToGrab(creature, { x = null, y = null } = {}) {
  const intensity = clamp(0.3 + creature.personality.playfulness * 0.5 + creature.personality.reactivity * 0.3, 0.25, 1.2);
  creature._triggerReaction('grab', intensity, 0.4);
  creature.setMood('😮', 0.6);
  if (creature.emotions) {
    creature.emotions.curiosity = clamp(creature.emotions.curiosity + 0.06, 0, 1);
    creature.emotions.stress = clamp(creature.emotions.stress + 0.04, 0, 1);
  }
  if (x !== null && y !== null) {
    creature.dir = Math.atan2(y - creature.y, x - creature.x);
  }
}

export function reactToDrop(creature, { x = null, y = null } = {}) {
  const intensity = clamp(0.3 + creature.personality.playfulness * 0.7, 0.25, 1.2);
  creature._triggerReaction('drop', intensity, 0.45);
  creature.setMood('😄', 0.7);
  if (creature.emotions) {
    creature.emotions.curiosity = clamp(creature.emotions.curiosity + 0.12, 0, 1);
  }
  if (x !== null && y !== null) {
    creature.dir = Math.atan2(y - creature.y, x - creature.x);
  }
}

export function reactToCollision(creature, amount = 0.5, { skipDamage = false } = {}) {
  const worldTime = creature._lastWorld?.t ?? 0;
  if (worldTime - creature._lastCollisionReactAt < 0.33) return;
  creature._lastCollisionReactAt = worldTime;
  const intensity = clamp(0.25 + amount * 0.08 + creature.personality.reactivity * 0.25, 0.2, 1.2);
  creature._triggerReaction('collision', intensity, 0.25);
  if (creature.emotions) {
    creature.emotions.fear = clamp(creature.emotions.fear + 0.08, 0, 1);
    creature.emotions.stress = clamp(creature.emotions.stress + 0.05, 0, 1);
  }
  if (amount > 0.8 && creature._lastWorld?.audio?.playCreatureSound) {
    creature._lastWorld.audio.playCreatureSound(creature, 'impact');
  }
  if (amount > 0.7 && creature._lastWorld?.particles?.addImpactRing) {
    creature._lastWorld.particles.addImpactRing(creature.x, creature.y, { color: 'rgba(248, 250, 252, 1)', size: 10 });
  }
  if (amount > 0.9 && creature._lastWorld?.particles?.triggerShake) {
    creature._lastWorld.particles.triggerShake(2.5);
  }

  if (!skipDamage) {
    const damage = creature._calculateCollisionDamage(amount);
    if (damage > 0) {
      creature.applyImpactDamage(damage, { cause: 'collision', intensity: amount });
    }
  }
}
