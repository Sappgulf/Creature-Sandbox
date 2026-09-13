/**
 * device-profile.js — Single source of truth for mobile/touch classification.
 *
 * Several subsystems previously used only `matchMedia('(max-width: 768px)')`,
 * which misclassifies phones and tablets in landscape (width > 768) as
 * desktop: mobile quality presets, panel scrims, overlay defaults, and HUD
 * density all silently switched off after a rotation.
 *
 * Coarse pointer / touch capability is the reliable signal on real hardware
 * and in mobile emulation; viewport width is only a fallback.
 */

export function isCoarsePointer() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
  return 'ontouchstart' in window;
}

export function hasTouch() {
  if (typeof navigator === 'undefined') return false;
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = String(navigator.userAgent || '');
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  // iPadOS 13+ reports a desktop UA but has touch points and a coarse pointer.
  return hasTouch() && isCoarsePointer();
}

export function isCompactMobile() {
  if (typeof window === 'undefined') return false;
  if (!isMobileDevice()) return false;
  const shortEdge = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return shortEdge > 0 && shortEdge <= 430;
}

export function isSmallViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}
