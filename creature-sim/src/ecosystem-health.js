import { clamp } from './utils.js';

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
    this.maxHistory = 100;
    this.lastUpdateTime = 0;
    this.updateInterval = 1.0; // Update every second
  }
  
  update(world, dt) {
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
    const overall = (biodiversity * 0.3 + stability * 0.4 + sustainability * 0.3);
    
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
      speeds.push(c.genes.speed);
      senses.push(c.genes.sense);
      metabolisms.push(c.genes.metabolism);
      diets.push(c.genes.diet ?? (c.genes.predator ? 1 : 0));
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
    const foodScore = clamp((foodPerCreature / 3) * 100, 0, 100); // Target: 3 food per creature
    
    // Predator/prey balance
    let predators = 0;
    for (const c of world.creatures) {
      const diet = c.genes.diet ?? (c.genes.predator ? 1 : 0);
      if (diet > 0.7) predators++;
    }
    const predatorRatio = world.creatures.length > 0 ? predators / world.creatures.length : 0;
    const balanceScore = (1 - Math.abs(predatorRatio - 0.15)) * 100; // Target: 15% predators
    
    return (popScore * 0.4 + foodScore * 0.3 + balanceScore * 0.3);
  }
  
  calculateSustainability(world) {
    // Use ecoStats for birth/death tracking
    const stats = world.ecoStats;
    
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
    const energyScore = clamp((avgEnergy / 40) * 100, 0, 100); // Target: 40 energy
    
    return (birthDeathScore * 0.4 + healthScore * 0.3 + energyScore * 0.3);
  }
  
  scorePopulation(count) {
    // Optimal range: 50-200 creatures
    if (count === 0) return 0;
    if (count >= 50 && count <= 200) return 100;
    if (count < 50) return (count / 50) * 100;
    if (count > 200) return Math.max(0, 100 - ((count - 200) / 10));
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
    if (score >= 80) return { label: 'Excellent', color: '#4ade80', emoji: '🌟' };
    if (score >= 60) return { label: 'Good', color: '#7bb7ff', emoji: '✨' };
    if (score >= 40) return { label: 'Fair', color: '#ffc800', emoji: '⚠️' };
    if (score >= 20) return { label: 'Poor', color: '#ff8800', emoji: '🔥' };
    return { label: 'Critical', color: '#ff0000', emoji: '💀' };
  }
  
  getRecommendations(world) {
    const recommendations = [];
    
    if (this.metrics.biodiversity < 30) {
      recommendations.push('🧬 Low genetic diversity - introduce new creatures with different traits');
    }
    
    if (this.metrics.stability < 40) {
      const foodPerCreature = world.creatures.length > 0 ? world.food.length / world.creatures.length : 0;
      if (foodPerCreature < 2) {
        recommendations.push('🌿 Food scarcity - add more food sources');
      }
      
      let predators = 0;
      for (const c of world.creatures) {
        const diet = c.genes.diet ?? (c.genes.predator ? 1 : 0);
        if (diet > 0.7) predators++;
      }
      const predatorRatio = world.creatures.length > 0 ? predators / world.creatures.length : 0;
      if (predatorRatio > 0.3) {
        recommendations.push('🦁 Too many predators - ecosystem imbalance');
      } else if (predatorRatio < 0.05 && world.creatures.length > 20) {
        recommendations.push('🦌 Need predators to control herbivore population');
      }
    }
    
    if (this.metrics.sustainability < 40) {
      recommendations.push('⚡ Low sustainability - creatures struggling to survive');
      recommendations.push('💚 Consider boosting creature health or reducing challenges');
    }
    
    if (world.creatures.length < 10) {
      recommendations.push('👥 Low population - spawn more creatures');
    } else if (world.creatures.length > 300) {
      recommendations.push('🏙️ Overpopulation - may cause performance issues');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Ecosystem is healthy - keep up the good work!');
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

