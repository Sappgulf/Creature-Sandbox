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
        return controller;
      })
      .catch(error => {
        upgradeControllerPromise = null;
        throw error;
      });
  }
  return upgradeControllerPromise;
}

// Re-export instances for synchronous access in hot paths (e.g. frame updates)
export {
  scenarioEditorInstance,
  campaignSystemInstance,
  geneEditorInstance,
  debugConsoleInstance,
  upgradeControllerInstance
};

// Allow external access to instances for advanced integration/testing
export function getLazyLoaderState() {
  return {
    scenarioEditorInstance,
    campaignSystemInstance,
    geneEditorInstance,
    debugConsoleInstance,
    upgradeControllerInstance
  };
}
