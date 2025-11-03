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
    const { selectedId=null, pinnedId=null, lineageRootId=null } = opts;
    const camera = this.camera;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(opts.viewportWidth/2, opts.viewportHeight/2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Draw biomes
    this.drawBiomes(world);
    
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
    
    this.drawCreatures(world.creatures, { selectedId, pinnedId, lineageSet });

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
    
    // Compute clusters if clustering is enabled
    let clusterMap = null;
    if (this.enableClustering) {
      if (this._clusterCache.frame !== Math.floor(opts.worldTime || 0)) {
        this._clusterCache.clusters = this._computeClusters(creatures);
        this._clusterCache.frame = Math.floor(opts.worldTime || 0);
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
      
      c.draw(ctx, {
        isSelected,
        isPinned,
        inLineage,
        showTrail: this.enableTrails,
        showVision: this.enableVision,
        clusterHue
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
