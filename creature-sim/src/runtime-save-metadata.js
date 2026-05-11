export function buildRuntimeSaveMetadata({
  world,
  camera,
  playableScenarios,
  moments,
  gameState,
  tools,
  upgradeController,
  canvas
} = {}) {
  const playable = playableScenarios?.serialize?.() ?? null;
  const momentState = moments?.serialize?.() ?? null;
  const activeScenario = playable?.activeRun?.scenario ?? playableScenarios?.getSnapshot?.()?.scenario ?? null;
  const worldTime = Number(world?.t ?? 0);
  const population = world?.creatures?.length ?? 0;
  const food = world?.food?.length ?? 0;
  const props = world?.sandbox?.props?.length ?? 0;

  const metadata = {
    playable,
    moments: momentState,
    upgrades: upgradeController?.serialize?.() ?? null,
    uiState: {
      watchModeEnabled: !!gameState?.watchModeEnabled,
      godModeActive: !!gameState?.godModeActive,
      godModeTool: gameState?.godModeTool ?? null,
      selectedCreatureType: gameState?.selectedCreatureType ?? null,
      selectedPropType: gameState?.selectedPropType ?? tools?.propType ?? null,
      tool: tools?.mode ?? null
    },
    preview: {
      population,
      food,
      props,
      worldTime,
      camera: camera ? {
        x: Number(camera.x?.toFixed?.(1) ?? camera.x ?? 0),
        y: Number(camera.y?.toFixed?.(1) ?? camera.y ?? 0),
        zoom: Number(camera.zoom?.toFixed?.(2) ?? camera.zoom ?? 1)
      } : null,
      scenario: activeScenario ? {
        id: activeScenario.id,
        name: activeScenario.name,
        progress: playableScenarios?.getSnapshot?.()?.progress ?? playable?.activeRun?.progress ?? 0,
        state: playable?.activeRun?.state ?? null
      } : null,
      summary: momentState?.summary ?? null
    }
  };

  if (canvas?.toDataURL) {
    try {
      const thumb = document.createElement('canvas');
      thumb.width = 220;
      thumb.height = 124;
      const ctx = thumb.getContext('2d');
      ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
      metadata.preview.thumbnail = thumb.toDataURL('image/png', 0.7);
    } catch {
      metadata.preview.thumbnail = null;
    }
  }

  return metadata;
}

export function restoreRuntimeSaveMetadata(metadata = {}, {
  playableScenarios,
  moments,
  gameState,
  uiController,
  upgradeController
} = {}) {
  const restored = {
    playable: false,
    moments: false,
    uiState: false,
    upgrades: false
  };

  if (metadata.playable && playableScenarios?.restore) {
    restored.playable = !!playableScenarios.restore(metadata.playable, { announce: false });
  }

  if (metadata.moments && moments?.restore) {
    restored.moments = !!moments.restore(metadata.moments);
  }

  if (metadata.upgrades && upgradeController?.restore) {
    restored.upgrades = !!upgradeController.restore(metadata.upgrades);
  }

  if (metadata.uiState && gameState) {
    const uiState = metadata.uiState;
    gameState.watchModeEnabled = !!(uiState.watchModeEnabled ?? uiState.watchMode);
    gameState.godModeActive = !!uiState.godModeActive;
    gameState.godModeTool = uiState.godModeTool || gameState.godModeTool || null;
    gameState.selectedCreatureType = uiState.selectedCreatureType || gameState.selectedCreatureType;
    gameState.selectedPropType = uiState.selectedPropType || gameState.selectedPropType;
    restored.uiState = true;
    uiController?.updateWatchModeUI?.();
    uiController?.updateGodModeUI?.();
    uiController?.updateSandboxUiVisibility?.();
    uiController?.updateSessionMetaVisibility?.();
  }

  return restored;
}

export function formatSavePreview(metadata = {}, timestamp = null) {
  const preview = metadata.preview || {};
  const parts = [];

  if (timestamp) {
    const date = new Date(timestamp);
    parts.push(date.toLocaleDateString(), date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }

  if (Number.isFinite(preview.worldTime)) {
    parts.push(`${Math.round(preview.worldTime)}s`);
  }

  if (Number.isFinite(preview.population)) {
    parts.push(`${preview.population} creatures`);
  }

  if (preview.scenario?.name) {
    const progress = Number.isFinite(preview.scenario.progress)
      ? ` ${Math.round(preview.scenario.progress)}%`
      : '';
    parts.push(`${preview.scenario.name}${progress}`);
  }

  return parts.filter(Boolean).join(' · ');
}
