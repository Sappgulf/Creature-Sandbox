/**
 * snapshot-tools.js
 *
 * Pure data helpers for capturing, serializing, and diffing lightweight
 * snapshots of a World. Snapshots capture population stats, top creatures,
 * root lineages, camera position, and time/season/weather metadata so that
 * developers can compare two points in time without storing the entire
 * save data.
 *
 * The functions here are intentionally side-effect free: `takeSnapshot`
 * reads from the world, `diffSnapshots` operates on two snapshot objects,
 * and the serialize/parse helpers do JSON round-trips. Storage and
 * retrieval of named snapshots is the responsibility of the caller
 * (the DebugConsole holds a Map keyed by name).
 */

/**
 * @typedef {Object} CreatureSummary
 * @property {number} id
 * @property {boolean} alive
 * @property {number} age
 * @property {number} energy
 * @property {number} health
 * @property {boolean} predator
 * @property {string} [name]
 */

/**
 * @typedef {Object} LineageSummary
 * @property {number} id
 * @property {string} [name]
 * @property {number} aliveCount
 * @property {number} totalCount
 */

/**
 * @typedef {Object} PopulationStats
 * @property {number} total
 * @property {number} alive
 * @property {number} dead
 * @property {number} predators
 * @property {number} herbivores
 * @property {number} food
 * @property {number} corpses
 * @property {number} births
 * @property {number} deaths
 * @property {number} kills
 */

/**
 * @typedef {Object} WorldMetadata
 * @property {number} t
 * @property {string} [season]
 * @property {number} [seasonIndex]
 * @property {number} [seasonPhase]
 * @property {string} [weatherType]
 * @property {number} [weatherIntensity]
 * @property {number} [timeOfDay]
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} CameraSnapshot
 * @property {number} x
 * @property {number} y
 * @property {number} zoom
 * @property {string} [followMode]
 */

/**
 * @typedef {Object} Snapshot
 * @property {string} schema
 * @property {number} timestamp
 * @property {WorldMetadata} world
 * @property {PopulationStats} population
 * @property {CreatureSummary[]} topCreatures
 * @property {LineageSummary[]} lineages
 * @property {CameraSnapshot} [camera]
 */

const SNAPSHOT_SCHEMA = 'creature-sandbox-snapshot-1';

const DEFAULT_TOP_N = 5;
const DEFAULT_LINEAGE_N = 20;

/**
 * Read a numeric value from an object, falling back to a default.
 * @param {Object} obj
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function num(obj, key, fallback) {
  if (!obj) return fallback;
  const value = obj[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Collect basic population statistics from a world.
 * @param {Object} world
 * @returns {PopulationStats}
 */
function collectPopulationStats(world) {
  const creatures = Array.isArray(world?.creatures) ? world.creatures : [];
  const food = Array.isArray(world?.food) ? world.food : [];
  const corpses = Array.isArray(world?.corpses) ? world.corpses : [];

  let alive = 0;
  let dead = 0;
  let predators = 0;
  let herbivores = 0;
  let births = 0;
  let deaths = 0;
  let kills = 0;

  for (const c of creatures) {
    if (!c) continue;
    if (c.alive) alive++;
    else dead++;
    if (c.genes?.predator) predators++;
    else herbivores++;
    if (c.stats) {
      births += num(c.stats, 'births', 0);
      deaths += num(c.stats, 'deaths', 0);
      kills += num(c.stats, 'kills', 0);
    }
  }

  return {
    total: creatures.length,
    alive,
    dead,
    predators,
    herbivores,
    food: food.length,
    corpses: corpses.length,
    births,
    deaths,
    kills
  };
}

/**
 * Build a minimal summary of a creature for a snapshot.
 * @param {Object} c
 * @returns {CreatureSummary}
 */
function summarizeCreature(c) {
  if (!c) return null;
  return {
    id: c.id,
    alive: c.alive !== false,
    age: num(c, 'age', 0),
    energy: num(c, 'energy', 0),
    health: num(c, 'health', 0),
    predator: !!(c.genes?.predator || c.predator),
    name: typeof c.nameSuggestion === 'string' ? c.nameSuggestion : undefined
  };
}

/**
 * Return the top N creatures by a chosen metric (energy by default).
 * @param {Object} world
 * @param {number} n
 * @returns {CreatureSummary[]}
 */
