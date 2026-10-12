import assert from 'node:assert/strict';

export function summarizeRuntimeReadiness(
  results,
  { shippingDefaultRuntime = 'worker', forcedRuntimeMode = null } = {}
) {
  const workerMode = (forcedRuntimeMode || shippingDefaultRuntime) === 'worker';
  const scenarioRows = results.map(result => {
    const framePacing = result.framePacing || {};
    const runtime = result.perf?.runtime || {};
    const workerDiagnostics = runtime.workerDiagnostics || {};
    const scenarioResult = result.scenarioResult || {};
    const layoutGuard = result.layoutGuard || {};
    return {
      scenario: result.scenario,
      mode: runtime.workerMode ? 'worker' : 'main',
      runtimeModeSource: runtime.runtimeModeSource || null,
      storedPreference: runtime.runtimeModeStored || null,
      workerReady: workerDiagnostics.ready ?? runtime.workerReady ?? null,
      workerPendingMessages: workerDiagnostics.queuedCommands ?? runtime.workerPendingMessages ?? null,
      workerErrorCount: workerDiagnostics.errorCount ?? null,
      workerSnapshotCount: workerDiagnostics.snapshotCount ?? null,
      workerSnapshotAgeMs: workerDiagnostics.lastSnapshotAgeMs ?? null,
      creatures: result.creatures,
      food: result.food,
      frames: framePacing.frames ?? null,
      avgFrameMs: framePacing.avgFrameMs ?? null,
      p95FrameMs: framePacing.p95FrameMs ?? null,
      framesOver50ms: framePacing.framesOver50ms ?? null,
      profiledNonDrawImagePerFrameMs: framePacing.mainThread?.profiledNonDrawImagePerFrameMs ?? null,
      topScope: framePacing.mainThread?.topScopes?.[0]?.name || null,
      scenarioResultComplete: scenarioResult.complete === true,
      scenarioResultAnchored: scenarioResult.anchored === true,
      scenarioResultInViewport: scenarioResult.inViewport === true,
      scenarioHistoryCount: Number(scenarioResult.historyCount || 0),
      layoutGuardPassed: layoutGuard.passed === true,
      cumulativeLayoutShift:
        layoutGuard.metrics?.startupCumulativeLayoutShift ?? layoutGuard.metrics?.cumulativeLayoutShift ?? null,
      minTouchTarget: layoutGuard.metrics?.minTouchTarget ?? null
    };
  });

  const desktop = scenarioRows.find(row => row.scenario === 'desktop') || null;
  const mobileRows = scenarioRows.filter(row => row.scenario.startsWith('mobile-'));
  const runtimeStatusesOk = scenarioRows.every(
    row => row.mode === 'main' || (row.workerReady === true && row.workerPendingMessages === 0)
  );
  const contextsComplete = ['desktop', 'mobile-compact', 'mobile-large'].every(name =>
    scenarioRows.some(row => row.scenario === name)
  );
  const frameMeasurementsComplete = scenarioRows.every(
    row =>
      Number.isFinite(row.frames) &&
      row.frames >= 1 &&
      Number.isFinite(row.avgFrameMs) &&
      row.avgFrameMs > 0 &&
      Number.isFinite(row.p95FrameMs) &&
      row.p95FrameMs > 0
  );
  const completedScenarioResultsOk =
    contextsComplete &&
    scenarioRows.every(
      row =>
        row.scenarioResultComplete &&
        row.scenarioResultAnchored &&
        row.scenarioResultInViewport &&
        row.scenarioHistoryCount >= 1
    );
  const layoutGuardsOk = scenarioRows.every(row => row.layoutGuardPassed === true);
  const mobileP95Max = Math.max(0, ...mobileRows.map(row => Number(row.p95FrameMs) || 0));
  const desktopAvg = Number(desktop?.avgFrameMs) || 0;
  const desktopP95 = Number(desktop?.p95FrameMs) || 0;
  const desktopProfiledNonDraw = desktop?.profiledNonDrawImagePerFrameMs;
  const workerCandidate =
    workerMode &&
    frameMeasurementsComplete &&
    runtimeStatusesOk &&
    completedScenarioResultsOk &&
    layoutGuardsOk &&
    desktopAvg > 0 &&
    desktopAvg <= 26 &&
    desktopP95 <= 40 &&
    Number.isFinite(desktopProfiledNonDraw) &&
    desktopProfiledNonDraw >= 0 &&
    desktopProfiledNonDraw <= 1.5 &&
    mobileP95Max <= 20;
  const defaultRun = forcedRuntimeMode === null;
  const safeToDefaultWorker = workerMode && workerCandidate;
  const status = workerMode
    ? workerCandidate
      ? defaultRun
        ? 'shipping-default'
        : 'candidate-opt-in'
      : 'needs-more-proof'
    : defaultRun
      ? 'shipping-default'
      : 'fallback-proof';

  return {
    generatedAt: new Date().toISOString(),
    mode: workerMode ? 'worker' : 'main',
    shippingDefault: shippingDefaultRuntime,
    defaultChanged: shippingDefaultRuntime === 'worker',
    status,
    workerCandidate,
    defaultReadiness: {
      safeToDefaultWorker,
      reason: workerMode
        ? workerCandidate
          ? defaultRun
            ? 'Worker is the shipping default and this run meets frame, runtime, and completed-scenario result gates.'
            : 'Forced worker smoke meets the candidate frame, runtime, and completed-scenario result gates.'
          : defaultRun
            ? 'Worker is configured as the shipping default but missed one or more gates; treat this as a release blocker and use explicit main fallback only until fixed.'
            : 'Forced worker smoke missed one or more readiness gates in this run; keep forced worker promotion held until frame thresholds, runtime status, and completed-scenario result proof all pass.'
        : 'Main-thread mode remains available as an explicit fallback path.'
    },
    completedScenarioResultFlow: {
      required: true,
      passed: completedScenarioResultsOk && layoutGuardsOk,
      scenarios: scenarioRows.map(row => ({
        scenario: row.scenario,
        complete: row.scenarioResultComplete,
        anchored: row.scenarioResultAnchored,
        inViewport: row.scenarioResultInViewport,
        historyCount: row.scenarioHistoryCount,
        layoutGuardPassed: row.layoutGuardPassed,
        cumulativeLayoutShift: row.cumulativeLayoutShift,
        minTouchTarget: row.minTouchTarget
      }))
    },
    thresholds: {
      workerDesktopAvgFrameMsMax: 26,
      workerDesktopP95FrameMsMax: 40,
      workerDesktopProfiledNonDrawImagePerFrameMsMax: 1.5,
      workerMobileP95FrameMsMax: 20,
      workerPendingMessagesMax: 0,
      completedScenarioResultsRequired: true,
      layoutGuardRequired: true,
      cumulativeLayoutShiftMax: workerMode ? 0.1 : 0.15,
      mobileTouchTargetMinPx: 40
    },
    scenarios: scenarioRows
  };
}

export function assertRuntimeReadiness(readiness) {
  const ready =
    readiness?.completedScenarioResultFlow?.passed === true &&
    (readiness.mode === 'main' || readiness.defaultReadiness?.safeToDefaultWorker === true);
  assert.ok(
    ready,
    `Runtime readiness failed (${readiness?.mode}): ${readiness?.status}. ${readiness?.defaultReadiness?.reason || 'Missing completed scenario/layout proof.'}`
  );
}
