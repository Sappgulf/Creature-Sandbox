# Creature Sandbox - Development Plan

## Active

- [x] Add tutorial tooltips for UI elements (hover tooltips explaining buttons/controls)
- [x] Complete smoke test verification in browser (`npm run smoke:browser`)
- [x] Verify core loop: spawn → select → interact → save/load
- [x] Verify mobile touch controls at compact and large mobile viewports
- [x] Add playable scenarios, scenario goals, and Director guidance
- [ ] Continue measuring real-device touch feel outside desktop browser emulation

## Done

### 2026-04-15

- Changed: `creature-sim/src/creature-render.js` — Fixed critical temporal dead zone bug where `rareMutations` and `worldTime` were referenced before their `const` declarations, causing ReferenceError crashes in night glow, bioluminescence, fear wobble, and emotion contagion code paths. Moved declarations before first usage.
- Changed: `creature-sim/src/creature-render.js` — Fixed pack hunting visualization drawing lines at world coordinates instead of creature-local coordinates (lines, aura center, and prey intercept were all double-offset due to canvas already being translated/rotated to creature position). Now converts coordinates to local space using inverse rotation.
- Changed: `creature-sim/src/creature-render.js` — Fixed fear contagion circles drawn at world-relative coords without accounting for canvas rotation. Now applies inverse rotation to correctly position influence circles.
- Verified: `npm run lint` — 0 errors, `npm test` — 146 passed

## Session Audit (2026-04-15, Session 17 - Smooth Camera Transitions)

### Focus

Improve camera following to use easing instead of snapping for smoother tracking.

### Changes

**creature-sim/src/camera.js:**

1. Added easing functions to `_ease()` method:
   - `easeOutCubic`: existing (1 - (1-t)^3)
   - `easeOutQuad`: (1 - (1-t)^2)
   - `easeInOutCubic`: t < 0.5 ? 4t^3 : 1 - (-2t+2)^3/2

2. Modified `update()` method to apply easeOutCubic to lerp factor:
   - Changed `const t = 1 - Math.pow(1 - this.smooth, Math.min(dt * 60, 1));`
   - To `const rawT = ...; const t = this._ease('easeOutCubic', rawT);`
   - This provides natural deceleration as camera approaches target

3. Adjusted `smooth` parameter from 0.14 to 0.08:
   - Original smooth=0.14 gave ~14% per frame linear lerp
   - With easeOutCubic, effective lerp is ~22% per frame (slightly snappier)
   - Combined with easing, provides smooth catch-up without rubber-banding

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Notes

- Frame-rate independent via dt\*60 scaling (unchanged)
- Existing pan/zoom functionality preserved (uses same lerp)
- Travel system continues to use easeOutCubic for smooth animations
- Camera now decelerates naturally when approaching targets, reducing rubber-band feel

## Session Audit (2026-04-15, Session 16 - Ambient Ecosystem Sounds)

### Focus

Add dynamic ambient sounds based on ecosystem health and time of day.

### Changes

**creature-sim/src/audio-system.js:**

1. Added `playEcosystemAmbient(world)` method:
   - Reads ecosystem health from `world.ecoHealth?.metrics?.overall`
   - Reads time of day from `world.dayNightState`
   - Calculates predator ratio to determine tension level
   - Selects appropriate ambient sound type based on health + time + tension

2. Added `playEcosystemSound(type, volume)` method:
   - `peacefulDay`: Happy birds chirping (multiple layered chirps)
   - `peacefulNight`: Gentle crickets and night sounds
   - `calmDay`: Occasional single birds
   - `calmNight`: Soft crickets
   - `tense`: Sparse, unsettling low rumble or high pitch
   - `neutral`: Minimal ambient

3. Modified `update(dt, world)` to use `playEcosystemAmbient` instead of random biome selection

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Notes

- Volume stays low (0.08-0.2) to maintain subtle background presence
- Sound type varies by ecosystem health (healthy → peaceful chirping, tense → quiet/sporadic)
- Time of day affects sound (day birds vs night crickets)
- User can mute via existing `musicEnabled` toggle

