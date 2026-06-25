# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Camera world bounds still allow partial off-screen creatures (80px margin)**
   - **Severity:** Low
   - **Description:** Camera clamping uses an 80px margin beyond world edges. Creatures very near the border may still appear partially off-screen after aggressive panning.
   - **Workaround:** Use focus-on-creature or the re-center button to snap back.

2. **Main-thread simulation is now an explicit fallback, not the performance default**
   - **Severity:** Low
   - **Description:** Worker runtime is the shipping default after candidate-ready proof. Main-thread mode remains available through `?worker=0`, saved runtime preference, and `npm run smoke:main`.
   - **Impact:** Keep the main-thread fallback smoke green before changing runtime selection, save/load, or proxy contracts.

3. **Desktop main-thread heavy final state is still below 60fps**
   - **Severity:** Medium
   - **Description:** The forced main-thread desktop smoke is improved but still not a 60fps claim: latest fallback proof sampled desktop avg `33.37ms` / p95 `49.9ms`, with profiled non-`drawImage` work at `3.4038ms/frame`. Top scoped costs remain `world-step`, `render`, and `subsystem-update`.
   - **Impact:** Treat desktop main-thread pacing as environment-sensitive and fallback-only. Worker default proof is the release performance lane.
