import { clamp } from './utils.js';

export function drawWeatherEffects(renderer, ctx, world) {
  const weatherType = world?.environment?.weatherType;
  const weatherIntensity = world?.environment?.weatherIntensity || 0;
  if (!weatherType || weatherIntensity <= 0) return;

  // Storm screen darkening overlay
  if (weatherType === 'storm' && weatherIntensity > 0.3) {
    drawStorm(renderer, ctx, world, weatherIntensity);
  }

  // Heavy rain screen-wide streaks
  if ((weatherType === 'rain' || weatherType === 'storm') && weatherIntensity > 0.5) {
    drawRain(renderer, ctx, world, weatherIntensity);
  }

  // Blizzard thickening overlay (heavy snow)
  if (weatherType === 'snow' && weatherIntensity > 0.6) {
    drawSnow(renderer, ctx, world, weatherIntensity);
  }

  // Aurora Borealis effect
  if (weatherType === 'aurora') {
    drawAurora(renderer, ctx, world, weatherIntensity);
  }

  // Screen-space weather lens effects
  if ((weatherType === 'rain' || weatherType === 'storm') && weatherIntensity > 0.3) {
    drawRainLens(renderer, ctx, world, weatherIntensity);
  }
  // Heat shimmer belongs to hot biomes under the camera. `world.currentBiome`
  // is a creature property, not a world one, so this never fired.
  const cameraBiome = renderer.camera ? world?.getBiomeAt?.(renderer.camera.x, renderer.camera.y)?.type : null;
  if (cameraBiome === 'desert' || cameraBiome === 'mountain') {
    drawHeatShimmer(renderer, ctx, world);
  }
}

export function drawStorm(renderer, ctx, world, weatherIntensity) {
  const bounds = renderer._viewBounds;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;
  const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;

  const darkness = 0.1 + (weatherIntensity - 0.3) * 0.25;
  ctx.fillStyle = `rgba(10, 15, 30, ${clamp(darkness, 0.1, 0.28)})`;
  ctx.fillRect(
    bounds.x1 - extendAmount,
    bounds.y1 - extendAmount,
    visibleWidth + extendAmount * 2,
    visibleHeight + extendAmount * 2
  );
}

