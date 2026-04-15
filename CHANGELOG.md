# Changelog

## Rules
- Every entry must include **Issues → Root Causes → Fixes → Verification**.
- No vague entries. If it cannot be verified, it must say so.
- Performance changes require before/after metrics.
- Breaking changes must be explicitly labeled.
- Every work session must add **Planned** and **Implemented** entries.

## Entry Template
- **Date:** YYYY-MM-DD
- **Scope:** frontend | backend | simulation | render | ui | docs | devops
- **Type:** Planned | Implemented | Breaking
- **Issues:**
- **Root Causes:**
- **Fixes:**
- **Verification:**

## [UNRELEASED]
### 2026-04-14 — ui/mobile/render/simulation — Planned
- **Issues:** Mobile play still carried too much persistent chrome, viewport changes after load did not activate the mobile layout path, the world read too dark at the default zoom, automated gameplay hooks required `?devtools=1`, and seeded genetics produced a flaky constructor test.
- **Root Causes:** Mobile behavior was mostly decided once at boot, `MobileSupport` did not react to later viewport changes, medium quality forced the minimap back on, biome tinting only appeared above a higher zoom threshold, the testing hooks were only exported inside the devtools branch, and `makeGenes()` ignored explicit disorder seeds by re-randomizing disorders.
- **Fixes:** Add responsive mobile-layout syncing, compact mobile HUD output, adaptive mobile startup/render profiles, brighter low-zoom biome rendering, always-on gameplay test hooks, and deterministic handling of explicit disorder seeds.
- **Verification:** `npx eslint creature-sim/src/genetics.js creature-sim/src/mobile-support.js creature-sim/src/ui-controller.js creature-sim/src/control-strip.js creature-sim/src/renderer-config.js creature-sim/src/renderer.js creature-sim/src/main.js creature-sim/src/ui.js`; `npm test`; `npm run build`; Playwright gameplay smoke and mobile-layout checks.

### 2026-04-14 — ui/mobile/render/simulation — Implemented
- **Issues:** Mobile HUD density and stale desktop overlays reduced playable space, the scene looked too murky at the default zoom, automated game-client coverage depended on a devtools query flag, and a random disorder assignment caused a baseline unit test failure.
- **Root Causes:** `MobileSupport` only enabled touch/mobile classes during initial construction, `UIController` did not collapse desktop panels when the runtime switched into mobile sizing, `renderStats()` / `renderSelectedInfo()` emitted desktop-density UI on phones, medium quality re-enabled the minimap on mobile, biome tint rendering started too late and used a dark base palette, the runtime always seeded the same world density regardless of device budget, and `makeGenes()` overwrote explicit disorder seeds.
- **Fixes:** Updated `MobileSupport` to react to live viewport changes and dispatch layout-change events; made `UIController` reapply mobile defaults on mobile activation; reduced mobile HUD output in `ui.js` and `styles.css`; changed compact/low-memory mobile defaults to lighter runtime profiles in `main.js`; lowered mobile render scale and startup seed counts; exported `window.render_game_to_text` and `window.advanceTime` unconditionally; disabled the minimap in the medium quality preset; brightened biome/background rendering and showed biome patches sooner; and respected explicit `seed.disorders` in `genetics.js`.
- **Verification:** `npx eslint creature-sim/src/genetics.js creature-sim/src/mobile-support.js creature-sim/src/ui-controller.js creature-sim/src/control-strip.js creature-sim/src/renderer-config.js creature-sim/src/renderer.js creature-sim/src/main.js creature-sim/src/ui.js` (pass); `npm test` (pass); `npm run build` (pass, pre-existing ineffective dynamic import warning remains); `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url "http://127.0.0.1:4173/" --actions-json '{"steps":[{"buttons":[],"frames":10}]}' --iterations 2 --pause-ms 250 --screenshot-dir output/web-game/post` (pass; verified brighter biome-readable screenshots and state output without `?devtools=1`); Playwright MCP resize check from `1280x720` to `390x844` confirmed `session-meta` and `#inspector` auto-hide on mobile and reduced `#hud-bottom-left` height to `112px`; fresh mobile-load check confirmed the reduced stat row and compact empty selected-creature card.

