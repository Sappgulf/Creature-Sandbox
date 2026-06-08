/**
 * bootstrap-lazy-loaders.js — Lazy-loading wrappers for heavy optional panels.
 */

let scenarioEditorInstance = null;
let scenarioEditorPromise = null;
let campaignSystemInstance = null;
let campaignSystemPromise = null;
let geneEditorInstance = null;
let geneEditorPromise = null;
let debugConsoleInstance = null;
let debugConsolePromise = null;
let upgradeControllerInstance = null;
let upgradeControllerPromise = null;
let profilerUIInstance = null;
let profilerUIPromise = null;
let replayPanelInstance = null;
let replayPanelPromise = null;
let lineageAlbumInstance = null;
let lineageAlbumPromise = null;
let insightsPanelInstance = null;
let insightsPanelPromise = null;

export async function ensureScenarioEditor() {
  if (scenarioEditorInstance) return scenarioEditorInstance;
  if (!scenarioEditorPromise) {
    scenarioEditorPromise = import('./scenario-editor.js')
      .then(({ scenarioEditor }) => {
        scenarioEditorInstance = scenarioEditor;
        return scenarioEditor;
      })
      .catch(error => {
        scenarioEditorPromise = null;
        throw error;
      });
  }
  return scenarioEditorPromise;
}

export async function ensureCampaignSystem() {
  if (campaignSystemInstance) return campaignSystemInstance;
  if (!campaignSystemPromise) {
    campaignSystemPromise = import('./campaign-system.js')
      .then(({ campaignSystem }) => {
        campaignSystemInstance = campaignSystem;
        return campaignSystem;
      })
      .catch(error => {
        campaignSystemPromise = null;
        throw error;
      });
  }
  return campaignSystemPromise;
}

export async function ensureGeneEditor() {
  if (geneEditorInstance) return geneEditorInstance;
  if (!geneEditorPromise) {
    geneEditorPromise = import('./gene-editor.js')
      .then(({ GeneEditor }) => {
        geneEditorInstance = new GeneEditor();
        return geneEditorInstance;
      })
      .catch(error => {
        geneEditorPromise = null;
        throw error;
      });
  }
  return geneEditorPromise;
}

export function createDebugConsoleProxy(world, camera) {
  const ensureDebugConsole = () => {
    if (debugConsoleInstance) return Promise.resolve(debugConsoleInstance);
    if (!debugConsolePromise) {
      debugConsolePromise = import('./debug-console.js')
        .then(({ DebugConsole }) => {
          debugConsoleInstance = new DebugConsole(world, camera);
          return debugConsoleInstance;
        })
        .catch(error => {
          debugConsolePromise = null;
          throw error;
        });
    }
    return debugConsolePromise;
  };

  return {
    get isActive() {
      return !!debugConsoleInstance?.isActive;
    },
    ensure: ensureDebugConsole,
    toggle() {
      void ensureDebugConsole().then(consoleInstance => consoleInstance.toggle?.());
    },
    update(dt) {
      debugConsoleInstance?.update?.(dt);
    }
  };
}

export async function ensureUpgradeController(deps) {
  if (upgradeControllerInstance) return upgradeControllerInstance;
  if (!upgradeControllerPromise) {
    upgradeControllerPromise = import('./upgrade-controller.js?v=20260528-tranche8')
      .then(({ UpgradeController }) => {
        const controller = new UpgradeController(deps);
        controller.init();
        upgradeControllerInstance = controller;
        return upgradeControllerInstance;
      })
      .catch(error => {
        upgradeControllerPromise = null;
        throw error;
      });
  }
  return upgradeControllerPromise;
}

export async function ensureReplayPanel(deps = {}) {
  if (replayPanelInstance) return replayPanelInstance;
  if (!replayPanelPromise) {
    replayPanelPromise = import('./replay-panel.js')
      .then(({ ReplayPanelController }) => {
        const instance = new ReplayPanelController(deps);
        const ok = instance.initialize();
        if (!ok) throw new Error('Replay panel DOM not available');
        replayPanelInstance = instance;
        return instance;
      })
      .catch(error => {
        replayPanelPromise = null;
        throw error;
      });
  }
  return replayPanelPromise;
}

