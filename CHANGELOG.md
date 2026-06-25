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

### 2026-06-25 — gameplay-tranche-1-12 — Planned

- **Issues:** Worker save/load was snapshot-only (no `importState`), god-mode calm/chaos/food lacked undo, scenario balance needed tuning, onboarding skipped feed/scenario steps, watch mode ignored throws/props, moments lacked prop/chaos juice, temperament was invisible in UI, `geneValue` still leaked in analytics/replay, camera margins were too generous, browser smoke did not gate worker apply or Ctrl+Z undo, and mobile creature taps were slightly undersized.
- **Root Causes:** `SaveSystem.deserialize` rebuilt a main-thread world instead of piping through `SimulationProxy.importState`, ToolController only recorded spawn/erase/prop actions, tutorial/event wiring omitted food drops and scenario starts, AutoDirector had no handlers for high-salience moments, personality biases were computed but not surfaced, several modules still read raw diploid genes, camera clamp used 200px slack, and smoke expected snapshot-only worker parity.
- **Fixes:** Planned worker `IMPORT_STATE` + `importState()` round-trip, god-mode undo for calm/chaos/food, scenario retune for Stress Sanctuary and Scavenger Bridge, tutorial feed/scenario steps, watch-mode AutoDirector focus, moments/notifications for throws/props/chaos, temperament chips, `geneValue` rollout, 80px camera margin, 48px mobile tap radius, and smoke gates for apply + undo.
- **Verification:** Planned: `npm test`, lint, build, bundle guard, browser/main/worker/scenario smokes, `proof:release`, commit, push.

### 2026-06-25 — gameplay-tranche-1-12 — Implemented

- **Issues:** Items 1–12 from the gameplay tranche needed landing in one release: worker save apply, scenario balance, god undo, onboarding, watch focus, chaos/prop juice, temperament UI, main-thread scalar cadence (already at interval 4), camera bounds, mobile taps, smoke undo lane, and `geneValue` cleanup.
- **Root Causes:** Same as planned entry; worker proxy lacked state import, tool history omitted god actions, and smoke still referenced `loaded.*` after round-trip shape changed to `before`/`after`.
- **Fixes:** Added `saveWorld` export + `SimulationProxy.importState` + worker `IMPORT_STATE`, god-mode calm/chaos/food record/undo in ToolController with touch drag wiring, retuned `stress_sanctuary`/`scavenger_bridge`, tutorial feed/scenario steps + `FOOD_DROP`/`SCENARIO_STARTED` events, AutoDirector watch focus for throws/props/god spawns, moments + chaos poke boost, temperament chips in inspect UI, `geneValue` in ecosystem-health/replay-system, camera margin 200→80, mobile tap radius 40→48, browser-smoke worker apply + Ctrl+Z undo assertions, fixed `gameState` import in moments-system, smoke `after.playable` parity check.
- **Verification:** `npm test` (190 pass); `npm run lint` (pass); `npm run build` (pass); `npm run check:bundle` (pass); `npm run proof:release` (pass, 18 commands including browser/main/worker/scenario smokes); `npm run evidence:release` (pass); scenario balance Stress Sanctuary alive 47–54 / food 703–746, Scavenger Bridge alive 79–87 / predators 8–9.

### 2026-06-25 — gameplay-performance-polish — Implemented

- **Issues:** Browser smoke failed on startup because `ControlStripController` called missing `_initBatteryManager`, worker disease spread could throw when `creatureManager.queryCreatures` was absent, duplicate `POP_PRESSURE_MAX` key in agent tuning, and casual play needed snappier food/rest recovery plus clearer poke reactions; subsystem updates ran at full rate even when adaptive fidelity dropped.
- **Root Causes:** Battery HUD wiring referenced a method that was never implemented after `battery-manager.js` landed, `SimulationProxy` only exposed `queryCreatures` on the root proxy (not `creatureManager`), a copy-paste left a duplicate tuning key, and `updateSubsystems` ignored `simulationFidelity` throttling already used in the sim step.
- **Fixes:** Implemented `_initBatteryManager` / `_updateBatteryIndicator` with auto-saver hooks, delegated `creatureManager.queryCreatures` on the worker proxy, hardened disease spread with optional chaining, bumped hunger relief / bite energy / rest-zone recovery, made poke reactions more visible with lighter stress cost and stronger calm contagion, fidelity-throttled audio/heatmaps/session goals/game director updates, and added proxy/battery regressions.
- **Verification:** `npm test` (pass); `npm run lint` (pass); `npm run build` (pass); `npm run check:bundle` (pass); `npm run smoke:browser` (pass).

### 2026-06-25 — runtime-correctness-bug-hunt — Implemented

- **Issues:** God-mode Ctrl+Z bypassed ToolController undo, worker spawn/erase tools threw or no-oped without `queryCreatures`, type-based spawn redo stored empty `genes: {}`, duplicate `AudioSystem.update()` shadowed adaptive music, diploid gene reads still leaked in analytics/challenges/audio pitch, and worker event bridging dropped hue.
- **Root Causes:** `SimulationProxy` lacked spatial queries, `eraseCreatures` called `queryCreatures` without fallback, spawn undo stored `{}` instead of `null` for type spawns, a second `update()` method overwrote the first, several modules still compared raw gene objects to numbers, and `compactCreature` lived only inside the worker without hue extraction.
- **Fixes:** Added `SimulationProxy.queryCreatures`, shared `_queryCreaturesNearby` in ToolController with distance-sorted matching, spawn undo feedback + type/predator filters, merged `AudioSystem.update()`, rolled `geneValue`/`isPredatorFromGenes` through analytics/challenges/audio/helpers, moved `compactCreature` to `simulation-state.js` with hue, removed dead god-mode undo stacks, and expanded regression tests for proxy undo, compactCreature, pack/unpack round-trip, InputManager Ctrl+Z, and GameLoop forwarding.
- **Verification:** `npm test` (pass); `npm run lint` (pass); `npm run build` (pass); `npm run check:bundle` (pass).

### 2026-05-28 — fallback-proof-release-polish — Planned

- **Issues:** Approved tranche 1-8 targets main-thread fallback pacing, scenario variance depth, one-command release proof, HUD/CLS regression coverage, startup bundle pressure, Vercel deployment evidence, Upgrade Hub run receipts, and mobile touch polish before commit/push.
- **Root Causes:** The release board is green but desktop main-thread fallback still peaks around a 50ms p95, scenario balance has a default 2-run lane but no named 5-run manual command, release proof commands are spread across docs, Vercel inspect proof is manual, browser smoke only partially gates layout/touch regressions, scenario history lacks a best-run receipt, and local static cache-busting must advance for touched UI/runtime modules.
- **Fixes:** Planned a main-thread fallback startup/field-cadence profile, browser-smoke layout/touch guards, scenario-balance failure artifacts and 5-run script, release/Vercel proof scripts, optional release-board Vercel section, Upgrade Hub best/retry receipts, cache-busts, docs, and full local verification before commit/push.
- **Verification:** Planned: syntax checks, `git diff --check`, lint, tests, build, bundle guard, browser/default/main/worker/scenario smokes, release evidence board, optional Vercel proof where available, commit, and push.

### 2026-05-28 — fallback-proof-release-polish — Implemented

- **Issues:** The 1-8 tranche needed a real implementation pass across runtime fallback, proof automation, release/Vercel evidence, scenario variance, result receipts, mobile layout guards, and startup bundle pressure.
- **Root Causes:** The explicit main-thread fallback was still allowed to run desktop at high/ultra presentation in some paths, the release workflow relied on a manual command checklist, Vercel inspect/build-info proof was not captured as an artifact, layout/touch regressions could pass browser smoke if screenshots were not inspected, scenario-balance failures did not leave first-class failure snapshots, the debug console shipped in the initial bundle even though it is opened on demand, and Upgrade Hub history did not mark best runs.
- **Fixes:** Added a lighter main-thread fallback startup profile, scalar-field cadence 3, and explicit medium/low fallback quality override; lazy-loaded the debug console into its own chunk; added `scripts/release-proof.mjs`, `scripts/vercel-deploy-proof.mjs`, `proof:release`, `proof:release:production`, `proof:vercel`, and `smoke:scenarios:variance`; added browser-smoke layout guard fields for startup CLS, bottom-chrome/result overlap, and mobile touch targets; hardened worker starter-cluster waits; made scenario balance write run tokens, capture metadata, Markdown summaries, and failure screenshots/JSON; added release-board Vercel deploy proof; and upgraded Upgrade Hub result/history UI with best-run badges and retry receipts.
- **Verification:** `node --check` for touched runtime/smoke/proof files (pass); `git diff --check` (pass); targeted ESLint (pass); `npm run proof:release` (pass, 18 commands including lint, 158 tests, build, bundle guard, default/main/worker/scenario smokes, release evidence); `npm run proof:vercel` (pass, Vercel CLI `54.5.1`, live build SHA `9659656ea44366a534db4c40493b1dd25d194549`); final build split `debug-console` into a `6.05 kB` chunk and lowered the main app chunk to `590.31 kB` / `173.77 kB` gzip; default worker smoke passed with desktop avg `20.43ms` / p95 `33.3ms`, startup CLS `0`, mobile touch targets `>=44px`; main fallback smoke passed as `fallback-proof` with desktop avg `34.6ms` / p95 `50ms`, medium quality, startup CLS `0.0995`, and lower draw-image volume but remains not a 60fps claim; forced worker smoke passed with desktop avg `21.54ms` / p95 `33.4ms`; scenario balance passed 2x with Stress Sanctuary alive `41-51` / food `636-658` and Scavenger Bridge alive `74-83` / predators `8-13`.

### 2026-05-28 — production-vitals-variance-main-fallback — Planned

- **Issues:** Approved tranche 1-3 needed a dedicated production Web Vitals proof lane, repeated scenario-balance sampling instead of a single soak, and another scoped main-thread fallback optimization before commit/push.
- **Root Causes:** Production proof focused on realtime runtime smoke but did not separately budget startup/CLS/long-task health, `smoke:scenarios` only sampled each new scenario once, and main-thread fallback still diffused ambient scalar fields every frame even though worker is the shipping default.
- **Fixes:** Planned a production vitals smoke script and release-board lane, multi-run scenario balance variance summaries, a main-thread-only scalar-field cadence throttle, CI/docs/test wiring, external web-game screenshot inspection, and full local proof before commit/push.
- **Verification:** Planned: syntax checks, `git diff --check`, lint, unit tests, build/bundle guard, default/main/worker/scenario smoke, local browser screenshot inspection, production smoke/vitals where deployed SHA permits, release evidence board, commit, and push.

### 2026-05-28 — production-vitals-variance-main-fallback — Implemented

