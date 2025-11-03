import { clamp } from './utils.js';

/**
 * Simple 2D camera with smooth pan/zoom controls.
 */
export class Camera {
  constructor({
    x=0,
    y=0,
    zoom=1,
    minZoom=0.4,
    maxZoom=3,
    worldWidth=1000,
    worldHeight=700,
    viewportWidth=1000,
    viewportHeight=700
  } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.targetZoom = zoom;
    this.targetX = x;
    this.targetY = y;
    this.smooth = 0.18;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this._refreshMinZoom();
    this._clampTargets();
  }

  /** Apply smooth interpolation toward target pan/zoom each frame. */
  update(dt) {
    const lerp = (a,b,t)=>a+(b-a)*t;
    const t = 1 - Math.pow(1 - this.smooth, Math.min(dt*60, 1));
    this.zoom = lerp(this.zoom, this.targetZoom, t);
    this._clampZoom();
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);
    this._clampPosition();
  }

  setZoom(next) {
    this.targetZoom = clamp(next, this.minZoom, this.maxZoom);
    this._clampTargets();
  }

  zoomBy(delta) {
    this.setZoom(this.targetZoom * (1 - delta));
  }

  pan(dx, dy) {
    this.targetX += dx / this.zoom;
    this.targetY += dy / this.zoom;
    this._clampTargets();
  }

  focusOn(x, y) {
    this.targetX = x;
    this.targetY = y;
    this._clampTargets();
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

  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this._refreshMinZoom();
    this._clampTargets();
  }

  _refreshMinZoom() {
    const fitZoom = Math.min(
      this.viewportWidth / this.worldWidth,
      this.viewportHeight / this.worldHeight
    );
    const clampedFit = Math.min(fitZoom * 0.9, this.maxZoom);
    this.minZoom = clampedFit;
    this._clampZoom();
  }

  _clampZoom() {
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
    this.targetZoom = clamp(this.targetZoom, this.minZoom, this.maxZoom);
  }

  _clampTargets() {
    const { minX, maxX, minY, maxY } = this._limits(this.targetZoom);
    this.targetX = clamp(this.targetX, minX, maxX);
    this.targetY = clamp(this.targetY, minY, maxY);
  }

  _clampPosition() {
    const { minX, maxX, minY, maxY } = this._limits(this.zoom);
    this.x = clamp(this.x, minX, maxX);
    this.y = clamp(this.y, minY, maxY);
  }

  _limits(zoom) {
    const halfW = this.viewportWidth / (2 * zoom);
    const halfH = this.viewportHeight / (2 * zoom);
    return {
      minX: halfW,
      maxX: Math.max(halfW, this.worldWidth - halfW),
      minY: halfH,
      maxY: Math.max(halfH, this.worldHeight - halfH)
    };
  }
}
