# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Camera world bounds are generous (200px margin)**
   - **Severity:** Low
   - **Description:** Camera clamping uses a 200px margin beyond world edges. Creatures very near the border may still appear partially off-screen after aggressive panning.
   - **Workaround:** Use focus-on-creature or the re-center button to snap back.

2. **Worker simulation mode remains opt-in**
   - **Severity:** Low
   - **Description:** `?worker=1` now has a checked worker smoke lane for startup, spawn, food, Watch Mode, snapshot-only save/load parity, save-slot preview, runtime preference storage, runtime-toggle UI, `Apex Balance` scenario metadata save parity, an extended scenario soak, screenshots, frame pacing, `drawImage` profiling, main-thread scope profiling, runtime metadata, worker error/snapshot diagnostics, and `runtime-readiness.json`, but worker mode is still not the default shipping path. The latest loaded-machine run passed functionally but reported `status: "needs-more-proof"` because frame thresholds were missed.
   - **Impact:** Main-thread play and completed-scenario result flow remain the release path. Run `npm run smoke:worker` before changing worker proxy, bridge, save, or runtime-selection code.

3. **Desktop main-thread heavy final state is still below 60fps**
   - **Severity:** Medium
   - **Description:** The final browser-smoke desktop state has repeated LOD, particle, food-rendering, canvas-scale, query-buffer, and render-allocation optimizations, but it is still not a 60fps claim. The latest loaded local run, while a concurrent DeskBuddy/Xcode build was consuming significant CPU, sampled desktop main-thread smoke at `187.75ms` average / `201ms` p95, with profiled non-`drawImage` work at `17.775ms/frame`; earlier in the same pass, with less local CPU pressure, it sampled `32.1ms` average / `50ms` p95. Top scoped costs remain `world-step`, `render`, and `subsystem-update`.
   - **Impact:** Treat desktop main-thread pacing as environment-sensitive and still release-limited. The next pass should target `world-step`/`subsystem-update` before changing the worker default.
