import { clamp } from './utils.js';

export class HeatmapSystem {
  constructor(world) {
    this.world = world;
    this.gridSize = 20; // Size of each heatmap cell
    this.cols = Math.ceil(world.width / this.gridSize);
    this.rows = Math.ceil(world.height / this.gridSize);
    
    // Heatmap data grids
    this.deathMap = this._createGrid();
    this.birthMap = this._createGrid();
    this.activityMap = this._createGrid();
    this.energyMap = this._createGrid();
    
    // Decay rates (how fast old data fades)
    this.decayRate = 0.98; // Per second
    
    // Active heatmap type
    this.activeType = null; // null, 'death', 'birth', 'activity', 'energy'
    
    // Visual settings
    this.opacity = 0.6;
    this.intensityScale = 2.0;
  }
  
  _createGrid() {
    const grid = [];
    for (let i = 0; i < this.rows; i++) {
      grid[i] = new Array(this.cols).fill(0);
    }
    return grid;
  }
  
  _worldToGrid(x, y) {
    const col = Math.floor(x / this.gridSize);
    const row = Math.floor(y / this.gridSize);
    return { col: clamp(col, 0, this.cols - 1), row: clamp(row, 0, this.rows - 1) };
  }
  
  // Record events
  recordDeath(x, y, intensity = 1.0) {
    const { col, row } = this._worldToGrid(x, y);
    this.deathMap[row][col] += intensity;
  }
  
  recordBirth(x, y, intensity = 1.0) {
    const { col, row } = this._worldToGrid(x, y);
    this.birthMap[row][col] += intensity;
  }
  
  recordActivity(x, y, intensity = 0.1) {
    const { col, row } = this._worldToGrid(x, y);
    this.activityMap[row][col] += intensity;
  }
  
  recordEnergy(x, y, energy) {
    const { col, row } = this._worldToGrid(x, y);
    // Accumulate energy levels for averaging
    this.energyMap[row][col] += energy * 0.01; // Scale down for visualization
  }
  
  // Update heatmaps (apply decay)
  update(dt) {
    const decay = Math.pow(this.decayRate, dt);
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.deathMap[row][col] *= decay;
        this.birthMap[row][col] *= decay;
        this.activityMap[row][col] *= decay;
        this.energyMap[row][col] *= decay;
        
        // Clamp near-zero values to zero
        if (this.deathMap[row][col] < 0.01) this.deathMap[row][col] = 0;
        if (this.birthMap[row][col] < 0.01) this.birthMap[row][col] = 0;
        if (this.activityMap[row][col] < 0.01) this.activityMap[row][col] = 0;
        if (this.energyMap[row][col] < 0.01) this.energyMap[row][col] = 0;
      }
    }
  }
  
  // Render active heatmap
  draw(ctx, camera) {
    if (!this.activeType) return;
    
    const map = this._getActiveMap();
    if (!map) return;
    
    // Find max value for normalization
    let maxValue = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        maxValue = Math.max(maxValue, map[row][col]);
      }
    }
    
    if (maxValue === 0) return; // Nothing to draw
    
    // Draw heatmap
    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const value = map[row][col];
        if (value < 0.05) continue; // Skip near-zero cells
        
        const intensity = clamp((value / maxValue) * this.intensityScale, 0, 1);
        const color = this._getHeatColor(intensity, this.activeType);
        
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y, this.gridSize, this.gridSize);
      }
    }
    
    ctx.restore();
    
    // Draw legend
    this._drawLegend(ctx, camera);
  }
  
  _getActiveMap() {
    switch (this.activeType) {
      case 'death': return this.deathMap;
      case 'birth': return this.birthMap;
      case 'activity': return this.activityMap;
      case 'energy': return this.energyMap;
      default: return null;
    }
  }
  
  _getHeatColor(intensity, type) {
    const alpha = intensity * 0.7;
    
    switch (type) {
      case 'death':
        // Red heatmap
        return `rgba(255, 0, 0, ${alpha})`;
      case 'birth':
        // Green heatmap
        return `rgba(0, 255, 100, ${alpha})`;
      case 'activity':
        // Blue heatmap
        return `rgba(50, 150, 255, ${alpha})`;
      case 'energy':
        // Yellow-orange heatmap
        return `rgba(255, 200, 0, ${alpha})`;
      default:
        return `rgba(255, 255, 255, ${alpha})`;
    }
  }
  
  _drawLegend(ctx, camera) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to screen space
    
    const x = 10;
    const y = 100;
    const width = 150;
    const height = 60;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, width, height);
    
    // Title
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const titles = {
      death: '💀 Death Heatmap',
      birth: '🐣 Birth Heatmap',
      activity: '🏃 Activity Heatmap',
      energy: '⚡ Energy Heatmap'
    };
    
    ctx.fillText(titles[this.activeType] || 'Heatmap', x + 10, y + 10);
    
    // Gradient bar
    const barY = y + 30;
    const barHeight = 15;
    const gradient = ctx.createLinearGradient(x + 10, 0, x + width - 10, 0);
    
    switch (this.activeType) {
      case 'death':
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0.9)');
        break;
      case 'birth':
        gradient.addColorStop(0, 'rgba(0, 255, 100, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 255, 100, 0.9)');
        break;
      case 'activity':
        gradient.addColorStop(0, 'rgba(50, 150, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(50, 150, 255, 0.9)');
        break;
      case 'energy':
        gradient.addColorStop(0, 'rgba(255, 200, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 200, 0, 0.9)');
        break;
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 10, barY, width - 20, barHeight);
    
    // Labels
    ctx.font = '10px Arial';
    ctx.fillStyle = '#FFF';
    ctx.fillText('Low', x + 10, barY + barHeight + 3);
    ctx.textAlign = 'right';
    ctx.fillText('High', x + width - 10, barY + barHeight + 3);
    
    ctx.restore();
  }
  
  // Toggle heatmap type
  setType(type) {
    if (this.activeType === type) {
      this.activeType = null; // Toggle off
    } else {
      this.activeType = type; // Set new type
    }
  }
  
  // Clear all heatmaps
  clear() {
    this.deathMap = this._createGrid();
    this.birthMap = this._createGrid();
    this.activityMap = this._createGrid();
    this.energyMap = this._createGrid();
  }
  
  // Get stats about current heatmap
  getStats() {
    const map = this._getActiveMap();
    if (!map) return null;
    
    let total = 0;
    let count = 0;
    let max = 0;
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const value = map[row][col];
        if (value > 0) {
          total += value;
          count++;
          max = Math.max(max, value);
        }
      }
    }
    
    return {
      total,
      average: count > 0 ? total / count : 0,
      max,
      activeCells: count
    };
  }
}

