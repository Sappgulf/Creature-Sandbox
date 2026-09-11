# Known Issues

List issues that could not be fixed quickly, with severity and reproduction steps.

1. **Main-thread simulation is now an explicit fallback, not the performance default**
   - **Severity:** Low
   - **Description:** Worker runtime is the shipping default after candidate-ready proof. Main-thread mode remains available through `?worker=0`, saved runtime preference, and `npm run smoke:main`.
   - **Impact:** Keep the main-thread fallback smoke green before changing runtime selection, save/load, or proxy contracts.

2. **Desktop main-thread heavy final state is still below 60fps**
   - **Severity:** Medium
   - **Description:** The forced main-thread desktop smoke remains environment-sensitive: latest fallback proof sampled desktop avg `58.88ms` / p95 `100.4ms` with the top scoped costs at `world-step` and `render`. Worker-mode desktop headless runs also land above the `26ms` avg gate (`47-55ms` across runs) while the worker gate is held.
   - **Impact:** Treat desktop pacing as environment-sensitive. Mobile worker pacing is healthy (p95 `33.4ms` after adaptive resolution engages); worker default proof remains the release performance lane.

3. **Overlay stacking now uses `--z-*` tokens; keep new UI on those rungs**
   - **Severity:** Low
   - **Description:** `styles.css` maps HUD / panel / drawer / sheet / modal / toast / tutorial / a11y to `--z-*` variables. Numeric literals are gone from the stylesheet. New floating UI should pick an existing rung rather than inventing a number.
   - **Workaround:** None.

4. **Skip-link and ripple timing now share the token set; leftover one-offs may remain**
   - **Severity:** Low
   - **Description:** Skip-link uses `--transition-fast`. Ripple keyframes remain 0.4s to match `--transition-slow`. Isolated raw durations may still exist on older one-off widgets.
   - **Impact:** Barely perceptible.