- **Issues:** Repeated scenario proof exposed Scavenger Bridge predator variance, production vitals exposed a desktop CLS budget failure in the current live build, and main-thread fallback still spent steady per-frame work on ambient scalar fields.
- **Root Causes:** Scenario balance only sampled each run once, predator combat compared diploid diet objects directly to numbers so predator-count objectives could degrade into starvation variance, the desktop bottom HUD had no reserved selected-info/stats columns before startup populated it, and main-thread fallback updated pheromone/temperature fields every frame.
- **Fixes:** Added `scripts/production-vitals-smoke.mjs`, CI wiring, docs, and a release-board `production-vitals` gate; made scenario balance default to two runs and emit variance/pass-rate summaries; fixed predator prey lookup for diploid diet genes and added a regression; increased Scavenger Bridge setup buffer after the proof caught variance; reserved desktop bottom-HUD columns/stat width to reduce CLS; added a main-thread-only scalar-field step interval plus smoke-state visibility.
- **Verification:** `node --check` for touched runtime/smoke/evidence files (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 158 checks); `npm run build` (pass, main app JS `594.82 kB` / `174.88 kB` gzip, worker `244.64 kB`); `npm run check:bundle` (pass); `npm run smoke:browser` (pass, shipping-default worker: desktop avg `23.08ms` / p95 `34.3ms`, non-draw `0.9487ms/frame`, mobile p95 `<=17.7ms`); `npm run smoke:main` (pass, fallback-proof: desktop avg `32.1ms` / p95 `50.1ms`, non-draw `3.1148ms/frame`, mobile p95 `<=16.8ms`); `npm run smoke:worker` (pass, forced worker: desktop avg `21.55ms` / p95 `34.3ms`, non-draw `1.0244ms/frame`, mobile p95 `<=17.7ms`); `npm run smoke:scenarios` (pass, 2x variance: Stress Sanctuary alive `48-52` / food `612-638` / stress `0`; Scavenger Bridge alive `63-75` / food `570-574` / predators `7`); local production-preview vitals (pass: desktop FCP `76ms`, LCP `136ms`, CLS `0.0022`; mobile CLS `0`); current live production smoke still passes realtime worker proof, while live production vitals is expected to fail CLS until this commit deploys; external web-game client captured and inspected `output/web-game/vitals-variance-20260528/shot-1.png` with worker ready and 0 pending messages.

### 2026-05-27 — main-fallback-particle-pass — Planned

- **Issues:** The explicit main-thread fallback remained green but desktop smoke still reported sub-60fps pacing in the heavy final state.
- **Root Causes:** Prior smoke artifacts showed main fallback work concentrated in `world-step`, `render`, and `subsystem-update`; render review found the world-attached particle system was drawn during `Renderer.drawWorld()` and then visited again during overlay rendering, while empty ghost-trail cleanup allocated a new array every render.
- **Fixes:** Planned a narrow render-path patch to avoid duplicate particle drawing when the same `ParticleSystem` is attached to `world.particles`, remove empty ghost-trail allocation churn, cache-bust the static module chain, and verify with the forced main-thread browser smoke.
- **Verification:** Planned: syntax checks for touched files, targeted ESLint, `git diff --check`, build/bundle guard, and `npm run smoke:main` with before/after frame metrics.

### 2026-05-27 — production-realtime-summary-main-fallback — Planned

- **Issues:** Approved tranche 1-3 needed production smoke to carry realtime worker-readiness proof, release evidence to produce a compact CI-readable summary, and main-thread fallback to get another low-risk world-step optimization before commit/push.
- **Root Causes:** The release board could produce detailed JSON/Markdown without a short step-summary artifact, production readiness needed to fail closed when realtime gates were missing or stale, and scalar field diffusion still paid method/bounds helper overhead for every cell in the main-thread world-step path.
- **Fixes:** Plan to keep production smoke realtime-gated, write `output/release-summary.md`, surface that summary in GitHub Actions, optimize scalar field stepping with direct indexed array access while preserving boundary behavior, add a scalar-field regression test, and refresh release/smoke docs.
- **Verification:** Planned: syntax checks, `git diff --check`, lint/tests/build/bundle guard, default/main/worker/scenario smoke, external web-game client plus screenshot inspection, production smoke after deploy, release evidence board/summary, commit, and push.

### 2026-05-27 — production-realtime-summary-main-fallback — Implemented

- **Issues:** Production smoke needed to prove live frame pacing instead of only functional behavior, release evidence needed a compact CI summary, main-thread fallback still spent avoidable time in world-step/render overlay work, and the scenario balance soak exposed volatile predator/population margins.
- **Root Causes:** `smoke:production` still carried a no-realtime path in committed config, `release-evidence-board.mjs` treated present summaries too loosely and wrote only full board artifacts, scalar diffusion called helper methods inside every cell update, ghost trail cleanup allocated through `filter()`, world-attached particles were drawn again as an overlay, and Stress Sanctuary/Scavenger Bridge had too little setup margin for repeated 75-second deterministic soaks.
- **Fixes:** Production smoke now records realtime frame-pacing and the release board blocks stale/non-ready production artifacts; `output/release-summary.md` is generated and appended to the GitHub Actions summary; scalar field stepping uses direct indexed array access with a boundary regression test; ghost trails compact in place; duplicate world-attached particle overlay drawing is skipped; cache-busts were advanced for the main fallback path; and Stress Sanctuary/Scavenger Bridge received larger, objective-owned setup buffers.
- **Verification:** `node --check` for touched scripts/runtime files (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 156 checks); `npm run build` (pass, main app JS `586.23 kB` / `171.98 kB` gzip, worker `244.18 kB`); `npm run check:bundle` (pass); `npm run smoke:browser` (pass, shipping-default worker: desktop avg `23.24ms` / p95 `33.6ms`, non-draw `0.9737ms/frame`, mobile p95 `<=17.7ms`); `npm run smoke:main` (pass, fallback-proof: desktop avg `36.07ms` / p95 `50ms`, non-draw `3.5125ms/frame`, mobile p95 `<=17.7ms`); `npm run smoke:worker` (pass, forced worker: desktop avg `21.93ms` / p95 `33.4ms`, non-draw `0.9341ms/frame`, mobile p95 `<=17.7ms`); `npm run smoke:scenarios` (pass after tuning: latest Stress Sanctuary `46` alive / `628` food / `0.0` stress, Scavenger Bridge `67` alive / `527` food / `10` predators); external web-game client captured and inspected `output/web-game/tranche-1-3/shot-0.png` with worker mode ready and 0 pending worker messages; local release summary generated with no missing or blocked proof before commit.

### 2026-05-27 — worker-default-ci-scenario-balance — Planned

- **Issues:** Approved tranche 1-4 needed the worker runtime promoted from candidate to product default, an explicit main-thread fallback proof lane, CI coverage for production smoke after deploy, and longer balance proof for the two newest scenarios.
- **Root Causes:** Runtime defaulting still depended on query/storage opt-in, the release evidence board could count stale production smoke artifacts, global auto-balance could fight fixed scenario predator objectives, and docs did not yet describe the default/fallback split.
- **Fixes:** Planned worker-default runtime selection, `smoke:main`, scenario balance smoke, SHA-bound production target metadata, CI release smoke, scenario tuning, release docs, changelog, and final local/production verification.
- **Verification:** Planned: syntax checks, `git diff --check`, lint, 155 tests, build, bundle guard, default/main/forced-worker browser smoke, scenario balance soak, external web-game client, Playwright screenshot/console pass, release evidence board, commit, push, and post-deploy production smoke.

### 2026-05-27 — worker-default-ci-scenario-balance — Implemented

- **Issues:** The worker candidate lane was ready but not the product default, main-thread fallback needed first-class proof, production smoke could be stale locally, `Scavenger Bridge` predator viability failed under a stricter 75-second soak, and first post-push production smoke exposed that the worker file was emitted without its module dependencies.
- **Root Causes:** The runtime default still returned `main`, browser smoke only had default and forced-worker folders, release evidence did not bind production artifacts to `/build-info.json`, scenario tuning inherited global auto-balance culls after 60 seconds, predator goals were hidden behind food goals in the scenario card priority, and `new Worker(new URL(...))` emitted a source-style worker that imported missing `/assets/world-core.js` dependencies on Vercel.
- **Fixes:** Defaulted runtime selection to worker while preserving `?worker=0`, added `smoke:main`, added `smoke:scenarios`, added the GitHub `release-smoke` workflow with deploy SHA polling, wrote build-info metadata during Vite builds, made browser smoke write target metadata, made the release evidence board reject stale production artifacts, tuned Stress Sanctuary/Scavenger Bridge, allowed scenario tuning to disable global auto-balance, prioritized predator goal cards for predator-objective scenarios, switched simulation worker startup to Vite `?worker` bundling, fixed the web manifest icon URL, and refreshed release/smoke/known-issue docs.
- **Verification:** `node --check` for touched JS/config files (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 155 checks); `npm run build` (pass, main app JS `586.00 kB` / `171.87 kB` gzip, bundled worker `244.12 kB`); `npm run check:bundle` (pass); `npm run smoke:browser` (pass, shipping-default worker: latest desktop avg `20.54ms` / p95 `33.4ms`, non-draw `0.9767ms/frame`, mobile p95 `<=17.6ms`); `npm run smoke:main` (pass, fallback-proof: desktop avg `33.33ms` / p95 `49.9ms`, non-draw `3.5231ms/frame`, mobile p95 `<=17.7ms`); `npm run smoke:worker` (pass, forced worker: desktop avg `18.39ms` / p95 `33.3ms`, non-draw `0.9388ms/frame`, mobile p95 `<=17.6ms`); `npm run smoke:scenarios` (pass: Stress Sanctuary `37` alive / `534` food / `1.25` stress, Scavenger Bridge `48` alive / `431` food / `4` predators); external web-game client (pass: `output/web-game/worker-default-final/shot-0.png`, worker mode true, 0 pending worker messages); Playwright local screenshot/console pass (0 warnings/errors); first post-push `npm run smoke:production` failed on the unbundled worker, then the worker bundling fix passed local smoke and is ready for post-push production verification.

### 2026-05-27 — release-evidence-production-smoke — Implemented

- **Issues:** The approved 1-8 tranche needed current local/worker/production proof, a release evidence board, deeper playable scenarios, and a production smoke lane that could run against built Vite deployments.
- **Root Causes:** Browser smoke only wrote per-lane artifacts, worker completed-result proof was not part of the readiness decision, production builds did not copy runtime sprite assets into `dist`, and the playable scenario catalog had room for more late-game objective variety.
- **Fixes:** Added `smoke:production` and `evidence:release`, made smoke probing accept HTTPS/built Vite entrypoints and custom output folders, fed completed scenario result/history proof into readiness artifacts, copied `creature-sim/assets` plus `manifest.json` during Vite builds, added `Stress Sanctuary` and `Scavenger Bridge`, tightened mobile Upgrade Hub run-history layout, and exposed renderer quality recovery counters.
- **Verification:** `node --check` for touched JS/config/smoke files (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 155 checks); `npm run build` (pass, main app JS `585.62 kB` / `171.77 kB` gzip and runtime assets copied); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop avg `36.11ms` / p95 `50.9ms`, mobile p95 `<=17.7ms`); `npm run smoke:worker` (pass: `candidate-opt-in`, desktop avg `24.32ms` / p95 `33.4ms`, `1.0135ms/frame` profiled non-`drawImage`, completed result flow true); production smoke initially failed on missing sprite manifest, then passed after the Vite asset-copy fix and redeploy; `npm run evidence:release` wrote local, worker, and production proof lanes.

### 2026-05-27 — minimap-layer-cache-performance — Implemented

- **Issues:** Browser smoke profiling kept `render`, `world-step`, and `subsystem-update` as recurring frame-cost scopes; the minimap still resampled static biome cells and repainted heatmap cells every visible frame.
- **Root Causes:** Minimap layout, biome tiles, and population heatmap rendering were computed in the overlay draw path even when world dimensions and map size were unchanged.
- **Fixes:** Cache minimap layout and static biome layer by viewport/world size, redraw the heatmap layer only when its cache interval or size changes, and avoid repeated notification-shape and particle-budget writes in subsystem updates.
- **Verification:** `node --check` for renderer/minimap/game-loop files (pass); `npm run smoke:browser` (pass: desktop non-`drawImage` `4.0417ms/frame`, mobile non-`drawImage` `<=2.5481ms/frame`); `npm run smoke:worker` (pass: desktop non-`drawImage` `1.0135ms/frame`, mobile non-`drawImage` `<=0.9698ms/frame`).

