import { World } from './world.js';
import { bindUI, renderStats, renderInspector, renderAnalyticsCharts } from './ui.js';
import { makeGenes } from './genetics.js';
import { Creature } from './creature.js';
import { AnalyticsTracker } from './analytics.js';
import { Camera } from './camera.js';
import { Renderer } from './renderer.js';
import { ToolController, ToolModes } from './tools.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const world = new World(canvas.width, canvas.height);
world.seed(70, 6, 200);

const camera = new Camera({ x: canvas.width * 0.5, y: canvas.height * 0.5, zoom: 0.95 });
const renderer = new Renderer(ctx, camera);
const tools = new ToolController(world, camera);
const analytics = new AnalyticsTracker();

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
  metabolism: document.getElementById('chart-metabolism')?.getContext('2d') ?? null
};
const fixedDt = 1/60;
const MAX_STEPS = 6;

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
    viewportHeight: canvas.height
  });

  fps = 0.9 * fps + 0.1 * (1 / Math.max(dt, 0.0001));
  renderStats(statsEl, world, fps, { fastForward, paused, tool: tools.mode });
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

  renderInspector({
    creature,
    stats: creature?.stats ?? null,
    badges,
    activity,
    pinned: creature ? pinnedId === creature.id : false,
    isRoot: creature ? lineageRootId === creature.id : false,
    lineageRootId,
    lineage: lineageOverview,
    ancestors
  }, {
    onTogglePin: () => togglePin(creature),
    onSetRoot: () => toggleRoot(creature),
    onFocusParent: (id) => selectCreature(id),
    onInspectId: (id) => selectCreature(id),
    onClose: () => setInspectorVisible(false)
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
      age: Number(c.age.toFixed(1))
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
