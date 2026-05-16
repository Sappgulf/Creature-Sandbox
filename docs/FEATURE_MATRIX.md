# Feature Matrix

Status legend: Y = present/wired; N = missing or not wired. Mobile/Save/Load marked Y when code path exists; physical-device feel verification is called out separately when automated browser coverage is not enough.

| System | Exists | Wired into UI | Works on Mobile | Save/Load Supported | Known Issues |
| --- | --- | --- | --- | --- | --- |
| Playable scenarios + Director | Y | Y | Y | Y | Active scenario id, elapsed time, progress, director snapshot, and completion progress are included in runtime save metadata. |
| Creature creation/editing (gene editor + presets) | Y | Y | Y | Y | Gene editor settings are not persisted as UI preferences. |
| Creature selection + spawn (mobile) | Y | Y | Y | Y | Browser smoke covers compact/large mobile spawn; physical-device tap comfort and safe-area feel still need manual device checks. |
| Sandbox interactions / physics | Y | Y | Y | Y | Browser smoke covers tap/select/food; extended drag/throw and prop impact feel remain manual physical-device checks. |
| Health/damage/death/knockout + starting health tuning | Y | Y | Y | Y | Needs verification: damage debounce and starting maxHealth. |
| Needs/behavior (hunger/energy/stress/social) | Y | Y | Y | Y | Needs verification for throttling/hysteresis. |
| Memory/learning | Y | Y | Y | Y | Selected-creature panel and Inspector Memory tab explain current drive plus strongest remembered places. |
| Life stages (baby/adult/elder) + reproduction/offspring + population guardrails | Y | Y | Y | Y | Life stage is visible in selected cards, smoke text, and in-world selected/status cues. |
| Day/night + resource regrowth | Y | N | Y | Y | Day/night visuals depend on renderer settings. |
| Watch Mode controls | Y | Y | Y | Partial | Browser smoke verifies toggle, follow modes, watch screenshots, and watch/god UI state in runtime metadata; long-session auto-director feel remains manual. |
| Auto-camera director | Y | Y | Y | N | Re-center/follow controls exist; event priority/cooldown tuning now favors dramatic moments during long sessions, but feel still needs physical-device watch checks. |
| Moments log + session summary | Y | Y | Y | Y | Moments and summary serialize/restore; browser smoke opens the panel and checks summary state. |
| God mode + tools | Y | Y | Y | Y | Tool hints, pressed states, brush previews, and food/calm/chaos/prop/remove smoke coverage are in place. |
| Nests/territory/migration | Y | Y | Y | Y | Migration/nest state serializes and is surfaced through moments, objective/story copy, and relevant scenario presets. |
| UI navigation/condensed menus | Y | Y | Y | Partial | Mobile preferences and last spawn type persist in browser-local profile storage; save previews include key run state for Continue/slots. |
| Help/hints lifecycle | Y | Y | Y | N | Tooltip dismissal persists locally but is not part of save files or cross-device sync. |
| Upgrade Hub: recipes, action cards, readability, discovery, seed gallery, postcards | Y | Y | Y | Y | Browser smoke exercises recipe preset, readability mode, action card, nickname, postcard, seed/save metadata, and balance probe hooks. |
| Scenario medal/result summaries | Y | Y | Y | Y | Upgrade Hub shows survival, food stability, stress, and score/medal for active scenario runs. |
| Save/load schema versioning + migrations | Y | N | Y | Y | Regression covers zero values, older fixture, memory, props, food bites, active events, runtime metadata providers, upgrade metadata, and thumbnail previews. Profile preferences remain browser-local and separate from save files. |
| Accessibility runtime summary | Y | Y | Y | N/A | `render_game_to_text` and `window.__creatureSmoke.accessibilitySummary()` expose a screen-reader-oriented world/run/selection summary; periodic live announcements can be enabled with `?a11ySummary` or `creature-sim-a11y-summary=true`. |
| Performance guardrails (throttling, spatial partitioning) | Y | Partial | Y | Partial | Deterministic browser smoke asserts renderer counters, bounded sprite cache/population; `npm run smoke:realtime` samples live animation-frame FPS/frame time; `npm run check:bundle` enforces post-build JS chunk budgets. |
| PWA/offline app shell | Y | Y | Y | N/A | Service worker caches the app shell/static assets, cleans old Creature Sandbox caches on activate, and is covered by `npm run smoke:realtime` offline reload. Saves remain local to the browser profile. |
| Simulation proxy attachment contract | Y | Y | Partial | N/A | Worker world now stores/exposes attached lineage, particles, heatmaps, audio, notifications, achievements, family bonds, and memory-learning systems; worker mode remains opt-in and must be tested with `?worker=1` before release promotion. |