export function drawRain(renderer, ctx, world, weatherIntensity) {
  const bounds = renderer._viewBounds;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;

  const time = performance.now() * 0.001;
  const streakCount = Math.floor(20 + (weatherIntensity - 0.5) * 60);
  const fallSpeed = 300 + weatherIntensity * 200;
  ctx.save();
  ctx.strokeStyle = `rgba(150, 180, 255, ${0.08 + (weatherIntensity - 0.5) * 0.15})`;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  for (let i = 0; i < streakCount; i++) {
    const seed = i * 73.1;
    const baseX = bounds.x1 + ((seed * 31) % 1) * visibleWidth;
    const baseY = bounds.y1 + ((seed * 17) % 1) * visibleHeight;
    const x = baseX + Math.sin(time * 2 + seed) * 5;
    const y = ((baseY + time * fallSpeed + seed * 50) % (visibleHeight + 80)) - 40 + bounds.y1;
    const length = 30 + weatherIntensity * 50 + Math.sin(time * 3 + seed) * 10;
    ctx.globalAlpha = 0.3 + Math.sin(time * 4 + seed) * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + length);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSnow(renderer, ctx, world, weatherIntensity) {
  const bounds = renderer._viewBounds;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;

  const time = performance.now() * 0.001;
  const snowCount = Math.floor(30 + (weatherIntensity - 0.6) * 50);
  const fallSpeed = 40 + weatherIntensity * 30;
  ctx.save();
  for (let i = 0; i < snowCount; i++) {
    const seed = i * 91.3;
    const baseX = bounds.x1 + ((seed * 23) % 1) * visibleWidth;
    const baseY = bounds.y1 + ((seed * 41) % 1) * visibleHeight;
    const drift = Math.sin(time * 0.8 + seed) * 15;
    const x = baseX + drift;
    const y = ((baseY + time * fallSpeed + seed * 30) % (visibleHeight + 40)) - 20 + bounds.y1;
    const size = 2 + Math.sin(time * 2 + seed) * 1 + weatherIntensity * 2;
    const alpha = 0.15 + Math.sin(time * 3 + seed) * 0.1;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Snow fog effect
  if (weatherIntensity > 0.75) {
    const extendAmount = Math.max(visibleWidth, visibleHeight) * 2;
    const fogAlpha = (weatherIntensity - 0.75) * 0.3;
    ctx.fillStyle = `rgba(200, 210, 230, ${fogAlpha})`;
    ctx.fillRect(
      bounds.x1 - extendAmount,
      bounds.y1 - extendAmount,
      visibleWidth + extendAmount * 2,
      visibleHeight + extendAmount * 2
    );
  }
}

export function drawAurora(renderer, ctx, world, weatherIntensity) {
  const bounds = renderer._viewBounds;
  const time = performance.now() * 0.001;
  const gradient = ctx.createLinearGradient(0, bounds.y1, 0, bounds.y1 + 200);
  gradient.addColorStop(0, 'rgba(0, 255, 128, 0)');
  gradient.addColorStop(0.3, `rgba(0, 255, 200, ${0.15 * weatherIntensity})`);
  gradient.addColorStop(0.5, `rgba(128, 255, 255, ${0.2 * weatherIntensity})`);
  gradient.addColorStop(0.7, `rgba(0, 200, 255, ${0.15 * weatherIntensity})`);
  gradient.addColorStop(1, 'rgba(0, 255, 128, 0)');

  ctx.fillStyle = gradient;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x1, bounds.y1, bounds.x2 - bounds.x1, bounds.y2 - bounds.y1);
  ctx.clip();

  // Draw wavy aurora bands
  for (let i = 0; i < 3; i++) {
    const yOffset = 30 + i * 40;
    const waveOffset = Math.sin(time * 0.5 + i * 0.7) * 20;

    ctx.beginPath();
    ctx.moveTo(bounds.x1, bounds.y1 + yOffset);

    for (let x = bounds.x1; x <= bounds.x2; x += 20) {
      const y = bounds.y1 + yOffset + Math.sin(x * 0.005 + time * 0.8 + i) * waveOffset;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(bounds.x2, bounds.y1 + yOffset + 60);
    ctx.lineTo(bounds.x1, bounds.y1 + yOffset + 60);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawRainLens(renderer, ctx, world, weatherIntensity) {
  const bounds = renderer._viewBounds;
  const visibleWidth = bounds.x2 - bounds.x1;
  const visibleHeight = bounds.y2 - bounds.y1;
  const time = performance.now() * 0.001;

  // Raindrops on "camera lens" - semi-transparent circles sliding down
  const dropCount = Math.floor(4 + weatherIntensity * 10);
  ctx.save();
  for (let i = 0; i < dropCount; i++) {
    const seed = i * 137.5;
    const x = bounds.x1 + ((seed * 53) % 1) * visibleWidth;
    const speed = 20 + ((seed * 31) % 1) * 40;
    const y = ((seed * 100 + time * speed) % (visibleHeight + 60)) - 30 + bounds.y1;
    const size = 1.5 + ((seed * 19) % 1) * 2.5;
    const alpha = 0.08 + ((seed * 7) % 1) * 0.12;

    ctx.fillStyle = `rgba(180, 210, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Tiny trail below drop
    ctx.strokeStyle = `rgba(180, 210, 255, ${alpha * 0.5})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, y + size + size * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHeatShimmer(renderer, ctx, _world) {
  const bounds = renderer._viewBounds;
  const visibleHeight = bounds.y2 - bounds.y1;
  const time = performance.now() * 0.001;

  // Subtle horizontal wave distortion bands near the ground
  ctx.save();
  const bandCount = 3;
  for (let i = 0; i < bandCount; i++) {
    const yBase = bounds.y1 + visibleHeight * (0.55 + i * 0.12);
    const waveHeight = 2 + Math.sin(time * 2 + i) * 1.5;
    const alpha = 0.02 + Math.sin(time * 1.5 + i * 0.8) * 0.015;

    ctx.fillStyle = `rgba(255, 200, 120, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(bounds.x1, yBase);
    for (let x = bounds.x1; x <= bounds.x2; x += 30) {
      const y = yBase + Math.sin(x * 0.02 + time * 3 + i * 1.3) * waveHeight;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(bounds.x2, yBase + 8);
    ctx.lineTo(bounds.x1, yBase + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Disasters used to change only the minimap tint: an Ice Age ran for two
// minutes over a green spring meadow. This gives each one a main-view look,
// eased in and out over a few seconds of its timer.
const DISASTER_FADE_SECONDS = 4;
let _frostVignette = null;

function disasterStrength(disaster) {
  const duration = Number(disaster.duration) || 0;
  const remaining = Number(disaster.timeRemaining);
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  const elapsed = Math.max(0, duration - remaining);
  return clamp(Math.min(elapsed, remaining) / DISASTER_FADE_SECONDS, 0, 1);
}

function washView(renderer, ctx, color) {
  const b = renderer._viewBounds;
  const pad = Math.max(b.x2 - b.x1, b.y2 - b.y1);
  ctx.fillStyle = color;
  ctx.fillRect(b.x1 - pad, b.y1 - pad, b.x2 - b.x1 + pad * 2, b.y2 - b.y1 + pad * 2);
}

function drawFrostVignette(ctx, strength) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (!_frostVignette || _frostVignette.w !== w || _frostVignette.h !== h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(225, 240, 255, 0)');
    g.addColorStop(0.7, 'rgba(225, 240, 255, 0.28)');
    g.addColorStop(1, 'rgba(245, 250, 255, 0.62)');
    _frostVignette = { w, h, g };
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = strength;
  ctx.fillStyle = _frostVignette.g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawMeteors(renderer, ctx, strength) {
  const b = renderer._viewBounds;
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const time = performance.now() * 0.001;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const seed = i * 57.1;
    const cycle = (time * 0.35 + seed) % 1;
    const x = b.x1 + ((seed * 13.7) % 1) * w + cycle * w * 0.25;
    const y = b.y1 + cycle * h;
    const len = 60 + ((seed * 7) % 1) * 50;
    const grad = ctx.createLinearGradient(x - len * 0.45, y - len, x, y);
    grad.addColorStop(0, 'rgba(255, 170, 90, 0)');
    grad.addColorStop(1, `rgba(255, 220, 160, ${0.85 * strength})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - len * 0.45, y - len);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMotes(renderer, ctx, strength, color) {
  const b = renderer._viewBounds;
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const time = performance.now() * 0.001;
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < 40; i++) {
    const seed = i * 33.7;
    const x = b.x1 + ((seed * 19.3) % 1) * w + Math.sin(time * 0.5 + seed) * 20;
    const y = b.y1 + ((seed * 29.1 + time * 0.03) % 1) * h;
    ctx.globalAlpha = strength * (0.35 + 0.3 * Math.sin(time * 1.7 + seed));
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawDisasterOverlay(renderer, ctx, world) {
  const disaster = typeof world?.getActiveDisaster === 'function' ? world.getActiveDisaster() : null;
  if (!disaster?.type) return;
  const strength = disasterStrength(disaster);
  if (strength <= 0) return;
  const motion = !renderer._reducedMotion;
  switch (disaster.type) {
    case 'iceAge':
      washView(renderer, ctx, `rgba(206, 226, 250, ${0.3 * strength})`);
      if (motion) drawSnow(renderer, ctx, world, 0.6 + 0.4 * strength);
      drawFrostVignette(ctx, strength);
      break;
    case 'drought':
      washView(renderer, ctx, `rgba(214, 168, 86, ${0.2 * strength})`);
      if (motion) drawHeatShimmer(renderer, ctx, world);
      break;
    case 'plague':
      washView(renderer, ctx, `rgba(120, 80, 160, ${0.16 * strength})`);
      if (motion) drawMotes(renderer, ctx, strength, 'rgb(190, 150, 230)');
      break;
    case 'meteorStorm':
      washView(renderer, ctx, `rgba(90, 24, 16, ${0.24 * strength})`);
      if (motion) drawMeteors(renderer, ctx, strength);
      break;
    default:
      break;
  }
}
