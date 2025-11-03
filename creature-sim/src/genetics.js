import { clamp, randn } from './utils.js';

export function makeGenes(seed={}) {
  // Reasonable starting ranges
  return {
    speed: seed.speed ?? 0.8,        // [0.2 .. 2.0]
    fov: seed.fov ?? 70,             // degrees [20 .. 160]
    sense: seed.sense ?? 90,         // smell radius in px [20 .. 200]
    metabolism: seed.metabolism ?? 1, // base burn [0.4 .. 2.0]
    hue: seed.hue ?? Math.floor(Math.random()*360),
    predator: seed.predator ?? 0     // 0 herbivore, 1 predator
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
  return g;
}
