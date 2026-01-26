# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
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