### 2026-05-27 — worker-result-readiness-truth — Implemented

- **Issues:** Worker smoke was already exercising completed-scenario result UI, but `runtime-readiness.json` and release docs still described that result flow as main-thread-only.
- **Root Causes:** The smoke runner asserted scenario result cards and Run History inside each scenario but did not return those proof fields into `summary.json` or the readiness decision artifact.
- **Fixes:** Add completed-scenario result proof to smoke summaries and readiness gating, make `safeToDefaultWorker` reflect the evidence gate without changing the app default, and update smoke/release/known-issue docs to use the artifact fields.
- **Verification:** `node --check scripts/browser-smoke.mjs` (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 155 checks); `npm run smoke:worker` (pass, `candidate-opt-in`, `completedScenarioResultFlow.passed: true`, `defaultReadiness.safeToDefaultWorker: true`, shipping default still `main`).

### 2026-05-27 — perf-readiness-production-polish — Planned

- **Issues:** Approved tranche 1-4 needed a final desktop perf pass, stronger worker default-readiness evidence, production deploy health proof, and visual polish from the latest smoke screenshots.
- **Root Causes:** Main-thread smoke still spent most measured non-`drawImage` time in world/update scopes, worker readiness lacked first-class error/snapshot diagnostics, deployed health had not been rechecked against the public Vercel alias, and compact achievement toasts could compete with the objective rail on mobile result screenshots.
- **Fixes:** Reuse hot-path query/render buffers, remove per-creature vector transform allocation, throttle expensive flock/pack helpers, add worker runtime diagnostics to smoke artifacts, keep worker defaulting gated by `runtime-readiness.json`, verify the Vercel production alias, and move compact achievement toasts below the objective rail.
- **Verification:** Planned: syntax checks, targeted/full ESLint, `git diff --check`, `npm test`, `npm run build`, `npm run check:bundle`, main and worker browser smoke, screenshot inspection, Vercel CLI/version/inspect, and production HTTP check.

### 2026-05-27 — perf-readiness-production-polish — Implemented

- **Issues:** The browser-game release proof needed a bounded optimization pass without overstating worker default readiness.
- **Root Causes:** Dense main-thread frames still paid repeated query allocations and render object churn; worker proof did not expose snapshot age/error counts; the readiness artifact explanation could sound candidate-ready even when frame thresholds were missed; compact fallback achievement toasts did not account for the objective rail.
- **Fixes:** Creature/world/ecosystem hot paths now reuse caller buffers for spatial queries, vector fallback creature drawing avoids `save/translate/rotate/restore`, dense food render constants are cached, advanced flock/pack helpers run at a lower cadence, `SimulationProxy` exposes ready/error/snapshot diagnostics, worker smoke asserts those diagnostics, readiness summaries include worker snapshot/error fields and threshold-aware defaulting reasons, and compact achievement toasts position below the measured objective rail. Production health was verified with Vercel CLI `54.5.0`, `vercel inspect`, and HTTP 200 from `https://creature-sandbox.vercel.app`.
- **Verification:** `node --check` for touched JS and smoke files (pass); targeted ESLint (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 155 checks); `npm run build` (pass, main app JS `582.10 kB` / `170.77 kB` gzip); `npm run check:bundle` (pass); final `npm run smoke:browser` (pass under concurrent DeskBuddy/Xcode build load, desktop avg `187.75ms` / p95 `201ms`, `17.775ms/frame` profiled non-`drawImage`; an earlier same-pass run with less local load sampled `32.1ms` / `50ms`; main stays the shipping default but not a 60fps claim); final `npm run smoke:worker` (pass under the same local load, desktop avg `38.4ms` / p95 `50ms`, `1.7783ms/frame` profiled non-`drawImage`; `runtime-readiness.json` status `needs-more-proof`, worker default held); inspected refreshed mobile Upgrade Hub screenshot and confirmed the achievement toast no longer overlaps the objective rail or result/history area; Playwright local smoke URL captured `output/playwright-final-local.png` with 0 warning/error console messages.

### 2026-05-27 — worker-runtime-readiness-proof — Planned

- **Issues:** Worker mode was the smoother candidate lane, but the smoke output still required humans to infer default-readiness from scattered summary, perf, and screenshot artifacts.
- **Root Causes:** Runtime metadata exposed active worker mode, but the smoke runner did not write a first-class readiness decision artifact with worker ready state, pending queue state, frame thresholds, and the explicit default-mode hold.
- **Fixes:** Add worker ready/queued-message metadata to smoke state and perf artifacts, assert the worker is ready with no queued startup messages during worker smoke, write `runtime-readiness.json` for both smoke lanes, and update smoke/release docs to inspect that artifact before any default-runtime decision.
- **Verification:** Planned: syntax checks for touched JS, targeted ESLint, `git diff --check`, `npm test`, `npm run smoke:worker`, and a focused main smoke run if needed.

### 2026-05-27 — worker-runtime-readiness-proof — Implemented

- **Issues:** Worker proof could pass while still leaving the defaulting decision ambiguous in release notes.
- **Root Causes:** The runtime toggle, perf budget, and smoke summary did not combine into one reviewed readiness artifact.
- **Fixes:** `render_game_to_text()` and `perfBudget()` now expose worker readiness and queued-message counts. Browser smoke now asserts worker readiness, writes `runtime-readiness.json`, and records that the shipping default remains main-thread mode while worker stays opt-in until the readiness thresholds pass. Smoke and release docs now name the readiness artifact.
- **Verification:** Latest worker smoke passed functionally, but `output/browser-smoke-worker/runtime-readiness.json` reports `needs-more-proof` under the loaded local run, so worker default remains held.

### 2026-05-27 — frame-profile-toast-worker-vercel-proof — Planned

- **Issues:** Approved tranche 1-4 targeted the next proof/polish pass: desktop main-thread pacing needed non-`drawImage` cost evidence, fallback achievement-toast panel safety needed a first-class smoke assertion, worker mode needed a longer scenario soak before any default-mode promotion, and Vercel CLI needed to be installed for deploy/log/env proof.
- **Root Causes:** Frame-pacing artifacts only separated `drawImage` volume/timing, smoke screenshots could catch a panel overlap without failing, worker `Apex Balance` validation used a short sync soak, and the local machine did not have the Vercel CLI available.
- **Fixes:** Add profiler-scope summaries to frame-pacing JSON, add a smoke-only fallback achievement-toast bounds hook/assertion, extend worker scenario soak coverage, install and verify Vercel CLI, then rerun the full local gate.
- **Verification:** Planned: targeted syntax/ESLint; `git diff --check`; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; `npm run smoke:worker`; external web-game client screenshot/state; `vercel --version`; commit and push.

### 2026-05-27 — frame-profile-toast-worker-vercel-proof — Implemented

- **Issues:** The next release proof needed profile-backed non-`drawImage` frame-cost artifacts, deterministic toast bounds coverage, a stronger worker scenario soak, and a working local Vercel CLI.
- **Root Causes:** `PerformanceProfiler` scoped timings were disabled by default during smoke sampling, fallback achievement toasts could briefly animate through the Inspector lane, browser smoke only reviewed toast placement through screenshot inspection, and worker scenario proof did not yet run a longer deterministic `Apex Balance` soak.
- **Fixes:** The smoke frame sampler now temporarily enables and resets the profiler, records root/child scope totals, writes `mainThread.profiledNonDrawImageMs` and top scope rows into every frame-pacing artifact, and restores the prior profiler state. Browser smoke now forces a fallback achievement toast, asserts it does not overlap the Inspector or Upgrade Hub, and saves the bounds in desktop JSON. Panel-aware achievement toasts now use a vertical in/out animation and a wider Inspector offset. Worker smoke now runs an extended `Apex Balance` soak and checks active scenario/runtime truth afterward. Installed Vercel CLI globally and verified `54.5.0`.
- **Verification:** Initial `npm run smoke:browser` correctly failed on the new toast overlap assertion; after the panel-safe toast fix: `node --check` for touched JS files (pass); targeted ESLint (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `578.82 kB` / `169.80 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop avg `41.67ms` / p95 `51.1ms`, `5.38ms/frame` profiled non-`drawImage`, desktop toast bounds clear of Inspector/Upgrade Hub; mobile p95 `<= 17.7ms`); `npm run smoke:worker` (pass: desktop avg `18.75ms` / p95 `33.4ms`, `1.1146ms/frame` profiled non-`drawImage`, mobile p95 `<= 16.8ms`); external web-game client captured and inspected `output/web-game/profile-toast-worker-20260527/shot-0.png` plus `state-0.json`; `vercel --version` reported `54.5.0`.

### 2026-05-27 — achievement-toast-lane-polish — Planned

- **Issues:** Follow-up screenshot audit after the RC proof showed fallback achievement unlock toasts could still render as a large desktop card and cover the Inspector lane while Upgrade Hub scenario results were focused.
- **Root Causes:** `AchievementSystem.showNotification()` only used the compact presentation on mobile-sized viewports; desktop fallback notifications did not account for visible side panels or the Upgrade Hub.
- **Fixes:** Make fallback achievement notifications switch to a compact toast when the Inspector or Upgrade Hub is visible, and move that toast to a lower playfield lane away from the right-side Inspector.
- **Verification:** Planned: targeted syntax/ESLint; `git diff --check`; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; `npm run smoke:worker`; external web-game client screenshot inspection.

### 2026-05-27 — achievement-toast-lane-polish — Implemented

- **Issues:** The top-right fallback achievement notification could obscure Inspector content during result-focused Upgrade Hub smoke screenshots.
- **Root Causes:** Desktop fallback achievement notifications were styled as a wide celebratory card regardless of active panel layout.
- **Fixes:** Added panel-aware fallback achievement toast positioning and compact styling when Inspector or Upgrade Hub is open, plus a cache-bust for the achievement module import.
- **Verification:** `node --check creature-sim/src/achievement-system.js` and `creature-sim/src/app-bootstrap.js` (pass); targeted ESLint (pass); `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `576.04 kB` / `169.01 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop avg `33.97ms` / p95 `50ms`, mobile p95 `<= 17.7ms`); `npm run smoke:worker` (pass: desktop avg `18.37ms` / p95 `33.3ms`, mobile p95 `<= 17.6ms`); external web-game client captured `output/web-game/audit-toast-20260527/shot-0.png` and `state-0.json`; inspected `output/browser-smoke/desktop-upgrade-result.png` and confirmed the Inspector lane is no longer covered.

### 2026-05-27 — scenario-depth-worker-rc-polish — Planned

- **Issues:** Approved tranche 1-5 targeted the next release-candidate slice: main-thread desktop draw cost still needed a low-risk creature LOD pass, worker mode needed a player-facing candidate toggle plus deeper scenario metadata proof, the playable catalog needed more scenario variety, Upgrade Hub needed completed-run history, and the repo needed an explicit release checklist before tag/push.
- **Root Causes:** Creature sprite detail stayed high in low-quality/zoomed-out desktop states, runtime mode selection was only available through query/storage smoke hooks, worker smoke did not start a named scenario or verify playable metadata roundtrips, scenario progress only tracked aggregate completion counts, and release steps were spread across README, smoke docs, and prior progress notes.
- **Fixes:** Add quality-aware vector creature LOD for unselected low-detail creatures, expose a Worker Runtime next-load toggle, add `Drought Rescue`, `Apex Balance`, and `Variant Crossing`, record per-scenario result history with Upgrade Hub retry controls, extend smoke coverage for catalog/history/toggle/worker scenario parity, and add a release checklist.
- **Verification:** Planned: `git diff --check`; `node --check` for touched JS files; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; `npm run smoke:worker`; external web-game client/local browser sanity; commit, RC tag, and push.

### 2026-05-27 — scenario-depth-worker-rc-polish — Implemented

- **Issues:** The release-candidate pass still had five concrete gaps: zoomed-out desktop could pay full creature sprite and dense food/particle costs, worker mode had no visible next-load toggle, worker smoke did not prove named scenario metadata, playable scenarios lacked late-game variety/history, and release proof was not packaged into a single checklist.
- **Root Causes:** Renderer LOD only dropped creature sprite detail after quality had already fallen, high-quality particle budgets stayed high during scripted desktop smoke, dense vector food still paid glow/aura work, runtime mode selection lived behind hidden storage hooks, `_completeRun()` kept only aggregate progress, and release steps lived in scattered docs/progress notes.
- **Fixes:** Added zoom/quality-aware vector creature LOD for non-focused creatures, lowered runtime particle budgets, simplified dense zoomed-out food rendering, lowered desktop canvas render scale to favor pacing, added a Worker Runtime next-load toggle, added `Drought Rescue`, `Apex Balance`, and `Variant Crossing`, stored the latest five run summaries per scenario, rendered Upgrade Hub Run History with retry buttons, extended smoke coverage for expanded catalog/history/runtime toggle/worker `Apex Balance` save parity, and added `docs/RELEASE_CHECKLIST.md`.
- **Verification:** `git diff --check` (pass); `node --check` for touched JS files (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `575.78 kB` / `168.92 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop avg `34.65ms` / p95 `50ms`, `134.92` drawImages/frame, mobile p95 `<= 16.8ms`); `npm run smoke:worker` (pass: desktop avg `19.15ms` / p95 `33.4ms`, mobile p95 `<= 17.1ms`); external web-game client captured `output/web-game/rc-polish/shot-0.png` and `state-0.json`. Residual: desktop main-thread final heavy state is improved but not 60fps; worker mode is the smoother candidate lane.

