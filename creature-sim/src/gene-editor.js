import { makeGenes } from './genetics.js';
import { Creature } from './creature.js';
import { clamp } from './utils.js';
import { gameState } from './game-state.js';

const GENE_EDITOR_PREF_KEY = 'creature-gene-editor-prefs';
const DEFAULT_SPAWN_COUNT = 1;
const DEFAULT_SPAWN_SPREAD = 50;
const DEFAULT_CUSTOM_GENES = Object.freeze({
  speed: 1.0,
  fov: 90,
  sense: 100,
  metabolism: 1.0,
  hue: 120,
  predator: 0,
  diet: 0.0,
  spines: 0.0,
  herdInstinct: 0.5,
  panicPheromone: 0.3,
  grit: 0.5,
  packInstinct: 0.5,
  ambushDelay: 0.5,
  aggression: 1.0,
  nocturnal: 0.0
});
const GENE_LIMITS = Object.freeze({
  speed: [0.2, 2.0],
  fov: [20, 160],
  sense: [20, 200],
  metabolism: [0.4, 2.0],
  hue: [0, 359],
  predator: [0, 1],
  diet: [0, 1],
  spines: [0, 1],
  herdInstinct: [0, 1],
  panicPheromone: [0, 1],
  grit: [0, 1],
  packInstinct: [0, 1],
  ambushDelay: [0, 1],
  aggression: [0.4, 2.2],
  nocturnal: [0, 1]
});

