export class AnalyticsTracker {
  constructor({ maxSamples = 600, sampleInterval = 0.5 } = {}) {
    this.samples = [];
    this.maxSamples = maxSamples;
    this.sampleInterval = sampleInterval;
    this._accum = 0;
    this.version = 0;
    this._cachedData = null; // Cache getData() results
  }

  update(world, dt) {
    this._accum += dt;
    if (this._accum >= this.sampleInterval) {
      this._accum = 0;
      this.capture(world);
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

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.version += 1;
    this._cachedData = null; // Invalidate cache
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

  snapshot(extra={}) {
    return {
      generatedAt: new Date().toISOString(),
      sampleInterval: this.sampleInterval,
      samples: this.samples.slice(),
      ...extra
    };
  }
}
