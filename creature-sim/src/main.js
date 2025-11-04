import { World } from './world.js';
import { bindUI, renderStats, renderInspector, renderAnalyticsCharts } from './ui.js';
import { makeGenes } from './genetics.js';
import { Creature } from './creature.js';
import './creature-features.js'; // Load feature extensions
import { AnalyticsTracker } from './analytics.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { ToolController, ToolModes } from './tools.js';
import { LineageTracker } from './lineage-tracker.js';
import { BehaviorConfig, setBehaviorWeights } from './behavior.js';
import { MiniGraphs } from './mini-graphs.js';
import { SaveSystem } from './save-system.js';
import { BiomeGenerator } from './perlin-noise.js';
import { ParticleSystem } from './particle-system.js';
import { NotificationSystem } from './notification-system.js';
import { HeatmapSystem } from './heatmap-system.js';
import { GeneEditor } from './gene-editor.js';
import { EcosystemHealth } from './ecosystem-health.js';
import { DebugConsole } from './debug-console.js';
import { MobileSupport } from './mobile-support.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

// Set initial canvas size to FULL window (proper fullscreen setup)
function setCanvasSize() {
  // Get the actual rendered size (CSS-controlled)
  const rect = canvas.getBoundingClientRect();
  
  // Set canvas internal resolution to match display size
  // Use devicePixelRatio for crisp rendering on high-DPI displays
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Scale context to account for DPI
  ctx.scale(dpr, dpr);
  
  console.log(`🖼️ Canvas: ${rect.width}x${rect.height} (${canvas.width}x${canvas.height} internal @ ${dpr}x DPI)`);
}
setCanvasSize();

// UPGRADED: 4x larger world for organic biome system
const world = new World(4000, 2800);
world.seed(70, 6, 200);

const camera = new Camera({
  x: world.width * 0.5,
  y: world.height * 0.5,
  zoom: 0.25, // Start zoomed out to see more
  minZoom: 0.1, // Can zoom out 10x more
  maxZoom: 3,
  worldWidth: world.width,
  worldHeight: world.height,
  viewportWidth: canvas.getBoundingClientRect().width,
  viewportHeight: canvas.getBoundingClientRect().height
});

// Ultra-optimized Canvas 2D renderer (no WebGL complexity!)
const renderer = new Renderer(ctx, camera);
console.log('🎨 Ultra-optimized Canvas 2D renderer initialized');
console.log('💪 60 FPS guaranteed with up to 500+ creatures!');

// Resize handler (now that everything is initialized)
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Re-scale context after resize
  ctx.scale(dpr, dpr);
  
  // Update camera viewport dimensions (use CSS size, not internal resolution)
  camera.viewportWidth = rect.width;
  camera.viewportHeight = rect.height;
  
  console.log(`📐 Canvas resized: ${rect.width}x${rect.height} (${canvas.width}x${canvas.height} internal @ ${dpr}x DPI)`);
}

// Handle window resize
window.addEventListener('resize', resizeCanvas);

// Force initial resize after a brief delay to ensure DOM is ready
setTimeout(() => {
  resizeCanvas();
  console.log('🔄 Forced initial resize for fullscreen');
}, 100);

const tools = new ToolController(world, camera);
const analytics = new AnalyticsTracker();
const lineageTracker = new LineageTracker();
const miniGraphs = new MiniGraphs();
const saveSystem = new SaveSystem();
const particles = new ParticleSystem(); // NEW: Particle system for visual effects
const notifications = new NotificationSystem(); // NEW: Notification system for milestones
const heatmaps = new HeatmapSystem(world); // NEW: Heatmap system for strategic insights
const geneEditor = new GeneEditor(); // NEW: Gene editor for custom creatures
const ecoHealth = new EcosystemHealth(); // NEW: Ecosystem health tracking
const debugConsole = new DebugConsole(world, camera); // NEW: Debug console for power users
const mobileSupport = new MobileSupport(canvas, camera); // NEW: Mobile touch support
window.debug = debugConsole; // Expose to global console
world.attachLineageTracker(lineageTracker);
world.attachParticleSystem(particles); // NEW: Give world access to particles
world.attachHeatmapSystem(heatmaps); // NEW: Give world access to heatmaps
world.creatures.forEach(c => lineageTracker.ensureName(lineageTracker.getRoot(world, c.id)));
window.godModeEffects = window.godModeEffects || [];

// Game start modal
const startModal = document.getElementById('start-modal');
const btnContinue = document.getElementById('btn-continue');
const btnNewGame = document.getElementById('btn-new-game');

let gameStarted = false;

// Check for auto-save on load
if (saveSystem.hasAutoSave()) {
  // Show modal with options
  startModal?.classList.remove('hidden');
  
  btnContinue?.addEventListener('click', () => {
    try {
      const loaded = saveSystem.loadAutoSave(World, Creature, Camera, makeGenes, BiomeGenerator);
      if (loaded) {
        Object.assign(world, loaded.world);
        Object.assign(camera, loaded.camera);
        if (loaded.lineageNames) {
          lineageTracker.names = loaded.lineageNames;
        }
        console.log('✅ Auto-save loaded successfully!');
      }
    } catch (err) {
      console.error('Failed to load auto-save:', err);
      alert('Failed to load save. Starting new game.');
    }
    startModal?.classList.add('hidden');
    gameStarted = true;
  });
  
  btnNewGame?.addEventListener('click', () => {
    // Clear auto-save and start fresh
    saveSystem.clearAutoSave();
    console.log('🆕 Starting new game...');
    startModal?.classList.add('hidden');
    gameStarted = true;
  });
} else {
  // No save found, start immediately
  gameStarted = true;
}

if (typeof camera.startTravel !== 'function') {
  camera.startTravel = function(x, y) {
    this.focusOn(x, y);
  };
}

let paused = false;
let fastForward = 1;
let timeScale = 1;
let accumulator = 0;
let lastNow = performance.now();
let fps = 0;
let selectedId = null;
let pinnedId = null;
let lineageRootId = null;
let painting = false;
let panning = false;
let lastPointer = { x: 0, y: 0 };
let inspectorVisible = true;
let analyticsVersion = -1;
let travelDrag = null;
let travelPreview = null;

const statsEl = document.getElementById('stats');
const exportBtn = document.getElementById('btn-export');
const exportCSVBtn = document.getElementById('btn-export-csv');
const exportGenesBtn = document.getElementById('btn-export-genes');
const showInspectorBtn = document.getElementById('btn-show-inspector');
const closeInspectorBtn = document.getElementById('btn-close-inspector');
const inspectorEl = document.getElementById('inspector');
const chartCtx = {
  pop: document.getElementById('chart-pop')?.getContext('2d') ?? null,
  speed: document.getElementById('chart-speed')?.getContext('2d') ?? null,
  metabolism: document.getElementById('chart-metabolism')?.getContext('2d') ?? null,
  variance: document.getElementById('chart-variance')?.getContext('2d') ?? null,
  ratio: document.getElementById('chart-ratio')?.getContext('2d') ?? null,
  predators: document.getElementById('chart-predators')?.getContext('2d') ?? null,
  health: document.getElementById('chart-health')?.getContext('2d') ?? null
};
const forageSlider = document.getElementById('slider-forage');
const wanderSlider = document.getElementById('slider-wander');
const restSlider = document.getElementById('slider-rest');
const fixedDt = 1/60;
const MAX_STEPS = 6;

