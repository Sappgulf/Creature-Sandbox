/**
 * lineage-album.js — Full-screen lineage family album
 *
 * Renders family cards from `world.descendantsOf()` for each lineage root.
 * Click a card to expand into a hierarchical tree (ancestors at top, descendants
 * below, generation by generation). Supports a "Hero Generations" filter and
 * sort by total / peak / alive / recent activity.
 */

import { escapeHtml, setText } from './safe-html.js';

const PANEL_ID = 'lineage-album-panel';

export class LineageAlbumController {
  /**
   * @param {Object} options
   * @param {Function} options.getWorld - Function returning the current world
   * @param {Function} options.getLineageTracker - Function returning the lineage tracker
   */
  constructor({ getWorld, getLineageTracker } = {}) {
    this.getWorld = getWorld || (() => null);
    this.getLineageTracker = getLineageTracker || (() => null);
    this.panel = null;
    this.grid = null;
    this.treeWrap = null;
    this.treeContainer = null;
    this.treeTitle = null;
    this.sortSelect = null;
    this.heroToggle = null;
    this._expandedRootId = null;
    this._closeBtn = null;
    this._backBtn = null;
  }

  initialize() {
    this.panel = document.getElementById(PANEL_ID);
    if (!this.panel) {
      console.warn('LineageAlbumController: #lineage-album-panel not found in DOM');
      return false;
    }
    this.grid = this.panel.querySelector('#lineage-album-grid');
    this.treeWrap = this.panel.querySelector('#lineage-album-tree-wrap');
    this.treeContainer = this.panel.querySelector('#lineage-album-tree');
    this.treeTitle = this.panel.querySelector('#lineage-album-tree-title');
    this.sortSelect = this.panel.querySelector('#lineage-album-sort');
    this.heroToggle = this.panel.querySelector('#lineage-album-hero');
    this._closeBtn = this.panel.querySelector('#lineage-album-close');
    this._backBtn = this.panel.querySelector('#lineage-album-back');

    if (this._closeBtn) this._closeBtn.addEventListener('click', () => this.hide());
    if (this._backBtn) this._backBtn.addEventListener('click', () => this._showGrid());
    if (this.sortSelect) this.sortSelect.addEventListener('change', () => this._renderGrid());
    if (this.heroToggle) this.heroToggle.addEventListener('change', () => this._renderGrid());
    return true;
  }

  show() {
    if (!this.panel) return;
    this.panel.classList.remove('hidden');
    this.panel.setAttribute('aria-hidden', 'false');
    this._showGrid();
    this._renderGrid();
  }

  hide() {
    if (!this.panel) return;
    this.panel.classList.add('hidden');
    this.panel.setAttribute('aria-hidden', 'true');
  }

  toggle() {
    if (!this.panel) return;
    if (this.panel.classList.contains('hidden')) this.show();
    else this.hide();
  }

  _showGrid() {
    this._expandedRootId = null;
    if (this.treeWrap) this.treeWrap.classList.add('hidden');
    if (this.grid) this.grid.style.display = '';
    this._renderGrid();
  }

  _showTree(rootId) {
    this._expandedRootId = rootId;
    if (this.grid) this.grid.style.display = 'none';
    if (this.treeWrap) this.treeWrap.classList.remove('hidden');
    this._renderTree();
  }

