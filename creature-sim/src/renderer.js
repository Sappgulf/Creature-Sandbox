import { clamp } from './utils.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    this.enableTrails = true;
    this.enableVision = false;
    this.enableClustering = false;
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
    
    // DEBUG: Draw obvious visual indicators
    if (this.enableClustering) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('CLUSTERING ON', 50, 100);
      ctx.restore();
    }
    if (this.enableVision) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('VISION ON', 50, this.enableClustering ? 160 : 100);
      ctx.restore();
    }
    
    this.drawFood(world.food);
    
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
    
    // Debug: Log state once per second
    if (!this._lastDebugLog || worldTime - this._lastDebugLog > 60) {
      console.log(`%c[RENDERER STATE]`, 'color: #8b5cf6; font-weight: bold;', {
        enableVision: this.enableVision,
        enableClustering: this.enableClustering,
        enableTrails: this.enableTrails,
        selectedId: opts.selectedId,
        pinnedId: opts.pinnedId
      });
      this._lastDebugLog = worldTime;
    }
    
    // Compute clusters if clustering is enabled
    let clusterMap = null;
    if (this.enableClustering) {
      const currentFrame = Math.floor(worldTime);
      if (this._clusterCache.frame !== currentFrame) {
        this._clusterCache.clusters = this._computeClusters(creatures);
        this._clusterCache.frame = currentFrame;
        const sample = this._clusterCache.clusters.size > 0 ? 
          Array.from(this._clusterCache.clusters.entries()).slice(0, 3) : [];
        console.log(`%c[CLUSTERING DEBUG] Frame ${currentFrame}: Computed ${this._clusterCache.clusters.size} clusters from ${creatures.length} creatures. Sample:`, 'color: #f59e0b; font-weight: bold;', sample);
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
      
      // DEBUG: Force first creature to bright red if clustering enabled
      const debugClusterHue = this.enableClustering && c.id === 1 ? 0 : clusterHue;
      
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
      clusterMap.set(creatures[idx].id, clusterColors[cluster]);
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
}