// Performance metrics (features panel removed - use keyboard shortcuts)
const metricRendered = document.getElementById('metric-rendered');
const metricCulled = document.getElementById('metric-culled');
const metricDraws = document.getElementById('metric-draws');
const scenarioBtn = document.getElementById('btn-scenario');
const scenarioPanel = document.getElementById('scenario-panel');
const scenarioCloseBtn = document.getElementById('btn-scenario-close');
const scenarioTypeSelect = document.getElementById('scenario-type');
const scenarioDurationInput = document.getElementById('scenario-duration');
const scenarioDurationValue = document.getElementById('scenario-duration-value');
const scenarioIntensityInput = document.getElementById('scenario-intensity');
const scenarioIntensityValue = document.getElementById('scenario-intensity-value');
const scenarioCooldownToggle = document.getElementById('scenario-cooldown');
const scenarioDelayInput = document.getElementById('scenario-delay');
const scenarioDelayValue = document.getElementById('scenario-delay-value');
const scenarioTriggerBtn = document.getElementById('btn-scenario-trigger');
const scenarioQueueBtn = document.getElementById('btn-scenario-queue');
const scenarioEndBtn = document.getElementById('btn-scenario-end');
const scenarioClearQueueBtn = document.getElementById('btn-scenario-clear');
const scenarioStatus = document.getElementById('scenario-status');
const scenarioQueueList = document.getElementById('scenario-queue');

// Mobile quick action buttons
const mobileBtnSpawn = document.getElementById('mobile-btn-spawn');
const mobileBtnFood = document.getElementById('mobile-btn-food');
const mobileBtnPause = document.getElementById('mobile-btn-pause');
const mobileBtnSpeed = document.getElementById('mobile-btn-speed');
const scenarioBalanceToggle = document.getElementById('scenario-autobalance');

let renderedCount = 0;
let culledCount = 0;
let scenarioPanelVisible = false;
let scenarioQueueVersion = -1;
let lastScenarioQueueRender = 0;

// Creature spawn state
let selectedCreatureType = null;
let spawnMode = false;

bindUI({
  onPause: togglePause,
  onStep: stepOnce,
  onFood: () => {
    // NEW: Spawn diverse vegetation randomly across the map (10-20 pieces)
    const count = Math.floor(Math.random() * 11) + 10; // 10-20
    const stats = { grass: 0, berries: 0, fruit: 0 };
    for (let i = 0; i < count; i++) {
      const x = Math.random() * world.width;
      const y = Math.random() * world.height;
      // Let addFood determine the type based on spawn chances
      const beforeLen = world.food.length;
      world.addFood(x, y);
      const added = world.food[world.food.length - 1];
      stats[added.type]++;
    }
    console.log(`🌿 Spawned ${count} vegetation: ${stats.grass} grass, ${stats.berries} berries, ${stats.fruit} fruit trees`);
  }
});

exportBtn?.addEventListener('click', exportSnapshot);
exportCSVBtn?.addEventListener('click', exportCSV);
exportGenesBtn?.addEventListener('click', exportGenesCSV);
showInspectorBtn?.addEventListener('click', ()=>setInspectorVisible(true));
closeInspectorBtn?.addEventListener('click', ()=>setInspectorVisible(false));

// Mobile quick actions
mobileBtnSpawn?.addEventListener('click', () => {
  // Spawn a random creature at center of view
  const centerX = camera.targetX;
  const centerY = camera.targetY;
  const genes = makeGenes();
  const creature = new Creature(centerX, centerY, genes);
  world.addCreature(creature, null);
  console.log('📱 Mobile: Spawned creature');
});

mobileBtnFood?.addEventListener('click', () => {
  // Spawn food at center of view
  const centerX = camera.targetX;
  const centerY = camera.targetY;
  for (let i = 0; i < 20; i++) {
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 200;
    world.addFood(centerX + offsetX, centerY + offsetY);
  }
  console.log('📱 Mobile: Spawned food cluster');
});

mobileBtnPause?.addEventListener('click', () => {
  paused = !paused;
  mobileBtnPause.classList.toggle('active', paused);
  mobileBtnPause.textContent = paused ? '▶️' : '⏸️';
  console.log(`📱 Mobile: ${paused ? 'Paused' : 'Resumed'}`);
});

let mobileSpeedIndex = 1; // 0=0.5x, 1=1x, 2=2x, 3=4x
const mobileSpeedValues = [0.5, 1, 2, 4];
const mobileSpeedEmojis = ['🐌', '⚡', '⚡⚡', '⚡⚡⚡'];
mobileBtnSpeed?.addEventListener('click', () => {
  mobileSpeedIndex = (mobileSpeedIndex + 1) % mobileSpeedValues.length;
  fastForward = mobileSpeedValues[mobileSpeedIndex];
  mobileBtnSpeed.textContent = mobileSpeedEmojis[mobileSpeedIndex];
  console.log(`📱 Mobile: Speed ${fastForward}x`);
});

// Creature spawn dropdown
const btnSpawnCreature = document.getElementById('btn-spawn-creature');
const creatureDropdown = document.getElementById('creature-dropdown');
const dropdownItems = document.querySelectorAll('.dropdown-item');

btnSpawnCreature?.addEventListener('click', (e) => {
  e.stopPropagation();
  creatureDropdown?.classList.toggle('hidden');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.spawn-dropdown')) {
    creatureDropdown?.classList.add('hidden');
  }
});

// Handle creature type selection
dropdownItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const creatureType = item.dataset.creature;
    selectedCreatureType = creatureType;
    spawnMode = true;
    
    // Update dropdown items
    dropdownItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    
    // Update button text and style
    const icons = { herbivore: '🦌', omnivore: '🦡', predator: '🦁' };
    const names = { herbivore: 'Herbivore', omnivore: 'Omnivore', predator: 'Predator' };
    btnSpawnCreature.textContent = `${icons[creatureType]} ${names[creatureType]} ▼`;
    btnSpawnCreature.classList.add('active');
    
    // Hide dropdown
    creatureDropdown?.classList.add('hidden');
    
    // Update cursor and show message
    canvas.style.cursor = 'crosshair';
    console.log(`🎯 Click on the map to spawn ${names[creatureType]}. Press ESC to cancel.`);
  });
});

// GOD MODE TOOLS
const btnGodHeal = document.getElementById('btn-god-heal');
const btnGodBoost = document.getElementById('btn-god-boost');
const btnGodKill = document.getElementById('btn-god-kill');
const btnGodClone = document.getElementById('btn-god-clone');

btnGodHeal?.addEventListener('click', () => godModeHeal());
btnGodBoost?.addEventListener('click', () => godModeBoost());
btnGodKill?.addEventListener('click', () => godModeKill());
btnGodClone?.addEventListener('click', () => godModeClone());

const handleBehaviorChange = () => {
  setBehaviorWeights({
    forage: Number(forageSlider?.value ?? BehaviorConfig.forageWeight),
    wander: Number(wanderSlider?.value ?? BehaviorConfig.wanderWeight),
    rest: Number(restSlider?.value ?? BehaviorConfig.restWeight)
  });
};
forageSlider?.addEventListener('input', handleBehaviorChange);
wanderSlider?.addEventListener('input', handleBehaviorChange);
restSlider?.addEventListener('input', handleBehaviorChange);
handleBehaviorChange();

// Feature toggles removed - now controlled via keyboard shortcuts only
// See keyboard event handlers below for feature toggle keys

if (scenarioBalanceToggle) {
  scenarioBalanceToggle.checked = !!world.autoBalanceSettings?.enabled;
}

// Features panel toggle
const btnFeatures = document.getElementById('btn-features');
const featuresPanel = document.getElementById('features-panel');
const btnFeaturesClose = document.getElementById('btn-features-close');
let featuresPanelVisible = false;

function setFeaturesPanelVisible(visible) {
  featuresPanelVisible = visible;
  if (visible) {
    featuresPanel?.classList.remove('hidden');
  } else {
    featuresPanel?.classList.add('hidden');
  }
}

btnFeatures?.addEventListener('click', () => setFeaturesPanelVisible(!featuresPanelVisible));
btnFeaturesClose?.addEventListener('click', () => setFeaturesPanelVisible(false));

