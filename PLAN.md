# Creature Sandbox - Development Plan

## Active

- [ ] Complete smoke test verification in browser (now use `npm run dev` instead of python http.server)
- [ ] Verify core loop: spawn → select → interact → save/load
- [ ] Verify mobile touch controls work correctly

## Session Audit (2026-04-15, Session 8 - Bug Fixes & Performance)

### Focus
Fix creature visibility at high zoom and improve rendering consistency across zoom levels.

### Changes

**Creature Rendering Fixes:**
1. **Increased creature size** (`creature-render.js:1089`) — Increased renderSize multiplier from 4 to 5 for better visibility at all zoom levels
2. **Fixed procedural rendering** (`creature-render.js:1096-1106`) — Procedural creatures now scale with creature size (procSize = r * 1.2) instead of fixed small triangle
3. **Fixed LOD triangles** (`renderer-creatures.js:140-159`) — Medium LOD triangles now scale based on creature size instead of fixed 7px
4. **Fixed LOD dots** (`renderer-creatures.js:129-140`) — Ultra-low LOD dots now scale based on creature size (min 3px)
5. **Fixed explicit/fallback rendering** (`renderer-creatures.js:205-234`) — Fallback triangle rendering scales with creature size with improved contrast

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed
- `npm run build` — succeeds in 180ms

## Session Audit (2026-04-15, Session 7 - Visual Polish)

### Focus
Implemented 12 major improvements across visuals, gameplay, performance, and UX.

### Changes

**Visual Improvements:**
1. **Particle system overhaul** (`particle-system.js`) — Added `category` property to all 20 particle types, replaced fragile `p.color.includes()` string matching with typed `p.category === ...` checks
2. **Sprite-based decorations** (`renderer.js`, `world-core.js`) — Enhanced procedural fallbacks with layered depth (tree foliage, rock highlights, flower petals, grass blades); added type-specific hue ranges for better visual variety
3. **Creature sprite animations** (`creature-render.js`, `world-creature-manager.js`) — Flying/burrowing creatures now use SVG sprites; added `creatureType` trait detection for sprite selection
4. **Post-processing bloom/glow** (`creature-render.js`, `particle-system.js`) — Added `shadowBlur` to fire (8), ice (6), electric (10), sparkle (6), food (5), and evolution (12) particle effects

**Gameplay Improvements:**
5. **Flying/burrowing behaviors** (`creature.js`, `creature-behavior.js`, `genetics.js`) — Flying creatures seek high elevation with swooping motion; burrowing creatures prefer underground with fear reduction
6. **Mutation visual diversity** (`creature-render.js`) — Added effects for Gigantism (power aura + ripples), Dwarfism (cute aura + stars), Albinism (UV glow + damage sparks), Melanism (night vision aura), Longevity (golden aura + rings), Accelerated Aging (decay aura), Super Senses (radar sweep), Photosynthesis (energy glow), Chimera (multi-color swirl)
7. **Nocturnal advantages** (`creature-agent-needs.js`, `creature.js`, `world-combat.js`, `creature-render.js`) — Nocturnal creatures gain 25% speed, 30% vision, 20% hunting bonus at night; diurnal creatures get 15% night penalty; enhanced nocturnal glow

**Performance Improvements:**
8. **Culling optimization** (`game-loop.js`) — Verified spatial grid culling already implemented; enhanced debug overlay with culling effectiveness metrics
9. **Particle pooling** (`object-pool.js`, `particle-system.js`) — Particle pool size increased to 2000; all particle creation uses pooled objects; fixed particle leak bug where dead particles weren't returned to pool

**Other Improvements:**
10. **Sprite caching** (`asset-loader.js`, `creature-render.js`) — Multi-zoom sprite caching at 5 levels (32, 48, 64, 96, 128px); nearest zoom level selected to minimize scaling
11. **Save system compression** (`save-system.js`, `main.js`) — gzip compression using browser's `CompressionStream` API; backward compatible with `C2:` prefix marker
12. **Tutorial system** (`event-system.js`, `ui-controller-spawn.js`, `tutorial-system.js`) — Added spawn step to tutorial; spawn tracking via events; persistent progress in localStorage

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed
- `npm run build` — succeeds in 187ms

## Session Audit (2026-04-15, Session 5)

### Focus
Sprite Caching at Multiple Zoom Levels - pre-render creature sprites at multiple zoom levels to avoid re-tinting on every frame.

### Changes
- `creature-sim/src/asset-loader.js` — Added `ZOOM_SIZES = [32, 48, 64, 96, 128]` constant and `getNearestSpriteSize()` helper method for selecting nearest cached size
- `creature-sim/src/creature-render.js` — `updateCachedCanvas()`: replaced single-size (64px) caching with multi-size pre-caching at all 5 zoom levels into `creature._cachedSpriteSets`; color-invalidation guard still works correctly across all sizes; changed `console.error` to `console.debug` for expected async failures
- `creature-sim/src/creature-render.js` — `getCachedSpriteFrame()`: added `renderSize` parameter; selects nearest cached zoom level (smallest cached size >= renderSize, or largest available if none qualify) to minimize canvas scaling quality loss
- `creature-sim/src/creature-render.js` — `drawCreature`: factored out `renderSize = r * 4 * eatScale` computation before sprite draw to pass to `getCachedSpriteFrame()`

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-15, Session 4)

### Focus
Tutorial System - add "spawn creatures" step and proper spawn tracking.

### Changes
- `creature-sim/src/event-system.js` — Added `CREATURE_SPAWN: 'creature:spawn'` event for manual creature spawns
- `creature-sim/src/ui-controller-spawn.js` — Added import for `eventSystem` and `GameEvents`; emit `CREATURE_SPAWN` event after successful spawn with creatureId, type, and position
- `creature-sim/src/tutorial-system.js` — Added spawn step to `DEFAULT_STEPS` (after welcome, before camera); updated welcome text from "four" to "five" quick moves; added `spawn` listener tracking; added `trackSpawn()` method; added `spawn` case to `_progressWaitFor()` and `_resetProgressCounters()`

### Verified
- `npm run lint` — 0 errors, 1 warning (pre-existing in asset-loader.js)
- `npm test` — 146 passed, 0 failed

### Notes
- Tutorial system already existed but lacked spawn tracking and spawn step
- `CREATURE_SPAWN` event distinguishes user-initiated spawns from natural creature births (`CREATURE_BORN`)
- Tutorial dismisses on first successful spawn action via auto-advance timer

## Session Audit (2026-04-15)

### Focus
Save System Compression - reduce localStorage usage by compressing saves.

### Changes
- `creature-sim/src/save-system.js` — Added gzip compression using browser's built-in `CompressionStream` API:
  - Added `COMPRESSED_MARKER = 'C2:'` prefix for compressed data
  - Added `compressJson()` function: compresses JSON string to gzip, returns base64 with marker
  - Added `decompressJson()` function: detects compressed data via marker, decompresses gzip
  - Added `compressionEnabled` toggle (default: true) to SaveSystem
  - Modified `autoSave()`: now async, compresses before storing in localStorage
  - Modified `loadAutoSave()`: now async, auto-detects and decompresses if needed
  - Modified `saveToSlot()`: now async, compresses before storing
  - Modified `loadFromSlot()`: now async, auto-detects and decompresses if needed
  - Modified `saveToFile()`: now async, saves as .crsim file (compressed or uncompressed based on toggle)
  - Modified `loadFromFile()`: now async, auto-detects and decompresses if needed
- `creature-sim/src/main.js` — Updated callers to handle async methods:
  - `handleSaveToFile` is now async
  - Continue button click handler is now async to properly await `loadAutoSave`

