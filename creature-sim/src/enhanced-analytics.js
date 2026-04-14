/**
 * Enhanced Analytics UI - Advanced data visualization and analysis tools
 * Provides interactive charts, real-time metrics, and simulation insights
 */

import { domCache } from './dom-cache.js';

/**
 * Interactive Chart Component
 */
class InteractiveChart {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      width: canvas.width || 400,
      height: canvas.height || 200,
      backgroundColor: '#1a1a1a',
      gridColor: '#333',
      textColor: '#fff',
      lineColors: ['#00ff00', '#0088ff', '#ff8800', '#ff0088', '#8800ff'],
      font: '12px monospace',
      showGrid: true,
      showLegend: true,
      interactive: true,
      ...options
    };

    this.data = [];
    this.labels = [];
    this.maxDataPoints = 600;
    this.hoverIndex = -1;
    this.animationFrame = null;

    this.setupCanvas();
    this.setupEventListeners();
  }

  setupCanvas() {
    const { width, height, backgroundColor } = this.options;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }

  setupEventListeners() {
    if (!this.options.interactive) return;

    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const dataIndex = Math.floor((x / this.options.width) * this.data.length);
    this.hoverIndex = (dataIndex >= 0 && dataIndex < this.data.length) ? dataIndex : -1;
    this.draw();
  }

  handleMouseLeave() {
    this.hoverIndex = -1;
    this.draw();
  }

  setData(data, labels = null) {
    this.data = Array.isArray(data[0]) ? data : [data];
    this.labels = labels || this.data.map((_, i) => `Series ${i + 1}`);
    this.draw();
  }

  resize(width, height) {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (nextWidth === this.options.width && nextHeight === this.options.height) return;

    this.options.width = nextWidth;
    this.options.height = nextHeight;
    this.setupCanvas();
    this.draw();
  }

  addDataPoint(...values) {
    for (let i = 0; i < values.length && i < this.data.length; i++) {
      this.data[i].push(values[i]);
      if (this.data[i].length > this.maxDataPoints) {
        this.data[i].shift();
      }
    }
    this.draw();
  }

  clear() {
    this.data = [];
    this.labels = [];
    this.hoverIndex = -1;
    this.draw();
  }

  draw() {
    const { ctx, options } = this;
    const { width, height, backgroundColor, gridColor, textColor, lineColors, showGrid } = options;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    if (this.data.length === 0) return;

    // Calculate data ranges
    const allValues = this.data.flat();
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const valueRange = maxValue - minValue || 1;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      // Vertical grid lines
      for (let x = 0; x <= width; x += width / 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 30);
        ctx.stroke();
      }

      // Horizontal grid lines
      for (let y = 0; y <= height - 30; y += (height - 30) / 5) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw data lines
    this.data.forEach((series, seriesIndex) => {
      if (series.length === 0) return;

      const lineColor = lineColors[seriesIndex % lineColors.length];
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      series.forEach((value, index) => {
        const x = (index / (series.length - 1)) * width;
        const y = height - 30 - ((value - minValue) / valueRange) * (height - 60);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        // Highlight hovered point
        if (this.hoverIndex === index) {
          ctx.fillStyle = lineColor;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.stroke();
    });

    // Draw axes labels
    ctx.fillStyle = textColor;
    ctx.font = options.font;
    ctx.textAlign = 'center';

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (valueRange * i) / 5;
      const y = height - 30 - (i / 5) * (height - 60);
      ctx.fillText(value.toFixed(1), 20, y + 4);
    }

    // Legend
    if (options.showLegend && this.labels.length > 0) {
      ctx.textAlign = 'left';
      this.labels.forEach((label, index) => {
        const color = lineColors[index % lineColors.length];
        const x = 10 + (index % 3) * 120;
        const y = height - 15 + Math.floor(index / 3) * 12;

        ctx.fillStyle = color;
        ctx.fillRect(x, y - 8, 10, 10);
        ctx.fillStyle = textColor;
        ctx.fillText(label, x + 15, y);
      });
    }

    // Tooltip for hovered point
    if (this.hoverIndex >= 0) {
      const tooltipX = (this.hoverIndex / this.data[0].length) * width;
      const tooltipData = this.data.map((series, i) => ({
        label: this.labels[i],
        value: series[this.hoverIndex],
        color: lineColors[i % lineColors.length]
      }));

      this.drawTooltip(tooltipX, 20, tooltipData);
    }
  }

  drawTooltip(x, y, data) {
    const { ctx } = this;
    const padding = 8;
    const lineHeight = 14;
    const tooltipWidth = 150;
    const tooltipHeight = data.length * lineHeight + padding * 2;

    // Tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, tooltipWidth, tooltipHeight);

    // Tooltip border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, tooltipWidth, tooltipHeight);

    // Tooltip content
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';

    data.forEach((item, index) => {
      const textY = y + padding + (index + 1) * lineHeight - 4;

      // Color indicator
      ctx.fillStyle = item.color;
      ctx.fillRect(x + padding, textY - 8, 8, 8);

      // Text
      ctx.fillStyle = '#fff';
      ctx.fillText(`${item.label}: ${item.value.toFixed(2)}`, x + padding + 12, textY);
    });
  }
}

