# Feature Matrix

Status legend: Y = present/wired; N = missing or not wired. Mobile/Save/Load marked Y when code path exists; device verification pending.

| System | Exists | Wired into UI | Works on Mobile | Save/Load Supported | Known Issues |
| --- | --- | --- | --- | --- | --- |
| Playable scenarios + Director | Y | Y | Y | Partial | Scenario completion progress persists locally; active run state is not yet part of save files. |
| Creature creation/editing (gene editor + presets) | Y | Y | Y | Y | Gene editor settings are not persisted as UI preferences. |
| Creature selection + spawn (mobile) | Y | Y | Y | Y | Browser smoke covers compact/large mobile spawn; physical-device feel still worth checking. |
| Sandbox interactions / physics | Y | Y | Y | Y | Browser smoke covers tap/select/food; extended drag/throw remains a manual feel check. |
| Health/damage/death/knockout + starting health tuning | Y | Y | Y | Y | Needs verification: damage debounce and starting maxHealth. |
| Needs/behavior (hunger/energy/stress/social) | Y | Y | Y | Y | Needs verification for throttling/hysteresis. |
| Memory/learning | Y | Partial | Y | Y | Serialized and exposed in selected-creature smoke state; still needs richer player-facing UI. |
| Life stages (baby/adult/elder) + reproduction/offspring + population guardrails | Y | N | Y | Y | Guardrails exist in config/auto-balance; need runtime verification. |
| Day/night + resource regrowth | Y | N | Y | Y | Day/night visuals depend on renderer settings. |
| Watch Mode controls | Y | Y | Y | N | Browser smoke verifies toggle and watch-strip controls. |
| Auto-camera director | Y | Y | Y | N | Re-center/follow controls exist; long-session prioritization still needs tuning. |
| Moments log + session summary | Y | Y | Y | N | Moments panel exists; coverage should grow around event priority and summary accuracy. |
| God mode + tools | Y | Y | Y | Y | Browser smoke verifies watch-strip god toggle; tool-by-tool previews remain a polish target. |
| Nests/territory/migration | Y | Partial | Y | Y | Migration and nests serialize; richer UI surfacing remains open. |
| UI navigation/condensed menus | Y | Y | Y | Partial | Mobile preferences and last spawn type persist; broader panel state is not fully persisted. |
| Help/hints lifecycle | Y | Y | Y | N | Tooltip dismissal persists locally but is not part of save files. |
| Save/load schema versioning + migrations | Y | N | Y | Y | Regression covers zero values, older fixture, memory, props, food bites, and active events. |
| Performance guardrails (throttling, spatial partitioning) | Y | Partial | Y | N | Browser smoke records perf budget; no hard FPS threshold yet. |
