// @ts-check
/**
 * Save Migration System
 * Handles versioned upgrades of save data to maintain compatibility.
 */

const CURRENT_SAVE_VERSION = '3.0';

/**
 * Deterministically derive a session seed from existing save fields.
 * Uses FNV-1a over a stable snapshot of already-present data so the
 * 2.5 -> 3.0 migration never introduces Math.random() nondeterminism.
 * @param {any} data
 * @returns {string}
 */
function deriveSessionSeed(data) {
  const snapshot = JSON.stringify({
    version: data?.version ?? null,
    timestamp: data?.timestamp ?? null,
    savedAt: data?.savedAt ?? null,
    slotIndex: data?.meta?.slotIndex ?? null,
    width: data?.world?.width ?? null,
    height: data?.world?.height ?? null,
    t: data?.world?.t ?? null,
    creatureCount: Array.isArray(data?.world?.creatures) ? data.world.creatures.length : null,
    firstIds: Array.isArray(data?.world?.creatures) ? data.world.creatures.slice(0, 8).map(c => c?.id ?? null) : null
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < snapshot.length; i++) {
    hash ^= snapshot.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Shared 2.x -> 2.5 upgrade. Serves 2.0 through 2.4 so intermediate saves get
 * the same safety defaults instead of being silently stamped forward.
 * @param {any} data
 */
function migrate2xTo25(data) {
  data.version = '2.5';
  if (data.creatures && Array.isArray(data.creatures)) {
    for (const c of data.creatures) {
      if (!c.ageStage) c.ageStage = 'adult';
      if (!c.health) {
        c.health = { current: 20, max: 20, invulnerableTimer: 0 };
      }
      if (c.genes && c.genes.diet === undefined && c.genes.predator !== undefined) {
        c.genes.diet = c.genes.predator ? 1.0 : 0.0;
      }
    }
  }
  // Creatures may still live under `world` in later 2.x payloads.
  if (data.world?.creatures && Array.isArray(data.world.creatures)) {
    for (const c of data.world.creatures) {
      if (!c.ageStage) c.ageStage = 'adult';
      if (!c.health) {
        c.health = { current: 20, max: 20, invulnerableTimer: 0 };
      }
      if (c.genes && c.genes.diet === undefined && c.genes.predator !== undefined) {
        c.genes.diet = c.genes.predator ? 1.0 : 0.0;
      }
    }
  }
  if (!data.analytics) {
    data.analytics = {
      populationHistory: [],
      predatorHistory: [],
      speedHistory: [],
      metabolismHistory: [],
      varianceHistory: [],
      ratioHistory: []
    };
  }
  return data;
}

export const SaveMigrations = [
  {
    from: '1.0',
    to: '2.0',
    migrate(data) {
      // Legacy v1 save: creatures were flat, no ecosystem state. Move the flat
      // arrays under `world`, which is where deserialize() reads them.
      data.version = '2.0';
      if (!data.world) data.world = {};
      if (!data.world.creatures && Array.isArray(data.creatures)) {
        data.world.creatures = data.creatures;
      }
      for (const key of ['food', 'corpses', 'props', 'decorations']) {
        if (!data.world[key] && Array.isArray(data[key])) {
          data.world[key] = data[key];
        }
      }
      if (!data.world.environment) {
        data.world.environment = {
          timeOfDay: 12,
          dayLength: 120,
          dayNightEnabled: true,
          seasonTime: 0,
          seasonDuration: 300,
          currentSeason: 'spring',
          seasonIndex: 0,
          seasonPhase: 0,
          seasonSpeed: 0.015,
          weatherIntensity: 0,
          weatherType: 'clear',
          weatherTransitionTime: 0
        };
      }
      const flatCreatures = Array.isArray(data.world.creatures) ? data.world.creatures : [];
      for (const c of flatCreatures) {
        if (!c.genes) c.genes = {};
        if (c.genes.predator !== undefined && c.genes.diet === undefined) {
          c.genes.diet = c.genes.predator ? 1.0 : 0.0;
        }
        if (!c.ecosystem) {
          c.ecosystem = { stress: 0, curiosity: 0.5, stability: 1.0 };
        }
      }
      return data;
    }
  },
  {
    from: '2.0',
    to: '2.5',
    migrate: migrate2xTo25
  },
  {
    from: '2.1',
    to: '2.5',
    migrate: migrate2xTo25
  },
  {
    from: '2.2',
    to: '2.5',
    migrate: migrate2xTo25
  },
  {
    from: '2.3',
    to: '2.5',
    migrate: migrate2xTo25
  },
  {
    from: '2.4',
    to: '2.5',
    migrate: migrate2xTo25
  },
  {
    from: '2.5',
    to: '3.0',
    migrate(data) {
      data.version = '3.0';
      // v3 adds save slot metadata and session seed. The seed must be
      // deterministic: only fill when absent, derived from a hash of
      // existing fields so repeated migrations of the same save agree.
      if (!data.meta) {
        data.meta = {
          slotIndex: 0,
          sessionSeed: deriveSessionSeed(data),
          playTime: 0,
          saveCount: 1
        };
      } else if (data.meta.sessionSeed == null) {
        data.meta.sessionSeed = deriveSessionSeed(data);
      }
      if (!data.settings) {
        data.settings = {
          highContrast: false,
          reducedMotion: false,
          chaosLevel: 0.5
        };
      }
      return data;
    }
  }
];

/**
 * Migrate save data to the current version.
 *
 * Unknown/future versions are reported as `unsupported` without mutating the
 * version stamp: laundering a v4 save into v3 can silently parse partial state,
 * and stamping it hides the incompatibility.
 *
 * @param {any} data
 * @returns {{ data: any, migrated: boolean, path: string[], unsupported?: boolean, version?: string }}
 */
export function migrateSaveData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid save data');
  }

  const path = [];
  let currentVersion = data.version || '1.0';
  let migrated = false;

  while (currentVersion !== CURRENT_SAVE_VERSION) {
    const migration = SaveMigrations.find(m => m.from === currentVersion);
    if (!migration) {
      console.warn(`No migration path from ${currentVersion} to ${CURRENT_SAVE_VERSION}`);
      return { data, migrated, path, unsupported: true, version: currentVersion };
    }
    data = migration.migrate(data);
    path.push(`${migration.from} -> ${migration.to}`);
    currentVersion = migration.to;
    migrated = true;
  }

  data.version = CURRENT_SAVE_VERSION;
  return { data, migrated, path };
}

export function getCurrentSaveVersion() {
  return CURRENT_SAVE_VERSION;
}
