import { eventSystem, GameEvents } from './event-system.js';
import { unpackCreature } from './simulation-state.js';
import { BiomeGenerator } from './perlin-noise.js';

export class SimulationProxy {
    constructor(workerPath) {
        this.worker = new Worker(workerPath, { type: 'module' });
        this.isReady = false;

        this.worldSnapshot = {
            t: 0,
            width: 4000,
            height: 2800,
            creatures: [],
            food: [],
            corpses: [],
            // Necessary for systems that expect these properties
            pheromone: { grid: new Float32Array(0), cell: 20 },
            temperature: { grid: new Float32Array(0), cell: 40 },
            foodGridDirty: false,
            corpseGridDirty: false,
            restGridDirty: false,
            nestGridDirty: false,
            randomDisasters: true,
            disasterCooldown: 40,
            disasterIntensity: 1.0,
            seasonSpeed: 0.015,
            dayLength: 120,
            autoBalanceSettings: {
                enabled: true,
                minPopulation: 36,
                maxPredators: 16,
                targetPredatorRatio: 0.24,
                targetFoodFraction: 0.5,
                minFoodAbsolute: 180
            },
            environment: {
                foodRateMultiplier: 1.0
            },
            creatureManager: {
                creatureGrid: {
                    queryRect: (x1, y1, x2, y2) => {
                        return this.worldSnapshot.creatures.filter(c =>
                            c.x >= x1 && c.x <= x2 && c.y >= y1 && c.y <= y2
                        );
                    }
                }
            }
        };

        // Initialize biome generator with a fixed seed if possible, or random
        this.biomeGenerator = new BiomeGenerator(0.123);

        this.worker.onmessage = (e) => this.handleMessage(e);

        // Command queue for initial calls before ready
        this.queue = [];
    }

    handleMessage(e) {
        const { type, data } = e.data;

        switch (type) {
            case 'READY':
                this.isReady = true;
                this.queue.forEach(q => this.worker.postMessage(q));
                this.queue = [];
                break;

            case 'STATE_UPDATE':
                this.updateSnapshot(e.data);
                break;

            case 'EVENT':
                eventSystem.emit(e.data.eventType, e.data.data);
                break;
        }
    }

    updateSnapshot(payload) {
        const { t, count, creatureBuffer, food, corpses } = payload;

        this.worldSnapshot.t = t;
        this.worldSnapshot.food = food;
        this.worldSnapshot.corpses = corpses;

        // Unpack binary buffer into renderable objects
        const creatures = new Array(count);
        for (let i = 0; i < count; i++) {
            creatures[i] = unpackCreature(creatureBuffer, i);
        }
        this.worldSnapshot.creatures = creatures;
    }

    // Implementation of World methods
    init(width, height) {
        this.worldSnapshot.width = width;
        this.worldSnapshot.height = height;
        this._send('INIT', { width, height });
    }

    seed(nHerb, nPred, nFood) {
        this._send('SEED', { nHerb, nPred, nFood });
    }

    step(dt) {
        // Tell worker to step and sync back
        this._send('STEP_AND_SYNC', { dt });
    }

    spawnManual(x, y, predator) {
        this._send('SPAWN_MANUAL', { x, y, predator });
    }

    pause(paused) {
        this._send('PAUSE', { paused });
    }

    setTimeScale(scale) {
        this._send('SET_TIME_SCALE', { scale });
    }

    reset() {
        this._send('RESET', {});
    }

    getBiomeAt(x, y) {
        if (!this.biomeGenerator) return 'plain';
        const biome = this.biomeGenerator.getBiomeAt(x, y, this.worldSnapshot.width, this.worldSnapshot.height);
        return biome?.type || 'plain';
    }

    _send(type, data) {
        if (this.isReady) {
            this.worker.postMessage({ type, data });
        } else {
            this.queue.push({ type, data });
        }
    }

    // Getters to match World interface
    get t() { return this.worldSnapshot.t; }
    get width() { return this.worldSnapshot.width; }
    get height() { return this.worldSnapshot.height; }
    get creatures() { return this.worldSnapshot.creatures; }
    get food() { return this.worldSnapshot.food; }
    get corpses() { return this.worldSnapshot.corpses; }
    get pheromone() { return this.worldSnapshot.pheromone; }
    get temperature() { return this.worldSnapshot.temperature; }
    get creatureManager() { return this.worldSnapshot.creatureManager; }
    get foodGridDirty() { return this.worldSnapshot.foodGridDirty; }
    get corpseGridDirty() { return this.worldSnapshot.corpseGridDirty; }

    get randomDisasters() { return this.worldSnapshot.randomDisasters; }
    set randomDisasters(val) {
        this.worldSnapshot.randomDisasters = val;
        this._send('SET_PROP', { path: 'randomDisasters', value: val });
    }

    get disasterCooldown() { return this.worldSnapshot.disasterCooldown; }
    set disasterCooldown(val) {
        this.worldSnapshot.disasterCooldown = val;
        this._send('SET_PROP', { path: 'disasterCooldown', value: val });
    }

    get autoBalanceSettings() { return this.worldSnapshot.autoBalanceSettings; }
    get environment() { return this.worldSnapshot.environment; }

    get seasonSpeed() { return this.worldSnapshot.seasonSpeed; }
    set seasonSpeed(val) {
        this.worldSnapshot.seasonSpeed = val;
        this._send('SET_PROP', { path: 'seasonSpeed', value: val });
    }

    get dayLength() { return this.worldSnapshot.dayLength; }
    set dayLength(val) {
        this.worldSnapshot.dayLength = val;
        this._send('SET_PROP', { path: 'dayLength', value: val });
    }

    // Search helper
    getAnyCreatureById(id) {
        return this.worldSnapshot.creatures.find(c => c.id === id);
    }

    // Stubs for World attachment methods
    attachLineageTracker() { }
    attachParticleSystem(p) { this.worldSnapshot.particles = p; }
    attachHeatmapSystem() { }
    attachAudioSystem() { }
    attachNotificationSystem() { }
    attachProceduralSounds() { }
    attachUnlockableAchievements() { }
    attachFamilyBonds() { }
    attachMemoryLearning() { }
}