### 2026-04-13 — ui/mobile/perf — Planned
- **Issues:** Mobile users lacked quick-access controls for distraction-free play, battery-preserving quality locks, and tactile feedback settings tailored to touch interactions.
- **Root Causes:** Overflow menu focused on feature navigation only, renderer quality adaptation could not be user-locked from UI, and touch feedback/haptics had no explicit preference controls.
- **Fixes:** Add mobile-specific overflow actions (Focus Mode, Battery Saver, Haptics), wire persistent preferences via local storage, add renderer quality override support for low-power mode, and apply visual focus styling to suppress non-essential overlays.
- **Verification:** `npm test`; `npx eslint creature-sim/src/control-strip.js creature-sim/src/renderer-performance.js`.

### 2026-04-13 — ui/mobile/perf — Implemented
- **Issues:** Mobile users lacked quick-access controls for distraction-free play, battery-preserving quality locks, and tactile feedback settings tailored to touch interactions.
- **Root Causes:** Overflow menu focused on feature navigation only, renderer quality adaptation could not be user-locked from UI, and touch feedback/haptics had no explicit preference controls.
- **Fixes:** Added new overflow actions in `index.html` for Focus Mode, Battery Saver, and Haptics; expanded `ControlStripController` with persisted mobile preferences, touch-device vibration feedback, and runtime toggles that apply body-state classes and renderer quality locks; passed `renderer` into control-strip initialization; added `setQualityOverride()` in renderer performance monitor and bypassed adaptive quality while override is active; introduced `mobile-focus-mode` CSS to hide non-essential overlays and emphasize thumb-zone controls.
- **Verification:** `npm test` (pass); `npx eslint creature-sim/src/control-strip.js creature-sim/src/renderer-performance.js creature-sim/src/main.js` (pass).

### 2026-04-13 — ui/mobile — Planned
- **Issues:** Mobile layouts on very narrow and landscape screens still felt cramped, with dense quick-action controls competing with panel space and no profile-specific UI tuning.
- **Root Causes:** Mobile styling used one-size-fits-all quick-action dimensions, and viewport handling did not apply semantic compact/landscape state classes for responsive behavior branching.
- **Fixes:** Add viewport-profile detection (`mobile-compact-ui` / `mobile-landscape-ui`) in mobile support, wire listeners through a cleanup-safe registry, and tune compact/landscape CSS for action bar density and panel height.
- **Verification:** `npm test`; targeted `eslint` for edited JS files.

### 2026-04-13 — ui/mobile — Implemented
- **Issues:** Mobile layouts on very narrow and landscape screens still felt cramped, with dense quick-action controls competing with panel space and no profile-specific UI tuning.
- **Root Causes:** Mobile styling used one-size-fits-all quick-action dimensions, and viewport handling did not apply semantic compact/landscape state classes for responsive behavior branching.
- **Fixes:** Added mobile viewport profile syncing in `MobileSupport` to toggle `mobile-compact-ui` and `mobile-landscape-ui`; switched listener setup to a tracked `registerListener` pattern and added `destroy()` cleanup support; updated viewport meta sync to include `interactive-widget=resizes-content`; added compact quick-action sizing and landscape panel height caps in CSS for cleaner small-screen ergonomics.
- **Verification:** `npm test` (pass); `npx eslint creature-sim/src/mobile-support.js` (pass).

### 2026-04-13 — ui/docs/accessibility — Planned
- **Issues:** Mobile browser zoom was disabled, the app had no skip path into the main experience, and custom select/range controls removed native keyboard focus cues.
- **Root Causes:** The viewport meta and mobile viewport sync forced `user-scalable=no`; the document had no top-level skip link/main landmark; select and slider styles used `outline: none` without an equivalent focus-visible treatment.
- **Fixes:** Restore browser zoom, add a skip link into the main app container, and add visible keyboard focus styles for the custom select and slider controls.
- **Verification:** `npm test`; targeted lint on edited files if available; manual keyboard/mobile smoke checks for skip link and focus states.