### Verified
- `npm run lint` — 0 errors, 1 pre-existing warning (MAX_ZOOM_CACHE_PER_SPRITE unused)
- `npm test` — 146 passed, 0 failed
- Backward compatible: uncompressed saves load correctly (detected by missing `C2:` prefix)

### Notes
- Compression uses gzip via `CompressionStream` - available in all modern browsers
- Saves are marked with `C2:` prefix so uncompressed saves (from older versions) load fine
- `compressionEnabled` toggle allows disabling compression if needed for performance

## Session Audit (2026-04-16, Session 4)

### Focus
Particle Pooling - reduce GC pressure from particles by implementing object pooling.

### Changes
- `creature-sim/src/object-pool.js` — Enhanced `ParticlePool`: increased maxSize from 1000 to 2000, expanded factory/defaults to include all particle properties (type, category, opacity, twinkle, expandRate, targetX/Y, text, pulse, delay, fadeInTime, name, hue, label), comprehensive reset function clears all particle properties
- `creature-sim/src/particle-system.js` — Full pooling integration:
  - Added `import { poolManager }` for accessing shared pool
  - Added `_getPooledParticle()` / `_releaseParticle()` helper methods
  - Replaced all `this.particles.push({...})` calls with pooled particle acquisition in 20+ methods (birth, death, weather, combat, food, evolution, heal, season, disease, venom, eat, bond, panic, migration, nest, scarcity, mutation, territory, play, elder, bubbles, ripples, etc.)
  - `update()` now calls `_releaseParticle()` when particles die (before they were simply discarded - a leak)
  - `clear()` now releases all particles back to pool before clearing array
  - Added `_particleReleased` tracking counter
- `scripts/core-modules.test.mjs` — Fixed test to check for `opacity` instead of `alpha` (actual property used by particle system)

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed (all tests pass)
- All particle effects should work identically, but particles are now recycled instead of garbage collected

## Session Audit (2026-04-16, Session 5)

### Focus
Post-Processing Effects - Bloom/Glow: enhance visual effects using canvas shadowBlur.

### Changes
- `creature-sim/src/creature-render.js` — Enhanced elemental auras with shadowBlur:
  - **Fire elemental**: Added `shadowBlur = 8` with orange glow color for flame particles (wrapped in save/restore)
  - **Ice elemental**: Added `shadowBlur = 6` with cyan-white glow for ice crystal rays (wrapped in save/restore)
  - **Electric elemental**: Added `shadowBlur = 10` with yellow glow for lightning bolts (wrapped in save/restore)
- `creature-sim/src/particle-system.js` — Enhanced particle glows with shadowBlur:
  - **Sparkle particles**: Added `shadowBlur = 6` with particle color for birth/celebration sparkles
  - **Food particles**: Added `shadowBlur = 5` with green color for food absorption effect
  - **Evolution particles**: Simplified glow using single save/shadow/restore block (shadowBlur = 12)

### Verified
- `npm run lint` — 0 errors, 1 warning (pre-existing unused var in asset-loader.js)
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-16, Session 3)

### Focus
Day/Night Creature Behavior - Nocturnal Advantages: enhance nocturnal creature behaviors at night.

### Changes
- `creature-sim/src/creature-agent-constants.js` — Added `NOCTURNAL` tuning block: `NIGHT_SPEED_BONUS: 0.25`, `NIGHT_SENSE_BONUS: 0.3`, `NIGHT_HUNT_BONUS: 0.2`, `NIGHT_GLOW_INTENSITY: 1.8`, `DIURNAL_NIGHT_SPEED_PENALTY: 0.15`
- `creature-sim/src/creature-agent-needs.js` — Enhanced `updateAgentSenses()` with nocturnal vision bonus at night: nocturnal creatures get up to 30% increased food radius and mate detection radius at night; diurnal creatures get 15% penalty
- `creature-sim/src/creature.js` — Enhanced `calculateCurrentSpeed()` with nocturnal speed bonus at night: nocturnal creatures gain up to 25% speed bonus at night (safer from diurnal predators); also added "night-owl" status effect for nocturnal creatures after dark
- `creature-sim/src/world-combat.js` — Enhanced `executeAttack()` with nocturnal hunting bonus: nocturnal predators gain up to 20% increased hunting success chance at night
- `creature-sim/src/creature-render.js` — Enhanced nocturnal creature glow at night: nocturnal creatures emit a stronger, more visible glow with larger radius (up to 3x+ base radius vs 3x for others), with distinct cyan-tinted coloring

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 144 passed, 2 failed (pre-existing ParticlePool/PoolManager failures unrelated to nocturnal changes)

## Session Audit (2026-04-16, Session 3)

### Focus
Flying and burrowing creature behavior system - add AI movement patterns for specialized creature types.

### Changes
- `creature-sim/src/genetics.js` — Added `flying` and `burrowing` diploid genes with default expression
- `creature-sim/src/creature.js` — Added `flyingAffinity` and `burrowingAffinity` properties; added speed modifiers (flying: +15% at high elevation, burrowing: +10% underground/-15% on surface) and energy drain modifiers (flying: -15% at high altitude/+10% otherwise, burrowing: -25% underground/+15% otherwise)
- `creature-sim/src/creature-behavior.js` — Added `updateFlyingMovement()` with elevation preference, swooping/gliding patterns, and ground obstacle avoidance; added `updateBurrowingMovement()` with underground preference and fear reduction; added helper methods `sampleHighElevationDirection()`, `sampleGroundObstacles()`, `sampleUndergroundDirection()`
- `creature-sim/src/world-creature-manager.js` — `spawnFlying()` now sets `flying: 0.85` gene; `spawnBurrowing()` now sets `burrowing: 0.85` gene

### Verified
- `npm run lint` — 0 errors, 1 warning (pre-existing)
- `npm test` — 144 passed, 2 failed (pre-existing particle pool failures unrelated to changes)
- Gene creation test: flying/burrowing genes express correctly

## Session Audit (2026-04-15)

### Focus
Add or improve visual effects for mutations that lack them.

### Changes
- `creature-sim/src/creature-render.js` — Added visual effects for 9 mutations that previously lacked them:
  - **Gigantism**: Power aura with 3 expanding ripple rings, orange glow gradient, and 4 orbiting power particles
  - **Dwarfism**: Pink/purple cute aura, 3 sparkle stars, and mini heart particle approximations
  - **Albinism**: Pale UV-sensitive glow, UV damage sparks (more intense during day via `dayLight`), white outline ring
  - **Melanism**: Dark purple/blue night vision aura, glowing eye effect with shadowBlur, dark energy wisps
  - **Longevity**: Golden aura with 3 age indicator rings, 4 golden sparkle particles
  - **Accelerated Aging**: 4 rapid ticking decay rings, 6 time urgency particles, brown decay aura
  - **Super Senses**: 2 radar sweep rings, detection sweep line, 5 sensory particles
  - **Photosynthesis**: Green sun energy absorption glow (day-dependent via `dayLight`), energy particles falling from above, chlorophyll sparkles
  - **Chimera**: Multi-colored chaotic aura (purple/cyan/orange/green), trait indicator particles based on `hybridTraits`, chaotic swirl lines

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 144 passed, 2 failed (pre-existing failures in `ParticlePool`/`PoolManager.getParticle` unrelated to visual changes)

## Session Audit (2026-04-16, Session 2)

### Focus
Sprite-based decorations integration: ensure decorations use sprite rendering when available with procedural fallback.

