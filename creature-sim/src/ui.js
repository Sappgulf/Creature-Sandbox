export function bindUI({ onPause, onStep, onFood, onPred }) {
  document.getElementById('btn-pause').onclick = onPause;
  document.getElementById('btn-step').onclick  = onStep;
  document.getElementById('btn-spawn-food').onclick = onFood;
  document.getElementById('btn-spawn-pred').onclick = onPred;
}

export function renderStats(el, world, fps) {
  const n = world.creatures.length;
  const preds = world.creatures.filter(c=>c.genes.predator).length;
  const herbs = n - preds;
  el.textContent = `Pop: ${n} (H:${herbs} P:${preds})  Food: ${world.food.length}  t=${world.t.toFixed(1)}s  ${fps.toFixed(0)} FPS`;
}
