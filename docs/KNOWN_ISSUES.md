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

4. **`z-index` scale in styles.css is ad hoc, not a defined system**
   - **Severity:** Low
   - **Description:** Values in active use span `1, 6, 10, 50, 55, 59, 60, 82, 100, 150, 190, 200, 260, 1000, 1200, 2000, 5100, 9999` with no apparent tiering (e.g. a dedicated tooltip/modal/toast scale). Nothing is broken today, but it raises the odds of a future overlay-stacking bug as more panels/drawers get added.
   - **Workaround:** None needed currently. Worth a dedicated pass to consolidate into a small documented scale (e.g. base UI / overlays / tooltips / toasts / modals) before adding more floating UI.

5. **Minor transition-timing inconsistency on a few one-off interactive elements**
   - **Severity:** Low
   - **Description:** Most buttons consistently use the `var(--transition-fast/normal/slow)` tokens, but a small number of elements hardcode raw durations that don't match nearby similar elements (e.g. `.ctrl-btn.ripple`-adjacent rules around styles.css:2550-2557 use `0.1s`/`0.2s ease-out` while most buttons use the shared tokens).
   - **Impact:** Barely perceptible; flagged for a future pass rather than blocking anything.
