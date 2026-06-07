/**
 * Parallax background rendering — adds spatial depth to the world.
 * Three layers scroll at different rates based on camera position/zoom.
 * Plus a vignette overlay and ambient drift particles.
 */

const STAR_LAYER_COUNT = 60;
const MID_LAYER_COUNT = 35;
const PARTICLE_COUNT_DESKTOP = 280;
const PARTICLE_COUNT_MOBILE = 120;

// Deterministic pseudo-random based on index (so layers are stable)
function seededRand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Star/distant layer — small bright dots in deep space tones
const starLayer = Array.from({ length: STAR_LAYER_COUNT }, (_, i) => ({
  x: seededRand(i + 1) * 4000 - 2000,
  y: seededRand(i + 100) * 3000 - 1500,
  r: 0.3 + seededRand(i + 200) * 0.9,
  alpha: 0.15 + seededRand(i + 300) * 0.4,
  twinkleSpeed: 0.4 + seededRand(i + 400) * 0.8,
  twinkleOffset: seededRand(i + 500) * Math.PI * 2
}));

// Midground layer — soft glowing orbs
const midLayer = Array.from({ length: MID_LAYER_COUNT }, (_, i) => ({
  x: seededRand(i + 600) * 5000 - 2500,
  y: seededRand(i + 700) * 4000 - 2000,
  r: 1.5 + seededRand(i + 800) * 3,
  alpha: 0.05 + seededRand(i + 900) * 0.1,
  hue: 180 + seededRand(i + 1000) * 80, // cyan to purple range
  drift: 0.2 + seededRand(i + 1100) * 0.3
}));

/**
 * Draw the parallax background layers.
 * Call BEFORE biome ground so layers are behind everything.
 */
