/**
 * Simulation Worker - Enhanced version with binary state transfer
 */

console.debug('👷 Worker: Simulation script loaded');

self.onerror = function (message, source, lineno, colno, error) {
  console.error('👷 Worker Global Error:', message, error);
  self.postMessage({
    type: 'ERROR',
    data: { message, stack: error?.stack }
  });
};

import { World } from './world-core.js';
import { Creature } from './creature.js';
import { makeGenes } from './genetics.js';
import { BiomeGenerator } from './perlin-noise.js';
import { SaveSystem } from './save-system.js';
import { getCurrentSaveVersion } from './save-migration.js';
import { packCreature, createCreatureBuffer, compactCreature } from './simulation-state.js';
import { eventSystem } from './event-system.js';
import { fillSnapshotPool } from './snapshot-pool.js';

const saveSystem = new SaveSystem();

let world = null;
const _lastTime = performance.now();
let isPaused = false;
let timeScale = 1.0;

// Reused per-tick snapshot buffers. sendSnapshot() runs every tick, and the
// naive `.map()` allocated a brand-new array plus one new object per food
// item and per corpse every single frame. postMessage's structured clone
// still copies the data at call time either way, but reusing these objects
// across ticks (rather than allocating fresh ones) removes that GC churn.
// Safe because postMessage clones synchronously before this function is
// called again, so mutating the pooled objects on the next tick can never
// race with an in-flight clone.
let _foodSnapshotPool = [];
let _corpseSnapshotPool = [];

// Internal event bridging
const BRIDGE_EVENTS = [
  'creature:born',
  'creature:died',
  'world:disaster_start',
  'ui:notification',
  'achievement:unlocked'
];

function sanitizeBridgePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload ?? null;
  const output = Array.isArray(payload) ? [] : {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'function') continue;
    if (key === 'creature' || key === 'parent' || key === 'child' || key === 'attacker' || key === 'target') {
      output[key] = compactCreature(value);
      continue;
    }
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) {
      output[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value
        .slice(0, 16)
        .map(item => (typeof item === 'object' ? compactCreature(item) : item))
        .filter(item => typeof item !== 'function');
      continue;
    }
    try {
      output[key] = structuredClone(value);
    } catch {
      output[key] = compactCreature(value);
    }
  }
  return output;
}

