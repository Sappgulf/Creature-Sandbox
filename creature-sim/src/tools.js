export const ToolModes = Object.freeze({
  INSPECT: 'inspect',
  FOOD: 'food',
  SPAWN: 'spawn',
  ERASE: 'erase'
});

export class ToolController {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.mode = ToolModes.INSPECT;
    this.brushSize = 26;
  }

  setMode(mode) {
    this.mode = mode;
  }

  apply(localX, localY, opts={}) {
    const { shiftKey=false } = opts;
    const { x, y } = this.camera.screenToWorld(localX, localY);
    switch (this.mode) {
      case ToolModes.FOOD:
        this.scatterFood(x, y, shiftKey ? 2 : 10);
        break;
      case ToolModes.SPAWN:
        this.spawnCreature(x, y, shiftKey);
        break;
      case ToolModes.ERASE:
        this.eraseCreatures(x, y);
        break;
      default:
        break;
    }
  }

  scatterFood(x, y, amount=10) {
    for (let i=0;i<amount;i++) {
      this.world.addFood(
        x + (Math.random()-0.5)*this.brushSize,
        y + (Math.random()-0.5)*this.brushSize,
        1.2
      );
    }
  }

  spawnCreature(x, y, predator=false) {
    this.world.spawnManual(x, y, predator);
  }

  eraseCreatures(x, y) {
    const candidates = this.world.queryCreatures(x, y, this.brushSize*0.7);
    candidates.forEach(c => c.alive = false);
    if (candidates.length) this.world.gridDirty = true;
  }
}
