// @ts-check
/**
 * Ecosystem Ghost Trails
 * Records death positions and renders faint spectral trails over time.
 */

export class GhostTrailSystem {
  constructor() {
    this.ghosts = [];
    this.maxGhosts = 60;
    this.fadeDuration = 45; // seconds
  }

  recordDeath(x, y, creature) {
    const hue = creature?.genes?.hue ?? 200;
    const isPredator = creature?.genes?.predator || (creature?.genes?.diet > 0.7);
    this.ghosts.push({
      x, y, hue, isPredator,
      bornAt: performance.now() * 0.001,
      size: creature?.size || 5
    });
    if (this.ghosts.length > this.maxGhosts) {
      this.ghosts.shift();
    }
  }

  update() {
    if (this.ghosts.length === 0) return;
    const now = performance.now() * 0.001;
    let writeIndex = 0;
    for (let i = 0; i < this.ghosts.length; i++) {
      const ghost = this.ghosts[i];
      if ((now - ghost.bornAt) >= this.fadeDuration) continue;
      if (writeIndex !== i) {
        this.ghosts[writeIndex] = ghost;
      }
      writeIndex++;
    }
    this.ghosts.length = writeIndex;
  }

  draw(ctx, camera, worldTime) {
    if (this.ghosts.length === 0) return;
    const now = performance.now() * 0.001;
    ctx.save();
    for (const g of this.ghosts) {
      const age = now - g.bornAt;
      const life = 1 - age / this.fadeDuration;
      if (life <= 0) continue;
      const alpha = life * 0.12;
      const pulse = 0.8 + Math.sin(worldTime * 2 + g.x) * 0.2;
      const r = g.size * pulse;

      ctx.fillStyle = `hsla(${g.hue}, ${g.isPredator ? 70 : 50}%, 60%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Faint outer ring
      ctx.strokeStyle = `hsla(${g.hue}, ${g.isPredator ? 70 : 50}%, 70%, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(g.x, g.y, r * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export const ghostTrails = new GhostTrailSystem();
