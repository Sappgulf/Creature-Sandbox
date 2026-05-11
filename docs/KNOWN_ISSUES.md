# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Camera world bounds are generous (200px margin)**
   - **Severity:** Low
   - **Description:** Camera clamping uses a 200px margin beyond world edges. Creatures very near the border may still appear partially off-screen after aggressive panning.
   - **Workaround:** Use focus-on-creature or the re-center button to snap back.

2. **Worker simulation mode remains opt-in**
   - **Severity:** Low
   - **Description:** `?worker=1` now exposes the same attachment contract as the main-thread world for lineage, particles, heatmaps, audio, notifications, achievements, family bonds, and memory learning, but worker mode is still not the default shipping path.
   - **Impact:** Main-thread play is the release path. Worker mode should be smoke-tested explicitly before using it as a primary runtime.
