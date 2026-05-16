function roundNumber(value, digits = 0, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Number(number.toFixed(digits));
}

function getDietRole(creature) {
  const diet = creature?.genes?.diet ?? (creature?.genes?.predator ? 1 : 0);
  if (creature?.traits?.dietRole === 'scavenger') return 'scavenger';
  if (creature?.traits?.dietRole === 'predator-lite') return 'predator-lite';
  if (creature?.genes?.predator || diet >= 0.7) return 'predator';
  if (diet >= 0.3) return 'omnivore';
  return 'herbivore';
}

function readableGoal(value) {
  if (!value) return null;
  return String(value).replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function describeSelectedCreature(creature, presentation = null) {
  if (!creature) return null;
  const label = presentation?.nickname || creature.nameSuggestion || `Creature ${creature.id}`;
  const goal = readableGoal(creature.goal?.current || creature.currentGoal || creature.state);
  const hunger = roundNumber(creature.needs?.hunger, 0);
  const stress = roundNumber(creature.needs?.stress ?? creature.ecosystem?.stress, 0);
  const energy = roundNumber(creature.energy, 0);
  const role = getDietRole(creature);
  const status = creature.alive === false
    ? 'gone'
    : (hunger >= 72 ? 'hungry' : stress >= 64 ? 'stressed' : energy <= 16 ? 'low energy' : goal || 'steady');

  return {
    id: creature.id,
    label,
    role,
    status,
    hunger,
    stress,
    energy,
    text: `${label} is a ${role} and is ${status}.`
  };
}

function describeRun(playableSnapshot = null) {
  const scenario = playableSnapshot?.scenario || playableSnapshot?.activeRun?.scenario || null;
  if (!scenario) return null;
  const progress = Number(playableSnapshot?.progress ?? playableSnapshot?.activeRun?.progress);
  const progressText = Number.isFinite(progress) ? `${roundNumber(progress, 0)} percent` : 'in progress';
  return {
    id: scenario.id ?? null,
    name: scenario.name || scenario.id || 'active run',
    progress: Number.isFinite(progress) ? roundNumber(progress, 0) : null,
    state: playableSnapshot?.state || playableSnapshot?.activeRun?.state || null,
    text: `${scenario.name || scenario.id || 'Run'} is ${progressText}.`
  };
}

function describeDirector(directorSnapshot = null) {
  const headline = directorSnapshot?.headline ||
    directorSnapshot?.title ||
    directorSnapshot?.guidance?.title ||
    directorSnapshot?.currentObjective?.label ||
    directorSnapshot?.nextAction?.label ||
    null;
  const body = directorSnapshot?.body ||
    directorSnapshot?.guidance?.body ||
    directorSnapshot?.nextAction?.description ||
    null;
  if (!headline && !body) return null;
  return {
    headline,
    body,
    text: [headline, body].filter(Boolean).join('. ')
  };
}

function describeLatestMoment(momentsSnapshot = null) {
  const latest = momentsSnapshot?.latest || momentsSnapshot?.moments?.[0] || null;
  if (!latest) return null;
  const title = latest.title || latest.type || latest.kind || 'Recent moment';
  const message = latest.message || latest.description || '';
  return {
    title,
    message,
    text: [title, message].filter(Boolean).join(': ')
  };
}

export function buildAccessibilitySummary({
  world,
  gameState,
  camera,
  focusCreature = null,
  focusPresentation = null,
  playableSnapshot = null,
  directorSnapshot = null,
  momentsSnapshot = null,
  profileSnapshot = null
} = {}) {
  const creatures = Array.isArray(world?.creatures) ? world.creatures.filter(creature => creature?.alive !== false) : [];
  const counts = creatures.reduce((acc, creature) => {
    const role = getDietRole(creature);
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  const foodCount = Array.isArray(world?.food) ? world.food.length : 0;
  const worldTime = roundNumber(world?.t, 0);
  const selected = describeSelectedCreature(focusCreature, focusPresentation);
  const run = describeRun(playableSnapshot);
  const director = describeDirector(directorSnapshot);
  const latestMoment = describeLatestMoment(momentsSnapshot);
  const warnings = [];

  if (creatures.length > 0 && foodCount < creatures.length * 1.5) {
    warnings.push('Food is running low near the current population.');
  }
  if (counts.predator > counts.herbivore && counts.predator > 3) {
    warnings.push('Predators outnumber herbivores.');
  }

  const cameraText = camera
    ? `Camera at ${roundNumber(camera.x)} by ${roundNumber(camera.y)}, zoom ${roundNumber(camera.zoom, 2, 1)}.`
    : null;
  const parts = [
    `World time ${worldTime} seconds.`,
    `${creatures.length} active creatures: ${counts.herbivore || 0} herbivores, ${counts.omnivore || 0} omnivores, ${counts.predator || 0} predators, ${counts.scavenger || 0} scavengers, and ${counts['predator-lite'] || 0} predator-lite.`,
    `${foodCount} food patches are available.`,
    gameState?.paused ? 'Simulation is paused.' : 'Simulation is running.',
    run?.text,
    selected?.text,
    director?.text ? `Next focus: ${director.text}` : null,
    latestMoment?.text ? `Latest moment: ${latestMoment.text}` : null,
    warnings.length ? warnings.join(' ') : null,
    cameraText
  ].filter(Boolean);

  return {
    text: parts.join(' '),
    counts: {
      totalCreatures: creatures.length,
      totalFood: foodCount,
      roles: counts,
      worldTime
    },
    selected,
    run,
    director,
    latestMoment,
    warnings,
    camera: camera ? {
      x: roundNumber(camera.x, 1),
      y: roundNumber(camera.y, 1),
      zoom: roundNumber(camera.zoom, 2, 1)
    } : null,
    profile: profileSnapshot ? {
      scope: profileSnapshot.scope,
      worldSavesIncludeProfile: profileSnapshot.relationship?.worldSavesIncludeProfile ?? false
    } : null
  };
}