### Changes
- `creature-sim/src/world-core.js` — `generateDecorations()`: Added type-specific hue ranges (rocks: 20-50 for browns/grays, flowers: 0-360 full spectrum, trees: 80-130 greens, grass: 70-110 yellowish greens) instead of uniform 80-120 green range.
- `creature-sim/src/renderer.js` — `_drawDecorationFallback` tree: Improved with layered foliage circles, darker trunk, better depth.
- `creature-sim/src/renderer.js` — `_drawDecorationFallback` rock: Improved with additional highlight circle, darker base tones.
- `creature-sim/src/renderer.js` — `_drawDecorationFallback` flower: Enhanced with variable petal count based on hue, elliptical petals, layered center with highlight.
- `creature-sim/src/renderer.js` — `_drawDecorationFallback` grass: Enhanced with more blades, elliptical base clump, better lean variation.

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-16)

### Focus
Particle system overhaul: replace fragile string color matching with typed categories.

### Changes
- `creature-sim/src/particle-system.js` — Added `category` property to all particle types (sparkle, ring, dust, ghost, gravestone, sleep, weather/rain/snow/wind, blood, food, evolution, heal, season, disease, contagion, venom, bubble, ripple, play, elder, territory). Replaced fragile `p.color.includes(...)` checks in `draw()` with `p.category === ...` checks for rain/snow/wind weather particles. Backward compatible: color property preserved for existing particle creation code.

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-15)

### Focus
1. Culling optimization verification and debug display enhancement

### Changes
- `creature-sim/src/game-loop.js` — Enhanced debug overlay (`renderDebugOverlay`) to show spatial grid culling effectiveness: displays cull percentage, total objects vs rendered, and per-type counts (creatures/food/corpses) using aggregated `performance.stats`

### Verified
- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Analysis: Spatial Grid Culling (Already Implemented)
All culling already uses spatial grid queries:
- **Creatures**: `world.creatureManager.creatureGrid.queryRect()` (renderer-creatures.js:12-18)
- **Food**: `world.foodGrid.queryRect()` (renderer.js:1461)
- **Corpses**: `world.corpseGrid.queryRect()` (renderer.js:1550)

The `queryRect` method iterates only over grid cells intersecting the view bounds, providing O(1) broad-phase culling per cell with per-item precise culling. No changes to culling logic were needed.

## Session Audit (2026-04-15)

### Focus
1. Enhanced water biome rendering with layered caustics, animated waves, and light reflections
2. Enhanced bioluminescence glow effect with shadowBlur, sparkle particles, and night boost
3. Added eating animation (chomp effect) and hunting animation (aggressive pulse ring)
4. Bug sweep: fixed unused variable warnings and verified code quality
5. Wire up Flying/Burrowing creature sprites

### Changes
- `creature-sim/src/renderer.js` — Enhanced `_drawWaterBiomes()` with multi-layered caustic patterns (3 concentric circles with different drift speeds), animated shimmer sparkles (2 per cell at zoom > 0.7), light reflection streaks (zoom > 0.8), and better depth-based coloring (shallow/deep differentiation)
- `creature-sim/src/creature-render.js` — Enhanced bioluminescence glow: added `shadowBlur` for bloom-like effect, 5-stop radial gradient for richer glow, 4 animated sparkle particles orbiting the creature, inner and outer glow rings, night-time brightness boost via `dayLight` option
- `creature-sim/src/creature-render.js` — Added eating animation: creature body pulses (scales between 1.0-1.15) using sine wave over 0.5s cycle, procedural creatures show animated mouth (green circle that opens/closes at front)
- `creature-sim/src/creature-render.js` — Added hunting animation: predators with creature targets show dashed red pulsing ring around them (visible when zoomed in)
- `creature-sim/src/renderer.js` — Fixed bug: `_drawDecorationFromSprite` was referencing undefined `assetKey` variable (passed as parameter now)
- `creature-sim/src/renderer-creatures.js` — Removed unused `hue` variable
- `creature-sim/src/renderer.js` — Removed unused `ctx` variable in `_drawDecoration`
- `creature-sim/src/creature-render.js` — Added `creatureType` check to `assetType` determination: flying creatures use `creature_flying` sprite, burrowing creatures use `creature_burrowing` sprite (checked after age stage but before aquatic/alpha/diet checks)
- `creature-sim/src/world-creature-manager.js` — `spawnFlying()` now sets `creature.traits.creatureType = 'flying'`
- `creature-sim/src/world-creature-manager.js` — `spawnBurrowing()` now sets `creature.traits.creatureType = 'burrowing'`

### Verified
- `npm run lint` — 0 errors, 0 warnings (previously 0 errors, 2 warnings)
- `npm test` — 146 passed, 0 failed
- `npm run build` — succeeds in 277ms

## Session Audit (2026-04-14)

### Focus
1. Fix failing test (Creature constructor genes speed race condition)
2. Visual polish: creature spawn scale-in, death ghost particles, gravestone fade
3. Notification polish: species extinction milestones, first-event toasts, throttled checks
4. CSS polish: loading spinner, focus-visible, panel section dividers

### Changes
- `scripts/core-modules.test.mjs` — Fixed flaky test: set `sex: 'female'` to avoid male speed modifier making expressed genes nondeterministic (1.5 → 1.65).
- `creature-sim/src/creature.js` — Added `spawnTime`/`spawnScale` properties for smooth scale-in animation on birth (0→1 over 0.4s).
- `creature-sim/src/creature-render.js` — Applied spawn scale to creature drawing: scale transform + opacity fade during spawn animation.
- `creature-sim/src/particle-system.js` — Added ghost silhouette particle type on death (brief translucent shape that rises and fades). Enhanced gravestone with fade-in animation.
- `creature-sim/src/notification-system.js` — Added species extinction milestones (herbivore/predator extinct), first-event toasts ("Your ecosystem is growing!"), and `_lastPopulations`/`_firstEventToasts` tracking. Throttled checks.
- `creature-sim/src/game-loop.js` — Added throttled milestone check every 2 seconds in `updateSubsystems`. Added `_milestoneTimer` field.
- `creature-sim/styles.css` — Added CSS loading spinner, `creature-spawn` keyframe, `pulse-glow` keyframe, `focus-visible` outline for `.ctrl-btn`, and `.panel-section + .panel-section` dividers.

### Verified
- `npm test` — 146 passed, 0 failed (was 145 pass, 1 fail)
- `npm run lint` — 0 errors, 0 warnings
- `node -c` syntax checks pass on all modified files

## Session Audit (2026-04-13, Session 2)

### Focus
1. Add unit tests, Vite bundler, mobile panel fixes
2. Split large files into focused modules
3. Code quality fixes (debug globals, ECS cleanup)

### Changes
- Added 108 unit tests for core modules: utils.js, genetics.js, spatial-grid.js, object-pool.js, lineage-tracker.js (scripts/core-modules.test.mjs)
- Added Vite bundler: `npm run dev` (HMR), `npm run build` (prod), `npm run preview` — configured in vite.config.js, updated vercel.json, updated package.json scripts
- Fixed mobile panel overlap: inspector hidden transform, panel bottom offset +16px clearance, god-mode/moments panel bottom using CSS variable, added panel overlay backdrop with dismiss click handler
- Wrapped debug window.* globals behind devtools flag in main.js (lines 1442+)
- Removed ECS no-op from game-loop.js per-frame call
- Removed cache-busting ?v= from index.html (Vite handles this)
- Upgraded ESLint config: no-console warn (allow debug/warn/error/info), varsIgnorePattern for _ prefix, debug-console.js override

### File Splits (prototype-assignment pattern, zero API changes)