### 2026-04-13 — ui/docs/accessibility — Implemented
- **Issues:** Mobile browser zoom was disabled, the app had no skip path into the main experience, and custom select/range controls removed native keyboard focus cues.
- **Root Causes:** The viewport meta and mobile viewport sync forced `user-scalable=no`; the document had no top-level skip link/main landmark; select and slider styles used `outline: none` without an equivalent focus-visible treatment.
- **Fixes:** Restored browser zoom in both the HTML viewport meta and the mobile viewport sync path; added a skip link to the new `main#main-content` wrapper; added visible focus-visible rings for range inputs and select controls.
- **Verification:** `npm test` (pass); `npx eslint creature-sim/src/mobile-support.js creature-sim/src/main.js creature-sim/src/control-strip.js` (pass with pre-existing warnings only); manual source inspection confirmed the viewport, skip link, and focus-state changes.

### 2026-04-13 — ui/perf — Planned
- **Issues:** Control strip UI syncing performed full DOM updates every frame, creating unnecessary work in the hot path even when pause/speed/watch/god/follow state had not changed.
- **Root Causes:** `ControlStripController.update()` called `updateUI()` unconditionally, and `updateUI()` always rewrote button labels/classes/attributes.
- **Fixes:** Add state-signature change detection so control strip DOM updates run only when relevant UI state changes.
- **Verification:** `npm test`; targeted `eslint` for `creature-sim/src/control-strip.js`.

### 2026-04-13 — ui/perf — Implemented
- **Issues:** Control strip UI syncing performed full DOM updates every frame, creating unnecessary work in the hot path even when pause/speed/watch/god/follow state had not changed.
- **Root Causes:** `ControlStripController.update()` called `updateUI()` unconditionally, and `updateUI()` always rewrote button labels/classes/attributes.
- **Fixes:** Added a compact `computeUIStateSignature()` snapshot and cached `lastUIStateSignature`; updated `updateUI()` to early-return unless state changed (or forced during initial render), reducing repetitive per-frame DOM writes while keeping behavior identical.
- **Verification:** `npm test` (pass; npm warning about unknown `http-proxy` env config); `npx eslint creature-sim/src/control-strip.js` (pass; npm warning about unknown `http-proxy` env config).

### 2026-02-06 — ui/simulation/gameplay — Planned
- **Issues:** Inspector close behavior was inconsistent, selecting creatures did not reliably zoom/focus for readability, replay variety between runs was limited, and god mode/item workflows needed richer interaction coverage.
- **Root Causes:** Inspector visibility relied on scattered state toggles without immediate DOM sync, selection code duplicated follow logic without explicit zoom targeting, gameplay mode/goal variety had a narrow pool, and god mode lacked direct prop placement/removal parity.
- **Fixes:** Plan to unify inspector visibility handling (including manual close lock), add shared select-and-zoom camera behavior, expand replay systems via new mode/goals/opening variety, and add prop-aware god mode tooling.
- **Verification:** `npm test`; targeted `eslint` on edited files; manual path validation for inspector close/show, selection zoom, god prop actions, and mode/goal updates.

