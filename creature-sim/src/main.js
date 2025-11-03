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

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

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
  viewportWidth: canvas.width,
  viewportHeight: canvas.height
});
const renderer = new Renderer(ctx, camera);
const tools = new ToolController(world, camera);
const analytics = new AnalyticsTracker();
const lineageTracker = new LineageTracker();
world.attachLineageTracker(lineageTracker);
world.creatures.forEach(c => lineageTracker.ensureName(lineageTracker.getRoot(world, c.id)));

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

const statsEl = document.getElementById('stats');
const exportBtn = document.getElementById('btn-export');
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

// Feature toggle UI
const featureToggles = document.querySelectorAll('.feature-toggle');
const btnToggleFeatures = document.getElementById('btn-toggle-features');
const featuresPanel = document.getElementById('features-panel');
const metricRendered = document.getElementById('metric-rendered');
const metricCulled = document.getElementById('metric-culled');
const metricDraws = document.getElementById('metric-draws');

let renderedCount = 0;
let culledCount = 0;

bindUI({
  onPause: togglePause,
  onStep: stepOnce,
  onFood: () => {
    tools.setMode(ToolModes.FOOD);
    tools.apply(0, 0);
    tools.setMode(ToolModes.INSPECT);
  },
  onHerb: () => {
    world.spawnManual(Math.random()*world.width, Math.random()*world.height, false);
  },
  onPred: () => {
    const g = makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 });
    world.addCreature(new Creature(Math.random()*world.width, Math.random()*world.height, g), null);
  }
});

exportBtn?.addEventListener('click', exportSnapshot);
showInspectorBtn?.addEventListener('click', ()=>setInspectorVisible(true));
closeInspectorBtn?.addEventListener('click', ()=>setInspectorVisible(false));

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

// Setup feature toggle buttons
featureToggles.forEach(btn => {
  btn.addEventListener('click', () => {
    const feature = btn.dataset.feature;
    toggleFeature(feature, btn);
  });
});

// Setup panel collapse
btnToggleFeatures?.addEventListener('click', () => {
  featuresPanel?.classList.toggle('collapsed');
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

function syncFeatureButton(feature, isActive) {
  const btn = document.querySelector(`.feature-toggle[data-feature="${feature}"]`);
  if (btn) {
    if (isActive) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

canvas.addEventListener('wheel', (e)=>{
  e.preventDefault();
  camera.zoomBy(e.deltaY * 0.0015);
});

canvas.addEventListener('pointerdown', (e)=>{
  canvas.setPointerCapture(e.pointerId);
  lastPointer = { x: e.clientX, y: e.clientY };
  if (e.button === 1 || e.button === 2 || e.altKey || e.metaKey) {
    panning = true;
    return;
  }
  if (e.button !== 0) return;
  painting = true;
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
  painting = false;
  panning = false;
});

window.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') {
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
      console.log(`%c[VISION CONES] ${renderer.enableVision ? 'ENABLED ✓' : 'DISABLED'}`, 
        `color: ${renderer.enableVision ? '#4ade80' : '#ef4444'}; font-weight: bold;`);
      if (renderer.enableVision) {
        console.log('%cℹ️ Click on a creature to see its vision cone and sense radius', 'color: #60a5fa;');
      }
      return;
    }
    if (e.key.toLowerCase() === 'c') {
      renderer.enableClustering = !renderer.enableClustering;
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
  }
});

window.addEventListener('blur', ()=>{ paused = true; });

function handlePointerAction(e, isDrag) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left - canvas.width/2;
  const sy = e.clientY - rect.top - canvas.height/2;
  const { x, y } = camera.screenToWorld(sx, sy);

  if (tools.mode !== ToolModes.INSPECT) {
    tools.apply(sx, sy, { shiftKey: e.shiftKey });
    updateInspector(true);
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
}

function stepOnce() {
  paused = true;
  accumulator += fixedDt;
}

function setInspectorVisible(visible) {
  inspectorVisible = visible;
  inspectorEl?.classList.toggle('hidden', !visible);
  showInspectorBtn?.classList.toggle('hidden', visible);
  if (visible) updateInspector(true);
}

function loop(now) {
  const dt = Math.min(0.25, (now - lastNow) / 1000);
  lastNow = now;
  timeScale = paused ? 0 : fastForward;
  accumulator += dt * timeScale;

  let steps = 0;
  while (accumulator >= fixedDt && steps < MAX_STEPS) {
    world.step(fixedDt);
    analytics.update(world, fixedDt);
    accumulator -= fixedDt;
    steps++;
  }
  if (steps === MAX_STEPS) {
    accumulator = 0;
  }

  camera.update(dt);

  renderer.clear(canvas.width, canvas.height);
  renderer.drawWorld(world, {
    selectedId,
    pinnedId,
    lineageRootId,
    viewportWidth: canvas.width,
    viewportHeight: canvas.height,
    worldTime: world.t
  });

  fps = 0.9 * fps + 0.1 * (1 / Math.max(dt, 0.0001));
  renderStats(statsEl, world, fps, { 
    fastForward, 
    paused, 
    tool: tools.mode,
    visionEnabled: renderer.enableVision,
    clusteringEnabled: renderer.enableClustering
  });
  
  // Update performance metrics
  if (metricRendered) metricRendered.textContent = renderer.renderedCount || 0;
  if (metricCulled) metricCulled.textContent = renderer.culledCount || 0;
  if (metricDraws) metricDraws.textContent = ((renderer.renderedCount || 0) + world.food.length);
  
  updateInspector(false);
  updateAnalyticsCharts();

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
  const data = analytics.getData();
  if (data.version === analyticsVersion) return;
  analyticsVersion = data.version;
  renderAnalyticsCharts(chartCtx, data);
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

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sandbox-snapshot-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
