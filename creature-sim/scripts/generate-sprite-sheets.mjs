#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const spritesRoot = path.join(repoRoot, 'creature-sim', 'assets', 'sprites');

const TAU = Math.PI * 2;

const toFixed2 = (value) => Number(value.toFixed(2));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function renderSheet({
  key,
  category,
  frameWidth,
  frameHeight,
  frameCount,
  fps,
  anchor,
  pivot,
  notes,
  drawFrame
}) {
  const width = frameWidth * frameCount;
  const height = frameHeight;

  let frames = '';
  for (let i = 0; i < frameCount; i++) {
    const t = i / frameCount;
    const phase = t * TAU;
    const body = drawFrame({
      i,
      t,
      phase,
      frameWidth,
      frameHeight
    });
    frames += `<g transform="translate(${i * frameWidth} 0)">${body}</g>`;
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">`,
    '<defs>',
    `<filter id="${key}-soft-shadow" x="-40%" y="-40%" width="180%" height="180%">`,
    '<feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />',
    '<feOffset dx="0.5" dy="1" result="offsetblur" />',
    '<feComponentTransfer>',
    '<feFuncA type="linear" slope="0.26" />',
    '</feComponentTransfer>',
    '<feMerge>',
    '<feMergeNode />',
    '<feMergeNode in="SourceGraphic" />',
    '</feMerge>',
    '</filter>',
    '</defs>',
    frames,
    '</svg>'
  ].join('');

  const relativePath = path.join('assets', 'sprites', category, `${key}.svg`);
  const outPath = path.join(spritesRoot, category, `${key}.svg`);
  fs.writeFileSync(outPath, `${svg}\n`, 'utf8');

  return {
    key,
    category,
    path: relativePath.replaceAll(path.sep, '/'),
    frameCount,
    frameWidth,
    frameHeight,
    fps,
    anchor,
    pivot,
    notes
  };
}