/**
 * Real-time Analytics Dashboard
 */
export class AnalyticsDashboard {
  constructor(container) {
    this.container = container;
    this.isVisible = false;
    this.charts = new Map();
    this.metrics = new Map();
    this.updateInterval = 1000; // Update every second
    this.lastUpdate = 0;
    this.dataHistory = new Map();
    this.maxHistoryPoints = 600; // 10 minutes at 1 second intervals

    this.createUI();
    this.setupEventListeners();
    this.initializeCharts();
  }

  createUI() {
    this.panel = document.createElement('div');
    this.panel.id = 'analytics-dashboard';
    this.panel.style.cssText = `
      position: fixed;
      top: 50px;
      left: 10px;
      width: min(92vw, 900px);
      height: min(82vh, 640px);
      max-width: calc(100vw - 20px);
      max-height: calc(100vh - 70px);
      background: rgba(20, 20, 20, 0.95);
      border: 2px solid #00ff00;
      border-radius: 8px;
      display: none;
      z-index: 9999;
      font-family: monospace;
      color: #00ff00;
      backdrop-filter: blur(10px);
      overflow: hidden;
      box-sizing: border-box;
    `;

    this.panel.innerHTML = `
      <div style="padding: 10px; height: 100%; display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h2 style="margin: 0; color: #00ff00;">Analytics Dashboard</h2>
          <div>
            <button id="analytics-minimize" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px; margin-right: 5px;">−</button>
            <button id="analytics-close" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px;">×</button>
          </div>
        </div>

        <!-- Controls -->
        <div id="analytics-controls" style="margin-bottom: 10px;">
          <select id="analytics-time-range" style="background: #222; color: #00ff00; border: 1px solid #555; padding: 2px;">
            <option value="60">Last Minute</option>
            <option value="300">Last 5 Minutes</option>
            <option value="600" selected>Last 10 Minutes</option>
            <option value="3600">Last Hour</option>
          </select>
          <button id="analytics-export" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px; margin-left: 10px;">Export</button>
          <button id="analytics-clear" style="background: #333; border: 1px solid #00ff00; color: #00ff00; cursor: pointer; padding: 2px 8px; margin-left: 5px;">Clear</button>
        </div>

        <!-- Charts Grid -->
        <div id="analytics-charts" style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px; overflow: hidden; min-height: 0;">
          <div class="chart-container">
            <h3 style="margin: 0 0 5px 0; font-size: 14px;">Population Dynamics</h3>
            <canvas id="population-chart" width="380" height="180"></canvas>
          </div>
          <div class="chart-container">
            <h3 style="margin: 0 0 5px 0; font-size: 14px;">Gene Frequencies</h3>
            <canvas id="genes-chart" width="380" height="180"></canvas>
          </div>
          <div class="chart-container">
            <h3 style="margin: 0 0 5px 0; font-size: 14px;">Ecosystem Health</h3>
            <canvas id="ecosystem-chart" width="380" height="180"></canvas>
          </div>
          <div class="chart-container">
            <h3 style="margin: 0 0 5px 0; font-size: 14px;">Performance Metrics</h3>
            <canvas id="performance-chart" width="380" height="180"></canvas>
          </div>
        </div>

        <!-- Stats Summary -->
        <div id="analytics-summary" style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
            <span>Total Creatures: <span id="stat-creatures">0</span></span>
            <span>Generations: <span id="stat-generations">0</span></span>
            <span>Eco Health: <span id="stat-ecosystem">--</span></span>
            <span>FPS: <span id="stat-fps">--</span></span>
          </div>
          <div id="analytics-insights" aria-live="polite" style="margin-top: 8px; color: #bbf7d0; line-height: 1.45; min-height: 2.2em;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);

    // Style chart containers
    const style = document.createElement('style');
    style.textContent = `
      .chart-container {
        background: rgba(30, 30, 30, 0.8);
        border: 1px solid #444;
        border-radius: 4px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .chart-container canvas {
        border: 1px solid #555;
        border-radius: 2px;
        display: block;
        width: 100%;
        height: 100%;
        flex: 1;
      }
    `;
    document.head.appendChild(style);

    this.defaultHeight = this.panel.style.height;
  }

  setupEventListeners() {
    const closeBtn = this.panel.querySelector('#analytics-close');
    const minimizeBtn = this.panel.querySelector('#analytics-minimize');
    const exportBtn = this.panel.querySelector('#analytics-export');
    const clearBtn = this.panel.querySelector('#analytics-clear');
    const timeRangeSelect = this.panel.querySelector('#analytics-time-range');

    closeBtn.addEventListener('click', () => this.hide());
    minimizeBtn.addEventListener('click', () => this.minimize());
    exportBtn.addEventListener('click', () => this.exportData());
    clearBtn.addEventListener('click', () => this.clearData());
    timeRangeSelect.addEventListener('change', () => this.updateTimeRange());

    window.addEventListener('resize', () => {
      if (this.isVisible) {
        this.resizeCharts();
      }
    });

    // Keyboard shortcut (Ctrl+Shift+A)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Make panel draggable
    this.makeDraggable();
  }

  makeDraggable() {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const header = this.panel.querySelector('h2');

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffsetX = e.clientX - this.panel.offsetLeft;
      dragOffsetY = e.clientY - this.panel.offsetTop;
      this.panel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.panel.style.left = (e.clientX - dragOffsetX) + 'px';
        this.panel.style.top = (e.clientY - dragOffsetY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      this.panel.style.cursor = 'grab';
    });
  }

  initializeCharts() {
    const chartIds = ['population-chart', 'genes-chart', 'ecosystem-chart', 'performance-chart'];

    chartIds.forEach(id => {
      const canvas = this.panel.querySelector(`#${id}`);
      const chart = new InteractiveChart(canvas);
      this.charts.set(id, chart);
      this.dataHistory.set(id, []);
    });
  }

  resizeCharts() {
    this.charts.forEach((chart, id) => {
      const canvas = this.panel.querySelector(`#${id}`);
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        chart.resize(rect.width, rect.height);
      }
    });
  }

  show() {
    this.panel.style.display = 'block';
    this.isVisible = true;
    requestAnimationFrame(() => this.resizeCharts());
    console.debug('📊 Analytics dashboard opened');
  }

  hide() {
    this.panel.style.display = 'none';
    this.isVisible = false;
    console.debug('📊 Analytics dashboard closed');
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  minimize() {
    // Toggle between normal and minimized state
    const chartsContainer = this.panel.querySelector('#analytics-charts');
    const summary = this.panel.querySelector('#analytics-summary');

    if (chartsContainer.style.display !== 'none') {
      chartsContainer.style.display = 'none';
      summary.style.display = 'none';
      this.panel.style.height = '80px';
    } else {
      chartsContainer.style.display = 'grid';
      summary.style.display = 'block';
      this.panel.style.height = this.defaultHeight;
      requestAnimationFrame(() => this.resizeCharts());
    }
  }

  update(analyticsData, world, performanceStats) {
    if (!this.isVisible) return;

    const now = performance.now();
    if (now - this.lastUpdate < this.updateInterval) return;

    this.lastUpdate = now;

    // Update population chart
    this.updatePopulationChart(analyticsData);

    // Update genes chart
    this.updateGenesChart(analyticsData);

    // Update ecosystem chart
    this.updateEcosystemChart(analyticsData);

    // Update performance chart
    this.updatePerformanceChart(performanceStats);

    // Update summary stats
    this.updateSummaryStats(analyticsData, world, performanceStats);
  }

  updatePopulationChart(analyticsData) {
    const chart = this.charts.get('population-chart');
    const history = this.dataHistory.get('population-chart');

    const populationData = [
      analyticsData.population.total || 0,
      analyticsData.population.babies || 0,
      analyticsData.population.juveniles || 0,
      analyticsData.population.adults || 0,
      analyticsData.population.elders || 0
    ];

    history.push([...populationData]);
    if (history.length > this.maxHistoryPoints) {
      history.shift();
    }

    // Transpose data for chart
    const chartData = populationData.map((_, index) =>
      history.map(point => point[index] || 0)
    );

    chart.setData(chartData, ['Total', 'Babies', 'Juveniles', 'Adults', 'Elders']);
  }

  updateGenesChart(analyticsData) {
    const chart = this.charts.get('genes-chart');
    const history = this.dataHistory.get('genes-chart');

    const geneData = [
      analyticsData.genes?.speed?.mean || 0,
      analyticsData.genes?.sense?.mean || 0,
      analyticsData.genes?.metabolism?.mean || 0,
      analyticsData.genes?.size?.mean || 0
    ];

    history.push([...geneData]);
    if (history.length > this.maxHistoryPoints) {
      history.shift();
    }

    // Transpose data for chart
    const chartData = geneData.map((_, index) =>
      history.map(point => point[index] || 0)
    );

    chart.setData(chartData, ['Speed', 'Sense', 'Metabolism', 'Size']);
  }

  updateEcosystemChart(analyticsData) {
    const chart = this.charts.get('ecosystem-chart');
    const history = this.dataHistory.get('ecosystem-chart');

    const ecoData = [
      analyticsData.ecosystem?.diversity || 0,
      analyticsData.ecosystem?.stability || 0,
      analyticsData.ecosystem?.foodAvailability || 0,
      analyticsData.ecosystem?.predatorPressure || 0
    ];

    history.push([...ecoData]);
    if (history.length > this.maxHistoryPoints) {
      history.shift();
    }

    // Transpose data for chart
    const chartData = ecoData.map((_, index) =>
      history.map(point => point[index] || 0)
    );

    chart.setData(chartData, ['Diversity', 'Stability', 'Food', 'Predators']);
  }

  updatePerformanceChart(performanceStats) {
    const chart = this.charts.get('performance-chart');
    const history = this.dataHistory.get('performance-chart');

    const perfData = [
      performanceStats?.current?.fps || 0,
      performanceStats?.current?.frameTime || 0,
      performanceStats?.current?.memoryUsage || 0,
      performanceStats?.current?.drawCalls || 0
    ];

    history.push([...perfData]);
    if (history.length > this.maxHistoryPoints) {
      history.shift();
    }

    // Transpose data for chart
    const chartData = perfData.map((_, index) =>
      history.map(point => point[index] || 0)
    );

    chart.setData(chartData, ['FPS', 'Frame Time', 'Memory', 'Draw Calls']);
  }

  updateSummaryStats(analyticsData, world, performanceStats) {
    const creaturesElement = this.panel.querySelector('#stat-creatures');
    const generationsElement = this.panel.querySelector('#stat-generations');
    const ecosystemElement = this.panel.querySelector('#stat-ecosystem');
    const fpsElement = this.panel.querySelector('#stat-fps');

    creaturesElement.textContent = analyticsData.population?.total || 0;
    generationsElement.textContent = analyticsData.generation || 0;
    ecosystemElement.textContent = analyticsData.ecosystem?.health != null ?
      analyticsData.ecosystem.health.toFixed(2) : '--';
    fpsElement.textContent = performanceStats?.current?.fps != null ?
      performanceStats.current.fps.toFixed(1) : '--';
    this.updateInsightNarrative(analyticsData, world, performanceStats);
  }

  buildInsightNarrative(analyticsData, world, performanceStats) {
    const trends = analyticsData?.trends || {};
    const total = Number(analyticsData?.population?.total ?? world?.creatures?.length ?? 0);
    const health = Number(analyticsData?.ecosystem?.health);
    const food = Number(analyticsData?.ecosystem?.foodAvailability);
    const pressure = Number(analyticsData?.ecosystem?.predatorPressure);
    const populationTrend = Number(trends.populationGrowth) || 0;
    const diversityTrend = Number(trends.geneDiversity) || 0;
    const healthTrend = Number(trends.ecosystemHealth) || 0;
    const fps = Number(performanceStats?.current?.fps);

    if (!Number.isFinite(total) || total <= 0) {
      return 'Collecting ecosystem trends while the world initializes.';
    }

    const clauses = [];
    clauses.push(populationTrend > 0.4
      ? `Population is growing around ${total} creatures`
      : populationTrend < -0.4
        ? `Population is shrinking around ${total} creatures`
        : `Population is holding steady around ${total} creatures`);

    clauses.push(diversityTrend > 0.005
      ? 'genetic diversity is widening'
      : diversityTrend < -0.005
        ? 'genetic diversity is narrowing'
        : 'genetic diversity is stable');

    clauses.push(healthTrend > 0.005
      ? `ecosystem health is improving${Number.isFinite(health) ? ` (${health.toFixed(2)})` : ''}`
      : healthTrend < -0.005
        ? `ecosystem health is slipping${Number.isFinite(health) ? ` (${health.toFixed(2)})` : ''}`
        : `ecosystem health is steady${Number.isFinite(health) ? ` (${health.toFixed(2)})` : ''}`);

    if (Number.isFinite(food)) {
      clauses.push(food < 0.3
        ? 'food availability is tight'
        : food > 0.7
          ? 'food availability is abundant'
          : 'food availability is balanced');
    }

    if (Number.isFinite(pressure) && pressure > 0.35) {
      clauses.push(pressure > 0.65 ? 'predator pressure is high' : 'predator pressure is building');
    }

    if (Number.isFinite(fps)) {
      clauses.push(fps < 45
        ? `performance is dipping at ${fps.toFixed(0)} FPS`
        : `performance is holding at ${fps.toFixed(0)} FPS`);
    }

    return `${clauses.join('. ')}.`;
  }

  updateInsightNarrative(analyticsData, world, performanceStats) {
    const insights = this.panel.querySelector('#analytics-insights');
    if (!insights) return;
    insights.textContent = this.buildInsightNarrative(analyticsData, world, performanceStats);
  }

  updateTimeRange() {
    const timeRange = parseInt(this.panel.querySelector('#analytics-time-range').value);
    // Update max history points based on selected time range
    // This would affect how much historical data is displayed
    console.debug(`📊 Time range changed to ${timeRange} seconds`);
  }

  clearData() {
    this.dataHistory.forEach(history => history.length = 0);
    this.charts.forEach(chart => chart.clear());
    console.debug('📊 Analytics data cleared');
  }

  exportData() {
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        version: '1.0'
      },
      history: Object.fromEntries(this.dataHistory),
      config: {
        maxHistoryPoints: this.maxHistoryPoints,
        updateInterval: this.updateInterval
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-data-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.debug('📊 Analytics data exported');
  }
}

