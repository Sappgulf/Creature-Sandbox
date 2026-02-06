import { clamp } from './utils.js';

// Debug flag for camera movement logging
const DEBUG_CAMERA = false;

/**
 * Simple 2D camera with smooth pan/zoom controls.
 * Includes ownership model to prevent unwanted automatic movement.
 */
export class Camera {
  constructor({
    x = 0,
    y = 0,
    zoom = 1,
    minZoom = 0.4,
    maxZoom = 3,
    worldWidth = 1000,
    worldHeight = 700,
    viewportWidth = 1000,
    viewportHeight = 700
  } = {}) {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.targetZoom = zoom;
    this.targetX = x;
    this.targetY = y;
    this.smooth = 0.14;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.travel = null;

    // Follow mode
    this.followMode = 'free'; // 'free', 'follow', 'smooth-follow'
    this.followTarget = null; // creature ID
    this.followSmoothing = 0.12; // smoother than normal pan
    this.followZoomAdjust = false; // keep follow framing stable unless explicitly enabled

    // Camera ownership model - prevents unwanted automatic movement
    this.userPermanentOverride = false; // User has taken control, no auto until re-enabled
    this.userOverrideUntil = 0; // Timestamp-based temporary override
    this.lastMoveSource = 'init'; // Track what moved the camera last

    // Movement tracking for auto-hide overlays
    this.isMoving = false;
    this.movementThreshold = 0.8; // Distance threshold to consider "moving"

    this._refreshMinZoom();
    this._clampTargets();
  }

  /**
   * Check if automatic camera systems (auto-director, follow) can move the camera.
   * Returns false if user has taken permanent control.
   */
  canAutoMove() {
    if (this.userPermanentOverride) {
      if (DEBUG_CAMERA) console.log('[CAM] canAutoMove=false (userPermanentOverride)');
      return false;
    }
    const now = performance.now();
    if (now < this.userOverrideUntil) {
      if (DEBUG_CAMERA) console.log('[CAM] canAutoMove=false (temporary override)');
      return false;
    }
    return true;
  }

  /**
   * Mark that user has taken manual control of the camera.
   * Blocks all automatic movement until clearUserOverride() is called.
   */
  setUserOverride(permanent = true) {
    if (permanent) {
      this.userPermanentOverride = true;
      this.lastMoveSource = 'user';
      if (DEBUG_CAMERA) console.log('[CAM] User permanent override set');
    } else {
      this.userOverrideUntil = performance.now() + 6000; // 6 second temporary override
      if (DEBUG_CAMERA) console.log('[CAM] User temporary override set (6s)');
    }
  }

  /**
   * Clear user override, allowing automatic camera movement again.
   */
  clearUserOverride() {
    this.userPermanentOverride = false;
    this.userOverrideUntil = 0;
    if (DEBUG_CAMERA) console.log('[CAM] User override cleared');
  }

  /** Apply smooth interpolation toward target pan/zoom each frame. */
  update(dt) {
    const lerp = (a, b, t) => a + (b - a) * t;
    const t = 1 - Math.pow(1 - this.smooth, Math.min(dt * 60, 1));
    if (this.travel) {
      this._updateTravel(dt);
    }
    this.zoom = lerp(this.zoom, this.targetZoom, t);
    this._clampZoom();
    this.x = lerp(this.x, this.targetX, t);
    this.y = lerp(this.y, this.targetY, t);
    if (Math.abs(this.zoom - this.targetZoom) < 0.002) this.zoom = this.targetZoom;
    if (Math.abs(this.x - this.targetX) < 0.05) this.x = this.targetX;
    if (Math.abs(this.y - this.targetY) < 0.05) this.y = this.targetY;
    this._clampPosition();

    // Track if camera is moving (for auto-hide overlays)
    const dx = Math.abs(this.x - this.targetX);
    const dy = Math.abs(this.y - this.targetY);
    const dz = Math.abs(this.zoom - this.targetZoom);
    this.isMoving = (dx > this.movementThreshold || dy > this.movementThreshold || dz > 0.01) || this.travel !== null;
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
    const clamped = this._clampPoint(x, y, this.targetZoom);
    this.targetX = clamped.x;
    this.targetY = clamped.y;
    this._clampTargets();
    this.travel = null;
  }

  startTravel(x, y, duration = 1.5) {
    const clamped = this._clampPoint(x, y, this.targetZoom);
    const safeDuration = Math.max(0.2, duration);
    this.travel = {
      fromX: this.targetX,
      fromY: this.targetY,
      toX: clamped.x,
      toY: clamped.y,
      duration: safeDuration,
      elapsed: 0,
      easing: 'easeOutCubic'
    };
  }

  getTravelState() {
    if (!this.travel) return null;
    const t = Math.min(1, this.travel.elapsed / this.travel.duration);
    return {
      from: { x: this.travel.fromX, y: this.travel.fromY },
      to: { x: this.travel.toX, y: this.travel.toY },
      progress: t
    };
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
    const clampedFit = Math.min(fitZoom * 0.75, this.maxZoom);
    this.minZoom = clampedFit;
    this._clampZoom();
  }

  zoomByAt(delta, screenX = 0, screenY = 0) {
    const clampedDelta = clamp(delta, -0.45, 0.45);
    const target = clamp(this.targetZoom * (1 - clampedDelta), this.minZoom, this.maxZoom);
    if (!Number.isFinite(target) || target === this.targetZoom) return;

    // Keep the world point under cursor stable while zooming.
    const beforeX = screenX / this.targetZoom + this.targetX;
    const beforeY = screenY / this.targetZoom + this.targetY;

    this.targetZoom = target;

    const afterX = screenX / this.targetZoom + this.targetX;
    const afterY = screenY / this.targetZoom + this.targetY;

    this.targetX += beforeX - afterX;
    this.targetY += beforeY - afterY;
    this._clampTargets();
  }

  _clampZoom() {
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
    this.targetZoom = clamp(this.targetZoom, this.minZoom, this.maxZoom);
  }

  _clampTargets() {
    // REMOVED: No world boundaries - camera can move freely
    // No clamping needed
  }

  _clampPosition() {
    // REMOVED: No world boundaries - camera can move freely
    // No clamping needed
  }

  _limits(zoom) {
    // REMOVED: No world boundaries - camera can move freely anywhere
    // Return infinite bounds
    return {
      minX: -Infinity,
      maxX: Infinity,
      minY: -Infinity,
      maxY: Infinity
    };
  }

  _clampPoint(x, y, zoom = this.targetZoom) {
    // REMOVED: No boundaries - return point as-is
    return { x, y };
  }

  _updateTravel(dt) {
    const travel = this.travel;
    if (!travel) return;
    travel.elapsed += dt;
    const t = Math.min(1, travel.elapsed / travel.duration);
    const eased = this._ease(travel.easing, t);
    this.targetX = travel.fromX + (travel.toX - travel.fromX) * eased;
    this.targetY = travel.fromY + (travel.toY - travel.fromY) * eased;
    this._clampTargets();
    if (t >= 1) {
      this.targetX = travel.toX;
      this.targetY = travel.toY;
      this.travel = null;
    }
  }

  _ease(type, t) {
    switch (type) {
      case 'easeOutCubic':
      default:
        return 1 - Math.pow(1 - t, 3);
    }
  }
}
