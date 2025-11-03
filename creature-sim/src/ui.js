export function bindUI({ onPause, onStep, onFood, onHerb, onPred }) {
  document.getElementById('btn-pause').onclick = onPause;
  document.getElementById('btn-step').onclick  = onStep;
  document.getElementById('btn-spawn-food').onclick = onFood;
  document.getElementById('btn-spawn-herb').onclick = onHerb;
  document.getElementById('btn-spawn-pred').onclick = onPred;
}

export function renderStats(el, world, fps, extra={}) {
  const n = world.creatures.length;
  // Optimize: avoid filter() which creates new array, use simple loop
  let preds = 0;
  let sumHealth = 0;
  let sumMaxHealth = 0;
  for (let i = 0; i < n; i++) {
    const creature = world.creatures[i];
    if (creature.genes.predator) preds++;
    sumHealth += creature.health ?? 0;
    sumMaxHealth += creature.maxHealth ?? 1;
  }
  const herbs = n - preds;
  const avgHealth = sumMaxHealth ? sumHealth / sumMaxHealth : 0;
  
  // Build stats with HTML for better formatting
  const statParts = [
    `<span>🌍 Pop: ${n}</span>`,
    `<span>🌿 ${herbs}</span>`,
    `<span>🦁 ${preds}</span>`,
    `<span>🍎 ${world.food.length}</span>`,
    `<span>⏱️ ${world.t.toFixed(1)}s</span>`,
    `<span>💚 ${(avgHealth * 100).toFixed(0)}%</span>`,
    `<span>📊 ${fps.toFixed(0)} FPS</span>`
  ];
  
  const events = typeof world.getActiveEvents === 'function' ? world.getActiveEvents() : [];
  if (events.length) {
    const eventSummary = events
      .map(evt => `${evt.name} ${Math.ceil(evt.remaining)}s`)
      .join(' · ');
    statParts.push(`<span>🌪️ ${eventSummary}</span>`);
  }
  
  if (extra.tool) statParts.push(`<span>🛠️ ${String(extra.tool).toUpperCase()}</span>`);
  if (extra.fastForward && extra.fastForward !== 1) statParts.push(`<span>⚡ ×${extra.fastForward}</span>`);
  if (extra.paused) statParts.push(`<span style="color:#f48b8b;">⏸ PAUSED</span>`);
  
  el.innerHTML = statParts.join('');
}

