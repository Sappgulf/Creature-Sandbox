const SAVE_SLOT_COUNT = 3;

export const PROFILE_STORAGE_KEYS = {
  accessibility: [
    'creature-sim-high-contrast',
    'creature-sim-reduced-motion',
    'creatureSandboxReducedMotion',
    'creature-sim-colorblind',
    'creature-sim-a11y-summary'
  ],
  mobile: [
    'creature-mobile-focus',
    'creature-mobile-battery',
    'creature-mobile-haptics',
    'creature-last-spawn-type'
  ],
  progress: [
    'achievements',
    'campaign_progress',
    'creature-sim-playable-progress',
    'tutorial_completed',
    'tooltips_dismissed',
    'creature-sandbox-camera-bookmarks',
    'creature-sim-last-summary',
    'creature-sandbox-upgrades:journal',
    'creature-sandbox-upgrades:seed-gallery',
    'creature-sandbox-upgrades:nicknames',
    'creature-sandbox-upgrades:readability-mode'
  ],
  saves: [
    'creature-sim-autosave',
    'creature-sim-autosave-preview'
  ]
};

function getStorage(storage = null) {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

function readRaw(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function readBoolean(storage, key) {
  const raw = readRaw(storage, key);
  if (raw == null) return null;
  return raw === 'true';
}

function readString(storage, key, fallback = null) {
  const raw = readRaw(storage, key);
  return raw == null || raw === '' ? fallback : raw;
}

function countJsonEntries(storage, key) {
  const raw = readRaw(storage, key);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length;
  } catch {
    return 0;
  }
  return 0;
}

function hasKey(storage, key) {
  return readRaw(storage, key) != null;
}

function countSaveSlots(storage) {
  let count = 0;
  for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
    if (hasKey(storage, `creature-sim-slot-${slot}`) || hasKey(storage, `creature-sim-slot-${slot}-preview`)) {
      count += 1;
    }
  }
  return count;
}

export function buildBrowserProfileSnapshot({ storage = null } = {}) {
  const resolvedStorage = getStorage(storage);
  const unavailable = !resolvedStorage;
  const profileKeys = [
    ...PROFILE_STORAGE_KEYS.accessibility,
    ...PROFILE_STORAGE_KEYS.mobile,
    ...PROFILE_STORAGE_KEYS.progress
  ];
  const saveKeys = [
    ...PROFILE_STORAGE_KEYS.saves,
    ...Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => `creature-sim-slot-${index + 1}`),
    ...Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => `creature-sim-slot-${index + 1}-preview`)
  ];

  return {
    scope: 'browser-local-profile',
    unavailable,
    relationship: {
      worldSavesIncludeProfile: false,
      saveMetadataIncludesProfileSummary: true,
      note: 'World saves restore the sandbox state. Profile preferences and progress caches stay in this browser profile unless explicitly exported by their own feature.'
    },
    preferences: {
      accessibility: {
        highContrast: readBoolean(resolvedStorage, 'creature-sim-high-contrast'),
        reducedMotion: readBoolean(resolvedStorage, 'creature-sim-reduced-motion') ??
          readBoolean(resolvedStorage, 'creatureSandboxReducedMotion'),
        colorblindMode: readString(resolvedStorage, 'creature-sim-colorblind', ''),
        screenReaderSummary: readBoolean(resolvedStorage, 'creature-sim-a11y-summary')
      },
      mobile: {
        focusMode: readBoolean(resolvedStorage, 'creature-mobile-focus'),
        batterySaver: readBoolean(resolvedStorage, 'creature-mobile-battery'),
        haptics: readBoolean(resolvedStorage, 'creature-mobile-haptics'),
        lastSpawnType: readString(resolvedStorage, 'creature-last-spawn-type', 'herbivore')
      }
    },
    browserProgress: {
      achievements: countJsonEntries(resolvedStorage, 'achievements'),
      campaignProgressEntries: countJsonEntries(resolvedStorage, 'campaign_progress'),
      playableProgressEntries: countJsonEntries(resolvedStorage, 'creature-sim-playable-progress'),
      tutorialStepsCompleted: countJsonEntries(resolvedStorage, 'tutorial_completed'),
      tooltipsDismissed: countJsonEntries(resolvedStorage, 'tooltips_dismissed'),
      cameraBookmarks: countJsonEntries(resolvedStorage, 'creature-sandbox-camera-bookmarks'),
      upgradeJournalEntries: countJsonEntries(resolvedStorage, 'creature-sandbox-upgrades:journal'),
      savedSeeds: countJsonEntries(resolvedStorage, 'creature-sandbox-upgrades:seed-gallery'),
      nicknames: countJsonEntries(resolvedStorage, 'creature-sandbox-upgrades:nicknames'),
      hasLastSessionSummary: hasKey(resolvedStorage, 'creature-sim-last-summary')
    },
    browserSaves: {
      hasAutosave: hasKey(resolvedStorage, 'creature-sim-autosave'),
      hasAutosavePreview: hasKey(resolvedStorage, 'creature-sim-autosave-preview'),
      occupiedSlots: countSaveSlots(resolvedStorage)
    },
    storageKeys: {
      profile: profileKeys,
      saveFiles: saveKeys
    }
  };
}