function topCreaturesByEnergy(world, n = DEFAULT_TOP_N) {
  const creatures = Array.isArray(world?.creatures) ? world.creatures : [];
  const ranked = creatures
    .filter(c => c && c.alive)
    .map(c => ({ c, score: num(c, 'energy', 0) + num(c, 'age', 0) * 0.001 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(item => summarizeCreature(item.c))
    .filter(Boolean);
  return ranked;
}

/**
 * Aggregate root lineage info from the world's lineage tracker or by walking
 * the childrenOf map. Falls back to a minimal set if no tracker is available.
 * @param {Object} world
 * @param {number} maxRoots
 * @returns {LineageSummary[]}
 */
function collectLineages(world, maxRoots = DEFAULT_LINEAGE_N) {
  const childrenOf = world?.childrenOf instanceof Map ? world.childrenOf : world?.creatureManager?.childrenOf;
  if (!childrenOf) return [];

  const registry = world?.creatureManager?.registry instanceof Map ? world.creatureManager.registry : null;

  // Build a parentId map so we can find root ids.
  const parentById = new Map();
  const rootsById = new Map();
  if (registry) {
    for (const creature of registry.values()) {
      if (!creature) continue;
      if (creature.parentId != null) {
        parentById.set(creature.id, creature.parentId);
      } else {
        rootsById.set(creature.id, creature);
      }
    }
  } else {
    for (const creature of world.creatures || []) {
      if (!creature) continue;
      if (creature.parentId != null) {
        parentById.set(creature.id, creature.parentId);
      } else {
        rootsById.set(creature.id, creature);
      }
    }
  }

  // Resolve root id for every known id.
  const rootIdFor = new Map();
  const resolveRoot = id => {
    if (rootIdFor.has(id)) return rootIdFor.get(id);
    let current = id;
    const seen = new Set();
    while (parentById.has(current) && !seen.has(current)) {
      seen.add(current);
      current = parentById.get(current);
    }
    rootIdFor.set(id, current);
    return current;
  };

  // Tally alive counts per root.
  const aliveByRoot = new Map();
  const totalByRoot = new Map();
  for (const id of registry ? registry.keys() : parentById.keys()) {
    const rootId = resolveRoot(id);
    totalByRoot.set(rootId, (totalByRoot.get(rootId) || 0) + 1);
  }
  for (const creature of registry ? registry.values() : world.creatures || []) {
    if (!creature) continue;
    const rootId = resolveRoot(creature.id);
    if (creature.alive) {
      aliveByRoot.set(rootId, (aliveByRoot.get(rootId) || 0) + 1);
    }
  }
  // Make sure root creatures themselves are counted.
  for (const rootId of rootsById.keys()) {
    totalByRoot.set(rootId, (totalByRoot.get(rootId) || 0) + 1);
    const rootCreature = rootsById.get(rootId);
    if (rootCreature && rootCreature.alive) {
      aliveByRoot.set(rootId, (aliveByRoot.get(rootId) || 0) + 1);
    }
  }

  const tracker = world?.lineageTracker;
  const lineages = [];
  for (const [rootId, totalCount] of totalByRoot.entries()) {
    const name = tracker?.names?.get?.(rootId) || tracker?.ensureName?.(rootId);
    lineages.push({
      id: rootId,
      name: typeof name === 'string' ? name : undefined,
      aliveCount: aliveByRoot.get(rootId) || 0,
      totalCount
    });
  }

  lineages.sort((a, b) => b.totalCount - a.totalCount);
  return lineages.slice(0, maxRoots);
}

/**
 * Capture a snapshot of a world's state.
 * @param {Object} world - The world to snapshot.
 * @param {Object} [camera] - Optional camera object.
 * @param {Object} [options]
 * @param {number} [options.topN=5] - How many top creatures to include.
 * @param {number} [options.maxLineages=20] - How many lineages to include.
 * @returns {Snapshot}
 */
export function takeSnapshot(world, camera, options = {}) {
  const topN = Number.isFinite(options?.topN) ? options.topN : DEFAULT_TOP_N;
  const maxLineages = Number.isFinite(options?.maxLineages) ? options.maxLineages : DEFAULT_LINEAGE_N;
  const env = world?.environment;

  const worldMeta = {
    t: num(world, 't', 0),
    season: env?.currentSeason,
    seasonIndex: env?.seasonIndex,
    seasonPhase: env?.seasonPhase,
    weatherType: env?.weatherType,
    weatherIntensity: env?.weatherIntensity,
    timeOfDay: env?.timeOfDay,
    width: num(world, 'width', 0),
    height: num(world, 'height', 0)
  };

  return {
    schema: SNAPSHOT_SCHEMA,
    timestamp: Date.now(),
    world: worldMeta,
    population: collectPopulationStats(world),
    topCreatures: topCreaturesByEnergy(world, topN),
    lineages: collectLineages(world, maxLineages),
    camera: camera
      ? {
          x: num(camera, 'x', 0),
          y: num(camera, 'y', 0),
          zoom: num(camera, 'zoom', 1),
          followMode: typeof camera.followMode === 'string' ? camera.followMode : undefined
        }
      : undefined
  };
}

/**
 * Compare two snapshots and return a structured diff.
 * @param {Snapshot} a - Earlier snapshot.
 * @param {Snapshot} b - Later snapshot.
 * @returns {Object} Diff result.
 */
export function diffSnapshots(a, b) {
  const empty = {
    populationDelta: {},
    newlyDead: [],
    newlyBorn: [],
    lineageChanges: [],
    timeDelta: 0,
    error: null
  };
  if (!a || !b) {
    return { ...empty, error: !a ? 'missing first snapshot' : 'missing second snapshot' };
  }

  const popA = a.population || {};
  const popB = b.population || {};
  const populationDelta = {};
  const keys = new Set([...Object.keys(popA), ...Object.keys(popB)]);
  for (const key of keys) {
    const av = typeof popA[key] === 'number' ? popA[key] : 0;
    const bv = typeof popB[key] === 'number' ? popB[key] : 0;
    populationDelta[key] = bv - av;
  }

  // newlyDead: creatures in a that were alive but absent (or dead) in b
  const topA = new Map((a.topCreatures || []).map(c => [c.id, c]));
  const topB = new Map((b.topCreatures || []).map(c => [c.id, c]));
  const allInA = new Map(topA);
  const allInB = new Map(topB);
  // We don't have full creature lists in snapshots, so use the topCreatures
  // lists as the visible subset. Newly dead is "alive in A and (missing in B
  // or dead in B)".
  const newlyDead = [];
  for (const [id, c] of allInA.entries()) {
    const other = allInB.get(id);
    if (c.alive && (!other || !other.alive)) {
      newlyDead.push(c);
    }
  }
  // newlyBorn: creatures in b that are not in a
  const newlyBorn = [];
  for (const [id, c] of allInB.entries()) {
    if (!allInA.has(id)) {
      newlyBorn.push(c);
    }
  }

  // Lineage changes: compare alive counts for shared roots.
  const lineagesA = new Map((a.lineages || []).map(l => [l.id, l]));
  const lineagesB = new Map((b.lineages || []).map(l => [l.id, l]));
  const lineageChanges = [];
  for (const [id, lineageB] of lineagesB.entries()) {
    const lineageA = lineagesA.get(id);
    if (!lineageA) {
      lineageChanges.push({
        id,
        name: lineageB.name,
        aliveBefore: 0,
        aliveAfter: lineageB.aliveCount,
        delta: lineageB.aliveCount
      });
      continue;
    }
    if (lineageA.aliveCount !== lineageB.aliveCount) {
      lineageChanges.push({
        id,
        name: lineageB.name || lineageA.name,
        aliveBefore: lineageA.aliveCount,
        aliveAfter: lineageB.aliveCount,
        delta: lineageB.aliveCount - lineageA.aliveCount
      });
    }
  }

  return {
    populationDelta,
    newlyDead,
    newlyBorn,
    lineageChanges,
    timeDelta: (b.world?.t ?? 0) - (a.world?.t ?? 0),
    error: null
  };
}

/**
 * Serialize a snapshot to a JSON string. Always returns valid JSON.
 * @param {Snapshot} snapshot
 * @returns {string}
 */
export function serializeSnapshot(snapshot) {
  if (!snapshot) {
    return JSON.stringify({ schema: SNAPSHOT_SCHEMA, empty: true });
  }
  return JSON.stringify(snapshot);
}

/**
 * Parse a JSON string back into a snapshot. Returns null on parse failure.
 * @param {string} json
 * @returns {Snapshot|null}
 */
export function parseSnapshot(json) {
  if (typeof json !== 'string' || json.length === 0) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schema !== SNAPSHOT_SCHEMA && parsed.schema !== undefined) {
      // Accept the empty marker and the canonical schema; reject anything else.
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const SNAPSHOT_SCHEMA_VERSION = SNAPSHOT_SCHEMA;
