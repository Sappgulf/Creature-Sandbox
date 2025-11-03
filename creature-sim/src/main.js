import { World } from './world.js';
import { bindUI, renderStats, renderInspector } from './ui.js';
import { makeGenes } from './genetics.js';
import { Creature } from './creature.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const world = new World(canvas.width, canvas.height);
world.seed(70, 6, 200);

let paused = false, stepOnce = false, last = performance.now(), fps=0;

// selection & lineage
let selectedId = null;
let lineageRootId = null;

bindUI({
  onPause: () => paused = !paused,
  onStep:  () => { paused = true; stepOnce = true; },
  onFood:  () => world.addFood(Math.random()*canvas.width, Math.random()*canvas.height, 2),
  onPred:  () => {
    const g = makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 });
    world.addCreature(new Creature(Math.random()*canvas.width, Math.random()*canvas.height, g), null);
  }
});

const statsEl = document.getElementById('stats');

function loop(now) {
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;

  if (!paused || stepOnce) { world.step(dt); stepOnce = false; }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  world.draw(ctx, { selectedId, lineageRootId });

  fps = 0.9*fps + 0.1*(1/dt);
  renderStats(statsEl, world, fps);

  // keep inspector synced (selected creature might have died)
  const sel = selectedId ? world.getCreatureById(selectedId) : null;
  if (!sel) selectedId = null;
  renderInspector(sel, lineageRootId);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Input: easy selection + lineage root ---
function canvasToXY(e){
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('click', (e)=>{
  const { x, y } = canvasToXY(e);
  const c = world.nearestCreature(x,y, 22); // generous selection radius
  if (e.shiftKey) {
    // set/clear lineage root
    lineageRootId = c ? c.id : null;
    // don’t also select if cleared with shift in empty space
    if (!c) selectedId = null;
  } else {
    selectedId = c ? c.id : null;
  }
});

canvas.addEventListener('pointerdown', (e)=>{
  // left-drag paints food as before
  if (e.button!==0) return;
  const paint = (ev)=>{
    const { x, y } = canvasToXY(ev);
    for (let i=0;i<8;i++) world.addFood(x+(Math.random()-0.5)*22, y+(Math.random()-0.5)*22, 1.2);
  };
  const move = (ev)=> paint(ev);
  const up = ()=>{
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

window.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape') { lineageRootId = null; }
});
