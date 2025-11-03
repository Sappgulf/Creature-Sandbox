/**
 * Simple 2D camera with smooth pan/zoom controls.
 */
export class Camera {
  constructor({ x=0, y=0, zoom=1, minZoom=0.4, maxZoom=3 } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.targetZoom = zoom;
    this.targetX = x;
    this.targetY = y;
    this.smooth = 0.18;
  }

  /** Apply smooth interpolation toward target pan/zoom each frame. */
  update(dt) {
    const lerp = (a,b,t)=>a+(b-a)*t;
    const t = 1 - Math.pow(1 - this.smooth, Math.min(dt*60, 1));
    this.zoom = lerp(this.zoom, this.targetZoom, t);
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);
  }

  setZoom(next) {
    this.targetZoom = clamp(next, this.minZoom, this.maxZoom);
  }

  zoomBy(delta) {
    this.setZoom(this.targetZoom * (1 - delta));
  }

  pan(dx, dy) {
    this.targetX += dx / this.zoom;
    this.targetY += dy / this.zoom;
  }

  focusOn(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.x) * this.zoom,
      y: (y - this.y) * this.zoom
    };
  }

  screenToWorld(x, y) {
    return {
      x: x / this.zoom + this.x,
      y: y / this.zoom + this.y
    };
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
