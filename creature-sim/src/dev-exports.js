/**
 * DevTools / Debug Exports
 * Assigns debugging helpers to window for console access.
 */

export function setupDevExports({
  renderGameToText,
  advanceTime,
  debugConsole,
  world,
  camera,
  tools,
  audio,
  achievements,
  tutorial,
  gameState,
  inputManager,
  uiController,
  gameLoop,
  errorHandler,
  notifications,
  performanceProfiler,
  configManager,
  campaignSystemInstance,
  diseaseSystem,
  gameplayModes,
  sessionGoals,
  gameDirector
}) {
  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceTime;
  window.debug = debugConsole;

  const _devtoolsEnabled = gameState.showDebugOverlay || new URLSearchParams(location.search).has('devtools');
  if (_devtoolsEnabled) {
    errorHandler.safeExecute(() => {
      window.world = world;
      window.camera = camera;
      window.tools = tools;
      window.audio = audio;
      window.achievements = achievements;
      window.tutorial = tutorial;
      window.gameState = gameState;
      window.inputManager = inputManager;
      window.uiController = uiController;
      window.gameLoop = gameLoop;
      window.errorHandler = errorHandler;
      window.notifications = notifications;
      window.performanceProfiler = performanceProfiler;
      window.configManager = configManager;
      window.campaignSystem = campaignSystemInstance;
      window.diseaseSystem = diseaseSystem;
      window.gameplayModes = gameplayModes;
      window.sessionGoals = sessionGoals;
      window.gameDirector = gameDirector;
    }, 'Debug exports');
  }
}