### 2026-05-27 — draw-profile-result-focus-worker-candidate — Planned

- **Issues:** Approved tranche 1-3 targeted the next release-polish slice: desktop main-thread smoke still needed full-view `drawImage` volume proof and a scoped pacing optimization, completed scenario summaries needed a first-class Upgrade Hub focus point, and worker mode needed a stronger candidate path before it could move closer to default.
- **Root Causes:** Frame-pacing smoke captured intervals and long tasks but not canvas blit volume/timing, food sprites still used a fixed detailed-render threshold even after quality dropped, the completed result lived lower in the Upgrade Hub without a focus anchor, and worker smoke did not yet verify save serialization/load parity or runtime preference persistence.
- **Fixes:** Add scoped `CanvasRenderingContext2D.drawImage` profiling to smoke frame samples, make food sprite rendering quality-aware, add an Upgrade Hub scenario-result anchor plus focus action, add smoke assertions for focused result visibility, introduce a stored worker/main runtime candidate preference, and extend worker smoke with snapshot-only save parity, save-slot preview, preference roundtrips, and a longer sync soak.
- **Verification:** Planned: `git diff --check`; `node --check scripts/browser-smoke.mjs`; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; `npm run smoke:worker`; local browser screenshot sanity.

### 2026-05-27 — draw-profile-result-focus-worker-candidate — Implemented

- **Issues:** Desktop main-thread final-state pacing needed a profile-backed improvement; completed scenario result cards needed to land in view; worker mode needed more runtime-truth proof before being treated as a candidate default; and screenshot review found the mobile achievement fallback still reading too much like a banner.
- **Root Causes:** Smoke sampling lacked `drawImage` counters/timing, food sprite detail did not follow renderer quality, the Upgrade Hub result section had no anchor/focus API, worker smoke avoided save/load checks because active worker-world mutation is not supported, and the achievement fallback used full-width mobile positioning.
- **Fixes:** Added scoped `drawImage` sampling to frame-pacing artifacts, lowered food sprite detail by active quality, added `#upgrade-scenario-result` with a focus action and smoke assertions, added stored runtime-mode candidate preference hooks, extended worker smoke with snapshot-only save reload parity plus slot preview and preference roundtrips, stabilized worker startup visibility settling, and compacted the mobile achievement fallback toast.
- **Verification:** `git diff --check` (pass); `node --check scripts/browser-smoke.mjs` / touched runtime files (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `570.78 kB` / `166.93 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop avg `42.01ms` / p95 `66.7ms`, `113.29` drawImages/frame, mobile p95 `<= 17.6ms`); `npm run smoke:worker` (pass: desktop avg `25.24ms` / p95 `33.5ms`, mobile p95 `<= 17ms`); Playwright live mobile result sanity (result visible, God panel hidden, 0 warnings/errors).

### 2026-05-27 — interaction-results-pacing-polish — Planned

- **Issues:** Approved tranche 1-5 targeted the remaining high-value polish: main-thread smoke still showed slow desktop frame pacing after full scripted interactions, throw/prop play did not have deterministic smoke proof, mobile God Mode could still read as a tall panel, Upgrade Hub scenario results were too thin, and scenario completion snapshots needed stronger runtime truth.
- **Root Causes:** Creature sprites eagerly prepared multiple tinted zoom sizes per color, particle rendering resolved/requested the same sparkle sprite on hot draw paths, low-quality particle budgets still paid glow/shadow costs, throw/prop counters were only player-observable through side effects, the God panel reused the desktop two-column layout on mobile, and `_completeRun()`/`_failRun()` emitted stale `lastSnapshot` state after mutating the active run.
- **Fixes:** Quantize creature sprite tints and lazy-load close-zoom sizes, cache particle sprite runtime and skip glow work on low budgets, add smoke interaction and scenario-completion hooks, compact mobile God Mode and the legacy mobile achievement toast, expand the Upgrade Hub scenario result card, close God Mode when Upgrade Hub opens, refresh completed/failed playable snapshots immediately, and harden mobile overflow action clicks in browser smoke.
- **Verification:** Planned: `git diff --check`; `node --check scripts/browser-smoke.mjs`; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; `npm run smoke:worker`; local browser sanity.

### 2026-05-27 — interaction-results-pacing-polish — Implemented

- **Issues:** Main-thread desktop pacing needed a concrete improvement; throw/prop interactions, God panel compactness, and scenario-result truth needed checked proof; and the Upgrade Hub result view did not yet feel like a completed-run summary.
- **Root Causes:** Tinted creature sprite variants and particle sprite lookup work were heavier than needed during full-view canvas rendering; smoke coverage stopped short of deterministic throw/prop counter assertions and completed-result DOM checks; mobile God Mode inherited desktop sizing; and playable scenario completion did not rebuild the public snapshot before emitting updates.
- **Fixes:**
  - Quantized creature sprite tint colors and prepared only the base 64px sprite set up front, with higher sizes requested lazily as zoom demands them.
  - Cached the particle sparkle sprite runtime and skipped glow/shadow rendering when the active quality budget is low.
  - Rebuilt playable scenario snapshots on completion/failure so Upgrade Hub, save metadata, smoke state, and UI all see `complete`/`failed` truth immediately.
  - Replaced the one-line Upgrade Hub result with a result card containing medal, score, survival/food/stress stats, discoveries, and next action.
  - Compacted mobile God Mode into a measured three-column panel and added smoke assertions for width, height, tool count, and tap target size.
  - Reduced the legacy achievement fallback notification on mobile so unlocks do not render as a large banner over the playfield.
  - Made Upgrade Hub opening close God Mode so recipe/result content is not covered by the God tool panel.
  - Added smoke hooks/assertions for throw counters, prop trigger counters, deterministic scenario completion, Upgrade Hub result DOM, scenario result state, and particle max-budget truth.
  - Hardened the mobile overflow Props action against hash/HMR reload races by validating the resulting tool state, advancing to a settled budget frame before perf checks, and retrying through the drawer.
- **Verification:** `git diff --check` (pass); `node --check scripts/browser-smoke.mjs` (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `566.73 kB` / `165.82 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop avg `48.15ms` / p95 `83.3ms`, mobile p95 `<= 16.8ms`); `npm run smoke:worker` (pass: desktop avg `23.71ms` / p95 `34.4ms`, mobile p95 `<= 17.7ms`); Playwright MCP opened `http://127.0.0.1:50555/?smoke=1#seed=1s-8-7s`.

### 2026-05-27 — mobile-objective-rail-audit — Planned

- **Issues:** Baseline browser smoke passed, but screenshot review showed the compact mobile objective rail consuming too much vertical playfield space and truncating guidance when progress, world rhythm, and mode chips were all visible; smoke artifacts also showed the main-thread particle count could remain at 500 even after renderer quality dropped to `low`.
- **Root Causes:** The mobile rail reused a stacked status layout and allowed a two-line title plus subtitle, so normal HUD status could grow into a large card at the top of the playfield; `RendererConfig.QUALITY_PRESETS` particle budgets were applied to the renderer-internal particle field but not the gameplay `ParticleSystem` owned by `GameLoop`.
- **Fixes:** Tighten the mobile rail into a flatter status row, keep goal/action copy to a compact one-line treatment, add browser-smoke rail-height assertions, sync the gameplay particle budget from the active renderer quality preset, and assert that smoke particle counts honor that budget.
- **Verification:** Planned: `git diff --check`; targeted ESLint; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; screenshot inspection.

### 2026-05-27 — mobile-objective-rail-audit — Implemented

- **Issues:** Mobile objective chrome was too tall in live smoke screenshots; gameplay particles ignored active quality budgets; Gene Editor custom values/spawn controls could not survive a reload as local UI preferences; and browser smoke could collide with unrelated local servers on the default port.
- **Root Causes:** Mobile objective status chips were stacked vertically; `GameLoop` never forwarded renderer quality budgets into the gameplay `ParticleSystem`; `GeneEditor` kept values only in memory and accepted imported values without clamped preference normalization; and the smoke runner reused any valid Creature server on the default URL unless the caller explicitly managed ports.
- **Fixes:**
  - Flattened the mobile objective rail status row and added rail-height assertions for desktop/mobile smoke.
  - Applied active renderer quality particle budgets to the gameplay `ParticleSystem` and added smoke assertions for particle-count caps.
  - Added persisted, clamped Gene Editor preference snapshots for genes, spawn count, and spawn spread, plus a browser-smoke roundtrip hook.
  - Hardened browser smoke server startup so owned runs choose a free port unless an external server is explicitly requested.
  - Updated `docs/FEATURE_MATRIX.md` and `progress.md` with the new Gene Editor and smoke contracts.
