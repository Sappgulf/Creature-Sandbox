/**
 * High-performance spatial hash grid using typed arrays for broad-phase queries.
 * Optimized for cache-friendly operations and minimal allocations.
 *
 * Provides O(1) insertion and near-O(1) proximity queries by dividing the world
 * into a grid of cells. Items are sorted into cells based on their position,
 * and queries only check cells within the search radius.
 *
 * @example
 * const grid = new SpatialGrid(50, 1000, 700); // 50px cells
 * grid.clear();
 * creatures.forEach(c => grid.insert(c, c.x, c.y));
 * grid.buildIndex();
 * const nearby = grid.nearby(x, y, 100); // Items within 100px
 */
export class SpatialGrid {
  constructor(cellSize, worldWidth = 4000, worldHeight = 2800) {
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Calculate grid dimensions
    this.gridWidth = Math.ceil(worldWidth / cellSize);
    this.gridHeight = Math.ceil(worldHeight / cellSize);
    this.totalCells = this.gridWidth * this.gridHeight;

    // Use typed arrays for maximum performance
    this.cellCounts = new Uint16Array(this.totalCells); // Items per cell
    this.cellOffsets = new Uint32Array(this.totalCells + 1); // Start indices in item array
    this.itemArray = new Array(1024); // Pre-allocated item storage
    this.itemCount = 0;

    // Pre-compute cell coordinates to avoid repeated calculations
    this.cellXCoords = new Int16Array(this.totalCells);
    this.cellYCoords = new Int16Array(this.totalCells);

    for (let i = 0; i < this.totalCells; i++) {
      this.cellXCoords[i] = i % this.gridWidth;
      this.cellYCoords[i] = Math.floor(i / this.gridWidth);
    }

    // Temporary result array to avoid allocations
    this.tempResults = new Array(256);

    // Spatial grid created silently - use getStats() for debug info
  }

  /**
   * Clear the grid for reuse
   */
  clear() {
    this.cellCounts.fill(0);
    this.cellOffsets.fill(0);
    this.itemCount = 0;
  }

  /**
   * Convert world coordinates to grid coordinates
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @returns {[number, number]} Grid coordinates
   */
  coords(x, y) {
    return [
      Math.max(0, Math.min(this.gridWidth - 1, Math.floor(x / this.cellSize))),
      Math.max(0, Math.min(this.gridHeight - 1, Math.floor(y / this.cellSize)))
    ];
  }

  /**
   * Get cell index from grid coordinates
   * @param {number} gx - Grid X coordinate
   * @param {number} gy - Grid Y coordinate
   * @returns {number} Cell index
   */
  getCellIndex(gx, gy) {
    return gy * this.gridWidth + gx;
  }

  /**
   * Expand item array if needed
   * @param {number} requiredSize - Minimum required size
   */
  ensureCapacity(requiredSize) {
    if (requiredSize >= this.itemArray.length) {
      const newSize = Math.max(requiredSize * 2, this.itemArray.length * 1.5);
      const newArray = new Array(newSize);
      for (let i = 0; i < this.itemCount; i++) {
        newArray[i] = this.itemArray[i];
      }
      this.itemArray = newArray;
    }
  }

  /**
   * Insert an item at world coordinates
   * @param {*} item - Item to insert
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   */
  insert(item, x, y) {
    const [gx, gy] = this.coords(x, y);
    const cellIndex = this.getCellIndex(gx, gy);

    // Ensure we have space
    this.ensureCapacity(this.itemCount + 1);

    // Insert item
    this.itemArray[this.itemCount] = item;
    this.itemCount++;

    // Update cell count
    this.cellCounts[cellIndex]++;
  }

  /**
   * Add an item (alias for insert using item's x,y coordinates)
   * For compatibility with world-creature-manager
   * @param {*} item - Item with x,y properties
   */
  add(item) {
    this.insert(item, item.x, item.y);
  }

  /**
   * Remove an item from the grid
   * Note: This is a no-op for the current implementation since the grid is rebuilt each frame
   * For compatibility with world-creature-manager
   * @param {*} item - Item to remove
   */
  remove(item) {
    // The grid is rebuilt each frame from scratch, so we don't need to track removals
    // This is just for API compatibility
  }

