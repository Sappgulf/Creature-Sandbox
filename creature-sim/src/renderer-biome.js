import { clamp } from './utils.js';
import { assetLoader } from './asset-loader.js?v=20260423-assets1';

const biomeColors = {
  forest: [36, 68, 58],
  desert: [98, 76, 46],
  tundra: [70, 86, 108],
  swamp: [34, 72, 66],
  ocean: [28, 62, 104],
  mountain: [74, 66, 62],
  jungle: [34, 78, 66],
  savanna: [96, 86, 48],
  meadow: [72, 94, 60],
  grassland: [62, 82, 52],
  water: [34, 74, 116],
  wetland: [42, 82, 74]
};

export function getSeasonalGroundTint(season, phase) {
  const tintFactors = {
    spring: { r: 0.01, g: 0.02, b: -0.01 },
    summer: { r: 0.02, g: 0.01, b: -0.01 },
    autumn: { r: 0.03, g: -0.01, b: -0.02 },
    winter: { r: -0.02, g: -0.01, b: 0.03 }
  };

  const t = tintFactors[season];
  const blendFactor = 0.5 + phase * 0.5;

  return {
    r: t.r * blendFactor,
    g: t.g * blendFactor,
    b: t.b * blendFactor
  };
}

export function getBiomeTint(biomeType) {
  switch (biomeType) {
    case 'forest': return 'rgba(72, 96, 84, 0.4)';
    case 'desert': return 'rgba(150, 118, 84, 0.32)';
    case 'mountain': return 'rgba(111, 102, 96, 0.28)';
    case 'wetland': return 'rgba(86, 122, 111, 0.36)';
    case 'water': return 'rgba(76, 112, 146, 0.46)';
    case 'meadow': return 'rgba(129, 143, 104, 0.34)';
    case 'grassland':
    default: return 'rgba(114, 124, 92, 0.34)';
  }
}

