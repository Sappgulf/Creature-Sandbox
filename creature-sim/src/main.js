import { World } from './world.js';
import { bindUI, renderStats } from './ui.js';
import { makeGenes } from './genetics.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const world = new World(canvas.width, canvas.height);
world.seed(70, 6, 200);

let paused = false, stepOnce = false, last = performance.now(), fps=0;

bindUI({
  onPause: () => paused = !paused,
  onStep:  () => { paused = true; stepOnce = true; },
  onFood:  () => world.addFood(Math.random()*canvas.width, Math.random()*canvas.height, 2),
  onPred:  async () => {
    // spawn a new predator with slight variety
    const g = makeGenes({ predator:1, speed:1.2, metabolism:1.2, hue:0 });
    const { Creature } = await import('./creature.js');
    world.creatures.push(new Creature(Math.random()*canvas.width, Math.random()*canvas.height, g));
  }
});

const statsEl = document.getElementById('stats');

function loop(now) {
  const dt = Math.min(0.05, (now - last)/1000); // clamp large jumps
  last = now;
  // Update
  if (!paused || stepOnce) {
    world.step(dt);
    stepOnce = false;
  }

  // Draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  world.draw(ctx);

  // FPS (simple EMA)
  fps = 0.9*fps + 0.1*(1/dt);
  renderStats(statsEl, world, fps);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Click to paint food
canvas.addEventListener('pointerdown', (e)=>{
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  for (let i=0;i<12;i++) world.addFood(x+(Math.random()-0.5)*30, y+(Math.random()-0.5)*30, 1.2);
});
