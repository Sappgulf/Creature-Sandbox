import { clamp } from './utils.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    this.enableTrails = true;
    this.enableVision = false;
    this.enableClustering = false;
    this.enableTerritories = false; // Feature 1
    this.enableMemory = false; // Feature 2
    this.enableSocialBonds = false; // Feature 4
    this.enableMigration = false; // Feature 9
    this.background = '#0b0c10';
    // Cache lineage computation
    this._lineageCache = { rootId: null, set: null, frame: 0 };
    this._clusterCache = { clusters: null, frame: -1 };
  }

  clear(width, height) {
    this.ctx.save();
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0,0,width,height);
    this.ctx.restore();
  }

  drawWorld(world, opts={}) {
    const { selectedId=null, pinnedId=null, lineageRootId=null, worldTime=0 } = opts;
    const camera = this.camera;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(opts.viewportWidth/2, opts.viewportHeight/2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Draw biomes
    this.drawBiomes(world);
    
    // Feature 1: Draw territories
    if (this.enableTerritories) {
      this.drawTerritories(world);
    }
    
    this.drawFood(world.food);
    
    // Feature 2: Draw memory for selected creature
    if (this.enableMemory && selectedId) {
      const creature = world.getAnyCreatureById(selectedId);
      if (creature && creature.memory) {
        this.drawMemory(creature);
      }
    }
    
    // Feature 4: Draw social bonds
    if (this.enableSocialBonds) {
      this.drawSocialBonds(world);
    }
    
    // Feature 9: Draw migration arrows
    if (this.enableMigration) {
      this.drawMigration(world);
    }
    
    // Cache lineage descendants to avoid expensive BFS every frame
    let lineageSet = null;
    if (lineageRootId) {
      if (this._lineageCache.rootId === lineageRootId && this._lineageCache.frame === world.t) {
        lineageSet = this._lineageCache.set;
      } else {
        lineageSet = world.descendantsOf(lineageRootId);
        this._lineageCache = { rootId: lineageRootId, set: lineageSet, frame: world.t };
      }
    }
    
    this.drawCreatures(world.creatures, { selectedId, pinnedId, lineageSet, worldTime });

    ctx.restore();
  }

  drawBiomes(world) {
    if (!world.biomes) return;
    const ctx = this.ctx;
    for (const biome of world.biomes) {
      ctx.fillStyle = biome.color;
      ctx.fillRect(0, biome.y1, world.width, biome.y2 - biome.y1);
    }
  }

  drawFood(food) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(126,210,120,0.85)';
    for (let f of food) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  drawCreatures(creatures, opts) {
    const ctx = this.ctx;
    const { worldTime = 0 } = opts;
    
    // Compute clusters if clustering is enabled
    let clusterMap = null;
    if (this.enableClustering) {
      const currentFrame = Math.floor(worldTime);
      if (this._clusterCache.frame !== currentFrame) {
        this._clusterCache.clusters = this._computeClusters(creatures);
        this._clusterCache.frame = currentFrame;
      }
      clusterMap = this._clusterCache.clusters;
    }
    
    for (let c of creatures) {
      const inLineage = opts.lineageSet ? opts.lineageSet.has(c.id) : false;
      const isSelected = opts.selectedId === c.id;
      const isPinned = opts.pinnedId === c.id;
      const alpha = clamp(c.energy / 40, 0.25, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      
      // Override hue if clustering is enabled
      const clusterHue = clusterMap ? clusterMap.get(c.id) : null;
      
      // Apply clustering colors to ALL creatures (not just #1)
      const debugClusterHue = clusterHue;
      
      c.draw(ctx, {
        isSelected,
        isPinned,
        inLineage,
        showTrail: this.enableTrails,
        showVision: this.enableVision,
        clusterHue: debugClusterHue
      });
      ctx.restore();
    }
  }

  _computeClusters(creatures, k=5) {
    if (creatures.length < k) return new Map();
    
    // Simple k-means clustering on [speed, metabolism, sense, aggression]
    const features = creatures.map(c => [
      c.genes.speed / 2.0,
      c.genes.metabolism / 2.0,
      c.genes.sense / 200.0,
      (c.genes.aggression || 1.0) / 2.2
    ]);
    
    // Initialize centroids randomly
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * features.length);
      centroids.push([...features[idx]]);
    }
    
    // Run k-means for 3 iterations (fast, good enough)
    for (let iter = 0; iter < 3; iter++) {
      const assignments = features.map(f => {
        let minDist = Infinity;
        let cluster = 0;
        for (let i = 0; i < k; i++) {
          const dist = this._euclidean(f, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            cluster = i;
          }
        }
        return cluster;
      });
      
      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterPoints = features.filter((_, idx) => assignments[idx] === i);
        if (clusterPoints.length > 0) {
          centroids[i] = this._mean(clusterPoints);
        }
      }
    }
    
    // Final assignment with color mapping
    const clusterColors = [0, 60, 120, 180, 240, 300]; // Evenly spaced hues
    const clusterMap = new Map();
    features.forEach((f, idx) => {
      let minDist = Infinity;
      let cluster = 0;
      for (let i = 0; i < k; i++) {
        const dist = this._euclidean(f, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          cluster = i;
        }
      }
      const hue = clusterColors[cluster];
      clusterMap.set(creatures[idx].id, hue);
    });
    
    return clusterMap;
  }

  _euclidean(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
  }

  _mean(points) {
    const dims = points[0].length;
    const mean = new Array(dims).fill(0);
    for (const p of points) {
      for (let i = 0; i < dims; i++) {
        mean[i] += p[i];
      }
    }
    return mean.map(v => v / points.length);
  }

  // ============================================================================
  // FEATURE VISUALIZATIONS
  // ============================================================================
  
  drawTerritories(world) {
    const ctx = this.ctx;
    
    // Draw territory circles
    for (const [id, territory] of world.territories.entries()) {
      const owner = world.registry.get(id);
      if (!owner || !owner.alive) continue;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(territory.x, territory.y, territory.radius, 0, Math.PI * 2);
      
      // Color based on rank
      const hue = territory.dominanceRank === 1 ? 0 : (territory.dominanceRank <= 3 ? 30 : 50);
      const alpha = territory.dominanceRank === 1 ? 0.15 : 0.08;
      ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.4)`;
      ctx.lineWidth = territory.dominanceRank === 1 ? 2 : 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      
      // Draw rank indicator
      if (territory.dominanceRank <= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`#${territory.dominanceRank}`, territory.x - 8, territory.y + 6);
        ctx.restore();
      }
    }
    
    // Draw conflict zones
    for (const conflict of world.territoryConflicts) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(conflict.x, conflict.y, 20 * conflict.intensity, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 80, 80, ${conflict.intensity * 0.3})`;
      ctx.fill();
      ctx.restore();
    }
  }
  
  drawMemory(creature) {
    const ctx = this.ctx;
    
    for (const mem of creature.memory.locations) {
      ctx.save();
      const alpha = mem.strength * 0.6;
      let color;
      
      switch(mem.type) {
        case 'food':
          color = `rgba(100, 255, 100, ${alpha})`;
          break;
        case 'danger':
          color = `rgba(255, 100, 100, ${alpha})`;
          break;
        case 'safe':
          color = `rgba(100, 200, 255, ${alpha})`;
          break;
        default:
          color = `rgba(200, 200, 200, ${alpha})`;
      }
      
      ctx.beginPath();
      ctx.arc(mem.x, mem.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color.replace(String(alpha), String(alpha * 1.5));
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  
  drawSocialBonds(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.social || !creature.alive) continue;
      
      // Draw herding connections for herbivores
      if (!creature.genes.predator && creature.social.herdMates.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(150, 255, 150, 0.15)';
        ctx.lineWidth = 1;
        
        for (const mate of creature.social.herdMates.slice(0, 3)) {
          ctx.beginPath();
          ctx.moveTo(creature.x, creature.y);
          ctx.lineTo(mate.x, mate.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Draw pack connections for predators
      if (creature.genes.predator && creature.social.packTarget) {
        const target = world.getAnyCreatureById(creature.social.packTarget);
        if (target && target.alive) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 150, 150, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(creature.x, creature.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }
  }
  
  drawMigration(world) {
    const ctx = this.ctx;
    
    for (const creature of world.creatures) {
      if (!creature.migration || !creature.alive) continue;
      if (creature.migration.targetBiome === null || creature.migration.settled) continue;
      
      const targetBiome = world.biomes[creature.migration.targetBiome];
      const targetY = (targetBiome.y1 + targetBiome.y2) / 2;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 10]);
      
      ctx.beginPath();
      ctx.moveTo(creature.x, creature.y);
      ctx.lineTo(creature.x, targetY);
      ctx.stroke();
      
      // Draw arrow
      const dy = targetY - creature.y;
      const arrowDir = dy > 0 ? 1 : -1;
      ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
      ctx.beginPath();
      ctx.moveTo(creature.x, creature.y + arrowDir * 15);
      ctx.lineTo(creature.x - 5, creature.y + arrowDir * 10);
      ctx.lineTo(creature.x + 5, creature.y + arrowDir * 10);
      ctx.closePath();
      ctx.fill();
      
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}
