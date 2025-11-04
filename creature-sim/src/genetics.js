import { clamp, randn } from './utils.js';

export function makeGenes(seed={}) {
  // Reasonable starting ranges
  const predator = seed.predator ?? 0;
  const diet = seed.diet ?? (predator ? 1.0 : 0.0); // NEW: 0=herbivore, 0.5=omnivore, 1.0=carnivore
  
  return {
    speed: seed.speed ?? 0.8,        // [0.2 .. 2.0]
    fov: seed.fov ?? 70,             // degrees [20 .. 160]
    sense: seed.sense ?? 90,         // smell radius in px [20 .. 200]
    metabolism: seed.metabolism ?? 1, // base burn [0.4 .. 2.0]
    hue: seed.hue ?? Math.floor(Math.random()*360),
    predator: predator,              // LEGACY: 0 herbivore, 1 predator
    diet: diet,                      // NEW: 0=herbivore, 0.5=omnivore/scavenger, 1.0=carnivore
    packInstinct: seed.packInstinct ?? (predator ? 0.55 : 0), // pack hunting bias [0 .. 1]
    ambushDelay: seed.ambushDelay ?? (predator ? 0.6 : 0.15), // seconds to wait before sprint [0 .. 5]
    aggression: seed.aggression ?? (predator ? 1.15 : 0.85),  // chase intensity [0.4 .. 2.2]
    spines: seed.spines ?? (predator ? 0.06 : 0.35 + Math.random()*0.2), // herbivore retaliation [0 .. 1]
    herdInstinct: seed.herdInstinct ?? (predator ? 0.12 : 0.45 + Math.random()*0.25), // herd buff strength [0 .. 1]
    panicPheromone: seed.panicPheromone ?? (predator ? 0.08 : 0.5 + Math.random()*0.3), // panic trail strength [0 .. 1]
    grit: seed.grit ?? (predator ? 0.45 + Math.random()*0.35 : 0.1), // bleed resistance [0 .. 1]
    nocturnal: seed.nocturnal ?? (Math.random() < 0.3 ? 0.5 + Math.random()*0.5 : Math.random() * 0.5) // day/night preference [0=diurnal .. 1=nocturnal]
  };
}

export function mutateGenes(genes, amt=0.06) {
  const g = { ...genes };
  
  // NEW: Lucky mutation (1% chance for beneficial boost!)
  const isLucky = Math.random() < 0.01;
  const luckyMultiplier = isLucky ? 1.5 : 1.0; // 50% boost if lucky
  
  if (isLucky) {
    g._luckyMutation = true; // Flag for visual effects/badges
    console.log('🍀 LUCKY MUTATION! Beneficial genes boosted by 50%');
  }
  
  g.speed       = clamp(g.speed + randn(0, amt * luckyMultiplier), 0.2, 2.0);
  g.fov         = clamp(g.fov + randn(0, amt*100 * luckyMultiplier), 20, 160);
  g.sense       = clamp(g.sense + randn(0, amt*150 * luckyMultiplier), 20, 200);
  g.metabolism  = clamp(g.metabolism + randn(0, amt * luckyMultiplier), 0.4, 2.0);
  g.hue         = (g.hue + Math.floor(randn(0, amt*180))) % 360;
  
  // Diet gene can mutate gradually (omnivores are adaptive!)
  g.diet = clamp((g.diet ?? g.predator) + randn(0, amt * 0.8), 0, 1);
  
  // Legacy: keep predator bit stable with small probability of flip
  if (Math.random() < 0.01) g.predator = g.predator ? 0 : 1;
  
  g.packInstinct = clamp(g.packInstinct + randn(0, amt*1.6), 0, 1);
  g.ambushDelay = clamp(g.ambushDelay + randn(0, amt*2.8), 0, 5);
  g.aggression = clamp(g.aggression + randn(0, amt*2.1), 0.4, 2.2);
  g.spines = clamp(g.spines + randn(0, amt*1.4), 0, 1);
  g.herdInstinct = clamp(g.herdInstinct + randn(0, amt*1.3), 0, 1);
  g.panicPheromone = clamp(g.panicPheromone + randn(0, amt*1.5), 0, 1);
  g.grit = clamp(g.grit + randn(0, amt*1.2), 0, 1);
  g.nocturnal = clamp((g.nocturnal ?? 0.5) + randn(0, amt*1.5), 0, 1);
  
  // Adapt traits based on diet type
  const isOmnivore = g.diet > 0.3 && g.diet < 0.7;
  
  if (g.diet < 0.3) {
    // Herbivores slowly lose predator-specific traits
    g.packInstinct = Math.max(0, g.packInstinct - 0.08);
    g.ambushDelay = Math.max(0, g.ambushDelay - 0.12);
    g.aggression = clamp(g.aggression, 0.4, 1.2);
    g.grit = Math.max(0, g.grit - 0.08);
  } else if (g.diet > 0.7) {
    // Carnivores do not retain strong herbivore defenses
    g.spines = Math.max(0, g.spines - 0.12);
    g.herdInstinct = Math.max(0, g.herdInstinct - 0.18);
    g.panicPheromone = Math.max(0, g.panicPheromone - 0.22);
  } else if (isOmnivore) {
    // Omnivores maintain balanced traits (no penalties)
    // They can adapt to both strategies!
  }
  
  // Keep legacy predator bit in sync with diet for backward compatibility
  if (g.diet > 0.7 && !g.predator) g.predator = 1;
  if (g.diet < 0.3 && g.predator) g.predator = 0;
  
  return g;
}
