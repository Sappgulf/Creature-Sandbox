# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Camera world bounds are generous (200px margin)**
   - **Severity:** Low
   - **Description:** Camera clamping uses a 200px margin beyond world edges. Creatures very near the border may still appear partially off-screen after aggressive panning.
   - **Workaround:** Use focus-on-creature or the re-center button to snap back.

2. **Worker simulation mode remains opt-in**
   - **Severity:** Low
   - **Description:** `?worker=1` now has a checked worker smoke lane for startup, spawn, food, Watch Mode, snapshot-only save/load parity, save-slot preview, runtime preference storage, runtime-toggle UI, `Apex Balance` scenario metadata save parity, screenshots, frame pacing, `drawImage` profiling, and runtime metadata, but worker mode is still not the default shipping path.
   - **Impact:** Main-thread play and completed-scenario result flow remain the release path. Run `npm run smoke:worker` before changing worker proxy, bridge, save, or runtime-selection code.

3. **Desktop main-thread heavy final state is still below 60fps**
   - **Severity:** Medium
   - **Description:** The final browser-smoke desktop state is improved after LOD, particle, food-rendering, and canvas-scale changes, but still samples around `34.65ms` average / `50ms` p95 on this machine. Mobile smoke stays near 60fps, and worker desktop is smoother at `19.15ms` average / `33.4ms` p95.
   - **Impact:** Treat worker mode as the candidate smooth lane. The next main-thread pass should profile non-`drawImage` frame cost in dense food/particle/final-panel states before claiming 60fps desktop.
