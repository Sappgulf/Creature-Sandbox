# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Camera world bounds are generous (200px margin)**
   - **Severity:** Low
   - **Description:** Camera clamping uses a 200px margin beyond world edges. Creatures very near the border may still appear partially off-screen after aggressive panning.
   - **Workaround:** Use focus-on-creature or the re-center button to snap back.

2. **Worker simulation mode remains opt-in**
   - **Severity:** Low
   - **Description:** `?worker=1` now has a checked worker smoke lane for startup, spawn, food, Watch Mode, snapshot-only save/load parity, save-slot preview, runtime preference storage, screenshots, frame pacing, `drawImage` profiling, and runtime metadata, but worker mode is still not the default shipping path.
   - **Impact:** Main-thread play and full playable-scenario reset remain the release path. Run `npm run smoke:worker` before changing worker proxy, bridge, save, or runtime-selection code.