## Session Audit (2026-04-15, Session 15 - Selection Pulse Feedback)

### Focus

Add satisfying ripple effect when clicking/selecting a creature.

### Changes

1. **creature-sim/src/input-pointer.js** — Added selection ripple effect on creature click:
   - When a creature is selected in inspect mode, call `world.particles.addImpactRing()` at creature position
   - Ripple uses blue tint `rgba(123, 183, 255, 1)` to match selection color scheme
   - Initial size of 6px expands to ~30px over 0.55s (existing ripple animation)
   - Combined with existing selection pulse (outline scales 1.0→1.25→1.0 over 400ms)

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Notes

- Selection ripple is quick and subtle (550ms duration, 400ms opacity fade)
- Uses existing particle system `addImpactRing` method for consistency
- Combined with existing `selectionPulseUntil` outline pulse for satisfying "pop" feel
- Ripple color matches selection outline color scheme (blue tint)

## Session Audit (2026-04-15, Session 14 - Tutorial Tooltips)

### Focus

Add hover tooltips explaining UI elements for new users.

### Changes

**tutorial-system.js:**

1. Added `TOOLTIP_CONFIG` constant with tooltip text and shortcuts for main UI elements:
   - `#ctrl-pause`: 'Pause or resume simulation' (Space)
   - `#ctrl-speed`: 'Adjust simulation speed' (1-4)
   - `#ctrl-food`: 'Paint food on the world' (F)
   - `#ctrl-spawn`: 'Spawn creatures' (S)
   - `#ctrl-watch`: 'Follow creatures automatically' (W)
   - `#ctrl-god`: 'God mode tools' (G)
   - `#ctrl-more`: 'More options menu' (M)
   - Watch mode and god mode tool buttons with their respective shortcuts

2. Added tooltip state management:
   - `tooltipsDismissed`: Set tracking dismissed tooltips
   - `_tooltipOverlay`: DOM element for tooltip container
   - `_tooltipElements`: Map of selector to tooltip element
   - `_hoverListeners`: Array of bound event listeners

3. Added `initTooltips()` method that creates tooltip overlay and binds listeners

4. Added `_createTooltipOverlay()` helper that creates the tooltip container

5. Added `_bindTooltipListeners()` that:
   - Iterates over TOOLTIP_CONFIG
   - Creates styled tooltip elements with text, shortcut key, and dismiss button
   - Positions tooltips above target elements
   - Shows on hover/focus, hides on mouse leave/blur
   - Handles dismiss button to permanently hide tooltip

6. Added `dismissTooltip(selector)` method that:
   - Adds selector to dismissed set
   - Hides the tooltip with animation
   - Persists dismissals to localStorage

7. Added `saveTooltipDismissals()` and `loadTooltipDismissals()` for localStorage persistence

8. Modified `start()` to initialize tooltips after tutorial completes or for returning users

9. Modified `complete()` to call `initTooltips()` after tutorial finishes

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Notes

- Tooltips appear on hover over control strip buttons, watch mode buttons, and god mode tools
- Each tooltip has a small × button to dismiss it permanently
- Dismissals are saved to localStorage so returning users don't see tooltips again
- Tooltips are non-intrusive: small text boxes that appear above elements
- Tutorial system initializes tooltips after completing or skipping the tutorial

## Session Audit (2026-04-15, Session 12 - Season Visual Transitions)

### Focus

Add smooth seasonal transitions for tree colors, ground colors, and decorations.

### Changes

1. **renderer.js** — Added `_getSeasonalDecorationModifier(dec, world)` method:
   - Returns hueShift, saturationMult, lightnessMult, alphaMult, isBare properties
   - Spring: trees/saturation increase, flowers fade in
   - Summer: full saturation, flowers vibrant
   - Autumn: hue shifts toward orange (-30°), trees lose leaves (isBare at 70%+ phase), flowers fade out
   - Winter: desaturated (-35° hue shift), trees bare, flowers nearly invisible