self.onmessage = function (e) {
  try {
    const { type, data } = e.data;
    // console.debug('👷 Worker received:', type);

    switch (type) {
      case 'INIT':
        world = new World(data.width, data.height);
        // Bridge events back to main thread
        BRIDGE_EVENTS.forEach(evType => {
          eventSystem.on(evType, payload => {
            self.postMessage({ type: 'EVENT', eventType: evType, data: sanitizeBridgePayload(payload) });
          });
        });
        self.postMessage({ type: 'READY' });
        break;

      case 'SEED':
        if (world) {
          world.seed(data.nHerb, data.nPred, data.nFood);
          sendDecorations();
          sendSnapshot();
        }
        break;

      case 'SPAWN_MANUAL':
        if (world) {
          world.spawnManual(data.x, data.y, data.predator);
          sendSnapshot();
        }
        break;

      case 'SPAWN_GENES':
        if (world) {
          world.spawnManualWithGenes(data.x, data.y, data.genes);
          sendSnapshot();
        }
        break;

      case 'SPAWN_TYPE':
        if (world) {
          world.spawnCreatureType(data.type, data.x, data.y);
          sendSnapshot();
        }
        break;

      case 'KILL_CREATURE':
        if (world) {
          const c = world.getCreatureById(data.id);
          if (c) {
            c.alive = false;
            world.creatureManager.removeCreature(c);
            sendSnapshot();
          }
        }
        break;

      case 'ADD_FOOD':
        if (world) {
          world.addFood(data.x, data.y, data.r, data.type);
          sendSnapshot(); // Update food list immediately
        }
        break;

      case 'REMOVE_FOOD':
        if (world) {
          // Find food by ID (or approximate location if ID not shared?)
          // world.food is array.
          // Snapshot sends {id, ...}.
          // We assume data.id is passed.
          const f = world.food.find(item => item.id === data.id);
          if (f) {
            const idx = world.food.indexOf(f);
            if (idx !== -1) {
              world.food.splice(idx, 1);
              world.foodGrid.remove(f);
              sendSnapshot();
            }
          }
        }
        break;

      case 'TRIGGER_DISASTER':
        if (world) {
          world.triggerDisaster(data.type, data.options);
          sendSnapshot();
        }
        break;

      case 'CANCEL_DISASTER':
        if (world) {
          world.cancelDisaster?.();
          sendSnapshot();
        }
        break;

      case 'CANCEL_PENDING_DISASTER':
        if (world) {
          world.cancelPendingDisaster?.(data.id);
          sendSnapshot();
        }
        break;

      case 'CLEAR_PENDING_DISASTERS':
        if (world) {
          world.clearPendingDisasters?.();
          sendSnapshot();
        }
        break;

      case 'ADD_CALM_ZONE':
        if (world) {
          world.addCalmZone(data.x, data.y, data.radius, data.duration, data.strength);
          sendSnapshot();
        }
        break;

      case 'ADD_REST_ZONE':
        if (world) {
          world.addRestZone(data.x, data.y, data.radius);
          sendSnapshot();
        }
        break;

      case 'TRIGGER_CHAOS_NUDGE':
        if (world) {
          world.triggerChaosNudge(data.intensity, data.duration);
          world.environment?.triggerWindBurst?.(data.intensity, data.duration);
          sendSnapshot();
        }
        break;

      case 'PAUSE':
        isPaused = data.paused;
        break;

      case 'SET_TIME_SCALE':
        timeScale = data.scale;
        break;

      case 'IMPORT_STATE':
        if (world && data?.saveWorld) {
          saveSystem.deserialize(
            { version: data.version || getCurrentSaveVersion(), world: data.saveWorld },
            World,
            Creature,
            null,
            makeGenes,
            BiomeGenerator,
            world
          );
          // A loaded save rebuilds the world's biome layout, so its decorations
          // are new too.
          sendDecorations();
          sendSnapshot();
        }
        break;

      case 'RESET':
        if (world) {
          world.reset();
          sendDecorations();
          sendSnapshot();
        }
        break;

      case 'REQUEST_WORLD_EXTRAS':
        // Fields save-system.js's serialize() needs that aren't part of the
        // regular per-tick STATE_UPDATE snapshot — SimulationProxy has no
        // way to answer world.nests/restZones/sandbox/childrenOf/_nextId
        // without this round trip, which previously meant every worker-mode
        // save silently dropped them (and reset creature IDs on load).
        if (world) {
          const childrenOfMap = world.childrenOf instanceof Map ? world.childrenOf : new Map();
          self.postMessage({
            type: 'WORLD_EXTRAS',
            data: {
              _nextId: world.creatureManager?._nextId ?? world._nextId ?? 1,
              biomeSeed: world.biomeGenerator ? world.biomeGenerator.seed : null,
              chaosBaseLevel: world.chaosBaseLevel ?? 0.5,
              restZones: (world.restZones || []).map(z => ({ id: z.id, x: z.x, y: z.y, radius: z.radius })),
              nests: (world.nests || []).map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                radius: n.radius,
                capacity: n.capacity,
                comfort: n.comfort,
                createdAt: n.createdAt ?? 0,
                createdBy: n.createdBy ?? null
              })),
              sandboxProps: world.sandbox?.serialize?.() ?? [],
              childrenOf: Array.from(childrenOfMap.entries()).map(([parentId, childIds]) => ({
                parentId,
                childIds: Array.from(childIds)
              })),
              // Save-fidelity fields that serialize() needs but the per-tick
              // binary snapshot drops (sendSnapshot packs a fixed 21-float
              // layout: no parentId/maxHealth, partial genes, minimal food and
              // environment). Sent on demand (save only) so the hot per-tick
              // path keeps its layout; SimulationProxy merges these back into
              // the snapshot before serialize reads it.
              creatureExtras: (world.creatures || []).map(c => ({
                id: c.id,
                parentId: c.parentId ?? null,
                maxHealth: c.maxHealth ?? null,
                genes: { ...(c.genes || {}) },
                personality: c.personality
                  ? {
                      packInstinct: c.personality.packInstinct ?? null,
                      ambushDelay: c.personality.ambushDelay ?? null,
                      aggression: c.personality.aggression ?? null,
                      ambushTimer: c.personality.ambushTimer ?? null,
                      huntCooldown: c.personality.huntCooldown ?? null,
                      lastSignalAt: c.personality.lastSignalAt ?? null,
                      currentTargetId: c.personality.currentTargetId ?? null,
                      attackCooldown: c.personality.attackCooldown ?? null,
                      idleTempo: c.personality.idleTempo ?? null,
                      idleSway: c.personality.idleSway ?? null,
                      reactivity: c.personality.reactivity ?? null,
                      playfulness: c.personality.playfulness ?? null
                    }
                  : null,
                temperament: c.temperament
                  ? {
                      boldness: c.temperament.boldness ?? null,
                      sociability: c.temperament.sociability ?? null,
                      calmness: c.temperament.calmness ?? null,
                      curiosity: c.temperament.curiosity ?? null
                    }
                  : null,
                quirks: Array.isArray(c.quirks) ? c.quirks.filter(q => typeof q === 'string').slice(0, 4) : [],
                stats: c.stats ? { ...c.stats } : null,
                traits: c.traits
                  ? {
                      bounce: c.traits.bounce ?? null,
                      temperament: c.traits.temperament ?? null,
                      dietRole: c.traits.dietRole ?? null
                    }
                  : null,
                needs: c.needs
                  ? {
                      hunger: c.needs.hunger ?? null,
                      energy: c.needs.energy ?? null,
                      socialDrive: c.needs.socialDrive ?? null,
                      stress: c.needs.stress ?? null,
                      lastEatAt: c.needs.lastEatAt ?? null
                    }
                  : null,
                goal: c.goal
                  ? {
                      current: c.goal.current ?? null,
                      lastChange: c.goal.lastChange ?? null,
                      cooldown: c.goal.cooldown ?? null,
                      mateCooldown: c.goal.mateCooldown ?? null
                    }
                  : null,
                ecosystem: c.ecosystem
                  ? {
                      stress: c.ecosystem.stress ?? null,
                      energy: c.ecosystem.energy ?? null,
                      curiosity: c.ecosystem.curiosity ?? null,
                      stability: c.ecosystem.stability ?? null,
                      state: typeof c.ecosystem.state === 'string' ? c.ecosystem.state : null
                    }
                  : null,
                emotions: c.emotions ? { ...c.emotions } : null,
                memory: c.memory
                  ? {
                      capacity: c.memory.capacity ?? null,
                      locations: Array.isArray(c.memory.locations)
                        ? c.memory.locations.slice(0, 8).map(mem => ({
                            id: mem.id ?? null,
                            x: mem.x ?? null,
                            y: mem.y ?? null,
                            tag: typeof mem.tag === 'string' ? mem.tag : (mem.type ?? null),
                            type: typeof mem.type === 'string' ? mem.type : (mem.tag ?? null),
                            strength: mem.strength ?? null,
                            timestamp: mem.timestamp ?? null
                          }))
                        : []
                    }
                  : null,
                deathTime: c.deathTime ?? null,
                deathCause: typeof c.deathCause === 'string' ? c.deathCause : (c.deathCause ?? null),
                killedBy: c.killedBy ?? null
              })),
              foodFull: (world.food || []).map(f => ({
                x: f.x,
                y: f.y,
                energy: f.energy ?? null,
                bites: f.bites ?? null,
                biteEnergy: f.biteEnergy ?? null,
                type: f.type ?? null,
                scentRadius: f.scentRadius ?? null,
                sourceId: f.sourceId ?? null,
                sourceTag: f.sourceTag ?? null,
                origin: f.origin ?? null
              })),
              corpsesFull: (world.corpses || []).map(c => ({
                x: c.x,
                y: c.y,
                energy: c.energy ?? null,
                age: c.age ?? null,
                isPredator: c.isPredator ?? false
              })),
              environmentFull: world.environment
                ? {
                    timeOfDay: world.environment.timeOfDay,
                    dayLength: world.environment.dayLength,
                    dayNightEnabled: world.environment.dayNightEnabled,
                    seasonTime: world.environment.seasonTime,
                    seasonDuration: world.environment.seasonDuration,
                    currentSeason: world.environment.currentSeason,
                    seasonIndex: world.environment.seasonIndex,
                    seasonPhase: world.environment.seasonPhase,
                    seasonSpeed: world.environment.seasonSpeed,
                    weatherIntensity: world.environment.weatherIntensity,
                    weatherType: world.environment.weatherType,
                    weatherTransitionTime: world.environment.weatherTransitionTime,
                    weatherTargetIntensity: world.environment.weatherTargetIntensity,
                    diseaseTimer: world.environment.diseaseTimer,
                    moodType: world.environment.moodType,
                    moodIntensity: world.environment.moodIntensity,
                    moodTimer: world.environment.moodTimer,
                    moodDuration: world.environment.moodDuration,
                    windAngle: world.environment.windAngle
                  }
                : null,
              disasterPending: Array.isArray(world.disaster?.pendingDisasters)
                ? world.disaster.pendingDisasters.map(item => ({ ...item }))
                : []
            }
          });
        }
        break;

      case 'SET_PROP':
        if (world) {
          setDeepProp(world, data.path, data.value);
        }
        break;

      case 'STEP_AND_SYNC':
        step(data.dt);
        break;
      default:
        console.warn('Unknown message type:', type);
        break;
    }
  } catch (err) {
    console.error('👷 Worker Message Error:', err);
    self.postMessage({ type: 'ERROR', data: { message: err.message, stack: err.stack } });
  }
};

