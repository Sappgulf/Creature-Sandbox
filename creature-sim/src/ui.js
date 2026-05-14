import { gameState } from './game-state.js';
import { buildBondsSummary, getCreatureEmotion, getLifeStageDisplay } from './upgrade-data.js';

// Animated number counter helper
const _counterState = new Map();
let inspectorActiveTab = 'stats';
function animateNumber(key, target, duration = 400) {
  const now = performance.now();
  const state = _counterState.get(key);
  if (!state) {
    _counterState.set(key, { value: target, target, startTime: now, from: target });
    return target;
  }
  if (state.target !== target) {
    state.from = state.value;
    state.target = target;
    state.startTime = now;
  }
  const elapsed = now - state.startTime;
  if (elapsed >= duration) {
    state.value = target;
    return target;
  }
  const t = elapsed / duration;
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  state.value = state.from + (target - state.from) * ease;
  return Math.round(state.value);
}

export function renderStats(el, world, fps, extra = {}) {
  if (!el) return;

  const n = world.creatures.length;
  const isMobile = typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 768px)').matches ?? false);
  const toolMeta = {
    food: { icon: '🌿', label: 'Food' },
    spawn: { icon: '🧬', label: 'Spawn' },
    erase: { icon: '🧹', label: 'Erase' },
    inspect: { icon: '🔍', label: 'Inspect' },
    prop: { icon: '🧱', label: 'Props' }
  };

  // Count creature types efficiently
  let preds = 0;
  for (let i = 0; i < n; i++) {
    const diet = world.creatures[i].genes.diet ?? (world.creatures[i].genes.predator ? 1.0 : 0.0);
    if (diet > 0.7) preds++;
  }

  // Build minimal, clean stats line
  const statParts = [];

  // Core metrics - always show (animated counters)
  const animPop = animateNumber('pop', n);
  const animPreds = animateNumber('preds', preds);
  const animFood = animateNumber('food', world.food.length);
  statParts.push(`<span>🐾 <span class="value">${animPop}</span></span>`);
  statParts.push(`<span>🦁 <span class="value">${animPreds}</span></span>`);
  statParts.push(`<span>🌿 <span class="value">${animFood}</span></span>`);

  // Tool indicator
  if (extra.tool) {
    const meta = toolMeta[extra.tool] || { icon: '🛠️', label: extra.tool };
    const brushSize = Number.isFinite(extra.brushSize) ? Math.round(extra.brushSize) : null;
    const toolLabel = brushSize && extra.tool !== 'inspect'
      ? `${meta.label} ${brushSize}px`
      : meta.label;
    statParts.push(`<span class="stat-tool">${meta.icon} <span class="value">${toolLabel}</span></span>`);
  }

  if (isMobile) {
    if (extra.fastForward && extra.fastForward !== 1) {
      statParts.push(`<span>⚡<span class="value">×${extra.fastForward}</span></span>`);
    }
    if (extra.paused) {
      statParts.push('<span style="color: var(--accent-danger);">⏸</span>');
    }
    if (fps < 40) {
      statParts.push(`<span style="color: var(--accent-warning);">${fps.toFixed(0)} FPS</span>`);
    }
    el.innerHTML = statParts.join('');
    return;
  }

  if (extra.godModeActive) {
    const godLabels = {
      food: 'Food',
      calm: 'Calm',
      chaos: 'Chaos',
      spawn: 'Spawn',
      prop: 'Prop',
      remove: 'Remove'
    };
    const toolLabel = extra.godModeTool ? (godLabels[extra.godModeTool] || extra.godModeTool) : 'Mode';
    const label = `God ${toolLabel}`;
    statParts.push(`<span class="stat-tool">✨ <span class="value">${label}</span></span>`);
  }

  // Season info - compact
  if (world.getSeasonInfo) {
    const seasonInfo = world.getSeasonInfo();
    if (seasonInfo?.current) {
      const progressPct = Math.round((seasonInfo.progress ?? 0) * 100);
      statParts.push(`<span>${seasonInfo.icon || '🌱'} <span class="value">${progressPct}%</span></span>`);
    }
  }

  // Time of day - compact
  if (extra.timeOfDay !== undefined) {
    const hour = Math.floor(extra.timeOfDay);
    const isDaytime = hour >= 6 && hour < 20;
    statParts.push(`<span>${isDaytime ? '☀️' : '🌙'}</span>`);
  }

  // FPS - only if performance mode or low
  if (fps < 50) {
    statParts.push(`<span style="color: var(--accent-warning);">${fps.toFixed(0)} FPS</span>`);
  }

  // Speed indicator
  if (extra.fastForward && extra.fastForward !== 1) {
    statParts.push(`<span>⚡<span class="value">×${extra.fastForward}</span></span>`);
  }

  // Paused state
  if (extra.paused) {
    statParts.push('<span style="color: var(--accent-danger);">⏸</span>');
  }

  // Active events - very compact
  const events = typeof world.getActiveEvents === 'function' ? world.getActiveEvents() : [];
  if (events.length) {
    const evt = events[0];
    const icon = evt.icon || '✦';
    const label = evt.label || 'Event';
    statParts.push(`<span style="color: var(--accent-warning);">${icon} ${label} · ${Math.ceil(evt.remaining)}s</span>`);
  }

  el.innerHTML = statParts.join('');
}