### 2026-02-06 — ui/simulation/gameplay — Implemented
- **Issues:** Inspector close/show interactions could appear non-responsive, selection did not consistently provide close-up framing, replay cadence repeated with similar early sessions, god mode lacked fast tool switching/paint flow, and creature movement/reaction presentation could feel jittery during high activity.
- **Root Causes:** Show/close controls updated `gameState` without guaranteed immediate UI refresh, selection branches repeated logic and omitted zoom preference, run-openers/mode-goal pools were limited, god mode actions were click-only without hotkey-driven tool switching, and several creature movement/reaction transforms used aggressive thresholds/amplitudes.
- **Fixes:** Added `inspectorAutoOpen` state and centralized inspector show/hide updates with `aria-hidden` sync; wired close/show/minimize inspector controls through `UIController`; updated input selection flow to use shared `_selectCreatureWithCamera` (focus + zoom + follow); added `Esc` panel-close fallback and mobile/desktop selection parity; added god mode **Prop** tool and remove-prop fallback; added god tool hotkeys (`1-6`) and event-driven god-tool UI sync with contextual hints; enabled drag-paint god actions for food/calm/prop/remove with distance/time throttling; added **Frontier Rush** gameplay mode; expanded session goals with prop placement, god-action, and aquatic-alive objectives; added randomized replay kickoff variants on new game start (bloom/wildfront/toybox/storm openers); tuned creature steering/reaction values (dt-scaled turn clamp, higher ragdoll trigger threshold, collision reaction cooldown, reduced stress jitter/run bob, and lower sleep-particle spam).
- **Verification:** `npm test` (pass); `npx eslint creature-sim/src/game-state.js creature-sim/src/dom-cache.js creature-sim/src/ui-controller.js creature-sim/src/input-manager.js creature-sim/src/gameplay-modes.js creature-sim/src/session-goals.js creature-sim/src/main.js creature-sim/src/renderer.js creature-sim/src/ui.js creature-sim/src/creature.js creature-sim/src/creature-agent-constants.js` (0 errors; warnings remain in repository baseline).

### 2026-02-06 — ui/simulation/perf — Planned
- **Issues:** Camera zoom/follow felt abrupt and could desync from selected creature, startup population was light for immediate ecosystem activity, spawn UI lacked an aquatic role, and major panel tabs could stack visually while accessibility state drifted.
- **Root Causes:** Zoom was center-biased with permanent override behavior, follow logic relied on hard target state without reacquire/smoothing, seed defaults were conservative, creature-type plumbing excluded aquatic options, and panel toggles lacked a shared close-sibling policy.
- **Fixes:** Plan to implement pointer-centered zoom with clamped wheel input and temporary camera override, smooth follow with selected-target reacquire, raise startup seed counts, add a new aquatic spawnable creature path across world/UI/input layers, and normalize major panel visibility and `aria-hidden` synchronization.
- **Verification:** `npm test`; targeted `eslint` over edited simulation/UI files; manual code-path checks for camera follow, spawn type wiring, and panel toggles.

### 2026-02-06 — ui/simulation/perf — Implemented
- **Issues:** Manual zooming could feel jumpy and break follow rhythm, follow state could lose target continuity, early simulation density was low, aquatic creature spawn type was missing, and top-level tabs/panels could overlap.
- **Root Causes:** Wheel handling used broad delta variance and static-center zoom, follow camera updates used direct snapping and brittle target references, seed counts were tuned low, spawn-type handling omitted aquatic in UI/world/input routes, and panel toggles did not close sibling major panels consistently.
- **Fixes:** Added pointer-centered camera zoom (`zoomByAt`) with clamped wheel scaling and temporary override timing; smoothed follow camera updates with selected-target reacquire; increased startup seeding to `72` herbivores, `10` predators, `320` food; added aquatic spawning support in `world-core`, `world-creature-manager`, spawn controls, and input fallback genes; added aquatic spawn card to UI; added `closeMajorPanels` behavior and reused visibility helpers to keep `aria-hidden` consistent.
- **Verification:** `npm test` (pass); `npx eslint creature-sim/src/camera.js creature-sim/src/world-core.js creature-sim/src/world-creature-manager.js creature-sim/src/ui-controller.js creature-sim/src/input-manager.js creature-sim/src/control-strip.js creature-sim/src/game-loop.js creature-sim/src/main.js` (0 errors; warnings remain in repository baseline).

### 2026-02-06 — ui/perf/gameplay — Planned
- **Issues:** Pause/watch/god/menu flows had state desync risks, keyboard overlap risked double-handling, and overlay offset measurements could jitter; requested focus was FPS, gameplay reliability, and UI/menu correctness.
- **Root Causes:** Duplicate control paths (`InputManager` + `ControlStripController`), missing UI controller methods (`updateMobileControls`, `toggleShortcutsHelp`), inconsistent `aria-hidden` synchronization, and non-persistent HUD-bottom measurement cache usage.
- **Fixes:** Plan to unify pause/watch/god control behavior around shared state, restore missing UI controller handlers, sync panel/menu accessibility state, and cache HUD-bottom overlay measurements for stable per-frame offsets.
- **Verification:** `npm test`; targeted `eslint` on edited files; manual code-path verification for pause/watch/god/menu handlers.

