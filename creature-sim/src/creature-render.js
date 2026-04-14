import { clamp } from './utils.js';
import { CreatureConfig } from './creature-config.js';
import { ECOSYSTEM_STATES } from './creature-ecosystem.js';
import { assetLoader } from './asset-loader.js';
import { getDebugFlags } from './debug-flags.js';

import { getAgeStageIcon, getElderFadeAlpha } from './creature-age.js';

const { TAU } = CreatureConfig;

export function getBadges(creature) {
  const badges = [];
  const g = creature.genes;

  badges.push(getAgeStageIcon(creature.ageStage));

  if (g._luckyMutation) badges.push('🍀 Lucky');

  if (g.speed >= 1.45) badges.push('Swift');
  if (g.sense >= 150) badges.push('Scout');
  if (g.metabolism <= 0.6) badges.push('Efficient');
  if (creature.ageStage === 'elder') badges.push('Elder');
  if (!g.predator && creature.stats.food >= 15) badges.push('Grazer');
  if (g.predator && creature.stats.kills >= 3) badges.push('Apex');
  if (creature.energy >= 35) badges.push('Charged');
  if (creature.aquaticAffinity > 0.6) badges.push('Amphibious');
  if (creature.hasStatus && creature.hasStatus('disease')) badges.push('Sick');
  if (creature.hasStatus && creature.hasStatus('venom')) badges.push('Poisoned');
  if (creature.funStats?.hardLandings >= 2) badges.push('😵 Crash Landed');
  if (creature.funStats?.propBounces >= 3) badges.push('🎯 Bounce Star');
  if (creature.funStats?.goofyFails >= 2) badges.push('🤹 Goofball');
  
  // Rare mutation badges
  const rareMutations = creature.rareMutations || creature.mutations || [];
  for (const mutation of rareMutations) {
    switch (mutation.name) {
      case 'Bioluminescence': badges.push('✨ Glow'); break;
      case 'Regeneration': badges.push('💚 Heal'); break;
      case 'Gigantism': badges.push('🦖 Giant'); break;
      case 'Dwarfism': badges.push('🐹 Tiny'); break;
      case 'Albinism': badges.push('⚪ Albino'); break;
      case 'Melanism': badges.push('⬛ Dark'); break;
      case 'Chameleon': badges.push('🌈 Hidden'); break;
      case 'Venomous': badges.push('🐍 Venom'); break;
      case 'Armored Shell': badges.push('🛡️ Armor'); break;
      case 'Telepathy': badges.push('📡 Mind'); break;
    }
  }
  return badges;
}

