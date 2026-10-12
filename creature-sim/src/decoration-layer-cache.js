// One viewport-sized surface per static layer. Palette rounding bounds
// fade error to 1/1024 while avoiding hundreds of static draws every frame.
// Terrain keeps its original twenty seasonal buckets.
export function getTerrainLayerKey(world, season, phase) {
  const seed = world.worldSeed ?? world.biomeGenerator?.seed ?? world._saveExtras?.biomeSeed ?? '';
  return [Math.round(world.width), Math.round(world.height), season, Math.round((phase || 0) * 20), seed].join('|');
}

export class DecorationLayerCache {
  getOrBuild(state, build) {
    const { source, revision, season, phase, width, height, matrix, smoothing, quality, panMargin = 0 } = state;
    if (
      ![width, height, phase, ...matrix].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0 ||
      !Number.isFinite(panMargin) ||
      panMargin < 0 ||
      (width + panMargin * 2) * (height + panMargin * 2) > 4_194_304
    )
      return null;
    const sampledPhase = Math.round(phase * 512) / 512;
    const key = [
      revision,
      season,
      sampledPhase,
      width,
      height,
      ...matrix.slice(0, 4),
      panMargin,
      smoothing,
      quality
    ].join('|');
    const dx = matrix[4] - (this.anchorX ?? matrix[4]);
    const dy = matrix[5] - (this.anchorY ?? matrix[5]);
    if (
      this.canvas &&
      this.source === source &&
      this.length === source.length &&
      this.key === key &&
      Math.abs(dx) <= panMargin &&
      Math.abs(dy) <= panMargin
    ) {
      this.offset = { x: dx - panMargin, y: dy - panMargin };
      return this.canvas;
    }
    const canvas = build(this.canvas, { currentSeason: season, seasonPhase: sampledPhase });
    if (!canvas) return null;
    this.anchorX = matrix[4];
    this.anchorY = matrix[5];
    this.offset = { x: -panMargin, y: -panMargin };
    this.canvas = canvas;
    this.source = source;
    this.length = source.length;
    this.key = key;
    return canvas;
  }
}