- **Verification:** `git diff --check` (pass); targeted ESLint for touched JS (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `561.24 kB` / `164.31 kB` gzip, Gene Editor chunk `9.55 kB` / `3.10 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large, particle caps held at 50 on low quality); `npm run smoke:worker` (pass: desktop, mobile-compact, mobile-large, mobile p95 frame pacing <= 17.2ms); Playwright live mobile smoke sanity confirmed objective rail height `45px`, no console warnings/errors, challenge overlay hidden, and mini-graphs hidden.

### 2026-05-26 — hud-worker-pacing-bundle-pass — Planned

- **Issues:** The next audit tranche targeted eight remaining release-polish gaps: mobile God/mode chrome could collide with the objective rail, selected-creature information duplicated the desktop inspector, canvas notifications still competed with top objective chrome, objective rail copy was generic, worker mode had no checked smoke lane, frame pacing was not captured as an artifact, day/night/resource rhythm was not surfaced in normal HUD, and the Gene Editor still loaded on the startup path.
- **Root Causes:** Objective/status HUD data was split across separate surfaces; selected-card rendering did not know whether the inspector was already open; notification layout lacked objective-rail context; session-goal copy reused generic fallbacks; the browser smoke script only covered the main-thread scenario path; runtime smoke state exposed aggregate performance but not sampled frame intervals; the day/night/food-cycle systems were renderer/simulation-only for players; and `GeneEditor` was statically imported by `app-bootstrap.js`.
- **Fixes:** Fold active tool/watch and world rhythm into the objective rail, compact the selected card while the desktop inspector is open, route low-priority notifications away from the top rail, make objective hints action-oriented, add worker smoke and clone-safe worker event payloads, add frame-pacing smoke hooks/artifacts, surface the day/night/resource chip in text state and UI, and lazy-load the Gene Editor behind a cached proxy.
- **Verification:** Planned: `git diff --check`; targeted ESLint; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; `npm run smoke:worker`; desktop/mobile screenshot review; docs/progress update.

### 2026-05-26 — hud-worker-pacing-bundle-pass — Implemented

- **Issues:** Mobile and desktop runtime chrome still exposed duplicated or competing status surfaces; worker mode could regress without a first-class smoke gate; frame pacing had no saved proof; and an optional gene-editing surface stayed in the main startup bundle.
- **Root Causes:** `UpgradeController` rendered objective progress without active mode or environmental rhythm context; `renderSelectedInfo()` did not receive inspector visibility; `NotificationSystem.draw()` did not know when the objective rail was occupying the top lane; `render_game_to_text()` lacked objective/world rhythm and worker metadata; worker event payloads could include non-cloneable creature functions; and the Gene Editor import sat on the app bootstrap critical path.
- **Fixes:**
  - Added active mode/watch and day/night/season/resource chips to the objective rail, including compact mobile behavior and smoke-text metadata.
  - Reworked selected-creature rendering into a compact desktop chip while the Inspector is open, preserving the fuller card when the Inspector is closed.
  - Moved low-priority canvas notifications to an edge/bottom lane while the objective rail is visible, while warnings/errors can still interrupt.
  - Replaced generic session-goal objective copy with action-oriented hints for population, food, survival, prop, and scenario goals.
  - Added `npm run smoke:worker`, worker-mode URL handling, worker runtime assertions, worker screenshots/state artifacts, and clone-safe worker event bridge payloads.
  - Added real-time frame-pacing sample hooks to the smoke API and saved `framePacing` summaries in browser smoke JSON artifacts.
  - Lazy-loaded `gene-editor.js` through a cached proxy and fixed manual chunk matching for cache-busted module ids.
  - Refreshed the objective rail immediately from Watch/God state changes so the visible mobile rail matches the smoke metadata without waiting for a later rail update.
- **Verification:** `git diff --check` (pass); targeted ESLint for touched UI/worker/smoke files (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, final main app JS `560.15 kB` / `162.54 kB` gzip with separate `gene-editor` chunk `7.61 kB` / `2.45 kB` gzip); `npm run check:bundle` (pass); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large, frame-pacing artifacts captured); `npm run smoke:worker` (pass: desktop, mobile-compact, mobile-large, worker frame-pacing artifacts captured); inspected `output/browser-smoke/desktop-selected.png`, `output/browser-smoke/mobile-compact-god.png`, and `output/browser-smoke-worker/mobile-compact-watch.png`.

### 2026-05-24 — field-dossier-analytics-declutter — Planned

- **Issues:** Continued visual audit found remaining normal-play chrome weight: the legacy mini-graph energy histogram was still visible as a debug-looking black panel, and the desktop selected-creature card carried too many stats for the first few seconds of play.
- **Root Causes:** `MiniGraphs` defaulted to enabled even though it is an analytics surface, and the desktop selected-creature renderer reused a broad diagnostic stat list instead of a compact field dossier.
- **Fixes:** Default mini-graphs off for normal play while preserving the existing hotkey/debug path, expose that state in smoke text, assert it in browser smoke, and reduce the desktop selected-creature card to core vitals plus current drive.
- **Verification:** Planned: `git diff --check`; targeted ESLint; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; desktop/mobile screenshot review; external web-game client pass; commit and push to `main`.

### 2026-05-24 — field-dossier-analytics-declutter — Implemented

- **Issues:** The default gameplay HUD still exposed an analytics-style mini-graph panel, and the desktop selected-creature card read like a diagnostics dump instead of a quick field dossier for the first selected creature.
- **Root Causes:** `MiniGraphs` initialized as visible by default, smoke did not assert its normal-play visibility contract, and the selected-creature desktop renderer combined core vitals with low-priority simulation traits in the opening card.
- **Fixes:**
  - Defaulted mini-graphs off for normal play while preserving the existing `L` toggle path.
  - Exposed `miniGraphsVisible` in `render_game_to_text()` and added browser-smoke coverage to keep the normal opening free of analytics chrome.
  - Reworked the desktop selected-creature card into a compact field dossier with core vitals, biome/family/social context, and a concise current-drive block.
  - Bumped CSS/module cache keys for the dossier pass.
- **Verification:** `git diff --check` (pass); targeted ESLint for touched JS (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `635.98 kB` / `183.20 kB` gzip); `npm run check:bundle` (pass, main JS `635982B` / `181688B` gzip under budget); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); inspected `output/browser-smoke/desktop-clean.png`, `output/browser-smoke/mobile-compact-clean.png`, and `output/browser-smoke/mobile-large-clean.png`; external `develop-web-game` client pass captured `output/web-game/dossier-pass/shot-0.png` and `state-0.json` with `objectiveRailVisible: true`, `challengeOverlayVisible: false`, `miniGraphsVisible: false`, desktop camera zoom `0.9`, and `0` startup props.

### 2026-05-24 — opening-focus-chrome-declutter — Planned

- **Issues:** Continuing the audit after the pushed opening HUD pass, the first desktop gameplay state still had an empty selected-creature card, the active goal appeared in both the DOM objective rail and the canvas challenge overlay, mobile could become cluttered if a starter creature card opened automatically, and the lineage highlight path had not been covered by the latest opening smoke.
- **Root Causes:** The starter glade spawned readable creatures without selecting a desktop subject; `GameLoop.render()` always drew the canvas challenge overlay even when the DOM rail was visible; mobile and desktop used the same selection state expectations; and `Renderer.drawWorld()` passed `world.descendantsOf()` arrays to creature rendering code that expected a `Set`.
- **Fixes:** Spotlight a starter creature on desktop only, treat the DOM objective rail as the primary normal-play goal surface, hide the canvas challenge overlay unless debug goal overlays are enabled or the rail is unavailable, normalize lineage descendants into a `Set`, and expand smoke assertions around goal-surface state and mobile clean entry.
- **Verification:** Planned: `git diff --check`; targeted ESLint; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; desktop/mobile screenshot review; external web-game client pass.

### 2026-05-24 — opening-focus-chrome-declutter — Implemented

- **Issues:** Desktop startup still showed an empty selected-card affordance despite readable starter creatures; the same active goal could render in both DOM and canvas chrome; mobile opening could be overrun by the full selected-creature card if auto-selection applied everywhere; and lineage-root rendering could throw when descendants were returned as arrays.
- **Root Causes:** The opening glade did not return a spotlight creature; canvas challenge rendering did not check whether the DOM objective rail was already populated; selection behavior was not split by viewport; and `Renderer.drawWorld()` forwarded `world.descendantsOf()` directly to code expecting `.has()`.
- **Fixes:**
  - Desktop now selects and lineage-roots a starter creature from the opening glade, giving the first view a concrete inspectable subject.
  - Mobile opening remains unselected so the lower playfield stays clear until the player taps a creature.
  - `GameLoop` hides the canvas challenge overlay while the DOM objective rail is visible, and smoke state now exposes both goal-surface flags.
  - Startup forces an immediate objective rail render so short playtest captures see the same chrome state as full smoke.
  - `Renderer` normalizes lineage descendants into a `Set`, and the opening selected-creature card no longer exposes a non-finite curiosity value.
- **Verification:** `git diff --check` (pass); targeted ESLint (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `630.55 kB` / `181.40 kB` gzip); `npm run check:bundle` (pass, main JS `630552B` / `179918B` gzip under budget); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); inspected `output/browser-smoke/desktop-clean.png`, `output/browser-smoke/mobile-compact-clean.png`, and `output/browser-smoke/mobile-large-clean.png`; external `develop-web-game` client pass captured `output/web-game/opening-focus-pass/shot-0.png` and `state-0.json` with `objectiveRailVisible: true`, `challengeOverlayVisible: false`, desktop selected creature present, zoom `0.9`, `12` visible creatures, and `0` startup props.

### 2026-05-24 — opening-hud-regression-lock — Planned

- **Issues:** Continuing the gameplay/visual audit, the compact objective rail still truncated the most important session-goal copy, the mobile canvas challenge card left too little room for long goal labels, and browser smoke only asserted that some creature was visible rather than protecting the new creature-forward opening composition.
- **Root Causes:** The mobile objective rail reused the desktop pill layout, the compact canvas challenge panel kept an older narrow width, and smoke assertions verified population counts without checking camera zoom, framed starter-cluster readability, objective-rail state, or accidental startup props.
- **Fixes:** Convert the mobile objective rail into a wider two-line compact panel, give the compact challenge overlay more label width and clearer font sizing, and add browser-smoke assertions for opening zoom, visible starter creatures, zero startup props, and objective rail availability.
- **Verification:** Planned: `git diff --check`; targeted ESLint for touched JS; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; local opening screenshot inspection.

### 2026-05-24 — opening-hud-regression-lock — Implemented

- **Issues:** The mobile objective rail was still squeezing long goals into a desktop-shaped pill; the compact canvas challenge panel had too little room for readable session-goal labels; and the smoke suite did not yet fail if the opening camera regressed back to a distant map view or if startup props completed prop goals before player action.
- **Root Causes:** Mobile used the same single-line objective grid as desktop, compact challenge drawing retained the older narrow panel sizing, and browser smoke treated any visible creature as enough proof for the opening shot.
- **Fixes:**
  - Reworked the mobile objective rail into a full-width compact panel with two-line goal title support and a visible action subtitle.
  - Widened the compact challenge card, increased compact label sizing, and kept fitted labels/progress rails for long active goals.
  - Added browser-smoke assertions for opening camera zoom, visible starter-creature count, zero startup props, and objective-rail state.
  - Bumped CSS/module cache keys for the new runtime/UI pass.
- **Verification:** `git diff --check` (pass); targeted ESLint for touched JS (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `629.86 kB` / `181.11 kB` gzip); `npm run check:bundle` (pass, main JS `629864B` / `179628B` gzip under budget); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); inspected `output/browser-smoke/desktop-clean.png`, `output/browser-smoke/mobile-compact-clean.png`, and `output/browser-smoke/mobile-large-clean.png`; external `develop-web-game` client pass captured `output/web-game/opening-hud-pass/shot-0.png` and `state-0.json` with desktop zoom `0.9`, `12` visible creatures, and `0` startup props.

### 2026-05-24 — opening-playfield-watch-polish — Planned

- **Issues:** Current live play/audit needed a more creature-forward first gameplay view, less intrusive compact/mobile overlays, and a reliable watch-mode smoke path before larger gameplay claims. The startup camera framed too much of the 4000×2800 world, the random toybox opener could place props before the player acted and complete prop goals, and the desktop smoke path had timed out waiting for the watch strip.
- **Root Causes:** Startup used the same broad default zoom for first-run framing; opener props reused the normal `SandboxProps.addProp()` event path; watch toggling did not proactively close transient drawers; and compact canvas overlays mixed CSS viewport and backing-canvas dimensions.
- **Fixes:** Add a starter glade, dedicated opening zoom, instant camera jump/travel helpers, safer non-prop opener variety, drawer cleanup before watch-mode toggles, and CSS-viewport-aware compact challenge/toast rendering.
- **Verification:** Planned: targeted ESLint; `git diff --check`; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; screenshot inspection.

### 2026-05-24 — opening-playfield-watch-polish — Implemented

- **Issues:** The first gameplay shot read as a distant simulation map rather than playable creature action; startup prop placement could falsely satisfy prop goals; compact overlays were still vulnerable to high-DPR sizing; watch mode needed stronger drawer cleanup before browser smoke; and Playwright MCP surfaced PWA warnings for stale manifest icon paths and missing `mobile-web-app-capable`.
- **Root Causes:** New games jumped to a full-world default zoom, the toybox opener used the same prop placement event path as the player, compact overlays were not consistently driven by CSS viewport size, watch toggles left drawer state cleanup to callers, and `manifest.json` referenced PNG icons that were not checked in.
- **Fixes:**
  - Added camera `jumpTo()` / `travelTo()` helpers and a starter glade with mixed creatures, food, and a calm zone.
  - Increased opening zoom on desktop/mobile and preserved a broader default zoom for later free navigation.
  - Replaced automatic toybox prop placement with non-prop creature/chaos opener variety.
  - Closed transient drawers before watch-mode toggles and kept compact challenge/toast sizing CSS-viewport aware.
  - Updated the web app manifest to use an existing SVG icon and added `mobile-web-app-capable`.
- **Verification:** `git diff --check` (pass); targeted ESLint for touched JS (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `629.87 kB` / `181.11 kB` gzip); `npm run check:bundle` (pass, main JS `629871B` / `179621B` gzip under budget); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); external `develop-web-game` client pass captured `output/web-game/opening-pass/shot-0.png`; Playwright MCP opened the local smoke URL with no new console warnings.

### 2026-05-24 — overlay-readability-polish — Planned

- **Issues:** Live desktop/mobile smoke review showed the canvas challenge overlay describing session objectives as generic `Goal` rows, with no visible progress rail at 0%; compact/mobile startup could stack multiple notification pills over the top playfield while objective chrome was visible; smoke/autostart sessions could inherit stale service-worker cache behavior; and early sprite requests could cache missing variants before the manifest finished loading.
- **Root Causes:** `ChallengeSystem.getActiveChallenges()` discarded the session goal description/icon when adapting goals for canvas rendering; `NotificationSystem.draw()` only keyed compact behavior from backing canvas width; service-worker registration was unconditional; and `AssetLoader.requestSpriteFrames()` marked sprite keys unavailable before late manifest loads had a chance to register sheets.
- **Fixes:** Preserve goal descriptions/icons in the challenge adapter, always draw a progress rail for the active goal, make notification layout use CSS viewport width with one compact toast at a time, skip service-worker registration during smoke/autostart URLs, and clear/retry unavailable sprite variants after manifest or legacy SVG loads settle.
- **Verification:** Planned: `git diff --check`; `npm run lint`; `npm test`; `npm run build`; `npm run check:bundle`; `npm run smoke:browser`; desktop/mobile screenshot inspection.

### 2026-05-24 — overlay-readability-polish — Implemented

- **Issues:** Generic goal labels made the in-canvas challenge card weaker than the top objective rail; mobile startup could show stacked canvas notifications while a goal card and objective rail were already visible; smoke URLs still registered the service worker; and first-frame sprite requests could remember missing manifest assets too early.
- **Root Causes:** The challenge adapter replaced every active session goal title with `Goal`; notification compact mode used backing canvas width instead of CSS viewport width; service-worker registration did not check runtime URL mode; and sprite availability failures were sticky even when a manifest load resolved later.
- **Fixes:**
  - Updated `ChallengeSystem` to carry session goal icons/descriptions, fit long labels, and always show a compact progress rail.
  - Updated `NotificationSystem.draw()` to accept CSS layout dimensions, limit compact/mobile to one visible toast, and keep toast sizing consistent with high-DPR canvases.
  - Updated smoke/autostart HTML startup to skip service-worker registration.
  - Updated `AssetLoader` to auto-queue manifest loads for sprite requests, wait for manifest settlement before marking a sprite variant unavailable, and forget unavailable variants after successful SVG/sprite loads.
- **Verification:** `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, main app JS `621.26 kB` / `178.69 kB` gzip); `npm run check:bundle` (pass, main JS `621262B` / `177198B` gzip under budget); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); inspected `output/browser-smoke/desktop.png`, `output/browser-smoke/mobile-compact.png`, and `output/browser-smoke/mobile-large.png`; local before/after screenshots captured under `output/manual-audit/`.

