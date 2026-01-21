/**
 * Batch Renderer - Placeholder for batched Canvas2D draw calls
 * Provides a stub implementation to prevent import errors
 */

export const batchRenderer = {
  _ctx: null,
  _ready: false,

  init(ctx) {
    this._ctx = ctx;
    this._ready = !!ctx;
    return this._ready;
  },

  isReady() {
    return this._ready;
  },

  flush() {
    // No-op: standard canvas 2D doesn't need explicit flushing
  }
};