2. **renderer.js** — Modified `_drawDecoration(dec, world)` to pass world to helpers

3. **renderer.js** — Modified `_drawDecorationFromSprite(dec, world)`:
   - Applies CSS filter with hue-rotate, saturate, brightness based on seasonal modifier
   - Adjusts globalAlpha for seasonal fading

4. **renderer.js** — Modified `_drawDecorationFallback(dec, world)`:
   - Added `applyHsl()` helper to apply seasonal modifiers to all colors
   - Trees become bare/brown in autumn/winter
   - Flowers/grass fade based on season

5. **renderer.js** — Added `_getSeasonalGroundTint(season, phase)`:
   - Returns RGB tint factors for each season
   - Applied to biome color rendering for subtle ground color shifts

6. **renderer.js** — Enhanced `_drawSeasonOverlay(world)`:
   - Now interpolates between current and next season colors based on seasonPhase
   - Creates smooth transitions as seasons progress

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Notes

- Transitions are gradual over the season (uses seasonPhase 0-1)
- Tree foliage fades in autumn, becomes bare in late autumn/winter
- Flowers fade out in autumn/winter
- Ground gets subtle warm tints in spring/summer, cool in winter
- Season overlay interpolates between adjacent season colors

## Session Audit (2026-04-15, Session 11 - Social Hierarchy Visuals)

### Focus

Make alpha creatures (lineage founders) visually distinct with crown or glow effect.

### Changes

1. **creature-render.js** — Added `isAlphaCreature()` helper function that determines if a creature is a lineage founder (has no parentId or is the root of their lineage)
2. **creature-render.js** — Added alpha visual effects for lineage founder creatures:
   - Golden crown icon above the creature (3-point crown shape with pulsing animation)
   - Golden aura glow around alpha creatures (radial gradient from creature outward)
   - Crown uses shadowBlur for golden glow effect
   - Subtle pulsing animation synced to worldTime

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

### Notes

- Alpha status determined by lineage root (founder of family line)
- Crown positioned above creature at y = -r - 5 (above the body)
- Aura extends to 2x creature radius with soft golden gradient
- Does not dominate screen - subtle effect that communicates status

## Session Audit (2026-04-15, Session 10 - Emotion Contagion Visualization)

### Focus

Add visual effects showing fear spreading to nearby creatures when one is scared.

### Changes

1. **renderer-creatures.js** — Added `world` to `renderOpts` to enable creature proximity queries for fear contagion effect
2. **creature-render.js** — Added emotion contagion visualization when creature fear > 0.7:
   - Fear wave ripple rings expanding outward from scared creature (3 concentric rings, purple-tinted)
   - Contagion radius scales with fear level (80-120px)
   - Nearby creatures show subtle fear tint influenced by distance and source fear level
   - Effect only visible at zoom > 0.4 to avoid clutter

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-15, Session 13 - Weather Intensity Feedback)

### Focus

Make weather intensity visible through particle density and screen effects.

### Changes

**particle-system.js:**

1. Enhanced `_addWeatherParticles()` to scale particle count (5 + 15\*intensity), speed, size, and opacity with intensity
2. Added `emitStormDebris()` method for storm wind debris particles
3. Added `addRainStreak()` method for screen-wide rain streak particles
4. Added `storm` and `debris` weather categories for different visual effects
5. Added `rainstreak` particle type with proper update and draw handling
6. Added `weather_storm` emit case that triggers debris at intensity > 0.4

**game-loop.js:**

1. Added `_weatherParticleTimer` and `_weatherParticleInterval` (0.25s) for throttled emission
2. Added `_emitWeatherParticles()` method that emits weather particles in camera viewport:
   - Rain/storm: emits `weather_rain` particles scaled by intensity (storm 1.3x)
   - Storm > 0.4: also emits debris particles
   - Snow: emits `weather_snow` particles
   - Wind: emits `weather_wind` particles
3. Called `_emitWeatherParticles(dt)` in `step()` after world update

**renderer.js:**