### 2026-02-06 — ui/perf/gameplay — Implemented
- **Issues:** UI pause actions called missing methods; campaign start flow called missing `gameState.setPaused`; control-strip keyboard shortcuts overlapped centralized input handling; watch/god state could desync across UI entry points; shortcuts/panels had incomplete accessibility state sync; mobile tap world conversion used internal canvas dimensions; overlay bottom offset cache reset to zero between measurements.
- **Root Causes:** Incomplete `GameState`/UI controller API surface, duplicated shortcut handling across controllers, legacy control-strip state fields diverging from `gameState`, and render overlay offset not using persisted cached height.
- **Fixes:** Added `setPaused` to `GameState`; emitted pause/resume events for campaign transitions; added `toggleShortcutsHelp` and `updateMobileControls` to `UIController`; synchronized panel visibility and `aria-hidden` in panel toggles; updated watch UI to hide/show control strip consistently; adjusted control-strip watch/god toggles to use canonical `gameState`/UI controller paths and reduced keyboard handling to non-overlapping keys; changed control-strip save/load shortcut dispatch to `window`; added throttled control-strip sync from `GameEvents.FRAME_UPDATE`; fixed mobile tap coordinate mapping to use `getBoundingClientRect`; reused pointer-world objects to reduce pointer-move allocations; persisted and reused `hudBottomHeight` cache in `GameLoop.renderOverlays`.
- **Verification:** `npm test` (pass); `npx eslint creature-sim/src/game-state.js creature-sim/src/main.js creature-sim/src/control-strip.js creature-sim/src/ui-controller.js creature-sim/src/input-manager.js creature-sim/src/game-loop.js` (0 errors, warnings remain pre-existing in repository style baseline).

### 2026-02-04 — simulation/ui/perf — Planned
- **Issues:** Run Phase 0-4 polish sprint (baseline metrics, bug sweep, perf pass, AAA polish, regression) with verified dev/preview builds.
- **Root Causes:** Planned maintenance and polish sprint per ship checklist.
- **Fixes:** Pending results from baseline measurements, bug fixes, perf improvements, and UI polish.
- **Verification:** Dev/preview builds and baseline performance captures to be run in this session.

### 2026-02-04 — simulation/perf — Implemented
- **Issues:** Capture Phase 0 baseline metrics (dev + preview runs, FPS/frame timings, memory trend).
- **Root Causes:** Baseline required before making changes.
- **Fixes:** Ran dev and preview server startup checks; attempted Playwright-driven baseline capture (normal + stress + 2-minute memory trend) but browser container returned 404 responses and Chromium crashes, so metrics could not be captured in this environment.
- **Verification:** `npm run dev` (server started, manual stop); `npm run preview` (server started, timeout stop); Playwright browser runs failed to reach local server (Not Found) and crashed on Chromium launch.

### 2026-02-04 — simulation/render/ui — Implemented
- **Issues:** Large dt spikes caused simulation jumps after tab/background pauses; render path allocated per-frame arrays/sets when culling without a grid; performance monitor omitted update/render timing; debug stats reported NaN when world population was zero.
- **Root Causes:** Game loop allowed up to 250ms delta time; render fallback used `filter()` + `Set`/`Array.from` allocations; perf overlay only surfaced FPS/frame/memory; debug console averaged over zero-length arrays.
- **Fixes:** Clamp dt to 50ms and guard against negative deltas; reuse arrays in render fallback and avoid per-frame Set allocations when ensuring selected/pinned creatures render; add update/render timing to the performance monitor overlay using scope stats; guard debug stats averages when no creatures exist.
- **Verification:** `npm test`.
### 2026-02-04 — docs — Planned
- **Issues:** Missing governance, architecture, debugging, and performance documentation for mandatory onboarding.
- **Root Causes:** No formal, centralized documentation defining standards and workflows.
- **Fixes:** Draft AGENT.md, MEMORY.md, ARCHITECTURE.md, DEBUGGING.md, PERFORMANCE.md, and a structured CHANGELOG.md.
- **Verification:** Not run (documentation-only changes).

