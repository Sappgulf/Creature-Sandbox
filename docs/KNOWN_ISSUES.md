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

5. **Decided 2026-10-15: New Sandbox keeps its ~33-creature plateau; density is set per mode**
   - **Severity:** Low (decision recorded)
   - **Description:** New Sandbox runs the balanced mode, whose auto-balance floor (`minPopulation`) is 36. The ~70-creature starter herd falls to about 33 and holds there because auto-balance refills it to the floor. Births alone do not sustain it: with auto-balance off, three runs fell to 2–8 creatures by 600 s. Three 10-minute runs with the floor held 30, 34 and 32 alive, with 18–31 starvation deaths. Breeding-gate changes did not move the plateau (`SOCIAL_THRESHOLD` 55, `COOLDOWN` 12, `BOND_TIME` 0.5, `ENERGY_COST_FLAT` 10, `SEEK_MATE` 1.2, `MATE_RADIUS_MULT` 1.3, and an elder fade end of 540 each left 29–36 alive).
   - **Decision:** Keep the balanced floor at 36. Density is already a per-mode setting in `creature-sim/src/gameplay-modes.js`: Chill 40, Balanced 36, Frontier 54. Floor 48 adds about 10 creatures per run (32 → 42 alive) for about 5 more starvation deaths; floor 54 adds about 18 (→ 50 alive) for about 14 more. Scenarios do not set the floor and inherit the active mode's, so raising balanced would change the default run and every scenario started from it.
   - **Impact:** Sparse but stable on the 4000×2800 map, as before. If New Sandbox should be denser, the next lever to test is food access, not the floor: total food stays near 720 items through a 600 s baseline run while starvation continues. Reproduce the baseline with `node scripts/ecosystem-balance-probe.mjs --seconds=600 --chunk=60` against `npm run dev`.

6. **Scenario difficulty is measured, but `foodRate` does not move it; the open cases need a population or births decision**
   - **Severity:** Medium
   - **Description:** All 18 playable scenarios were played idle and assisted, three runs each, after the 2026-10-14 rescale (before-batch, 121 runs with the probe). Herd Rescue holds: idle 1/3 complete with 24 alive at two minutes, assisted 3/3. A ±25% change to `tuning.foodRate` moved no pass/fail outcome in a useful direction, so the ten trial changes were reverted. Seven scenarios clear idle with margin (predator_pressure, tiny_island, season_cycle, apex_balance, storm_chasers, stress_sanctuary, mutation_showcase). Food at the target time stays well above the `minFood` objectives, so regrowth changes move it only a little. The failing cases fail on population or births, not food: drought_rescue assisted reaches 24–25 alive against 30 at 210 s (auto-balance is off, so nothing refills), lineage_guardian does not reach generation 5 in 300 s, and nursery_watch does not reach 8 babies. prop_playground and tool_mastery need prop placements the probe does not make.
   - **Impact:** The sustain scenarios are not tuned to need the player. Item 5 kept the balanced floor, so the three failing cases stay open: drought_rescue runs with auto-balance off, so the floor cannot help it, and lineage_guardian and nursery_watch need more births. Reproduce with `node scripts/ecosystem-balance-probe.mjs --scenario=ID [--assist]`.

7. **Resolved 2026-10-18: index.html had one stray `</div>`**
   - **Status:** Fixed. The stray close was in the overflow menu footnote, not in `#hud-action-bank` as this entry first said. Element counts now balance (322 open, 322 close), so the parser no longer closes an ancestor early.
   - **Guard:** Re-run the div count after markup edits. No gate checks it yet.

8. **Index CSS sits above its advisory budget**
   - **Severity:** Low
   - **Description:** `check:bundle` reports the index stylesheet at ~160 kB against a 150 kB advisory. The check does not fail on it.
   - **Impact:** Advisory only. Trim or split `styles.css` when the next stylesheet pass lands.

9. **Resolved 2026-10-14: game-mode food multipliers were inert and compounding**
   - **Status:** Fixed. `WorldEnvironment` initializes `foodRateMultiplier` to 1, and each mode now sets an absolute food rate through `GameplayModes.syncFoodRate()`. Before, `clamp(undefined * k)` gave NaN, which `WorldEcosystem.foodGrowthRate()` ignored, and the in-place multipliers compounded on repeated applies. A New Sandbox reseed and leaving a scenario run both re-sync the active mode.
   - **Measured:** The knob readout now gives chill 1.25 (growth ×1.25), balanced 1.0, frontier 1.0 and mayhem 0.8. Three 300s sandbox runs per mode (before against after): chill food 663 → 743 with the after runs entirely above the before runs, starvation 21 → 18. Mayhem food 731 → 677 and starvation 15 → 20, in the intended direction, but its population runs overlap (before 4–13, after 13–17), so that evidence is weak. Frontier's 1.05 measured no population or starvation change, so it was set back to base: its population comes from its `minPopulation` floor. Balanced is the base rate, so nothing changed.
10. **Resolved 2026-10-18: the Scenario Editor and the phone inspector sheet**

- **Status:** Fixed. The Scenario Editor and the Analytics Dashboard use the shared glass tokens (`.scenario-editor-panel`, `.analytics-dashboard`, and the form rules in `styles.css`). Their inline styles and injected stylesheet are gone. On a phone, the control strip and the stats chip stay above an open inspector sheet (`body.inspector-sheet-open`), so one tap acts on the strip instead of closing the sheet.
- **Still as designed:** A tap on the world with the sheet open still closes it.

11. **Resolved 2026-10-15: creature sprite sheets regenerate from the repo**

- **Severity:** Low
- **Description:** `creature-sim/assets/sprites/sprite-manifest.json` credits the creature sheets to `scripts/generate-creature-sprites.py`. That script is tracked in git and needs only the Python standard library. Regenerating into a scratch directory reproduces the nine committed creature sheets byte-for-byte. The earlier note that the script was missing was wrong.
- **Impact:** Creature art and animation loops can be redrawn by editing that script and running `python3 scripts/generate-creature-sprites.py`, which writes only creature sheets. Do not use `scripts/generate-sprite-sheets.mjs` for creatures: it does not produce them, and unfiltered runs rewrite the rock, tree and scenario-card sheets. Use `SPRITE_ONLY=` there for food and props.

12. **Eco Health reads about 0.00 in normal play (analytics scale, not a crash)**

- **Severity:** Low (the readout misleads; no gameplay effect)
- **Description:** `AdvancedStatsCalculator.calculateEcosystemStats` sets `foodAvailability = food / (width × height / 180)`. On the 4000×2800 world that capacity is about 62,000, while the sandbox holds 300–700 food, so the term is roughly 0.005 and the health score prints as 0.00 in both worker and main-thread modes. The 2026-10-18 fix removed the worker-mode NaN (the mirror has no `maxFood`). It did not change this scale.
- **Impact:** The Analytics Dashboard shows `Eco Health: 0.00`, and its insight line calls health "steady (0.00)". Decide the intended scale first, for example a food target near the baseline of about 720 items, or a different definition. Then change the formula and check it with the balance probe.
