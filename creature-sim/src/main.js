import { World } from './world.js';
import { bindUI, renderStats, renderInspector, renderAnalyticsCharts } from './ui.js';
import { makeGenes } from './genetics.js';
import { Creature } from './creature.js';
import { AnalyticsTracker } from './analytics.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const world = new World(canvas.width, canvas.height);
world.seed(70, 6, 200);

const analytics = new AnalyticsTracker();

let paused = false;
let stepOnce = false;
let last = performance.now();
let fps = 0;

let selectedId = null;
let pinnedId = null;
let lineageRootId = null;

let paintingFood = false;
let didPaint = false;

const statsEl = document.getElementById('stats');
const inspectorEl = document.getElementById('inspector');
const showInspectorBtn = document.getElementById('btn-show-inspector');
const closeInspectorBtn = document.getElementById('btn-close-inspector');
const chartCtx = {
  pop: document.getElementById('chart-pop')?.getContext('2d') ?? null,
  speed: document.getElementById('chart-speed')?.getContext('2d') ?? null,
  metabolism: document.getElementById('chart-metabolism')?.getContext('2d') ?? null
};

const inspectorState = {
  creatureId: null,
  logVersion: -1,
  pinnedId: null,
  lineageRootId: null,
  lineageSignature: '',
  badgesKey: ''
};
let analyticsVersion = -1;
let inspectorVisible = true;

bindUI({
  onPause: () => { paused = !paused; },
  onStep: () => { paused = true; stepOnce = true; },
  onFood: () => scatterFood(Math.random()*canvas.width, Math.random()*canvas.height, 14),
  onPred: () => {
    const g = makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 });
    world.addCreature(new Creature(Math.random()*canvas.width, Math.random()*canvas.height, g), null);
  }
});

const exportBtn = document.getElementById('btn-export');
if (exportBtn) exportBtn.addEventListener('click', exportSnapshot);

showInspectorBtn?.addEventListener('click', ()=> setInspectorVisible(true));

function loop(now) {
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;

  if (!paused || stepOnce) {
    world.step(dt);
    analytics.update(world, dt);
    stepOnce = false;
  }

  if (selectedId && !world.getAnyCreatureById(selectedId)) selectedId = null;
  if (pinnedId && !world.getAnyCreatureById(pinnedId)) pinnedId = null;
  if (lineageRootId && !world.getAnyCreatureById(lineageRootId)) lineageRootId = null;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  world.draw(ctx, { selectedId, pinnedId, lineageRootId });

  fps = 0.9*fps + 0.1*(1/dt);
  renderStats(statsEl, world, fps);

  updateInspector(false);
  updateAnalytics();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener('pointerdown', (e)=>{
  if (e.button !== 0 || e.shiftKey) return;
  paintingFood = true;
  didPaint = false;
  scatterFromEvent(e, 12);
  const move = ev => {
    if (!paintingFood) return;
    didPaint = true;
    scatterFromEvent(ev, 8);
  };
  const up = () => {
    paintingFood = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once:true });
});

canvas.addEventListener('click', (e)=>{
  if (didPaint) { didPaint = false; return; }
  const { x, y } = canvasToXY(e);
  const target = world.nearestCreature(x, y, 24);
  if (e.shiftKey) {
    if (target) {
      lineageRootId = (lineageRootId === target.id) ? null : target.id;
      if (!selectedId) selectedId = target.id;
    } else {
      lineageRootId = null;
    }
  } else {
    selectedId = target ? target.id : null;
  }
  updateInspector(true);
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
  if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'i' || e.key === 'I')) {
    setInspectorVisible(!inspectorVisible);
    return;
  }
});

function updateInspector(force) {
  const inspectId = pinnedId ?? selectedId ?? lineageRootId ?? null;
  const creature = inspectId ? world.getAnyCreatureById(inspectId) : null;
  const logVersion = creature ? creature.logVersion : -1;
  const badges = creature ? creature.getBadges() : [];
  const lineageOverview = lineageRootId ? world.buildLineageOverview(lineageRootId) : null;
  const lineageSignature = lineageOverview ? `${lineageOverview.totalDesc}|${lineageOverview.aliveDesc}|${lineageOverview.levels.map(l=>`${l.depth}-${l.total}-${l.alive}`).join(',')}` : 'none';
  const badgesKey = badges.join('|');

  const shouldUpdate = force ||
    inspectorState.creatureId !== (creature?.id ?? null) ||
    inspectorState.logVersion !== logVersion ||
    inspectorState.pinnedId !== pinnedId ||
    inspectorState.lineageRootId !== lineageRootId ||
    inspectorState.lineageSignature !== lineageSignature ||
    inspectorState.badgesKey !== badgesKey;

  if (!shouldUpdate) return;

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

  inspectorState.creatureId = creature ? creature.id : null;
  inspectorState.logVersion = logVersion;
  inspectorState.pinnedId = pinnedId;
  inspectorState.lineageRootId = lineageRootId;
  inspectorState.lineageSignature = lineageSignature;
  inspectorState.badgesKey = badgesKey;
}

function updateAnalytics() {
  const data = analytics.getData();
  if (data.version === analyticsVersion) return;
  analyticsVersion = data.version;
  renderAnalyticsCharts(chartCtx, data);
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
  selectedId = id;
  updateInspector(true);
}

function setInspectorVisible(visible) {
  inspectorVisible = visible;
  if (inspectorEl) inspectorEl.classList.toggle('hidden', !visible);
  if (showInspectorBtn) showInspectorBtn.classList.toggle('hidden', visible);
  if (visible) {
    updateInspector(true);
  }
}

function scatterFood(x, y, count=10) {
  for (let i=0;i<count;i++) {
    world.addFood(
      x + (Math.random()-0.5)*26,
      y + (Math.random()-0.5)*26,
      1.2
    );
  }
}

function scatterFromEvent(ev, count) {
  const { x, y } = canvasToXY(ev);
  scatterFood(x, y, count);
}

function canvasToXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
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
