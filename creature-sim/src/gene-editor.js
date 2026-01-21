import { makeGenes } from './genetics.js';
import { Creature } from './creature.js';
import { clamp } from './utils.js';
import { gameState } from './game-state.js';

export class GeneEditor {
  constructor() {
    this.visible = false;
    this.spawnModeActive = false;
    this._uiBound = false;
    this.customGenes = {
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
    };
    this.presets = {
      'Fast Herbivore': { speed: 1.5, fov: 120, sense: 120, metabolism: 1.2, hue: 90, predator: 0, diet: 0.0 },
      'Tank Herbivore': { speed: 0.6, fov: 60, sense: 80, metabolism: 0.6, hue: 150, predator: 0, diet: 0.0, spines: 0.8, grit: 0.9 },
      'Pack Hunter': { speed: 1.3, fov: 110, sense: 140, metabolism: 1.1, hue: 0, predator: 1, diet: 1.0, packInstinct: 0.8, aggression: 1.3 },
      'Ambush Predator': { speed: 0.9, fov: 80, sense: 160, metabolism: 0.8, hue: 30, predator: 1, diet: 1.0, ambushDelay: 0.9, aggression: 1.5 },
      'Omnivore': { speed: 1.0, fov: 100, sense: 110, metabolism: 0.9, hue: 60, predator: 0, diet: 0.5 },
      'Night Hunter': { speed: 1.2, fov: 140, sense: 150, metabolism: 1.0, hue: 270, predator: 1, diet: 1.0, nocturnal: 1.0, aggression: 1.2 },
      'Herd Leader': { speed: 1.1, fov: 100, sense: 130, metabolism: 0.9, hue: 180, predator: 0, diet: 0.0, herdInstinct: 0.9, grit: 0.8 }
    };
    this.spawnCount = 1;
    this.spawnSpread = 50;

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
    this.customGenes = {
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
    };

    // Apply preset values
    Object.assign(this.customGenes, preset);

    this.syncUIToGenes();
    this.setStatus(`Preset applied: ${presetName}`, 'success');
    console.log(`✨ Applied preset: ${presetName}`);
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
    this.setStatus('Randomized gene set.', 'success');
    console.log('🎲 Randomized genes!');
  }

  spawnCreature(world, x, y) {
    if (!world) return;

    // Create genes object from custom values
    const genes = makeGenes(this.customGenes);

    // Create and add creature
    const creature = new Creature(x, y, genes, false);
    world.addCreature(creature, null);

    console.log(`🧬 Spawned custom creature at (${Math.round(x)}, ${Math.round(y)})`);
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

    console.log(`🧬 Spawned ${spawned.length} custom creatures!`);
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
    console.log('📥 Exported custom genes!');
  }

  importGenes(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      Object.keys(this.customGenes).forEach(key => {
        if (imported[key] !== undefined) {
          this.customGenes[key] = imported[key];
        }
      });
      this.syncUIToGenes();
      this.setStatus('Imported gene code.', 'success');
      console.log('📤 Imported custom genes!');
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
  update(dt) {
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
      });
    });

    const spawnCountInput = document.getElementById('gene-spawn-count');
    const spawnSpreadInput = document.getElementById('gene-spawn-spread');
    if (spawnCountInput) {
      spawnCountInput.addEventListener('input', () => {
        this.spawnCount = Number(spawnCountInput.value);
        this.updateSpawnLabels();
      });
    }
    if (spawnSpreadInput) {
      spawnSpreadInput.addEventListener('input', () => {
        this.spawnSpread = Number(spawnSpreadInput.value);
        this.updateSpawnLabels();
      });
    }
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
