import { clamp } from './utils.js';
import { assetLoader } from './asset-loader.js?v=20260423-assets1';
import { getLandscapeLandmarks } from './renderer-biome.js?v=20260423-assets1';

const frameByBiome = {
  forest: 1,
  jungle: 1,
  wetland: 2,
  water: 3,
  mountain: 4,
  tundra: 4,
  desert: 5
};
const pendingLandmarkRequests = new Set();
const worldLandmarkCache = new WeakMap();

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

function landmarkFrame(biome, fallback) {
  return frameByBiome[biome?.type] ?? fallback ?? 0;
}

function drawAtlasFrame(ctx, sheet, frame, x, y, size) {
  if (!sheet?.image) return false;
  ctx.drawImage(sheet.image, Math.max(0, frame) * 128, 0, 128, 128, x - size / 2, y - size / 2, size, size);
  return true;
}

function drawFallback(ctx, x, y, size, frame) {
  const half = size * 0.28;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= 0.82;
  ctx.lineJoin = 'round';
  if (frame === 3) {
    ctx.strokeStyle = 'rgba(132, 232, 255, 0.82)';
    ctx.lineWidth = Math.max(2, size * 0.035);
    for (const offset of [0, half * 0.42]) {
      ctx.beginPath();
      ctx.moveTo(-half * (offset ? 1.5 : 1.8), offset);
      ctx.bezierCurveTo(-half, -half * (offset ? 0.2 : 1), half * 0.4, half, half * (offset ? 1.5 : 1.8), offset);
      ctx.stroke();
    }
  } else if (frame === 4) {
    ctx.fillStyle = 'rgba(126, 166, 226, 0.82)';
    ctx.beginPath();
    ctx.moveTo(-half * 1.8, size * 0.2);
    ctx.lineTo(-half * 0.45, -half * 1.25);
    ctx.lineTo(0, -half * 0.38);
    ctx.lineTo(half * 0.58, -half * 1.7);
    ctx.lineTo(half * 1.8, size * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (frame === 5) {
    ctx.fillStyle = 'rgba(222, 142, 65, 0.84)';
    for (const [offset, height] of [
      [-1.45, 1.45],
      [-0.55, 2.15],
      [0.45, 1.75]
    ]) {
      ctx.fillRect(offset * half, -height * half * 0.5, half * 0.62, height * half);
    }
  } else if (frame === 1) {
    ctx.fillStyle = 'rgba(49, 151, 125, 0.82)';
    for (const [offset, height] of [
      [-0.9, 1.2],
      [0, 1.8],
      [0.9, 1.25]
    ]) {
      ctx.beginPath();
      ctx.moveTo(offset * half, size * 0.2);
      ctx.lineTo(offset * half - half * 0.62, size * 0.2 - half * height);
      ctx.lineTo(offset * half, size * 0.2 - half * (height + 0.42));
      ctx.lineTo(offset * half + half * 0.62, size * 0.2 - half * height);
      ctx.closePath();
      ctx.fill();
    }
  } else if (frame === 2) {
    ctx.fillStyle = 'rgba(44, 203, 187, 0.76)';
    ctx.beginPath();
    ctx.ellipse(0, half * 0.12, half * 1.65, half * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(164, 255, 221, 0.76)';
    ctx.lineWidth = Math.max(1.5, size * 0.025);
    for (const offset of [-0.85, 0.2, 1]) {
      ctx.beginPath();
      ctx.moveTo(offset * half, half * 1.05);
      ctx.quadraticCurveTo((offset - 0.2) * half, -half * 0.3, (offset + 0.12) * half, -half * 1.1);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(102, 183, 104, 0.78)';
    ctx.beginPath();
    ctx.ellipse(0, half * 0.12, half * 1.8, half * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(224, 255, 153, 0.86)';
    for (const [offsetX, offsetY] of [
      [-0.85, -0.2],
      [0.05, -0.55],
      [0.85, 0.1],
      [-0.15, 0.55]
    ]) {
      ctx.beginPath();
      ctx.arc(offsetX * half, offsetY * half, Math.max(2, size * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function requestLandmarks() {
  if (pendingLandmarkRequests.has('env_landmarks')) return;
  pendingLandmarkRequests.add('env_landmarks');
  assetLoader
    .requestSpriteFrames('env_landmarks', { size: 128 })
    .catch(error => console.debug('[Renderer] landmark sprite load failed:', error))
    .finally(() => pendingLandmarkRequests.delete('env_landmarks'));
}

export function drawLandscapeLandmarks(renderer, ctx, world) {
  const zoom = renderer.camera.zoom;
  if (zoom < 0.18 || !world) return;
  const bounds = renderer._viewBounds;
  const landmarks = getCachedLandmarks(world);
  // The main-thread fallback preserves its established frame budget and
  // relies on the stronger ground/resource layers; the full atlas layer is a
  // progressive enhancement for the shipping worker renderer.
  if (!world.worldSnapshot) return;
  const biomes = getCachedBiomes(world, landmarks);
  const iconScale = clamp(0.62 + zoom * 0.1, 0.62, 0.88);

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
    const biome = biomes[index];
    const [r, g, b] = {
      forest: [36, 68, 58],
      desert: [98, 76, 46],
      tundra: [70, 86, 108],
      mountain: [74, 66, 62],
      wetland: [42, 82, 74],
      water: [34, 74, 116],
      meadow: [72, 94, 60],
      grassland: [62, 82, 52]
    }[biome?.type] || [62, 82, 52];
    const radiusX = landmark.radius * 0.96;
    const radiusY = landmark.radius * 0.5;
    ctx.save();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${clamp(0.05 + zoom * 0.025, 0.05, 0.08)})`;
    ctx.beginPath();
    ctx.ellipse(landmark.x, landmark.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${Math.min(255, r + 54)}, ${Math.min(255, g + 54)}, ${Math.min(255, b + 54)}, ${clamp(0.18 + zoom * 0.04, 0.18, 0.26)})`;
    ctx.lineWidth = Math.max(1.1, 1.8 / zoom);
    ctx.beginPath();
    ctx.ellipse(landmark.x, landmark.y, radiusX * 0.9, radiusY * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const frame = landmarkFrame(biome, landmark.fallbackFrame);
    const size = landmark.radius * iconScale;
    const imageFrame = assetLoader.getSpriteFrameSync('env_landmarks', frame, 128);
    if (imageFrame) {
      ctx.save();
      ctx.globalAlpha = clamp(0.64 + zoom * 0.12, 0.64, 0.86);
      ctx.drawImage(imageFrame, landmark.x - size / 2, landmark.y - size / 2, size, size);
      ctx.restore();
    } else if (!drawAtlasFrame(ctx, assetLoader.getSpriteSheet('env_landmarks'), frame, landmark.x, landmark.y, size)) {
      requestLandmarks();
      drawFallback(ctx, landmark.x, landmark.y, size, frame);
    }
  }
}
