/**
 * ECS World - Minimal Entity Component System stub
 * Provides a no-op implementation to prevent import errors
 * Can be expanded for future ECS-based optimizations
 */

export const ecsWorld = {
  entities: [],

  update(_dt) {
    // No-op placeholder for ECS tick
    // Future: process systems here
  },

  addEntity(entity) {
    this.entities.push(entity);
    return entity;
  },

  removeEntity(entity) {
    const idx = this.entities.indexOf(entity);
    if (idx !== -1) this.entities.splice(idx, 1);
  },

  clear() {
    this.entities = [];
  }
};
