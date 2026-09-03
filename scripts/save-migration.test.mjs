import assert from 'node:assert/strict';

import { getCurrentSaveVersion, migrateSaveData } from '../creature-sim/src/save-migration.js';
import { SimulationProxy } from '../creature-sim/src/simulation-proxy.js';
import { packCreature, createCreatureBuffer } from '../creature-sim/src/simulation-state.js';
import { SaveSystem } from '../creature-sim/src/save-system.js';

const CURRENT = getCurrentSaveVersion();
assert.equal(CURRENT, '3.0', 'CURRENT_SAVE_VERSION should be 3.0');

// 2.0 -> 3.0 should walk the full chain and stamp the current version.
{
  const input = { version: '2.0', creatures: [], world: {} };
  const result = migrateSaveData(structuredClone(input));
  assert.equal(result.data.version, '3.0', '2.0 input should migrate to version 3.0');
  assert.equal(result.migrated, true, '2.0 input should report migrated=true');
  assert.deepEqual(result.path, ['2.0 -> 2.5', '2.5 -> 3.0'], '2.0 input should walk 2.0 -> 2.5 -> 3.0');
}

// Unknown version: documents current behavior.
// Ideal behavior would be to NOT launder an unknown version stamp to CURRENT.
// Current implementation (save-migration.js) breaks out of the migration loop
// but then unconditionally stamps data.version = CURRENT_SAVE_VERSION, so an
// unknown version IS laundered to CURRENT with migrated=false and an empty path.
// This test pins that behavior so a future fix is intentional.
{
  const input = { version: '9.9', creatures: [], world: {} };
  const result = migrateSaveData(structuredClone(input));
  assert.deepEqual(result.path, [], 'unknown version should have an empty migration path');
  assert.equal(result.migrated, false, 'unknown version should report migrated=false');
  assert.equal(
    result.data.version,
    CURRENT,
    'documents current behavior: unknown version is stamped to CURRENT (laundered)'
  );
}

// 2.5 -> 3.0 sessionSeed should be deterministic for the same input.
// The 2.5 -> 3.0 step fills meta.sessionSeed via Math.random, so determinism
// is verified under a stubbed Math.random: same input twice => same output.
{
  const makeInput = () => ({ version: '2.5', creatures: [], world: {} });
  const originalRandom = Math.random;
  Math.random = () => 0.123456789;
  try {
    const first = migrateSaveData(structuredClone(makeInput()));
    const second = migrateSaveData(structuredClone(makeInput()));
    assert.equal(first.data.version, '3.0', '2.5 input should migrate to version 3.0');
    assert.equal(second.data.version, '3.0', '2.5 input should migrate to version 3.0');
    assert.ok(first.data.meta?.sessionSeed, '2.5 -> 3.0 should create meta.sessionSeed');
    assert.equal(
      first.data.meta.sessionSeed,
      second.data.meta.sessionSeed,
      'same 2.5 input twice should produce the same sessionSeed (deterministic under stubbed random)'
    );
  } finally {
    Math.random = originalRandom;
  }
}