function creatureFrame(profile, ctx) {
  const { i, phase, frameWidth: w, frameHeight: h } = ctx;
  const bob = Math.sin(phase + profile.motionPhase) * profile.bob;
  const breathe = 1 + Math.sin(phase * 1.15 + profile.motionPhase * 0.6) * profile.breathe;
  const sway = Math.sin(phase * 1.9 + profile.motionPhase) * profile.tailSway;
  const finSway = Math.sin(phase * 2.3 + profile.motionPhase * 1.5) * profile.finSway;
  const blinkPulse = Math.max(0, Math.sin(phase * profile.blinkSpeed + profile.blinkPhase) * 1.25 - 0.82);
  const blink = clamp(blinkPulse, 0, 1);

  const cx = w * profile.centerX;
  const cy = h * profile.centerY + bob;
  const rx = profile.bodyRx * (1 + (breathe - 1) * 0.55);
  const ry = profile.bodyRy * (1 - (breathe - 1) * 0.4);

  const tailBaseX = cx - rx + 1.5;
  const tailTipX = tailBaseX - profile.tailLength;
  const tailY = cy + profile.tailYOffset;
  const tailWidth = profile.tailWidth + Math.sin(phase * 1.8) * 0.7;
  const tailTopY = tailY - tailWidth;
  const tailBottomY = tailY + tailWidth;

  const dorsalX = cx - rx * 0.2;
  const dorsalY = cy - ry + 2;
  const ventralY = cy + ry - 1.5;
  const eyeX = cx + rx * profile.eyeXBias;
  const eyeY = cy - ry * profile.eyeYBias;
  const eyeW = profile.eyeW;
  const eyeH = Math.max(1.05, profile.eyeH * (1 - blink * 0.88));
  const pupilOffsetX = profile.pupilOffsetX ?? 0.95;
  const pupilX = eyeX + pupilOffsetX + Math.sin(phase * 1.2 + profile.motionPhase) * 0.35;
  const pupilY = eyeY + Math.sin(phase * 1.6) * 0.2;

  const cheekOpacity = profile.cheeks ? toFixed2(0.26 + Math.sin(phase * 1.9) * 0.06) : 0;

  const bodyShape = profile.angular
    ? `<path d="
      M ${toFixed2(cx - rx * 1.02)} ${toFixed2(cy)}
      L ${toFixed2(cx - rx * 0.32)} ${toFixed2(cy - ry * 0.98)}
      L ${toFixed2(cx + rx * 0.9)} ${toFixed2(cy - ry * 0.2)}
      L ${toFixed2(cx + rx * 1.02)} ${toFixed2(cy + ry * 0.08)}
      L ${toFixed2(cx + rx * 0.66)} ${toFixed2(cy + ry * 0.82)}
      L ${toFixed2(cx - rx * 0.46)} ${toFixed2(cy + ry * 0.96)}
      Z
    " fill="currentColor" filter="url(#${profile.key}-soft-shadow)"/>`
    : `<ellipse cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" rx="${toFixed2(rx)}" ry="${toFixed2(ry)}" fill="currentColor" filter="url(#${profile.key}-soft-shadow)"/>`;

  const tail = profile.forkTail
    ? `<path d="
      M ${toFixed2(tailBaseX)} ${toFixed2(tailY)}
      Q ${toFixed2(tailBaseX - profile.tailLength * 0.45)} ${toFixed2(tailTopY - sway * 0.6)}
        ${toFixed2(tailTipX)} ${toFixed2(tailTopY - sway)}
      Q ${toFixed2(tailTipX + profile.tailLength * 0.25)} ${toFixed2(tailY)}
        ${toFixed2(tailTipX)} ${toFixed2(tailBottomY + sway)}
      Q ${toFixed2(tailBaseX - profile.tailLength * 0.45)} ${toFixed2(tailBottomY + sway * 0.6)}
        ${toFixed2(tailBaseX)} ${toFixed2(tailY)}
      Z
    " fill="currentColor" opacity="0.95"/>`
    : `<path d="
      M ${toFixed2(tailBaseX)} ${toFixed2(tailY)}
      Q ${toFixed2(tailBaseX - profile.tailLength * 0.45)} ${toFixed2(tailTopY - sway * 0.45)}
        ${toFixed2(tailTipX)} ${toFixed2(tailY - sway)}
      Q ${toFixed2(tailBaseX - profile.tailLength * 0.42)} ${toFixed2(tailBottomY + sway * 0.45)}
        ${toFixed2(tailBaseX)} ${toFixed2(tailY)}
      Z
    " fill="currentColor" opacity="0.9"/>`;

  const dorsalFin = profile.dorsalFin
    ? `<path d="
      M ${toFixed2(dorsalX)} ${toFixed2(dorsalY)}
      L ${toFixed2(dorsalX - profile.dorsalWidth * 0.5)} ${toFixed2(dorsalY - profile.dorsalHeight + finSway)}
      L ${toFixed2(dorsalX + profile.dorsalWidth)} ${toFixed2(dorsalY - profile.dorsalHeight * 0.2)}
      Z
    " fill="currentColor" opacity="0.78"/>`
    : '';

  const ventralFin = profile.ventralFin
    ? `<path d="
      M ${toFixed2(dorsalX - 1)} ${toFixed2(ventralY)}
      L ${toFixed2(dorsalX + profile.ventralWidth * 0.9)} ${toFixed2(ventralY + profile.ventralHeight + finSway * 0.5)}
      L ${toFixed2(dorsalX + profile.ventralWidth * 0.18)} ${toFixed2(ventralY)}
      Z
    " fill="currentColor" opacity="0.65"/>`
    : '';

  const eye = `
    <ellipse cx="${toFixed2(eyeX)}" cy="${toFixed2(eyeY)}" rx="${toFixed2(eyeW)}" ry="${toFixed2(eyeH)}" fill="white" />
    <ellipse cx="${toFixed2(pupilX)}" cy="${toFixed2(pupilY)}" rx="${toFixed2(profile.pupilW)}" ry="${toFixed2(profile.pupilH * (1 - blink * 0.78))}" fill="${profile.eyeTone}" />
    <circle cx="${toFixed2(pupilX - 0.8)}" cy="${toFixed2(pupilY - 0.9)}" r="0.85" fill="white" opacity="0.9" />
  `;

  const cheek = profile.cheeks
    ? `
      <ellipse cx="${toFixed2(cx + rx * 0.35)}" cy="${toFixed2(cy + ry * 0.38)}" rx="3.2" ry="2.2" fill="#ff9faa" opacity="${cheekOpacity}"/>
      <ellipse cx="${toFixed2(cx - rx * 0.24)}" cy="${toFixed2(cy + ry * 0.4)}" rx="2.8" ry="2" fill="#ff9faa" opacity="${toFixed2(cheekOpacity * 0.9)}"/>
    `
    : '';

  const gills = profile.gills
    ? `
      <path d="M ${toFixed2(cx + rx * 0.05)} ${toFixed2(cy - 1.2)} Q ${toFixed2(cx + rx * 0.22)} ${toFixed2(cy - 0.5)} ${toFixed2(cx + rx * 0.31)} ${toFixed2(cy + 1.1)}" stroke="white" stroke-width="0.9" opacity="0.35" fill="none"/>
      <path d="M ${toFixed2(cx + rx * 0.02)} ${toFixed2(cy + 1.8)} Q ${toFixed2(cx + rx * 0.2)} ${toFixed2(cy + 2.6)} ${toFixed2(cx + rx * 0.29)} ${toFixed2(cy + 4.3)}" stroke="white" stroke-width="0.85" opacity="0.25" fill="none"/>
    `
    : '';

  const wrinkles = profile.wrinkles
    ? `
      <path d="M ${toFixed2(cx + rx * 0.03)} ${toFixed2(cy + 3)} Q ${toFixed2(cx + rx * 0.16)} ${toFixed2(cy + 3.6)} ${toFixed2(cx + rx * 0.28)} ${toFixed2(cy + 2.7)}" stroke="currentColor" stroke-width="0.7" opacity="0.3" fill="none"/>
      <path d="M ${toFixed2(cx - rx * 0.12)} ${toFixed2(cy + 5.5)} Q ${toFixed2(cx + rx * 0.06)} ${toFixed2(cy + 6.2)} ${toFixed2(cx + rx * 0.18)} ${toFixed2(cy + 5.6)}" stroke="currentColor" stroke-width="0.65" opacity="0.26" fill="none"/>
    `
    : '';

  const stripes = profile.stripes
    ? `
      <path d="M ${toFixed2(cx - rx * 0.2)} ${toFixed2(cy - 5)} Q ${toFixed2(cx + rx * 0.05)} ${toFixed2(cy - 7)} ${toFixed2(cx + rx * 0.32)} ${toFixed2(cy - 4)}" stroke="white" stroke-width="1" opacity="0.17" fill="none"/>
      <path d="M ${toFixed2(cx - rx * 0.26)} ${toFixed2(cy)} Q ${toFixed2(cx + rx * 0.05)} ${toFixed2(cy - 1.6)} ${toFixed2(cx + rx * 0.38)} ${toFixed2(cy + 1.1)}" stroke="white" stroke-width="0.95" opacity="0.2" fill="none"/>
    `
    : '';

  const jaw = profile.jaw
    ? `<path d="M ${toFixed2(cx + rx * 0.18)} ${toFixed2(cy + ry * 0.38)} L ${toFixed2(cx + rx * 0.68)} ${toFixed2(cy + ry * 0.24)} L ${toFixed2(cx + rx * 0.54)} ${toFixed2(cy + ry * 0.58)} Z" fill="rgba(255,255,255,0.25)"/>`
    : '';

  const crest = profile.crest
    ? `
      <path d="M ${toFixed2(cx - 1)} ${toFixed2(cy - ry - 1)} L ${toFixed2(cx + 2)} ${toFixed2(cy - ry - 7 + Math.sin(phase * 2.1) * 0.6)} L ${toFixed2(cx + 5)} ${toFixed2(cy - ry - 1)} Z" fill="white" opacity="0.6"/>
      <path d="M ${toFixed2(cx + 5)} ${toFixed2(cy - ry - 1)} L ${toFixed2(cx + 8)} ${toFixed2(cy - ry - 6 + Math.cos(phase * 1.7) * 0.45)} L ${toFixed2(cx + 11)} ${toFixed2(cy - ry - 0.6)} Z" fill="white" opacity="0.45"/>
    `
    : '';

  const alphaAura = profile.aura
    ? `<ellipse cx="${toFixed2(cx + 1)}" cy="${toFixed2(cy)}" rx="${toFixed2(rx + 3 + Math.sin(phase * 2) * 0.7)}" ry="${toFixed2(ry + 2 + Math.cos(phase * 1.4) * 0.6)}" fill="none" stroke="rgba(255,240,180,0.35)" stroke-width="1.25"/>`
    : '';

  const mouthCurve = profile.snarl ? 0.9 : 0.4;
  const mouth = `
    <path d="
      M ${toFixed2(cx + rx * 0.26)} ${toFixed2(cy + ry * 0.26)}
      Q ${toFixed2(cx + rx * 0.43)} ${toFixed2(cy + ry * mouthCurve)}
        ${toFixed2(cx + rx * 0.6)} ${toFixed2(cy + ry * 0.2)}
    " stroke="rgba(0,0,0,0.35)" stroke-width="0.8" fill="none" />
  `;

  const whisker = profile.whisker
    ? `<path d="M ${toFixed2(cx + rx * 0.2)} ${toFixed2(cy + 1)} Q ${toFixed2(cx + rx * 0.62)} ${toFixed2(cy + 2 + Math.sin(phase * 1.9) * 0.6)} ${toFixed2(cx + rx * 0.94)} ${toFixed2(cy + 1.2)}" stroke="rgba(255,255,255,0.28)" stroke-width="0.8" fill="none"/>`
    : '';

  const sparkle = profile.sparkle && i % 4 === 0
    ? `<path d="M ${toFixed2(cx + rx * 0.65)} ${toFixed2(cy - ry * 0.8)} l 0 -2.4 M ${toFixed2(cx + rx * 0.65)} ${toFixed2(cy - ry * 0.8)} l 0 2.4 M ${toFixed2(cx + rx * 0.65)} ${toFixed2(cy - ry * 0.8)} l -2 0 M ${toFixed2(cx + rx * 0.65)} ${toFixed2(cy - ry * 0.8)} l 2 0" stroke="rgba(255,255,255,0.8)" stroke-width="0.9" stroke-linecap="round"/>`
    : '';

  return `
    <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
    ${alphaAura}
    ${tail}
    ${dorsalFin}
    ${ventralFin}
    ${bodyShape}
    ${stripes}
    ${gills}
    ${wrinkles}
    ${jaw}
    ${mouth}
    ${cheek}
    ${eye}
    ${whisker}
    ${crest}
    ${sparkle}
  `;
}