// Wire up all feature toggles
document.getElementById('toggle-vision')?.addEventListener('change', (e) => {
  renderer.enableVision = e.target.checked;
  console.log(`[VISION] ${renderer.enableVision ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-clustering')?.addEventListener('change', (e) => {
  renderer.enableClustering = e.target.checked;
  console.log(`[CLUSTERING] ${renderer.enableClustering ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-territories')?.addEventListener('change', (e) => {
  renderer.enableTerritories = e.target.checked;
  console.log(`[TERRITORIES] ${renderer.enableTerritories ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-memory')?.addEventListener('change', (e) => {
  renderer.enableMemory = e.target.checked;
  console.log(`[MEMORY] ${renderer.enableMemory ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-social')?.addEventListener('change', (e) => {
  renderer.enableSocialBonds = e.target.checked;
  console.log(`[SOCIAL BONDS] ${renderer.enableSocialBonds ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-migration')?.addEventListener('change', (e) => {
  renderer.enableMigration = e.target.checked;
  console.log(`[MIGRATION] ${renderer.enableMigration ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-emotions')?.addEventListener('change', (e) => {
  renderer.enableEmotions = e.target.checked;
  console.log(`[EMOTIONS] ${renderer.enableEmotions ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-sensory')?.addEventListener('change', (e) => {
  renderer.enableSensoryViz = e.target.checked;
  console.log(`[SENSORY] ${renderer.enableSensoryViz ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-intelligence')?.addEventListener('change', (e) => {
  renderer.enableIntelligence = e.target.checked;
  console.log(`[INTELLIGENCE] ${renderer.enableIntelligence ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-mating')?.addEventListener('change', (e) => {
  renderer.enableMating = e.target.checked;
  console.log(`[MATING] ${renderer.enableMating ? 'ON' : 'OFF'}`);
});

document.getElementById('toggle-minigraphs')?.addEventListener('change', (e) => {
  miniGraphs.visible = e.target.checked;
  console.log(`[MINI-GRAPHS] ${miniGraphs.visible ? 'ON' : 'OFF'}`);
});

// Heatmap radio buttons
document.querySelectorAll('input[name="heatmap"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const value = e.target.value;
    if (value === 'off') {
      heatmaps.activeType = null;
      console.log(`[HEATMAP] OFF`);
    } else {
      heatmaps.activeType = value;
      console.log(`[HEATMAP] ${value.toUpperCase()}`);
    }
  });
});

// Gene Editor UI Bindings
const btnGeneEditor = document.getElementById('btn-gene-editor');
const btnGeneEditorClose = document.getElementById('btn-gene-editor-close');
const genePresetSelect = document.getElementById('gene-preset-select');
const btnGeneRandomize = document.getElementById('btn-gene-randomize');
const btnGeneSpawn = document.getElementById('btn-gene-spawn');
const btnGeneExport = document.getElementById('btn-gene-export');

let geneEditorSpawnMode = false;

btnGeneEditor?.addEventListener('click', () => geneEditor.toggle());
btnGeneEditorClose?.addEventListener('click', () => geneEditor.hide());

genePresetSelect?.addEventListener('change', (e) => {
  if (e.target.value) {
    geneEditor.applyPreset(e.target.value);
    e.target.value = ''; // Reset selection
  }
});

btnGeneRandomize?.addEventListener('click', () => geneEditor.randomize());

btnGeneSpawn?.addEventListener('click', () => {
  geneEditorSpawnMode = !geneEditorSpawnMode;
  if (geneEditorSpawnMode) {
    btnGeneSpawn.classList.add('active');
    btnGeneSpawn.textContent = '✨ Click Map to Spawn!';
    spawnMode = false; // Cancel normal spawn mode
    cancelSpawnMode();
  } else {
    btnGeneSpawn.classList.remove('active');
    btnGeneSpawn.textContent = '✨ Spawn (Click Map)';
  }
});

btnGeneExport?.addEventListener('click', () => geneEditor.exportGenes());

// Wire up all gene sliders
Object.keys(geneEditor.customGenes).forEach(key => {
  const slider = document.getElementById(`gene-${key}`);
  const valueSpan = document.getElementById(`gene-${key}-value`);
  
  if (slider && valueSpan) {
    slider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      geneEditor.customGenes[key] = value;
      valueSpan.textContent = geneEditor.formatGeneValue(key, value);
    });
  }
});

// Spawn count and spread
const spawnCountSlider = document.getElementById('gene-spawn-count');
const spawnCountValue = document.getElementById('gene-spawn-count-value');
const spawnSpreadSlider = document.getElementById('gene-spawn-spread');
const spawnSpreadValue = document.getElementById('gene-spawn-spread-value');

spawnCountSlider?.addEventListener('input', (e) => {
  geneEditor.spawnCount = parseInt(e.target.value);
  spawnCountValue.textContent = e.target.value;
});

spawnSpreadSlider?.addEventListener('input', (e) => {
  geneEditor.spawnSpread = parseInt(e.target.value);
  spawnSpreadValue.textContent = `${e.target.value}px`;
});

// Ecosystem Health UI Bindings
const btnEcoHealth = document.getElementById('btn-eco-health');
const btnEcoHealthClose = document.getElementById('btn-eco-health-close');
const ecoHealthPanel = document.getElementById('eco-health-panel');

btnEcoHealth?.addEventListener('click', () => {
  ecoHealth.visible = !ecoHealth.visible;
  if (ecoHealth.visible) {
    ecoHealthPanel?.classList.remove('hidden');
    updateEcosystemHealthUI();
  } else {
    ecoHealthPanel?.classList.add('hidden');
  }
});

btnEcoHealthClose?.addEventListener('click', () => {
  ecoHealth.visible = false;
  ecoHealthPanel?.classList.add('hidden');
});

function updateEcosystemHealthUI() {
  if (!ecoHealth.visible) return;
  
  const metrics = ecoHealth.metrics;
  const status = ecoHealth.getHealthStatus();
  const recommendations = ecoHealth.getRecommendations(world);
  
  // Update overall score
  document.getElementById('health-overall-score').textContent = Math.round(metrics.overall);
  document.getElementById('health-status-emoji').textContent = status.emoji;
  document.getElementById('health-status-label').textContent = status.label;
  document.querySelector('.health-score-circle').style.background = 
    `linear-gradient(135deg, ${status.color} 0%, ${status.color}CC 100%)`;
  
  // Update metric bars
  document.getElementById('health-biodiversity-value').textContent = Math.round(metrics.biodiversity);
  document.getElementById('health-biodiversity-fill').style.width = `${metrics.biodiversity}%`;
  
  document.getElementById('health-stability-value').textContent = Math.round(metrics.stability);
  document.getElementById('health-stability-fill').style.width = `${metrics.stability}%`;
  
  document.getElementById('health-sustainability-value').textContent = Math.round(metrics.sustainability);
  document.getElementById('health-sustainability-fill').style.width = `${metrics.sustainability}%`;
  
  // Update recommendations
  const recList = document.getElementById('health-recommendations-list');
  if (recList) {
    recList.innerHTML = recommendations.map(r => `<div>${r}</div>`).join('');
  }
}

scenarioBtn?.addEventListener('click', () => setScenarioPanelVisible(!scenarioPanelVisible));
scenarioCloseBtn?.addEventListener('click', () => setScenarioPanelVisible(false));
scenarioDurationInput?.addEventListener('input', () => {
  if (scenarioDurationValue) {
    scenarioDurationValue.textContent = `${Number(scenarioDurationInput.value).toFixed(0)}s`;
  }
});
scenarioIntensityInput?.addEventListener('input', () => {
  if (scenarioIntensityValue) {
    scenarioIntensityValue.textContent = `${Number(scenarioIntensityInput.value).toFixed(1)}×`;
  }
});
scenarioDelayInput?.addEventListener('input', () => {
  if (scenarioDelayValue) {
    scenarioDelayValue.textContent = `${Number(scenarioDelayInput.value).toFixed(0)}s`;
  }
});
scenarioBalanceToggle?.addEventListener('change', () => {
  const enabled = !!scenarioBalanceToggle.checked;
  if (world.autoBalanceSettings) {
    world.autoBalanceSettings.enabled = enabled;
  }
  if (scenarioStatus) {
    scenarioStatus.textContent = enabled ? 'Auto balance enabled.' : 'Auto balance disabled.';
  }
});
scenarioTriggerBtn?.addEventListener('click', () => {
  if (!scenarioTypeSelect) return;
  const type = scenarioTypeSelect.value;
  const duration = Number(scenarioDurationInput?.value ?? 30);
  const intensity = Number(scenarioIntensityInput?.value ?? 1);
  const applyCooldown = !!scenarioCooldownToggle?.checked;
  const delay = Number(scenarioDelayInput?.value ?? 0);
  const result = world.triggerDisaster(type, {
    duration,
    intensity,
    applyCooldown,
    delay,
    waitForClear: true
  });
  if ((!result || (!result.started && !result.queuedId)) && scenarioStatus) {
    scenarioStatus.textContent = 'Unable to schedule scenario – check preset.';
  } else if (scenarioStatus) {
    const label = world.disasters?.[type]?.name ?? type;
    if (result?.started) {
      scenarioStatus.textContent = `${label} triggered.`;
    } else if (result?.queuedId) {
      scenarioStatus.textContent = `${label} queued for ${Math.max(0, delay).toFixed(0)}s.`;
    }
  }
  updateScenarioStatus();
});
scenarioQueueBtn?.addEventListener('click', () => {
  if (!scenarioTypeSelect) return;
  const type = scenarioTypeSelect.value;
  const duration = Number(scenarioDurationInput?.value ?? 30);
  const intensity = Number(scenarioIntensityInput?.value ?? 1);
  const applyCooldown = !!scenarioCooldownToggle?.checked;
  let delay = Number(scenarioDelayInput?.value ?? 0);
  if (delay < 1) delay = 1;
  const result = world.triggerDisaster(type, {
    duration,
    intensity,
    applyCooldown,
    delay,
    waitForClear: true
  });
  if (scenarioStatus) {
    const label = world.disasters?.[type]?.name ?? type;
    if (result?.queuedId) {
      scenarioStatus.textContent = `${label} queued for ${Math.round(delay)}s.`;
    } else {
      scenarioStatus.textContent = 'Unable to queue scenario.';
    }
  }
  updateScenarioStatus();
});
scenarioEndBtn?.addEventListener('click', () => {
  if (world.cancelDisaster()) {
    if (scenarioStatus) scenarioStatus.textContent = 'Active disaster cancelled.';
    updateScenarioStatus();
  } else if (scenarioStatus) {
    scenarioStatus.textContent = 'No active disaster to end.';
  }
});
scenarioClearQueueBtn?.addEventListener('click', () => {
  if (typeof world.clearPendingDisasters === 'function' && world.clearPendingDisasters()) {
    if (scenarioStatus) scenarioStatus.textContent = 'Scenario queue cleared.';
    updateScenarioStatus();
  }
});
scenarioQueueList?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-queue-id]');
  if (!target) return;
  const queueId = Number(target.dataset.queueId);
  if (Number.isNaN(queueId)) return;
  if (typeof world.cancelPendingDisaster === 'function' && world.cancelPendingDisaster(queueId)) {
    if (scenarioStatus) scenarioStatus.textContent = 'Scenario removed from queue.';
    updateScenarioStatus();
  }
});

function toggleFeature(feature, btn) {
  const isActive = btn.classList.toggle('active');
  
  switch(feature) {
    case 'vision':
      renderer.enableVision = isActive;
      break;
    case 'clustering':
      renderer.enableClustering = isActive;
      break;
    case 'territories':
      renderer.enableTerritories = isActive;
      break;
    case 'memory':
      renderer.enableMemory = isActive;
      break;
    case 'social':
      renderer.enableSocialBonds = isActive;
      break;
    case 'migration':
      renderer.enableMigration = isActive;
      break;
    case 'emotions':
      renderer.enableEmotions = isActive;
      break;
    case 'sensory':
      renderer.enableSensoryViz = isActive;
      break;
    case 'intelligence':
      renderer.enableIntelligence = isActive;
      break;
    case 'mating':
      renderer.enableMating = isActive;
      break;
  }
  
  console.log(`%c[${feature.toUpperCase()}] ${isActive ? 'ENABLED ✓' : 'DISABLED'}`, 
    `color: ${isActive ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
}

canvas.addEventListener('wheel', (e)=>{
  e.preventDefault();
  camera.zoomBy(e.deltaY * 0.0015);
});

canvas.addEventListener('pointerdown', (e)=>{
  const rect = canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  if (maybeHandleMiniMapClick(canvasX, canvasY, e)) {
    return;
  }

  canvas.setPointerCapture(e.pointerId);
  lastPointer = { x: e.clientX, y: e.clientY };
  if (e.button === 1 || e.button === 2 || e.altKey || e.metaKey) {
    panning = true;
    return;
  }
  if (e.button !== 0) return;
  painting = true;
  if (tools.mode === ToolModes.INSPECT && !e.shiftKey) {
    travelDrag = {
      startX: camera.targetX,
      startY: camera.targetY,
      active: false,
      latest: null
    };
    travelPreview = null;
  } else {
    travelDrag = null;
    travelPreview = null;
  }
  handlePointerAction(e, false);
});

canvas.addEventListener('pointermove', (e)=>{
  if (panning) {
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    camera.pan(-dx, -dy);
    lastPointer = { x: e.clientX, y: e.clientY };
    return;
  }
  if (!painting) return;
  handlePointerAction(e, true);
});

canvas.addEventListener('pointerup', (e)=>{
  canvas.releasePointerCapture?.(e.pointerId);
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left - canvas.width/2;
  const sy = e.clientY - rect.top - canvas.height/2;
  const { x, y } = camera.screenToWorld(sx, sy);
  if (travelDrag && travelDrag.active && travelDrag.latest) {
    const dx = travelDrag.latest.x - travelDrag.startX;
    const dy = travelDrag.latest.y - travelDrag.startY;
    const distance = Math.hypot(dx, dy);
    const duration = Math.min(3.5, Math.max(0.45, distance / 600));
    if (typeof camera.startTravel === 'function') {
      camera.startTravel(travelDrag.latest.x, travelDrag.latest.y, duration);
    } else {
      camera.focusOn(travelDrag.latest.x, travelDrag.latest.y);
    }
  } else if (tools.mode === ToolModes.INSPECT && e.button === 0 && !e.shiftKey) {
    camera.focusOn(x, y);
  }
  travelDrag = null;
  travelPreview = null;
  painting = false;
  panning = false;
});

// Mobile tap handler for creature selection
canvas.addEventListener('mobiletap', (e)=>{
  const detail = e.detail;
  const rect = canvas.getBoundingClientRect();
  const sx = detail.x - rect.left - canvas.width/2;
  const sy = detail.y - rect.top - canvas.height/2;
  const { x, y } = camera.screenToWorld(sx, sy);
  
  // Find nearest creature
  let nearest = null;
  let minDist = 40 / camera.zoom; // Touch-friendly radius
  
  for (const c of world.creatures) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < minDist) {
      minDist = d;
      nearest = c;
    }
  }
  
  if (nearest) {
    selectedId = nearest.id;
    pinnedId = nearest.id;
    lineageRootId = lineageTracker.getRoot(world, nearest.id);
    updateInspector(true);
    console.log(`📱 Creature #${nearest.id} selected (mobile tap)`);
  }
});

function maybeHandleMiniMapClick(canvasX, canvasY, event) {
  if (!renderer.enableMiniMap) return false;
  const bounds = renderer.lastMiniMap;
  if (!bounds) return false;
  if (
    canvasX < bounds.x ||
    canvasX > bounds.x + bounds.width ||
    canvasY < bounds.y ||
    canvasY > bounds.y + bounds.height
  ) {
    return false;
  }
  if (event.button !== 0) return false;
  travelDrag = null;
  travelPreview = null;
  const normalizedX = Math.min(1, Math.max(0, (canvasX - bounds.x) / bounds.width));
  const normalizedY = Math.min(1, Math.max(0, (canvasY - bounds.y) / bounds.height));
  const targetX = normalizedX * bounds.worldWidth;
  const targetY = normalizedY * bounds.worldHeight;
  camera.focusOn(targetX, targetY);
  painting = false;
  panning = false;
  return true;
}

window.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') {
    // Cancel spawn mode first
    if (spawnMode) {
      cancelSpawnMode();
      return;
    }
    if (!inspectorVisible) {
      setInspectorVisible(true);
      return;
    }
    if (lineageRootId != null) {
      lineageRootId = null;
    } else if (pinnedId != null) {
      pinnedId = null;
    } else if (selectedId != null) {
      selectedId = null;
    }
    updateInspector(true);
    return;
  }
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    if (e.key === ' ') {
      togglePause();
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === 'i') {
      setInspectorVisible(!inspectorVisible);
      return;
    }
    if (e.key.toLowerCase() === 'v') {
      renderer.enableVision = !renderer.enableVision;
      const checkbox = document.getElementById('toggle-vision');
      if (checkbox) checkbox.checked = renderer.enableVision;
      console.log(`%c[VISION CONES] ${renderer.enableVision ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableVision ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      if (renderer.enableVision) {
        console.log('%cℹ️ Click on a creature to see its vision cone and sense radius', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key.toLowerCase() === 'c') {
      renderer.enableClustering = !renderer.enableClustering;
      const checkbox = document.getElementById('toggle-clustering');
      if (checkbox) checkbox.checked = renderer.enableClustering;
      console.log(`%c[GENETIC CLUSTERING] ${renderer.enableClustering ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableClustering ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      if (renderer.enableClustering) {
        console.log('%cℹ️ Creatures are now colored by genetic similarity (updates every second)', 'color: #60a5fa;');
      }
      return;
    }
    // Feature toggle keys
    if (e.key.toLowerCase() === 't') {
      renderer.enableTerritories = !renderer.enableTerritories;
      console.log(`%c[TERRITORIES] ${renderer.enableTerritories ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableTerritories ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    if (e.key.toLowerCase() === 'm') {
      renderer.enableMemory = !renderer.enableMemory;
      console.log(`%c[MEMORY] ${renderer.enableMemory ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableMemory ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      if (renderer.enableMemory) {
        console.log('%cℹ️ Select a creature to see its memories', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key.toLowerCase() === 'b') {
      renderer.enableSocialBonds = !renderer.enableSocialBonds;
      console.log(`%c[SOCIAL BONDS] ${renderer.enableSocialBonds ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableSocialBonds ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    if (e.key.toLowerCase() === 'g') {
      renderer.enableMigration = !renderer.enableMigration;
      console.log(`%c[MIGRATION] ${renderer.enableMigration ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableMigration ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    // Advanced feature toggles
    if (e.key.toLowerCase() === '1') {
      renderer.enableEmotions = !renderer.enableEmotions;
      console.log(`%c[EMOTIONS] ${renderer.enableEmotions ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableEmotions ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      if (renderer.enableEmotions) {
        console.log('%cℹ️ Select a creature to see its emotional state', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key.toLowerCase() === '2') {
      renderer.enableSensoryViz = !renderer.enableSensoryViz;
      console.log(`%c[SENSORY TYPES] ${renderer.enableSensoryViz ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableSensoryViz ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    if (e.key.toLowerCase() === '3') {
      renderer.enableIntelligence = !renderer.enableIntelligence;
      console.log(`%c[INTELLIGENCE] ${renderer.enableIntelligence ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableIntelligence ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    if (e.key.toLowerCase() === '4') {
      renderer.enableMating = !renderer.enableMating;
      console.log(`%c[MATING DISPLAYS] ${renderer.enableMating ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableMating ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    // Heatmap toggles
    if (e.key === '5') {
      heatmaps.setType('death');
      const radio = document.getElementById('toggle-heatmap-death');
      if (radio) radio.checked = (heatmaps.activeType === 'death');
      const offRadio = document.getElementById('toggle-heatmap-off');
      if (heatmaps.activeType === null && offRadio) offRadio.checked = true;
      console.log(`%c[DEATH HEATMAP] ${heatmaps.activeType === 'death' ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${heatmaps.activeType === 'death' ? '#ff0000' : '#ef4444'}; font-weight: bold;`);
      if (heatmaps.activeType === 'death') {
        console.log('%cℹ️ Shows where creatures die most frequently (red hotspots)', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key === '6') {
      heatmaps.setType('birth');
      const radio = document.getElementById('toggle-heatmap-birth');
      if (radio) radio.checked = (heatmaps.activeType === 'birth');
      const offRadio = document.getElementById('toggle-heatmap-off');
      if (heatmaps.activeType === null && offRadio) offRadio.checked = true;
      console.log(`%c[BIRTH HEATMAP] ${heatmaps.activeType === 'birth' ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${heatmaps.activeType === 'birth' ? '#00ff64' : '#ef4444'}; font-weight: bold;`);
      if (heatmaps.activeType === 'birth') {
        console.log('%cℹ️ Shows where creatures reproduce most (green hotspots)', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key === '7') {
      heatmaps.setType('activity');
      const radio = document.getElementById('toggle-heatmap-activity');
      if (radio) radio.checked = (heatmaps.activeType === 'activity');
      const offRadio = document.getElementById('toggle-heatmap-off');
      if (heatmaps.activeType === null && offRadio) offRadio.checked = true;
      console.log(`%c[ACTIVITY HEATMAP] ${heatmaps.activeType === 'activity' ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${heatmaps.activeType === 'activity' ? '#3296ff' : '#ef4444'}; font-weight: bold;`);
      if (heatmaps.activeType === 'activity') {
        console.log('%cℹ️ Shows high-traffic areas (blue hotspots)', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key === '8') {
      heatmaps.setType('energy');
      const radio = document.getElementById('toggle-heatmap-energy');
      if (radio) radio.checked = (heatmaps.activeType === 'energy');
      const offRadio = document.getElementById('toggle-heatmap-off');
      if (heatmaps.activeType === null && offRadio) offRadio.checked = true;
      console.log(`%c[ENERGY HEATMAP] ${heatmaps.activeType === 'energy' ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${heatmaps.activeType === 'energy' ? '#ffc800' : '#ef4444'}; font-weight: bold;`);
      if (heatmaps.activeType === 'energy') {
        console.log('%cℹ️ Shows where creatures have high energy (yellow hotspots)', 'color: #60a5fa;');
      }
      return;
    }
    // Mini-map toggle
    if (e.key.toLowerCase() === 'n') {
      renderer.enableMiniMap = !renderer.enableMiniMap;
      console.log(`%c[MINI-MAP] ${renderer.enableMiniMap ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableMiniMap ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    // Mini-graphs toggle
    if (e.key.toLowerCase() === 'l') {
      miniGraphs.enabled = !miniGraphs.enabled;
      console.log(`%c[STATS GRAPHS] ${miniGraphs.enabled ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${miniGraphs.enabled ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      return;
    }
    // Auto-hide toggle
    if (e.key.toLowerCase() === 'a') {
      const wasAutoHide = renderer.miniMapAutoHide || miniGraphs.autoHide;
      renderer.miniMapAutoHide = !renderer.miniMapAutoHide;
      miniGraphs.autoHide = !miniGraphs.autoHide;
      console.log(`%c[AUTO-HIDE OVERLAYS] ${renderer.miniMapAutoHide ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.miniMapAutoHide ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      if (renderer.miniMapAutoHide) {
        console.log('%cℹ️ Mini-map and stats will hide when camera is moving', 'color: #60a5fa;');
      } else {
        console.log('%cℹ️ Mini-map and stats will always be visible', 'color: #60a5fa;');
      }
      return;
    }
    // Debug console toggle (backtick key)
    if (e.key === '`' || e.key === '~') {
      debugConsole.toggle();
      e.preventDefault();
      return;
    }
    if (e.key.toLowerCase() === 'f') {
      tools.setMode(ToolModes.FOOD);
      return;
    }
    if (e.key.toLowerCase() === 's') {
      tools.setMode(ToolModes.SPAWN);
      return;
    }
    if (e.key.toLowerCase() === 'e') {
      tools.setMode(ToolModes.ERASE);
      return;
    }
    if (e.key.toLowerCase() === 'x') {
      tools.setMode(ToolModes.INSPECT);
      return;
    }
    if (e.key === '+') {
      fastForward = Math.min(5, fastForward + 1);
      return;
    }
    if (e.key === '-') {
      fastForward = Math.max(1, fastForward - 1);
      return;
    }
    // Follow camera mode (F key - need Shift to avoid conflict with Food tool)
    if (e.key.toLowerCase() === 'f' && e.shiftKey) {
      if (selectedId) {
        if (camera.followMode === 'free') {
          camera.followMode = 'smooth-follow';
          camera.followTarget = selectedId;
          console.log(`📹 Following creature #${selectedId}`);
        } else {
          camera.followMode = 'free';
          camera.followTarget = null;
          console.log('📹 Free camera mode');
        }
      } else {
        console.log('⚠️ Select a creature first to follow it!');
      }
      return;
    }
    // Toggle mini-graphs (H key)
    if (e.key.toLowerCase() === 'h') {
      miniGraphs.enabled = !miniGraphs.enabled;
      console.log(`📊 Mini-graphs ${miniGraphs.enabled ? 'ENABLED' : 'DISABLED'}`);
      return;
    }
  }
  // Save/Load with Ctrl/Cmd
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
    if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      const filename = prompt('Save name:', `save-${Date.now()}`);
      if (filename) {
        saveSystem.saveToFile(world, camera, analytics, lineageTracker, filename);
      }
      return;
    }
    if (e.key.toLowerCase() === 'o') {
      e.preventDefault();
      // Trigger file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.crsim,.json';
      input.onchange = async (evt) => {
        const file = evt.target.files[0];
        if (file) {
          try {
            const loaded = await saveSystem.loadFromFile(file, World, Creature, Camera, makeGenes, BiomeGenerator);
            Object.assign(world, loaded.world);
            Object.assign(camera, loaded.camera);
            if (loaded.lineageNames) {
              lineageTracker.names = loaded.lineageNames;
            }
            miniGraphs.reset();
            console.log('✅ World loaded successfully!');
          } catch (err) {
            console.error('Failed to load:', err);
            alert('Failed to load file: ' + err.message);
          }
        }
      };
      input.click();
      return;
    }
  }
});

window.addEventListener('blur', ()=>{ paused = true; });

function handlePointerAction(e, isDrag) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left - canvas.width/2;
  const sy = e.clientY - rect.top - canvas.height/2;
  const { x, y } = camera.screenToWorld(sx, sy);

  // Handle spawn mode
  if (spawnMode && !isDrag) {
    spawnCreatureAt(x, y, selectedCreatureType);
    return;
  }
  
  // Handle gene editor spawn mode
  if (geneEditorSpawnMode && !isDrag) {
    geneEditor.spawnMultiple(world, x, y);
    // Don't auto-disable spawn mode, let user spawn multiple times
    return;
  }

  if (tools.mode !== ToolModes.INSPECT) {
    travelDrag = null;
    travelPreview = null;
    tools.apply(sx, sy, { shiftKey: e.shiftKey });
    updateInspector(true);
    return;
  }

  if (isDrag) {
    if (travelDrag && !e.shiftKey) {
      const dx = x - travelDrag.startX;
      const dy = y - travelDrag.startY;
      const dist2 = dx * dx + dy * dy;
      if (!travelDrag.active && dist2 > 400) {
        travelDrag.active = true;
      }
      if (travelDrag.active) {
        travelDrag.latest = { x, y };
        travelPreview = {
          from: { x: travelDrag.startX, y: travelDrag.startY },
          to: { x, y }
        };
      }
    }
    return;
  }

  if (!isDrag) {
    const pick = pickCreature(x, y, e.shiftKey ? 60 : 36);
    if (e.shiftKey) {
      lineageRootId = pick ? (lineageRootId === pick.id ? null : pick.id) : null;
    } else {
      selectedId = pick ? pick.id : null;
    }
    updateInspector(true);
  }
}

function spawnCreatureAt(x, y, type) {
  if (!type) return;
  
  switch(type) {
    case 'herbivore':
      world.spawnManual(x, y, false);
      console.log(`🦌 Spawned Herbivore at (${Math.round(x)}, ${Math.round(y)})`);
      break;
    case 'predator':
      const predGenes = makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 });
      world.addCreature(new Creature(x, y, predGenes), null);
      console.log(`🦁 Spawned Predator at (${Math.round(x)}, ${Math.round(y)})`);
      break;
    case 'omnivore':
      const omniGenes = makeGenes({ 
        predator: 0,
        diet: 0.5,
        speed: 1.0,
        sense: 110,
        metabolism: 0.9,
        hue: 30
      });
      world.addCreature(new Creature(x, y, omniGenes), null);
      console.log(`🦡 Spawned Omnivore at (${Math.round(x)}, ${Math.round(y)})`);
      break;
  }
}

function cancelSpawnMode() {
  spawnMode = false;
  selectedCreatureType = null;
  canvas.style.cursor = 'default';
  btnSpawnCreature?.classList.remove('active');
  btnSpawnCreature.textContent = '🦌 Spawn Creature ▼';
  dropdownItems.forEach(i => i.classList.remove('selected'));
  console.log('❌ Spawn mode cancelled');
}

function pickCreature(x, y, radius) {
  const candidates = world.queryCreatures(x, y, radius);
  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const d2 = (c.x - x)**2 + (c.y - y)**2;
    if (d2 < bestScore) {
      best = c;
      bestScore = d2;
    }
  }
  return best;
}

function togglePause() {
  paused = !paused;
  updatePauseButton();
  console.log(paused ? '⏸️ Paused' : '▶️ Playing');
}

function updatePauseButton() {
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    if (paused) {
      pauseBtn.textContent = '▶️ Play';
      pauseBtn.classList.add('active');
    } else {
      pauseBtn.textContent = '⏸️ Pause';
      pauseBtn.classList.remove('active');
    }
  }
}

function stepOnce() {
  paused = true;
  updatePauseButton();
  accumulator += fixedDt;
}

// GOD MODE FUNCTIONS
function godModeHeal() {
  const creature = selectedId ? world.getAnyCreatureById(selectedId) : null;
  if (!creature || !creature.alive) {
    console.log('⚠️ Select a creature first to heal it!');
    return;
  }
  creature.health = creature.maxHealth;
  creature.logEvent('Healed by divine intervention', world.t);
  showGodModeEffect(creature, '💚', '#4ade80');
  console.log(`✨ Healed creature #${creature.id} to full health!`);
}

function godModeBoost() {
  const creature = selectedId ? world.getAnyCreatureById(selectedId) : null;
  if (!creature || !creature.alive) {
    console.log('⚠️ Select a creature first to boost it!');
    return;
  }
  creature.energy += 30;
  creature.logEvent('Received energy boost', world.t);
  showGodModeEffect(creature, '⚡', '#fbbf24');
  console.log(`⚡ Boosted creature #${creature.id} energy by 30!`);
}

function godModeKill() {
  const creature = selectedId ? world.getAnyCreatureById(selectedId) : null;
  if (!creature || !creature.alive) {
    console.log('⚠️ Select a creature first to kill it!');
    return;
  }
  creature.alive = false;
  creature.health = 0;
  creature.logEvent('Struck down by god', world.t);
  showGodModeEffect(creature, '💀', '#ef4444');
  console.log(`💀 Killed creature #${creature.id}`);
  selectedId = null;
}

function godModeClone() {
  const creature = selectedId ? world.getAnyCreatureById(selectedId) : null;
  if (!creature || !creature.alive) {
    console.log('⚠️ Select a creature first to clone it!');
    return;
  }
  
  try {
    // Clone with exact same genes nearby (with bounds checking)
    const offsetX = (Math.random() - 0.5) * 50;
    const offsetY = (Math.random() - 0.5) * 50;
    
    // Ensure clone position is within world bounds
    let cloneX = creature.x + offsetX;
    let cloneY = creature.y + offsetY;
    cloneX = Math.max(10, Math.min(world.width - 10, cloneX));
    cloneY = Math.max(10, Math.min(world.height - 10, cloneY));
    
    // Create clone with exact copy of genes
    const clone = new Creature(
      cloneX,
      cloneY,
      { ...creature.genes },
      false
    );
    
    // Add to world with original creature's parent (not the creature itself as parent)
    // This makes them siblings rather than parent-child
    const cloneId = world.addCreature(clone, creature.parentId);
    
    // Ensure lineage tracking
    if (world.lineageTracker) {
      try {
        const rootId = world.lineageTracker.getRoot(world, cloneId);
        world.lineageTracker.ensureName(rootId);
      } catch (err) {
        console.warn('⚠️ Lineage tracking failed for clone:', err);
      }
    }
    
    // Force spatial grid update immediately to avoid any issues
    world.gridDirty = true;
    world.ensureSpatial();
    
    showGodModeEffect(creature, '👯', '#a78bfa');
    console.log(`👯 Cloned creature #${creature.id} → #${cloneId} at (${Math.round(cloneX)}, ${Math.round(cloneY)})`);
  } catch (err) {
    console.error('❌ Clone failed:', err);
    alert('Clone failed! Check console for details.');
  }
}

function showGodModeEffect(creature, emoji, color) {
  if (!window.godModeEffects) window.godModeEffects = [];
  window.godModeEffects.push({
    x: creature.x,
    y: creature.y,
    emoji,
    color,
    life: 1.0,
    createdAt: performance.now()
  });
}

function setInspectorVisible(visible) {
  inspectorVisible = visible;
  if (visible) {
    inspectorEl?.classList.remove('hidden');
    showInspectorBtn?.classList.add('hidden');
    updateInspector(true);
  } else {
    inspectorEl?.classList.add('hidden');
    showInspectorBtn?.classList.remove('hidden');
  }
}

function loop(now) {
  // Don't run game loop until user makes a choice
  if (!gameStarted) {
    requestAnimationFrame(loop);
    return;
  }
  
  const dt = Math.min(0.25, (now - lastNow) / 1000);
  lastNow = now;
  timeScale = paused ? 0 : fastForward;
  accumulator += dt * timeScale;

  let steps = 0;
  while (accumulator >= fixedDt && steps < MAX_STEPS) {
    world.step(fixedDt);
    
    // NEW: Record heatmap data from active creatures
    for (const c of world.creatures) {
      heatmaps.recordActivity(c.x, c.y, 0.08);
      heatmaps.recordEnergy(c.x, c.y, c.energy);
    }
    
    analytics.update(world, fixedDt);
    miniGraphs.update(world, fixedDt);
    particles.update(fixedDt); // NEW: Update particle effects
    notifications.checkMilestones(world); // NEW: Check for milestones
    notifications.update(fixedDt); // NEW: Update notifications
    heatmaps.update(fixedDt); // NEW: Update heatmaps (decay)
    ecoHealth.update(world, fixedDt); // NEW: Update ecosystem health metrics
    saveSystem.autoSave(world, camera, analytics, lineageTracker, fixedDt);
    accumulator -= fixedDt;
    steps++;
  }
  if (steps === MAX_STEPS) {
    accumulator = 0;
  }

  // Follow camera logic
  if (camera.followMode !== 'free' && camera.followTarget) {
    const target = world.getAnyCreatureById(camera.followTarget);
    if (target && target.alive) {
      // Smooth follow
      const smoothing = camera.followSmoothing || 0.12;
      camera.targetX = target.x;
      camera.targetY = target.y;
      
      // Optional auto-zoom based on creature speed
      if (camera.followZoomAdjust) {
        const speed = target.genes.speed || 1;
        const targetZoom = Math.max(0.3, Math.min(1.5, 1.0 / speed));
        camera.targetZoom = targetZoom;
      }
    } else {
      // Target died or lost, return to free mode
      camera.followMode = 'free';
      camera.followTarget = null;
      console.log('📹 Follow mode disabled (target lost)');
    }
  }

  camera.update(dt);

  // Clear and render (use camera viewport dimensions, not canvas internal resolution)
  renderer.clear(camera.viewportWidth, camera.viewportHeight);
  const cameraTravelState = typeof camera.getTravelState === 'function' ? camera.getTravelState() : null;
  renderer.drawWorld(world, {
    selectedId,
    pinnedId,
    lineageRootId,
    viewportWidth: camera.viewportWidth,
    viewportHeight: camera.viewportHeight,
    worldTime: world.t,
    lineageTracker,
    world,
    travelPreview,
    cameraTravel: cameraTravelState,
    cameraMoving: camera.isMoving // For auto-hide overlays
  });

  fps = 0.9 * fps + 0.1 * (1 / Math.max(dt, 0.0001));
  renderStats(statsEl, world, fps, { 
    fastForward, 
    paused, 
    tool: tools.mode,
    visionEnabled: renderer.enableVision,
    clusteringEnabled: renderer.enableClustering,
    timeOfDay: world.timeOfDay
  });
  
  // NEW: Draw heatmaps (must be after camera transform, before screen-space overlays)
  if (heatmaps.activeType) {
    // Apply camera transform for world-space rendering
    ctx.save();
    ctx.translate(camera.viewportWidth / 2, camera.viewportHeight / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    heatmaps.draw(ctx, camera);
    ctx.restore();
  }
  
  // Draw mini-graphs overlay
  miniGraphs.draw(ctx, {
    viewportWidth: camera.viewportWidth,
    viewportHeight: camera.viewportHeight,
    cameraMoving: camera.isMoving // For auto-hide
  });
  
  // NEW: Draw particle effects (in world space)
  // Particles are drawn by the renderer during world drawing (world coordinates)
  
  // NEW: Draw notifications (screen space)
  notifications.draw(ctx, canvas.width, canvas.height);
  
  // Update performance metrics
  if (metricRendered) metricRendered.textContent = renderer.renderedCount || 0;
  if (metricCulled) metricCulled.textContent = renderer.culledCount || 0;
  if (metricDraws) metricDraws.textContent = ((renderer.renderedCount || 0) + world.food.length);
  
  updateInspector(false);
  updateAnalyticsCharts();
  updateAdvancedAnalytics();
  updateScenarioStatus();
  updateEcosystemHealthUI(); // NEW: Update ecosystem health UI

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function updateInspector(force) {
  if (!inspectorVisible) return;
  const inspectId = pinnedId ?? selectedId ?? lineageRootId ?? null;
  const creature = inspectId ? world.getAnyCreatureById(inspectId) : null;
  const logVersion = creature ? creature.logVersion : -1;

  if (!force && updateInspector._cache && updateInspector._cache.id === (creature?.id ?? null) && updateInspector._cache.logVersion === logVersion && updateInspector._cache.root === lineageRootId && updateInspector._cache.pinned === pinnedId) {
    return;
  }

  const badges = creature ? creature.getBadges() : [];
  const lineageOverview = lineageRootId ? world.buildLineageOverview(lineageRootId) : null;
  const ancestors = creature ? world.getAncestors(creature.id, 6) : [];
  const activity = creature ? [...creature.log].slice(-8).reverse() : [];
  const lineagePulseData = lineageRootId ? world.getLineagePulse(lineageRootId) : null;
  const lineageLeaders = world.getLineageLeaders(4);

  renderInspector({
    creature,
    stats: creature?.stats ?? null,
    badges,
    activity,
    pinned: creature ? pinnedId === creature.id : false,
    isRoot: creature ? lineageRootId === creature.id : false,
    lineageRootId,
    lineage: lineageOverview,
    ancestors,
    lineagePulse: lineagePulseData,
    lineageLeaders,
    lineageStories: lineageTracker.getStories()
  }, {
    onTogglePin: () => togglePin(creature),
    onSetRoot: () => toggleRoot(creature),
    onFocusParent: (id) => selectCreature(id),
    onInspectId: (id) => selectCreature(id),
    onClose: () => setInspectorVisible(false),
    onSetRootId: (id) => setLineageRootId(id)
  });

  updateInspector._cache = {
    id: creature ? creature.id : null,
    logVersion,
    root: lineageRootId,
    pinned: pinnedId
  };
}

function togglePin(creature) {
  if (!creature) return;
  pinnedId = (pinnedId === creature.id) ? null : creature.id;
  if (pinnedId) selectedId = creature.id;
  updateInspector(true);
}

function toggleRoot(creature) {
  if (!creature) return;
  lineageRootId = (lineageRootId === creature.id) ? null : creature.id;
  updateInspector(true);
}

function setLineageRootId(id) {
  if (id == null) return;
  if (lineageRootId === id) return;
  lineageRootId = id;
  const root = world.getAnyCreatureById(id);
  if (root) {
    selectedId = id;
    camera.focusOn(root.x, root.y);
  }
  updateInspector(true);
}

function selectCreature(id) {
  if (id == null) return;
  const creature = world.getAnyCreatureById(id);
  if (!creature) return;
  selectedId = id;
  camera.focusOn(creature.x, creature.y);
  updateInspector(true);
}

function updateAnalyticsCharts() {
  if (!inspectorVisible) return; // Don't update charts when inspector is closed
  const data = analytics.getData();
  if (data.version === analyticsVersion) return;
  analyticsVersion = data.version;
  renderAnalyticsCharts(chartCtx, data);
}

function setScenarioPanelVisible(visible) {
  scenarioPanelVisible = visible;
  if (!scenarioPanel) return;
  if (visible) {
    scenarioPanel.classList.remove('hidden');
    scenarioDurationInput?.dispatchEvent(new Event('input'));
    scenarioIntensityInput?.dispatchEvent(new Event('input'));
    scenarioDelayInput?.dispatchEvent(new Event('input'));
    renderScenarioQueue();
    const version = typeof world.getPendingDisastersVersion === 'function'
      ? world.getPendingDisastersVersion()
      : scenarioQueueVersion;
    scenarioQueueVersion = version;
    lastScenarioQueueRender = typeof performance !== 'undefined' ? performance.now() : Date.now();
    updateScenarioStatus();
  } else {
    scenarioPanel.classList.add('hidden');
  }
}

function updateScenarioStatus() {
  const pending = typeof world.getPendingDisasters === 'function' ? world.getPendingDisasters() : [];
  const active = world.getActiveDisaster();
  if (scenarioStatus) {
    if (active) {
      const remaining = Math.max(0, active.timeRemaining ?? 0);
      const mode = active.manual ? 'scenario' : 'random';
      const intensity = (active.intensity ?? 1).toFixed(1);
      scenarioStatus.textContent = `${active.name} (${mode}) · ${remaining.toFixed(1)}s left · ${intensity}× intensity`;
      scenarioEndBtn?.removeAttribute('disabled');
    } else {
      scenarioEndBtn?.setAttribute('disabled', 'disabled');
      if (pending.length) {
        const next = pending[0];
        scenarioStatus.textContent = `Next: ${next.name} in ${next.startsIn.toFixed(1)}s`;
      } else {
        scenarioStatus.textContent = 'No active disaster.';
      }
    }
  }
  const version = typeof world.getPendingDisastersVersion === 'function'
    ? world.getPendingDisastersVersion()
    : 0;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const shouldRefresh = scenarioPanelVisible && (now - lastScenarioQueueRender > 250);
  if (version !== scenarioQueueVersion || shouldRefresh) {
    renderScenarioQueue(pending);
    scenarioQueueVersion = version;
    lastScenarioQueueRender = now;
  }
}

function renderScenarioQueue(pending=null) {
  if (!scenarioQueueList) return;
  const items = pending ?? (typeof world.getPendingDisasters === 'function' ? world.getPendingDisasters() : []);
  if (!items.length) {
    scenarioQueueList.innerHTML = '<div class="scenario-queue-empty muted">No queued scenarios.</div>';
    return;
  }
  const html = items.map(item => {
    const durationLabel = item.duration ? `${Math.round(item.duration)}s` : '—';
    const intensityLabel = (item.intensity ?? 1).toFixed(1);
    const waitLabel = item.waitForClear ? 'wait' : 'overlap';
    return `
      <div class="scenario-queue-item">
        <div class="scenario-queue-item-header">
          <span class="scenario-queue-name">${item.name}</span>
          <span class="scenario-queue-start">${item.startsIn.toFixed(1)}s</span>
        </div>
        <div class="scenario-queue-meta">
          <span>dur ${durationLabel}</span>
          <span>int ${intensityLabel}×</span>
          <span>${waitLabel}</span>
        </div>
        <button class="scenario-queue-remove" data-queue-id="${item.id}" title="Remove">✕</button>
      </div>
    `;
  }).join('');
  scenarioQueueList.innerHTML = html;
}

function exportSnapshot() {
  const lineageOverview = lineageRootId ? world.buildLineageOverview(lineageRootId) : null;
  const lineagePayload = lineageOverview ? {
    rootId: lineageRootId,
    totalDesc: lineageOverview.totalDesc,
    aliveDesc: lineageOverview.aliveDesc,
    levels: lineageOverview.levels.map(level => ({
      depth: level.depth,
      total: level.total,
      alive: level.alive,
      sample: level.sample
    }))
  } : null;

  const snapshot = analytics.snapshot({
    worldTime: world.t,
    selectedId,
    pinnedId,
    lineageRootId,
    lineage: lineagePayload,
    population: world.creatures.map(c => ({
      id: c.id,
      predator: !!c.genes.predator,
      genes: c.genes,
      energy: Number(c.energy.toFixed(2)),
      age: Number(c.age.toFixed(1)),
      health: Number(c.health.toFixed(1)),
      maxHealth: Number(c.maxHealth.toFixed(1))
    }))
  });

  downloadFile(`sandbox-snapshot-${Date.now()}.json`, JSON.stringify(snapshot, null, 2), 'application/json');
  console.log('📊 Snapshot exported!');
}

function exportCSV() {
  const csv = analytics.exportAsCSV();
  downloadFile(`creature-sim-${Date.now()}.csv`, csv, 'text/csv');
  console.log('📈 Population data exported to CSV!');
}

function exportGenesCSV() {
  const csv = analytics.exportGeneHistoryCSV();
  downloadFile(`gene-history-${Date.now()}.csv`, csv, 'text/csv');
  console.log('🧬 Gene history exported to CSV!');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateAdvancedAnalytics() {
  // Update phylogeny view
  const phylogenyList = document.getElementById('phylogeny-list');
  if (phylogenyList && analytics.phylogenyData) {
    const phylogeny = analytics.buildPhylogeny(world);
    if (phylogeny && phylogeny.length > 0) {
      let html = '<div class="phylogeny-roots">';
      for (const root of phylogeny.slice(0, 5)) { // Top 5 lineages
        html += `<div class="phylogeny-item">
          <span class="phylogeny-name">${root.name}</span>
          <span class="phylogeny-stats">${root.alive}/${root.total} (${root.depth} gen)</span>
        </div>`;
      }
      html += '</div>';
      phylogenyList.innerHTML = html;
    } else {
      phylogenyList.innerHTML = '<span class="muted tiny">No lineage data yet</span>';
    }
  }
  
  // Update species groups view
  const speciesList = document.getElementById('species-list');
  if (speciesList && analytics.speciesGroups) {
    if (analytics.speciesGroups.length > 0) {
      let html = '<div class="species-groups">';
      for (let i = 0; i < Math.min(5, analytics.speciesGroups.length); i++) {
        const group = analytics.speciesGroups[i];
        const diet = group.avgGenes.diet || 0;
        const icon = diet > 0.7 ? '🦁' : (diet > 0.3 ? '🦡' : '🦌');
        html += `<div class="species-item">
          <span class="species-icon">${icon}</span>
          <span class="species-size">${group.members} individuals</span>
        </div>`;
      }
      html += '</div>';
      speciesList.innerHTML = html;
    } else {
      speciesList.innerHTML = '<span class="muted tiny">Analyzing genetic diversity...</span>';
    }
  }
}