1. Enhanced `_drawWeatherEffects()` with intensity-scaled screen effects:
   - Storm darkening: `rgba(10,15,30,0.1-0.35)` overlay when intensity > 0.3
   - Heavy rain streaks: 20-80 animated vertical streaks when intensity > 0.5
   - Blizzard thickening: 30-70 snow overlay particles when intensity > 0.6
   - Blizzard fog: `rgba(200,210,230)` fog fill when intensity > 0.75
   - Aurora already scaled with intensity (no change needed)

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-15, Session 9 - Birth/Death Particle Effects)

### Focus

Add celebratory birth particles and enhanced somber death effects.

### Changes

**Birth Celebration Effects (`particle-system.js`):**

1. Increased main sparkle burst from 12 to 16 particles
2. Added 8 additional upward-floating sparkles for a celebratory burst
3. Added soft "puff" cloud ring (expandRate 40, low opacity) for dreamy birth effect
4. Improved ring expandRate from 80 to 90 for snappier feel
5. Brighter color saturation on sparkles (80% lightness vs 70%)

**Death Soul-Rising Effects (`particle-system.js`):**

1. Reduced dust particle count from 12 to 10, made colors more muted (darker tones)
2. Increased primary ghost size from 14 to 16, slower rise speed for more somber feel
3. Extended primary ghost life from 1.5s to 2.0s for longer-lasting ethereal presence
4. Added 3 secondary ghost wisps that drift sideways with varying sizes (8-12px)
5. Added somber fade ring that expands slowly and fades (30 expandRate, 40% opacity)
6. Better hue-based coloring for different diet types

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-15, Session 9b - Pack Hunting Visualization)

### Focus

Add visual effects when predators coordinate during pack hunts.

### Changes

1. **creature.js** — Added `isPackHunting: false` to personality object to track pack hunting state
2. **creature-behavior.js** — Modified `updatePackHunting()` to:
   - Reset `isPackHunting` flag at start of method
   - Set `isPackHunting = true` when pack members are actively coordinating
3. **creature-render.js** — Added pack hunting coordination visualization (visible at zoom > 0.5):
   - Dotted coordination lines connecting pack members (orange-red)
   - Pack aura glow centered between hunters (red-tinted radial gradient)
   - Chase prediction line showing intercept point with prey velocity prediction

### Verified

- `npm run lint` — 0 errors, 0 warnings
- `npm test` — 146 passed, 0 failed

## Session Audit (2026-04-15, Session 8 - Bug Fixes & Performance)

### Focus

Fix creature visibility at high zoom and improve rendering consistency across zoom levels.

### Changes

**Creature Rendering Fixes:**

1. **Increased creature size** (`creature-render.js:1089`) — Increased renderSize multiplier from 4 to 5 for better visibility at all zoom levels
2. **Fixed procedural rendering** (`creature-render.js:1096-1106`) — Procedural creatures now scale with creature size (procSize = r \* 1.2) instead of fixed small triangle
3. **Fixed LOD triangles** (`renderer-creatures.js:140-159`) — Medium LOD triangles now scale based on creature size instead of fixed 7px
4. **Fixed LOD dots** (`renderer-creatures.js:129-140`) — Ultra-low LOD dots now scale based on creature size (min 3px)
5. **Fixed explicit/fallback rendering** (`renderer-creatures.js:205-234`) — Fallback triangle rendering scales with creature size with improved contrast

**Food Rendering Enhancements:** 6. **Enhanced fallback food rendering** (`renderer.js:1606-1657`) — Added type-specific vibrant colors, subtle glow/aura with pulse animation based on worldTime, size modulation based on food radius 7. **Enhanced sprite-based food rendering** (`renderer.js:1259-1294`) — Added shadowBlur glow effects to all food types (not just golden_fruit) with type-specific colors and pulse animation

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

