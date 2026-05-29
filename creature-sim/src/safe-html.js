/**
 * safe-html.js — Centralized HTML escaping and safe DOM helpers
 *
 * Use these instead of raw `innerHTML = ...` to prevent XSS when interpolating
 * dynamic strings (creature names, stats, save data, user nicknames, etc.).
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
};

const ESCAPE_RE = /[&<>"'`]/g;

/**
 * Escape a string for safe HTML interpolation.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value == null) return '';
  const str = String(value);
  return str.replace(ESCAPE_RE, ch => ESCAPE_MAP[ch]);
}

/**
 * Tagged template literal that auto-escapes all interpolations.
 * Usage: safeHtml`<div>${userInput}</div>`
 */
export function safeHtml(strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += escapeHtml(values[i]);
    }
  }
  return result;
}

/**
 * Set text content safely (no HTML parsing).
 * @param {HTMLElement} el
 * @param {unknown} text
 */
export function setText(el, text) {
  if (el) el.textContent = text == null ? '' : String(text);
}

/**
 * Build a DocumentFragment from a tagged template with safe escaping.
 * Slightly heavier than safeHtml but avoids innerHTML entirely.
 */
export function htmlFragment(strings, ...values) {
  const tpl = document.createElement('template');
  let html = '';
  for (let i = 0; i < strings.length; i++) {
    html += strings[i];
    if (i < values.length) {
      html += escapeHtml(values[i]);
    }
  }
  tpl.innerHTML = html;
  return tpl.content;
}

/**
 * Batch-set text on elements matched by a parent query.
 * Useful for updating multiple stat cells without innerHTML.
 */
export function batchText(parent, selectors) {
  if (!parent) return;
  for (const [selector, text] of Object.entries(selectors)) {
    const el = parent.querySelector(selector);
    if (el) setText(el, text);
  }
}
