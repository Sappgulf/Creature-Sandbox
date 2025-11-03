/**
 * Spatial hash grid for broad-phase queries.
 */
export class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  static _key(x,y){ return `${x},${y}`; }

  clear() {
    this.cells.clear();
  }

  _coords(x,y) {
    return [Math.floor(x/this.cellSize), Math.floor(y/this.cellSize)];
  }

  insert(item, x, y) {
    const [gx, gy] = this._coords(x, y);
    const key = SpatialGrid._key(gx, gy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(item);
  }

  nearby(x, y, radius) {
    const [gx, gy] = this._coords(x,y);
    const r = Math.ceil(radius / this.cellSize);
    const results = [];
    for (let oy=-r; oy<=r; oy++) {
      for (let ox=-r; ox<=r; ox++) {
        const key = SpatialGrid._key(gx+ox, gy+oy);
        const cell = this.cells.get(key);
        if (cell) results.push(...cell);
      }
    }
    return results;
  }
}