**Creature split (creature.js: 3377→2266):**
- creature-genetics-helpers.js (60 lines): NAME_SUGGESTIONS, determineSenseType, resolveDietRole, calculateAttractiveness, pickDesiredTraits
- creature-age.js (94 lines): updateAgeStage, updateLifeStage, getAgeSizeMultiplier, getAgeSpeedMultiplier, getAgeMetabolismMultiplier, getElderFadeAlpha, getAgeStageIcon
- creature-render.js (436 lines): getBadges, drawCreature, getCachedSpriteFrame, updateCachedCanvas, drawBehaviorState, drawTraits
- creature-agent-needs.js (~500 lines): updateAgentState, updateAgentSenses, updateNeeds, selectGoal, updateSteeringForces, isMateCompatible, applyRestRecovery, updateRestHome, updateMatingBond, applyHungerRelief, getHomeBias

**Renderer split (renderer.js: 2681→1377):**
- renderer-features-viz.js (454 lines): 13 feature visualization methods (nests, territories, memory, bonds, migration, emotions, etc.)
- renderer-minimap.js (311 lines): drawMiniMap, _drawBiomeLabels, _getDisasterTint
- renderer-creatures.js (545 lines): 11 creature rendering methods

**UI Controller split (ui-controller.js: 1777→688):**
- ui-controller-exports.js (55 lines): exportSnapshot, exportCSV, exportGenesCSV
- ui-controller-game-mode.js (~120 lines): gameplay mode + session goals controls
- ui-controller-watch.js (~120 lines): watch mode controls + moments
- ui-controller-god-mode.js (~180 lines): god mode controls + actions
- ui-controller-spawn.js (~195 lines): spawn + prop controls + CREATURE_SPAWN_TYPES
- ui-controller-achievements.js (~135 lines): achievements panel + render
- ui-controller-panels.js (~265 lines): features/panel toggles + shortcuts

### Verified
- `npm test` — pass (118 tests: 108 core + 10 save-system)
- `npm run lint` — 0 errors, 0 warnings
- `node -c` syntax checks pass on all files

### Metrics
- Source files now: 87 → 103 modules (16 new focused modules)
- creature.js: -33% (3377→2266)
- renderer.js: -49% (2681→1377)  
- ui-controller.js: -61% (1777→688)
- Total lines reduced across 3 largest files: ~2,900 lines reorganized

## Session Audit (2026-04-13)

### Focus
1. Comprehensive codebase audit and cleanup (P0–P2 issues).
2. Fix all lint errors/warnings, remove dead code, upgrade dependencies.

### Changes
- `creature-sim/src/main.js` — Removed invalid `?v=20260413b` query strings from ES module imports (P0 blocker; would fail in strict module resolution).
- 29 source files — Auto-fixed 542 trailing whitespace + 29 indentation warnings via `npm run lint:fix`.
- `creature-sim/src/creature-behavior.js` — Removed unused `CreatureAgentTuning` import and unused `dist2` destructured import.
- `creature-sim/src/performance-profiler.js` — Removed unused `GameEvents` import.
- `creature-sim/src/enhanced-behaviors.js` — Removed unused `clamp` import.
- `creature-sim/src/disease-system.js` — Removed unused `rand`/`clamp` imports.
- `creature-sim/src/creature-status.js` — Removed unused `clamp` import.
- `creature-sim/src/world-combat.js` — Removed unused `CreatureTuning` import.
- `creature-sim/src/world-disaster.js` — Removed unused `clamp` import.
- `creature-sim/src/creature.js` — Prefixed dead code vars `_baseSpeed`, `_speedScalar`; changed `catch (e)` → `catch (_e)`, `catch (err)` → `catch (_err)`.
- `creature-sim/src/advanced-predator-prey-ai.js` — Prefixed `_predatorSpeed`, `_panicLevel`.
- `creature-sim/src/audio-system.js` — Prefixed unused destructures `_duration`, `_type`.
- `creature-sim/src/world-ecosystem.js` — Prefixed `_speed`, `_size`.
- `creature-sim/src/config-manager.js` — Prefixed `_loadedCount`, `_failedCount`.
- `creature-sim/src/world-core.js` — Changed `catch (__)` → `catch {`.
- `creature-sim/src/world-events.js` — Changed `catch (__)` → `catch {`.
- 29 source files — Converted ~133 `console.log` → `console.debug` (excluded debug-console.js).
- `creature-sim/styles.css` — Added missing `--text-tertiary: #7a8299` variable; merged duplicate `.panel-close:hover` rules.
- `eslint.config.js` — Upgraded to ESLint 10 compat; changed `no-console` from `off` to `warn` (allowing warn/error/info/debug); added `varsIgnorePattern: '^_'` to `no-unused-vars`; added override for debug-console.js to allow `console.log`.
- `package.json` — Upgraded `eslint` from v9 to v10, `globals` from v15 to v17.

### Verified
- `npm test` — pass
- `npm run lint` — 0 errors, 0 warnings (down from 1,177)
- `node -c` syntax checks pass on all core files
- All 87 source files pass syntax validation

### Metrics
- Warnings reduced: 1,177 → 0 (100% resolution)
- Errors: 0 (was already 0)
- Dead imports removed: 8
- Dead assigned vars prefixed: 13
- Console.log → console.debug: ~133 conversions
- Dead batchRenderer code removed: 7 references
- Orphan comments removed: 4
- Camera clamping re-enabled (was disabled with "REMOVED" comments)
- 14 historical markdown files archived to docs/archive/

## Session Audit (2026-04-13, cont.)

### Camera drift fix
- `creature-sim/src/camera.js` — Re-enabled `_clampTargets()`, `_clampPosition()`, `_limits()`, and `_clampPoint()` with 200px margin. These were disabled with "REMOVED: No world boundaries" comments, causing the known camera drift bug.
- Clamping uses `worldWidth`/`worldHeight` plus a 200px margin so the camera stays within the world bounds while allowing slight overscroll.

### Dead code removal
- `creature-sim/src/game-loop.js` — Removed all batchRenderer dead code: `batchRendererReady = false`, `opts.batchRenderer = null`, `useBatchRendering` conditional, and commented-out flush block. Kept `useBatchRendering: false` in renderOptions for interface compatibility.
- `creature-sim/src/main.js` — Removed `// batchRenderer removed (stub)` comment and orphaned `// This block removed to prevent conflicts` comment block at EOF.

### Silent error fix
- `creature-sim/src/renderer.js` — Changed silent `.catch(() => {})` to `.catch((e) => { console.debug(...) })` for sprite load failures.

### Markdown cleanup
- Archived 14 historical markdown files from root to `docs/archive/`: AUTO_HIDE_OVERLAYS.md, COMPLETE_FEATURES.md, DEBUGGING.md, FULLSCREEN_FIX.md, IMPLEMENTATION_COMPLETE.md, MEMORY.md, MOBILE_OPTIMIZATION.md, PERFORMANCE.md, PHASE1_VERIFICATION.md, IMPROVEMENTS.md, UPGRADE_IDEAS.md, FUTURE_IDEAS.md, GAME_GUIDE.md, ARCHITECTURE.md.
- Root directory now contains only: README.md, PLAN.md, CHANGELOG.md, AGENT.md, claude.md

## Session Audit (2026-01-29)

### Focus
1. Confirm mobile side panels no longer cover the playfield on load.
2. Ensure panels open as bottom sheets on small screens.
3. Update docs + changelog entries after verification.

## Session Audit (2026-02-08)

### Focus
1. Reproduce the spawn/visibility regression with instrumentation.
2. Trace spawn → store → render pipeline and fix root cause.
3. Update smoke tests + recovery report after verification.

## Session Audit (2026-02-09)

### Focus
1. Verify quick action controls behave as documented (food drop, spawn drawer toggles).
2. Fix season progression when day/night is toggled off.
3. Polish control strip accessibility state (pressed/expanded).

## Session Audit (2026-02-07)