### 2026-05-14 — director-architecture-gameplay-loop — Planned

- **Issues:** The repo-level redo request identified overlapping scenario, goal, achievement/progression, moment/director, and god-tool systems; active scenario objectives were partly split between UI panels and runtime state; saves did not preserve the newly requested favorite/selected creature context; and browser smoke did not verify the consolidated director/objective surface.
- **Root Causes:** Creature Sandbox had grown useful systems in parallel (`PlayableScenarios`, `CampaignSystem`, `SessionGoals`, `ChallengeSystem`, `AchievementSystem`, `UnlockableAchievements`, `AutoDirector`, `MomentsSystem`, `ToolController`, god-mode input), but no single adapter boundary described the playable loop or coordinated persistence/testing.
- **Fixes:** Add non-destructive `src/game` facades for director, objectives, progression, story moments, scenario registry, and god tools; keep Canvas 2D and existing simulation modules; preserve old modules behind adapters; add save/test/smoke coverage around the consolidated loop.
- **Verification:** Planned: `git diff --check`; `npm run lint`; `npm test`; `npm run build`; `npm run smoke:browser`; `npm run check:bundle`; local browser screenshot review.

### 2026-05-14 — director-architecture-gameplay-loop — Implemented

- **Issues:** Scenario/objective/progression/god-tool ownership was not explicit; objective metrics were duplicated; campaign seeding could resize the world after subsystem grids had already been initialized; direct mobile camera gestures could fight watch/auto-director control; and the prop/god-tool smoke path exposed a stale panel-hint bug after the new facade was introduced.
- **Root Causes:** Older systems were individually functional but wired side-by-side from `app-bootstrap.js`; objective calculations lived in multiple places; `World.seed()` reset dimensions too late for campaign configs; God Mode UI state was not refreshed when a facade-selected tool mapped to an existing canvas tool.
- **Fixes:**
  - Added `src/game/` facades: `GameDirector`, `ObjectiveSystem`, `ProgressionSystem`, `ScenarioRegistry`, `StoryDirector`, and `GodToolSystem`.
  - Added boundary index modules for `core`, `game`, `render`, `input`, `ui`, and `platform` without moving runtime files.
  - Centralized gameplay objective metrics in `gameplay-objectives.js` and reused them from sessions, scenarios, tests, and the new objective cards.
  - Persisted session goals, challenge progress, director/progression/tool state, selected creature id, favorite/pinned creature id, camera preview, scenario preview, and share seed metadata.
  - Upgraded the scenario director panel with compact objective cards and wired browser smoke/text state to assert them.
  - Improved selected-creature profile data with generation, family, strength, social drive, and curiosity.
  - Routed God Tool facade changes through the canonical God Mode UI and made undo-capable food/spawn/remove actions use `ToolController` where possible.
  - Added share-seed copy action and explicit `assets/manifests/sprites.json` / `audio.json` with procedural fallback metadata.
- **Verification:** `git diff --check` (pass); `npm run lint` (pass); `npm test` (pass, 154 checks); `npm run build` (pass, 130 modules, main app JS `620.51 kB` / `178.48 kB` gzip); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); `npm run check:bundle` (pass, main JS `620514B` / `177002B` gzip under budget); screenshot inspection passed for `output/browser-smoke/desktop.png`, `mobile-compact.png`, and `mobile-large.png`. External `web_game_playwright_client.js` could not launch because its cached Playwright Chromium executable was missing.

### 2026-05-02 — polish-round-2 — Implemented

- **Issues:** Follow-up polish requested: PWA installability, color-blind support, per-category sound volume, camera bookmarks, lifetime stats.
- **Root Causes:** No `manifest.json` prevented Add to Home Screen; no color-blind modes blocked ~8% of male players; sound volumes were hardcoded per category; large worlds had no quick navigation; no persistent cross-session stats existed.
- **Fixes:**
  - Added `manifest.json` with icons, theme color, and screenshots; linked in `index.html` with `apple-mobile-web-app` meta tags.
  - Added CSS color-blind modes (`protanopia`, `deuteranopia`, `tritanopia`) with canvas hue-rotate filters; added selector in Features panel with persistence.
  - Created Sound panel with per-category volume sliders (Master, Music, Creatures, Ambient, UI, Effects) plus master/mute toggles; wired to `audio-system.js`.
  - Created `camera-bookmarks.js` with save/load slots 1-5; `Shift+1-5` saves, `1-5` teleports; persisted in `localStorage`.
  - Created `lifetime-stats.js` tracking playtime, creatures born/died, predator kills, food eaten, matings, highest population, oldest creature, most successful predator; wired into game-loop event listeners.
- **Verification:** `npm run lint` (0 errors, 0 warnings); `npm test` (148 passing); `npm run build` (pass, 119 modules, main JS `547.90 kB` pre-gzip); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large).

### 2026-05-02 — all-systems — Implemented

