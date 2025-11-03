export class AnalyticsTracker {
  constructor({ maxSamples = 600, sampleInterval = 0.5 } = {}) {
    this.samples = [];
    this.maxSamples = maxSamples;
    this.sampleInterval = sampleInterval;
    this._accum = 0;
    this.version = 0;
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

    for (const c of world.creatures) {
      if (c.genes.predator) pred++; else herb++;
      sumSpeed += c.genes.speed;
      sumSpeed2 += c.genes.speed * c.genes.speed;
      sumMetabolism += c.genes.metabolism;
      sumMetabolism2 += c.genes.metabolism * c.genes.metabolism;
      sumSense += c.genes.sense;
      sumSense2 += c.genes.sense * c.genes.sense;
      sumEnergy += c.energy;
    }

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
      meanEnergy: pop ? sumEnergy / pop : 0
    };

    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.version += 1;
  }

  getData() {
    const times = this.samples.map(s => s.t);
    return {
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
      predatorRatio: this.samples.map(s => s.pop ? s.pred / s.pop : 0)
    };
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
