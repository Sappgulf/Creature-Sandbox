import { clamp } from './utils.js';
import { getLandscapeLandmarks } from './renderer-biome.js';

/**
 * Landmarks are the map's legend — the shapes a player navigates by when the
 * field is otherwise a wash of ground cover.
 *
 * The previous layer drew each one as a hard stroked ellipse with a flat
 * illustrated icon (a snow-capped mountain, a lily pond) dropped in the
 * middle. Neither belonged: the ring was the only hard geometric edge in a
 * world made of organic shapes and read as a leftover debug overlay, and the
 * icons came from a different art vocabulary than everything around them.
 *
 * These are drawn instead as a soft tonal wash —
 * a colour cue for the terrain in the world's own palette, with no symbol drawn on the playfield.
 */

const worldLandmarkCache = new WeakMap();

const BIOME_WASH = {
  forest: [36, 68, 58],
  jungle: [34, 74, 58],
  wetland: [42, 82, 74],
  water: [34, 74, 116],
  mountain: [74, 66, 62],
  tundra: [70, 86, 108],
  desert: [98, 76, 46],
  meadow: [72, 94, 60],
  grassland: [62, 82, 52]
};

function getCachedLandmarks(world) {
  const cacheKey = `${world.width}:${world.height}`;
  const cached = worldLandmarkCache.get(world);
  if (cached?.key === cacheKey) return cached.landmarks;
  const landmarks = getLandscapeLandmarks(world.width, world.height);
  worldLandmarkCache.set(world, { key: cacheKey, landmarks });
  return landmarks;
}

function getCachedBiomes(world, landmarks) {
  const seed = world.biomeGenerator?.seed ?? world.biomeSeed ?? 'default';
  const cached = worldLandmarkCache.get(world);
  if (cached?.biomeSeed === seed && cached.biomes) return cached.biomes;
  const biomes = landmarks.map(landmark => world.getBiomeAt?.(landmark.x, landmark.y));
  worldLandmarkCache.set(world, {
    ...(cached || {}),
    key: `${world.width}:${world.height}`,
    landmarks,
    biomeSeed: seed,
    biomes
  });
  return biomes;
}

export function drawLandscapeLandmarks(renderer, ctx, world) {
  const zoom = renderer.camera.zoom;
  if (zoom < 0.18 || !world) return;
  const bounds = renderer._viewBounds;
  const landmarks = getCachedLandmarks(world);
  // The main-thread fallback preserves its established frame budget and
  // relies on the stronger ground/resource layers; the full landmark layer is
  // a progressive enhancement for the shipping worker renderer.
  if (!world.worldSnapshot) return;
  const biomes = getCachedBiomes(world, landmarks);

  for (let index = 0; index < landmarks.length; index++) {
    const landmark = landmarks[index];
    if (
      landmark.x < bounds.x1 - landmark.radius ||
      landmark.x > bounds.x2 + landmark.radius ||
      landmark.y < bounds.y1 - landmark.radius ||
      landmark.y > bounds.y2 + landmark.radius
    ) {
      continue;
    }

    const biomeType = biomes[index]?.type || 'grassland';
    const [wr, wg, wb] = BIOME_WASH[biomeType] || BIOME_WASH.grassland;
    const radiusX = landmark.radius * 0.96;
    const radiusY = landmark.radius * 0.5;

    ctx.save();

    // Tonal wash with no edge. A radial gradient fading fully to transparent
    // marks the region without drawing a boundary the world does not have.
    const wash = ctx.createRadialGradient(landmark.x, landmark.y, 0, landmark.x, landmark.y, radiusX);
    const washAlpha = clamp(0.1 + zoom * 0.05, 0.1, 0.17);
    wash.addColorStop(0, `rgba(${wr}, ${wg}, ${wb}, ${washAlpha})`);
    wash.addColorStop(0.62, `rgba(${wr}, ${wg}, ${wb}, ${washAlpha * 0.5})`);
    wash.addColorStop(1, `rgba(${wr}, ${wg}, ${wb}, 0)`);
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.ellipse(landmark.x, landmark.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // A monoline terrain glyph (stems, reeds, ridges) used to be drawn here
    // at landmark scale; on the playfield it read as giant pale strokes
    // standing in the grass, so only the tonal wash remains.

    ctx.restore();
  }
}