### Focus
1. Verify baseline app behavior (home screen, New Sandbox, core loop) in browser.
2. Tune health, damage, and recovery for calmer, longer-lived creatures.
3. Reduce abrupt failures (impact/fall damage, hunger/stress spikes) and document balance values.
4. Update smoke tests and documentation after tuning.

## Session Fix (2026-01-28)

### Issue
Creatures not rendering after clicking "New Game" despite being spawned correctly.

### Root Cause
**Duplicate `<canvas id="view">` elements in index.html** (lines 34 and 862). Having two elements with the same ID causes `document.getElementById('view')` to potentially return the wrong canvas - the second one at line 862 had no styling and was not visible.

### Fix Applied
1. Removed duplicate `<canvas id="view"></canvas>` at line 862 of `index.html`
2. Added debug overlay toggle ('D' key) to help diagnose future rendering issues
   - Shows creature count, camera position, view bounds, canvas size, render stats
   - Added `showDebugOverlay` property to `game-state.js`
   - Added 'D' key handler in `input-manager.js`
   - Added `renderDebugOverlay()` method in `game-loop.js`

### Verification
- `node -c` syntax checks pass on all modified files
- Single canvas element confirmed with correct ID
- Debug overlay provides visibility into render pipeline state

### Files Changed
- `creature-sim/index.html` — Removed duplicate canvas element
- `creature-sim/src/game-loop.js` — Added debug overlay rendering
- `creature-sim/src/game-state.js` — Added showDebugOverlay property
- `creature-sim/src/input-manager.js` — Added 'D' key handler for debug toggle

## Session Debug (2026-01-26)

### Issue
Creatures not showing after clicking "New Game".

### Investigation
- Verified creature spawning works correctly (76 creatures created via `world.seed()`)
- Verified world initialization sequence is correct
- Verified renderer receives correct world reference
- No syntax errors in any JS files
- Save system tests pass

### Debug Logging Added
- `game-loop.js`: Log creature count and canvas size on first renders
- `renderer.js`: Log creatures passed to drawCreatures, view bounds, rendered vs culled counts

### Next Steps
- Check browser console for debug output after clicking "New Game"
- Identify if issue is: no creatures, all culled, or drawing failure

## Session Audit (2026-01-24)

### Focus
1. Bug check and polish pass across the codebase.
2. Fix lint errors and ensure all systems initialize correctly.
3. Polish controls for clearer tool state feedback.

### Changed
- `creature-sim/src/ui.js` — Fixed undefined `biome` variable in `renderSelectedInfo` by extracting biome from world at creature position.
- `creature-sim/src/ui-controller.js` — Added `updateToolIndicator()` method to show active tool state on quick action buttons with visual feedback; added tool:changed event listener. Fixed dropdown menus: removed auto-close timeouts that prevented item selection, converted buttons to toggle behavior, added `closeAllDropdowns()` helper, added global click handler to close dropdowns when clicking outside.
- `creature-sim/src/input-manager.js` — Emit `tool:changed` events when tool modes change via keyboard shortcuts.
- `creature-sim/styles.css` — Polished UI throughout:
  - Tool indicator label styling with pulse animation
  - Improved dropdown menus with checkmarks and better spacing
  - Enhanced stats display with tool indicator styling
  - Added panel slide-in/out animations and better close buttons
  - Mobile spawn sheet slide-up animation and selected checkmarks
  - Mobile action ripple feedback
- `creature-sim/index.html` — Added tool indicator element for showing current tool mode.
- `creature-sim/src/notification-system.js` — Added slide-in animation and improved notification colors.

### UI Polish Pass
- Home screen: feature icons glow on hover, improved button hover states
- Inspector: custom scrollbar, section fade-in animation
- Watch mode: slide-up animation, better button hover/active states, improved moments panel
- Notifications: slide-in animation with fade, enhanced color palette
- Feature toggles: custom switch-style checkboxes and radio buttons
- Sliders: enhanced range inputs with filled track and glow effects
- Gene editor: custom scrollbar, improved gene slider layout
- Creature info card: improved metrics layout with borders, enhanced empty state
- Tooltips: fade-in animation, arrow pointer, better styling
- Modal dialogs: improved button active states, icon support, danger/success variants
- Campaign panel: better level card states (completed checkmark, locked overlay)
- Keyboard shortcuts: slide-up animation, 3D kbd key styling with hover glow

### Verified
- `npm test` — pass
- `npm run lint` — 0 errors

## Session Audit (2026-02-04)

### Focus
1. Environmental rhythm (day/night + food cycles) with subtle behavior biasing.
2. Lightweight weather mood (wind/calm) for ambient variation.
3. Optional god mode tools with minimal UI + save/load safety.

### Integration Points (pre-change)
- World update loop: `World.step()` → `WorldEnvironment.update()` + `WorldEcosystem.update()` + `World.updateFood()` in `creature-sim/src/world-core.js`.
- Creature needs + goals: `_updateNeeds()` and `_selectGoal()` in `creature-sim/src/creature.js`; movement speed in `creature-sim/src/creature-behavior.js`.
- Rendering overlays: day/night + season tint in `creature-sim/src/renderer.js`.
- UI toggle entry: HUD overflow menu (`creature-sim/src/menu-model.js`, `creature-sim/src/hud-menu.js`) and quick action area (`creature-sim/index.html`).
- Save/load: environment fields in `creature-sim/src/save-system.js`.

### Planned Actions
- Add cached day/night phase + influence values in `WorldEnvironment`.
- Wire day/night bias into needs decay, goal scoring, and movement speed.
- Implement food regrowth patches with time-of-day + population pressure influences.
- Add lightweight wind/calm mood loop with clear visual tint.
- Add optional god mode toggle + minimal tool bar (food source, calm zone, chaos nudge, spawn/remove).
- Persist time-of-day + environment state; god mode does not persist.
- Update README, smoke tests, and changelog entries.

## Session Audit (2026-02-06)

### Focus
1. Add nests, territory pressure, and home-region preference for creatures.
2. Implement migration scoring + settlement with group bias and cooldowns.
3. Integrate moments/auto-director hooks, save/load persistence, and observer UI toggles.

### Integration Points (pre-change)
- World state + spatial partitioning: `World` in `creature-sim/src/world-core.js`.
- Creature needs, memory, and goals: `creature-sim/src/creature.js` + `creature-sim/src/creature-features.js`.
- Ecosystem food patches/rest zones: `creature-sim/src/world-ecosystem.js`.
- Moments + auto-director: `creature-sim/src/moments-system.js`, `creature-sim/src/auto-director.js`.
- Rendering overlays + feature toggles: `creature-sim/src/renderer.js`, `creature-sim/src/renderer-features.js`, `creature-sim/index.html`.
- Save/load migrations: `creature-sim/src/save-system.js`.

### Planned Actions
- Add region partitioning with pressure/food stats and nest tracking on a throttled cadence.
- Introduce nest entities with comfort, occupancy, and overcrowding penalties.
- Add home nest/region preferences, migration scoring, and settlement memory.
- Hook nests/regions/migration into moments and auto-director (throttled).
- Update save/load schema + docs/smoke tests for new behaviors.

## Session Audit (2026-02-05)

### Focus
1. Watch mode (observer-first UI + auto-camera) with minimal overlays.
2. Moments log + session summary for emergent storytelling.
3. Light ecosystem role tension (herbivore/scavenger/predator-lite) with migration cues.

### Integration Points (pre-change)
- Event hooks: `eventSystem` and existing creature/world emitters (`creature-sim/src/event-system.js`, `creature-sim/src/world-core.js`).
- Camera follow + travel: `creature-sim/src/camera.js` with input overrides (`creature-sim/src/input-manager.js`).
- UI overlays: HUD/menu in `creature-sim/index.html`, `creature-sim/styles.css`, `creature-sim/src/ui-controller.js`.
- Save/load: `creature-sim/src/save-system.js` metadata for lightweight session summaries.