export function renderInteractionHint(el, {
  tool = 'inspect',
  propType = null,
  hasSelection = false,
  hintDurationMs = 3200,
  customMessage = null,
  customId = null
} = {}) {
  if (!el) return;
  const propLabels = {
    bounce: 'Bounce Pad',
    spring: 'Spring Pad',
    spinner: 'Spinner',
    seesaw: 'See-Saw',
    conveyor: 'Conveyor Belt',
    slope: 'Speed Slope',
    fan: 'Wind Fan',
    sticky: 'Sticky Zone',
    gravity: 'Gravity Well',
    button: 'Food Button',
    launch: 'Launch Button'
  };

  let message = '';
  switch (tool) {
    case 'food':
      message = 'Paint food · drag to brush';
      break;
    case 'spawn':
      message = 'Spawn creatures · tap the world';
      break;
    case 'erase':
      message = 'Erase creatures or props';
      break;
    case 'prop': {
      const label = propLabels[propType] || 'Prop';
      message = `Place ${label} · use the props menu`;
      break;
    }
    case 'inspect':
    default:
      message = hasSelection
        ? 'Drag to move · tap to inspect'
        : 'Tap a creature to inspect';
      break;
  }

  const now = performance.now();
  const textEl = el.querySelector('.interaction-hint-text') || el;
  const activeMessage = (customMessage && String(customMessage).trim().length > 0)
    ? String(customMessage).trim()
    : message;
  const messageKey = customMessage ? `prompt:${customId || activeMessage}` : activeMessage;
  const lastMessage = el.dataset.message || '';

  if (activeMessage && messageKey !== lastMessage) {
    el.dataset.message = messageKey;
    el.dataset.promptId = customId || '';
    el.dataset.dismissed = 'false';
    el.dataset.expiresAt = String(now + hintDurationMs);
  }

  const dismissed = el.dataset.dismissed === 'true';
  const expiresAt = Number(el.dataset.expiresAt || 0);
  const isExpired = expiresAt > 0 && now > expiresAt;
  const shouldHide = !activeMessage || dismissed || isExpired;

  if (!shouldHide) {
    textEl.textContent = activeMessage;
  }

  el.classList.toggle('hidden', shouldHide);
  el.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
}

