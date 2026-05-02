// @ts-check
/**
 * Save Migration System
 * Handles versioned upgrades of save data to maintain compatibility.
 */

const CURRENT_SAVE_VERSION = '3.0';

export const SaveMigrations = [
  {
    from: '1.0',
    to: '2.0',
    migrate(data) {
      // Legacy v1 save: creatures were flat, no ecosystem state
      data.version = '2.0';
      if (!data.world) data.world = {};
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
      if (data.creatures && Array.isArray(data.creatures)) {
        for (const c of data.creatures) {
          if (!c.genes) c.genes = {};
          if (c.genes.predator !== undefined && c.genes.diet === undefined) {
            c.genes.diet = c.genes.predator ? 1.0 : 0.0;
          }
          if (!c.ecosystem) {
            c.ecosystem = { stress: 0, curiosity: 0.5, stability: 1.0 };
          }
        }
      }
      return data;
    }
  },
  {
    from: '2.0',
    to: '2.5',
    migrate(data) {
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
  },
  {
    from: '2.5',
    to: '3.0',
    migrate(data) {
      data.version = '3.0';
      // v3 adds save slot metadata and session seed
      if (!data.meta) {
        data.meta = {
          slotIndex: 0,
          sessionSeed: Math.floor(Math.random() * 1e9).toString(36),
          playTime: 0,
          saveCount: 1
        };
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
 * @param {any} data
 * @returns {{ data: any, migrated: boolean, path: string[] }}
 */
export function migrateSaveData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid save data');
  }

  const path = [];
  let currentVersion = data.version || '1.0';
  let migrated = false;

  while (currentVersion !== CURRENT_SAVE_VERSION) {
    const migration = SaveMigrations.find((m) => m.from === currentVersion);
    if (!migration) {
      console.warn(`No migration path from ${currentVersion} to ${CURRENT_SAVE_VERSION}`);
      break;
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