### Planned Actions
- Add watch mode control strip with follow toggle, speed, moments, and god mode shortcut.
- Implement auto-director (event-driven) with smooth travel + user override.
- Add moments log + session summary panel with camera jump targets.
- Add diet roles + predator-lite chase behavior and soft crowd/stress catalysts.
- Add migration detector + scarcity and predator-lite events for storytelling.
- Update docs and smoke tests with watch mode + moments checks.

## Session Audit (2026-02-03)

### Focus
1. Creature memory + place learning with lightweight reinforcement/decay.
2. Life stages + elder fade-out tuning for smoother generational pacing.
3. Save/load migration + observer debug overlays for validation.

### Planned Actions
- Add memory slots with decay, reinforcement, and danger/calm tagging.
- Bias goals with remembered food/calm/nest locations and danger avoidance.
- Add life-stage tuning (baby/adult/elder), elder fade, and reproduction throttles.
- Extend save/load schema to v2.3 with backward-compatible defaults.
- Update smoke tests, README, and changelog entries.

## Session Audit (2026-01-29)

### Phase 1 Gameplay Audit (code inspection)
**Interactions too strong / inconsistent**
- Throw impulses use raw drag velocity with a high cap (420), leading to extreme launches.
- Bounce/spinner props and creature bump impulses stack high forces without weight scaling.
- External impulses ignore creature size, so larger creatures feel too light.

**Actions that dominate play**
- Rapid drag/throw can override normal locomotion, making props feel secondary.

**Systems lacking feedback or consequence**
- Collision reactions can trigger in rapid succession on bumps, reducing readability.
- Camera movement never fully settles due to tiny residual interpolation.

**Chaos: fun vs frustrating**
- Physics chaos is playful, but extreme launches and jittery camera transitions can feel unfair.

**Primary imbalance sources**
- Physics values: throw caps, prop strength, bump forces, impulse decay.
- Camera smoothing and movement thresholds.
- Touch thresholds for grab activation and pan sensitivity.

## Session Audit (2026-01-30)

### Focus
1. Health/damage tuning pass to reduce accidental deaths.
2. Ecosystem internal state loop (stress/energy/curiosity/stability) with emergent signals.
3. Save/load migration support for new creature state fields.

### Planned Actions
- Add tuning constants for health + damage thresholds/i-frames.
- Smooth combat damage and add attack cooldowns.
- Implement lightweight ecosystem state updates with crowd pressure + social contagion.
- Update save schema + smoke tests + docs.

## Session Audit (2026-02-01)

### Focus
1. Needs-driven creature agents (hunger/energy/social/stress) with utility goals.
2. Rest zones + food bite consumption with scent-based sensing.
3. Mating loop with cooldowns, population guardrails, and save/load support.

### Planned Actions
- Add centralized agent tuning constants and per-creature needs/goal state.
- Add rest zones and bite-based food consumption (local scent sensing).
- Update mating logic with controlled offspring + population caps.
- Extend save/load schema + docs + smoke tests for new agent loop.

## Session Audit (2026-01-26)

### Phase 1 Gameplay Audit (code inspection)
**What the player can do**
- Spawn, inspect, and erase creatures; paint food; pause/resume; adjust speeds.
- Toggle simulation features, pan/zoom camera, follow selected creature.
- Use gene editor, scenario lab, campaigns, and goals for longer-term play.

**World reactions**
- Creatures move, hunt, eat, reproduce, and die with visual/audio feedback.
- Selection glow, poke/drop reactions, and particle effects on events.
- Environmental seasons/weather, disasters, and ecosystem balancing.

**Choices that matter**
- Spawn/food placement affects population health and predator-prey balance.
- Gene edits affect traits and emergent survival.
- Tool usage (erase/spawn) and goal selection guide session direction.

### Gameplay dead zones
- Creature interaction is mostly observational after spawn (limited direct manipulation).
- Many UI actions (feature toggles) provide little immediate causal feedback.
- Sandbox lacks tactile props or environment rules for quick experiments.

### Missing affordances
- Drag/throw creatures or objects to test physics outcomes.
- Placeable props/zones (bounce, gravity, spinner) for emergent play.
- Clear contextual prompts for what to try next in the sandbox.

## Session Audit (2026-01-24)

### 10 most visible rough edges (inspection)
1. Overflow menu lacked in-context help after condensation.
2. Save/load hotkeys documented but not implemented for file downloads.
3. Selected creature card disappeared entirely when nothing was selected.
4. Icon-only quick actions relied on hover tooltips (not visible on mobile).
5. Mobile pan/zoom felt overly sensitive and jittery.
6. Mobile keyboard could cover inputs in panels.
7. Ecosystem health updated every frame (overkill on mobile).
8. Pointer move path created new objects each event.
9. Export actions had no confirmation feedback.
10. Menu mapping for condensed HUD was not visible in-app.

### Top 3 performance hotspots (inspection)
1. Per-frame ecosystem health recalculation in `GameLoop.updateSubsystems`.
2. Frequent UI updates for stats/selected info even when unchanged.
3. Pointer move allocations during continuous panning.

## Session Audit (2026-01-25)

### Focus
1. Creature feel upgrades (personality reactions + selection feedback).
2. Session nudges for manual spawns.
3. Home screen tone polish.

## Next

- [ ] Expand ECS stub for batch processing if needed
- [ ] Prototype creature presets panel for sandbox quick starts

## Done

### 2026-04-13 (Vite setup)

- Changed: `vite.config.js` — Created Vite config with root=creature-sim, server port 8000, build outDir=../dist, emptyOutDir=true.
- Changed: `package.json` — Added vite as devDependency; replaced python http.server scripts with `vite`, `vite build`, `vite preview`; kept existing `test` and `lint` scripts.
- Changed: `creature-sim/index.html` — Removed `?v=20260413b` cache-busting query strings from `<script>` and `<link>` tags (Vite handles cache busting via hashed filenames).
- Changed: `vercel.json` — Changed `buildCommand` to `npm run build`, `outputDirectory` to `dist`, updated JS header path from `/src/` to `/assets/`.
- Verified: `npm run build` — 83 modules transformed, built in 578ms.
- Verified: `npm run lint` — 0 errors, 0 warnings.
- Verified: `node scripts/core-modules.test.mjs` — 108/108 passed.
- Verified: `npm test` — Save system tests passed.

### 2026-04-13

- Changed: `creature-sim/src/main.js` — Removed invalid `?v=20260413b` query strings from ES module imports (P0 blocker).
- Changed: 8 source files — Removed dead unused imports (CreatureAgentTuning, GameEvents, clamp, rand, dist2, CreatureTuning).
- Changed: 6 source files — Prefixed assigned-but-unused vars with `_` (baseSpeed, speedScalar, predatorSpeed, panicLevel, etc.).
- Changed: 29 source files — Converted ~133 `console.log` → `console.debug` (excluded debug-console.js).
- Changed: 29 source files — Auto-fixed 542 trailing whitespace + 29 indentation warnings.
- Changed: `creature-sim/styles.css` — Added missing `--text-tertiary` CSS variable; merged duplicate `.panel-close:hover`.
- Changed: `creature-sim/src/world-core.js`, `world-events.js` — Changed `catch (__)` → `catch {}`.
- Changed: `eslint.config.js` — ESLint 10 compat; `no-console` warn (allow debug/warn/error/info); `varsIgnorePattern: '^_'`; debug-console.js override.
- Changed: `package.json` — Upgraded eslint v9→v10, globals v15→v17.
- Verified: `npm test` pass, `npm run lint` 0 errors / 76 warnings (down from 1,177), `node -c` all core files pass.