export function renderInspector(model={}, handlers={}) {
  const body = document.getElementById('inspector-body');
  const badgesPanel = document.getElementById('badges-panel');
  const lineageSummaryEl = document.getElementById('lineage-summary');
  const lineageStoriesEl = document.getElementById('lineage-stories');
  const lineageStoryPanel = document.getElementById('lineage-story');
  const lineagePulsePanel = document.getElementById('lineage-dashboard');
  const lineagePulseMeta = document.getElementById('lineage-pulse-meta');
  const lineageSparkCanvas = document.getElementById('lineage-sparkline');
  const lineageTopEl = document.getElementById('lineage-top-families');
  const activityFeedEl = document.getElementById('activity-feed');
  const pinBtn = document.getElementById('btn-pin');
  const rootBtn = document.getElementById('btn-root');
  const closeBtn = document.getElementById('btn-close-inspector');

  if (!body || !lineageSummaryEl || !activityFeedEl) return;

  const creature = model.creature ?? null;
  const stats = creature ? model.stats ?? creature.stats : null;
  const badges = creature ? (model.badges ?? []) : [];
  const activity = creature ? (model.activity ?? []) : [];
  const drawLineageSparkline = (canvas, series=[]) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#11131d';
    ctx.fillRect(0, 0, width, height);
    if (!series.length) return;
    const padX = 4;
    const padY = 4;
    let min = series[0].alive;
    let max = series[0].alive;
    for (const pt of series) {
      if (pt.alive < min) min = pt.alive;
      if (pt.alive > max) max = pt.alive;
    }
    if (min === max) max = min + 1;
    const range = max - min;
    ctx.beginPath();
    series.forEach((pt, idx) => {
      const x = padX + (idx / Math.max(1, series.length - 1)) * (width - padX * 2);
      const y = height - padY - ((pt.alive - min) / range) * (height - padY * 2);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#6ea8ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (series.length < 3) {
      ctx.fillStyle = '#9ec5ff';
      series.forEach((pt, idx) => {
        const x = padX + (idx / Math.max(1, series.length - 1)) * (width - padX * 2);
        const y = height - padY - ((pt.alive - min) / range) * (height - padY * 2);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };
  const toPulseMeta = (source) => {
    if (!source) return null;
    return {
      name: source.name ?? `Lineage ${source.rootId}`,
      current: source.latest?.alive ?? source.alive ?? 0,
      delta: source.delta ?? 0,
      peak: source.peak ?? 0,
      series: source.series ?? []
    };
  };

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
      <div class="row"><div>Health</div><div>${creature.health.toFixed(1)} / ${creature.maxHealth.toFixed(0)}</div></div>
      <hr style="border-color:#2b2e41;opacity:.45;margin:6px 0;">
      <div class="row"><div>Speed</div><div>${creature.genes.speed.toFixed(2)}</div></div>
      <div class="row"><div>FOV</div><div>${creature.genes.fov.toFixed(0)}°</div></div>
      <div class="row"><div>Sense</div><div>${creature.genes.sense.toFixed(0)}px</div></div>
      <div class="row"><div>Metabolism</div><div>${creature.genes.metabolism.toFixed(2)}</div></div>
      <div class="row"><div>Hue</div><div>${creature.genes.hue}</div></div>
      <div class="row"><div>Spines</div><div>${((creature.genes.spines ?? 0) * 100).toFixed(0)}%</div></div>
      <div class="row"><div>Herd Instinct</div><div>${((creature.genes.herdInstinct ?? 0) * 100).toFixed(0)}%</div></div>
      <div class="row"><div>Panic Trail</div><div>${((creature.genes.panicPheromone ?? 0) * 100).toFixed(0)}%</div></div>
      <div class="row"><div>Grit</div><div>${((creature.genes.grit ?? 0) * 100).toFixed(0)}%</div></div>
      ${creature.genes.predator ? `
        <div class="row"><div>Pack Instinct</div><div>${(creature.genes.packInstinct * 100).toFixed(0)}%</div></div>
        <div class="row"><div>Ambush Delay</div><div>${creature.genes.ambushDelay.toFixed(1)}s</div></div>
        <div class="row"><div>Aggression</div><div>${creature.genes.aggression.toFixed(2)}</div></div>
      ` : ''}
      <hr style="border-color:#2b2e41;opacity:.45;margin:6px 0;">
      <div class="row"><div>Food eaten</div><div>${stats?.food ?? 0}</div></div>
      <div class="row"><div>Kills</div><div>${stats?.kills ?? 0}</div></div>
      <div class="row"><div>Births</div><div>${stats?.births ?? 0}</div></div>
      <div class="row"><div>Damage Dealt</div><div>${(stats?.damageDealt ?? 0).toFixed(1)}</div></div>
      <div class="row"><div>Damage Taken</div><div>${(stats?.damageTaken ?? 0).toFixed(1)}</div></div>
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
      pinBtn.textContent = model.pinned ? 'Unpin' : 'Pin';
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
      rootBtn.textContent = model.isRoot ? 'Clear Root' : 'Set Root';
      rootBtn.onclick = handlers.onSetRoot ?? null;
    }
  }

  if (closeBtn) {
    closeBtn.onclick = handlers.onClose ?? null;
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

  if (lineagePulsePanel && lineagePulseMeta && lineageTopEl) {
    const leaders = model.lineageLeaders ?? [];
    const pulseData = model.lineagePulse ?? null;
    const primaryMeta = toPulseMeta(pulseData);
    const fallbackMeta = !primaryMeta && leaders.length ? toPulseMeta(leaders[0]) : null;
    const sparkMeta = primaryMeta ?? fallbackMeta;

    if (!sparkMeta && !leaders.length) {
      lineagePulsePanel.classList.add('hidden');
      lineagePulseMeta.textContent = 'No samples yet.';
      lineageTopEl.textContent = 'Collecting lineage data…';
      if (lineageSparkCanvas) {
        const ctx = lineageSparkCanvas.getContext('2d');
        ctx?.clearRect(0, 0, lineageSparkCanvas.width, lineageSparkCanvas.height);
      }
    } else {
      lineagePulsePanel.classList.remove('hidden');
      if (sparkMeta && sparkMeta.series.length) {
        drawLineageSparkline(lineageSparkCanvas, sparkMeta.series);
      } else if (lineageSparkCanvas) {
        const ctx = lineageSparkCanvas.getContext('2d');
        ctx?.clearRect(0, 0, lineageSparkCanvas.width, lineageSparkCanvas.height);
      }

      if (primaryMeta) {
        const trend = primaryMeta.delta > 0 ? `+${primaryMeta.delta}` : primaryMeta.delta < 0 ? `${primaryMeta.delta}` : '0';
        lineagePulseMeta.textContent = `${primaryMeta.name}: ${primaryMeta.current} alive (peak ${primaryMeta.peak}, trend ${trend})`;
      } else if (fallbackMeta) {
        const trend = fallbackMeta.delta > 0 ? `+${fallbackMeta.delta}` : fallbackMeta.delta < 0 ? `${fallbackMeta.delta}` : '0';
        lineagePulseMeta.textContent = `${fallbackMeta.name}: ${fallbackMeta.current} alive (peak ${fallbackMeta.peak}, trend ${trend})`;
      } else {
        lineagePulseMeta.textContent = 'Collecting lineage data…';
      }

      if (!leaders.length) {
        lineageTopEl.textContent = 'No dominant families yet.';
      } else {
        lineageTopEl.innerHTML = leaders.map(entry => {
          const trendClass = entry.delta > 0 ? 'up' : entry.delta < 0 ? 'down' : 'flat';
          const trendVal = entry.delta > 0 ? `+${entry.delta}` : entry.delta < 0 ? `${entry.delta}` : '0';
          return `<div class="family"><button class="family-root" data-root="${entry.rootId}">${entry.name}</button><div class="metrics"><span>${entry.alive}</span><span class="direction ${trendClass}">${trendVal}</span><span class="muted">pk ${entry.peak}</span></div></div>`;
        }).join('');
        lineageTopEl.querySelectorAll('.family-root').forEach(btn => {
          btn.onclick = () => handlers.onSetRootId?.(Number(btn.dataset.root));
        });
      }
    }
  }

  if (lineageStoriesEl && lineageStoryPanel) {
    const stories = model.lineageStories ?? [];
    if (!stories.length) {
      lineageStoryPanel.classList.add('hidden');
      lineageStoriesEl.innerHTML = 'No milestones yet.';
    } else {
      lineageStoryPanel.classList.remove('hidden');
      lineageStoriesEl.innerHTML = stories.map(evt => {
        return `<button class="story" data-root="${evt.rootId}"><strong>${evt.title}</strong><br><span class="muted">t=${evt.time.toFixed(1)}s</span></button>`;
      }).join('');
      lineageStoriesEl.querySelectorAll('.story').forEach(btn => {
        btn.onclick = () => handlers.onInspectId?.(Number(btn.dataset.root));
      });
    }
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

  drawChart(ctxMap.variance, [
    { series: data.speedVar, color:'#8df0ff', label:'Speed σ²', decimals:3 },
    { series: data.senseVar, color:'#d496ff', label:'Sense σ²', decimals:3 }
  ], { min:0 });

  drawChart(ctxMap.ratio, [
    { series: data.predatorRatio, color:'#ff8888', label:'Pred %', decimals:2 }
  ], { min:0, max:1 });

  drawChart(ctxMap.predators, [
    { series: data.meanPackInstinct, color:'#5bdadf', label:'Pack', decimals:2 },
    { series: data.meanAggression, color:'#ff9f6d', label:'Agg', decimals:2 },
    { series: data.meanAmbushDelay, color:'#d5b4ff', label:'Amb', decimals:2 }
  ]);

  drawChart(ctxMap.health, [
    { series: data.meanHealth, color:'#7fe07f', label:'HP', decimals:1 },
    { series: data.meanMaxHealth, color:'#a3b0ff', label:'HPmax', decimals:1 }
  ], { min:0 });
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

  // Optimize: avoid flatMap and spread operator for better performance
  let minVal = min != null ? min : Infinity;
  let maxVal = max != null ? max : -Infinity;
  if (min == null || max == null) {
    for (let i = 0; i < lines.length; i++) {
      const series = lines[i].series;
      for (let j = 0; j < series.length; j++) {
        const val = series[j];
        if (min == null && val < minVal) minVal = val;
        if (max == null && val > maxVal) maxVal = val;
      }
    }
  }
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
