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
import { packCreature, createCreatureBuffer } from './simulation-state.js';
import { eventSystem } from './event-system.js';

let world = null;
const _lastTime = performance.now();
let isPaused = false;
let timeScale = 1.0;

// Internal event bridging
const BRIDGE_EVENTS = [
  'creature:born',
  'creature:died',
  'world:disaster_start',
  'ui:notification',
  'achievement:unlocked'
];

self.onmessage = function (e) {
  try {
    const { type, data } = e.data;
    // console.debug('👷 Worker received:', type);

    switch (type) {
      case 'INIT':
        world = new World(data.width, data.height);
        // Bridge events back to main thread
        BRIDGE_EVENTS.forEach(evType => {
          eventSystem.on(evType, (payload) => {
            self.postMessage({ type: 'EVENT', eventType: evType, data: payload });
          });
        });
        self.postMessage({ type: 'READY' });
        break;

      case 'SEED':
        if (world) {
          world.seed(data.nHerb, data.nPred, data.nFood);
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

      case 'PAUSE':
        isPaused = data.paused;
        break;

      case 'SET_TIME_SCALE':
        timeScale = data.scale;
        break;

      case 'RESET':
        if (world) {
          world.reset();
          sendSnapshot();
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

function sendSnapshot() {
  if (!world) return;

  const count = world.creatures.length;
  // We use a Float32Array for high performance transfer
  const buffer = createCreatureBuffer(count);

  for (let i = 0; i < count; i++) {
    packCreature(world.creatures[i], buffer, i);
  }

  // Also send food and corpse data (as regular POJOs for now, fewer items)
  const snapshot = {
    type: 'STATE_UPDATE',
    t: world.t,
    count: count,
    creatureBuffer: buffer, // This will be "Transferred"
    food: world.food.map(f => ({ id: f.id, x: f.x, y: f.y, type: f.type, r: f.size || 1.5 })),
    corpses: world.corpses.map(c => ({ x: c.x, y: c.y, age: c.age })),
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
    activeDisaster: world.getActiveDisaster ? world.getActiveDisaster() : null
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