  _families() {
    const world = this.getWorld();
    const tracker = this.getLineageTracker();
    if (!world || !tracker) return [];
    const creatures = Array.isArray(world.creatures) ? world.creatures : [];
    const rootCounts = new Map();
    for (const c of creatures) {
      if (!c || c.id == null) continue;
      try {
        const root = tracker.getRoot(world, c.id);
        if (!rootCounts.has(root)) {
          rootCounts.set(root, { root, total: 0, alive: 0, peakGen: 0, recentActivity: 0 });
        }
        const entry = rootCounts.get(root);
        entry.total += 1;
        if (c.alive !== false) entry.alive += 1;
        try {
          const gen = tracker.generation(world, c.id);
          if (gen > entry.peakGen) entry.peakGen = gen;
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    return Array.from(rootCounts.values()).map(entry => {
      const heroGens = Number(tracker.heroGenerations?.get?.(entry.root) || 0);
      return {
        rootId: entry.root,
        name: tracker.ensureName?.(entry.root) || `#${entry.root}`,
        total: entry.total,
        alive: entry.alive,
        peak: entry.peakGen,
        isHero: heroGens >= 5,
        heroGens,
        recentActivity: world.t - (Number(world.t) - entry.total)
      };
    });
  }

  _renderGrid() {
    if (!this.grid) return;
    const sortBy = this.sortSelect?.value || 'total';
    const heroOnly = !!this.heroToggle?.checked;
    let families = this._families();
    if (heroOnly) families = families.filter(f => f.isHero);
    families.sort((a, b) => {
      if (sortBy === 'peak') return b.peak - a.peak || b.total - a.total;
      if (sortBy === 'alive') return b.alive - a.alive || b.total - a.total;
      if (sortBy === 'recent') return b.recentActivity - a.recentActivity;
      return b.total - a.total;
    });
    if (families.length === 0) {
      this.grid.innerHTML = '<div class="lineage-album-card-empty">No families yet. Births build lineages.</div>';
      return;
    }
    this.grid.innerHTML = families.map(family => this._renderCard(family)).join('');
    this.grid.querySelectorAll('.lineage-album-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.rootId);
        if (Number.isFinite(id)) this._showTree(id);
      });
    });
  }

  _renderCard(family) {
    return `
      <div class="lineage-album-card glass-panel accent-border-cyan" data-root-id="${family.rootId}" role="button" tabindex="0">
        ${family.isHero ? '<span class="lineage-album-card-hero">★ Hero</span>' : ''}
        <div class="lineage-album-card-name">${escapeHtml(family.name)}</div>
        <div class="lineage-album-card-stats">
          <span>Total <strong>${family.total}</strong></span>
          <span>Alive <strong>${family.alive}</strong></span>
          <span>Peak Gen <strong>${family.peak}</strong></span>
          <span>Hero Gen <strong>${family.heroGens || 0}</strong></span>
        </div>
      </div>`;
  }

  _renderTree() {
    if (!this.treeContainer || !this.treeTitle) return;
    const world = this.getWorld();
    if (!world) return;
    const root = world.registry?.get?.(this._expandedRootId) || world.getAnyCreatureById?.(this._expandedRootId);
    if (!root) {
      this.treeContainer.innerHTML = '<div class="muted tiny">Root creature no longer exists.</div>';
      return;
    }
    setText(this.treeTitle, `Lineage tree — ${root.nameSuggestion || root.name || `#${this._expandedRootId}`}`);
    const overview = world.buildLineageOverview?.(this._expandedRootId, 4);
    if (!overview || !Array.isArray(overview.descendants)) {
      this.treeContainer.innerHTML = '<div class="muted tiny">No descendants recorded.</div>';
      return;
    }
    const levels = groupByDepth(overview.descendants);
    const rows = [];
    for (let depth = 0; depth <= overview.maxDepth; depth++) {
      const list = levels.get(depth) || [];
      rows.push(`<div class="lineage-album-tree-depth">Gen ${depth}</div>`);
      if (list.length === 0) {
        rows.push('<div class="muted tiny">No creatures at this generation.</div>');
        continue;
      }
      for (const node of list) {
        const isHero = (node.depth || 0) >= 5;
        const classes = ['lineage-album-tree-node'];
        if (isHero) classes.push('hero');
        else if (node.alive) classes.push('alive');
        else classes.push('dead');
        const label = node.creature?.nameSuggestion || `#${node.creature?.id || '?'}`;
        rows.push(
          `<div class="${classes.join(' ')}">${'— '.repeat(depth)}${escapeHtml(label)} <span class="muted tiny">(#${node.creature?.id || '?'})</span></div>`
        );
      }
    }
    this.treeContainer.innerHTML = rows.join('');
  }
}

function groupByDepth(descendants) {
  const map = new Map();
  for (const node of descendants) {
    const depth = Number(node.depth) || 0;
    if (!map.has(depth)) map.set(depth, []);
    map.get(depth).push(node);
  }
  return map;
}