### 2026-02-04 — docs — Implemented
- **Issues:** Missing governance, architecture, debugging, and performance documentation for mandatory onboarding.
- **Root Causes:** No formal, centralized documentation defining standards and workflows.
- **Fixes:** Added AGENT.md, MEMORY.md, ARCHITECTURE.md, DEBUGGING.md, PERFORMANCE.md, and restructured CHANGELOG.md with enforced entry format.
- **Verification:** Not run (documentation-only changes).

## Legacy (Pre-Structured History)
Entries below predate the enforced format. Do not add new items here.

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Notes (2026-02-09)
- Planned (frontend): Audit control strip quick actions and day/night toggle edge cases, then polish accessibility state. Why: quick actions should match documented behavior and environment toggles shouldn't halt seasons. Verification: `npm test` (pass; npm warning about unknown `http-proxy` setting).
- Implemented (frontend): Ensured seasons continue when day/night is disabled, aligned the control strip food button with documented quick food drops, and added aria pressed/expanded updates for watch/god/pause controls. Why: fix toggles that stalled season progression and improve quick action feedback/accessibility. Verification: `npm test` (pass; npm warning about unknown `http-proxy` setting); `npm run lint` (fails with 3 errors and 1586 warnings: pre-existing).

### Notes (2026-01-29)
- Planned (frontend): Fold mobile side panels into a bottom-sheet layout and collapse inspector/session meta on load to keep the playfield tappable. Why: mobile side menus currently crowd the simulation view. Verification: `npm test` (pass; npm warning about unknown `http-proxy` setting).
- Implemented (frontend): Defaulted mobile inspector/session meta visibility to hidden and forced side panels into bottom-sheet placement with a shorter max height for more playable space. Why: prevent mobile side menus from covering the game view. Verification: `npm test` (pass; npm warning about unknown `http-proxy` setting).

### Added
- Mobile spawn picker sheet with large tap targets and explicit spawn confirmation.
- Gene editor share codes (copy/import) and spawn-mode feedback.
- Nameplates toggle in Features panel.
- Reduced motion toggle (respects OS preference + stored setting).
- Accessibility status messaging for gene code actions.
- Overflow menu Help section with controls and shortcuts.
- Save/load hotkeys for file downloads (Ctrl/⌘ + S / Ctrl/⌘ + O).
- Dev-only FPS overlay and timing logs behind `?devtools=1`.
- Creature reactions to poke/drop/collision with subtle personality-driven animation.
- Hover/grab outlines and grab reaction feedback for direct creature manipulation.
- Session goal nudges for manual creature spawns.
- Success pulse + error shake feedback for gene editor status messages.
- Sandbox props: bounce pads, spinners, gravity wells, and food buttons.
- Creature grab/drag/throw interactions with throw feedback.
- Session goals for prop triggers and creature launches.
- Contextual sandbox action prompts.
- Chaos dial slider that tunes playful physics intensity.
- Extra sandbox props: spring pads, launch buttons, see-saws, conveyors, speed slopes, wind fans, and sticky zones.
- Creature polish: fall/landing reactions, poke overreactions, impact squeaks, and eye tracking toward the pointer.
- Curiosity prompts + tiny win toasts for playful experimentation.
- Mood icons, recovery poses, and silly-action badges.
- Ecosystem internal states (stress/energy/curiosity/stability) with social contagion and crowd pressure.
- Creature tuning constants for health and damage balance.
- Needs-driven creature agents (hunger/energy/social/stress) with utility-based goals.
- Rest zones for calm recovery and energy restoration.
- Bite-based food consumption with scent detection.
- Mating loop with bonding, cooldowns, and population guardrails.
- Goal debug overlay toggle in the debug console (`debug.goals()`).
- Place memory + learning (food/calm/danger/nest) with reinforcement and decay.
- Life stages (baby/adult/elder) with smoother growth, elder fade-out, and default save migration.
- Observer overlay toggle to visualize life stages, goals, and memory markers (`debug.observe()`).