export function renderSelectedInfo(el, creature, { world = null, lineageTracker = null } = {}) {
  if (!el) return;
  const isMobile = typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 768px)').matches ?? false);
  if (!creature) {
    el.classList.remove('hidden');
    el.classList.add('selected-empty');
    el.innerHTML = isMobile
      ? `
        <div class="empty-title">No creature selected</div>
        <div class="muted">Tap a creature to inspect or use Spawn.</div>
      `
      : `
        <div class="empty-title">No creature selected</div>
        <div class="muted">Tap a creature to inspect. Use Spawn to add one.</div>
        <ul class="empty-list">
          <li>Use <strong>S</strong> or Spawn to place creatures.</li>
          <li>Shift+click sets a lineage root.</li>
        </ul>
      `;
    return;
  }

  el.classList.remove('hidden');
  el.classList.remove('selected-empty');

  // Resolve lineage-friendly name if available
  let lineageName = null;
  let familyRootId = null;
  let generation = Number.isFinite(creature.generation) ? creature.generation : null;
  if (world && lineageTracker && typeof lineageTracker.getRoot === 'function' && typeof lineageTracker.ensureName === 'function') {
    const rootId = lineageTracker.getRoot(world, creature.id);
    if (rootId != null) {
      familyRootId = rootId;
      lineageName = lineageTracker.ensureName(rootId);
    }
    if (typeof lineageTracker.generation === 'function') {
      generation = lineageTracker.generation(world, creature.id);
    }
  }

  // Determine diet label
  const rawDiet = creature.genes?.diet ?? (creature.genes?.predator ? 1.0 : 0.0);
  let dietLabel = 'Herbivore';
  if (creature.genes?.predator || rawDiet >= 0.7) {
    dietLabel = 'Predator';
  } else if (rawDiet >= 0.3) {
    dietLabel = 'Omnivore';
  }
  const dietRole = creature.traits?.dietRole;
  if (dietRole === 'scavenger') {
    dietLabel = 'Scavenger';
  } else if (dietRole === 'predator-lite') {
    dietLabel = 'Predator-lite';
  }

  const statusClass = creature.alive ? 'alive' : 'dead';
  const sexEmoji = creature.sex === 'male' ? ' ♂️' : ' ♀️';
  const disorderEmojis = (creature.disorders || []).map(d => {
    const disorders = { ALBINISM: ' 🤍', HEMOPHILIA: ' 🩸', GIGANTISM: ' 🦕', DWARFISM: ' 🐁', HYPERMETABOLISM: ' ⚡' };
    return disorders[d] || '';
  }).join('');

  const headline = lineageName ? `${lineageName} · #${creature.id}${sexEmoji}${disorderEmojis}` : `Creature #${creature.id}${sexEmoji}${disorderEmojis}`;
  const lifeStage = getLifeStageDisplay(creature);
  const emotion = getCreatureEmotion(creature);
  const bonds = buildBondsSummary(creature, world);
  const sublineParts = [
    dietLabel,
    `${lifeStage.icon} ${lifeStage.label}`,
    `Age ${creature.age.toFixed(1)}s`
  ];
  if (creature.parentId) {
    sublineParts.push(`Parent #${creature.parentId}`);
  }

  const energy = creature.energy?.toFixed(1) ?? '0.0';
  const maxHealth = creature.maxHealth ?? creature.health ?? 0;
  const health = `${(creature.health ?? 0).toFixed(0)} / ${maxHealth.toFixed(0)}`;
  const speed = creature.genes?.speed?.toFixed(2) ?? '0.00';
  const sense = creature.genes?.sense?.toFixed(0) ?? '0';
  const metabolism = creature.genes?.metabolism?.toFixed(2) ?? '0.00';
  const aquatic = (creature.genes?.aquatic ?? 0).toFixed(2);
  const aggression = Number(creature.genes?.aggression ?? creature.personality?.aggression ?? 0).toFixed(2);
  const socialDrive = Math.round(Number(creature.needs?.socialDrive ?? creature.social?.bondStrength ?? 0));
  const curiosityRaw = Number(creature.ecosystem?.curiosity ?? creature.personality?.curiosity ?? 0);
  const curiosity = Math.round(curiosityRaw <= 1 ? curiosityRaw * 100 : curiosityRaw);
  const biomeInfo = world?.getBiomeAt?.(creature.x, creature.y);
  const biome = biomeInfo?.name ?? biomeInfo?.type ?? 'Unknown';
  const nameSuggestion = creature.nameSuggestion ? `💡 ${creature.nameSuggestion}` : null;
  const quirks = Array.isArray(creature.quirks) ? creature.quirks : [];
  const showQuirks = gameState.showQuirks && quirks.length > 0;
  const quirkLabelMap = {
    wanderer: 'Wanderer',
    homebody: 'Homebody',
    squeamish: 'Squeamish',
    sturdy: 'Sturdy',
    bouncy: 'Bouncy',
    dramatic: 'Dramatic',
    greedy: 'Greedy',
    night_owl: 'Night Owl',
    social_butterfly: 'Social Butterfly'
  };
  const quirkLine = showQuirks ? `<div class="subline quirks">Quirks: ${quirks.map(q => quirkLabelMap[q] || q).join(', ')}</div>` : '';
  const quirkHint = quirks.length ? '<div class="hint">Press Q to toggle quirks</div>' : '';
  const hunger = Number(creature.needs?.hunger ?? 0);
  const stress = Number(creature.needs?.stress ?? creature.ecosystem?.stress ?? 0);
  const energyNeed = Number(creature.needs?.energy ?? creature.energy ?? 0);
  const goal = creature.goal?.current || creature.currentGoal || creature.state || 'exploring';
  const readableState = (() => {
    if (!creature.alive) return 'Gone';
    if (hunger > 72 || creature.energy < 14) return 'Hungry';
    if (stress > 64) return 'Scared';
    if (goal === 'rest' || energyNeed < 32) return 'Resting';
    if (goal === 'mate') return 'Looking for mate';
    if (goal === 'eat') return 'Seeking food';
    if (goal === 'wander') return 'Exploring';
    return String(goal).replaceAll('_', ' ');
  })();
  const memoryCount = Array.isArray(creature.memory?.locations) ? creature.memory.locations.length : 0;
  const stateTags = [
    `${emotion.icon} ${emotion.label}`,
    readableState,
    `Hunger ${Math.round(hunger)}`,
    `Stress ${Math.round(stress)}`,
    memoryCount ? `${memoryCount} memories` : null
  ].filter(Boolean);
  const stateTagMarkup = `<div class="state-tags">${stateTags.map(tag => `<span>${tag}</span>`).join('')}</div>`;
  const memoryTypeLabel = (memory) => {
    const type = memory?.type || memory?.tag || 'memory';
    const labels = {
      food: 'Food source',
      calm: 'Calm place',
      nest: 'Nest',
      danger: 'Danger',
      social: 'Social spot'
    };
    return labels[type] || String(type).replaceAll('_', ' ');
  };
  const memoryLocations = Array.isArray(creature.memory?.locations)
    ? [...creature.memory.locations]
      .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
      .slice(0, isMobile ? 2 : 3)
    : [];
  const focusMemory = creature.memory?.focus;
  const whyLine = (() => {
    if (focusMemory?.tag) return `Recalling ${memoryTypeLabel(focusMemory)} while ${readableState.toLowerCase()}.`;
    if (hunger > 72) return 'Moving because hunger is high.';
    if (stress > 64) return 'Moving because stress is high.';
    if (goal === 'mate') return 'Looking for a compatible mate.';
    if (goal === 'rest') return 'Conserving energy and seeking safety.';
    if (goal === 'eat') return 'Searching for food using scent and memory.';
    return `Current drive: ${readableState.toLowerCase()}.`;
  })();
  const memoryRowsMarkup = memoryLocations.map(memory => {
    const strength = Math.round((memory.strength ?? 0) * 100);
    const age = Number.isFinite(memory.timestamp) && world?.t != null
      ? `${Math.max(0, Math.round(world.t - memory.timestamp))}s ago`
      : 'recent';
    return `<span><strong>${memoryTypeLabel(memory)}</strong><em>${strength}% · ${age}</em></span>`;
  }).join('');
  const memoryTrailMarkup = `
    <div class="memory-trail">
      <div class="memory-trail-head">
        <span>Why it moved</span>
        <strong>${focusMemory?.tag ? 'Recall' : readableState}</strong>
      </div>
      <div class="memory-reason">${whyLine}</div>
      ${memoryLocations.length ? `
        <div class="memory-list">
          ${memoryRowsMarkup}
        </div>
      ` : '<div class="memory-list empty">No learned places yet.</div>'}
    </div>
  `;

  if (isMobile) {
    el.innerHTML = `
      <div class="headline">
        <span>${headline}</span>
        <span class="status ${statusClass}">${creature.alive ? 'Alive' : 'Dead'}</span>
      </div>
      <div class="subline">${sublineParts.join(' · ')}</div>
      ${nameSuggestion ? `<div class="muted tiny">${nameSuggestion}</div>` : ''}
      ${showQuirks ? `<div class="hint">Quirks: ${quirks.map(q => quirkLabelMap[q] || q).join(', ')}</div>` : quirkHint}
      ${stateTagMarkup}
      <div class="metrics compact">
        <span><span>Stage</span><span>${lifeStage.label}</span></span>
        <span><span>Gen</span><span>${generation ?? '—'}</span></span>
        <span><span>Energy</span><span>${energy}</span></span>
        <span><span>Health</span><span>${health}</span></span>
        <span><span>Speed</span><span>${speed}</span></span>
        <span><span>Social</span><span>${socialDrive}</span></span>
      </div>
      <div class="subline compact-meta">${bonds.label}</div>
      <div class="subline compact-meta">${biome} biome · ${dietLabel} · Family ${familyRootId ?? '—'}</div>
      ${memoryTrailMarkup}
    `;
    return;
  }

  el.innerHTML = `
    <div class="headline">
      <span>${headline}</span>
      <span class="status ${statusClass}">${creature.alive ? 'Alive' : 'Dead'}</span>
    </div>
    <div class="subline">${sublineParts.join(' · ')}</div>
    ${nameSuggestion ? `<div class="muted tiny">${nameSuggestion}</div>` : ''}
    ${quirkLine || ''}
    ${quirkHint}
    ${stateTagMarkup}
    <div class="metrics">
      <span><span>Energy</span><span>${energy}</span></span>
      <span><span>Health</span><span>${health}</span></span>
      <span><span>Stage</span><span>${lifeStage.label}</span></span>
      <span><span>Generation</span><span>${generation ?? '—'}</span></span>
      <span><span>Family</span><span>${familyRootId ?? '—'}</span></span>
      <span><span>Emotion</span><span>${emotion.label}</span></span>
      <span><span>Speed</span><span>${speed}</span></span>
      <span><span>Senses</span><span>${sense}px</span></span>
      <span><span>Strength</span><span>${aggression}</span></span>
      <span><span>Social</span><span>${socialDrive}</span></span>
      <span><span>Curiosity</span><span>${curiosity}</span></span>
      <span><span>Metabolism</span><span>${metabolism}</span></span>
      <span><span>Children</span><span>${creature.stats?.births ?? 0}</span></span>
      <span><span>Aquatic</span><span>${aquatic}</span></span>
      <span><span>Biome</span><span>${biome}</span></span>
    </div>
    <div class="subline compact-meta">${bonds.label}</div>
    ${memoryTrailMarkup}
  `;
}

