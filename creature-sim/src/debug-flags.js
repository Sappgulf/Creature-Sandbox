export function getDebugFlags() {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      spawnDebug: false,
      renderDebug: false
    };
  }

  if (window.__creatureDebugFlags) {
    return window.__creatureDebugFlags;
  }

  const params = new URLSearchParams(window.location.search);
  const enabled = params.has('devtools') || window.localStorage?.getItem('creature-sim-devtools') === 'true';
  const spawnDebug = enabled && (params.has('spawnDebug') || window.localStorage?.getItem('creature-sim-spawn-debug') === 'true');
  const renderDebug = enabled && (params.has('renderDebug') || window.localStorage?.getItem('creature-sim-render-debug') === 'true');

  const flags = {
    enabled,
    spawnDebug,
    renderDebug
  };

  window.__creatureDebugFlags = flags;
  return flags;
}