export function drawParallaxBackground(renderer, ctx, world) {
  const camera = renderer.camera;
  const isMobile = renderer.isMobile;
  const time = performance.now() * 0.001;

  // Layer 1: Far stars (scrolls at 0.1x camera speed)
  ctx.save();
  const farOffsetX = -camera.x * 0.1;
  const farOffsetY = -camera.y * 0.1;
  const farZoom = camera.zoom * 0.6;
  ctx.translate(farOffsetX, farOffsetY);
  ctx.scale(farZoom, farZoom);
  for (const star of starLayer) {
    const twinkle = 0.6 + 0.4 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
    ctx.fillStyle = `rgba(200, 220, 255, ${star.alpha * twinkle})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Layer 2: Midground glow orbs (scrolls at 0.3x)
  ctx.save();
  const midOffsetX = -camera.x * 0.3;
  const midOffsetY = -camera.y * 0.3;
  const midZoom = camera.zoom * 0.8;
  ctx.translate(midOffsetX, midOffsetY);
  ctx.scale(midZoom, midZoom);
  for (const orb of midLayer) {
    // Slow drift
    const driftX = Math.sin(time * orb.drift + orb.x * 0.001) * 20;
    const driftY = Math.cos(time * orb.drift * 0.7 + orb.y * 0.001) * 15;
    const gradient = ctx.createRadialGradient(
      orb.x + driftX,
      orb.y + driftY,
      0,
      orb.x + driftX,
      orb.y + driftY,
      orb.r * 2.5
    );
    gradient.addColorStop(0, `hsla(${orb.hue}, 60%, 70%, ${orb.alpha})`);
    gradient.addColorStop(1, `hsla(${orb.hue}, 60%, 70%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(orb.x + driftX, orb.y + driftY, orb.r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Layer 3: Ambient drift particles (in world space, scroll with camera)
  const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
  if (!renderer._ambientParticles || renderer._ambientParticles.length !== particleCount) {
    renderer._ambientParticles = Array.from({ length: particleCount }, (_, i) => ({
      x: seededRand(i + 2000) * (world.width || 5000) - 1000,
      y: seededRand(i + 3000) * (world.height || 3500) - 1000,
      vx: (seededRand(i + 4000) - 0.5) * 4,
      vy: (seededRand(i + 5000) - 0.5) * 4,
      r: 0.4 + seededRand(i + 6000) * 0.8,
      alpha: 0.08 + seededRand(i + 7000) * 0.12,
      hue: 160 + seededRand(i + 8000) * 60
    }));
  }
  const particles = renderer._ambientParticles;
  const bounds = renderer._viewBounds;
  ctx.save();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
    // Wrap around view bounds
    if (p.x < bounds.x1 - 50) p.x = bounds.x2 + 50;
    if (p.x > bounds.x2 + 50) p.x = bounds.x1 - 50;
    if (p.y < bounds.y1 - 50) p.y = bounds.y2 + 50;
    if (p.y > bounds.y2 + 50) p.y = bounds.y1 - 50;
    ctx.fillStyle = `hsla(${p.hue}, 50%, 80%, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw a soft vignette overlay to pull focus to the center.
 * Call AFTER all world rendering, BEFORE UI overlays.
 */
export function drawVignette(renderer, ctx) {
  const vpW = renderer._viewportWidth || window.innerWidth;
  const vpH = renderer._viewportHeight || window.innerHeight;
  const cx = vpW / 2;
  const cy = vpH / 2;
  const innerR = Math.min(vpW, vpH) * 0.25;
  const outerR = Math.max(vpW, vpH) * 0.75;

  const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.05)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, vpW, vpH);
}

/**
 * Draw a screen-space noise grain overlay for cinematic texture.
 * Very subtle, uses a small cached noise pattern.
 */
let _noisePattern = null;
export function drawGrainOverlay(renderer, ctx) {
  const vpW = renderer._viewportWidth || window.innerWidth;
  const vpH = renderer._viewportHeight || window.innerHeight;
  if (!_noisePattern) {
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;
    const nctx = noiseCanvas.getContext('2d');
    const imageData = nctx.createImageData(128, 128);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = Math.random() * 255;
      imageData.data[i] = v;
      imageData.data[i + 1] = v;
      imageData.data[i + 2] = v;
      imageData.data[i + 3] = 12; // very low alpha
    }
    nctx.putImageData(imageData, 0, 0);
    _noisePattern = noiseCanvas;
  }
  ctx.save();
  ctx.globalAlpha = 0.3;
  const pattern = ctx.createPattern(_noisePattern, 'repeat');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, vpW, vpH);
  ctx.restore();
}

/**
 * Draw soft floating spore particles near creatures — adds life to the scene.
 * Uses world time for animation.
 */
export function drawAmbientSpores(renderer, ctx) {
  if (renderer.camera.zoom < 0.3) return;
  const time = performance.now() * 0.001;
  const bounds = renderer._viewBounds;
  const sporeCount = renderer.isMobile ? 40 : 80;
  ctx.save();
  for (let i = 0; i < sporeCount; i++) {
    const seed = i * 17.3;
    const baseX = bounds.x1 + ((seed * 31) % 1) * (bounds.x2 - bounds.x1);
    const baseY = bounds.y1 + ((seed * 47) % 1) * (bounds.y2 - bounds.y1);
    const x = baseX + Math.sin(time * 0.4 + seed) * 30;
    const y = baseY + Math.cos(time * 0.3 + seed * 1.3) * 25 + Math.sin(time * 0.5 + seed) * 10;
    const r = 1 + Math.sin(time + seed) * 0.5;
    const alpha = 0.1 + Math.sin(time * 0.6 + seed * 2) * 0.08;
    const hue = 140 + Math.sin(time * 0.2 + seed) * 30;
    ctx.fillStyle = `hsla(${hue}, 60%, 75%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw seasonal particles — pollen in spring, leaves in autumn,
 * snowflakes in winter. Adds visual differentiation between seasons.
 */
export function drawSeasonalParticles(renderer, ctx, world) {
  const season = world.currentSeason || 'spring';
  if (season === 'summer') return; // summer is clear
  if (renderer.camera.zoom < 0.25) return;
  const time = performance.now() * 0.001;
  const bounds = renderer._viewBounds;
  const vpW = bounds.x2 - bounds.x1;
  const vpH = bounds.y2 - bounds.y1;
  const count = renderer.isMobile ? 30 : 60;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 23.7;
    const baseX = bounds.x1 + ((seed * 31) % 1) * vpW;
    const baseY = bounds.y1 + ((seed * 47) % 1) * vpH;
    if (season === 'spring') {
      // Pollen drifting upward and sideways
      const fallSpeed = -8 - ((seed * 13) % 1) * 6;
      const drift = Math.sin(time * 0.6 + seed) * 20;
      const x = baseX + drift;
      const y = ((baseY - time * fallSpeed + seed * 100) % vpH) + bounds.y1;
      const r = 0.8 + ((seed * 7) % 1) * 0.6;
      ctx.fillStyle = `rgba(220, 255, 180, ${0.25 + Math.sin(time + seed) * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (season === 'autumn') {
      // Leaves tumbling downward
      const fallSpeed = 18 + ((seed * 19) % 1) * 12;
      const drift = Math.sin(time * 1.2 + seed) * 30;
      const x = baseX + drift;
      const y = ((baseY + time * fallSpeed + seed * 50) % vpH) + bounds.y1;
      const r = 1.5 + ((seed * 11) % 1) * 1;
      const hue = 20 + ((seed * 37) % 1) * 30; // orange to red
      ctx.fillStyle = `hsla(${hue}, 75%, 55%, 0.45)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (season === 'winter') {
      // Snowflakes drifting down with sway
      const fallSpeed = 15 + ((seed * 23) % 1) * 10;
      const drift = Math.sin(time * 0.8 + seed) * 18;
      const x = baseX + drift;
      const y = ((baseY + time * fallSpeed + seed * 30) % vpH) + bounds.y1;
      const r = 1 + ((seed * 7) % 1) * 1.5;
      const alpha = 0.3 + Math.sin(time * 2 + seed) * 0.15;
      ctx.fillStyle = `rgba(240, 248, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
