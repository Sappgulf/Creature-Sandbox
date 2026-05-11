# Feature Matrix

Status legend: Y = present/wired; N = missing or not wired. Mobile/Save/Load marked Y when code path exists; device verification pending.

| System | Exists | Wired into UI | Works on Mobile | Save/Load Supported | Known Issues |
| --- | --- | --- | --- | --- | --- |
| Playable scenarios + Director | Y | Y | Y | Y | Active scenario id, elapsed time, progress, director snapshot, and completion progress are included in runtime save metadata. |
| Creature creation/editing (gene editor + presets) | Y | Y | Y | Y | Gene editor settings are not persisted as UI preferences. |
| Creature selection + spawn (mobile) | Y | Y | Y | Y | Browser smoke covers compact/large mobile spawn; physical-device feel still worth checking. |
| Sandbox interactions / physics | Y | Y | Y | Y | Browser smoke covers tap/select/food; extended drag/throw remains a manual feel check. |
| Health/damage/death/knockout + starting health tuning | Y | Y | Y | Y | Needs verification: damage debounce and starting maxHealth. |
| Needs/behavior (hunger/energy/stress/social) | Y | Y | Y | Y | Needs verification for throttling/hysteresis. |
| Memory/learning | Y | Y | Y | Y | Selected-creature panel and Inspector Memory tab explain current drive plus strongest remembered places. |
| Life stages (baby/adult/elder) + reproduction/offspring + population guardrails | Y | Y | Y | Y | Life stage is visible in selected cards, smoke text, and in-world selected/status cues. |
| Day/night + resource regrowth | Y | N | Y | Y | Day/night visuals depend on renderer settings. |
| Watch Mode controls | Y | Y | Y | Partial | Browser smoke verifies toggle, follow modes, watch screenshots, and watch/god UI state in runtime metadata. |
| Auto-camera director | Y | Y | Y | N | Re-center/follow controls exist; long-session prioritization still needs tuning. |
| Moments log + session summary | Y | Y | Y | Y | Moments and summary serialize/restore; browser smoke opens the panel and checks summary state. |
| God mode + tools | Y | Y | Y | Y | Tool hints, pressed states, brush previews, and food/calm/chaos/prop/remove smoke coverage are in place. |
| Nests/territory/migration | Y | Y | Y | Y | Migration/nest state serializes and is surfaced through moments, objective/story copy, and relevant scenario presets. |
| UI navigation/condensed menus | Y | Y | Y | Partial | Mobile preferences and last spawn type persist; save previews include key run state for Continue/slots. |
| Help/hints lifecycle | Y | Y | Y | N | Tooltip dismissal persists locally but is not part of save files. |
| Upgrade Hub: recipes, action cards, readability, discovery, seed gallery, postcards | Y | Y | Y | Y | Browser smoke exercises recipe preset, readability mode, action card, nickname, postcard, seed/save metadata, and balance probe hooks. |
| Scenario medal/result summaries | Y | Y | Y | Y | Upgrade Hub shows survival, food stability, stress, and score/medal for active scenario runs. |
| Save/load schema versioning + migrations | Y | N | Y | Y | Regression covers zero values, older fixture, memory, props, food bites, active events, runtime metadata providers, upgrade metadata, and thumbnail previews. |
| Performance guardrails (throttling, spatial partitioning) | Y | Partial | Y | Partial | Browser smoke asserts live renderer rendered/culled counters, bounded sprite cache/population, and `npm run check:bundle` enforces post-build JS chunk budgets. |
| Simulation proxy attachment contract | Y | Y | Partial | N/A | Worker world now stores/exposes attached lineage, particles, heatmaps, audio, notifications, achievements, family bonds, and memory-learning systems; worker mode remains opt-in. |
