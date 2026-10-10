import { clamp } from './utils.js';
import { geneValue, isPredatorFromGenes } from './creature-genetics-helpers.js';

/** Ecosystem health configuration constants */
const ECOSYSTEM_CONFIG = {
  /** Maximum history samples to retain */
  MAX_HISTORY: 100,
  /** Update interval in seconds */
  UPDATE_INTERVAL: 1.0,
  /** Optimal population range */
  POPULATION: {
    MIN_OPTIMAL: 50,
    MAX_OPTIMAL: 200,
    OVERPOPULATION_PENALTY_RATE: 10 // Points lost per 10 creatures over max
  },
  /** Target ratios for ecosystem balance */
  TARGETS: {
    FOOD_PER_CREATURE: 3,
    PREDATOR_RATIO: 0.15,
    AVERAGE_ENERGY: 40
  },
  /** Metric weights for overall score */
  WEIGHTS: {
    BIODIVERSITY: 0.3,
    STABILITY: 0.4,
    SUSTAINABILITY: 0.3
  }
};

export class EcosystemHealth {
  constructor() {
    this.visible = false;
    this.metrics = {
      biodiversity: 0,
      stability: 0,
      sustainability: 0,
      overall: 0
    };
    this.history = {
      biodiversity: [],
      stability: [],
      sustainability: [],
      overall: []
    };
    this.maxHistory = ECOSYSTEM_CONFIG.MAX_HISTORY;
    this.lastUpdateTime = 0;
    this.updateInterval = ECOSYSTEM_CONFIG.UPDATE_INTERVAL;
  }

  update(world, dt = 0.016) {
    // Handle missing dt (default to ~60fps)
    this.lastUpdateTime += dt;
    if (this.lastUpdateTime < this.updateInterval) return;
    this.lastUpdateTime = 0;

    // Calculate biodiversity (genetic variance)
    const biodiversity = this.calculateBiodiversity(world);

    // Calculate stability (population consistency, food balance)
    const stability = this.calculateStability(world);

    // Calculate sustainability (birth/death ratio, resource usage)
    const sustainability = this.calculateSustainability(world);

    // Overall health is weighted average
    const { BIODIVERSITY, STABILITY, SUSTAINABILITY } = ECOSYSTEM_CONFIG.WEIGHTS;
    const overall = biodiversity * BIODIVERSITY + stability * STABILITY + sustainability * SUSTAINABILITY;

    this.metrics = { biodiversity, stability, sustainability, overall };

    // Store history
    this.history.biodiversity.push(biodiversity);
    this.history.stability.push(stability);
    this.history.sustainability.push(sustainability);
    this.history.overall.push(overall);

    // Trim history
    if (this.history.biodiversity.length > this.maxHistory) {
      this.history.biodiversity.shift();
      this.history.stability.shift();
      this.history.sustainability.shift();
      this.history.overall.shift();
    }
  }

  calculateBiodiversity(world) {
    if (world.creatures.length < 2) return 0;

    // Calculate genetic variance across population
    const speeds = [];
    const senses = [];
    const metabolisms = [];
    const diets = [];

    for (const c of world.creatures) {
      speeds.push(geneValue(c.genes, 'speed', 0));
      senses.push(geneValue(c.genes, 'sense', 0));
      metabolisms.push(geneValue(c.genes, 'metabolism', 0));
      diets.push(geneValue(c.genes, 'diet', c.genes?.predator ? 1 : 0));
    }

    const speedVar = this.variance(speeds);
    const senseVar = this.variance(senses);
    const metabVar = this.variance(metabolisms);
    const dietVar = this.variance(diets);

    // Normalize variances (higher variance = more biodiversity)
    const avgVariance = (speedVar + senseVar + metabVar + dietVar * 10) / 4;

    // Score 0-100
    return clamp(avgVariance * 50, 0, 100);
  }

  calculateStability(world) {
    // Population balance (not too few, not too many)
    const popScore = this.scorePopulation(world.creatures.length);

    // Food availability (enough food per creature)
    const foodPerCreature = world.creatures.length > 0 ? world.food.length / world.creatures.length : 0;
    const foodScore = clamp((foodPerCreature / ECOSYSTEM_CONFIG.TARGETS.FOOD_PER_CREATURE) * 100, 0, 100);

    // Predator/prey balance
    let predators = 0;
    for (const c of world.creatures) {
      if (isPredatorFromGenes(c.genes)) predators++;
    }
    const predatorRatio = world.creatures.length > 0 ? predators / world.creatures.length : 0;
    const balanceScore = (1 - Math.abs(predatorRatio - ECOSYSTEM_CONFIG.TARGETS.PREDATOR_RATIO)) * 100;

    return popScore * 0.4 + foodScore * 0.3 + balanceScore * 0.3;
  }

