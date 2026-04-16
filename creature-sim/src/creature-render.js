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
  const g = creature.genes;

  // Enhanced trail rendering with gradient fade and creature-specific coloring
  if (showTrail && creature.trail.length > 1) {
    ctx.save();

    const trail = creature.trail;
    const trailLen = trail.length;

    // Determine trail color based on creature traits and state
    let baseTrailColor;
    if (inLineage) {
      baseTrailColor = { r: 123, g: 198, b: 255 };
    } else if (isSelected || isPinned) {
      baseTrailColor = { r: 255, g: 240, b: 180 };
    } else if (g?.bioluminescent) {
      // Bioluminescent creatures leave glowing trails
      const glowHue = (opts.worldTime || 0) * 20 % 360;
      const hsl = `hsl(${glowHue}, 100%, 70%)`;
      ctx.shadowColor = hsl;
      ctx.shadowBlur = 8;
      baseTrailColor = { r: 0, g: 255, b: 200 };
    } else if (g?.elementalAffinity) {
      // Elemental creatures leave elemental trails
      switch (g.elementalAffinity) {
        case 'fire': baseTrailColor = { r: 255, g: 150, b: 50 }; break;
        case 'ice': baseTrailColor = { r: 200, g: 230, b: 255 }; break;
        case 'electric': baseTrailColor = { r: 255, g: 255, b: 150 }; break;
        case 'earth': baseTrailColor = { r: 139, g: 119, b: 101 }; break;
        default: baseTrailColor = { r: 200, g: 210, b: 255 };
      }
    } else if (g?.predator) {
      baseTrailColor = { r: 255, g: 180, b: 180 };
    } else {
      baseTrailColor = { r: 180, g: 220, b: 180 };
    }

    // Draw trail with gradient opacity (fades from head to tail)
    const maxWidth = inLineage ? 2.5 : 1.8;

    for (let i = 1; i < trailLen; i++) {
      const pt = trail[i];
      const prevPt = trail[i - 1];
      const fadeRatio = i / trailLen;
      const alpha = fadeRatio * (inLineage ? 0.5 : 0.3);
      const lineWidth = fadeRatio * maxWidth;

      ctx.beginPath();
      ctx.moveTo(prevPt.x, prevPt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = `rgba(${baseTrailColor.r}, ${baseTrailColor.g}, ${baseTrailColor.b}, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Trail head marker (current position dot)
    if (trailLen > 0) {
      const head = trail[trailLen - 1];
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2, 0, TAU);
      ctx.fillStyle = `rgba(${baseTrailColor.r}, ${baseTrailColor.g}, ${baseTrailColor.b}, 0.6)`;
      ctx.fill();
    }

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

  ctx.save();
  ctx.translate(creature.x, creature.y);
  ctx.globalAlpha *= getElderFadeAlpha(creature.age);

  const spawnScale = creature.spawnScale ?? 1;
  if (spawnScale < 1) {
    ctx.scale(spawnScale, spawnScale);
    ctx.globalAlpha *= (0.4 + spawnScale * 0.6);
  }

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

  // Day/night aware lighting
  const dayLight = opts.dayLight ?? 1;
  const isNight = dayLight < 0.4;
  const isDawnDusk = dayLight >= 0.4 && dayLight < 0.7;

  // Base lightness adjusted for time of day
  const baseLight = g.predator ? 45 : 60;
  const flash = damageFx ? damageFx.hitFlash : 0;
  const eco = creature.ecosystem;
  const stressTint = eco ? clamp(eco.stress / 100, 0, 1) : 0;
  const calmBoost = eco?.state === ECOSYSTEM_STATES.CALM ? 2 : 0;

  // Time of day affects creature visibility
  let dayNightAdjust = 0;
  if (isNight) {
    // Creatures glow slightly at night to remain visible
    dayNightAdjust = -10 + (1 - dayLight) * 15;
    // Bioluminescent creatures glow brighter at night
    const bioGlow = rareMutations.find(m => m.name === 'Bioluminescence');
    if (bioGlow) {
      dayNightAdjust += 20 * (1 - dayLight);
    }
  } else if (isDawnDusk) {
    // Slight dimming at dawn/dusk
    dayNightAdjust = -(1 - dayLight) * 5;
  }

  const lightness = Math.min(85, baseLight + flash * 90 - stressTint * 6 + calmBoost + dayNightAdjust);
  ctx.fillStyle = `hsl(${displayHue},85%,${lightness}%)`;

  // Night ambient glow for creatures (makes them visible in dark)
  if (isNight && !isSelected && !isPinned) {
    const isNocturnal = (g.nocturnal ?? 0.5) > 0.5;
    const nocturnalBonus = isNocturnal ? g.nocturnal * 1.5 : 0;
    const nightGlowIntensity = ((1 - dayLight) * 0.15) + nocturnalBonus * 0.25;
    let nightGlowColor;
    if (rareMutations.some(m => m.name === 'Bioluminescence')) {
      nightGlowColor = `hsla(${displayHue + 180}, 100%, 70%, ${nightGlowIntensity * 2})`;
    } else if (g.elementalAffinity) {
      const elemColors = { fire: '30, 100%, 50%', ice: '200, 100%, 85%', electric: '60, 100%, 70%', earth: '30, 50%, 40%' };
      nightGlowColor = `hsla(${elemColors[g.elementalAffinity] || '60, 100%, 70%'}, ${nightGlowIntensity})`;
    } else if (isNocturnal) {
      nightGlowColor = `hsla(${displayHue}, 80%, 75%, ${nightGlowIntensity})`;
    } else {
      nightGlowColor = `hsla(${displayHue}, 60%, 70%, ${nightGlowIntensity})`;
    }
    const glowRadius = isNocturnal ? r * (3 + nocturnalBonus) : r * 3;
    const nightGlow = ctx.createRadialGradient(0, 0, r, 0, 0, glowRadius);
    nightGlow.addColorStop(0, nightGlowColor);
    nightGlow.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
    ctx.fillStyle = nightGlow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, TAU);
    ctx.fill();
    // Reset fill style for actual creature
    ctx.fillStyle = `hsl(${displayHue},85%,${lightness}%)`;
  }

  const showTraitDetails = opts.showTraitVisualization !== false && (isSelected || isPinned || (opts.zoom && opts.zoom > 1.0));

  const diet = g.diet ?? (g.predator ? 1.0 : 0.0);
  const creatureType = creature.traits?.creatureType;
  let assetType = 'creature_herbivore';

  if (creature.ageStage === 'baby') {
    assetType = 'creature_baby';
  } else if (creature.ageStage === 'elder') {
    assetType = 'creature_elder';
  } else if (creatureType === 'flying') {
    assetType = 'creature_flying';
  } else if (creatureType === 'burrowing') {
    assetType = 'creature_burrowing';
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

  const rareMutations = creature.rareMutations || creature.mutations || [];
  const worldTime = opts.worldTime ?? creature._lastWorld?.t ?? 0;

  // Enhanced Bioluminescence glow effect with pulsing animation
  const bioGlow = rareMutations.find(m => m.name === 'Bioluminescence');
  if (bioGlow) {
    const pulsePhase = (worldTime * 3) + (creature.id % 100) * 0.1;
    const pulseIntensity = 0.5 + Math.sin(pulsePhase) * 0.3;
    const nightBoost = opts.dayLight !== undefined ? (1 - opts.dayLight) * 0.5 : 0;
    const totalIntensity = Math.min(1, pulseIntensity + nightBoost);
    const glowSize = r * (4 + Math.sin(pulsePhase * 0.5) * 0.5);
    const hueShift = (worldTime * 20) % 360;

    ctx.save();
    ctx.shadowColor = `hsl(${hueShift}, 100%, 60%)`;
    ctx.shadowBlur = 15 * totalIntensity;

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    glow.addColorStop(0, `hsla(${hueShift}, 100%, 70%, ${0.8 * totalIntensity})`);
    glow.addColorStop(0.2, `hsla(${hueShift + 30}, 100%, 60%, ${0.6 * totalIntensity})`);
    glow.addColorStop(0.4, `hsla(${hueShift + 60}, 80%, 50%, ${0.4 * totalIntensity})`);
    glow.addColorStop(0.6, `hsla(${hueShift + 90}, 60%, 40%, ${0.2 * totalIntensity})`);
    glow.addColorStop(0.8, `hsla(${hueShift + 120}, 40%, 30%, ${0.1 * totalIntensity})`);
    glow.addColorStop(1, `hsla(${hueShift}, 100%, 50%, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, TAU);
    ctx.fill();

    ctx.shadowBlur = 0;

    for (let i = 0; i < 4; i++) {
      const sparklePhase = pulsePhase * 1.5 + i * 1.5;
      const sparkleIntensity = Math.max(0, Math.sin(sparklePhase));
      if (sparkleIntensity > 0.3) {
        const angle = (i / 4) * TAU + worldTime * 0.5;
        const dist = r * (1.5 + Math.sin(sparklePhase) * 0.5);
        const sx = Math.cos(angle) * dist;
        const sy = Math.sin(angle) * dist;
        const ss = r * 0.15 * sparkleIntensity;

        ctx.beginPath();
        ctx.arc(sx, sy, ss, 0, TAU);
        ctx.fillStyle = `hsla(${hueShift + 60}, 100%, 90%, ${sparkleIntensity * 0.8})`;
        ctx.fill();
      }
    }

    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, TAU);
    ctx.strokeStyle = `hsla(${hueShift}, 100%, 80%, ${0.5 * totalIntensity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 1.2, 0, TAU);
    ctx.strokeStyle = `hsla(${hueShift + 30}, 100%, 85%, ${0.3 * totalIntensity})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  // Chameleon camouflage shimmer effect
  const chameleonMut = rareMutations.find(m => m.name === 'Chameleon');
  if (chameleonMut && creature.camouflageActive) {
    const shimmerPhase = worldTime * 8;
    const shimmerCount = 3;
    for (let i = 0; i < shimmerCount; i++) {
      const angle = shimmerPhase + (i / shimmerCount) * TAU;
      const shimmerX = Math.cos(angle) * r * 0.8;
      const shimmerY = Math.sin(angle) * r * 0.8;
      const shimmerSize = r * 0.3 * (0.5 + Math.sin(shimmerPhase * 2 + i) * 0.5);
      ctx.beginPath();
      ctx.arc(shimmerX, shimmerY, shimmerSize, 0, TAU);
      ctx.fillStyle = `hsla(${displayHue + 40}, 30%, 60%, 0.3)`;
      ctx.fill();
    }
    // Camouflage aura
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, TAU);
    ctx.strokeStyle = `hsla(${displayHue}, 20%, 40%, 0.2)`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Regeneration healing particle effect
  const regenMut = rareMutations.find(m => m.name === 'Regeneration');
  if (regenMut && creature.health < creature.maxHealth) {
    const healPhase = worldTime * 4;
    const particleCount = 3;
    for (let i = 0; i < particleCount; i++) {
      const angle = healPhase + (i / particleCount) * TAU;
      const dist = r * (1 + (healPhase % 1) * 0.5);
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist - r;
      const pSize = 2 + Math.sin(healPhase + i) * 1;
      const life = 1 - (healPhase % 1);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, TAU);
      ctx.fillStyle = `rgba(100, 255, 150, ${life * 0.7})`;
      ctx.fill();
    }
    // Green health ring when regenerating
    const healthRatio = creature.health / creature.maxHealth;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * healthRatio);
    ctx.strokeStyle = 'rgba(100, 255, 150, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Armored shell plates visual
  const armorMut = rareMutations.find(m => m.name === 'Armored Shell');
  if (armorMut) {
    const armorStrength = g.armorStrength || 0.5;
    ctx.save();
    ctx.rotate(-creature.dir);
    // Shell plate pattern
    ctx.strokeStyle = `hsla(${displayHue}, 20%, 30%, ${0.6 * armorStrength})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const plateAngle = (i / 5) * Math.PI - Math.PI * 0.5;
      const plateX = Math.cos(plateAngle) * r * 0.7;
      const plateY = Math.sin(plateAngle) * r * 0.7;
      ctx.beginPath();
      ctx.arc(plateX, plateY, r * 0.35, 0, TAU);
      ctx.stroke();
    }
    // Shoulder plates
    ctx.beginPath();
    ctx.ellipse(-r * 0.5, 0, r * 0.4, r * 0.25, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(r * 0.3, 0, r * 0.3, r * 0.2, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // Elemental affinity auras
  if (g.elementalAffinity) {
    const elemPhase = worldTime * 2;
    switch (g.elementalAffinity) {
      case 'fire':
        {
          const fireSize = r * 2.5;
          const fireGlow = ctx.createRadialGradient(0, 0, r, 0, 0, fireSize);
          const flicker = 0.7 + Math.sin(elemPhase * 8) * 0.15 + Math.sin(elemPhase * 13) * 0.1;
          fireGlow.addColorStop(0, `rgba(255, 100, 0, ${0.4 * flicker})`);
          fireGlow.addColorStop(0.4, `rgba(255, 50, 0, ${0.25 * flicker})`);
          fireGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
          ctx.fillStyle = fireGlow;
          ctx.beginPath();
          ctx.arc(0, 0, fireSize, 0, TAU);
          ctx.fill();
          // Flame particles with glow
          ctx.save();
          ctx.shadowColor = 'rgba(255, 150, 0, 0.8)';
          ctx.shadowBlur = 8;
          for (let i = 0; i < 5; i++) {
            const fAngle = elemPhase + (i / 5) * TAU;
            const fDist = r * 1.5 + Math.sin(elemPhase * 5 + i) * r * 0.5;
            const fx = Math.cos(fAngle) * fDist;
            const fy = Math.sin(fAngle) * fDist;
            ctx.beginPath();
            ctx.arc(fx, fy, 2 + Math.random() * 0.5, 0, TAU);
            ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, 0.7)`;
            ctx.fill();
          }
          ctx.restore();
        }
        break;
      case 'ice':
        {
          const iceSize = r * 2;
          const iceGlow = ctx.createRadialGradient(0, 0, r, 0, 0, iceSize);
          iceGlow.addColorStop(0, 'rgba(200, 230, 255, 0.4)');
          iceGlow.addColorStop(0.5, 'rgba(150, 200, 255, 0.2)');
          iceGlow.addColorStop(1, 'rgba(100, 180, 255, 0)');
          ctx.fillStyle = iceGlow;
          ctx.beginPath();
          ctx.arc(0, 0, iceSize, 0, TAU);
          ctx.fill();
          // Ice crystal rays with glow
          ctx.save();
          ctx.shadowColor = 'rgba(200, 240, 255, 0.9)';
          ctx.shadowBlur = 6;
          ctx.strokeStyle = 'rgba(200, 240, 255, 0.6)';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) {
            const iceAngle = (i / 6) * TAU + elemPhase * 0.5;
            ctx.beginPath();
            ctx.moveTo(Math.cos(iceAngle) * r, Math.sin(iceAngle) * r);
            ctx.lineTo(Math.cos(iceAngle) * r * 2, Math.sin(iceAngle) * r * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      case 'electric':
        {
          const boltPhase = elemPhase * 10;
          // Electric bolts with glow
          ctx.save();
          ctx.shadowColor = 'rgba(255, 255, 150, 0.9)';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = `rgba(255, 255, 100, ${0.6 + Math.sin(boltPhase) * 0.3})`;
          ctx.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) {
            const eAngle = (i / 3) * TAU + boltPhase;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            let ex = 0, ey = 0;
            for (let j = 0; j < 4; j++) {
              ex += Math.cos(eAngle + (Math.random() - 0.5) * 0.5) * r * 0.5;
              ey += Math.sin(eAngle + (Math.random() - 0.5) * 0.5) * r * 0.5;
              ctx.lineTo(ex, ey);
            }
            ctx.stroke();
          }
          ctx.restore();
          // Electric aura
          const elecGlow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 2);
          elecGlow.addColorStop(0, 'rgba(255, 255, 150, 0.3)');
          elecGlow.addColorStop(1, 'rgba(255, 255, 100, 0)');
          ctx.fillStyle = elecGlow;
          ctx.beginPath();
          ctx.arc(0, 0, r * 2, 0, TAU);
          ctx.fill();
        }
        break;
      case 'earth':
        {
          const earthGlow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 1.8);
          earthGlow.addColorStop(0, 'rgba(139, 119, 101, 0.4)');
          earthGlow.addColorStop(1, 'rgba(101, 67, 33, 0)');
          ctx.fillStyle = earthGlow;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.8, 0, TAU);
          ctx.fill();
          // Rock fragments orbiting
          ctx.fillStyle = 'hsla(30, 20%, 40%, 0.6)';
          for (let i = 0; i < 4; i++) {
            const rockAngle = elemPhase + (i / 4) * TAU;
            const rockDist = r * 1.4 + Math.sin(elemPhase * 2 + i) * r * 0.2;
            ctx.beginPath();
            ctx.arc(
              Math.cos(rockAngle) * rockDist,
              Math.sin(rockAngle) * rockDist,
              3 + Math.sin(elemPhase + i) * 1.5,
              0, TAU
            );
            ctx.fill();
          }
        }
        break;
    }
  }

  // Telepathy brain wave rings
  const telepathyMut = rareMutations.find(m => m.name === 'Telepathy');
  if (telepathyMut) {
    const telepathyPhase = worldTime * 3;
    for (let i = 0; i < 3; i++) {
      const waveProgress = ((telepathyPhase + i * 0.33) % 1);
      const waveRadius = r * (1 + waveProgress * 3);
      const waveAlpha = (1 - waveProgress) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, waveRadius, 0, TAU);
      ctx.strokeStyle = `rgba(180, 100, 255, ${waveAlpha})`;
      ctx.lineWidth = 1.5 - waveProgress;
      ctx.stroke();
    }
  }

  // Venomous poison drip effect
  const venomMut = rareMutations.find(m => m.name === 'Venomous');
  if (venomMut) {
    const venomPhase = worldTime * 2;
    // Dripping poison drops
    for (let i = 0; i < 2; i++) {
      const dripProgress = ((venomPhase + i * 0.5) % 1);
      const dripY = r * 0.5 + dripProgress * r * 1.5;
      const dripX = Math.sin(venomPhase * 3 + i) * r * 0.3;
      ctx.beginPath();
      ctx.arc(dripX, dripY, 1.5 * (1 - dripProgress * 0.5), 0, TAU);
      ctx.fillStyle = `rgba(100, 200, 0, ${0.7 * (1 - dripProgress)})`;
      ctx.fill();
    }
    // Venomous aura
    const venomGlow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 1.5);
    venomGlow.addColorStop(0, 'rgba(150, 200, 50, 0.2)');
    venomGlow.addColorStop(1, 'rgba(100, 150, 0, 0)');
    ctx.fillStyle = venomGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, TAU);
    ctx.fill();
  }

  // Gigantism power aura with massive ripple rings
  const gigantismMut = rareMutations.find(m => m.name === 'Gigantism');
  if (gigantismMut) {
    const gigPhase = worldTime * 2;
    const gigStrength = g.size ? Math.min(2, g.size / 6) : 1.5;
    // Power ripples expanding outward
    for (let i = 0; i < 3; i++) {
      const waveProgress = ((gigPhase + i * 0.4) % 1);
      const waveRadius = r * (1.5 + waveProgress * 4 * gigStrength);
      const waveAlpha = (1 - waveProgress) * 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, waveRadius, 0, TAU);
      ctx.strokeStyle = `rgba(255, 150, 50, ${waveAlpha})`;
      ctx.lineWidth = 2 - waveProgress;
      ctx.stroke();
    }
    // Power aura glow
    const gigGlow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 2.5 * gigStrength);
    gigGlow.addColorStop(0, 'rgba(255, 100, 50, 0.15)');
    gigGlow.addColorStop(0.5, 'rgba(255, 50, 0, 0.08)');
    gigGlow.addColorStop(1, 'rgba(200, 50, 0, 0)');
    ctx.fillStyle = gigGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.5 * gigStrength, 0, TAU);
    ctx.fill();
    // Power particles
    for (let i = 0; i < 4; i++) {
      const pAngle = gigPhase * 1.5 + (i / 4) * TAU;
      const pDist = r * (2 + Math.sin(gigPhase * 3 + i) * 0.5);
      ctx.beginPath();
      ctx.arc(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist, 2, 0, TAU);
      ctx.fillStyle = `rgba(255, 200, 100, ${0.5 + Math.sin(gigPhase + i) * 0.3})`;
      ctx.fill();
    }
  }

  // Dwarfism cute sparkle effect with heart particles
  const dwarfismMut = rareMutations.find(m => m.name === 'Dwarfism');
  if (dwarfismMut) {
    const dwarfPhase = worldTime * 4;
    // Soft pink/purple cute aura
    const dwarfGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
    dwarfGlow.addColorStop(0, 'rgba(255, 200, 220, 0.3)');
    dwarfGlow.addColorStop(0.5, 'rgba(255, 150, 200, 0.15)');
    dwarfGlow.addColorStop(1, 'rgba(255, 100, 150, 0)');
    ctx.fillStyle = dwarfGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, TAU);
    ctx.fill();
    // Sparkle stars
    for (let i = 0; i < 3; i++) {
      const sparkleAngle = dwarfPhase + (i / 3) * TAU;
      const sparkleDist = r * (1.2 + Math.sin(dwarfPhase * 2 + i) * 0.3);
      const sx = Math.cos(sparkleAngle) * sparkleDist;
      const sy = Math.sin(sparkleAngle) * sparkleDist;
      const sparkleSize = r * 0.15 * (0.5 + Math.sin(dwarfPhase * 3 + i * 2) * 0.5);
      ctx.beginPath();
      ctx.arc(sx, sy, sparkleSize, 0, TAU);
      ctx.fillStyle = `rgba(255, 220, 240, ${0.6 + Math.sin(dwarfPhase + i) * 0.3})`;
      ctx.fill();
    }
    // Mini heart particles (using small circles to approximate)
    for (let i = 0; i < 2; i++) {
      const heartPhase = dwarfPhase * 0.7 + i * Math.PI;
      const heartDist = r * (1.5 + (heartPhase % TAU) * 0.1);
      const hx = Math.cos(heartPhase) * heartDist;
      const hy = Math.sin(heartPhase) * heartDist - r * 0.5;
      const heartSize = r * 0.1;
      ctx.beginPath();
      ctx.arc(hx - heartSize * 0.3, hy, heartSize * 0.5, 0, TAU);
      ctx.arc(hx + heartSize * 0.3, hy, heartSize * 0.5, 0, TAU);
      ctx.fillStyle = `rgba(255, 150, 180, ${0.5 - (heartPhase % TAU) * 0.05})`;
      ctx.fill();
    }
  }

  // Albinism UV damage sparks and pale glow
  const albinismMut = rareMutations.find(m => m.name === 'Albinism');
  if (albinismMut) {
    const albinoPhase = worldTime * 3;
    // Pale UV-sensitive glow
    const albinoGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
    albinoGlow.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    albinoGlow.addColorStop(0.6, 'rgba(200, 220, 255, 0.1)');
    albinoGlow.addColorStop(1, 'rgba(150, 180, 255, 0)');
    ctx.fillStyle = albinoGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, TAU);
    ctx.fill();
    // UV damage sparks (more frequent during day)
    const uvIntensity = opts.dayLight !== undefined ? opts.dayLight : 0.5;
    if (uvIntensity > 0.3) {
      for (let i = 0; i < 3; i++) {
        const sparkPhase = albinoPhase + (i / 3) * TAU;
        const sparkDist = r * (1.3 + Math.sin(sparkPhase * 2) * 0.3);
        const sparkAngle = Math.sin(sparkPhase * 1.5 + i) * Math.PI;
        const sx = Math.cos(sparkAngle) * sparkDist;
        const sy = Math.sin(sparkAngle) * sparkDist;
        const sparkSize = r * 0.08 * uvIntensity;
        ctx.beginPath();
        ctx.arc(sx, sy, sparkSize, 0, TAU);
        ctx.fillStyle = `rgba(255, 255, 200, ${0.7 * uvIntensity * Math.max(0, Math.sin(sparkPhase))})`;
        ctx.fill();
      }
    }
    // Pale outline ring
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.4, 0, TAU);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + Math.sin(albinoPhase) * 0.1})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Melanism night vision eye glow
  const melanismMut = rareMutations.find(m => m.name === 'Melanism');
  if (melanismMut) {
    const melanoPhase = worldTime * 2;
    // Dark aura with subtle purple/blue night vision tint
    const melanoGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
    melanoGlow.addColorStop(0, 'rgba(30, 20, 50, 0.4)');
    melanoGlow.addColorStop(0.5, 'rgba(20, 10, 40, 0.2)');
    melanoGlow.addColorStop(1, 'rgba(10, 5, 30, 0)');
    ctx.fillStyle = melanoGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, TAU);
    ctx.fill();
    // Night vision eye glow effect
    const nightGlowIntensity = 0.5 + Math.sin(melanoPhase) * 0.2;
    ctx.save();
    ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
    ctx.shadowBlur = 8 * nightGlowIntensity;
    ctx.beginPath();
    ctx.arc(r * 0.3, -r * 0.2, r * 0.2, 0, TAU);
    ctx.fillStyle = `rgba(100, 200, 255, ${0.4 * nightGlowIntensity})`;
    ctx.fill();
    ctx.restore();
    // Dark energy wisps
    for (let i = 0; i < 2; i++) {
      const wispAngle = melanoPhase + i * Math.PI;
      const wispDist = r * (1.5 + Math.sin(melanoPhase * 0.5 + i) * 0.3);
      ctx.beginPath();
      ctx.arc(
        Math.cos(wispAngle) * wispDist,
        Math.sin(wispAngle) * wispDist,
        r * 0.1,
        0, TAU
      );
      ctx.fillStyle = `rgba(50, 30, 80, ${0.3 + Math.sin(melanoPhase + i * 2) * 0.2})`;
      ctx.fill();
    }
  }

  // Longevity golden age rings
  const longevityMut = rareMutations.find(m => m.name === 'Longevity');
  if (longevityMut) {
    const longevPhase = worldTime;
    // Golden aura
    const longevGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.5);
    longevGlow.addColorStop(0, 'rgba(255, 215, 100, 0.2)');
    longevGlow.addColorStop(0.5, 'rgba(255, 200, 50, 0.1)');
    longevGlow.addColorStop(1, 'rgba(255, 180, 0, 0)');
    ctx.fillStyle = longevGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.5, 0, TAU);
    ctx.fill();
    // Age indicator rings
    for (let i = 0; i < 3; i++) {
      const ringProgress = ((longevPhase * 0.3 + i * 0.33) % 1);
      const ringRadius = r * (1.2 + ringProgress * 2);
      const ringAlpha = (1 - ringProgress) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, TAU);
      ctx.strokeStyle = `rgba(255, 215, 100, ${ringAlpha})`;
      ctx.lineWidth = 1.5 - ringProgress;
      ctx.stroke();
    }
    // Golden sparkle particles
    for (let i = 0; i < 4; i++) {
      const sparkleAngle = longevPhase * 0.8 + (i / 4) * TAU;
      const sparkleDist = r * (1.8 + Math.sin(longevPhase * 2 + i) * 0.4);
      ctx.beginPath();
      ctx.arc(
        Math.cos(sparkleAngle) * sparkleDist,
        Math.sin(sparkleAngle) * sparkleDist,
        r * 0.08,
        0, TAU
      );
      ctx.fillStyle = `rgba(255, 235, 150, ${0.5 + Math.sin(longevPhase + i) * 0.3})`;
      ctx.fill();
    }
  }

  // Accelerated Aging rapid decay effect
  const accelAgingMut = rareMutations.find(m => m.name === 'Accelerated Aging');
  if (accelAgingMut) {
    const accelPhase = worldTime * 8;
    // Rapid ticking rings
    for (let i = 0; i < 4; i++) {
      const tickProgress = ((accelPhase + i * 0.25) % 1);
      const tickRadius = r * (1 + tickProgress * 2);
      const tickAlpha = (1 - tickProgress) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, tickRadius, 0, TAU);
      ctx.strokeStyle = `rgba(200, 150, 100, ${tickAlpha})`;
      ctx.lineWidth = 2 - tickProgress * 1.5;
      ctx.stroke();
    }
    // Time urgency particles
    for (let i = 0; i < 6; i++) {
      const particleAngle = accelPhase * 2 + (i / 6) * TAU;
      const particleDist = r * (1.3 + Math.sin(accelPhase * 4 + i) * 0.3);
      ctx.beginPath();
      ctx.arc(
        Math.cos(particleAngle) * particleDist,
        Math.sin(particleAngle) * particleDist,
        r * 0.06,
        0, TAU
      );
      ctx.fillStyle = `rgba(200, 150, 100, ${0.6 + Math.sin(accelPhase + i * 1.5) * 0.3})`;
      ctx.fill();
    }
    // Decay aura
    const decayGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.8);
    decayGlow.addColorStop(0, 'rgba(180, 120, 80, 0.2)');
    decayGlow.addColorStop(1, 'rgba(150, 100, 60, 0)');
    ctx.fillStyle = decayGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, TAU);
    ctx.fill();
  }

  // Super Senses radar wave effect
  const superSensesMut = rareMutations.find(m => m.name === 'Super Senses');
  if (superSensesMut) {
    const sensePhase = worldTime * 4;
    const senseRange = g.sense ? Math.min(3, g.sense / 100) : 1.8;
    // Radar sweep
    for (let i = 0; i < 2; i++) {
      const radarProgress = ((sensePhase + i * 0.5) % 1);
      const radarRadius = r * (1 + radarProgress * 3 * senseRange);
      const radarAlpha = (1 - radarProgress) * 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, radarRadius, 0, TAU);
      ctx.strokeStyle = `rgba(255, 255, 100, ${radarAlpha})`;
      ctx.lineWidth = 1.5 - radarProgress;
      ctx.stroke();
    }
    // Detection sweep line
    const sweepAngle = sensePhase * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(sweepAngle) * r * 4 * senseRange,
      Math.sin(sweepAngle) * r * 4 * senseRange
    );
    ctx.strokeStyle = `rgba(255, 255, 100, ${0.3 + Math.sin(sensePhase * 2) * 0.2})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Sensory particles
    for (let i = 0; i < 5; i++) {
      const pAngle = (i / 5) * TAU + sensePhase * 0.3;
      const pDist = r * (1.5 + Math.sin(sensePhase * 2 + i) * 0.5);
      ctx.beginPath();
      ctx.arc(
        Math.cos(pAngle) * pDist,
        Math.sin(pAngle) * pDist,
        r * 0.08,
        0, TAU
      );
      ctx.fillStyle = `rgba(255, 255, 150, ${0.4 + Math.sin(sensePhase + i) * 0.3})`;
      ctx.fill();
    }
  }

  // Photosynthesis sun energy absorption
  const photosynMut = rareMutations.find(m => m.name === 'Photosynthesis');
  if (photosynMut && !g.predator) {
    const photoPhase = worldTime * 2;
    const photoIntensity = opts.dayLight !== undefined ? opts.dayLight : 0.5;
    if (photoIntensity > 0.4) {
      // Sun energy absorption glow
      const photoGlow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2);
      photoGlow.addColorStop(0, `rgba(100, 255, 100, ${0.3 * photoIntensity})`);
      photoGlow.addColorStop(0.5, `rgba(150, 255, 50, ${0.15 * photoIntensity})`);
      photoGlow.addColorStop(1, 'rgba(100, 200, 0, 0)');
      ctx.fillStyle = photoGlow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2, 0, TAU);
      ctx.fill();
      // Energy absorption particles from above
      for (let i = 0; i < 4; i++) {
        const pPhase = photoPhase + (i / 4) * TAU;
        const pProgress = (pPhase % TAU) / TAU;
        const px = Math.sin(pPhase * 0.7 + i) * r * 0.8;
        const py = -r * (1 + pProgress * 2);
        const pSize = r * 0.1 * (1 - pProgress * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, TAU);
        ctx.fillStyle = `rgba(200, 255, 100, ${(0.8 - pProgress * 0.6) * photoIntensity})`;
        ctx.fill();
      }
      // Chlorophyll sparkles
      for (let i = 0; i < 3; i++) {
        const sparkleAngle = photoPhase * 0.5 + (i / 3) * TAU;
        const sparkleDist = r * (1.2 + Math.sin(photoPhase * 1.5 + i) * 0.3);
        ctx.beginPath();
        ctx.arc(
          Math.cos(sparkleAngle) * sparkleDist,
          Math.sin(sparkleAngle) * sparkleDist,
          r * 0.1,
          0, TAU
        );
        ctx.fillStyle = `rgba(150, 255, 100, ${0.5 + Math.sin(photoPhase + i * 2) * 0.3})`;
        ctx.fill();
      }
    }
  }

  // Chimera hybrid trait markers
  const chimeraMut = rareMutations.find(m => m.name === 'Chimera');
  if (chimeraMut) {
    const chimPhase = worldTime * 2;
    const hybridTraits = g.hybridTraits || {};
    // Multi-colored chaotic aura
    const chimGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
    chimGlow.addColorStop(0, 'rgba(200, 100, 255, 0.25)');
    chimGlow.addColorStop(0.4, 'rgba(100, 200, 255, 0.15)');
    chimGlow.addColorStop(0.7, 'rgba(255, 150, 100, 0.1)');
    chimGlow.addColorStop(1, 'rgba(100, 255, 150, 0)');
    ctx.fillStyle = chimGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, TAU);
    ctx.fill();
    // Trait indicator particles
    const traitCount = [hybridTraits.hasWings, hybridTraits.hasTail, hybridTraits.hasHorns, hybridTraits.multipleEyes].filter(Boolean).length || 2;
    const traitColors = ['rgba(255, 200, 100, ', 'rgba(100, 200, 255, ', 'rgba(255, 150, 200, ', 'rgba(200, 100, 255, '];
    for (let i = 0; i < Math.max(2, traitCount); i++) {
      const tAngle = chimPhase + (i / traitCount) * TAU;
      const tDist = r * (1.6 + Math.sin(chimPhase * 1.5 + i) * 0.4);
      const colorIdx = i % traitColors.length;
      ctx.beginPath();
      ctx.arc(
        Math.cos(tAngle) * tDist,
        Math.sin(tAngle) * tDist,
        r * 0.12,
        0, TAU
      );
      ctx.fillStyle = `${traitColors[colorIdx]}${0.5 + Math.sin(chimPhase + i) * 0.3})`;
      ctx.fill();
    }
    // Chaotic swirl lines
    ctx.save();
    ctx.rotate(chimPhase * 0.3);
    for (let i = 0; i < 3; i++) {
      const swirlAngle = (i / 3) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(swirlAngle) * r, Math.sin(swirlAngle) * r);
      ctx.quadraticCurveTo(
        Math.cos(swirlAngle + 0.5) * r * 1.5,
        Math.sin(swirlAngle + 0.5) * r * 1.5,
        Math.cos(swirlAngle + 1) * r * 2,
        Math.sin(swirlAngle + 1) * r * 2
      );
      ctx.strokeStyle = `rgba(200, 150, 255, ${0.2 + Math.sin(chimPhase * 2 + i) * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  const isEating = creature.animation?.state === 'eating';
  let eatScale = 1;
  if (isEating) {
    const eatPhase = (worldTime - (creature.animation.lastEat || 0)) * 8;
    eatScale = 1 + Math.sin(eatPhase) * 0.15;
  }

  const renderSize = r * 4 * eatScale;
  const spriteFrame = getCachedSpriteFrame(creature, worldTime, renderSize);
  if (spriteFrame) {
    ctx.drawImage(spriteFrame, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
  } else if (creature._cachedCanvas) {
    ctx.drawImage(creature._cachedCanvas, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
  } else {
    ctx.save();
    ctx.scale(eatScale, 2 - eatScale);
    const bodyScale = 0.8 + (2 - g.metabolism) * 0.3;
    ctx.scale(1, bodyScale);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, 3.5 / bodyScale);
    ctx.lineTo(-4, -3.5 / bodyScale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (isEating) {
      ctx.save();
      const mouthPhase = (worldTime - (creature.animation.lastEat || 0)) * 12;
      const mouthOpen = Math.abs(Math.sin(mouthPhase)) * 2;
      ctx.beginPath();
      ctx.arc(6, 0, mouthOpen, 0, TAU);
      ctx.fillStyle = 'rgba(100, 200, 100, 0.6)';
      ctx.fill();
      ctx.restore();
    }

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

  const isHunting = g.predator && creature.target?.creatureId !== undefined;
  if (isHunting) {
    ctx.save();
    const huntPulse = (worldTime * 6) % TAU;
    ctx.strokeStyle = `rgba(255, 80, 80, ${0.3 + Math.sin(huntPulse) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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

export function getCachedSpriteFrame(creature, worldTime = 0, renderSize = 64) {
  const spriteSets = creature._cachedSpriteSets;
  if (!spriteSets || Object.keys(spriteSets).length === 0) {
    return null;
  }

  const sizes = [32, 48, 64, 96, 128];
  let chosenSize = 64;
  for (let i = 0; i < sizes.length; i++) {
    if (sizes[i] >= renderSize) {
      chosenSize = sizes[i];
      break;
    }
    if (i === sizes.length - 1) {
      chosenSize = sizes[i];
    }
  }

  let spriteSet = spriteSets[chosenSize];
  if (!spriteSet || !spriteSet.frames || spriteSet.frames.length === 0) {
    spriteSet = spriteSets[64];
  }
  if (!spriteSet || !spriteSet.frames || spriteSet.frames.length === 0) {
    const firstKey = Object.keys(spriteSets)[0];
    spriteSet = firstKey ? spriteSets[firstKey] : null;
  }
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
  creature._cachedSpriteSets = {};

  const zoomSizes = [32, 48, 64, 96, 128];
  zoomSizes.forEach(size => {
    assetLoader.requestSpriteFrames(assetType, { color: colorStr, size }).then(spriteSet => {
      if (creature._cachedColor === colorStr && creature._cachedAssetType === assetType) {
        creature._cachedSpriteSets[size] = spriteSet;
        if (size === 64) {
          creature._cachedCanvas = spriteSet?.frames?.[0] || null;
        }
      }
    }).catch(error => {
      console.debug(`Failed to prepare sprite frames for ${assetType} at size ${size}:`, error);
    });
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
