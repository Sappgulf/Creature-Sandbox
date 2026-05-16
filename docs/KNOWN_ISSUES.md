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

3. **Physical-device feel is not fully automated**
   - **Severity:** Low
   - **Description:** The browser smoke lanes cover desktop plus mobile-sized Chromium contexts, deterministic gameplay wiring, real-time frame sampling, and offline reload. They do not prove hand feel on a real touch device.
   - **Impact:** Drag/throw comfort, safe-area spacing, heat/battery behavior, and long-session auto-director feel still need manual phone/tablet verification before a mobile-focused release.

4. **Saves and profile preferences use separate local storage**
   - **Severity:** Low
   - **Description:** Game saves and slot previews serialize runtime world/scenario state, while tutorial completion, tooltip dismissal, accessibility preferences, mobile preferences, last spawn type, camera bookmarks, playable progress, and summary caches remain browser-local profile data.
   - **Impact:** A downloaded or slot-loaded save does not behave like cross-device account sync. Switching browsers/devices can preserve the world only when a save file is moved manually.
