import { assetLoader } from './asset-loader.js';
import { colorCache } from './color-cache.js';
import { clamp } from './utils.js';

const SPRITE_SIZES = [32, 48, 64, 96, 128];
const pendingSpriteRequests = new Set();

function numericGene(value, fallback = 0) {
  if (value && typeof value === 'object') {
    const expressed = Number(value.expressed ?? value.value ?? value.mean);
    return Number.isFinite(expressed) ? expressed : fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function quantizeHue(value) {
  const hue = numericGene(value, 0);
  return (((Math.round(hue / 24) * 24) % 360) + 360) % 360;
}

export function getCreatureAssetKey(creature = {}) {
  const genes = creature.genes || {};
  const creatureType = creature.traits?.creatureType || creature.creatureType || null;
  const aquaticAffinity = numericGene(creature.aquaticAffinity, 0);
  const diet = numericGene(genes.diet, genes.predator ? 1 : 0);

  if (creature.ageStage === 'baby') return 'creature_baby';
  if (creature.ageStage === 'elder') return 'creature_elder';
  if (creatureType === 'flying') return 'creature_flying';
  if (creatureType === 'burrowing') return 'creature_burrowing';
  if (aquaticAffinity > 0.6) return 'creature_aquatic';
  if (creature.socialRank === 'alpha') return 'creature_alpha';
  if (diet > 0.7 || genes.predator) return 'creature_predator';
  if (diet > 0.3) return 'creature_omnivore';
  return 'creature_herbivore';
}

export function getCreatureHue(creature = {}, clusterHue = null) {
  const genes = creature.genes || {};
  return quantizeHue(clusterHue ?? genes.hue ?? 0);
}

export function getCreatureSpriteColor(creature = {}, clusterHue = null) {
  const predator = Boolean(creature.genes?.predator) || getCreatureAssetKey(creature) === 'creature_predator';
  return colorCache.cssHsl(getCreatureHue(creature, clusterHue), 85, predator ? 50 : 60);
}

export function getCreatureAnimationDetails(creature = {}) {
  const state = creature.animation?.state || creature.state || 'idle';
  const speedRatio = clamp(numericGene(creature.animation?.speedRatio, 0.5), 0.2, 2);
  let speedScale = 0.7;
  if (state === 'walking') speedScale = 0.9 + speedRatio * 0.7;
  else if (state === 'running') speedScale = 1.1 + speedRatio * 1.1;
  else if (state === 'eating') speedScale = 1.3;
  else if (state === 'sleeping') speedScale = 0.35;
  return { state, speedScale };
}

export function getCreatureRenderSize(creature = {}, { zoom = 1, isSelected = false, isPinned = false } = {}) {
  const energyRatio = clamp(numericGene(creature.energy, 40) / 40, 0.2, 1);
  const creatureSize = Math.max(1, numericGene(creature.size, 5));
  const radius = energyRatio * (3 + creatureSize);
  const minimumScreenSize = isSelected || isPinned ? 30 : 24;
  return Math.max(radius * 5, minimumScreenSize / Math.max(0.01, numericGene(zoom, 1)));
}

function requestSpriteFrames(assetKey, size, color) {
  const requestKey = `${assetKey}|${size}|${color}`;
  if (pendingSpriteRequests.has(requestKey)) return;
  pendingSpriteRequests.add(requestKey);
  assetLoader
    .requestSpriteFrames(assetKey, { size, color })
    .catch(error => console.debug(`[CreaturePresentation] sprite load failed: ${assetKey}`, error))
    .finally(() => pendingSpriteRequests.delete(requestKey));
}

export function getCreatureSpriteFrame(creature = {}, { worldTime = 0, renderSize = 64, clusterHue = null } = {}) {
  if (typeof document === 'undefined') return null;
  const assetKey = getCreatureAssetKey(creature);
  const size = assetLoader.getNearestSpriteSize(
    SPRITE_SIZES.reduce((closest, candidate) =>
      Math.abs(candidate - renderSize) < Math.abs(closest - renderSize) ? candidate : closest
    )
  );
  const color = getCreatureSpriteColor(creature, clusterHue);
  const sprite = assetLoader.getSpriteFramesSync(assetKey, { size, color });
  if (!sprite) {
    requestSpriteFrames(assetKey, size, color);
    return null;
  }

  const { state, speedScale } = getCreatureAnimationDetails(creature);
  const frameIndex = assetLoader.getAnimationFrameIndex(sprite, state, worldTime, speedScale);
  return {
    assetKey,
    frame: sprite.frames[frameIndex] || sprite.frames[0] || null,
    anchor: sprite.anchor || { x: 0.5, y: 0.5 },
    size
  };
}

export function drawCreatureSprite(ctx, creature = {}, opts = {}) {
  const renderSize =
    opts.renderSize ??
    getCreatureRenderSize(creature, {
      zoom: opts.zoom,
      isSelected: opts.isSelected,
      isPinned: opts.isPinned
    });
  const sprite = getCreatureSpriteFrame(creature, {
    worldTime: opts.worldTime,
    renderSize,
    clusterHue: opts.clusterHue
  });
  if (!sprite?.frame) return false;

  const anchorX = Number.isFinite(Number(sprite.anchor?.x)) ? Number(sprite.anchor.x) : 0.5;
  const anchorY = Number.isFinite(Number(sprite.anchor?.y)) ? Number(sprite.anchor.y) : 0.5;
  ctx.save();
  ctx.translate(Number(creature.x) || 0, Number(creature.y) || 0);
  ctx.rotate(Number(creature.dir) || 0);
  ctx.drawImage(sprite.frame, -renderSize * anchorX, -renderSize * anchorY, renderSize, renderSize);
  ctx.restore();
  return true;
}