function cloneDefaultGenes() {
  return { ...DEFAULT_CUSTOM_GENES };
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function normalizedNumber(value, fallback, min, max, { integer = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const bounded = clamp(numeric, min, max);
  return integer ? Math.round(bounded) : bounded;
}

function normalizePreferenceSnapshot(snapshot = {}) {
  const sourceGenes = snapshot.genes && typeof snapshot.genes === 'object'
    ? snapshot.genes
    : snapshot.customGenes && typeof snapshot.customGenes === 'object'
      ? snapshot.customGenes
      : {};
  const genes = cloneDefaultGenes();

  Object.keys(genes).forEach((key) => {
    const [min, max] = GENE_LIMITS[key] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
    genes[key] = normalizedNumber(sourceGenes[key], genes[key], min, max);
  });

  return {
    genes,
    spawnCount: normalizedNumber(snapshot.spawnCount, DEFAULT_SPAWN_COUNT, 1, 20, { integer: true }),
    spawnSpread: normalizedNumber(snapshot.spawnSpread, DEFAULT_SPAWN_SPREAD, 0, 200, { integer: true })
  };
}

export class GeneEditor {
  constructor() {
    this.visible = false;
    this.spawnModeActive = false;
    this._uiBound = false;
    this.customGenes = cloneDefaultGenes();
    this.presets = {
      'Fast Herbivore': { speed: 1.5, fov: 120, sense: 120, metabolism: 1.2, hue: 90, predator: 0, diet: 0.0 },
      'Tank Herbivore': { speed: 0.6, fov: 60, sense: 80, metabolism: 0.6, hue: 150, predator: 0, diet: 0.0, spines: 0.8, grit: 0.9 },
      'Pack Hunter': { speed: 1.3, fov: 110, sense: 140, metabolism: 1.1, hue: 0, predator: 1, diet: 1.0, packInstinct: 0.8, aggression: 1.3 },
      'Ambush Predator': { speed: 0.9, fov: 80, sense: 160, metabolism: 0.8, hue: 30, predator: 1, diet: 1.0, ambushDelay: 0.9, aggression: 1.5 },
      'Omnivore': { speed: 1.0, fov: 100, sense: 110, metabolism: 0.9, hue: 60, predator: 0, diet: 0.5 },
      'Night Hunter': { speed: 1.2, fov: 140, sense: 150, metabolism: 1.0, hue: 270, predator: 1, diet: 1.0, nocturnal: 1.0, aggression: 1.2 },
      'Herd Leader': { speed: 1.1, fov: 100, sense: 130, metabolism: 0.9, hue: 180, predator: 0, diet: 0.0, herdInstinct: 0.9, grit: 0.8 }
    };
    this.spawnCount = DEFAULT_SPAWN_COUNT;
    this.spawnSpread = DEFAULT_SPAWN_SPREAD;

    this.loadPreferences();
    this.bindUI();
  }

  toggle() {
    this.visible = !this.visible;
    this.updateUI();
  }

  show() {
    this.visible = true;
    this.updateUI();
  }

  hide() {
    this.visible = false;
    this.updateUI();
  }

  updateUI() {
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('gene-editor-panel');
    if (!panel) return;

    if (this.visible) {
      panel.classList.remove('hidden');
      this.syncUIToGenes();
    } else {
      panel.classList.add('hidden');
      gameState.setGeneEditorSpawnMode(false);
      this.updateSpawnButton();
    }
  }

  syncUIToGenes() {
    if (typeof document === 'undefined') return;
    // Update all sliders to match current gene values
    Object.keys(this.customGenes).forEach(key => {
      const slider = document.getElementById(`gene-${key}`);
      const valueSpan = document.getElementById(`gene-${key}-value`);
      if (slider) {
        slider.value = this.customGenes[key];
        if (valueSpan) {
          valueSpan.textContent = this.formatGeneValue(key, this.customGenes[key]);
        }
      }
    });

    // Update spawn controls
    const spawnCountInput = document.getElementById('gene-spawn-count');
    const spawnSpreadInput = document.getElementById('gene-spawn-spread');
    if (spawnCountInput) spawnCountInput.value = this.spawnCount;
    if (spawnSpreadInput) spawnSpreadInput.value = this.spawnSpread;
    this.updateSpawnLabels();
    this.updateGeneCodeField();
  }

  formatGeneValue(key, value) {
    switch (key) {
      case 'predator':
      case 'diet':
      case 'spines':
      case 'herdInstinct':
      case 'panicPheromone':
      case 'grit':
      case 'packInstinct':
      case 'ambushDelay':
      case 'nocturnal':
        return `${(value * 100).toFixed(0)}%`;
      case 'speed':
      case 'metabolism':
      case 'aggression':
        return value.toFixed(2);
      case 'fov':
      case 'sense':
      case 'hue':
        return Math.round(value);
      default:
        return value.toFixed(2);
    }
  }

  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) return;

    // Reset to defaults first
    this.customGenes = cloneDefaultGenes();

    // Apply preset values
    Object.assign(this.customGenes, preset);

    this.syncUIToGenes();
    this.savePreferences();
    this.setStatus(`Preset applied: ${presetName}`, 'success');
    console.debug(`✨ Applied preset: ${presetName}`);
  }

  randomize() {
    this.customGenes = {
      speed: clamp(0.5 + Math.random() * 1.5, 0.2, 2.0),
      fov: clamp(60 + Math.random() * 100, 20, 160),
      sense: clamp(70 + Math.random() * 130, 20, 200),
      metabolism: clamp(0.5 + Math.random() * 1.5, 0.4, 2.0),
      hue: Math.floor(Math.random() * 360),
      predator: Math.random() > 0.7 ? 1 : 0,
      diet: Math.random(),
      spines: Math.random(),
      herdInstinct: Math.random(),
      panicPheromone: Math.random(),
      grit: Math.random(),
      packInstinct: Math.random(),
      ambushDelay: Math.random(),
      aggression: clamp(0.5 + Math.random(), 0.4, 2.2),
      nocturnal: Math.random() > 0.8 ? 1 : 0
    };

    this.syncUIToGenes();
    this.savePreferences();
    this.setStatus('Randomized gene set.', 'success');
    console.debug('🎲 Randomized genes!');
  }

  spawnCreature(world, x, y) {
    if (!world) return;

    // Create genes object from custom values
    const genes = makeGenes(this.customGenes);

    // Create and add creature
    const creature = new Creature(x, y, genes, false);
    world.addCreature(creature, null);

    console.debug(`🧬 Spawned custom creature at (${Math.round(x)}, ${Math.round(y)})`);
    return creature;
  }

  spawnMultiple(world, centerX, centerY) {
    if (!world) return;

    const spawned = [];
    for (let i = 0; i < this.spawnCount; i++) {
      // Random position within spread radius
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * this.spawnSpread;
      // REMOVED: No world boundaries - spawn anywhere
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      const creature = this.spawnCreature(world, x, y);
      spawned.push(creature);
    }

    console.debug(`🧬 Spawned ${spawned.length} custom creatures!`);
    return spawned;
  }

  exportGenes() {
    const json = JSON.stringify(this.customGenes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-creature.json';
    a.click();
    URL.revokeObjectURL(url);
    this.setStatus('Exported gene JSON file.', 'success');
    console.debug('📥 Exported custom genes!');
  }

  importGenes(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      Object.keys(this.customGenes).forEach(key => {
        if (imported[key] !== undefined) {
          const [min, max] = GENE_LIMITS[key] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
          this.customGenes[key] = normalizedNumber(imported[key], this.customGenes[key], min, max);
        }
      });
      this.syncUIToGenes();
      this.savePreferences();
      this.setStatus('Imported gene code.', 'success');
      console.debug('📤 Imported custom genes!');
      return true;
    } catch (err) {
      this.setStatus('Invalid gene code. Paste JSON from Export or Copy Code.', 'error');
      console.error('Failed to import genes:', err);
      return false;
    }
  }

  /**
   * Update method called each frame (for interface compatibility)
   * @param {number} dt - Delta time
   */
  update(_dt) {
    // Gene editor is primarily reactive (responds to user input)
    // No per-frame updates needed currently
    const isActive = gameState.geneEditorSpawnMode === true;
    if (isActive !== this.spawnModeActive) {
      this.spawnModeActive = isActive;
      this.updateSpawnButton();
    }
  }

  /**
   * Check if gene editor is active
   */
  get isActive() {
    return this.visible;
  }

  bindUI() {
    if (this._uiBound) return;
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('gene-editor-panel');
    if (!panel) return;

    this._uiBound = true;

    const presetSelect = document.getElementById('gene-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        const nextPreset = e.target.value;
        if (nextPreset) {
          this.applyPreset(nextPreset);
        }
      });
    }

    const randomizeBtn = document.getElementById('btn-gene-randomize');
    if (randomizeBtn) {
      randomizeBtn.addEventListener('click', () => this.randomize());
    }

    const spawnBtn = document.getElementById('btn-gene-spawn');
    if (spawnBtn) {
      spawnBtn.addEventListener('click', () => this.toggleSpawnMode());
    }

    const exportBtn = document.getElementById('btn-gene-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportGenes());
    }

    const copyBtn = document.getElementById('btn-gene-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyGeneCode());
    }

    const importBtn = document.getElementById('btn-gene-import');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const codeInput = document.getElementById('gene-code-input');
        const text = codeInput?.value?.trim() ?? '';
        if (!text) {
          this.setStatus('Paste a gene code JSON first.', 'error');
          return;
        }
        this.importGenes(text);
      });
    }

    Object.keys(this.customGenes).forEach(key => {
      const slider = document.getElementById(`gene-${key}`);
      const valueSpan = document.getElementById(`gene-${key}-value`);
      if (!slider) return;
      slider.addEventListener('input', () => {
        const value = Number(slider.value);
        this.customGenes[key] = value;
        if (valueSpan) {
          valueSpan.textContent = this.formatGeneValue(key, value);
        }
        this.updateGeneCodeField();
        this.savePreferences();
      });
    });

    const spawnCountInput = document.getElementById('gene-spawn-count');
    const spawnSpreadInput = document.getElementById('gene-spawn-spread');
    if (spawnCountInput) {
      spawnCountInput.addEventListener('input', () => {
        this.spawnCount = normalizedNumber(spawnCountInput.value, this.spawnCount, 1, 20, { integer: true });
        this.updateSpawnLabels();
        this.savePreferences();
      });
    }
    if (spawnSpreadInput) {
      spawnSpreadInput.addEventListener('input', () => {
        this.spawnSpread = normalizedNumber(spawnSpreadInput.value, this.spawnSpread, 0, 200, { integer: true });
        this.updateSpawnLabels();
        this.savePreferences();
      });
    }
  }

  getPreferenceSnapshot() {
    return {
      genes: { ...this.customGenes },
      spawnCount: this.spawnCount,
      spawnSpread: this.spawnSpread
    };
  }

  applyPreferenceSnapshot(snapshot, { persist = true, sync = true } = {}) {
    const normalized = normalizePreferenceSnapshot(snapshot);
    this.customGenes = normalized.genes;
    this.spawnCount = normalized.spawnCount;
    this.spawnSpread = normalized.spawnSpread;

    if (sync) this.syncUIToGenes();
    if (persist) this.savePreferences();

    return this.getPreferenceSnapshot();
  }

  readSavedPreferences() {
    const storage = getLocalStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(GENE_EDITOR_PREF_KEY);
      if (!raw) return null;
      return normalizePreferenceSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  loadPreferences({ sync = false } = {}) {
    const saved = this.readSavedPreferences();
    if (!saved) return false;
    this.applyPreferenceSnapshot(saved, { persist: false, sync });
    return true;
  }

  savePreferences() {
    const storage = getLocalStorage();
    if (!storage) return false;

    try {
      storage.setItem(GENE_EDITOR_PREF_KEY, JSON.stringify({
        version: 1,
        ...this.getPreferenceSnapshot()
      }));
      return true;
    } catch {
      return false;
    }
  }

  reloadSavedPreferences() {
    const loaded = this.loadPreferences({ sync: true });
    return loaded ? this.getPreferenceSnapshot() : null;
  }

  updateSpawnLabels() {
    const spawnCountValue = document.getElementById('gene-spawn-count-value');
    const spawnSpreadValue = document.getElementById('gene-spawn-spread-value');
    if (spawnCountValue) spawnCountValue.textContent = `${this.spawnCount}`;
    if (spawnSpreadValue) spawnSpreadValue.textContent = `${this.spawnSpread}px`;
  }

  updateGeneCodeField() {
    const codeInput = document.getElementById('gene-code-input');
    if (codeInput) {
      codeInput.value = JSON.stringify(this.customGenes);
    }
  }

  toggleSpawnMode() {
    const next = !gameState.geneEditorSpawnMode;
    gameState.setGeneEditorSpawnMode(next);
    this.spawnModeActive = next;
    this.updateSpawnButton();
  }

  updateSpawnButton() {
    const spawnBtn = document.getElementById('btn-gene-spawn');
    if (!spawnBtn) return;
    const active = gameState.geneEditorSpawnMode === true;
    spawnBtn.classList.toggle('active', active);
    spawnBtn.textContent = active ? '🗺️ Tap Map to Spawn' : '✨ Spawn (Click Map)';
  }

  setStatus(message, tone = 'info') {
    const status = document.getElementById('gene-editor-status');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('success', 'error');
    if (tone === 'success') status.classList.add('success');
    if (tone === 'error') status.classList.add('error');
  }

  copyGeneCode() {
    const code = JSON.stringify(this.customGenes);
    const onSuccess = () => this.setStatus('Gene code copied to clipboard.', 'success');
    const onError = () => this.setStatus('Copy failed. Use the code box to copy manually.', 'error');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(onSuccess).catch(onError);
      return;
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onSuccess();
    } catch (err) {
      console.error('Failed to copy gene code:', err);
      onError();
    }
  }
}