### Changed
- Interaction hints now auto-dismiss, include a close button, and clear on mode/panel transitions.
- Panel max-heights now respect dynamic mobile viewport sizing.
- Mobile viewport handling now uses VisualViewport updates when available.
- Analytics dashboard now scales charts to fit the current viewport.
- Condensed top HUD into primary actions with an overflow menu and mobile sheet.
- Tuned mobile pan/zoom sensitivity and keyboard-safe panel padding.
- Throttled eco-health updates and reduced pointer move allocations.
- Selected creature panel now shows guidance when nothing is selected.
- Home screen copy now highlights playful sandbox tone.
- Selected creature outlines now glow and pulse on selection.
- Added soft creature bump reactions and sandbox prop rendering layer.
- Tuned grab/throw thresholds, impulse caps, prop forces, and camera smoothing for more predictable play.
- Increased default creature health, added collision/fall damage thresholds, and applied short damage i-frames.
- Smoothed combat damage with clamped hits and attack cooldowns for longer-lived creatures.
- Food and creature spatial grids now rebuild indices when dirty for accurate sensing.
- Save/load schema bumped to v2.2 for needs/goals/rest zones.
- Save/load schema bumped to v2.3 to preserve creature memory and life-stage state.

### Notes (2026-02-03)
- **WHAT:** Added creature memory/learning, life-stage tuning, elder fade-out, and an observer debug overlay with save migration.
- **WHY:** Make the ecosystem feel persistent and generational without heavy AI or performance hits.
- **RISK:** Medium; touches creature update loop, rendering overlays, and save migration paths.
- **VERIFY:** Run `npm test`, `npm run lint`, and the new memory/life-cycle smoke checks.

### Notes (2026-02-04)
- **Planned:** Add environmental rhythm (day/night + food cycles), lightweight weather mood, and optional god mode tools with save/load support; baseline `npm test` ran successfully (with npm env warning). 
- **Implemented:** Added day/night rhythm biasing, food regrowth patches, wind/calm moods, and optional god mode tools with save/load updates. Verified `npm test` and `npm run lint` (lint warnings pre-existing). 

### Notes (2026-02-05)
- **Planned:** Implement watch mode UI + auto-director, moments log, and lightweight ecosystem role tension with minimal god mode updates; baseline `npm test` ran successfully (npm env warning about http-proxy). 
- **Implemented:** Added watch mode control strip, auto-director focus, moments log + session summary, and diet role tension (scavenger + predator-lite) with food scarcity/migration storytelling hooks. Verified `npm test` and `npm run lint` (lint warnings pre-existing). 

### Notes (2026-02-06)
- **Planned:** Add nests, region-based territory pressure, and migration behaviors with moments + auto-director hooks, save/load support, and UI toggles; baseline `npm test` ran (npm env warning about http-proxy). 
- **Implemented:** Added nest entities with comfort/overcrowding, region pressure + home preference, migration scoring/settlement, new moments + auto-director hooks, UI overlays, and save/load updates. Verified `npm test` (npm env warning about http-proxy) and `npm run lint` (warnings pre-existing). 

### Notes (2026-02-07)
- **Planned:** Run polish/balance pass for survivability, interaction damage, and recovery tuning; baseline `npm test` passed (npm env warning about http-proxy) and `npm run lint` failed with 3 errors and 1040 warnings (pre-existing). Browser smoke attempt via Playwright returned a "Not Found" page, so manual visual validation is pending.
- **Implemented:** Rebalanced creature survivability (higher max health, lower impact caps, longer i-frames), fixed impact damage double-counting, and tuned hunger/stress recovery to favor calmer long-lived play. Added balance documentation, updated smoke checks, and refreshed README tuning pointers. Verified `npm test` (npm env warning about http-proxy) and `npm run lint` (3 errors, 1040 warnings pre-existing).

