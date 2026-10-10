/**
 * Mini-graph overlay system for real-time visualization
 * Sparklines and compact charts on HUD, drawn in the field-journal instrument
 * vocabulary (deep-green translucent panels, lime/aqua/sun accents) instead of
 * the old black monospace debug boxes.
 */
const GRAPH_PANEL_FONT = "'Avenir Next', 'Inter', system-ui, -apple-system, sans-serif";

export class MiniGraphs {
  constructor() {
    this.enabled = false;
    this.autoHide = true; // Auto-hide when camera is moving
    this.opacity = 1.0; // Current opacity for fading
    this.targetOpacity = 1.0;
    this.graphs = {
      population: {
        enabled: true,
        data: [],
        maxPoints: 300,
        colors: { herb: '#a8df91', pred: '#ef917b', omni: '#f1c86c' }
      },
      traits: {
        enabled: true,
        data: [], // {time, avgSpeed, avgMetabolism}
        maxPoints: 300,
        colors: { speed: '#80d8c4', metabolism: '#c5f27e' }
      },
      energy: {
        enabled: true,
        histogram: new Array(10).fill(0), // 10 buckets
        colors: { low: '#ef917b', mid: '#f1c86c', high: '#a8df91' }
      },
      diversity: {
        enabled: true,
        data: [], // {time, speciesCount}
        maxPoints: 300,
        color: '#c5f27e'
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

      // Gene values may be numbers or expressed-object wrappers; feed the
      // numeric reading or the sparklines legend reads NaN.
      const speedGene = c.genes.speed;
      const metabGene = c.genes.metabolism;
      totalSpeed += typeof speedGene === 'number' ? speedGene : Number(speedGene?.expressed ?? 0);
      totalMetab += typeof metabGene === 'number' ? metabGene : Number(metabGene?.expressed ?? 0);

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
    // Match the backing-store scale actually in use (adaptive resolution may
    // differ from devicePixelRatio). Layout below is in CSS pixels.
    const layoutWidth = Number(opts.viewportWidth || 0);
    const dpr = layoutWidth > 0 ? ctx.canvas.width / layoutWidth : window.devicePixelRatio || 1;
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

  /**
   * Shared panel chrome: translucent deep-green instrument card with a soft
   * border and a small-caps field label. Kept allocation-free — the label and
   * palette are static per graph.
   */
  _drawPanel(ctx, x, y, w, h, label) {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(9, 28, 21, 0.86)';
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, 12);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(183, 226, 187, 0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 247, 233, 0.85)';
    ctx.font = `600 10px ${GRAPH_PANEL_FONT}`;
    ctx.fillText(label.toUpperCase(), x + 11, y + 16);
  }

  _drawPopulationGraph(ctx, x, y, w, h) {
    const graph = this.graphs.population;
    if (graph.data.length < 2) return;

    this._drawPanel(ctx, x, y, w, h, 'Population');

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

    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxPop, d => d.herb, graph.colors.herb);
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxPop, d => d.pred, graph.colors.pred);
    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxPop, d => d.omni, graph.colors.omni);

    // Legend
    const latest = graph.data[graph.data.length - 1];
    ctx.font = `9px ${GRAPH_PANEL_FONT}`;
    ctx.fillStyle = graph.colors.herb;
    ctx.fillText(`H:${latest.herb}`, x + 5, y + h - 5);
    ctx.fillStyle = graph.colors.pred;
    ctx.fillText(`P:${latest.pred}`, x + 40, y + h - 5);
    ctx.fillStyle = graph.colors.omni;
    ctx.fillText(`O:${latest.omni}`, x + 70, y + h - 5);
  }

  _drawTraitsGraph(ctx, x, y, w, h) {
    const graph = this.graphs.traits;

    this._drawPanel(ctx, x, y, w, h, 'Avg traits');

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
    this._drawSparkline(
      ctx,
      graph.data,
      chartX,
      chartY,
      chartW,
      chartH,
      maxSpeed * 1.1,
      d => d.avgSpeed,
      graph.colors.speed
    );

    // Draw metabolism line
    this._drawSparkline(
      ctx,
      graph.data,
      chartX,
      chartY,
      chartW,
      chartH,
      maxMetab * 1.1,
      d => d.avgMetabolism,
      graph.colors.metabolism
    );

    // Legend
    const latest = graph.data[graph.data.length - 1];
    ctx.font = `9px ${GRAPH_PANEL_FONT}`;
    ctx.fillStyle = graph.colors.speed;
    ctx.fillText(`Spd:${latest.avgSpeed.toFixed(2)}`, x + 5, y + h - 5);
    ctx.fillStyle = graph.colors.metabolism;
    ctx.fillText(`Met:${latest.avgMetabolism.toFixed(2)}`, x + 80, y + h - 5);
  }

  _drawEnergyHistogram(ctx, x, y, w, h) {
    const graph = this.graphs.energy;

    this._drawPanel(ctx, x, y, w, h, 'Energy');

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
    ctx.font = `8px ${GRAPH_PANEL_FONT}`;
    ctx.fillStyle = 'rgba(167, 192, 172, 0.8)';
    ctx.fillText('0', x + 10, y + h - 3);
    ctx.fillText('50', x + w - 20, y + h - 3);
  }

  _drawDiversityGraph(ctx, x, y, w, h) {
    const graph = this.graphs.diversity;

    this._drawPanel(ctx, x, y, w, h, 'Diversity');

    const maxCount = Math.max(...graph.data.map(d => d.count), 1);
    const chartX = x + 5;
    const chartY = y + 20;
    const chartW = w - 10;
    const chartH = h - 25;

    this._drawSparkline(ctx, graph.data, chartX, chartY, chartW, chartH, maxCount * 1.1, d => d.count, graph.color);

    // Current value
    const latest = graph.data[graph.data.length - 1];
    ctx.font = `9px ${GRAPH_PANEL_FONT}`;
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
