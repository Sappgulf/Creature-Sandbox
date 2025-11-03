import { World } from './world.js';
import { bindUI, renderStats, renderInspector } from './ui.js';
import { makeGenes } from './genetics.js';

const overlayModes = ['none', 'speed', 'fov', 'sense', 'metabolism', 'predator'];

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const world = new World(canvas.width, canvas.height);
world.seed(70, 6, 200);

let paused = false;
let stepOnce = false;
let last = performance.now();
let fps = 0;
let overlayMode = 'none';
let selectedCreature = null;
let highlightedLineage = null;
let paintingFood = false;

const statsEl = document.getElementById('stats');
const inspectorState = {
  bodyEl: document.getElementById('inspector-body'),
  chartCtx: document.getElementById('inspector-chart')?.getContext('2d') ?? null,
  lastCreatureId: null,
  lastEnergyVersion: -1,
  lastRenderAt: 0
};

renderInspector(inspectorState, null);
inspectorState.lastRenderAt = performance.now();

const uiHandles = bindUI({
  onPause: () => {
    paused = !paused;
  },
  onStep: () => {
    paused = true;
    stepOnce = true;
  },
  onFood: () => {
    scatterFood(Math.random()*canvas.width, Math.random()*canvas.height);
  },
  onPred: () => {
    const g = makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 });
    world.spawnPredator(Math.random()*canvas.width, Math.random()*canvas.height, g);
  },
  onOverlayChange: (mode) => {
    if (overlayModes.includes(mode)) {
      overlayMode = mode;
    }
  },
  onClearSelection: () => {
    selectedCreature = null;
    highlightedLineage = null;
    inspectorState.lastCreatureId = null;
    inspectorState.lastEnergyVersion = -1;
    inspectorState.lastRenderAt = performance.now();
    renderInspector(inspectorState, null);
  }
});

function setOverlayMode(mode) {
  if (!overlayModes.includes(mode)) return;
  overlayMode = mode;
  uiHandles?.setOverlayMode?.(mode);
}

function loop(now) {
  const dt = Math.min(0.05, (now - last)/1000); // clamp large jumps
  last = now;

  if (!paused || stepOnce) {
    world.step(dt);
    stepOnce = false;
  }

  // refresh selection reference post-sim step
  if (selectedCreature) {
    const updated = world.getCreatureById(selectedCreature.id);
    if (!updated) {
      selectedCreature = null;
      highlightedLineage = null;
      inspectorState.lastCreatureId = null;
      inspectorState.lastEnergyVersion = -1;
      inspectorState.lastRenderAt = performance.now();
      renderInspector(inspectorState, null);
    } else {
      selectedCreature = updated;
      maybeUpdateInspector(selectedCreature);
    }
  }

  // Draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  world.draw(ctx, {
    overlay: overlayMode,
    selectedId: selectedCreature ? selectedCreature.id : null,
    highlightLineageId: highlightedLineage
  });

  // Stats / HUD
  fps = 0.9*fps + 0.1*(1/dt);
  renderStats(statsEl, world, fps, overlayMode);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function maybeUpdateInspector(creature) {
  const id = creature ? creature.id : null;
  const version = creature ? creature.energyVersion : -1;
  const now = performance.now();
  const versionChanged = version !== inspectorState.lastEnergyVersion;
  const timeSince = now - inspectorState.lastRenderAt;
  const needsUpdate = id !== inspectorState.lastCreatureId || (versionChanged && timeSince > 120);
  if (needsUpdate) {
    renderInspector(inspectorState, creature);
    inspectorState.lastCreatureId = id;
    inspectorState.lastEnergyVersion = version;
    inspectorState.lastRenderAt = now;
  }
}

function scatterFood(x, y) {
  for (let i=0;i<12;i++) {
    world.addFood(
      x + (Math.random()-0.5)*30,
      y + (Math.random()-0.5)*30,
      1.2
    );
  }
}

canvas.addEventListener('pointerdown', (e)=>{
  const { x, y } = canvasEventToWorld(e);
  if (e.shiftKey) {
    const target = world.findNearestCreature(x, y, 22);
    if (target) {
      selectedCreature = target;
      highlightedLineage = target.lineageId;
      inspectorState.lastCreatureId = null; // force redraw
      maybeUpdateInspector(target);
    }
    return;
  }
  paintingFood = true;
  scatterFood(x, y);
});

canvas.addEventListener('pointermove', (e)=>{
  if (!paintingFood || e.shiftKey || !(e.buttons & 1)) return;
  const { x, y } = canvasEventToWorld(e);
  scatterFood(x, y);
});

canvas.addEventListener('pointerup', ()=> paintingFood = false);
canvas.addEventListener('pointerleave', ()=> paintingFood = false);
canvas.addEventListener('contextmenu', (e)=> e.preventDefault());

window.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') {
    selectedCreature = null;
    highlightedLineage = null;
    inspectorState.lastCreatureId = null;
    inspectorState.lastEnergyVersion = -1;
    inspectorState.lastRenderAt = performance.now();
    renderInspector(inspectorState, null);
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'o') {
    cycleOverlay(1);
    e.preventDefault();
    return;
  }
  if (e.key === 'O') {
    cycleOverlay(-1);
    e.preventDefault();
    return;
  }
  if (e.key >= '1' && e.key <= String(overlayModes.length)) {
    const idx = Number(e.key) - 1;
    setOverlayMode(overlayModes[idx]);
    e.preventDefault();
  }
});

function canvasEventToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left),
    y: (e.clientY - rect.top)
  };
}

function cycleOverlay(step) {
  const currIdx = overlayModes.indexOf(overlayMode);
  const nextIdx = (currIdx + step + overlayModes.length) % overlayModes.length;
  setOverlayMode(overlayModes[nextIdx]);
}