/**
 * Advanced Statistics Calculator
 */
export class AdvancedStatsCalculator {
  constructor() {
    this.stats = {
      population: {
        total: 0,
        babies: 0,
        juveniles: 0,
        adults: 0,
        elders: 0,
        growthRate: 0,
        mortalityRate: 0
      },
      genes: {
        speed: { mean: 0, variance: 0, min: 0, max: 0 },
        sense: { mean: 0, variance: 0, min: 0, max: 0 },
        metabolism: { mean: 0, variance: 0, min: 0, max: 0 },
        size: { mean: 0, variance: 0, min: 0, max: 0 }
      },
      ecosystem: {
        diversity: 0,
        stability: 0,
        foodAvailability: 0,
        predatorPressure: 0,
        health: 0
      },
      generation: 0
    };

    this.history = [];
    this.maxHistory = 1000;
  }

  update(creatures, food, world) {
    // Calculate population stats
    this.calculatePopulationStats(creatures);

    // Calculate gene stats
    this.calculateGeneStats(creatures);

    // Calculate ecosystem stats
    this.calculateEcosystemStats(creatures, food, world);

    // Store in history
    this.history.push({ ...this.stats, timestamp: performance.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Calculate trends
    this.calculateTrends();

    return { ...this.stats };
  }

  calculatePopulationStats(creatures) {
    const population = this.stats.population;

    population.total = creatures.length;
    population.babies = creatures.filter(c => c.age < 50).length;
    population.juveniles = creatures.filter(c => c.age >= 50 && c.age < 150).length;
    population.adults = creatures.filter(c => c.age >= 150 && c.age < 250).length;
    population.elders = creatures.filter(c => c.age >= 250).length;

    // Calculate growth rate from history
    if (this.history.length > 10) {
      const recent = this.history.slice(-10);
      const oldTotal = recent[0].population.total;
      const newTotal = population.total;
      population.growthRate = (newTotal - oldTotal) / Math.max(oldTotal, 1);
    }
  }

  calculateGeneStats(creatures) {
    if (creatures.length === 0) return;

    const genes = this.stats.genes;
    const traits = ['speed', 'sense', 'metabolism', 'size'];

    traits.forEach(trait => {
      const values = creatures.map(c => c[trait] || 0);
      const stats = this.calculateStats(values);

      genes[trait].mean = stats.mean;
      genes[trait].variance = stats.variance;
      genes[trait].min = stats.min;
      genes[trait].max = stats.max;
    });
  }

  calculateEcosystemStats(creatures, food, world) {
    const ecosystem = this.stats.ecosystem;

    // Diversity based on gene variation
    if (creatures.length > 0) {
      const speedVariance = this.stats.genes.speed.variance;
      const senseVariance = this.stats.genes.sense.variance;
      ecosystem.diversity = (speedVariance + senseVariance) / 2;
    }

    // Food availability
    ecosystem.foodAvailability = food.length / Math.max(world.maxFood, 1);

    // Stability based on population consistency
    if (this.history.length > 20) {
      const recentPopulations = this.history.slice(-20).map(h => h.population.total);
      const avgPopulation = recentPopulations.reduce((a, b) => a + b, 0) / recentPopulations.length;
      const variance = recentPopulations.reduce((sum, pop) => sum + Math.pow(pop - avgPopulation, 2), 0) / recentPopulations.length;
      ecosystem.stability = 1 - Math.min(variance / Math.max(avgPopulation, 1), 1);
    }

    // Overall health
    ecosystem.health = (
      ecosystem.diversity * 0.3 +
      ecosystem.stability * 0.3 +
      ecosystem.foodAvailability * 0.4
    );
  }

  calculateStats(values) {
    if (values.length === 0) return { mean: 0, variance: 0, min: 0, max: 0 };

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;

    return {
      mean,
      variance,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  calculateTrends() {
    if (this.history.length < 20) return;

    const recent = this.history.slice(-20);

    // Calculate trends for various metrics
    this.stats.trends = {
      populationGrowth: this.calculateTrend(recent.map(h => h.population.total)),
      geneDiversity: this.calculateTrend(recent.map(h => h.ecosystem.diversity)),
      ecosystemHealth: this.calculateTrend(recent.map(h => h.ecosystem.health))
    };
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;

    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = values[i];
      numerator += (x - xMean) * (y - yMean);
      denominator += Math.pow(x - xMean, 2);
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  getReport() {
    return {
      current: { ...this.stats },
      history: this.history.slice(-100), // Last 100 data points
      trends: this.stats.trends || {},
      summary: {
        totalDataPoints: this.history.length,
        averagePopulation: this.history.length > 0 ?
          this.history.reduce((sum, h) => sum + h.population.total, 0) / this.history.length : 0,
        peakPopulation: this.history.length > 0 ?
          Math.max(...this.history.map(h => h.population.total)) : 0
      }
    };
  }
}

// Global instances - lazy initialize to avoid DOM issues
let _analyticsDashboard = null;
let _advancedStatsCalculator = null;

export const analyticsDashboard = {
  get instance() {
    if (!_analyticsDashboard) {
      _analyticsDashboard = new AnalyticsDashboard(document.body);
    }
    return _analyticsDashboard;
  },
  toggle: function() { this.instance.toggle(); },
  update: function(stats, world, profiler) { this.instance.update(stats, world, profiler); },
  show: function() { this.instance.show(); },
  hide: function() { this.instance.hide(); },
  get isVisible() { return _analyticsDashboard?.isVisible || false; }
};

export const advancedStatsCalculator = {
  get instance() {
    if (!_advancedStatsCalculator) {
      _advancedStatsCalculator = new AdvancedStatsCalculator();
    }
    return _advancedStatsCalculator;
  },
  update: function(creatures, food, world) { this.instance.update(creatures, food, world); },
  get stats() { return this.instance.stats; }
};

// Initialize dashboard after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAnalyticsDashboard);
} else {
  initializeAnalyticsDashboard();
}

function initializeAnalyticsDashboard() {
  try {
    if (typeof domCache !== 'undefined' && domCache.initialize) {
      domCache.initialize();
    }

    const toggleBtn = document.getElementById('analytics-dashboard-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        analyticsDashboard.toggle();
      });
    }
  } catch (error) {
    console.warn('Analytics dashboard initialization delayed:', error);
  }
}
