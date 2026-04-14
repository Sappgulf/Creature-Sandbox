# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Camera world bounds are generous (200px margin)**
   - **Severity:** Low
   - **Description:** Camera clamping uses a 200px margin beyond world edges. Creatures very near the border may still appear partially off-screen after aggressive panning.
   - **Workaround:** Use focus-on-creature or the re-center button to snap back.

2. **Simulation proxy attachment stubs are no-ops**
   - **Severity:** Low
   - **Description:** `simulation-proxy.js` has 7 empty attachment methods (attachHeatmapSystem, attachAudioSystem, etc.) that are called but do nothing outside worker mode.
   - **Impact:** No runtime errors; subsystems attach directly on the main thread instead.
