/**
 * Scalar Field - 2D scalar field with diffusion and decay
 * Used for pheromones, temperature, and other environmental factors
 */
export class ScalarField {
  constructor(w, h, cell, decay = 0.985, diffuse = 0.15) {
    this.w = Math.ceil(w / cell);
    this.h = Math.ceil(h / cell);
    this.cell = cell;
    this.decay = decay;
    this.diffuse = diffuse;
    this.grid = new Float32Array(this.w * this.h);
    this.nextGrid = new Float32Array(this.w * this.h); // Double buffer to avoid allocation
  }

  idx(x, y) {
    return (y * this.w + x);
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x, y) {
    return this.inb(x, y) ? this.grid[this.idx(x, y)] : 0;
  }

  add(x, y, val) {
    if (this.inb(x, y)) {
      this.grid[this.idx(x, y)] += val;
    }
  }

  step() {
    // Use double buffering - swap instead of allocate
    const diffuse025 = this.diffuse * 0.25;
    const oneMinusDiffuse = 1 - this.diffuse;

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let s = this.get(x, y) * oneMinusDiffuse;
        s += diffuse025 * (this.get(x + 1, y) + this.get(x - 1, y) + this.get(x, y + 1) + this.get(x, y - 1));
        this.nextGrid[this.idx(x, y)] = s * this.decay;
      }
    }
    // Swap buffers instead of creating new array
    const temp = this.grid;
    this.grid = this.nextGrid;
    this.nextGrid = temp;
  }

  // Get value at world coordinates
  getAtWorld(x, y) {
    const gridX = Math.floor(x / this.cell);
    const gridY = Math.floor(y / this.cell);
    return this.get(gridX, gridY);
  }

  // Add value at world coordinates
  addAtWorld(x, y, val) {
    const gridX = Math.floor(x / this.cell);
    const gridY = Math.floor(y / this.cell);
    this.add(gridX, gridY, val);
  }

  // Clear the field
  clear() {
    this.grid.fill(0);
    this.nextGrid.fill(0);
  }

  // Get field statistics
  getStats() {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;

    for (let i = 0; i < this.grid.length; i++) {
      const val = this.grid[i];
      if (val !== 0) {
        min = Math.min(min, val);
        max = Math.max(max, val);
        sum += val;
        count++;
      }
    }

    return {
      min,
      max,
      average: count > 0 ? sum / count : 0,
      nonZeroCells: count,
      totalCells: this.grid.length
    };
  }
}
