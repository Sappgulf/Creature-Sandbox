import { clamp, randn } from './utils.js';

export function makeGenes(seed={}) {
  // Reasonable starting ranges
  return {
    speed: seed.speed ?? 0.8,        // [0.2 .. 2.0]
    fov: seed.fov ?? 70,             // degrees [20 .. 160]
    sense: seed.sense ?? 90,         // smell radius in px [20 .. 200]
    metabolism: seed.metabolism ?? 1, // base burn [0.4 .. 2.0]
    hue: seed.hue ?? Math.floor(Math.random()*360),
    predator: seed.predator ?? 0,     // 0 herbivore, 1 predator
    packInstinct: seed.packInstinct ?? (seed.predator ? 0.55 : 0), // pack hunting bias [0 .. 1]
    ambushDelay: seed.ambushDelay ?? (seed.predator ? 0.6 : 0.15), // seconds to wait before sprint [0 .. 5]
    aggression: seed.aggression ?? (seed.predator ? 1.15 : 0.85),  // chase intensity [0.4 .. 2.2]
    spines: seed.spines ?? (seed.predator ? 0.06 : 0.35 + Math.random()*0.2), // herbivore retaliation [0 .. 1]
    herdInstinct: seed.herdInstinct ?? (seed.predator ? 0.12 : 0.45 + Math.random()*0.25), // herd buff strength [0 .. 1]
    panicPheromone: seed.panicPheromone ?? (seed.predator ? 0.08 : 0.5 + Math.random()*0.3), // panic trail strength [0 .. 1]
    grit: seed.grit ?? (seed.predator ? 0.45 + Math.random()*0.35 : 0.1) // bleed resistance [0 .. 1]
  };
}

export function mutateGenes(genes, amt=0.06) {
  const g = { ...genes };
  g.speed       = clamp(g.speed + randn(0, amt), 0.2, 2.0);
  g.fov         = clamp(g.fov + randn(0, amt*100), 20, 160);
  g.sense       = clamp(g.sense + randn(0, amt*150), 20, 200);
  g.metabolism  = clamp(g.metabolism + randn(0, amt), 0.4, 2.0);
  g.hue         = (g.hue + Math.floor(randn(0, amt*180))) % 360;
  // keep predator bit stable with small probability of flip
  if (Math.random() < 0.01) g.predator = g.predator ? 0 : 1;
  g.packInstinct = clamp(g.packInstinct + randn(0, amt*1.6), 0, 1);
  g.ambushDelay = clamp(g.ambushDelay + randn(0, amt*2.8), 0, 5);
  g.aggression = clamp(g.aggression + randn(0, amt*2.1), 0.4, 2.2);
  g.spines = clamp(g.spines + randn(0, amt*1.4), 0, 1);
  g.herdInstinct = clamp(g.herdInstinct + randn(0, amt*1.3), 0, 1);
  g.panicPheromone = clamp(g.panicPheromone + randn(0, amt*1.5), 0, 1);
  g.grit = clamp(g.grit + randn(0, amt*1.2), 0, 1);
  if (!g.predator) {
    // Herbivores slowly lose predator-specific traits
    g.packInstinct = Math.max(0, g.packInstinct - 0.08);
    g.ambushDelay = Math.max(0, g.ambushDelay - 0.12);
    g.aggression = clamp(g.aggression, 0.4, 1.2);
    g.grit = Math.max(0, g.grit - 0.08);
  }
  if (g.predator) {
    // Predators do not retain strong herbivore defenses
    g.spines = Math.max(0, g.spines - 0.12);
    g.herdInstinct = Math.max(0, g.herdInstinct - 0.18);
    g.panicPheromone = Math.max(0, g.panicPheromone - 0.22);
  }
  return g;
}