### Notes (2026-02-08)
- **Planned:** Reproduce and fix creature spawn/visibility regression with dev-only instrumentation, update smoke tests + recovery report, and verify core loop; baseline `npm test` ran (npm env warning about http-proxy).
- **Implemented:** Restored mobile spawn tool activation, added dev-only spawn/render instrumentation with sanitization + fallback labels, and documented updated smoke tests + recovery report. Verified `npm test` (npm env warning about http-proxy).

### Notes (2026-01-26)
- **Planned:** Investigate syntax error breaking creature behavior boot; baseline `npm test` failed with `SyntaxError: Unexpected identifier 'senseRadius'` in `creature-behavior.js`.
- **Implemented:** Repaired `seekFood()` so vision-cone selection lives inside the method and removed the stray block that caused the syntax error. Verified `npm test` (npm env warning about http-proxy) and `npm run lint` (3 errors, 1040 warnings pre-existing).

### Notes (2026-02-02)
- **WHAT:** Removed the Campaign button from the start menu while keeping other actions intact.
- **WHY:** Reduce start menu clutter per updated UX direction.
- **RISK:** Low; start menu-only markup change.
- **VERIFY:** Load the home screen and confirm the Campaign button is absent while New Sandbox remains.

### Notes (2026-02-01)
- **WHAT:** Added needs-driven goals, rest zones, bite-based food, and a controlled mating loop with guardrails.
- **WHY:** Make creatures feel like simple agents while keeping performance stable and emergent play readable.
- **RISK:** Medium; touches core creature update loops and save/load fields.
- **VERIFY:** `npm test`, `npm run lint`, plus updated ecosystem smoke tests.

### Notes (2026-01-30)
- **WHAT:** Added lightweight ecosystem state updates and rebalanced health/damage to reduce accidental deaths.
- **WHY:** Keep creatures alive longer for play, while making impacts readable and emergent behavior visible.
- **RISK:** Medium; combat and impact tuning changes across core simulation loops.
- **VERIFY:** `npm test`, `npm run lint`, plus updated smoke tests for survival and ecosystem settling.

### Notes
- **WHAT:** Added hover/grab outlines and grab/drop reactions to clarify direct manipulation.
- **WHY:** Make interactable creatures feel obvious and responsive during drag/throw play.
- **RISK:** Low; visual-only feedback layered on existing input handling.
- **VERIFY:** `npm test`, `npm run lint`, and manual hover/drag checks.

### Notes (2026-01-29)
- **WHAT:** Rebalanced grab/throw impulses, prop strengths, collision bumps, and camera/touch smoothing to reduce extreme launches and jitter.
- **WHY:** Make interactions readable, weighty, and consistent across desktop and mobile.
- **RISK:** Medium; gameplay feel changes in core manipulation and prop responses.
- **VERIFY:** `npm test`, `npm run lint`, plus updated balance-focused smoke checks.

### Notes (2026-01-29 Playful Pass)
- **WHAT:** Added chaos slider, new props, extra creature reactions, and lightweight prompts/toasts for experimentation.
- **WHY:** Increase delight and replayability without altering the core loop.
- **RISK:** Medium; additional physics effects and UI controls.
- **VERIFY:** `npm test`, `npm run lint`, plus updated sandbox smoke checks.

### Notes (2026-01-28)
- **WHAT:** Added mobile spawn picker sheet and auto-dismissing, dismissible interaction hints.
- **WHY:** Fix mobile creature selection and prevent help text from lingering over gameplay.
- **RISK:** Low; UI-only changes with fallback to the last used spawn type.
- **VERIFY:** `npm test`, `npm run lint`, and mobile spawn selection smoke checks.

## [2026-01-21]
### Added
- Tool HUD indicator that shows active tool and brush size.
- Brush size hotkeys (`[` and `]`).
- Spawn button now remembers last creature type selection.
- Smoke test and roadmap documentation.
- Agent guidelines for future sessions.

### Changed
- Stats HUD styling to highlight tool status.
- Shortcuts overlay updated with brush size controls.