export function renderInspector(model = {}, handlers = {}) {
  const body = document.getElementById('inspector-body');
  const badgesPanel = document.getElementById('badges-panel');
  const familyPanel = document.getElementById('family-panel');
  const familyContent = document.getElementById('family-content');
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
  const minimizeBtn = document.getElementById('btn-minimize-inspector');

  if (!body || !lineageSummaryEl || !activityFeedEl) return;

  const creature = model.creature ?? null;
  const stats = creature ? model.stats ?? creature.stats : null;
  const worldRef = model.world ?? null;
  const badges = creature ? (model.badges ?? []) : [];
  const activity = creature ? (model.activity ?? []) : [];
  const drawLineageSparkline = (canvas, series = []) => {
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
    body.innerHTML = '<div class="muted">Click a creature to inspect.<br/>Shift-click to set lineage root.</div>';
  } else {
    const parentCell = creature.parentId ? `<button class="btn-link" id="btn-parent">#${creature.parentId}</button>` : '—';
    const sexEmoji = creature.sex === 'male' ? '♂️' : '♀️';
    const sexLabel = creature.sex === 'male' ? 'Male' : 'Female';
    const disorderLabels = (creature.disorders || []).map(d => {
      const disorders = {
        ALBINISM: '🤍 Albinism',
        HEMOPHILIA: '🩸 Hemophilia',
        GIGANTISM: '🦕 Gigantism',
        DWARFISM: '🐁 Dwarfism',
        HYPERMETABOLISM: '⚡ Hypermetabolism'
      };
      return disorders[d] || d;
    }).join(', ') || 'None';

    const mutationBadge = (creature.mutations && creature.mutations.length > 0) ?
      ` <span class="chip" style="font-size:9px;padding:2px 6px;">🧬 ${creature.mutations.length}</span>` : '';

    const memoryLocations = Array.isArray(creature.memory?.locations)
      ? [...creature.memory.locations].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0)).slice(0, 4)
      : [];
    const memoryMarkup = memoryLocations.length
      ? memoryLocations.map(memory => {
        const label = String(memory.type || memory.tag || 'memory').replaceAll('_', ' ');
        const strength = Math.round((memory.strength ?? 0) * 100);
        return `<div class="row"><div>${label}</div><div>${strength}%</div></div>`;
      }).join('')
      : '<div class="muted tiny">No learned places yet.</div>';
    const childMarkup = Array.isArray(creature.children) && creature.children.length
      ? creature.children.slice(0, 6).map(id => `<button class="btn-link family-jump-body" data-id="${id}">#${id}</button>`).join(', ')
      : '—';
    const familyMarkup = `
      <div class="row"><div>Parent</div><div>${parentCell}</div></div>
      <div class="row"><div>Children</div><div>${childMarkup}</div></div>
      <div class="row"><div>Births</div><div>${stats?.births ?? 0}</div></div>
    `;
    const statsMarkup = `
      <div class="row"><div>ID</div><div>#${creature.id}${creature.alive ? '' : ' †'}${mutationBadge}</div></div>
      <div class="row"><div>Sex</div><div>${sexEmoji} ${sexLabel}</div></div>
      <div class="row"><div>Type</div><div><span class="tag">${creature.genes.predator ? 'Predator' : 'Herbivore'}</span></div></div>
      <div class="row"><div>Age</div><div>${creature.age.toFixed(1)}s</div></div>
      <div class="row"><div>Energy</div><div>${creature.energy.toFixed(1)}</div></div>
      <div class="row"><div>Health</div><div>${creature.health.toFixed(1)} / ${creature.maxHealth.toFixed(0)}</div></div>
      ${(creature.disorders && creature.disorders.length > 0) ? `<div class="row"><div>Disorders</div><div style="color:#ff6b6b;">${disorderLabels}</div></div>` : ''}
      <div class="row"><div>Food eaten</div><div>${stats?.food ?? 0}</div></div>
      <div class="row"><div>Kills</div><div>${stats?.kills ?? 0}</div></div>
      <div class="row"><div>Damage</div><div>${(stats?.damageDealt ?? 0).toFixed(1)} / ${(stats?.damageTaken ?? 0).toFixed(1)}</div></div>
    `;
    const genesMarkup = `
      <div class="row"><div>Speed</div><div>${creature.genes.speed.toFixed(2)}</div></div>
      <div class="row"><div>FOV</div><div>${creature.genes.fov.toFixed(0)}°</div></div>
      <div class="row"><div>Sense</div><div>${creature.genes.sense.toFixed(0)}px</div></div>
      <div class="row"><div>Metabolism</div><div>${creature.genes.metabolism.toFixed(2)}</div></div>
      <div class="row"><div>Hue</div><div>${creature.genes.hue}</div></div>
      <div class="row"><div>Spines</div><div>${((creature.genes.spines ?? 0) * 100).toFixed(0)}%</div></div>
      <div class="row"><div>Herd</div><div>${((creature.genes.herdInstinct ?? 0) * 100).toFixed(0)}%</div></div>
      <div class="row"><div>Panic</div><div>${((creature.genes.panicPheromone ?? 0) * 100).toFixed(0)}%</div></div>
      <div class="row"><div>Grit</div><div>${((creature.genes.grit ?? 0) * 100).toFixed(0)}%</div></div>
      ${creature.genes.predator ? `
        <div class="row"><div>Pack</div><div>${(creature.genes.packInstinct * 100).toFixed(0)}%</div></div>
        <div class="row"><div>Ambush</div><div>${creature.genes.ambushDelay.toFixed(1)}s</div></div>
        <div class="row"><div>Aggression</div><div>${creature.genes.aggression.toFixed(2)}</div></div>
      ` : ''}
    `;

    body.innerHTML = `
      <div class="inspector-tabs" role="tablist" aria-label="Inspector sections">
        <button class="inspector-tab" data-tab="stats" role="tab">Stats</button>
        <button class="inspector-tab" data-tab="memory" role="tab">Memory</button>
        <button class="inspector-tab" data-tab="family" role="tab">Family</button>
        <button class="inspector-tab" data-tab="genes" role="tab">Genes</button>
      </div>
      <div class="inspector-tab-panel" data-tab-panel="stats">${statsMarkup}</div>
      <div class="inspector-tab-panel" data-tab-panel="memory">${memoryMarkup}</div>
      <div class="inspector-tab-panel" data-tab-panel="family">${familyMarkup}</div>
      <div class="inspector-tab-panel" data-tab-panel="genes">${genesMarkup}</div>
    `;
    const showInspectorTab = (tab) => {
      inspectorActiveTab = tab;
      body.querySelectorAll('.inspector-tab').forEach(button => {
        const active = button.dataset.tab === tab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      body.querySelectorAll('.inspector-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.tabPanel === tab);
      });
    };
    body.querySelectorAll('.inspector-tab').forEach(button => {
      button.onclick = () => showInspectorTab(button.dataset.tab || 'stats');
    });
    showInspectorTab(inspectorActiveTab);
    body.querySelectorAll('.family-jump-body').forEach(btn => {
      btn.onclick = () => handlers.onInspectId?.(Number(btn.dataset.id));
    });
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

  if (minimizeBtn) {
    minimizeBtn.onclick = handlers.onMinimize ?? null;
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
        <div class="badge-list">${badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>
      `;
    } else {
      badgesPanel.classList.add('hidden');
      badgesPanel.innerHTML = '';
    }
  }

  if (familyPanel && familyContent) {
    if (creature) {
      const parentIds = Array.isArray(creature.parents) && creature.parents.length
        ? creature.parents
        : (creature.parentId ? [creature.parentId] : []);
      const parentMarkup = parentIds.length
        ? parentIds.map(id => {
          const parent = worldRef?.getAnyCreatureById?.(id);
          const alive = parent ? parent.alive !== false : false;
          const label = alive ? `#${id}` : `#${id}✝`;
          return `<button class="btn-link family-jump ${alive ? '' : 'muted'}" data-id="${id}">${label}</button>`;
        }).join(', ')
        : '<span class="muted">Unknown</span>';

      const childIds = Array.isArray(creature.children) ? creature.children : [];
      let childrenMarkup;
      if (!childIds.length) {
        childrenMarkup = '<span class="muted">None</span>';
      } else {
        const entries = childIds.slice(0, 6).map(id => {
          const child = worldRef?.getAnyCreatureById?.(id);
          const alive = child ? child.alive !== false : false;
          const label = alive ? `#${id}` : `#${id}✝`;
          return `<button class="btn-link family-jump ${alive ? '' : 'muted'}" data-id="${id}">${label}</button>`;
        }).join(', ');
        const extra = childIds.length > 6 ? `<span class="muted"> +${childIds.length - 6} more</span>` : '';
        childrenMarkup = `${entries}${extra}`;
      }

      familyContent.innerHTML = `
        <div><strong>Parents:</strong> ${parentMarkup}</div>
        <div><strong>Children:</strong> ${childrenMarkup}</div>
      `;
      familyPanel.classList.remove('hidden');
      familyContent.querySelectorAll('.family-jump').forEach(btn => {
        btn.onclick = () => handlers.onInspectId?.(Number(btn.dataset.id));
      });
    } else {
      familyPanel.classList.add('hidden');
      familyContent.innerHTML = 'No family data.';
    }
  }

  if (lineageSummaryEl) {
    if (!model.lineageRootId) {
      const ancestorStr = creature && model.ancestors && model.ancestors.length
        ? `Ancestors: ${model.ancestors.map(a => formatId(a)).join(' ← ')}`
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
          html += `<div class="muted" style="margin-top:6px;">Ancestors: ${model.ancestors.map(a => formatId(a)).join(' ← ')}</div>`;
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
    Object.values(ctxMap).forEach(ctx => ctx && ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height));
    return;
  }

  drawChart(ctxMap.pop, [
    { series: data.population, color: '#7fd36a', label: 'Pop', decimals: 0 },
    { series: data.predators, color: '#f37f7f', label: 'Pred', decimals: 0 }
  ], { min: 0 });

  drawChart(ctxMap.speed, [
    { series: data.meanSpeed, color: '#76a9ff', label: 'Speed', decimals: 2 }
  ]);

  drawChart(ctxMap.metabolism, [
    { series: data.meanMetabolism, color: '#ffbd7a', label: 'Metab', decimals: 2 }
  ]);

  drawChart(ctxMap.variance, [
    { series: data.speedVar, color: '#8df0ff', label: 'Speed σ²', decimals: 3 },
    { series: data.senseVar, color: '#d496ff', label: 'Sense σ²', decimals: 3 }
  ], { min: 0 });

  drawChart(ctxMap.ratio, [
    { series: data.predatorRatio, color: '#ff8888', label: 'Pred %', decimals: 2 }
  ], { min: 0, max: 1 });

  drawChart(ctxMap.predators, [
    { series: data.meanPackInstinct, color: '#5bdadf', label: 'Pack', decimals: 2 },
    { series: data.meanAggression, color: '#ff9f6d', label: 'Agg', decimals: 2 },
    { series: data.meanAmbushDelay, color: '#d5b4ff', label: 'Amb', decimals: 2 }
  ]);

  drawChart(ctxMap.health, [
    { series: data.meanHealth, color: '#7fe07f', label: 'HP', decimals: 1 },
    { series: data.meanMaxHealth, color: '#a3b0ff', label: 'HPmax', decimals: 1 }
  ], { min: 0 });
}