**Gameplay Improvements:** 5. **Flying/burrowing behaviors** (`creature.js`, `creature-behavior.js`, `genetics.js`) — Flying creatures seek high elevation with swooping motion; burrowing creatures prefer underground with fear reduction 6. **Mutation visual diversity** (`creature-render.js`) — Added effects for Gigantism (power aura + ripples), Dwarfism (cute aura + stars), Albinism (UV glow + damage sparks), Melanism (night vision aura), Longevity (golden aura + rings), Accelerated Aging (decay aura), Super Senses (radar sweep), Photosynthesis (energy glow), Chimera (multi-color swirl) 7. **Nocturnal advantages** (`creature-agent-needs.js`, `creature.js`, `world-combat.js`, `creature-render.js`) — Nocturnal creatures gain 25% speed, 30% vision, 20% hunting bonus at night; diurnal creatures get 15% night penalty; enhanced nocturnal glow

**Performance Improvements:** 8. **Culling optimization** (`game-loop.js`) — Verified spatial grid culling already implemented; enhanced debug overlay with culling effectiveness metrics 9. **Particle pooling** (`object-pool.js`, `particle-system.js`) — Particle pool size increased to 2000; all particle creation uses pooled objects; fixed particle leak bug where dead particles weren't returned to pool

**Other Improvements:** 10. **Sprite caching** (`asset-loader.js`, `creature-render.js`) — Multi-zoom sprite caching at 5 levels (32, 48, 64, 96, 128px); nearest zoom level selected to minimize scaling 11. **Save system compression** (`save-system.js`, `main.js`) — gzip compression using browser's `CompressionStream` API; backward compatible with `C2:` prefix marker 12. **Tutorial system** (`event-system.js`, `ui-controller-spawn.js`, `tutorial-system.js`) — Added spawn step to tutorial; spawn tracking via events; persistent progress in localStorage

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
- Wrapped debug window.\* globals behind devtools flag in main.js (lines 1442+)
- Removed ECS no-op from game-loop.js per-frame call
- Removed cache-busting ?v= from index.html (Vite handles this)
- Upgraded ESLint config: no-console warn (allow debug/warn/error/info), varsIgnorePattern for \_ prefix, debug-console.js override

### File Splits (prototype-assignment pattern, zero API changes)

**Creature split (creature.js: 3377→2266):**

- creature-genetics-helpers.js (60 lines): NAME_SUGGESTIONS, determineSenseType, resolveDietRole, calculateAttractiveness, pickDesiredTraits
- creature-age.js (94 lines): updateAgeStage, updateLifeStage, getAgeSizeMultiplier, getAgeSpeedMultiplier, getAgeMetabolismMultiplier, getElderFadeAlpha, getAgeStageIcon
- creature-render.js (436 lines): getBadges, drawCreature, getCachedSpriteFrame, updateCachedCanvas, drawBehaviorState, drawTraits
- creature-agent-needs.js (~500 lines): updateAgentState, updateAgentSenses, updateNeeds, selectGoal, updateSteeringForces, isMateCompatible, applyRestRecovery, updateRestHome, updateMatingBond, applyHungerRelief, getHomeBias

**Renderer split (renderer.js: 2681→1377):**

- renderer-features-viz.js (454 lines): 13 feature visualization methods (nests, territories, memory, bonds, migration, emotions, etc.)
- renderer-minimap.js (311 lines): drawMiniMap, \_drawBiomeLabels, \_getDisasterTint
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

| Layer       | Key Files                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Entry       | `index.html`, `main.js`                                                                                                         |
| World       | `world-core.js` + `world-environment.js`, `world-ecosystem.js`, `creature-manager.js`, `combat-system.js`, `disaster-system.js` |
| Creature    | `creature.js`, `genetics.js`, `behavior.js`                                                                                     |
| Render      | `renderer.js`, `renderer-config.js`, `renderer-features.js`, `renderer-performance.js`                                          |
| Loop        | `game-loop.js`, `game-state.js`                                                                                                 |
| Persistence | `save-system.js`, `config-manager.js`                                                                                           |
| UI          | `ui-controller.js`, `ui.js`, `dom-cache.js`                                                                                     |