function foodFrame(type, ctx) {
  const { phase, frameWidth: w, frameHeight: h } = ctx;
  const cx = w * 0.5;
  const cy = h * 0.54;
  const sway = Math.sin(phase * 1.8);
  const pulse = 1 + Math.sin(phase * 2.2) * 0.08;

  if (type === 'grass') {
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <path d="M ${toFixed2(cx - 7)} ${toFixed2(cy + 9)}
               Q ${toFixed2(cx - 9 + sway * 1.1)} ${toFixed2(cy + 1)}
                 ${toFixed2(cx - 5)} ${toFixed2(cy - 7)}
               Q ${toFixed2(cx - 2 + sway * 0.5)} ${toFixed2(cy + 2)}
                 ${toFixed2(cx - 1.2)} ${toFixed2(cy + 9)} Z"
            fill="currentColor" opacity="0.92"/>
      <path d="M ${toFixed2(cx - 0.6)} ${toFixed2(cy + 10)}
               Q ${toFixed2(cx - 2.8 + sway * 0.75)} ${toFixed2(cy + 2)}
                 ${toFixed2(cx + 0.6)} ${toFixed2(cy - 11)}
               Q ${toFixed2(cx + 3.5 + sway * 0.35)} ${toFixed2(cy + 2)}
                 ${toFixed2(cx + 3.2)} ${toFixed2(cy + 10)} Z"
            fill="currentColor"/>
      <path d="M ${toFixed2(cx + 4)} ${toFixed2(cy + 9)}
               Q ${toFixed2(cx + 3 + sway * 0.9)} ${toFixed2(cy + 0.8)}
                 ${toFixed2(cx + 8.8)} ${toFixed2(cy - 8)}
               Q ${toFixed2(cx + 10.3 + sway * 0.4)} ${toFixed2(cy + 1.6)}
                 ${toFixed2(cx + 9)} ${toFixed2(cy + 9)} Z"
            fill="currentColor" opacity="0.84"/>
      <path d="M ${toFixed2(cx - 8)} ${toFixed2(cy + 5)}
               Q ${toFixed2(cx - 1)} ${toFixed2(cy + 1 + sway * 0.35)}
                 ${toFixed2(cx + 8)} ${toFixed2(cy + 4)}"
            stroke="rgba(255,255,255,0.24)" stroke-width="1" fill="none"/>
    `;
  }

  if (type === 'berries') {
    const offset = Math.sin(phase * 2) * 0.9;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <path d="M ${toFixed2(cx)} ${toFixed2(cy - 16)} Q ${toFixed2(cx - 5 + sway)} ${toFixed2(cy - 10)} ${toFixed2(cx - 8)} ${toFixed2(cy - 3)}"
            stroke="currentColor" stroke-width="2" fill="none" opacity="0.55"/>
      <ellipse cx="${toFixed2(cx + 4)}" cy="${toFixed2(cy - 13 + sway * 0.7)}" rx="4.4" ry="2.8" fill="currentColor" opacity="0.78"/>
      <circle cx="${toFixed2(cx - 5.6)}" cy="${toFixed2(cy + offset)}" r="${toFixed2(4.2 * pulse)}" fill="currentColor" />
      <circle cx="${toFixed2(cx + 1.5)}" cy="${toFixed2(cy + 3.4 - offset * 0.35)}" r="${toFixed2(4.6 * (1 + Math.sin(phase * 2.4 + 0.6) * 0.05))}" fill="currentColor" opacity="0.95"/>
      <circle cx="${toFixed2(cx + 8.6)}" cy="${toFixed2(cy + 0.2 + offset * 0.55)}" r="${toFixed2(3.9 * (1 + Math.cos(phase * 2 + 0.5) * 0.04))}" fill="currentColor" opacity="0.88"/>
      <circle cx="${toFixed2(cx - 4.8)}" cy="${toFixed2(cy - 0.8)}" r="1.05" fill="white" opacity="0.85"/>
      <circle cx="${toFixed2(cx + 2.2)}" cy="${toFixed2(cy + 2.5)}" r="1.1" fill="white" opacity="0.9"/>
    `;
  }

  if (type === 'fruit') {
    const leafSwing = Math.sin(phase * 1.7) * 2.6;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <path d="M ${toFixed2(cx)} ${toFixed2(cy - 15)} L ${toFixed2(cx)} ${toFixed2(cy - 7)}"
            stroke="#7a4e27" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M ${toFixed2(cx)} ${toFixed2(cy - 13)}
               Q ${toFixed2(cx + 5 + leafSwing)} ${toFixed2(cy - 19)}
                 ${toFixed2(cx + 10)} ${toFixed2(cy - 12)}
               Q ${toFixed2(cx + 4)} ${toFixed2(cy - 10)}
                 ${toFixed2(cx)} ${toFixed2(cy - 13)} Z"
            fill="currentColor" opacity="0.86"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy + 0.2)}" r="${toFixed2(8.5 * pulse)}" fill="currentColor"/>
      <path d="M ${toFixed2(cx - 4.5)} ${toFixed2(cy - 3.5)}
               Q ${toFixed2(cx - 0.5)} ${toFixed2(cy - 6)}
                 ${toFixed2(cx + 4)} ${toFixed2(cy - 4.2)}"
            stroke="rgba(255,255,255,0.28)" stroke-width="1.1" fill="none"/>
      <circle cx="${toFixed2(cx - 2.2)}" cy="${toFixed2(cy - 2.8)}" r="1.2" fill="white" opacity="0.85"/>
    `;
  }

  const shimmer = Math.sin(phase * 3.1) * 0.45;
  const starTilt = phase * 57.2958;
  return `
    <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
    <path d="M ${toFixed2(cx)} ${toFixed2(cy - 15)} L ${toFixed2(cx)} ${toFixed2(cy - 7)}"
          stroke="#8a6b1f" stroke-width="2.1" stroke-linecap="round"/>
    <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy + 0.5)}" r="${toFixed2(9.2 * (1 + shimmer * 0.08))}" fill="currentColor"/>
    <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy + 0.5)}" r="${toFixed2(11.4 + shimmer)}" fill="none" stroke="rgba(255,233,122,0.65)" stroke-width="1.2"/>
    <g transform="translate(${toFixed2(cx + 0.1)} ${toFixed2(cy - 0.5)}) rotate(${toFixed2(starTilt)})">
      <path d="M 0 -5.8 L 1.7 -1.4 L 6 -0.8 L 2.8 1.7 L 3.8 6 L 0 3.6 L -3.8 6 L -2.8 1.7 L -6 -0.8 L -1.7 -1.4 Z"
            fill="rgba(255,255,255,0.85)" opacity="0.92"/>
    </g>
    <circle cx="${toFixed2(cx - 2.4)}" cy="${toFixed2(cy - 3.2)}" r="1.2" fill="white" opacity="0.9"/>
  `;
}

function propFrame(type, ctx) {
  const { phase, frameWidth: w, frameHeight: h } = ctx;
  const cx = w * 0.5;
  const cy = h * 0.5;

  if (type === 'bounce') {
    const squash = 1 - Math.max(0, Math.sin(phase * 2.2)) * 0.14;
    const padRy = 11 * squash;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <ellipse cx="${toFixed2(cx)}" cy="${toFixed2(cy + 22)}" rx="23" ry="5.8" fill="rgba(0,0,0,0.16)"/>
      <ellipse cx="${toFixed2(cx)}" cy="${toFixed2(cy + 8)}" rx="28" ry="${toFixed2(padRy)}" fill="currentColor"/>
      <ellipse cx="${toFixed2(cx)}" cy="${toFixed2(cy + 6.5)}" rx="22.5" ry="${toFixed2(padRy * 0.55)}" fill="rgba(255,255,255,0.26)"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy + 8)}" r="6.8" fill="rgba(255,255,255,0.82)" opacity="0.88"/>
    `;
  }

  if (type === 'spring') {
    const bounce = Math.sin(phase * 2.1) * 4.5;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <rect x="${toFixed2(cx - 23)}" y="${toFixed2(cy + 21)}" width="46" height="8" rx="4" fill="rgba(0,0,0,0.2)"/>
      <path d="M ${toFixed2(cx - 14)} ${toFixed2(cy + 20)}
               Q ${toFixed2(cx - 6)} ${toFixed2(cy + 15 + bounce * 0.18)} ${toFixed2(cx - 1)} ${toFixed2(cy + 9)}
               Q ${toFixed2(cx + 4)} ${toFixed2(cy + 2 - bounce * 0.25)} ${toFixed2(cx + 10)} ${toFixed2(cy - 5)}
               Q ${toFixed2(cx + 15)} ${toFixed2(cy - 11 - bounce * 0.18)} ${toFixed2(cx + 20)} ${toFixed2(cy - 18)}
               "
            stroke="currentColor" stroke-width="5.8" stroke-linecap="round" fill="none"/>
      <rect x="${toFixed2(cx - 18)}" y="${toFixed2(cy - 23 + bounce)}" width="36" height="8.5" rx="4.25" fill="currentColor"/>
      <rect x="${toFixed2(cx - 14)}" y="${toFixed2(cy - 21 + bounce)}" width="28" height="4" rx="2" fill="rgba(255,255,255,0.24)"/>
    `;
  }

  if (type === 'spinner') {
    const angle = toFixed2((phase / TAU) * 360);
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" r="6.5" fill="currentColor"/>
      <g transform="translate(${toFixed2(cx)} ${toFixed2(cy)}) rotate(${angle})">
        <path d="M 0 -27 L 7 -9 L -7 -9 Z" fill="currentColor"/>
        <path d="M 27 0 L 9 7 L 9 -7 Z" fill="currentColor" opacity="0.9"/>
        <path d="M 0 27 L -7 9 L 7 9 Z" fill="currentColor" opacity="0.86"/>
        <path d="M -27 0 L -9 -7 L -9 7 Z" fill="currentColor" opacity="0.92"/>
      </g>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" r="14.5" fill="none" stroke="rgba(255,255,255,0.24)" stroke-width="1.4"/>
    `;
  }

  if (type === 'seesaw') {
    const tilt = Math.sin(phase * 1.4) * 14;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <path d="M ${toFixed2(cx)} ${toFixed2(cy + 15)} L ${toFixed2(cx - 8)} ${toFixed2(cy + 30)} L ${toFixed2(cx + 8)} ${toFixed2(cy + 30)} Z"
            fill="rgba(0,0,0,0.24)"/>
      <g transform="translate(${toFixed2(cx)} ${toFixed2(cy + 14)}) rotate(${toFixed2(tilt)})">
        <rect x="-30" y="-4" width="60" height="8" rx="4" fill="currentColor"/>
        <circle cx="-24" cy="-6.8" r="4.2" fill="rgba(255,255,255,0.3)"/>
        <circle cx="24" cy="-6.8" r="4.2" fill="rgba(255,255,255,0.3)"/>
      </g>
    `;
  }

  if (type === 'conveyor') {
    const flow = (phase / TAU) * 20;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <rect x="${toFixed2(cx - 30)}" y="${toFixed2(cy - 12)}" width="60" height="24" rx="7" fill="currentColor"/>
      <rect x="${toFixed2(cx - 26)}" y="${toFixed2(cy - 8)}" width="52" height="16" rx="5" fill="rgba(255,255,255,0.16)"/>
      <g fill="rgba(255,255,255,0.82)">
        <path d="M ${toFixed2(cx - 18 + flow)} ${toFixed2(cy)} l 7 -4 v 8 z"/>
        <path d="M ${toFixed2(cx - 1 + flow)} ${toFixed2(cy)} l 7 -4 v 8 z"/>
        <path d="M ${toFixed2(cx + 16 + flow)} ${toFixed2(cy)} l 7 -4 v 8 z"/>
      </g>
    `;
  }

  if (type === 'slope') {
    const glide = Math.sin(phase * 1.5) * 1.6;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <path d="M ${toFixed2(cx - 30)} ${toFixed2(cy + 18)} L ${toFixed2(cx + 28)} ${toFixed2(cy - 12)} L ${toFixed2(cx + 28)} ${toFixed2(cy + 18)} Z"
            fill="currentColor"/>
      <path d="M ${toFixed2(cx - 21)} ${toFixed2(cy + 10 - glide)} L ${toFixed2(cx - 4)} ${toFixed2(cy + 1 - glide)} L ${toFixed2(cx - 4)} ${toFixed2(cy + 8 - glide)} Z"
            fill="rgba(255,255,255,0.78)"/>
      <path d="M ${toFixed2(cx - 3)} ${toFixed2(cy + 1 + glide)} L ${toFixed2(cx + 14)} ${toFixed2(cy - 8 + glide)} L ${toFixed2(cx + 14)} ${toFixed2(cy - 1 + glide)} Z"
            fill="rgba(255,255,255,0.78)"/>
    `;
  }

  if (type === 'fan') {
    const angle = toFixed2((phase / TAU) * 540);
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" r="23" fill="currentColor" opacity="0.2"/>
      <g transform="translate(${toFixed2(cx)} ${toFixed2(cy)}) rotate(${angle})">
        <path d="M 0 -4 C 9 -20 21 -23 24 -20 C 17 -8 8 -2 0 0 Z" fill="currentColor"/>
        <path d="M 4 0 C 20 9 23 21 20 24 C 8 17 2 8 0 0 Z" fill="currentColor" opacity="0.9"/>
        <path d="M 0 4 C -9 20 -21 23 -24 20 C -17 8 -8 2 0 0 Z" fill="currentColor" opacity="0.86"/>
        <path d="M -4 0 C -20 -9 -23 -21 -20 -24 C -8 -17 -2 -8 0 0 Z" fill="currentColor" opacity="0.94"/>
      </g>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" r="5.5" fill="rgba(255,255,255,0.8)"/>
    `;
  }

  if (type === 'sticky') {
    const wobble = Math.sin(phase * 2.2) * 3.2;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <path d="M ${toFixed2(cx - 25)} ${toFixed2(cy + 12)}
               Q ${toFixed2(cx - 28)} ${toFixed2(cy - 12 + wobble)} ${toFixed2(cx - 7)} ${toFixed2(cy - 18)}
               Q ${toFixed2(cx + 16)} ${toFixed2(cy - 24 - wobble)} ${toFixed2(cx + 25)} ${toFixed2(cy - 4)}
               Q ${toFixed2(cx + 28)} ${toFixed2(cy + 16)} ${toFixed2(cx + 9)} ${toFixed2(cy + 20)}
               Q ${toFixed2(cx - 12)} ${toFixed2(cy + 24)} ${toFixed2(cx - 25)} ${toFixed2(cy + 12)} Z"
            fill="currentColor" opacity="0.72"/>
      <circle cx="${toFixed2(cx - 8)}" cy="${toFixed2(cy - 2)}" r="5.5" fill="rgba(255,255,255,0.35)"/>
      <circle cx="${toFixed2(cx + 10)}" cy="${toFixed2(cy + 6)}" r="3.4" fill="rgba(255,255,255,0.28)"/>
    `;
  }

  if (type === 'gravity') {
    const swirl = (phase / TAU) * 360;
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" r="24" fill="currentColor" opacity="0.2"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy)}" r="11" fill="rgba(0,0,0,0.45)"/>
      <g transform="translate(${toFixed2(cx)} ${toFixed2(cy)}) rotate(${toFixed2(swirl)})">
        <path d="M 0 -24 Q 6 -17 5 -11 Q 4 -5 -1 -2" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path d="M 0 24 Q -6 17 -5 11 Q -4 5 1 2" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.9"/>
      </g>
      <circle cx="${toFixed2(cx + 5)}" cy="${toFixed2(cy - 4)}" r="2.2" fill="rgba(255,255,255,0.85)"/>
    `;
  }

  if (type === 'button') {
    const press = Math.max(0, Math.sin(phase * 2.1));
    return `
      <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
      <ellipse cx="${toFixed2(cx)}" cy="${toFixed2(cy + 20)}" rx="22" ry="5" fill="rgba(0,0,0,0.18)"/>
      <ellipse cx="${toFixed2(cx)}" cy="${toFixed2(cy + 12 + press * 1.8)}" rx="19" ry="7" fill="currentColor" opacity="0.62"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy + 2 + press * 5)}" r="13" fill="currentColor"/>
      <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy + 0.2 + press * 4.6)}" r="8.4" fill="rgba(255,255,255,0.34)"/>
    `;
  }

  const blast = Math.max(0, Math.sin(phase * 2.4)) * 1.25;
  return `
    <rect x="0" y="0" width="${w}" height="${h}" fill="none"/>
    <path d="M ${toFixed2(cx - 10)} ${toFixed2(cy + 15)} L ${toFixed2(cx + 10)} ${toFixed2(cy + 15)} L ${toFixed2(cx + 8)} ${toFixed2(cy + 25)} L ${toFixed2(cx - 8)} ${toFixed2(cy + 25)} Z"
          fill="rgba(0,0,0,0.24)"/>
    <path d="M ${toFixed2(cx)} ${toFixed2(cy - 22)}
             L ${toFixed2(cx + 10)} ${toFixed2(cy - 5)}
             L ${toFixed2(cx + 6)} ${toFixed2(cy + 14)}
             L ${toFixed2(cx - 6)} ${toFixed2(cy + 14)}
             L ${toFixed2(cx - 10)} ${toFixed2(cy - 5)} Z"
          fill="currentColor"/>
    <circle cx="${toFixed2(cx)}" cy="${toFixed2(cy - 5)}" r="4.2" fill="rgba(255,255,255,0.78)"/>
    <path d="M ${toFixed2(cx)} ${toFixed2(cy + 16)}
             L ${toFixed2(cx + 5 + blast * 2)} ${toFixed2(cy + 25 + blast * 3)}
             L ${toFixed2(cx)} ${toFixed2(cy + 22 + blast * 5)}
             L ${toFixed2(cx - 5 - blast * 2)} ${toFixed2(cy + 25 + blast * 3)} Z"
          fill="rgba(255,191,73,0.9)"/>
  `;
}

