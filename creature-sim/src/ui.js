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

export function renderInspector(model={}, handlers={}) {
  const body = document.getElementById('inspector-body');
  const badgesPanel = document.getElementById('badges-panel');
  const lineageSummaryEl = document.getElementById('lineage-summary');
  const activityFeedEl = document.getElementById('activity-feed');
  const pinBtn = document.getElementById('btn-pin');
  const rootBtn = document.getElementById('btn-root');

  if (!body || !lineageSummaryEl || !activityFeedEl) return;

  const creature = model.creature ?? null;
  const stats = creature ? model.stats ?? creature.stats : null;
  const badges = creature ? (model.badges ?? []) : [];
  const activity = creature ? (model.activity ?? []) : [];

  if (!creature) {
    body.innerHTML = `<div class="muted">Click a creature to inspect.<br/>Shift-click to set lineage root.</div>`;
  } else {
    const parentCell = creature.parentId ? `<button class="btn-link" id="btn-parent">#${creature.parentId}</button>` : '—';
    body.innerHTML = `
      <div class="row"><div>ID</div><div>#${creature.id}${creature.alive? '' : ' †'}</div></div>
      <div class="row"><div>Parent</div><div>${parentCell}</div></div>
      <div class="row"><div>Type</div><div><span class="tag">${creature.genes.predator ? 'Predator' : 'Herbivore'}</span></div></div>
      <div class="row"><div>Age</div><div>${creature.age.toFixed(1)}s</div></div>
      <div class="row"><div>Energy</div><div>${creature.energy.toFixed(1)}</div></div>
      <hr style="border-color:#2b2e41;opacity:.45;margin:6px 0;">
      <div class="row"><div>Speed</div><div>${creature.genes.speed.toFixed(2)}</div></div>
      <div class="row"><div>FOV</div><div>${creature.genes.fov.toFixed(0)}°</div></div>
      <div class="row"><div>Sense</div><div>${creature.genes.sense.toFixed(0)}px</div></div>
      <div class="row"><div>Metabolism</div><div>${creature.genes.metabolism.toFixed(2)}</div></div>
      <div class="row"><div>Hue</div><div>${creature.genes.hue}</div></div>
      <hr style="border-color:#2b2e41;opacity:.45;margin:6px 0;">
      <div class="row"><div>Food eaten</div><div>${stats?.food ?? 0}</div></div>
      <div class="row"><div>Kills</div><div>${stats?.kills ?? 0}</div></div>
      <div class="row"><div>Births</div><div>${stats?.births ?? 0}</div></div>
    `;
  }

  if (pinBtn) {
    if (!creature) {
      pinBtn.disabled = true;
      pinBtn.classList.remove('active');
      pinBtn.textContent = 'Pin';
      pinBtn.onclick = null;
    } else {
      pinBtn.disabled = false;
      pinBtn.classList.toggle('active', !!model.pinned);
      pinBtn.textContent = model.pinned ? 'Pinned' : 'Pin';
      pinBtn.onclick = handlers.onTogglePin ?? null;
    }
  }

  if (rootBtn) {
    if (!creature) {
      rootBtn.disabled = true;
      rootBtn.classList.remove('active');
      rootBtn.textContent = 'Set Root';
      rootBtn.onclick = null;
    } else {
      rootBtn.disabled = false;
      rootBtn.classList.toggle('active', !!model.isRoot);
      rootBtn.textContent = model.isRoot ? 'Root' : 'Set Root';
      rootBtn.onclick = handlers.onSetRoot ?? null;
    }
  }

  if (creature && creature.parentId) {
    const parentBtn = document.getElementById('btn-parent');
    if (parentBtn) parentBtn.onclick = () => handlers.onFocusParent?.(creature.parentId);
  }

  if (badgesPanel) {
    if (creature && badges.length) {
      badgesPanel.classList.remove('hidden');
      badgesPanel.innerHTML = `
        <div class="section-title">Badges</div>
        <div class="badge-list">${badges.map(b=>`<span class="badge">${b}</span>`).join('')}</div>
      `;
    } else {
      badgesPanel.classList.add('hidden');
      badgesPanel.innerHTML = '';
    }
  }

  if (lineageSummaryEl) {
    if (!model.lineageRootId) {
      const ancestorStr = creature && model.ancestors && model.ancestors.length
        ? `Ancestors: ${model.ancestors.map(a=>formatId(a)).join(' ← ')}`
        : 'Shift-click a creature to pick a lineage root.';
      lineageSummaryEl.innerHTML = ancestorStr;
    } else {
      const overview = model.lineage ?? null;
      if (!overview) {
        lineageSummaryEl.textContent = `Lineage root #${model.lineageRootId}, no descendants yet.`;
      } else {
        let html = `<div>Root #${model.lineageRootId} · ${overview.totalDesc} descendants (${overview.aliveDesc} alive)</div>`;
        if (overview.levels.length) {
          html += overview.levels.map(level => {
            const samples = level.sample.filter(Boolean).map(id => `<button class="btn-link lineage-jump" data-id="${id}">#${id}</button>`).join(', ');
            return `<div class="lineage-level"><span>Gen ${level.depth}</span><span class="count">${level.alive}/${level.total}</span>${samples ? `<span class="ids">${samples}</span>` : ''}</div>`;
          }).join('');
        } else {
          html += '<div class="muted" style="margin-top:4px;">No descendants yet.</div>';
        }
        if (creature && model.ancestors && model.ancestors.length) {
          html += `<div class="muted" style="margin-top:6px;">Ancestors: ${model.ancestors.map(a=>formatId(a)).join(' ← ')}</div>`;
        }
        lineageSummaryEl.innerHTML = html;
      }
    }

    lineageSummaryEl.querySelectorAll('.lineage-jump').forEach(btn => {
      btn.onclick = () => handlers.onInspectId?.(Number(btn.dataset.id));
    });
  }

  if (activityFeedEl) {
    if (!creature) {
      activityFeedEl.innerHTML = 'No activity yet.';
    } else if (!activity.length) {
      activityFeedEl.innerHTML = 'No recent events.';
    } else {
      const items = activity.map(entry => {
        const time = entry.time != null ? `${entry.time.toFixed(1)}s` : '';
        return `<li><time>${time}</time>${entry.message}</li>`;
      }).join('');
      activityFeedEl.innerHTML = `<ul class="activity-list">${items}</ul>`;
    }
  }
}

