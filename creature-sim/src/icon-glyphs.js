/**
 * Shared emoji→field-guide-glyph mapping for runtime-rendered icon slots.
 *
 * Legacy data (goals, moments, achievements, campaign levels, saved moments)
 * carries emoji strings; new entries can carry symbol ids directly (strings
 * starting with `i-`). Rendering stays one vocabulary: inline SVG `<use>`
 * references into the index.html symbol sprite.
 *
 * Unknown icons fall back to a target glyph, so a save restored from an older
 * build can never break the layout.
 */
const EMOJI_TO_SYMBOL = {
  '🌱': 'i-food',
  '🌿': 'i-food',
  '🍃': 'i-food',
  '🍇': 'i-food',
  '🍂': 'i-food',
  '🥀': 'i-erase',
  '🦁': 'i-predator',
  '🐟': 'i-aquatic',
  '🕊️': 'i-flying',
  '🐀': 'i-burrowing',
  '🦷': 'i-predator',
  '🦕': 'i-fossil',
  '🧬': 'i-genes',
  '🍼': 'i-population',
  '⏳': 'i-timer',
  '⏱️': 'i-timer',
  '🧩': 'i-prop',
  '🧱': 'i-prop',
  '🛠️': 'i-editor',
  '🏝️': 'i-seed',
  '🏆': 'i-medal',
  '🏅': 'i-discoveries',
  '⭐': 'i-star',
  '🎯': 'i-goals',
  '👁️': 'i-watch',
  '👑': 'i-crown',
  '🧭': 'i-expedition',
  '⚠️': 'i-help',
  '☠️': 'i-curse',
  '💀': 'i-curse',
  '💥': 'i-chaos',
  '⚡': 'i-bolt',
  '⚖️': 'i-modes',
  '🎓': 'i-tutorial',
  '🐣': 'i-egg',
  '🌙': 'i-moon',
  '💞': 'i-population',
  '😱': 'i-bolt',
  '👥': 'i-population',
  '🦠': 'i-lab',
  '❄️': 'i-snow',
  '🌊': 'i-calm',
  '🧲': 'i-attract',
  '💨': 'i-repel',
  '✨': 'i-godmode',
  '❓': 'i-help'
};

export function resolveSymbol(icon, fallback = 'i-discoveries') {
  if (icon == null || icon === '') return fallback;
  const value = String(icon);
  if (value.startsWith('i-')) return value;
  return EMOJI_TO_SYMBOL[value] || fallback;
}

export function renderIcon(icon, { fallback = 'i-discoveries', className = 'ui-glyph' } = {}) {
  const id = resolveSymbol(icon, fallback);
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
}