const creatureProfiles = [
  {
    key: 'creature_herbivore',
    bodyRx: 17.5,
    bodyRy: 13.8,
    centerX: 0.51,
    centerY: 0.53,
    tailLength: 11.4,
    tailWidth: 4.8,
    tailYOffset: 0.6,
    dorsalFin: true,
    dorsalWidth: 7,
    dorsalHeight: 8,
    ventralFin: true,
    ventralWidth: 6,
    ventralHeight: 5.2,
    eyeXBias: 0.43,
    eyeYBias: 0.31,
    eyeW: 4.9,
    eyeH: 4.3,
    pupilW: 2.2,
    pupilH: 2.1,
    eyeTone: '#111',
    cheeks: true,
    stripes: false,
    gills: false,
    wrinkles: false,
    jaw: false,
    crest: false,
    aura: false,
    sparkle: false,
    whisker: false,
    snarl: false,
    angular: false,
    forkTail: false,
    bob: 1.5,
    breathe: 0.05,
    tailSway: 2.7,
    finSway: 1.8,
    motionPhase: 0.2,
    blinkSpeed: 2.6,
    blinkPhase: 0.4
  },
  {
    key: 'creature_omnivore',
    bodyRx: 18.7,
    bodyRy: 13,
    centerX: 0.5,
    centerY: 0.53,
    tailLength: 10.8,
    tailWidth: 4.2,
    tailYOffset: -0.2,
    dorsalFin: true,
    dorsalWidth: 6.2,
    dorsalHeight: 6.6,
    ventralFin: true,
    ventralWidth: 5.6,
    ventralHeight: 4.6,
    eyeXBias: 0.48,
    eyeYBias: 0.27,
    eyeW: 4.6,
    eyeH: 4.1,
    pupilW: 2.1,
    pupilH: 1.95,
    eyeTone: '#121212',
    cheeks: false,
    stripes: true,
    gills: false,
    wrinkles: false,
    jaw: false,
    crest: false,
    aura: false,
    sparkle: false,
    whisker: true,
    snarl: false,
    angular: false,
    forkTail: false,
    bob: 1.25,
    breathe: 0.05,
    tailSway: 2.4,
    finSway: 1.4,
    motionPhase: 0.72,
    blinkSpeed: 2.7,
    blinkPhase: 1.1
  },
  {
    key: 'creature_predator',
    bodyRx: 19.8,
    bodyRy: 13.5,
    centerX: 0.51,
    centerY: 0.53,
    tailLength: 13.6,
    tailWidth: 4.6,
    tailYOffset: -0.6,
    dorsalFin: true,
    dorsalWidth: 8.2,
    dorsalHeight: 10.8,
    ventralFin: true,
    ventralWidth: 6,
    ventralHeight: 5.8,
    eyeXBias: 0.53,
    eyeYBias: 0.35,
    eyeW: 5.2,
    eyeH: 3.9,
    pupilW: 2.45,
    pupilH: 1.8,
    eyeTone: '#740b18',
    cheeks: false,
    stripes: false,
    gills: false,
    wrinkles: false,
    jaw: true,
    crest: false,
    aura: false,
    sparkle: false,
    whisker: false,
    snarl: true,
    angular: true,
    forkTail: false,
    bob: 1.2,
    breathe: 0.035,
    tailSway: 3.15,
    finSway: 1.95,
    motionPhase: 1.3,
    blinkSpeed: 2.35,
    blinkPhase: 0.6
  },
  {
    key: 'creature_baby',
    bodyRx: 14.8,
    bodyRy: 12.4,
    centerX: 0.53,
    centerY: 0.56,
    tailLength: 8.3,
    tailWidth: 3.3,
    tailYOffset: 0.9,
    dorsalFin: true,
    dorsalWidth: 4.6,
    dorsalHeight: 4.4,
    ventralFin: false,
    ventralWidth: 0,
    ventralHeight: 0,
    eyeXBias: 0.38,
    eyeYBias: 0.28,
    eyeW: 5.5,
    eyeH: 5.4,
    pupilW: 2.2,
    pupilH: 2.3,
    eyeTone: '#111',
    cheeks: true,
    stripes: false,
    gills: false,
    wrinkles: false,
    jaw: false,
    crest: false,
    aura: false,
    sparkle: true,
    whisker: false,
    snarl: false,
    angular: false,
    forkTail: false,
    bob: 1.75,
    breathe: 0.06,
    tailSway: 2,
    finSway: 1.2,
    motionPhase: 2.1,
    blinkSpeed: 3.15,
    blinkPhase: 1.85
  },
  {
    key: 'creature_elder',
    bodyRx: 20.3,
    bodyRy: 15.3,
    centerX: 0.48,
    centerY: 0.54,
    tailLength: 10.2,
    tailWidth: 3.9,
    tailYOffset: 0.6,
    dorsalFin: true,
    dorsalWidth: 5.8,
    dorsalHeight: 4.9,
    ventralFin: false,
    ventralWidth: 0,
    ventralHeight: 0,
    eyeXBias: 0.43,
    eyeYBias: 0.34,
    eyeW: 4.1,
    eyeH: 3.2,
    pupilW: 1.8,
    pupilH: 1.45,
    eyeTone: '#171717',
    cheeks: false,
    stripes: false,
    gills: false,
    wrinkles: true,
    jaw: false,
    crest: false,
    aura: false,
    sparkle: false,
    whisker: false,
    snarl: false,
    angular: false,
    forkTail: false,
    bob: 0.9,
    breathe: 0.03,
    tailSway: 1.4,
    finSway: 0.9,
    motionPhase: 2.8,
    blinkSpeed: 1.9,
    blinkPhase: 0.4
  },
  {
    key: 'creature_alpha',
    bodyRx: 21,
    bodyRy: 15.6,
    centerX: 0.5,
    centerY: 0.53,
    tailLength: 12.2,
    tailWidth: 4.9,
    tailYOffset: -0.1,
    dorsalFin: true,
    dorsalWidth: 7.3,
    dorsalHeight: 8.6,
    ventralFin: true,
    ventralWidth: 6.8,
    ventralHeight: 5.4,
    eyeXBias: 0.49,
    eyeYBias: 0.35,
    eyeW: 5,
    eyeH: 4.2,
    pupilW: 2.25,
    pupilH: 2.15,
    eyeTone: '#101010',
    cheeks: false,
    stripes: true,
    gills: false,
    wrinkles: false,
    jaw: false,
    crest: true,
    aura: true,
    sparkle: true,
    whisker: true,
    snarl: false,
    angular: false,
    forkTail: false,
    bob: 1.4,
    breathe: 0.045,
    tailSway: 2.8,
    finSway: 1.9,
    motionPhase: 0.3,
    blinkSpeed: 2.4,
    blinkPhase: 2.2
  },
  {
    key: 'creature_aquatic',
    bodyRx: 22.6,
    bodyRy: 12.1,
    centerX: 0.49,
    centerY: 0.54,
    tailLength: 14.8,
    tailWidth: 5.4,
    tailYOffset: 0.2,
    dorsalFin: true,
    dorsalWidth: 8.2,
    dorsalHeight: 9.2,
    ventralFin: true,
    ventralWidth: 8.4,
    ventralHeight: 7.2,
    eyeXBias: 0.52,
    eyeYBias: 0.29,
    eyeW: 4.8,
    eyeH: 3.9,
    pupilW: 2.1,
    pupilH: 1.9,
    eyeTone: '#121212',
    cheeks: false,
    stripes: true,
    gills: true,
    wrinkles: false,
    jaw: false,
    crest: false,
    aura: false,
    sparkle: false,
    whisker: false,
    snarl: false,
    angular: false,
    forkTail: true,
    bob: 1.55,
    breathe: 0.04,
    tailSway: 3.5,
    finSway: 2.5,
    motionPhase: 1.7,
    blinkSpeed: 2.2,
    blinkPhase: 0.9
  }
];

