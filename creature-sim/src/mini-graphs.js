// Mini-graph overlay system for real-time visualization
// Sparklines and compact charts on HUD

export class MiniGraphs {
  constructor() {
    this.enabled = true;
    this.autoHide = true; // Auto-hide when camera is moving
    this.opacity = 1.0; // Current opacity for fading
    this.targetOpacity = 1.0;
    this.graphs = {
      population: {
        enabled: true,
        data: [],
        maxPoints: 300,
        colors: { herb: '#4ade80', pred: '#ef4444', omni: '#fb923c' }
      },
      traits: {
        enabled: true,
        data: [], // {time, avgSpeed, avgMetabolism}
        maxPoints: 300,
        colors: { speed: '#60a5fa', metabolism: '#a78bfa' }
      },
      energy: {
        enabled: true,
        histogram: new Array(10).fill(0), // 10 buckets
        colors: { low: '#ef4444', mid: '#fbbf24', high: '#4ade80' }
      },
      diversity: {
        enabled: true,
        data: [], // {time, speciesCount}
        maxPoints: 300,
        color: '#ec4899'
      }
    };
    
    this.updateInterval = 1.0; // Update every second
    this.lastUpdate = 0;
  }
  
  update(world, dt) {
    this.lastUpdate += dt;
    if (this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = 0;
    
    // Count populations
    let herbCount = 0;
    let predCount = 0;
    let omniCount = 0;
    let totalSpeed = 0;
    let totalMetab = 0;
    const energyBuckets = new Array(10).fill(0);
    
    for (const c of world.creatures) {
      const diet = c.genes.diet ?? (c.genes.predator ? 1.0 : 0.0);
      if (diet < 0.3) herbCount++;
      else if (diet < 0.7) omniCount++;
      else predCount++;
      
      totalSpeed += c.genes.speed;
      totalMetab += c.genes.metabolism;
      
      // Energy histogram (0-50 energy range)
      const bucket = Math.min(9, Math.floor(c.energy / 5));
      energyBuckets[bucket]++;
    }
    
    const total = world.creatures.length;
    const time = world.t;
    
    // Update population graph
    const pop = this.graphs.population;
    pop.data.push({ time, herb: herbCount, pred: predCount, omni: omniCount });
    if (pop.data.length > pop.maxPoints) pop.data.shift();
    
    // Update traits graph
    if (total > 0) {
      const traits = this.graphs.traits;
      traits.data.push({
        time,
        avgSpeed: totalSpeed / total,
        avgMetabolism: totalMetab / total
      });
      if (traits.data.length > traits.maxPoints) traits.data.shift();
    }
    
    // Update energy histogram
    this.graphs.energy.histogram = energyBuckets;
    
    // Update diversity (species count via simple clustering)
    const speciesCount = this._estimateSpeciesCount(world);
    const div = this.graphs.diversity;
    div.data.push({ time, count: speciesCount });
    if (div.data.length > div.maxPoints) div.data.shift();
  }
  
  _estimateSpeciesCount(world) {
    // Quick species estimation: group by hue/speed similarity
    const clusters = new Map();
    for (const c of world.creatures) {
      const key = `${Math.floor(c.genes.hue / 30)}_${Math.floor(c.genes.speed * 2)}`;
      clusters.set(key, (clusters.get(key) || 0) + 1);
    }
    // Count clusters with at least 3 members as "species"
    let count = 0;
    for (const size of clusters.values()) {
      if (size >= 3) count++;
    }
    return Math.max(1, count);
  }
  
  draw(ctx, opts) {
    if (!this.enabled) return;
    
    // Auto-hide when camera is moving
    if (this.autoHide && opts.cameraMoving) {
      this.targetOpacity = 0.0;
    } else {
      this.targetOpacity = 1.0;
    }
    
    // Smooth fade
    this.opacity += (this.targetOpacity - this.opacity) * 0.15;
    
    // Skip drawing if fully transparent
    if (this.opacity < 0.01) return;
    
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Work in CSS pixel space
    ctx.globalAlpha = this.opacity;
    
    const padding = 14;
    const graphWidth = 196;
    const graphHeight = 62;
    const spacing = 12;
    const bottomOffset = (opts.bottomOffset ?? 0) + padding;
    let yOffset = Math.max(padding, opts.viewportHeight - graphHeight - bottomOffset);
    
    // Draw each enabled graph
    if (this.graphs.population.enabled) {
      this._drawPopulationGraph(ctx, padding, yOffset, graphWidth, graphHeight);
      yOffset -= graphHeight + spacing;
    }
    
    if (this.graphs.traits.enabled && this.graphs.traits.data.length > 1) {
      this._drawTraitsGraph(ctx, padding, yOffset, graphWidth, graphHeight);
      yOffset -= graphHeight + spacing;
    }
    
    if (this.graphs.energy.enabled) {
      this._drawEnergyHistogram(ctx, padding, yOffset, graphWidth, graphHeight);
      yOffset -= graphHeight + spacing;
    }
    
    if (this.graphs.diversity.enabled && this.graphs.diversity.data.length > 1) {
      this._drawDiversityGraph(ctx, padding, yOffset, graphWidth, graphHeight);
    }
    
    ctx.restore();
  }
  
  _drawPopulationGraph(ctx, x, y, w, h) {
    const graph = this.graphs.population;
    if (graph.data.length < 2) return;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, w, h);
    
    // Border
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('POPULATION', x + 5, y + 12);
    
    // Find max for scaling
    let maxPop = 1;
    for (const d of graph.data) {
      const total = d.herb + d.pred + d.omni;
      if (total > maxPop) maxPop = total;
    }
    
    // Draw lines
    const chartX = x + 5;
    const chartY = y + 20;
    const chartW = w - 10;
    const chartH = h - 25;
    
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxPop, 
      d => d.herb, graph.colors.herb);
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxPop, 
      d => d.pred, graph.colors.pred);
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxPop, 
      d => d.omni, graph.colors.omni);
    
    // Legend
    const latest = graph.data[graph.data.length - 1];
    ctx.font = '9px monospace';
    ctx.fillStyle = graph.colors.herb;
    ctx.fillText(`H:${latest.herb}`, x + 5, y + h - 5);
    ctx.fillStyle = graph.colors.pred;
    ctx.fillText(`P:${latest.pred}`, x + 40, y + h - 5);
    ctx.fillStyle = graph.colors.omni;
    ctx.fillText(`O:${latest.omni}`, x + 70, y + h - 5);
  }
  
  _drawTraitsGraph(ctx, x, y, w, h) {
    const graph = this.graphs.traits;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('AVG TRAITS', x + 5, y + 12);
    
    // Find max for scaling
    let maxSpeed = 0.1;
    let maxMetab = 0.1;
    for (const d of graph.data) {
      if (d.avgSpeed > maxSpeed) maxSpeed = d.avgSpeed;
      if (d.avgMetabolism > maxMetab) maxMetab = d.avgMetabolism;
    }
    
    const chartX = x + 5;
    const chartY = y + 20;
    const chartW = w - 10;
    const chartH = h - 25;
    
    // Draw speed line
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxSpeed * 1.1, 
      d => d.avgSpeed, graph.colors.speed);
    
    // Draw metabolism line
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxMetab * 1.1, 
      d => d.avgMetabolism, graph.colors.metabolism);
    
    // Legend
    const latest = graph.data[graph.data.length - 1];
    ctx.font = '9px monospace';
    ctx.fillStyle = graph.colors.speed;
    ctx.fillText(`Spd:${latest.avgSpeed.toFixed(2)}`, x + 5, y + h - 5);
    ctx.fillStyle = graph.colors.metabolism;
    ctx.fillText(`Met:${latest.avgMetabolism.toFixed(2)}`, x + 80, y + h - 5);
  }
  
  _drawEnergyHistogram(ctx, x, y, w, h) {
    const graph = this.graphs.energy;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('ENERGY', x + 5, y + 12);
    
    const maxCount = Math.max(...graph.histogram, 1);
    const barWidth = (w - 20) / 10;
    const chartY = y + 20;
    const chartH = h - 25;
    
    for (let i = 0; i < 10; i++) {
      const count = graph.histogram[i];
      const barHeight = (count / maxCount) * chartH;
      const barX = x + 10 + i * barWidth;
      
      // Color based on energy level
      let color;
      if (i < 3) color = graph.colors.low;
      else if (i < 7) color = graph.colors.mid;
      else color = graph.colors.high;
      
      ctx.fillStyle = color;
      ctx.fillRect(barX, chartY + chartH - barHeight, barWidth - 2, barHeight);
    }
    
    // Axis labels
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.fillText('0', x + 10, y + h - 3);
    ctx.fillText('50', x + w - 20, y + h - 3);
  }
  
  _drawDiversityGraph(ctx, x, y, w, h) {
    const graph = this.graphs.diversity;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    // Title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('DIVERSITY', x + 5, y + 12);
    
    const maxCount = Math.max(...graph.data.map(d => d.count), 1);
    const chartX = x + 5;
    const chartY = y + 20;
    const chartW = w - 10;
    const chartH = h - 25;
    
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxCount * 1.1, 
      d => d.count, graph.color);
    
    // Current value
    const latest = graph.data[graph.data.length - 1];
    ctx.font = '9px monospace';
    ctx.fillStyle = graph.color;
    ctx.fillText(`Species: ${latest.count}`, x + 5, y + h - 5);
  }
  
  _drawSparkline(ctx, data, x, y, w, h, maxValue, accessor, color) {
    if (data.length < 2) return;
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const xStep = w / (data.length - 1);
    
    for (let i = 0; i < data.length; i++) {
      const value = accessor(data[i]);
      const px = x + i * xStep;
      const py = y + h - (value / maxValue) * h;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    
    ctx.stroke();
  }
  
  toggleGraph(graphName) {
    if (this.graphs[graphName]) {
      this.graphs[graphName].enabled = !this.graphs[graphName].enabled;
      return this.graphs[graphName].enabled;
    }
    return false;
  }
  
  reset() {
    for (const graph of Object.values(this.graphs)) {
      graph.data = [];
      if (graph.histogram) graph.histogram.fill(0);
    }
  }
}