  /**
   * Build the spatial index after all insertions
   * Must be called after all items are inserted and before queries
   */
  buildIndex() {
    let offset = 0;
    for (let i = 0; i < this.totalCells; i++) {
      this.cellOffsets[i] = offset;
      offset += this.cellCounts[i];
    }
    this.cellOffsets[this.totalCells] = offset;

    // Sort items into cells (stable sort to maintain insertion order)
    const tempItems = new Array(this.itemCount);
    const tempCounts = new Uint16Array(this.totalCells);

    // Copy items to temporary array
    for (let i = 0; i < this.itemCount; i++) {
      tempItems[i] = this.itemArray[i];
    }

    // Clear original arrays
    this.cellCounts.fill(0);

    // Re-insert items in sorted order
    for (let i = 0; i < this.itemCount; i++) {
      const item = tempItems[i];
      // Note: We need to store position with item or pass it in
      // For now, assume items have x,y properties
      const [gx, gy] = this.coords(item.x, item.y);
      const cellIndex = this.getCellIndex(gx, gy);

      const targetIndex = this.cellOffsets[cellIndex] + tempCounts[cellIndex];
      this.itemArray[targetIndex] = item;
      tempCounts[cellIndex]++;
    }

    // Update cell counts
    for (let i = 0; i < this.totalCells; i++) {
      this.cellCounts[i] = tempCounts[i];
    }
  }

  /**
   * Find all items within a radius of a point (optimized version)
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} radius - Search radius
   * @param {Array} [outArray] - Optional output array to avoid allocation
   * @returns {Array} Array of nearby items
   */
  nearby(x, y, radius, outArray = null) {
    const [gx, gy] = this.coords(x, y);
    const r = Math.ceil(radius / this.cellSize);
    const result = outArray || this.tempResults;
    result.length = 0;

    const radiusSq = radius * radius;
    let resultCount = 0;

    // Pre-compute bounds to avoid repeated checks
    const minGX = Math.max(0, gx - r);
    const maxGX = Math.min(this.gridWidth - 1, gx + r);
    const minGY = Math.max(0, gy - r);
    const maxGY = Math.min(this.gridHeight - 1, gy + r);

    // Iterate over cells in search radius
    for (let cellGY = minGY; cellGY <= maxGY; cellGY++) {
      for (let cellGX = minGX; cellGX <= maxGX; cellGX++) {
        const cellIndex = this.getCellIndex(cellGX, cellGY);
        const cellStart = this.cellOffsets[cellIndex];
        const cellCount = this.cellCounts[cellIndex];

        // Check all items in this cell
        for (let i = 0; i < cellCount; i++) {
          const item = this.itemArray[cellStart + i];
          const dx = item.x - x;
          const dy = item.y - y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= radiusSq) {
            result[resultCount++] = item;
          }
        }
      }
    }

    // Trim result array to actual size
    if (result !== outArray) {
      result.length = resultCount;
    }

    return result;
  }

  /**
   * Find the nearest item to a point
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} maxRadius - Maximum search radius
   * @returns {*} Nearest item or null
   */
  nearest(x, y, maxRadius = 100) {
    const candidates = this.nearby(x, y, maxRadius, this.tempResults);
    let nearest = null;
    let minDistSq = maxRadius * maxRadius;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const dx = item.x - x;
      const dy = item.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = item;
      }
    }

    return nearest;
  }

  /**
   * Count items in a specific cell
   * @param {number} gx - Grid X coordinate
   * @param {number} gy - Grid Y coordinate
   * @returns {number} Item count
   */
  countInCell(gx, gy) {
    const cellIndex = this.getCellIndex(gx, gy);
    return this.cellCounts[cellIndex];
  }

  /**
   * Get grid statistics
   * @returns {Object} Statistics
   */
  getStats() {
    let totalItems = 0;
    let occupiedCells = 0;
    let maxItemsPerCell = 0;

    for (let i = 0; i < this.totalCells; i++) {
      const count = this.cellCounts[i];
      totalItems += count;
      if (count > 0) occupiedCells++;
      if (count > maxItemsPerCell) maxItemsPerCell = count;
    }

    return {
      gridSize: `${this.gridWidth}x${this.gridHeight}`,
      totalCells: this.totalCells,
      occupiedCells,
      totalItems,
      avgItemsPerCell: (totalItems / this.totalCells).toFixed(2),
      maxItemsPerCell,
      utilizationPercent: ((occupiedCells / this.totalCells) * 100).toFixed(1)
    };
  }

  /**
   * Debug visualization of grid occupancy
   * @returns {string} ASCII representation of grid
   */
  debugGrid() {
    const width = Math.min(this.gridWidth, 40); // Limit for readability
    const height = Math.min(this.gridHeight, 20);
    let output = '';

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const count = this.countInCell(x, y);
        if (count === 0) {
          output += '·';
        } else if (count < 10) {
          output += count.toString();
        } else {
          output += '*';
        }
      }
      output += '\n';
    }

    return output;
  }
}