export async function ensureLineageAlbum(deps = {}) {
  if (lineageAlbumInstance) return lineageAlbumInstance;
  if (!lineageAlbumPromise) {
    lineageAlbumPromise = import('./lineage-album.js')
      .then(({ LineageAlbumController }) => {
        const instance = new LineageAlbumController(deps);
        const ok = instance.initialize();
        if (!ok) throw new Error('Lineage album DOM not available');
        lineageAlbumInstance = instance;
        return instance;
      })
      .catch(error => {
        lineageAlbumPromise = null;
        throw error;
      });
  }
  return lineageAlbumPromise;
}

export async function ensureInsightsPanel(deps = {}) {
  if (insightsPanelInstance) return insightsPanelInstance;
  if (!insightsPanelPromise) {
    insightsPanelPromise = import('./insights-panel.js')
      .then(({ InsightsPanelController }) => {
        const instance = new InsightsPanelController(deps);
        const ok = instance.initialize();
        if (!ok) throw new Error('Insights panel DOM not available');
        insightsPanelInstance = instance;
        return instance;
      })
      .catch(error => {
        insightsPanelPromise = null;
        throw error;
      });
  }
  return insightsPanelPromise;
}

/**
 * Lazily create a ProfilerUI bound to the given profiler (and optional world).
 * Subsequent calls return the cached instance.
 * @param {Object} profiler - A PerformanceProfiler instance.
 * @param {Object} [world] - Optional world reference for quality-level info.
 * @returns {Promise<Object>}
 */
export async function ensureProfilerUI(profiler, world) {
  if (profilerUIInstance) {
    if (world) profilerUIInstance.setWorld?.(world);
    return profilerUIInstance;
  }
  if (!profilerUIPromise) {
    profilerUIPromise = import('./profiler-ui.js')
      .then(({ ProfilerUI }) => {
        profilerUIInstance = new ProfilerUI(profiler, { world });
        profilerUIInstance.attach();
        return profilerUIInstance;
      })
      .catch(error => {
        profilerUIPromise = null;
        throw error;
      });
  }
  return profilerUIPromise;
}

/**
 * Force-create a ProfilerUI synchronously (for use in lazy loaders that
 * prefer a direct factory). Returns the cached instance.
 * @param {Object} profiler
 * @param {Object} [world]
 * @returns {Object|null}
 */
export function createProfilerUI(profiler, world) {
  if (!profiler) return null;
  if (!profilerUIInstance) {
    // Synchronous dynamic import is not available, so fall back to a stub
    // proxy that the next call to ensureProfilerUI can replace.
    return {
      _pending: true,
      toggle() {
        void ensureProfilerUI(profiler, world).then(ui => ui.toggle());
      },
      show() {
        void ensureProfilerUI(profiler, world).then(ui => ui.show());
      },
      hide() {
        void ensureProfilerUI(profiler, world).then(ui => ui.hide());
      },
      update() {
        void ensureProfilerUI(profiler, world).then(ui => ui.update());
      },
      setWorld(w) {
        world = w;
      }
    };
  }
  if (world) profilerUIInstance.setWorld?.(world);
  return profilerUIInstance;
}

// Re-export instances for synchronous access in hot paths (e.g. frame updates)
export {
  scenarioEditorInstance,
  campaignSystemInstance,
  geneEditorInstance,
  debugConsoleInstance,
  upgradeControllerInstance,
  profilerUIInstance
};

// Allow external access to instances for advanced integration/testing
export function getLazyLoaderState() {
  return {
    scenarioEditorInstance,
    campaignSystemInstance,
    geneEditorInstance,
    debugConsoleInstance,
    upgradeControllerInstance,
    profilerUIInstance
  };
}