export function drawBiomeGround(renderer, ctx, world) {
  const bounds = renderer._viewBounds;
  const season = world.currentSeason || 'spring';
  const phase = world.seasonPhase || 0;
  const seasonGroundTint = getSeasonalGroundTint(season, phase);

  // Fill base background
  ctx.fillStyle = renderer.background;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;
  const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
  ctx.fillRect(bounds.x1 - extendAmount, bounds.y1 - extendAmount, visibleWidth + extendAmount * 2, visibleHeight + extendAmount * 2);

  const atmosphereGradient = ctx.createLinearGradient(
    bounds.x1,
    bounds.y1,
    bounds.x2,
    bounds.y2
  );
  atmosphereGradient.addColorStop(0, 'rgba(40, 64, 92, 0.12)');
  atmosphereGradient.addColorStop(0.48, 'rgba(5, 8, 18, 0.04)');
  atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
  ctx.fillStyle = atmosphereGradient;
  ctx.fillRect(
    bounds.x1 - extendAmount,
    bounds.y1 - extendAmount,
    visibleWidth + extendAmount * 2,
    visibleHeight + extendAmount * 2
  );

  // Blend biome-colored ground with soft radial patches to avoid the hard
  // checkerboard look of one-fill-per-cell terrain blocks.
  if (world.getBiomeAt && renderer.camera.zoom > 0.18) {
    const sampleSpacing = Math.max(110, 250 / renderer.camera.zoom);
    const overlayAlpha = clamp(0.08 + renderer.camera.zoom * 0.08, 0.08, 0.18);
    const influenceRadius = sampleSpacing * 0.92;
    const startX = Math.floor(bounds.x1 / sampleSpacing) * sampleSpacing;
    const startY = Math.floor(bounds.y1 / sampleSpacing) * sampleSpacing;
    for (let gx = startX; gx < bounds.x2 + sampleSpacing; gx += sampleSpacing) {
      for (let gy = startY; gy < bounds.y2 + sampleSpacing; gy += sampleSpacing) {
        const cx = gx + sampleSpacing * 0.5;
        const cy = gy + sampleSpacing * 0.5;
        const biome = world.getBiomeAt(cx, cy);
        const biomeColor = biome?.type ? biomeColors[biome.type] : null;
        if (!biomeColor) {
          continue;
        }

        const gradient = ctx.createRadialGradient(
          cx,
          cy,
          influenceRadius * 0.12,
          cx,
          cy,
          influenceRadius
        );
        const tintedColor = [
          clamp(biomeColor[0] + seasonGroundTint.r * 100, 0, 255),
          clamp(biomeColor[1] + seasonGroundTint.g * 100, 0, 255),
          clamp(biomeColor[2] + seasonGroundTint.b * 100, 0, 255)
        ];
        gradient.addColorStop(0, `rgba(${tintedColor.join(',')}, ${overlayAlpha})`);
        gradient.addColorStop(0.55, `rgba(${tintedColor.join(',')}, ${overlayAlpha * 0.46})`);
        gradient.addColorStop(1, `rgba(${tintedColor.join(',')}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(
          cx - influenceRadius,
          cy - influenceRadius,
          influenceRadius * 2,
          influenceRadius * 2
        );
      }
    }
  }

  if (renderer.camera.zoom > 0.3) {
    const textureSpacing = Math.max(90, 150 / renderer.camera.zoom);
    const dotRadius = clamp(0.9 / renderer.camera.zoom, 0.65, 1.8);
    const startX = Math.floor(bounds.x1 / textureSpacing) * textureSpacing;
    const startY = Math.floor(bounds.y1 / textureSpacing) * textureSpacing;
    ctx.save();
    for (let gx = startX; gx < bounds.x2 + textureSpacing; gx += textureSpacing) {
      for (let gy = startY; gy < bounds.y2 + textureSpacing; gy += textureSpacing) {
        const jitterX = Math.sin(gx * 0.031 + gy * 0.017) * textureSpacing * 0.28;
        const jitterY = Math.cos(gx * 0.021 - gy * 0.029) * textureSpacing * 0.22;
        const x = gx + textureSpacing * 0.5 + jitterX;
        const y = gy + textureSpacing * 0.5 + jitterY;
        const biome = world.getBiomeAt?.(x, y);
        const tint = biome?.type === 'water'
          ? 'rgba(120, 190, 230, 0.12)'
          : biome?.type === 'desert'
            ? 'rgba(244, 190, 120, 0.1)'
            : 'rgba(170, 210, 170, 0.08)';
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/**
 * Draw water biomes with animated wave effects
 */
export function drawWaterBiomes(renderer, ctx, world) {
  const bounds = renderer._viewBounds;
  const zoom = renderer.camera.zoom;

  if (zoom < 0.25) return;

  const worldTime = world.t || 0;
  const sampleSize = Math.max(40, 100 / zoom);

  const startX = Math.max(0, Math.floor(bounds.x1 / sampleSize) * sampleSize);
  const startY = Math.max(0, Math.floor(bounds.y1 / sampleSize) * sampleSize);
  const endX = Math.min(world.width, bounds.x2);
  const endY = Math.min(world.height, bounds.y2);

  ctx.save();

  for (let y = startY; y < endY; y += sampleSize) {
    for (let x = startX; x < endX; x += sampleSize) {
      const biome = world.getBiomeAt(x, y);
      if (biome?.type !== 'water') continue;

      const depth = biome.depth || 0.5;
      const isDeep = depth > 0.7;
      const isShallow = depth < 0.3;

      const baseColor = isDeep ? 'rgba(30, 64, 175, 0.6)' : isShallow ? 'rgba(96, 165, 250, 0.45)' : 'rgba(59, 130, 246, 0.5)';
      ctx.fillStyle = baseColor;
      ctx.fillRect(x, y, sampleSize, sampleSize);

      if (zoom > 0.5) {
        const waveOffset = Math.sin(worldTime * 2 + x * 0.02 + y * 0.01) * 0.5 + 0.5;
        const waveAlpha = 0.1 + waveOffset * 0.15;

        ctx.fillStyle = `rgba(147, 197, 253, ${waveAlpha})`;

        const waveY = y + sampleSize * 0.3 + Math.sin(worldTime * 1.5 + x * 0.03) * sampleSize * 0.1;
        ctx.beginPath();
        ctx.moveTo(x, waveY);

        for (let wx = x; wx < x + sampleSize; wx += 10) {
          const wy = waveY + Math.sin(worldTime * 2 + wx * 0.05) * 3;
          ctx.lineTo(wx, wy);
        }

        ctx.lineTo(x + sampleSize, y + sampleSize);
        ctx.lineTo(x, y + sampleSize);
        ctx.closePath();
        ctx.fill();
      }

      if (zoom > 0.6) {
        const t = worldTime * 0.4;
        const cx = x + sampleSize / 2;
        const cy = y + sampleSize / 2;

        ctx.strokeStyle = `rgba(147, 197, 253, ${0.12 + Math.sin(t) * 0.04})`;
        ctx.lineWidth = 1;

        for (let i = 0; i < 3; i++) {
          const offset = i * Math.PI * 0.66;
          const radius = sampleSize * (0.2 + i * 0.12);
          const driftX = Math.sin(t * 1.3 + offset) * 4;
          const driftY = Math.cos(t * 0.9 + offset) * 4;

          ctx.beginPath();
          ctx.arc(cx + driftX, cy + driftY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (zoom > 0.7) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + Math.sin(worldTime * 3 + x * 0.1 + y * 0.1) * 0.02})`;
        const ripplePhase = worldTime * 1.5 + x * 0.05 + y * 0.03;
        const rippleCount = 2;
        for (let r = 0; r < rippleCount; r++) {
          const phase = ripplePhase + r * Math.PI;
          const rx = x + sampleSize * 0.5 + Math.sin(phase) * sampleSize * 0.25;
          const ry = y + sampleSize * 0.5 + Math.cos(phase * 0.7) * sampleSize * 0.2;
          const rr = sampleSize * (0.08 + Math.sin(phase * 2) * 0.04);

          ctx.beginPath();
          ctx.arc(rx, ry, rr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (zoom > 0.8 && !isShallow) {
        ctx.strokeStyle = `rgba(186, 230, 253, ${0.08 + Math.sin(worldTime * 2.5 + x * 0.02) * 0.03})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        const wlx = x + Math.sin(worldTime + x * 0.01) * sampleSize * 0.3;
        ctx.moveTo(wlx, y);
        ctx.lineTo(wlx + sampleSize * 0.4, y + sampleSize * 0.6);
        ctx.lineTo(wlx + sampleSize * 0.1, y + sampleSize);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Draw creature territory zones showing dominant creature types in regions
 */
export function drawCreatureTerritoryZones(renderer, ctx, world) {
  if (!world.creatures || world.creatures.length < 5) return;

  const bounds = renderer._viewBounds;
  const zoom = renderer.camera.zoom;

  // Sample grid size based on zoom
  const sampleSize = Math.max(80, 150 / zoom);
  const startX = Math.floor(bounds.x1 / sampleSize) * sampleSize;
  const startY = Math.floor(bounds.y1 / sampleSize) * sampleSize;
  const endX = Math.min(world.width, bounds.x2);
  const endY = Math.min(world.height, bounds.y2);

  ctx.save();

  // Track territory data for each grid cell
  const cellSize = sampleSize;
  const gridCols = Math.ceil((endX - startX) / cellSize);
  const gridRows = Math.ceil((endY - startY) / cellSize);

  // Initialize grid with type counts
  const grid = [];
  for (let i = 0; i < gridCols * gridRows; i++) {
    grid.push({ predator: 0, herbivore: 0, omnivore: 0, total: 0 });
  }

  // Count creatures in each cell
  for (const c of world.creatures) {
    if (!c.alive || c.x < startX || c.x > endX || c.y < startY || c.y > endY) continue;

    const col = Math.floor((c.x - startX) / cellSize);
    const row = Math.floor((c.y - startY) / cellSize);
    const idx = row * gridCols + col;
    if (idx < 0 || idx >= grid.length) continue;

    const diet = c.genes?.diet ?? (c.genes?.predator ? 1.0 : 0.0);
    if (diet > 0.7) {
      grid[idx].predator++;
    } else if (diet > 0.3) {
      grid[idx].omnivore++;
    } else {
      grid[idx].herbivore++;
    }
    grid[idx].total++;
  }

  // Draw territory zones with gradient overlays
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const idx = row * gridCols + col;
      const cell = grid[idx];
      if (cell.total < 2) continue; // Need at least 2 creatures to show territory

      const x = startX + col * cellSize;
      const y = startY + row * cellSize;

      // Determine dominant type
      let dominantColor, dominantAlpha;
      if (cell.predator >= cell.herbivore && cell.predator >= cell.omnivore && cell.predator >= 2) {
        dominantColor = 'rgba(220, 60, 60, 0.035)';
        dominantAlpha = Math.min(0.08, cell.predator * 0.014);
      } else if (cell.omnivore >= cell.herbivore && cell.omnivore >= 2) {
        dominantColor = 'rgba(200, 160, 80, 0.032)';
        dominantAlpha = Math.min(0.07, cell.omnivore * 0.012);
      } else if (cell.herbivore >= 3) {
        dominantColor = 'rgba(80, 180, 80, 0.028)';
        dominantAlpha = Math.min(0.06, cell.herbivore * 0.01);
      } else {
        continue;
      }

      // Draw territory gradient
      const gradient = ctx.createRadialGradient(
        x + cellSize / 2, y + cellSize / 2, 0,
        x + cellSize / 2, y + cellSize / 2, cellSize * 0.7
      );
      gradient.addColorStop(0, dominantColor.replace(/[\d.]+\)$/, `${dominantAlpha})`));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawDayNightOverlay(renderer, ctx, world) {
  const dayNight = world.dayNightState || world.environment?.getDayNightState?.();
  const light = dayNight?.light ?? 1;
  const phase = dayNight?.phase ?? null;
  const darkness = clamp(1 - light, 0, 0.75);

  if (darkness > 0.05) {
    // Fill entire visible area, not just world bounds
    const bounds = renderer._viewBounds;
    const visibleWidth = bounds.x2 - bounds.x1;
    const visibleHeight = bounds.y2 - bounds.y1;
    const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
    ctx.fillStyle = `rgba(5, 14, 34, ${darkness})`;
    ctx.fillRect(
      bounds.x1 - extendAmount,
      bounds.y1 - extendAmount,
      visibleWidth + extendAmount * 2,
      visibleHeight + extendAmount * 2
    );
  }

  if (phase === 'dawn' || phase === 'dusk' || phase === 'night') {
    const tint = phase === 'dawn'
      ? `rgba(255, 170, 120, ${0.12 * (1 - darkness * 0.5)})`
      : phase === 'dusk'
        ? `rgba(120, 110, 200, ${0.12 * (1 - darkness * 0.4)})`
        : `rgba(35, 60, 120, ${0.08 + darkness * 0.15})`;
    const bounds = renderer._viewBounds;
    const visibleWidth = bounds.x2 - bounds.x1;
    const visibleHeight = bounds.y2 - bounds.y1;
    const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
    ctx.fillStyle = tint;
    ctx.fillRect(
      bounds.x1 - extendAmount,
      bounds.y1 - extendAmount,
      visibleWidth + extendAmount * 2,
      visibleHeight + extendAmount * 2
    );
  }
}

// NEW: Draw season-based overlay tint with smooth transitions
export function drawSeasonOverlay(renderer, ctx, world) {
  const season = world.currentSeason || 'spring';
  const phase = world.seasonPhase || 0;

  const seasonColors = {
    spring: { r: 128, g: 202, b: 180, baseAlpha: 0.018 },
    summer: { r: 246, g: 196, b: 118, baseAlpha: 0.02 },
    autumn: { r: 214, g: 124, b: 68, baseAlpha: 0.026 },
    winter: { r: 150, g: 190, b: 240, baseAlpha: 0.034 }
  };

  const seasonOrder = ['spring', 'summer', 'autumn', 'winter'];
  const currentIdx = seasonOrder.indexOf(season);
  const nextIdx = (currentIdx + 1) % 4;

  const current = seasonColors[season];
  const next = seasonColors[seasonOrder[nextIdx]];

  let transitionTint;
  if (phase < 0.7) {
    const t = phase / 0.7;
    const r = Math.round(current.r + (next.r - current.r) * t);
    const g = Math.round(current.g + (next.g - current.g) * t);
    const b = Math.round(current.b + (next.b - current.b) * t);
    const alpha = current.baseAlpha + (next.baseAlpha - current.baseAlpha) * t;
    transitionTint = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else {
    const t = (phase - 0.7) / 0.3;
    const r = Math.round(next.r + (next.r - current.r) * t * 0.3);
    const g = Math.round(next.g + (next.g - current.g) * t * 0.3);
    const b = Math.round(next.b + (next.b - current.b) * t * 0.3);
    transitionTint = `rgba(${r}, ${g}, ${b}, ${next.baseAlpha})`;
  }

  const bounds = renderer._viewBounds;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;
  const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
  ctx.fillStyle = transitionTint;
  ctx.fillRect(
    bounds.x1 - extendAmount,
    bounds.y1 - extendAmount,
    visibleWidth + extendAmount * 2,
    visibleHeight + extendAmount * 2
  );
}

export function drawMoodOverlay(renderer, ctx, world, intensity, type) {
  if (!type || intensity <= 0.05) return;
  const bounds = renderer._viewBounds;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;
  const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
  const tint = type === 'wind'
    ? `rgba(129, 167, 255, ${0.08 * intensity})`
    : `rgba(110, 200, 180, ${0.08 * intensity})`;
  ctx.fillStyle = tint;
  ctx.fillRect(
    bounds.x1 - extendAmount,
    bounds.y1 - extendAmount,
    visibleWidth + extendAmount * 2,
    visibleHeight + extendAmount * 2
  );

  if (type === 'wind' && intensity > 0.12) {
    drawWindStreaks(renderer, ctx, world, intensity);
  }
}

export function drawWindStreaks(renderer, ctx, world, intensity) {
  const bounds = renderer._viewBounds;
  const streakCount = Math.floor(10 + intensity * 10);
  const baseLength = 45 + intensity * 60;
  ctx.save();
  ctx.strokeStyle = `rgba(226, 240, 255, ${0.12 + intensity * 0.2})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < streakCount; i++) {
    const seed = i * 73.1;
    const x = bounds.x1 + ((seed * 31) % 1) * (bounds.x2 - bounds.x1);
    const y = bounds.y1 + ((seed * 17) % 1) * (bounds.y2 - bounds.y1);
    const offset = Math.sin((world.t * 0.6) + seed) * 12;
    ctx.beginPath();
    ctx.moveTo(x - baseLength * 0.4, y + offset);
    ctx.lineTo(x + baseLength * 0.6, y + offset - baseLength * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

export function getDecorationSpriteAsset(dec) {
  switch (dec.type) {
    case 'tree': return 'env_trees';
    case 'rock': return 'env_rocks';
    case 'flower': return 'env_flowers';
    case 'grass': return 'env_flowers';
    default: return null;
  }
}

export function getSeasonalDecorationModifier(dec, world) {
  const season = world.currentSeason || 'spring';
  const phase = world.seasonPhase || 0;

  const modifier = {
    hueShift: 0,
    saturationMult: 1,
    lightnessMult: 1,
    alphaMult: 1,
    isBare: false
  };

  switch (season) {
    case 'spring':
      modifier.saturationMult = 0.7 + phase * 0.3;
      modifier.lightnessMult = 0.85 + phase * 0.15;
      if (dec.type === 'flower') {
        modifier.alphaMult = 0.4 + phase * 0.6;
      }
      break;

    case 'summer':
      modifier.saturationMult = 1.0;
      modifier.lightnessMult = 1.0;
      if (dec.type === 'flower') {
        modifier.alphaMult = 0.9 + phase * 0.1;
      }
      break;

    case 'autumn': {
      const autumnProgress = phase;
      modifier.hueShift = -30 * autumnProgress;
      modifier.saturationMult = 1.0 - autumnProgress * 0.3;
      modifier.lightnessMult = 0.9 - autumnProgress * 0.2;
      if (dec.type === 'tree') {
        modifier.alphaMult = 1.0 - autumnProgress * 0.4;
        modifier.isBare = autumnProgress > 0.7;
      } else if (dec.type === 'flower') {
        modifier.alphaMult = 0.7 - autumnProgress * 0.6;
      } else if (dec.type === 'grass') {
        modifier.alphaMult = 0.8 - autumnProgress * 0.5;
      }
      break;
    }

    case 'winter': {
      modifier.hueShift = -35;
      modifier.saturationMult = 0.3;
      modifier.lightnessMult = 0.7;
      if (dec.type === 'tree') {
        modifier.alphaMult = 0.6;
        modifier.isBare = true;
      } else if (dec.type === 'flower') {
        modifier.alphaMult = 0.1;
      } else if (dec.type === 'grass') {
        modifier.alphaMult = 0.3;
      }
      break;
    }
  }

  return modifier;
}

export function drawDecoration(renderer, ctx, dec, world) {
  const assetKey = getDecorationSpriteAsset(dec);

  if (assetKey && assetLoader) {
    const spriteInfo = assetLoader.spriteSheets?.get(assetKey);
    if (spriteInfo) {
      drawDecorationFromSprite(renderer, ctx, dec, spriteInfo, assetKey, world);
      return;
    }
  }

  drawDecorationFallback(renderer, ctx, dec, world);
}

export function drawDecorationFromSprite(renderer, ctx, dec, spriteInfo, assetKey, world) {
  const { frameWidth, frameHeight } = spriteInfo;
  const spriteIndex = dec.sprite || 0;

  const mod = getSeasonalDecorationModifier(dec, world);

  ctx.save();
  ctx.translate(dec.x, dec.y);

  const scale = (dec.size || 40) / frameHeight;
  ctx.scale(scale, scale);

  ctx.globalAlpha = 0.85 * mod.alphaMult;

  if (mod.hueShift !== 0 || mod.saturationMult !== 1 || mod.lightnessMult !== 1) {
    ctx.filter = `saturate(${mod.saturationMult * 100}%) brightness(${mod.lightnessMult * 100}%)`;
    if (mod.hueShift !== 0) {
      ctx.filter += ` hue-rotate(${mod.hueShift}deg)`;
    }
  }

  const frame = assetLoader.getSpriteFrameSync(assetKey, spriteIndex, frameWidth, dec.hue);
  if (frame) {
    const anchor = spriteInfo.anchor || { x: 0.5, y: 1 };
    const anchorX = Number.isFinite(Number(anchor.x)) ? Number(anchor.x) : 0.5;
    const anchorY = Number.isFinite(Number(anchor.y)) ? Number(anchor.y) : 1;
    ctx.drawImage(frame, -frameWidth * anchorX, -frameHeight * anchorY);
  } else {
    ctx.restore();
    drawDecorationFallback(renderer, ctx, dec, world);
    return;
  }

  ctx.restore();
}

export function drawDecorationFallback(renderer, ctx, dec, world) {
  const mod = getSeasonalDecorationModifier(dec, world);

  ctx.save();
  ctx.translate(dec.x, dec.y);
  ctx.globalAlpha = 0.6 * mod.alphaMult;

  const size = dec.size || 30;

  const applyHsl = (hue, saturation, lightness) => {
    const h = (hue + mod.hueShift + 360) % 360;
    const s = clamp(saturation * mod.saturationMult, 0, 100);
    const l = clamp(lightness * mod.lightnessMult, 0, 100);
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  switch (dec.type) {
    case 'tree':
      if (mod.isBare) {
        ctx.fillStyle = applyHsl(25, 30, 20);
        ctx.fillRect(-size * 0.1, -size * 0.1, size * 0.2, size * 0.75);
        ctx.globalAlpha *= 0.5;
      } else {
        ctx.fillStyle = applyHsl(dec.hue, 35, 25);
        ctx.fillRect(-size * 0.1, -size * 0.1, size * 0.2, size * 0.75);
        ctx.fillStyle = applyHsl(dec.hue, 45, 32);
        ctx.beginPath();
        ctx.arc(0, -size * 0.35, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = applyHsl(dec.hue + 10, 40, 28);
        ctx.beginPath();
        ctx.arc(-size * 0.18, -size * 0.28, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(size * 0.15, -size * 0.32, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = applyHsl(dec.hue + 5, 50, 38);
        ctx.beginPath();
        ctx.arc(size * 0.05, -size * 0.48, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'rock':
      ctx.fillStyle = applyHsl(dec.hue, 12, 40);
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, size * 0.2);
      ctx.lineTo(-size * 0.1, -size * 0.4);
      ctx.lineTo(size * 0.3, -size * 0.2);
      ctx.lineTo(size * 0.4, size * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = applyHsl(dec.hue, 10, 52);
      ctx.beginPath();
      ctx.moveTo(-size * 0.15, size * 0.08);
      ctx.lineTo(size * 0.05, -size * 0.2);
      ctx.lineTo(size * 0.28, size * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = applyHsl(dec.hue, 8, 60);
      ctx.beginPath();
      ctx.arc(-size * 0.1, -size * 0.15, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'flower': {
      ctx.strokeStyle = applyHsl(dec.hue, 45, 35);
      ctx.lineWidth = size * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.45);
      ctx.lineTo(0, -size * 0.05);
      ctx.stroke();
      const petalCount = 5 + (Math.floor(dec.hue) % 3);
      const petalSize = size * 0.2;
      const petalRadius = size * 0.28;
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(angle) * petalRadius;
        const py = -size * 0.1 + Math.sin(angle) * petalRadius;
        ctx.fillStyle = applyHsl(dec.hue, 70, 55);
        ctx.beginPath();
        ctx.ellipse(px, py, petalSize, petalSize * 0.6, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = applyHsl(dec.hue + 40, 85, 65);
      ctx.beginPath();
      ctx.arc(0, -size * 0.1, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = applyHsl(dec.hue + 50, 90, 75);
      ctx.beginPath();
      ctx.arc(0, -size * 0.1, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'grass':
      ctx.strokeStyle = applyHsl(dec.hue, 50, 30);
      ctx.lineWidth = size * 0.07;
      for (let i = 0; i < 6; i++) {
        const offset = (i - 2.5) * size * 0.12;
        const lean = (i - 2.5) * 0.15;
        ctx.beginPath();
        ctx.moveTo(offset, size * 0.35);
        ctx.quadraticCurveTo(
          offset + lean * size * 0.2,
          -size * 0.05,
          offset + lean * size * 0.15 + Math.sin(i) * size * 0.05,
          -size * 0.45
        );
        ctx.stroke();
      }
      ctx.fillStyle = applyHsl(dec.hue + 20, 55, 25);
      ctx.beginPath();
      ctx.ellipse(0, size * 0.35, size * 0.15, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    default:
      ctx.fillStyle = applyHsl(dec.hue, 40, 40);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
  }

  ctx.restore();
}