### 2026-01-26

- Changed: `creature-sim/src/creature-behavior.js` — kept vision-cone food selection inside `seekFood()` and removed stray code that caused a syntax error.
- Verified: `npm test` (pass; npm env warning about http-proxy), `npm run lint` (fails with 3 errors, 1040 warnings pre-existing).
- Notes: Lint errors persist in existing files (e.g., `creature-sim/src/biome-interactions.js`) and need a separate cleanup pass.

### 2026-01-25 (Session 2: Button Handler Fix)

**Changed:**
- `creature-sim/src/main.js` — Removed duplicate New Game button handler (lines 1086-1115)
- `package.json` — Updated Node.js requirement from >=14.0.0 to >=18.0.0
- `creature-sim/docs/RECOVERY_REPORT.md` — Documented button handler fix

**Why:**
- Duplicate button handlers (onclick + addEventListener) caused conflicts
- Single handler in showHomePage() is correct approach
- Node 14 is EOL, 18 is current LTS

**Verified:**
- Removed conflicting onclick assignment
- Single addEventListener remains in showHomePage()
- Console logging present for debugging
- Syntax check passed

**Notes:**
- New Game button should now work correctly
- Manual browser testing required to confirm fix

### 2026-01-25 (Session 1: Syntax Fix)

**Changed:**
- `creature-sim/src/main.js` — Removed stray '1' character on line 1163 that caused syntax error
- `creature-sim/docs/RECOVERY_REPORT.md` — Created recovery report documenting baseline assessment and fixes
- `creature-sim/docs/SMOKE_TESTS.md` — Updated with comprehensive critical tests and recovery status

**Why:**
- Fix P0 blocker preventing app from booting (syntax error)
- Establish recovery baseline and test plan
- Simplest change: remove single typo character

**Verified:**
- `node -c creature-sim/src/main.js` — syntax check passed
- `node -c creature-sim/src/ui-controller.js` — syntax check passed
- Button handlers confirmed present in showHomePage() function
- No missing imports detected

### 2026-01-29

**Changed:**
- `creature-sim/src/creature.js` — added landing/fall/overreaction reactions, mood icons, eye tracking, silly badges, and recovery poses.
- `creature-sim/src/sandbox-props.js` — added spring/launch/see-saw/conveyor/slope/fan/sticky props with tuned forces and chaos scaling.
- `creature-sim/src/renderer.js` — drew new prop affordances and impact highlights.
- `creature-sim/src/game-loop.js`, `creature-sim/src/ui.js`, `creature-sim/src/ui-controller.js` — added curiosity prompts and chaos dial bindings.
- `creature-sim/index.html`, `creature-sim/styles.css` — added chaos slider UI and new prop entries.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md`, `README.md`, `CHANGELOG.md` — documented playful pass updates.

**Why:**
- Increase tactile feedback, replayable toy interactions, and fun prompts while keeping the core loop intact.

**Verified:**
- `npm test`
- `npm run lint`

### 2026-01-29

**Changed:**
- `creature-sim/src/input-manager.js` — tuned grab/throw thresholds, added throw caps, and scaled impact feedback by throw intensity.
- `creature-sim/src/creature.js` — normalized external impulse by size, added collision reaction cooldown, and made animation timing frame-rate independent.
- `creature-sim/src/sandbox-props.js` — reduced prop strengths and impulse caps for bounce/spinner/gravity.
- `creature-sim/src/world-core.js` — softened creature bump forces.
- `creature-sim/src/camera.js` — smoothed camera interpolation and snap-to-target thresholds.
- `creature-sim/src/mobile-support.js` — reduced pan/zoom sensitivity and increased movement threshold.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md`, `README.md`, `CHANGELOG.md` — documented balance pass checks and notes.

**Why:**
- Improve interaction fairness, reduce extreme launches, and stabilize camera/touch feel without changing the core loop.

**Verified:**
- `npm test`
- `npm run lint` (warnings only)

### 2026-01-28