- **Issues:** Broad audit requested across all 11 categories (DevEx, accessibility, UI polish, performance, runtime, save system, mobile, visuals, audio, simulation, social).
- **Root Causes:** Missing developer tooling (no bundle analyzer, no Prettier); no high-contrast mode or structured screen-reader narratives; stats UI snapped numbers instantly; no undo for god-mode actions; simulation ran full fidelity even when FPS dropped below 30; no offline support; save schema had no declarative migration pipeline and only one auto-save slot; mobile first-run users had no gesture guidance; weather lacked screen-space effects; music was a single monophonic drone; no way to share world seeds; no visual record of creature deaths.
- **Fixes:**
  - Added `npm run analyze` with `rollup-plugin-visualizer` and `.prettierrc`.
  - Added `@ts-check` to `save-migration.js`, `leaderboard.js`, `seed-utils.js`, `ecosystem-ghosts.js`.
  - Added high-contrast CSS mode with toggle in Features panel and `localStorage` persistence.
  - Enhanced `NotificationSystem._announce()` with auto-clear and added `announceNarrative()` for screen-reader ecosystem storytelling.
  - Added `animateNumber()` helper in `ui.js` so population/predator/food stats tick smoothly.
  - Added `GameLoop.godModeUndoStack` / `redoStack` with `pushGodModeUndo()`, `undoGodMode()`, `redoGodMode()`; wired `Ctrl+Z` in `InputManager` to trigger god-mode undo when active.
  - Added `GameLoop.simulationFidelity` (1 / 0.5 / 0.25) that throttles advanced subsystem updates (`seasonalEvents`, `familyBonds`, `memoryLearning`, `challengeSystem`, `unlockableAchievements`) based on rolling FPS.
  - Added creature LOD culling in `renderer-creatures.js`: `lodLevel` is passed to `c.draw()` based on zoom.
  - Added `sw.js` service worker with shell + dynamic caching; registered in `index.html`.
  - Created `save-migration.js` with declarative `SaveMigrations` pipeline (1.0 → 2.0 → 2.5 → 3.0).
  - Integrated `migrateSaveData()` into `SaveSystem.deserialize()`.
  - Added rotating auto-save slots (`creature-sim-autosave-1/2/3`) in addition to legacy single autosave.
  - Added `mobile-gesture-tutorial.js` with one-time overlay for pan/zoom/long-press on first mobile launch.
  - Added `drawRainLens()` (sliding lens drops) and `drawHeatShimmer()` (desert/mountain wave bands) to `renderer-weather.js`.
  - Added dynamic music layer system in `audio-system.js` (`musicLayers`: ambience/rhythm/tension) with crossfading based on predator ratio, disaster state, and ecosystem health.
  - Added `AutoDirector.storyMode` with slower cinematic pans for dramatic events.
  - Created `ecosystem-ghosts.js` (`GhostTrailSystem`) that records deaths and renders faint spectral pulses; wired into `GameLoop` death events and `Renderer` draw loop.
  - Created `seed-utils.js` with `encodeSeed()` / `decodeSeed()` / `getSeedFromUrl()` / `setSeedInUrl()`; wired into `app-bootstrap.js` so New Sandbox seeds are shareable via URL hash.
  - Created `leaderboard.js` with local `localStorage` high-score tracking for campaign levels.
- **Verification:** `npm run lint` (0 errors, 0 warnings); `npm test` (148 passing); `npm run build` (pass, 117 modules, main JS `542.99 kB` pre-gzip); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large).

### 2026-04-30 — ui/render/perf/testing — Planned

- **Issues:** Broad audit requested for gameplay fixes, visual clarity, and performance; live play showed legacy challenge chrome occupying the playfield, the initial desktop run promoted render quality to `ultra` before real FPS samples existed, and the checked-in browser smoke failed at the watch-mode god toggle.
- **Root Causes:** The legacy `ChallengeSystem.draw()` painted three large canvas cards every frame despite newer session-goal UI existing elsewhere; `RendererPerformanceMonitor` averaged placeholder `60 FPS` samples and allowed immediate quality upgrades; `scripts/browser-smoke.mjs` clicked the watch god-mode button without first asserting that the watch strip had become visible.
- **Fixes:** Compact the challenge canvas overlay, gate quality upgrades until real FPS samples are collected, and make the smoke path wait for visible watch controls before clicking.
- **Verification:** `npm test`; `npm run build`; `npm run smoke:browser`; in-app browser desktop/mobile screenshot pass.

### 2026-04-30 — ui/render/perf/testing — Implemented

- **Issues:** The first gameplay view stacked level/challenge cards over the playfield, FPS started low while the renderer had already promoted itself to `ultra`, and `npm run smoke:browser` failed with `#watch-god-mode` present but hidden.
- **Root Causes:** Legacy challenge rendering used a fixed 250px card stack at `x=12,y=120`; the renderer quality scaler used seeded FPS history before any real one-second samples; the smoke test did not wait for watch-mode controls to be visible after toggling watch mode; and the smoke server probe accepted an unrelated Python server on port `4173` because it only checked for an HTTP status below 500.
- **Fixes:** Replaced the legacy challenge stack with a compact translucent summary that shows level progress plus one or two active goals and moves lower on compact canvases; added `_fpsSampleCount` and blocked quality upgrades until at least three real samples exist; chunked smoke `advanceTime()` calls, added explicit visible waits for `#watch-strip` and `#watch-god-mode`, captured canvas snapshots for visual artifacts, and made the smoke server probe require the Creature Sandbox HTML marker before reusing an existing server.
- **Verification:** `git diff --check` (pass); `npx eslint creature-sim/src/renderer-performance.js creature-sim/src/challenge-system.js creature-sim/src/game-loop.js scripts/browser-smoke.mjs` (pass); `npm test` (148 passing); `npm run build` (pass, main JS `532.51 kB` pre-gzip); `npm run smoke:browser` (pass: desktop, mobile-compact, mobile-large); inspected `output/browser-smoke/desktop.png` and `output/browser-smoke/mobile-compact.png` for compact challenge overlay/readable canvas state. The external `$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js` was attempted against `http://127.0.0.1:8000/?smoke=1` but still hung and was stopped, matching the known local-client issue documented in `progress.md`.

### 2026-04-26 — gameplay/simulation/ui/render/audio — Implemented

- **Issues:** Four major gameplay systems were completely dead (biome interactions, memory learning, ecosystem auto-balance, challenge system), weather particles jittered statically instead of falling, creature rendering did 13,500+ array scans per frame via repeated `rareMutations.find()`, fear contagion caused O(n²) overdrawing, VisualEffects damage numbers/starbursts were fully implemented but never called, audio routed unknown events to generic UI clicks, birth/death played beeps instead of spatial creature sounds, concurrency caps were bypassed for combat audio, touch pan threshold was essentially zero causing mis-taps, save failures used native `alert()`, and combat had active bugs (bleed applied to attacker, energy/health pool mismatch, panic hit predators too).
- **Root Causes:** `biome-interactions.js` was not imported anywhere; `memory-learning.js` lacked an `update()` method; `world-ecosystem.js` `update(dt)` was never called by `world-core.js`; `challenge-system.js` was never instantiated; weather rain/snow used static seed positions with no velocity offset; `creature-render.js` checked mutations via `.find()` 15+ times per creature; fear contagion drew directly onto neighbor creatures during individual render; `VisualEffects` had zero call sites in event handlers; `audio-system.js` `playSound()` fell through to `playUISound('click')` for disaster types, disease, and play events; birth/death events called `playSound()` instead of `playCreatureSound()`; death/attack/mating branches created oscillators directly without checking `maxConcurrent`; mobile pan threshold was `1.2px`; auto-save failure used `alert()`; `inflictBleed()` applied bleeding to the attacker parameter; `calculateDamage()` divided energy by `maxHealth`; `triggerPanicResponse()` set panic on all nearby creatures including predators.
- **Fixes:** Imported `BiomeInteractions` into `creature.js` and called `applyBiomeEffects()` + `applyAdaptationBonuses()` per frame so forest stealth, desert heat drain, tundra slowdown, swamp disease, and mountain vision bonuses activate; added `update(world, dt)` to `MemoryLearningSystem` that iterates all creatures calling `applyMemoryBehaviors()` + `cleanup()`, and wired `rememberedFoodTarget`/`fleeTarget` into `creature-behavior.js` target selection; added `this.ecosystem.update(dt)` call in `world-core.js` `updateFood()` to activate auto-balancing and population stats; imported and instantiated `ChallengeSystem` in `app-bootstrap.js`, passed it to `GameLoop`, and added `.update()` in `updateSubsystems()` plus `.draw()` in the render loop; fixed weather jitter in `renderer-weather.js` by offsetting rain/snow Y positions with `time * fallSpeed` modulo viewport height; built a `mutationSet` cache on each creature in `creature-render.js` and replaced all 16 `rareMutations.find()` calls with `mutationSet.has()` checks; removed fear contagion O(n²) drawing and replaced with `_fearTint` property assignment for future batch pass; removed per-particle `ctx.save()/restore()` from `particle-system.js` draw loop; imported and instantiated `VisualEffects` in `game-loop.js`, wired `createBirthEffect`, `createDeathEffect`, `createHitEffect`, and `createMatingEffect` into `CREATURE_BORN`, `CREATURE_DIED`, `CREATURE_KILLED`, and `CREATURE_BOND` events; fixed `playSound()` router to handle `'disease'`, `'play'`, and `disaster_*` prefixes with per-disaster oscillators; routed `CREATURE_BORN`/`CREATURE_DIED` to `playCreatureSound(..., 'birth'/'death', camera)` for spatial audio; added `maxConcurrent` guards to death/attack/mating branches in `playCreatureSound()`; removed unused `ProceduralSounds` dual AudioContext initialization; changed mobile `panThreshold` from `1.2` to `Math.max(6, 4 * DPR)`; replaced save-fail `alert()` with `notifyUI()`; added `-webkit-tap-highlight-color: transparent` and `color-scheme: dark` to base CSS; added `overscroll-behavior-y: contain` to drawer content; added focus management to `setPanelVisibility()` so panels shift focus to first focusable child on open; fixed `inflictBleed()` to apply to victim parameter and updated caller to pass prey; fixed `calculateDamage()` to use `maxEnergy` instead of `maxHealth`; filtered `triggerPanicResponse()` to exclude predators and the attacking predator; added `FLEE` and `HUNT` goals to `creature-agent-needs.js`; wired `seasonalSpeedBonus` into `creature-combat.js` `calculateCurrentSpeed()` and `seasonalEnergyMod` into `creature.js` energy drain.
- **Verification:** `npm test` (148 passed); `npm run lint` (0 errors, 0 warnings); `npm run build` (pass, 113 modules transformed, ~530 kB main chunk); all modified files syntax-checked successfully.

### 2026-04-26 — perf/render/audio/ux/gameplay — Implemented (Waves 6-9)

- **Issues:** FPS calculation used single-frame CPU time causing false quality downgrades, particles had no frustum culling, social bonds iterated all creatures regardless of viewport, quality presets ignored their own config values, weather was completely silent, music was a monophonic sine drone, ambient biome sounds were never called, `prefers-reduced-motion` was not respected for many animations, mobile had no long-press inspect gesture, migration targets were assigned but creatures never moved toward them, and there was no sleep cycle.
- **Root Causes:** `renderer-performance.js` calculated FPS as `1000 / stats.frameTime` which is single-frame CPU time not actual FPS; `particle-system.js` draw loop had no viewport bounds checking; `renderer-features-viz.js` `drawSocialBonds()` iterated `world.creatures` directly; `applyQualityPreset` never read `shadowsEnabled`, `heatmapEnabled`, or `maxRenderedCreatures`; `game-loop.js` `_emitWeatherParticles()` had no audio calls; `audio-system.js` `startMusic()` used only one sine oscillator; `playAmbientSound()` existed but `audio.update()` did nothing; CSS animations had no `@media (prefers-reduced-motion: reduce)` guards; `mobile-support.js` had no long-press timer; `seasonal-events.js` set `creature.migrationTarget` but `creature.js` never read it; creatures had a REST goal but no `isSleeping` state.
- **Fixes:** Replaced single-frame FPS with real frame counting in `renderer-performance.js` `beginFrame()` using `_fpsFrameCounter` and 1-second windows; added camera frustum culling to `particle-system.js` `draw()` skipping off-screen particles; added viewport bounds check to `renderer-features-viz.js` `drawSocialBonds()`; extended `applyQualityPreset` to apply `shadowsEnabled`, `heatmapEnabled`, and `maxRenderedCreatures`; fixed `adjustQuality()` to use local `cullDistance` copy instead of mutating `RendererConfig.THRESHOLDS` directly; added `playWeatherSound('rain'|'snow'|'wind')` calls inside `_emitWeatherParticles()`; enhanced `startMusic()` with detuned second oscillator (~3Hz beating) and perfect-fifth triangle oscillator for harmonic depth; rewrote `audio.update()` to call `playAdaptiveMusic()`, `playAmbientSound()`, and `playEcosystemAmbient()`; added `@media (prefers-reduced-motion: reduce)` CSS guard for all animations; added 600ms long-press detection in `mobile-support.js` with `mobilelongpress` custom event; wired `creature.migrationTarget` into `creature.js` target selection with arrival clearing; added sleep cycle in `creature.js` where diurnal creatures sleep at night and nocturnal creatures sleep during day, boosting energy recovery 1.5×; imported `BiomeInteractions` into `creature-behavior.js` and weighted food selection by `getBiomeFoodPreference()`.
- **Verification:** `npm test` (148 passed); `npm run lint` (0 errors, 0 warnings); `npm run build` (pass, 113 modules transformed, ~532 kB main chunk); all modified files syntax-checked successfully.