  calculateSustainability(world) {
    // Use ecoStats for birth/death tracking
    const stats = world.ecoStats || {};

    // Birth/death ratio over last period
    const recentBirths = stats.birthsRecent || 0;
    const recentDeaths = stats.deathsRecent || 0;

    let birthDeathScore = 50;
    if (recentDeaths > 0) {
      const ratio = recentBirths / recentDeaths;
      birthDeathScore = clamp(ratio * 50, 0, 100);
    } else if (recentBirths > 0) {
      birthDeathScore = 100; // Growing population, no deaths
    }

    // Average health of population
    let totalHealth = 0;
    let totalMaxHealth = 0;
    for (const c of world.creatures) {
      totalHealth += c.health;
      totalMaxHealth += c.maxHealth;
    }
    const healthScore = totalMaxHealth > 0 ? (totalHealth / totalMaxHealth) * 100 : 0;

    // Average energy
    let totalEnergy = 0;
    for (const c of world.creatures) {
      totalEnergy += c.energy;
    }
    const avgEnergy = world.creatures.length > 0 ? totalEnergy / world.creatures.length : 0;
    const energyScore = clamp((avgEnergy / ECOSYSTEM_CONFIG.TARGETS.AVERAGE_ENERGY) * 100, 0, 100);

    return birthDeathScore * 0.4 + healthScore * 0.3 + energyScore * 0.3;
  }

  scorePopulation(count) {
    const { MIN_OPTIMAL, MAX_OPTIMAL, OVERPOPULATION_PENALTY_RATE } = ECOSYSTEM_CONFIG.POPULATION;
    if (count === 0) return 0;
    if (count >= MIN_OPTIMAL && count <= MAX_OPTIMAL) return 100;
    if (count < MIN_OPTIMAL) return (count / MIN_OPTIMAL) * 100;
    if (count > MAX_OPTIMAL) return Math.max(0, 100 - (count - MAX_OPTIMAL) / OVERPOPULATION_PENALTY_RATE);
    return 50;
  }

  variance(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
  }

  getHealthStatus() {
    const score = this.metrics.overall;
    // Field-journal instrument colors + in-app icon-sprite glyph ids instead of
    // emoji, so the status reads the same on every platform.
    if (score >= 80) return { label: 'Excellent', color: '#a8df91', symbol: 'i-discoveries' };
    if (score >= 60) return { label: 'Good', color: '#80d8c4', symbol: 'i-health' };
    if (score >= 40) return { label: 'Fair', color: '#f1c86c', symbol: 'i-insights' };
    if (score >= 20) return { label: 'Poor', color: '#ef917b', symbol: 'i-threat' };
    return { label: 'Critical', color: '#ef917b', symbol: 'i-help' };
  }

  getRecommendations(world) {
    const recommendations = [];

    if (this.metrics.biodiversity < 30) {
      recommendations.push('Low genetic diversity — introduce new creatures with different traits');
    }

    if (this.metrics.stability < 40) {
      const foodPerCreature = world.creatures.length > 0 ? world.food.length / world.creatures.length : 0;
      if (foodPerCreature < 2) {
        recommendations.push('Food scarcity — paint more food near the largest cluster');
      }

      let predators = 0;
      for (const c of world.creatures) {
        if (isPredatorFromGenes(c.genes)) predators++;
      }
      const predatorRatio = world.creatures.length > 0 ? predators / world.creatures.length : 0;
      if (predatorRatio > 0.3) {
        recommendations.push('Too many predators — the herd is under pressure');
      } else if (predatorRatio < 0.05 && world.creatures.length > 20) {
        recommendations.push('No predators — grazers have nothing to outrun');
      }
    }

    if (this.metrics.sustainability < 40) {
      recommendations.push('Low sustainability — creatures are burning energy faster than the field supplies it');
    }

    if (world.creatures.length < 10) {
      recommendations.push('Sparse population — spawn a few more creatures');
    } else if (world.creatures.length > 300) {
      recommendations.push('Overpopulation — may cause performance issues');
    }

    if (recommendations.length === 0) {
      recommendations.push('The field is healthy — keep observing');
    }

    return recommendations;
  }

  toggle() {
    this.visible = !this.visible;
  }

  show() {
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }
}
