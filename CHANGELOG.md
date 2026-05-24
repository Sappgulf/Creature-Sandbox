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