### 2026-04-21 — gameplay/simulation/ui/render/audio — Implemented

- **Issues:** Critical simulation bugs (duplicate energy drain, disaster/campaign splice errors, combat kill stat inflation), dead code across advanced genetics, predator-prey AI, and enhanced behaviors, inaccessible canvas notifications, broken panel animations, missing spatial audio, ungated mobile touch preventDefault, and campaign world configs that never reached the world seeding logic.
- **Root Causes:** `creature.js` drained energy twice per update; `world-disaster.js` used `splice(index, 0, 1)` instead of `splice(index, 1)` and referenced `ecosystem?.world.food`; `world-combat.js` incremented `kills` on every bite rather than only on death; `AdvancedGenetics`, `AdvancedPredatorPreyAI`, and `EnhancedBehaviors` were imported but never wired into spawn, update, or behavior loops; `CampaignSystem.applyWorldConfig` stored config locally without passing it to `World.seed`; panel `.hidden` classes used `display: none` which nukes CSS transitions; notifications were canvas-only with no DOM fallback; audio routed directly to `ctx.destination` with no compressor or panner; mobile touch handlers called `preventDefault` unconditionally; `session-goals.js` auto-advance for manual spawns checked `parentId !== null` instead of `== null`.
- **Fixes:** Removed duplicate energy drain in `creature.js`; fixed disaster splice and food-destruction crash in `world-disaster.js`; fixed campaign splice bug in `campaign-system.js` and wired `pendingCampaignConfig` into `World.seed` so level-specific creature counts, food rates, season speed, and disaster triggers are applied; moved `predator.stats.kills++` into the death-only branch in `world-combat.js` and capped energy gain at `maxEnergy`; imported `AdvancedGenetics` into `world-creature-manager.js` and called `applyRareMutations` + `applyChimeraMutation` on all spawn paths (manual, child, clone, genes); imported `AdvancedGenetics` into `creature.js` and called `applyMutationEffects` per frame so regeneration, photosynthesis, bioluminescence, and venom actually function; imported `AdvancedPredatorPreyAI` and `EnhancedBehaviors` into `creature-behavior.js` and wired hunting strategies, evasion tactics, schooling, pack hunting flanking, herding protection, and scavenging into the main update loop; fixed `session-goals.js` manual spawn counting (`parentId == null`) and added auto-refresh when all goals complete; replaced `display: none` with `visibility: hidden` + opacity/transform transitions on `.panel.hidden`, `.bottom-drawer.hidden`, `.moments-panel.hidden`, and `.watch-strip.hidden`; added accessible DOM toast container in `notification-system.js` that mirrors every canvas notification; added `DynamicsCompressorNode` master chain and `StereoPannerNode` spatial audio support in `audio-system.js` with distance-based attenuation and left/right panning; gated `preventDefault` in `mobile-support.js` to only fire on canvas touches when no panel overlay is open; added slider `--value` CSS custom property sync in `ui-controller.js` so range track fills render correctly; added `navigator.vibrate` haptics on creature grab (12ms), throw ([20,30,40]), and combat kill ([30,50,30]).
- **Verification:** `npm test` (146 passed); `npm run lint` (0 errors, 0 warnings); `npm run build` (pass, 108 modules transformed, ~477 kB main chunk); all modified files syntax-checked successfully.

### 2026-04-15 — render/ui — Planned

- **Issues:** The playfield had become overwhelmingly green, biome sampling was reading as hard terrain blocks, and the minimap framing no longer matched the calmer runtime/UI palette.
- **Root Causes:** `renderer-config.js` still seeded a green world background, `drawBiomes()` in `renderer.js` layered green-biased rectangular biome fills plus a spring-green seasonal wash across the whole scene, and `renderer-minimap.js` still used a bright yellow viewport frame from the older visual direction.
- **Fixes:** Move the world base palette to a neutral blue-slate ground, replace hard biome blocks with blended biome lighting, reduce seasonal color casts, and retune the minimap accents to match the calmer scene.
- **Verification:** `npx eslint creature-sim/src/renderer.js creature-sim/src/renderer-config.js creature-sim/src/renderer-minimap.js`; Playwright gameplay screenshots before/after iteration; `npm test`; `npm run build`.

### 2026-04-15 — render/ui — Implemented

- **Issues:** The world looked monochrome green and visually fatiguing, the terrain read as obvious rectangular samples instead of natural biomes, and the minimap viewport/frame styling was much louder than the rest of the scene.
- **Root Causes:** The renderer used a green base background, green-heavy biome swatches, and a spring overlay that pushed the entire canvas toward the same hue; biome coverage was drawn as per-cell fills rather than blended patches; and the minimap viewport frame still relied on a saturated yellow highlight.
- **Fixes:** Updated `renderer-config.js` to use a neutral blue-slate background; replaced the rectangular biome overlay in `renderer.js` with warm/cool atmospheric grading plus soft radial biome blending using more neutral earth/stone/wetland tones; reduced seasonal overlay intensity and removed the extra green spring cast; and changed the minimap viewport/border/label accents in `renderer-minimap.js` from yellow to muted blue-white tones that fit the new palette.
- **Verification:** `npx eslint creature-sim/src/renderer.js creature-sim/src/renderer-config.js creature-sim/src/renderer-minimap.js` (pass); `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url "http://127.0.0.1:4173/" --click-selector "#btn-new-game" --actions-json '{"steps":[{"buttons":[],"frames":12},{"buttons":["left_mouse_button"],"frames":2,"mouse_x":420,"mouse_y":320},{"buttons":[],"frames":12}]}' --iterations 2 --pause-ms 250 --screenshot-dir output/web-game/palette-pass` (pass; confirmed the green cast was gone but the first pass was too flat); `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url "http://127.0.0.1:4173/" --click-selector "#btn-new-game" --actions-json '{"steps":[{"buttons":[],"frames":12},{"buttons":["left_mouse_button"],"frames":2,"mouse_x":420,"mouse_y":320},{"buttons":[],"frames":12}]}' --iterations 1 --pause-ms 250 --screenshot-dir output/web-game/palette-pass-final` (pass; inspected final screenshot and confirmed the scene stayed neutral without reverting to green); `npm test` (pass); `npm run build` (pass).

### 2026-04-14 — frontend/perf/mobile — Planned

- **Issues:** Startup still loaded campaign, scenario editor, and enhanced analytics eagerly; the main bundle stayed around 680 kB pre-gzip; the build still reported an ineffective dynamic import warning; the overflow menu lacked fullscreen; and scripted genetics overrides could still pick up random disorders and intermittently fail constructor tests.
- **Root Causes:** `main.js` imported optional systems on the critical path, analytics work stayed wired into the hot path even when its panel never opened, `ui-controller.js` dynamically imported `behavior.js` even though `creature.js` already forced it into the main chunk, no fullscreen action existed in the mobile/system menu, and `makeGenes()` only disabled random disorders when `seed.disorders` was explicitly passed.
- **Fixes:** Move scenario editor, campaign, and enhanced analytics behind cached dynamic loaders; gate advanced analytics work on module availability; collapse the ineffective `behavior.js` dynamic import into direct imports; add a fullscreen system action with resilient fallback behavior; and make scripted gene overrides deterministic unless a caller explicitly opts back into random disorders.
- **Verification:** `npx eslint creature-sim/src/genetics.js creature-sim/src/enhanced-analytics-loader.js creature-sim/src/ui-controller-panels.js creature-sim/src/game-loop.js creature-sim/src/control-strip.js creature-sim/src/main.js creature-sim/src/ui-controller.js`; `npm test`; `npm run build`; Playwright gameplay smoke; Playwright fullscreen + resize checks.

### 2026-04-14 — frontend/perf/mobile — Implemented

- **Issues:** Startup paid for optional systems before gameplay began, the bundle still carried avoidable warning noise and extra startup weight, the mobile/system overflow menu could not enter fullscreen, and genetics-backed scripted scenarios still had a flaky disorder path.
- **Root Causes:** `scenario-editor.js`, `campaign-system.js`, and `enhanced-analytics.js` were still reachable from eager startup code paths; `behavior.js` was being dynamically imported in UI code despite already being statically required by `creature.js`; fullscreen had no surfaced action in the control-strip menu; and `makeGenes()` treated any seeded override without `seed.disorders` as eligible for fresh random disorders.
- **Fixes:** Added `enhanced-analytics-loader.js` and swapped campaign/scenario/analytics entry points to cached lazy loaders; updated `GameLoop` to skip advanced analytics work until the analytics module is actually loaded and to reuse the renderer context in overlays; added `⛶ Fullscreen` to the overflow menu with a fallback from `requestFullscreen({ navigationUI: 'hide' })` to plain `requestFullscreen()`; replaced the UI-side `behavior.js` dynamic imports with static imports; and made scripted trait overrides deterministic by default while keeping random disorders for natural/default gene rolls unless `randomDisorders` is explicitly requested.
- **Verification:** `npx eslint creature-sim/src/genetics.js creature-sim/src/enhanced-analytics-loader.js creature-sim/src/ui-controller-panels.js creature-sim/src/game-loop.js creature-sim/src/control-strip.js creature-sim/src/main.js creature-sim/src/ui-controller.js` (pass); `npm test` (pass); `npm run build` (pass; main JS chunk reduced to `617.64 kB` pre-gzip from roughly `680 kB`, with separate `campaign-system`, `scenario-editor`, and `enhanced-analytics` chunks and no ineffective dynamic import warning); `node "$HOME/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js" --url "http://127.0.0.1:4173/" --click-selector "#btn-new-game" --actions-json '{"steps":[{"buttons":[],"frames":12},{"buttons":["left_mouse_button"],"frames":2,"mouse_x":420,"mouse_y":320},{"buttons":[],"frames":12}]}' --iterations 2 --pause-ms 250 --screenshot-dir output/web-game/second-pass` (pass; gameplay screenshots and state captured after entering the sandbox); Playwright MCP verification confirmed the overflow menu exposes `⛶ Fullscreen`, fullscreen entered/exited successfully, resizing to `390x844` applied `mobile-device mobile-compact-ui`, and resizing back to `1280x720` cleared the mobile classes again.

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
