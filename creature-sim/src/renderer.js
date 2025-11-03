import { clamp } from './utils.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.camera = camera;
    this.enableTrails = true;
    this.background = '#0b0c10';
    // Cache lineage computation
    this._lineageCache = { rootId: null, set: null, frame: 0 };
  }

  clear(width, height) {
    this.ctx.save();
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0,0,width,height);
    this.ctx.restore();
  }

  drawWorld(world, opts={}) {
    const { selectedId=null, pinnedId=null, lineageRootId=null } = opts;
    const camera = this.camera;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(opts.viewportWidth/2, opts.viewportHeight/2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.drawFood(world.food);
    
    // Cache lineage descendants to avoid expensive BFS every frame
    let lineageSet = null;
    if (lineageRootId) {
      if (this._lineageCache.rootId === lineageRootId && this._lineageCache.frame === world.t) {
        lineageSet = this._lineageCache.set;
      } else {
        lineageSet = world.descendantsOf(lineageRootId);
        this._lineageCache = { rootId: lineageRootId, set: lineageSet, frame: world.t };
      }
    }
    
    this.drawCreatures(world.creatures, { selectedId, pinnedId, lineageSet });

    ctx.restore();
  }

  drawFood(food) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(126,210,120,0.85)';
    for (let f of food) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  drawCreatures(creatures, opts) {
    const ctx = this.ctx;
    for (let c of creatures) {
      const inLineage = opts.lineageSet ? opts.lineageSet.has(c.id) : false;
      const isSelected = opts.selectedId === c.id;
      const isPinned = opts.pinnedId === c.id;
      const alpha = clamp(c.energy / 40, 0.25, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      c.draw(ctx, {
        isSelected,
        isPinned,
        inLineage,
        showTrail: this.enableTrails
      });
      ctx.restore();
    }
  }
}
