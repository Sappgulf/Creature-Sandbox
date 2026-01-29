/**
 * Simulation Worker - Enhanced version with binary state transfer
 */

import { World } from './world-core.js';
import { packCreature, createCreatureBuffer } from './simulation-state.js';
import { eventSystem } from './event-system.js';

let world = null;
let lastTime = performance.now();
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
    const { type, data } = e.data;

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

        case 'STEP_AND_SYNC':
            step(data.dt);
            break;
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
        corpses: world.corpses.map(c => ({ x: c.x, y: c.y, age: c.age }))
    };

    // Transfer the buffer to avoid copying memory
    self.postMessage(snapshot, [buffer.buffer]);
}
