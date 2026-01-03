export class AnalyticsTracker {
  constructor({ maxSamples = 600, sampleInterval = 0.5, useWorker = true } = {}) {
    this.samples = [];
    this.maxSamples = maxSamples;
    this.sampleInterval = sampleInterval;
    this._accum = 0;
    this.version = 0;
    this._cachedData = null; // Cache getData() results
    this.useWorker = useWorker;
    this.worker = null;
    this._workerPending = false;
    this._workerQueued = null;
    
    // Advanced analytics
    this.geneHistory = []; // Track gene frequency over time
    this.speciesGroups = []; // Detected species clusters
    this.phylogenyData = null; // Phylogenetic tree structure
    this._geneHistoryInterval = 2.0; // Sample genes every 2 seconds
    this._geneHistoryAccum = 0;

    this._initializeWorker();
  }

  _initializeWorker() {
    if (!this.useWorker || typeof Worker === 'undefined') return;

    try {
      this.worker = new Worker(new URL('./analytics-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event) => {
        this._workerPending = false;
        if (event?.data) {
          this._applySample(event.data);
        }

        if (this._workerQueued) {
          const next = this._workerQueued;
          this._workerQueued = null;
          this._workerPending = true;
          this.worker.postMessage(next);
        }
      };
      this.worker.onerror = (err) => {
        console.warn('Analytics worker error, falling back to main thread.', err);
        this._disableWorker();
      };
    } catch (err) {
      console.warn('Analytics worker unavailable, falling back to main thread.', err);
      this._disableWorker();
    }
  }

  _disableWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = null;
    this._workerPending = false;
    this._workerQueued = null;
  }

  update(world, dt) {
    this._accum += dt;
    if (this._accum >= this.sampleInterval) {
      this._accum = 0;
      if (this.worker) {
        this._queueWorkerSample(world);
      } else {
        this.capture(world);
      }
    }
    
    // Sample gene frequencies less frequently
    this._geneHistoryAccum += dt;
    if (this._geneHistoryAccum >= this._geneHistoryInterval) {
      this._geneHistoryAccum = 0;
      this.captureGeneFrequencies(world);
      this.detectSpecies(world);
    }
  }

  capture(world) {
    const pop = world.creatures.length;
    let herb = 0, pred = 0;
    let sumSpeed = 0, sumSpeed2 = 0;
    let sumMetabolism = 0, sumMetabolism2 = 0;
    let sumSense = 0, sumSense2 = 0;
    let sumEnergy = 0;
    let sumHealth = 0, sumMaxHealth = 0;
    let sumPackInstinct = 0;
    let sumAggression = 0;
    let sumAmbushDelay = 0;

    for (const c of world.creatures) {
      if (c.genes.predator) {
        pred++;
        sumPackInstinct += c.genes.packInstinct ?? 0;
        sumAggression += c.genes.aggression ?? 0;
        sumAmbushDelay += c.genes.ambushDelay ?? 0;
      } else {
        herb++;
      }
      sumSpeed += c.genes.speed;
      sumSpeed2 += c.genes.speed * c.genes.speed;
      sumMetabolism += c.genes.metabolism;
      sumMetabolism2 += c.genes.metabolism * c.genes.metabolism;
      sumSense += c.genes.sense;
      sumSense2 += c.genes.sense * c.genes.sense;
      sumEnergy += c.energy;
      sumHealth += c.health ?? 0;
      sumMaxHealth += c.maxHealth ?? c.health ?? 0;
    }

    const meanHealthRatio = sumMaxHealth ? sumHealth / sumMaxHealth : 0;
    const sample = {
      t: world.t,
      pop,
      herb,
      pred,
      food: world.food.length,
      meanSpeed: pop ? sumSpeed / pop : 0,
      speedVar: pop ? (sumSpeed2 / pop) - Math.pow(sumSpeed / pop, 2) : 0,
      meanMetabolism: pop ? sumMetabolism / pop : 0,
      metabolismVar: pop ? (sumMetabolism2 / pop) - Math.pow(sumMetabolism / pop, 2) : 0,
      meanSense: pop ? sumSense / pop : 0,
      senseVar: pop ? (sumSense2 / pop) - Math.pow(sumSense / pop, 2) : 0,
      meanEnergy: pop ? sumEnergy / pop : 0,
      meanHealth: meanHealthRatio,
      meanMaxHealth: pop ? sumMaxHealth / pop : 0,
      meanPackInstinct: pred ? sumPackInstinct / pred : 0,
      meanAggression: pred ? sumAggression / pred : 0,
      meanAmbushDelay: pred ? sumAmbushDelay / pred : 0
    };

    this._applySample(sample);
  }

  _applySample(sample) {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.version += 1;
    this._cachedData = null; // Invalidate cache
  }

  _queueWorkerSample(world) {
    const payload = {
      t: world.t,
      foodCount: world.food.length,
      creatures: world.creatures.map(c => ({
        predator: !!c.genes.predator,
        speed: c.genes.speed ?? 0,
        metabolism: c.genes.metabolism ?? 0,
        sense: c.genes.sense ?? 0,
        energy: c.energy ?? 0,
        health: c.health ?? 0,
        maxHealth: c.maxHealth ?? c.health ?? 0,
        packInstinct: c.genes.packInstinct ?? 0,
        aggression: c.genes.aggression ?? 0,
        ambushDelay: c.genes.ambushDelay ?? 0
      }))
    };

    if (this._workerPending) {
      this._workerQueued = payload;
      return;
    }

    this._workerPending = true;
    this.worker.postMessage(payload);
  }

  getData() {
    // Cache the result to avoid recreating arrays when version hasn't changed
    if (this._cachedData && this._cachedData.version === this.version) {
      return this._cachedData;
    }
    
    const times = this.samples.map(s => s.t);
    this._cachedData = {
      version: this.version,
      time: times,
      population: this.samples.map(s => s.pop),
      herbivores: this.samples.map(s => s.herb),
      predators: this.samples.map(s => s.pred),
      meanSpeed: this.samples.map(s => s.meanSpeed),
      speedVar: this.samples.map(s => s.speedVar),
      meanMetabolism: this.samples.map(s => s.meanMetabolism),
      metabolismVar: this.samples.map(s => s.metabolismVar),
      meanSense: this.samples.map(s => s.meanSense),
      senseVar: this.samples.map(s => s.senseVar),
      food: this.samples.map(s => s.food),
      predatorRatio: this.samples.map(s => s.pop ? s.pred / s.pop : 0),
      meanHealth: this.samples.map(s => s.meanHealth ?? 0),
      meanMaxHealth: this.samples.map(s => s.meanMaxHealth ?? 0),
      meanPackInstinct: this.samples.map(s => s.meanPackInstinct ?? 0),
      meanAggression: this.samples.map(s => s.meanAggression ?? 0),
      meanAmbushDelay: this.samples.map(s => s.meanAmbushDelay ?? 0)
    };
    return this._cachedData;
  }

  captureGeneFrequencies(world) {
    if (world.creatures.length === 0) return;
    
    const genes = {
      t: world.t,
      speed: [],
      sense: [],
      metabolism: [],
      hue: [],
      diet: [],
      nocturnal: []
    };
    
    for (const c of world.creatures) {
      genes.speed.push(c.genes.speed);
      genes.sense.push(c.genes.sense);
      genes.metabolism.push(c.genes.metabolism);
      genes.hue.push(c.genes.hue);
      genes.diet.push(c.genes.diet || (c.genes.predator ? 1 : 0));
      genes.nocturnal.push(c.genes.nocturnal || 0.5);
    }
    
    // Calculate statistics for each gene
    const stats = {};
    for (const [key, values] of Object.entries(genes)) {
      if (key === 't') {
        stats.t = values;
        continue;
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      stats[key] = { mean, variance, min, max, stdDev: Math.sqrt(variance) };
    }
    
    this.geneHistory.push(stats);
    if (this.geneHistory.length > 300) this.geneHistory.shift(); // Keep last 10 minutes at 2s interval
    this.version += 1;
    this._cachedData = null;
  }
  
  detectSpecies(world) {
    // Simple species detection using genetic clustering
    // Species are groups of creatures with similar genes
    
    if (world.creatures.length < 2) {
      this.speciesGroups = [];
      return;
    }
    
    const threshold = 0.3; // Genetic distance threshold for same species
    const groups = [];
    const assigned = new Set();
    
    for (let i = 0; i < world.creatures.length; i++) {
      if (assigned.has(i)) continue;
      
      const group = [i];
      assigned.add(i);
      
      for (let j = i + 1; j < world.creatures.length; j++) {
        if (assigned.has(j)) continue;
        
        const dist = this._geneticDistance(
          world.creatures[i].genes,
          world.creatures[j].genes
        );
        
        if (dist < threshold) {
          group.push(j);
          assigned.add(j);
        }
      }
      
      groups.push({
        size: group.length,
        avgGenes: this._averageGenes(group.map(idx => world.creatures[idx].genes)),
        members: group.length
      });
    }
    
    this.speciesGroups = groups.sort((a, b) => b.size - a.size);
  }
  
  _geneticDistance(g1, g2) {
    // Euclidean distance in normalized gene space
    const speedDiff = (g1.speed - g2.speed) / 2.0;
    const senseDiff = (g1.sense - g2.sense) / 200.0;
    const metabDiff = (g1.metabolism - g2.metabolism) / 2.0;
    const hueDiff = Math.min(Math.abs(g1.hue - g2.hue), 360 - Math.abs(g1.hue - g2.hue)) / 360.0;
    const dietDiff = Math.abs((g1.diet || 0) - (g2.diet || 0));
    
    return Math.sqrt(
      speedDiff * speedDiff +
      senseDiff * senseDiff +
      metabDiff * metabDiff +
      hueDiff * hueDiff +
      dietDiff * dietDiff
    );
  }
  
  _averageGenes(genesList) {
    if (genesList.length === 0) return {};
    
    const avg = {
      speed: 0,
      sense: 0,
      metabolism: 0,
      hue: 0,
      diet: 0
    };
    
    for (const g of genesList) {
      avg.speed += g.speed;
      avg.sense += g.sense;
      avg.metabolism += g.metabolism;
      avg.hue += g.hue;
      avg.diet += (g.diet || 0);
    }
    
    const n = genesList.length;
    avg.speed /= n;
    avg.sense /= n;
    avg.metabolism /= n;
    avg.hue /= n;
    avg.diet /= n;
    
    return avg;
  }
  
  buildPhylogeny(world) {
    // Build a simplified phylogenetic tree from lineage data
    // Returns root nodes (common ancestors)
    
    if (!world.lineageTracker) {
      this.phylogenyData = null;
      return null;
    }
    
    // OPTIMIZATION: Initialize cache if needed
    if (!this._phylogenyCache) {
      this._phylogenyCache = new Map(); // rootId -> { data, version }
    }
    
    // OPTIMIZATION: Use a more stable cache key - only invalidate when population changes significantly
    // Check if population changed by more than 5% or if more than 5 seconds passed
    const populationChanged = !this._lastPopulation || 
      Math.abs(this._lastPopulation - world.creatures.length) > Math.max(5, this._lastPopulation * 0.05);
    
    const timeChanged = !this._lastPhylogenyTime || 
      (world.t - this._lastPhylogenyTime) > 5.0; // 5 seconds
    
    if (!populationChanged && !timeChanged && this.phylogenyData) {
      return this.phylogenyData; // Return cached result - no need to recompute
    }
    
    // Update cache keys
    this._lastPopulation = world.creatures.length;
    this._lastPhylogenyTime = world.t;
    
    const roots = [];
    const processed = new Set();
    const rootCounts = new Map(); // rootId -> count of creatures
    
    // OPTIMIZATION: First pass - just count creatures per root (fast)
    for (let i = 0; i < world.creatures.length; i++) {
      const creature = world.creatures[i];
      const rootId = world.lineageTracker.getRoot(world, creature.id); // Already cached!
      if (!rootCounts.has(rootId)) {
        rootCounts.set(rootId, { count: 0, alive: 0 });
      }
      const counts = rootCounts.get(rootId);
      counts.count++;
      if (creature.alive) counts.alive++;
      processed.add(rootId);
    }
    
    // OPTIMIZATION: Only build lineage overviews for top roots (biggest families)
    // Sort roots by size and only process top 5-10
    const sortedRoots = Array.from(rootCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8); // Top 8 lineages only
    
    // OPTIMIZATION: Build lineage overviews with caching
    for (const [rootId, counts] of sortedRoots) {
      // Check cache first
      let lineage = this._phylogenyCache.get(rootId);
      if (!lineage || lineage.version !== counts.count) {
        // Only build full overview if not cached or counts changed
        lineage = world.buildLineageOverview(rootId, 4); // Limit depth to 4 instead of 6
        if (lineage) {
          this._phylogenyCache.set(rootId, { ...lineage, version: counts.count });
        }
      }
      
      if (lineage) {
        roots.push({
          rootId,
          name: world.lineageTracker.names.get(rootId) || `#${rootId}`,
          alive: counts.alive,
          total: counts.count,
          depth: lineage.levels ? lineage.levels.length : 1
        });
      }
    }
    
    // Sort by total
    roots.sort((a, b) => b.total - a.total);
    this.phylogenyData = roots;
    
    return this.phylogenyData;
  }

  snapshot(extra={}) {
    return {
      generatedAt: new Date().toISOString(),
      sampleInterval: this.sampleInterval,
      samples: this.samples.slice(),
      geneHistory: this.geneHistory.slice(),
      speciesGroups: this.speciesGroups.slice(),
      phylogeny: this.phylogenyData,
      ...extra
    };
  }
  
  // Export data as CSV
  exportAsCSV() {
    const data = this.getData();
    let csv = 'Time,Population,Herbivores,Predators,Food,MeanSpeed,MeanMetabolism,MeanSense,PredatorRatio\n';
    
    for (let i = 0; i < data.time.length; i++) {
      csv += `${data.time[i].toFixed(2)},${data.population[i]},${data.herbivores[i]},${data.predators[i]},${data.food[i]},${data.meanSpeed[i].toFixed(3)},${data.meanMetabolism[i].toFixed(3)},${data.meanSense[i].toFixed(3)},${data.predatorRatio[i].toFixed(3)}\n`;
    }
    
    return csv;
  }
  
  // Export gene history as CSV
  exportGeneHistoryCSV() {
    if (this.geneHistory.length === 0) return 'No gene history data';
    
    let csv = 'Time,Speed_Mean,Speed_Var,Sense_Mean,Sense_Var,Metabolism_Mean,Metabolism_Var,Diet_Mean,Diet_Var,Nocturnal_Mean,Nocturnal_Var\n';
    
    for (const sample of this.geneHistory) {
      csv += `${sample.t.toFixed(2)},${sample.speed.mean.toFixed(3)},${sample.speed.variance.toFixed(4)},${sample.sense.mean.toFixed(3)},${sample.sense.variance.toFixed(4)},${sample.metabolism.mean.toFixed(3)},${sample.metabolism.variance.toFixed(4)},${sample.diet.mean.toFixed(3)},${sample.diet.variance.toFixed(4)},${sample.nocturnal.mean.toFixed(3)},${sample.nocturnal.variance.toFixed(4)}\n`;
    }
    
    return csv;
  }
}