function step(dt) {
  if (!world) return;

  if (!isPaused) {
    const scaledDt = dt * timeScale;
    world.step(scaledDt);
  }

  sendSnapshot();
}

// Decorations are static for the life of a seeded world (generateDecorations()
// runs once per seed/reset and never mutates), but they live only in the worker.
// SimulationProxy has no `decorations` getter, so in worker mode — the product
// default — the renderer's `if (world.decorations)` guard silently skipped the
// entire environmental layer and the field rendered as an empty void. Ship the
// array across once per world instead of per tick.
function sendDecorations() {
  if (!world) return;
  const decorations = (world.decorations || []).map(d => ({
    x: d.x,
    y: d.y,
    type: d.type,
    sprite: d.sprite,
    size: d.size,
    hue: d.hue
  }));
  self.postMessage({ type: 'DECORATIONS', data: { decorations } });
}

function sendSnapshot() {
  if (!world) return;

  const count = world.creatures.length;
  // We use a Float32Array for high performance transfer
  const buffer = createCreatureBuffer(count);

  for (let i = 0; i < count; i++) {
    packCreature(world.creatures[i], buffer, i);
  }

  // Also send food and corpse data (as regular POJOs for now, fewer items).
  // These reuse pooled objects across ticks — see fillSnapshotPool above.
  _foodSnapshotPool = fillSnapshotPool(_foodSnapshotPool, world.food, (entry, f) => {
    entry.id = f.id;
    entry.x = f.x;
    entry.y = f.y;
    entry.type = f.type;
    entry.r = f.size || 1.5;
  });
  _corpseSnapshotPool = fillSnapshotPool(_corpseSnapshotPool, world.corpses, (entry, c) => {
    entry.x = c.x;
    entry.y = c.y;
    entry.age = c.age;
  });

  const snapshot = {
    type: 'STATE_UPDATE',
    t: world.t,
    count: count,
    creatureBuffer: buffer, // This will be "Transferred"
    food: _foodSnapshotPool,
    corpses: _corpseSnapshotPool,
    environment: {
      dayLight: world.environment.dayLight,
      dayPhase: world.environment.dayPhase,
      currentSeason: world.environment.currentSeason,
      seasonPhase: world.environment.seasonPhase,
      weatherIntensity: world.environment.weatherIntensity,
      weatherType: world.environment.weatherType,
      moodState: world.environment.moodState,
      timeOfDay: world.environment.timeOfDay
    },
    activeDisaster: world.getActiveDisaster ? world.getActiveDisaster() : null,
    pendingDisasters: world.getPendingDisasters ? world.getPendingDisasters().map(item => ({ ...item })) : []
  };

  // Transfer the buffer to avoid copying memory
  self.postMessage(snapshot, [buffer.buffer]);
}

/**
 * Helper to set deep properties like 'autoBalanceSettings.enabled'
 */
function setDeepProp(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}
