import { clamp } from './utils.js';
import { getLandscapeLandmarks } from './renderer-biome.js?v=20260423-assets1';

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
 * These are drawn instead as a soft tonal wash with a monoline symbol on top —
 * the way a field notebook marks terrain, in the world's own palette.
 */

const worldLandmarkCache = new WeakMap();

// Biome ink: the colour the symbol is drawn in, lifted off the ground tone so
// it reads as annotation rather than another piece of scenery.
const BIOME_INK = {
  forest: [126, 186, 148],
  jungle: [126, 186, 148],
  wetland: [118, 198, 190],
  water: [122, 190, 226],
  mountain: [166, 178, 198],
  tundra: [176, 194, 212],
  desert: [214, 178, 122],
  meadow: [178, 198, 128],
  grassland: [166, 190, 130]
};

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

/**
 * Monoline terrain symbols, drawn in a unit box roughly -1..1 on both axes so
 * the caller can scale them to any landmark radius.
 */
function drawSymbol(ctx, type, unit) {
  const u = unit;
  ctx.beginPath();
  switch (type) {
    case 'water':
      // Three drifting wave strokes.
      for (let i = -1; i <= 1; i++) {
        const y = i * 0.42 * u;
        ctx.moveTo(-0.95 * u, y);
        ctx.bezierCurveTo(-0.4 * u, y - 0.3 * u, 0.2 * u, y + 0.3 * u, 0.95 * u, y);
      }
      break;

    case 'wetland':
      // Reeds standing out of a single water line.
      ctx.moveTo(-0.95 * u, 0.55 * u);
      ctx.bezierCurveTo(-0.3 * u, 0.35 * u, 0.3 * u, 0.75 * u, 0.95 * u, 0.55 * u);
      for (const [x, lean] of [
        [-0.5, -0.18],
        [-0.1, 0.12],
        [0.36, -0.1],
        [0.72, 0.16]
      ]) {
        ctx.moveTo(x * u, 0.5 * u);
        ctx.quadraticCurveTo((x + lean * 0.5) * u, -0.15 * u, (x + lean) * u, -0.78 * u);
      }
      break;

    case 'mountain':
    case 'tundra': {
      // A ridge line: two peaks and a shoulder.
      ctx.moveTo(-1 * u, 0.6 * u);
      ctx.lineTo(-0.34 * u, -0.5 * u);
      ctx.lineTo(-0.02 * u, -0.02 * u);
      ctx.lineTo(0.36 * u, -0.82 * u);
      ctx.lineTo(1 * u, 0.6 * u);
      break;
    }

    case 'desert':
      // Stacked dune curves.
      for (const [y, w] of [
        [0.5, 1],
        [0.02, 0.72],
        [-0.46, 0.44]
      ]) {
        ctx.moveTo(-w * u, y * u);
        ctx.quadraticCurveTo(0, (y - 0.6) * u, w * u, y * u);
      }
      break;

    case 'forest':
    case 'jungle':
      // Three conifers on a shared ground line.
      for (const [x, h] of [
        [-0.6, 0.9],
        [0.05, 1.25],
        [0.66, 0.95]
      ]) {
        ctx.moveTo(x * u, 0.65 * u);
        ctx.lineTo(x * u, (0.65 - h * 0.35) * u);
        ctx.moveTo((x - 0.3) * u, (0.65 - h * 0.3) * u);
        ctx.lineTo(x * u, (0.65 - h) * u);
        ctx.lineTo((x + 0.3) * u, (0.65 - h * 0.3) * u);
      }
      break;

    default:
      // Meadow / grassland: seed heads on stems.
      for (const [x, lean, h] of [
        [-0.62, -0.16, 1.1],
        [-0.12, 0.1, 1.35],
        [0.38, -0.08, 1.05],
        [0.78, 0.14, 0.85]
      ]) {
        ctx.moveTo(x * u, 0.7 * u);
        ctx.quadraticCurveTo((x + lean * 0.4) * u, 0, (x + lean) * u, (0.7 - h) * u);
      }
      break;
  }
  ctx.stroke();
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
    const [ir, ig, ib] = BIOME_INK[biomeType] || BIOME_INK.grassland;
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

    // Monoline symbol. Kept quiet so it labels the terrain rather than
    // competing with the creatures living on it.
    const unit = landmark.radius * 0.3;
    ctx.translate(landmark.x, landmark.y);
    ctx.globalAlpha = clamp(0.2 + zoom * 0.12, 0.2, 0.38);
    ctx.strokeStyle = `rgb(${ir}, ${ig}, ${ib})`;
    ctx.lineWidth = Math.max(1.2, unit * 0.075);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSymbol(ctx, biomeType, unit);

    ctx.restore();
  }
}
