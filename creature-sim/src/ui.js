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

export function renderInspector(creature, lineageRootId) {
  const el = document.getElementById('inspector-body');
  if (!creature) {
    el.innerHTML = `<div class="muted">Click a creature to inspect.<br/>Shift-click to set lineage root.</div>`;
    return;
  }
  const g = creature.genes;
  el.innerHTML = `
    <div class="row"><div>ID</div><div>#${creature.id}</div></div>
    <div class="row"><div>Parent</div><div>${creature.parentId ?? '—'}</div></div>
    <div class="row"><div>Type</div><div><span class="tag">${g.predator ? 'Predator' : 'Herbivore'}</span></div></div>
    <div class="row"><div>Age</div><div>${creature.age.toFixed(1)}s</div></div>
    <div class="row"><div>Energy</div><div>${creature.energy.toFixed(1)}</div></div>
    <hr style="border-color:#2b2e41;opacity:.5;margin:6px 0;">
    <div class="row"><div>Speed</div><div>${g.speed.toFixed(2)}</div></div>
    <div class="row"><div>FOV</div><div>${g.fov.toFixed(0)}°</div></div>
    <div class="row"><div>Sense</div><div>${g.sense.toFixed(0)}px</div></div>
    <div class="row"><div>Metabolism</div><div>${g.metabolism.toFixed(2)}</div></div>
    <div class="row"><div>Hue</div><div>${g.hue}</div></div>
    ${lineageRootId ? `<div style="margin-top:6px" class="muted">Lineage root: #${lineageRootId}</div>` : ''}
  `;
}
