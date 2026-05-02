// @ts-check
/**
 * Camera Bookmark System
 * Save and recall camera positions with keyboard shortcuts.
 */

const STORAGE_KEY = 'creature-sandbox-camera-bookmarks';

export class CameraBookmarks {
  constructor(camera) {
    this.camera = camera;
    this.slots = this._load();
    this.maxSlots = 5;
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return {};
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.slots));
    } catch {
      // Ignore
    }
  }

  save(slot) {
    if (!this.camera || slot < 1 || slot > this.maxSlots) return false;
    this.slots[slot] = {
      x: this.camera.x,
      y: this.camera.y,
      zoom: this.camera.zoom || 1,
      savedAt: Date.now()
    };
    this._save();
    return true;
  }

  load(slot) {
    if (!this.camera || slot < 1 || slot > this.maxSlots) return false;
    const bookmark = this.slots[slot];
    if (!bookmark) return false;

    this.camera.focusOn(bookmark.x, bookmark.y);
    if (typeof this.camera.setZoom === 'function') {
      this.camera.setZoom(bookmark.zoom);
    } else {
      this.camera.zoom = bookmark.zoom;
      this.camera.targetZoom = bookmark.zoom;
    }
    return true;
  }

  has(slot) {
    return !!this.slots[slot];
  }

  getSlotInfo(slot) {
    const b = this.slots[slot];
    if (!b) return null;
    return {
      slot,
      x: Math.round(b.x),
      y: Math.round(b.y),
      zoom: b.zoom.toFixed(2),
      savedAt: b.savedAt
    };
  }

  getAll() {
    const result = [];
    for (let i = 1; i <= this.maxSlots; i++) {
      result.push(this.getSlotInfo(i));
    }
    return result;
  }

  clear(slot) {
    delete this.slots[slot];
    this._save();
  }

  reset() {
    this.slots = {};
    this._save();
  }
}