export function renderAnalyticsCharts(ctxMap, data) {
  if (!data || !data.time || data.time.length < 2) {
    Object.values(ctxMap).forEach(ctx => ctx && ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height));
    return;
  }

  drawChart(ctxMap.pop, [
    { series: data.population, color:'#7fd36a', label:'Pop', decimals:0 },
    { series: data.predators, color:'#f37f7f', label:'Pred', decimals:0 }
  ], { min:0 });

  drawChart(ctxMap.speed, [
    { series: data.meanSpeed, color:'#76a9ff', label:'Speed', decimals:2 }
  ]);

  drawChart(ctxMap.metabolism, [
    { series: data.meanMetabolism, color:'#ffbd7a', label:'Metab', decimals:2 }
  ]);
}

function drawChart(ctx, lines, { min=null, max=null } = {}) {
  if (!ctx || !lines || !lines.length) return;
  const len = lines[0].series.length;
  if (len < 2) {
    ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
    return;
  }
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const pad = 6;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#11131d';
  ctx.fillRect(0,0,w,h);

  const allValues = lines.flatMap(l => l.series);
  const minVal = min != null ? min : Math.min(...allValues);
  const maxVal = max != null ? max : Math.max(...allValues);
  const range = (maxVal - minVal) || 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  for (const line of lines) {
    ctx.beginPath();
    line.series.forEach((value, idx) => {
      const x = pad + (idx/(len-1))*(w - pad*2);
      const y = h - pad - ((value - minVal)/range)*(h - pad*2);
      if (idx === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.font = '11px system-ui, sans-serif';
  let textY = pad + 10;
  for (const line of lines) {
    const last = line.series[len-1];
    ctx.fillStyle = line.color;
    ctx.fillText(`${line.label ?? ''} ${formatNumber(last, line.decimals ?? 1)}`, pad, textY);
    textY += 12;
  }
}

function formatNumber(value, decimals=1) {
  return Number.parseFloat(value).toFixed(decimals);
}

function formatId(creature) {
  if (!creature) return '—';
  const marker = creature.alive ? '' : '†';
  return `<button class="btn-link lineage-jump" data-id="${creature.id}">#${creature.id}${marker}</button>`;
}