function drawChart(ctx, lines, { min = null, max = null } = {}) {
  if (!ctx || !lines || !lines.length) return;
  const len = lines[0].series.length;
  if (len < 2) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  // Guard against hidden canvases (0x0 dimensions)
  if (w <= 0 || h <= 0) return;
  const pad = 6;

  // OPTIMIZATION: Single clear/fill operation
  ctx.fillStyle = '#11131d';
  ctx.fillRect(0, 0, w, h);

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

  // OPTIMIZATION: Draw baseline once
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  // OPTIMIZATION: Cache calculations and use for loops
  const xStep = (w - pad * 2) / (len - 1);
  const yScale = (h - pad * 2) / range;

  ctx.lineWidth = 1.4;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    ctx.strokeStyle = line.color;
    ctx.beginPath();

    // Use for loop for better performance
    for (let j = 0; j < len; j++) {
      const value = line.series[j];
      const x = pad + j * xStep;
      const y = h - pad - ((value - minVal) * yScale);
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // OPTIMIZATION: Batch text rendering
  ctx.font = '11px system-ui, sans-serif';
  let textY = pad + 10;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const last = line.series[len - 1];
    ctx.fillStyle = line.color;
    ctx.fillText(`${line.label ?? ''} ${formatNumber(last, line.decimals ?? 1)}`, pad, textY);
    textY += 12;
  }
}

function formatNumber(value, decimals = 1) {
  return Number.parseFloat(value).toFixed(decimals);
}

function formatId(creature) {
  if (!creature) return '—';
  const marker = creature.alive ? '' : '†';
  return `<button class="btn-link lineage-jump" data-id="${creature.id}">#${creature.id}${marker}</button>`;
}
