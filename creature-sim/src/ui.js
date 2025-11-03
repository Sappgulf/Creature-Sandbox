const overlayLabels = {
  none: 'Natural',
  speed: 'Speed',
  fov: 'Field of View',
  sense: 'Sense Radius',
  metabolism: 'Metabolism',
  predator: 'Herbivore / Predator'
};

export function bindUI({ onPause, onStep, onFood, onPred, onOverlayChange, onClearSelection }) {
  document.getElementById('btn-pause').onclick = onPause;
  document.getElementById('btn-step').onclick  = onStep;
  document.getElementById('btn-spawn-food').onclick = onFood;
  document.getElementById('btn-spawn-pred').onclick = onPred;

  const overlaySelect = document.getElementById('overlay-mode');
  if (overlaySelect && onOverlayChange) {
    overlaySelect.addEventListener('change', (ev)=>onOverlayChange(ev.target.value));
  }

  const clearBtn = document.getElementById('btn-clear-selection');
  if (clearBtn && onClearSelection) {
    clearBtn.addEventListener('click', onClearSelection);
  }

  return {
    setOverlayMode(mode) {
      if (overlaySelect) {
        overlaySelect.value = mode;
      }
    }
  };
}

export function renderStats(el, world, fps, overlayMode='none') {
  const n = world.creatures.length;
  const preds = world.creatures.filter(c=>c.genes.predator).length;
  const herbs = n - preds;
  const overlayLabel = overlayLabels[overlayMode] ?? overlayMode;
  el.textContent = `Pop: ${n} (H:${herbs} P:${preds})  Food: ${world.food.length}  t=${world.t.toFixed(1)}s  ${fps.toFixed(0)} FPS  Overlay: ${overlayLabel}`;
}

export function renderInspector(view, creature) {
  const { bodyEl, chartCtx } = view;
  if (!bodyEl) return;

  if (!creature || !creature.alive) {
    bodyEl.innerHTML = '<p>Shift-click a creature to inspect it. Hold shift again to hop between nearby creatures. Lineage mates glow cyan.</p>';
    if (chartCtx) {
      chartCtx.clearRect(0,0,chartCtx.canvas.width, chartCtx.canvas.height);
    }
    return;
  }

  const g = creature.genes;
  const rows = `
    <div class="inspector-section">
      <strong>Identity</strong>
      <div>ID <code>${creature.id}</code> · Lineage <code>${creature.lineageId}</code>${creature.parentId ? ` · Parent <code>${creature.parentId}</code>` : ''}</div>
      <div>Age ${(creature.age).toFixed(1)}s · Energy ${creature.energy.toFixed(1)}</div>
    </div>
    <div class="inspector-section">
      <strong>Genes</strong>
      <div class="inspector-grid">
        <div><span>Speed</span><code>${g.speed.toFixed(2)}</code></div>
        <div><span>FOV</span><code>${g.fov.toFixed(0)}°</code></div>
        <div><span>Sense</span><code>${g.sense.toFixed(0)}px</code></div>
        <div><span>Metabolism</span><code>${g.metabolism.toFixed(2)}</code></div>
        <div><span>Hue</span><code>${g.hue}</code></div>
        <div><span>Diet</span><code>${g.predator ? 'Predator' : 'Herbivore'}</code></div>
      </div>
    </div>
    <div class="inspector-section">
      <strong>Performance</strong>
      <div class="inspector-grid">
        <div><span>Food eaten</span><code>${creature.stats.food}</code></div>
        <div><span>Kills</span><code>${creature.stats.kills}</code></div>
        <div><span>Births</span><code>${creature.stats.births}</code></div>
        <div><span>Burn/sec</span><code>${creature.baseBurn().toFixed(2)}</code></div>
      </div>
    </div>
  `;
  bodyEl.innerHTML = rows;

  if (chartCtx) {
    drawSparkline(chartCtx, creature.energyHistory);
  }
}

function drawSparkline(ctx, history) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0,0,w,h);

  if (!history || history.length < 2) return;

  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  const padding = 6;
  const usableHeight = h - padding * 2;
  const step = (w - padding*2) / (history.length - 1);

  ctx.strokeStyle = 'rgba(140,150,220,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, h - padding);
  ctx.lineTo(w - padding, h - padding);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(84,196,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  history.forEach((v, idx)=>{
    const x = padding + idx * step;
    const t = (v - min) / range;
    const y = h - padding - t * usableHeight;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`min ${min.toFixed(1)} · max ${max.toFixed(1)}`, padding, 4);
}