const foodTypes = ['grass', 'berries', 'fruit', 'golden_fruit'];
const propTypes = ['bounce', 'spring', 'spinner', 'seesaw', 'conveyor', 'slope', 'fan', 'sticky', 'gravity', 'button', 'launch'];

function generate() {
  ensureDir(path.join(spritesRoot, 'creatures'));
  ensureDir(path.join(spritesRoot, 'food'));
  ensureDir(path.join(spritesRoot, 'props'));

  const manifestEntries = [];

  for (const profile of creatureProfiles) {
    manifestEntries.push(
      renderSheet({
        key: profile.key,
        category: 'creatures',
        frameWidth: 64,
        frameHeight: 64,
        frameCount: 10,
        fps: 12,
        anchor: { x: 0.5, y: 0.58 },
        pivot: { x: 0.48, y: 0.53 },
        notes: 'Tintable creature idle loop. Body and fins use currentColor; eye and highlight layers remain neutral.',
        drawFrame: (ctx) => creatureFrame(profile, ctx)
      })
    );
  }

  for (const type of foodTypes) {
    manifestEntries.push(
      renderSheet({
        key: `food_${type}`,
        category: 'food',
        frameWidth: 48,
        frameHeight: 48,
        frameCount: 8,
        fps: type === 'golden_fruit' ? 10 : 8,
        anchor: { x: 0.5, y: 0.72 },
        pivot: { x: 0.5, y: 0.52 },
        notes: 'Tint-first food idle loop. Core silhouette uses currentColor for ecosystem-driven coloring.',
        drawFrame: (ctx) => foodFrame(type, ctx)
      })
    );
  }

  for (const type of propTypes) {
    manifestEntries.push(
      renderSheet({
        key: `prop_${type}`,
        category: 'props',
        frameWidth: 96,
        frameHeight: 96,
        frameCount: 12,
        fps: type === 'spinner' || type === 'fan' ? 14 : 10,
        anchor: { x: 0.5, y: 0.5 },
        pivot: { x: 0.5, y: 0.5 },
        notes: 'Sandbox prop loop. Primary shape is currentColor-driven so runtime can preserve prop-color semantics.',
        drawFrame: (ctx) => propFrame(type, ctx)
      })
    );
  }

  const manifest = {
    version: 1,
    atlasType: 'svg-strip',
    generator: 'creature-sim/scripts/generate-sprite-sheets.mjs',
    deterministic: true,
    sprites: manifestEntries
  };

  const manifestPath = path.join(spritesRoot, 'sprite-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Generated ${manifestEntries.length} sprite sheets`);
  console.log(`Manifest: ${path.relative(repoRoot, manifestPath)}`);
}

generate();