// Worker-mode save field fidelity (mock worker payload + real SimulationProxy
// merge path, no real Worker): the per-tick binary snapshot drops parentId,
// maxHealth, full genes, food energy/bites and most environment keys, so the
// proxy must merge the on-demand WORLD_EXTRAS round-trip back into the
// snapshot before SaveSystem.serialize() reads it. Only the worker payload
// shape is mocked; pack/unpack, merge, queue and serialize are the real code.
{
  const makeProxy = () =>
    Object.assign(Object.create(SimulationProxy.prototype), {
      isReady: false,
      queue: [],
      biomeGenerator: null,
      _saveExtras: null,
      _saveExtrasResolvers: [],
      _isInternalUpdate: false,
      diagnostics: {
        errorCount: 0,
        snapshotCount: 0,
        snapshotDropped: 0,
        queueDropped: 0,
        queueCoalesced: 0,
        lastReadyAt: null,
        lastSnapshotAt: null,
        lastWorldTime: 0,
        lastCreatureCount: 0,
        lastFoodCount: 0,
        lastError: null
      },
      worldSnapshot: {
        t: 0,
        width: 4000,
        height: 2800,
        creatures: [],
        food: [],
        corpses: [],
        ecosystem: { foodPatches: [] },
        creatureManager: {},
        disasterCooldown: 0,
        activeDisaster: null,
        pendingDisasters: [],
        dayLength: 120,
        seasonSpeed: 0.015,
        environment: { currentSeason: 'spring', seasonPhase: 0, timeOfDay: 12 }
      }
    });

  // Pre-READY queue: STEP_AND_SYNC compacts to the latest, overflow drops oldest.
  {
    const proxy = makeProxy();
    proxy._send('STEP_AND_SYNC', { dt: 0.016 });
    proxy._send('STEP_AND_SYNC', { dt: 0.033 });
    assert.equal(proxy.queue.length, 1, 'coalescible STEP_AND_SYNC should compact to one entry');
    assert.equal(proxy.queue[0].data.dt, 0.033, 'compacted STEP_AND_SYNC should keep the latest dt');
    assert.equal(proxy.diagnostics.queueCoalesced, 1, 'compaction should be counted');
    for (let i = 0; i < 70; i++) proxy._send('ADD_FOOD', { x: i, y: i });
    assert.equal(proxy.queue.length, 60, 'pre-READY queue should be capped');
    assert.equal(proxy.diagnostics.queueDropped, 11, 'queue overflow drops should be counted');
  }

  // Malformed STATE_UPDATE must not throw or clobber the last good snapshot.
  {
    const proxy = makeProxy();
    const empty = createCreatureBuffer(0);
    proxy.updateSnapshot({ t: 10, count: 0, creatureBuffer: empty, food: [], corpses: [], environment: null });
    assert.equal(proxy.worldSnapshot.t, 10, 'good snapshot should apply');
    const applied = proxy.diagnostics.snapshotCount;
    proxy.updateSnapshot({ t: NaN, count: 0, creatureBuffer: empty, food: [], corpses: [] });
    proxy.updateSnapshot({ t: 11, count: 2, creatureBuffer: empty, food: [], corpses: [] });
    assert.equal(proxy.worldSnapshot.t, 10, 'malformed snapshots should leave last good state intact');
    assert.equal(proxy.diagnostics.snapshotCount, applied, 'malformed snapshots should not count as applied');
    assert.equal(proxy.diagnostics.snapshotDropped, 2, 'malformed snapshots should be counted');
  }

  // Field fidelity: binary snapshot + WORLD_EXTRAS merge + serialize.
  {
    const proxy = makeProxy();
    const genes = {
      predator: 0,
      diet: 0.2,
      hue: 120,
      speed: { allele1: 0.3, allele2: 0.5, expressed: 0.4 },
      sense: 90
    };
    const buffer = createCreatureBuffer(1);
    packCreature(
      {
        id: 7,
        x: 100,
        y: 200,
        dir: 1,
        vx: 2,
        vy: 3,
        energy: 24,
        health: 9,
        age: 12,
        genes,
        alive: true,
        ageStage: 'adult',
        needs: { stress: 10, hunger: 20 }
      },
      buffer,
      0
    );
    proxy.updateSnapshot({
      t: 42.5,
      count: 1,
      creatureBuffer: buffer,
      food: [{ id: 1, x: 10, y: 20, type: 'grass', r: 1.5 }],
      corpses: [{ x: 30, y: 40, age: 5 }],
      environment: { timeOfDay: 18.5, seasonPhase: 0.1, currentSeason: 'autumn', dayLight: 0.8, dayPhase: 'dusk' }
    });
    assert.equal(proxy.worldSnapshot.creatures[0].parentId, undefined, 'binary snapshot alone carries no parentId');
    assert.equal(proxy.worldSnapshot.food[0].energy, undefined, 'binary snapshot alone carries no food energy');

    proxy.handleMessage({
      data: {
        type: 'WORLD_EXTRAS',
        data: {
          _nextId: 99,
          biomeSeed: null,
          chaosBaseLevel: 0.6,
          restZones: [],
          nests: [],
          sandboxProps: [],
          childrenOf: [{ parentId: 3, childIds: [7] }],
          disasterPending: [],
          creatureExtras: [
            {
              id: 7,
              parentId: 3,
              maxHealth: 14,
              genes,
              personality: { packInstinct: 0.91, aggression: 1.8, idleTempo: 1.25, playfulness: 0.88 },
              temperament: { boldness: 0.2, sociability: 0.7, calmness: 0.8, curiosity: 0.4 },
              quirks: ['homebody', 'night_owl'],
              stats: { food: 5, kills: 1, births: 2, damageTaken: 3, damageDealt: 4 },
              traits: { bounce: 1.0, temperament: 0.6, dietRole: 'herbivore' },
              needs: { hunger: 20, energy: 55, socialDrive: 0.7, stress: 10, lastEatAt: 30 },
              goal: { current: 'SEEK_FOOD', lastChange: 40, cooldown: 0, mateCooldown: 5 },
              ecosystem: { stress: 18, energy: 70, curiosity: 55, stability: 70, state: 'calm' },
              emotions: { fear: 0.1, hunger: 0.2, confidence: 0.6, curiosity: 0.5, stress: 0.3, contentment: 0.7 },
              memory: {
                capacity: 6,
                locations: [
                  { id: 1, x: 130, y: 144, tag: 'food', type: 'food', strength: 0.9, timestamp: 4 },
                  { id: 2, x: 90, y: 100, tag: 'danger', type: 'danger', strength: 0.5, timestamp: 5 }
                ]
              },
              deathTime: null,
              deathCause: null,
              killedBy: null
            }
          ],
          foodFull: [
            {
              x: 10,
              y: 20,
              energy: 2.5,
              bites: 3,
              biteEnergy: 0.5,
              type: 'grass',
              scentRadius: 110,
              sourceId: null,
              sourceTag: null,
              origin: 'wild'
            }
          ],
          corpsesFull: [{ x: 30, y: 40, energy: 5, age: 5, isPredator: false }],
          environmentFull: {
            timeOfDay: 18.5,
            dayLength: 600,
            seasonPhase: 0.7,
            seasonSpeed: 0.02,
            currentSeason: 'autumn'
          }
        }
      }
    });

    const merged = proxy.worldSnapshot.creatures[0];
    assert.equal(merged.parentId, 3, 'merge should restore parentId');
    assert.equal(merged.maxHealth, 14, 'merge should restore maxHealth');
    assert.equal(merged.genes.sense, 90, 'merge should restore full genes');
    assert.equal(merged.genes.speed.expressed, 0.4, 'merge should preserve allele-structured genes');
    assert.equal(proxy.worldSnapshot.food[0].energy, 2.5, 'merge should restore food energy');
    assert.equal(proxy.worldSnapshot.food[0].bites, 3, 'merge should restore food bites');
    assert.equal(merged.quirks.join(','), 'homebody,night_owl', 'merge should restore quirks');
    assert.equal(merged.memory.locations.length, 2, 'merge should restore memory locations');
    assert.equal(merged.memory.locations[0].timestamp, 4, 'merge should keep memory recency as sim-time');
    assert.equal(merged.needs.energy, 55, 'merge should restore needs energy');
    assert.equal(merged.needs.socialDrive, 0.7, 'merge should restore needs socialDrive');
    assert.equal(merged.needs.hunger, 20, 'merge should keep snapshot-fresh needs hunger');
    assert.equal(merged.personality.playfulness, 0.88, 'merge should restore personality scalars');
    assert.equal(merged.temperament.calmness, 0.8, 'merge should restore temperament scalars');
    assert.equal(merged.stats.food, 5, 'merge should restore stats');
    assert.equal(merged.traits.dietRole, 'herbivore', 'merge should restore traits');
    assert.equal(merged.goal.current, 'SEEK_FOOD', 'merge should restore goal');
    assert.equal(merged.ecosystem.state, 'calm', 'merge should restore ecosystem');
    assert.equal(merged.emotions.fear, 0.1, 'merge should restore emotions');
    assert.equal(proxy.worldSnapshot.corpses[0].energy, 5, 'merge should restore corpse energy');
    assert.equal(proxy.worldSnapshot.dayLength, 600, 'merge should sync top-level dayLength');
    assert.equal(proxy.worldSnapshot.creatureManager._nextId, 99, 'merge should sync creatureManager._nextId');

    // A later snapshot must not wipe the fidelity fields before serialize runs.
    const buffer2 = createCreatureBuffer(1);
    packCreature(
      {
        id: 7,
        x: 101,
        y: 201,
        dir: 1,
        vx: 2,
        vy: 3,
        energy: 23,
        health: 9,
        age: 13,
        genes,
        alive: true,
        ageStage: 'adult',
        needs: { stress: 11, hunger: 21 }
      },
      buffer2,
      0
    );
    proxy.updateSnapshot({ t: 43, count: 1, creatureBuffer: buffer2, food: [], corpses: [], environment: null });
    proxy.updateSnapshot({
      t: 43.5,
      count: 1,
      creatureBuffer: buffer2,
      food: [{ id: 1, x: 10, y: 20, type: 'grass', r: 1.5 }],
      corpses: [{ x: 30, y: 40, age: 6 }],
      environment: null
    });
    assert.equal(proxy.worldSnapshot.creatures[0].parentId, 3, 'post-extras snapshots should re-apply fidelity fields');

    const saveData = new SaveSystem().serialize(
      proxy,
      { x: 0, y: 0, zoom: 1, followMode: 'free', followTarget: null, viewportWidth: 800, viewportHeight: 600 },
      null,
      null
    );
    assert.equal(saveData.world.creatures[0].parentId, 3, 'serialized creature should keep parentId');
    assert.equal(saveData.world.creatures[0].maxHealth, 14, 'serialized creature should keep maxHealth');
    assert.equal(saveData.world.creatures[0].genes.sense, 90, 'serialized creature should keep full genes');
    assert.deepEqual(
      saveData.world.creatures[0].quirks,
      ['homebody', 'night_owl'],
      'serialized creature should keep quirks'
    );
    assert.equal(saveData.world.creatures[0].memory.locations.length, 2, 'serialized creature should keep memory');
    assert.equal(
      saveData.world.creatures[0].memory.locations[1].type,
      'danger',
      'serialized memory should keep danger type'
    );
    assert.equal(
      saveData.world.creatures[0].memory.locations[0].timestamp,
      4,
      'serialized memory should keep sim-time recency'
    );
    assert.equal(saveData.world.creatures[0].needs.energy, 55, 'serialized creature should keep needs energy');
    assert.equal(
      saveData.world.creatures[0].needs.socialDrive,
      0.7,
      'serialized creature should keep needs socialDrive'
    );
    assert.equal(saveData.world.creatures[0].needs.hunger, 21, 'serialized needs should keep snapshot-fresh hunger');
    assert.equal(
      saveData.world.creatures[0].personality.playfulness,
      0.88,
      'serialized creature should keep personality'
    );
    assert.equal(saveData.world.creatures[0].temperament.calmness, 0.8, 'serialized creature should keep temperament');
    assert.equal(saveData.world.creatures[0].stats.food, 5, 'serialized creature should keep stats');
    assert.equal(saveData.world.creatures[0].traits.dietRole, 'herbivore', 'serialized creature should keep traits');
    assert.equal(saveData.world.creatures[0].goal.current, 'SEEK_FOOD', 'serialized creature should keep goal');
    assert.equal(saveData.world.creatures[0].ecosystem.state, 'calm', 'serialized creature should keep ecosystem');
    assert.equal(saveData.world.creatures[0].emotions.fear, 0.1, 'serialized creature should keep emotions');
    assert.equal(saveData.world.food[0].energy, 2.5, 'serialized food should keep energy');
    assert.equal(saveData.world.food[0].bites, 3, 'serialized food should keep bites');
    assert.equal(saveData.world.corpses[0].energy, 5, 'serialized corpse should keep energy');
    assert.equal(saveData.world.corpses[0].age, 6, 'merge should not clobber fresh snapshot corpse age');
    assert.equal(saveData.world.environment.dayLength, 600, 'serialized environment should keep dayLength');
    assert.equal(saveData.world.environment.timeOfDay, 18.5, 'serialized environment should keep timeOfDay');
    assert.equal(saveData.world.environment.seasonPhase, 0.7, 'serialized environment should keep seasonPhase');
    assert.equal(saveData.world._nextId, 99, 'serialized world should keep _nextId');
    assert.equal(saveData.world.timeOfDay, 18.5, 'serialized world should keep top-level timeOfDay');
    assert.equal(saveData.world.dayLength, 600, 'serialized world should keep top-level dayLength');
    assert.equal(saveData.world.seasonPhase, 0.7, 'serialized world should keep top-level seasonPhase');
  }
}

console.log('Save migration tests passed.');