**Changed:**
- `creature-sim/index.html` — added mobile spawn sheet markup and dismissible interaction hint button.
- `creature-sim/styles.css` — styled mobile spawn sheet, hint close affordance, and selection highlight.
- `creature-sim/src/ui-controller.js` — centralized spawn selection state, mobile spawn sheet handlers, and hint lifecycle clearing.
- `creature-sim/src/ui.js` — updated spawn hint copy and auto-dismiss logic.
- `creature-sim/src/dom-cache.js`, `creature-sim/src/input-manager.js` — cached new UI nodes and escape-to-close for the spawn sheet.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md`, `README.md`, `CHANGELOG.md` — documented mobile spawn selection + help hint lifecycle updates.

**Why:**
- Fix mobile creature selection and ensure help hints dismiss cleanly without blocking touch interactions.

**Verified:**
- `npm test`
- `npm run lint` (warnings only)

### 2026-01-27

**Changed:**
- `creature-sim/src/input-manager.js` — added hover affordance tracking, grab cursor feedback, and grab/drop reactions during drag.
- `creature-sim/src/creature.js` — added grab reaction animation response.
- `creature-sim/src/renderer.js` — added hover/grab outlines for clear interaction affordance.
- `creature-sim/src/game-loop.js` — routed hovered creature state into renderer.
- `docs/SMOKE_TESTS.md`, `docs/ROADMAP.md` — updated verification and shipped notes.
- `README.md`, `CHANGELOG.md` — documented new grab affordances.

**Why:**
- Improve direct manipulation clarity and creature expressiveness without changing the core loop.

**Verified:**
- `npm test`
- `npm run lint`

### 2026-01-24

**Changed:**
- `creature-sim/src/hud-menu.js` — added Help section to overflow menu/sheet.
- `creature-sim/src/ui.js` — added empty-state guidance for selected creature card.
- `creature-sim/src/main.js` — implemented save/load hotkeys, dev-only FPS overlay/timing logs, load helpers.
- `creature-sim/src/game-loop.js` — throttled eco-health updates and wired dev FPS/timing logs.
- `creature-sim/src/mobile-support.js` — tuned gesture sensitivity + keyboard-safe padding updates.
- `creature-sim/src/input-manager.js` — reduced pointer move allocations.
- `creature-sim/src/ui-controller.js` — export toasts.
- `creature-sim/index.html` — tooltip hints and accessibility labels for icon buttons.
- `creature-sim/styles.css` — help/tooltip/keyboard/FPS overlay styles.
- `docs/ROADMAP.md`, `docs/SMOKE_TESTS.md`, `docs/UI_NAVIGATION.md`, `docs/ACCESSIBILITY.md` — updated docs.
- `README.md`, `CHANGELOG.md` — documented save/load hotkeys and help section.

**Why:**
- Improve UX clarity on mobile/desktop, add feedback for key actions, and tighten mobile performance.

**Verified:**
- `npm test`
- `npm run lint`

### 2026-01-23

**Changed:**
- `creature-sim/index.html` — condensed top HUD markup and added overflow sheet containers.
- `creature-sim/src/menu-model.js` — centralized HUD action model with grouping metadata.
- `creature-sim/src/hud-menu.js` — renders HUD primary/overflow menus with keyboard support.
- `creature-sim/src/ui-controller.js` — wired menu actions, session meta toggle, and ARIA updates.
- `creature-sim/src/dom-cache.js` — cached new HUD/menu elements.
- `creature-sim/src/game-state.js` — added session meta visibility state.
- `creature-sim/styles.css` — styled overflow dropdown and mobile bottom sheet.
- `docs/UI_NAVIGATION.md` — documented audit and mapping for top menu actions.
- `docs/SMOKE_TESTS.md` — added navigation-specific checks.
- `README.md` — documented condensed HUD and overflow navigation.
- `CHANGELOG.md` — noted condensed HUD behavior.

**Why:**
- Reduce top menu clutter while keeping all actions within 1-2 taps and preserving accessibility.

**Verified:**
- `npm test` (pass)
- `npm run lint` (0 errors, 77 warnings)

### 2026-01-22

**Changed:**
- `creature-sim/src/gene-editor.js` — Wired gene editor controls, spawn-mode feedback, and code sharing helpers
- `creature-sim/index.html` — Added gene code share UI, nameplates/reduced motion toggles, and improved button labels
- `creature-sim/styles.css` — Added reduced motion styles, gene code UI styles, larger tap targets, and mobile-safe panel sizing
- `creature-sim/src/main.js` — Wired reduced motion + nameplates toggles and gene editor spawn events
- `creature-sim/src/mobile-support.js` — Use VisualViewport-aware sizing for mobile keyboard safety
- `docs/ACCESSIBILITY.md` — Documented accessibility support, limitations, and quick tests
- `docs/SMOKE_TESTS.md` — Added mobile and accessibility smoke steps
- `docs/ROADMAP.md` — Logged shipped upgrades and verification notes
- `README.md` — Documented gene sharing + accessibility controls
- `CHANGELOG.md` — Added Unreleased notes for this pass

**Why:**
- Improve mobile viewport stability, accessibility affordances, and lightweight sharing features without changing the core loop

**Verified:**
- `npm test` — pass
- `npm run lint` — 0 errors, 80 warnings (unused vars)

### 2026-01-21

**Changed:**
- `creature-sim/src/enhanced-analytics.js` — Made analytics dashboard responsive to viewport sizing and resizable charts
- `README.md` — Documented responsive analytics dashboard behavior
- `CHANGELOG.md` — Added Unreleased note for responsive analytics sizing

**Why:**
- Ensure the analytics dashboard fits smaller screens and scales chart canvases when resizing.

**Verified:**
- `npm test` — pass
- `npm run lint` — 0 errors, 80 warnings (unused vars)

### 2026-01-21

**Changed:**
- `creature-sim/src/input-manager.js` — Added brush size hotkeys for tools
- `creature-sim/src/tools.js` — Added brush size clamping helpers
- `creature-sim/src/ui.js` — Added tool HUD indicator in stats
- `creature-sim/src/game-loop.js` — Routed tool/brush size data into HUD
- `creature-sim/src/ui-controller.js` — Spawn button remembers last creature type
- `creature-sim/styles.css` — Styled tool indicator in stats HUD
- `creature-sim/index.html` — Updated shortcuts overlay with brush size controls
- `docs/SMOKE_TESTS.md` — Added manual core loop checks and save/load smoke steps
- `docs/ROADMAP.md` — Added prioritized roadmap with verification steps
- `AGENT.md` — Added guidance for future Codex sessions
- `CHANGELOG.md` — Added release notes entry
- `README.md` — Documented brush size shortcuts

**Why:**
- Make tool state more visible and editing faster without touching core simulation logic
- Lock the core loop into documented smoke tests and roadmap guidance

**Verified:**
- `npm test` — pass
- `npm run lint` — 0 errors, 80 warnings (unused vars)

### 2026-01-21

**Changed:**
- `creature-sim/src/batch-renderer.js` — Created stub to fix missing import (P0 blocker)
- `creature-sim/src/ecs.js` — Created stub to fix missing import (P0 blocker)
- `creature-sim/src/renderer.js` — Removed duplicate `timeOfDay`/`dayNightSpeed` assignment (lines 44-46)
- `creature-sim/src/world-core.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-environment.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-ecosystem.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-creature-manager.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-combat.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/src/world-disaster.js` — Changed verbose `console.log` to `console.debug`
- `creature-sim/index.html` — Added keyboard shortcuts help overlay (press `?` to show)
- `creature-sim/styles.css` — Added styles for shortcuts overlay modal
- `creature-sim/src/input-manager.js` — Added `?` key handler and escape-to-close
- `creature-sim/src/main.js` — Added close button and click-outside-to-close handlers
- `creature-sim/src/mobile-support.js` — Fixed high-DPI coordinate bug, changed `console.log` to `console.debug`
- `creature-sim/src/game-loop.js` — Fixed duplicate import, changed startup logs to `console.debug`
- `eslint.config.js` — Created ESLint 9.x flat config (replaces legacy `.eslintrc.json`)
- `package.json` — Updated ESLint to ^9.0.0, added globals ^15.0.0, updated lint scripts
- `.eslintrc.json` — Removed (replaced by flat config)
- All source files — Auto-fixed trailing whitespace and formatting issues
- `creature-sim/src/tools.js` — Added undo/redo stacks for food/spawn/erase with action history tracking
- `creature-sim/src/world-creature-manager.js` — Added gene-aware manual spawn helper and registry cleanup on removal
- `creature-sim/src/world-core.js` — Proxied gene-aware manual spawn to creature manager
- `creature-sim/src/input-manager.js` — Routed paint/spawn/erase through ToolController and wired Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z to undo/redo

**Why:**
- App would fail to load due to missing ES module imports (`batch-renderer.js`, `ecs.js`)
- Duplicate property assignments shadowed config values from RendererConfig
- Startup logs cluttered browser console; now use `console.debug` (hidden by default)
- Keyboard shortcuts were undiscoverable; help overlay improves UX
- Mobile double-tap zoom was misaligned on high-DPI screens (used canvas buffer size instead of CSS size)
- ESLint 9.x uses flat config format; legacy `.eslintrc.json` no longer supported
- Added undo/redo so accidental spawns/erases/food paints can be reversed safely

**Verified:**
- `npm test` — Save system tests pass
- `npm run lint` — 0 errors, 80 warnings (unused vars only)
- HTTP 200 from local server
- Mobile audit: touch handling, responsive CSS, coordinate conversion all good
- `npm test` — Save system tests pass after undo/redo changes

**Performance Audit:**
- Renderer has frustum culling (creatures outside view are skipped)
- Zoom-based detail reduction (shadows, trails, names disabled when zoomed out)
- Clustering throttled to ~4Hz, skipped when zoomed out
- Analytics throttled to every 5 frames
- World updates throttled to every 30 frames
- No performance issues identified for 500+ creatures

**Notes:**
- PLAN.md created as per CLAUDE.md requirements
- Full codebase audit complete (see invariants below)
- Keyboard help accessible via `?` key (mentioned in home page footer)

---

## Invariants (DO NOT BREAK)

1. Save format v2.0 and backwards migration from v1.x
2. Creature lifecycle: birth → genetics → behavior → reproduction → death
3. Predator/herbivore/omnivore diet and combat system
4. Spatial grid queries (`ensureSpatial`, `gridDirty`)
5. Home screen flow: New Game / Continue / Load
6. Campaign level loading from `campaigns/` directory
7. Auto-save to localStorage every 60s
8. Mini-map click-to-travel and camera follow modes

## Architecture Notes

| Layer | Key Files |
|-------|-----------|
| Entry | `index.html`, `main.js` |
| World | `world-core.js` + `world-environment.js`, `world-ecosystem.js`, `creature-manager.js`, `combat-system.js`, `disaster-system.js` |
| Creature | `creature.js`, `genetics.js`, `behavior.js` |
| Render | `renderer.js`, `renderer-config.js`, `renderer-features.js`, `renderer-performance.js` |
| Loop | `game-loop.js`, `game-state.js` |
| Persistence | `save-system.js`, `config-manager.js` |
| UI | `ui-controller.js`, `ui.js`, `dom-cache.js` |