export function drawCreature(creature, ctx, opts = {}) {
  const {
    isSelected = false,
    isPinned = false,
    inLineage = false,
    showTrail = false,
    showVision = false,
    clusterHue = null
  } = opts;
  const damageFx = creature.damageFx ?? null;

  if (showTrail && creature.trail.length > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(creature.trail[0].x, creature.trail[0].y);
    for (let i = 1; i < creature.trail.length; i++) {
      const pt = creature.trail[i];
      ctx.lineTo(pt.x, pt.y);
    }
    const trailColor = inLineage ? 'rgba(123,198,255,0.35)' : (isSelected || isPinned) ? 'rgba(255,240,180,0.35)' : 'rgba(200,210,255,0.18)';
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = inLineage ? 1.4 : 1;
    ctx.stroke();
    ctx.restore();
  }

  if (showVision && (isSelected || isPinned)) {
    ctx.save();

    const senseRadius = creature.genes.sense;
    ctx.beginPath();
    ctx.arc(creature.x, creature.y, senseRadius, 0, TAU);
    const hasTarget = creature.target !== null;
    const senseColor = hasTarget
      ? (creature.genes.predator ? 'rgba(255,100,100,0.08)' : 'rgba(100,255,100,0.08)')
      : 'rgba(200,200,255,0.05)';
    ctx.fillStyle = senseColor;
    ctx.fill();
    ctx.strokeStyle = hasTarget
      ? (creature.genes.predator ? 'rgba(255,100,100,0.25)' : 'rgba(100,255,100,0.25)')
      : 'rgba(200,200,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    const halfFov = creature._halfFovRad;
    ctx.beginPath();
    ctx.moveTo(creature.x, creature.y);
    ctx.arc(creature.x, creature.y, senseRadius, creature.dir - halfFov, creature.dir + halfFov);
    ctx.closePath();
    ctx.fillStyle = hasTarget
      ? (creature.genes.predator ? 'rgba(255,80,80,0.12)' : 'rgba(80,255,80,0.12)')
      : 'rgba(255,255,150,0.08)';
    ctx.fill();
    ctx.strokeStyle = hasTarget
      ? (creature.genes.predator ? 'rgba(255,80,80,0.4)' : 'rgba(80,255,80,0.4)')
      : 'rgba(255,255,150,0.25)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (creature.target && (creature.target.x !== undefined && creature.target.y !== undefined)) {
      const targetDist = Math.sqrt((creature.target.x - creature.x) ** 2 + (creature.target.y - creature.y) ** 2);
      const lineLength = Math.min(targetDist, senseRadius * 0.8);
      const angle = Math.atan2(creature.target.y - creature.y, creature.target.x - creature.x);

      ctx.beginPath();
      ctx.moveTo(creature.x, creature.y);
      ctx.lineTo(
        creature.x + Math.cos(angle) * lineLength,
        creature.y + Math.sin(angle) * lineLength
      );
      ctx.strokeStyle = creature.target.creatureId !== undefined
        ? 'rgba(255,100,100,0.6)'
        : creature.target.isCorpse
          ? 'rgba(180,130,80,0.5)'
          : 'rgba(100,220,100,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (targetDist <= senseRadius) {
        ctx.beginPath();
        ctx.arc(creature.target.x, creature.target.y, 3, 0, TAU);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  const g = creature.genes;
  ctx.save();
  ctx.translate(creature.x, creature.y);
  ctx.globalAlpha *= getElderFadeAlpha(creature.age);

  const shouldAnimate = isSelected || isPinned || (opts.zoom && opts.zoom > 0.8);
  if (shouldAnimate) {
    creature._applyAnimationTransform(ctx);
  }

  ctx.rotate(creature.dir);

  const energyRatio = clamp(creature.energy / 40, 0.2, 1.0);
  const r = energyRatio * (3 + creature.size);

  if (damageFx?.recentDamage > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, creature.size + 5, 0, TAU);
    ctx.strokeStyle = `rgba(255,96,96,${clamp(damageFx.recentDamage / 2.6, 0.15, 0.55)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const displayHue = clusterHue !== null ? clusterHue : g.hue;

  if (inLineage) {
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fillStyle = `hsla(${displayHue},100%,70%,0.18)`;
    ctx.fill();
  }

  const baseLight = g.predator ? 45 : 60;
  const flash = damageFx ? damageFx.hitFlash : 0;
  const eco = creature.ecosystem;
  const stressTint = eco ? clamp(eco.stress / 100, 0, 1) : 0;
  const calmBoost = eco?.state === ECOSYSTEM_STATES.CALM ? 2 : 0;
  const lightness = Math.min(85, baseLight + flash * 90 - stressTint * 6 + calmBoost);
  ctx.fillStyle = `hsl(${displayHue},85%,${lightness}%)`;

  const showTraitDetails = opts.showTraitVisualization !== false && (isSelected || isPinned || (opts.zoom && opts.zoom > 1.0));

  const diet = g.diet ?? (g.predator ? 1.0 : 0.0);
  let assetType = 'creature_herbivore';

  if (creature.ageStage === 'baby') {
    assetType = 'creature_baby';
  } else if (creature.ageStage === 'elder') {
    assetType = 'creature_elder';
  } else if (creature.aquaticAffinity && creature.aquaticAffinity > 0.6) {
    assetType = 'creature_aquatic';
  } else if (creature.socialRank && creature.socialRank === 'alpha') {
    assetType = 'creature_alpha';
  } else {
    if (diet > 0.7) {
      assetType = 'creature_predator';
    } else if (diet > 0.3) {
      assetType = 'creature_omnivore';
    }
  }

  const colorStr = `hsl(${displayHue},85%,${lightness}%)`;

  if (assetLoader.isReady() && (creature._cachedColor !== colorStr || creature._cachedAssetType !== assetType)) {
    updateCachedCanvas(creature, assetType, colorStr);
  }

  // Bioluminescence glow effect
  const rareMutations = creature.rareMutations || creature.mutations || [];
  const hasGlow = rareMutations.some(m => m.name === 'Bioluminescence');
  if (hasGlow) {
    const glowSize = r * 6;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    glow.addColorStop(0, 'rgba(0, 255, 200, 0.6)');
    glow.addColorStop(0.3, 'rgba(0, 255, 150, 0.3)');
    glow.addColorStop(0.6, 'rgba(0, 200, 255, 0.1)');
    glow.addColorStop(1, 'rgba(0, 255, 200, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, TAU);
    ctx.fill();
  }

  const worldTime = opts.worldTime ?? creature._lastWorld?.t ?? 0;
  const spriteFrame = getCachedSpriteFrame(creature, worldTime);
  if (spriteFrame) {
    const renderSize = r * 4;
    ctx.drawImage(spriteFrame, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
  } else if (creature._cachedCanvas) {
    const renderSize = r * 4;
    ctx.drawImage(creature._cachedCanvas, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
  } else {
    const bodyScale = 0.8 + (2 - g.metabolism) * 0.3;
    ctx.save();
    ctx.scale(1, bodyScale);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 3.5 / bodyScale);
    ctx.lineTo(-4, -3.5 / bodyScale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const debugFlags = getDebugFlags();
    if (debugFlags.spawnDebug) {
      ctx.save();
      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      const label = creature.id ? `id:${creature.id}` : 'spawn';
      ctx.fillText(label, -r, -r - 6);
      ctx.restore();
    }
  }

  ctx.strokeStyle = `hsla(${displayHue},90%,80%,${0.65 + flash * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();

  if (showTraitDetails) {
    drawTraits(creature, ctx, g, displayHue, r);
  }

  if (isPinned) {
    ctx.strokeStyle = 'rgba(140,200,255,0.9)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 4.5, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (isSelected) {
    ctx.strokeStyle = 'rgba(255,255,220,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r + 7, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();

  if (creature.maxHealth > 0) {
    const hpRatio = clamp(creature.health / creature.maxHealth, 0, 1);
    const barWidth = 12;
    const barHeight = 2;
    const x = creature.x - barWidth / 2;
    const y = creature.y - creature.size - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = creature.genes.predator ? 'rgba(255,120,120,0.85)' : 'rgba(120,255,160,0.85)';
    ctx.fillRect(x, y, barWidth * hpRatio, barHeight);
  }

  if (opts.showBehaviorState !== false && (isSelected || isPinned || (opts.zoom && opts.zoom > 0.8))) {
    drawBehaviorState(creature, ctx);
  }
}

export function getCachedSpriteFrame(creature, worldTime = 0) {
  const spriteSet = creature._cachedSpriteSet;
  if (!spriteSet || !spriteSet.frames || spriteSet.frames.length === 0) {
    return null;
  }

  const state = creature.animation?.state || 'idle';
  const speedRatio = clamp(creature.animation?.speedRatio ?? 0.5, 0.2, 2.0);
  let speedScale = 0.7;
  if (state === 'walking') {
    speedScale = 0.9 + speedRatio * 0.7;
  } else if (state === 'running') {
    speedScale = 1.1 + speedRatio * 1.1;
  } else if (state === 'eating') {
    speedScale = 1.3;
  } else if (state === 'sleeping') {
    speedScale = 0.35;
  }

  const frameIndex = assetLoader.getAnimationFrameIndex(spriteSet, state, worldTime, speedScale);
  return spriteSet.frames[frameIndex] || spriteSet.frames[0] || null;
}

export function updateCachedCanvas(creature, assetType, colorStr) {
  creature._cachedColor = colorStr;
  creature._cachedAssetType = assetType;

  assetLoader.requestSpriteFrames(assetType, { color: colorStr, size: 64 }).then(spriteSet => {
    if (creature._cachedColor === colorStr && creature._cachedAssetType === assetType) {
      creature._cachedSpriteSet = spriteSet;
      creature._cachedCanvas = spriteSet?.frames?.[0] || null;
    }
  }).catch(error => {
    console.error(`Failed to prepare sprite frames for ${assetType}:`, error);
  });
}

export function drawBehaviorState(creature, ctx) {
  let stateIcon = null;
  let stateColor = 'rgba(255,255,255,0.8)';

  if (creature.target) {
    if (creature.target.creatureId !== undefined) {
      stateIcon = '🎯';
      stateColor = 'rgba(255,80,80,0.9)';
    } else if (creature.target.isCorpse) {
      stateIcon = '🦴';
      stateColor = 'rgba(180,130,80,0.9)';
    } else if (creature.target.mate) {
      stateIcon = '💞';
      stateColor = 'rgba(255,120,180,0.9)';
    } else if (creature.target.restZone) {
      stateIcon = '🛏️';
      stateColor = 'rgba(120,180,255,0.9)';
    } else if (creature.target.food) {
      stateIcon = '🌿';
      stateColor = 'rgba(120,220,120,0.9)';
    } else if (creature.target.family) {
      stateIcon = '❤️';
      stateColor = 'rgba(255,150,200,0.9)';
    } else if (creature.target.pheromone) {
      stateIcon = '👃';
      stateColor = 'rgba(200,180,255,0.9)';
    }
  }

  if (creature.hasStatus && creature.hasStatus('adrenaline')) {
    stateIcon = '⚡';
    stateColor = 'rgba(255,220,80,0.9)';
  } else if (creature.emotions && creature.emotions.fear > 0.6) {
    stateIcon = '😰';
    stateColor = 'rgba(255,200,100,0.9)';
  } else if (creature.hasStatus && creature.hasStatus('disease')) {
    stateIcon = '🤢';
    stateColor = 'rgba(100,220,100,0.9)';
  } else if (creature.lifecycle && creature.lifecycle.playTimer > 0) {
    stateIcon = '🎮';
    stateColor = 'rgba(255,255,150,0.9)';
  } else if (creature.animation && creature.animation.state === 'eating') {
    stateIcon = '😋';
    stateColor = 'rgba(255,200,100,0.9)';
  } else if (creature.animation && creature.animation.state === 'sleeping') {
    stateIcon = '💤';
    stateColor = 'rgba(150,150,220,0.9)';
  }

  if (!stateIcon && creature.mood?.icon) {
    stateIcon = creature.mood.icon;
    stateColor = 'rgba(255,220,220,0.9)';
  }

  if (!stateIcon && creature.ageStage === 'baby') {
    stateIcon = '🐣';
  } else if (!stateIcon && creature.ageStage === 'elder') {
    stateIcon = '👴';
  }

  if (stateIcon) {
    ctx.save();
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = stateColor;
    ctx.fillText(stateIcon, creature.x, creature.y - creature.size - 10);
    ctx.restore();
  }
}

export function drawTraits(creature, ctx, g, hue, r) {
  const eyeSize = clamp(g.sense / 100, 0.6, 1.5);
  const look = creature._getLookOffset();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(2, -1.5, eyeSize, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(2 + look.x, -1.5 + look.y, eyeSize * 0.5, 0, TAU);
  ctx.fill();

  const spineStrength = g.spines ?? 0;
  if (spineStrength > 0.2) {
    ctx.strokeStyle = `hsl(${hue}, 70%, 40%)`;
    ctx.lineWidth = 1.5;
    const spikeCount = Math.floor(spineStrength * 6) + 2;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * TAU;
      const spikeLength = 2 + spineStrength * 3;
      const x1 = Math.cos(angle + Math.PI * 0.5) * r;
      const y1 = Math.sin(angle + Math.PI * 0.5) * r;
      const x2 = Math.cos(angle + Math.PI * 0.5) * (r + spikeLength);
      const y2 = Math.sin(angle + Math.PI * 0.5) * (r + spikeLength);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  if (g.speed > 1.2) {
    ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.6)`;
    ctx.beginPath();
    const tailLength = (g.speed - 1) * 4;
    ctx.moveTo(-4, 0);
    ctx.lineTo(-4 - tailLength, 2);
    ctx.lineTo(-4 - tailLength, -2);
    ctx.closePath();
    ctx.fill();
  }

  if (g.predator || (g.diet && g.diet > 0.7)) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(4 - i * 1.5, 0.5);
      ctx.lineTo(5 - i * 1.5, 2);
      ctx.lineTo(3 - i * 1.5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}
