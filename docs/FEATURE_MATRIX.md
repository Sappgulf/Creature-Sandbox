# Feature Matrix

Status legend: Y = present/wired; N = missing or not wired. Mobile/Save/Load marked Y when code path exists; device verification pending.

| System | Exists | Wired into UI | Works on Mobile | Save/Load Supported | Known Issues |
| --- | --- | --- | --- | --- | --- |
| Creature creation/editing (gene editor + presets) | Y | Y | Y | Y | Gene editor settings not persisted; needs device validation. |
| Creature selection + spawn (mobile) | Y | Y | Y | Y | Spawn dropdown is desktop; mobile has quick spawn only. |
| Sandbox interactions / physics | Y | Y | Y | Y | Touch camera + tap selection need device validation. |
| Health/damage/death/knockout + starting health tuning | Y | Y | Y | Y | Needs verification: damage debounce and starting maxHealth. |
| Needs/behavior (hunger/energy/stress/social) | Y | Y | Y | Y | Needs verification for throttling/hysteresis. |
| Memory/learning | Y | N | Y | N | Memory not serialized; UI only via render overlay. |
| Life stages (baby/adult/elder) + reproduction/offspring + population guardrails | Y | N | Y | Y | Guardrails exist in config/auto-balance; need runtime verification. |
| Day/night + resource regrowth | Y | N | Y | Y | Day/night visuals depend on renderer settings. |
| Watch Mode controls | N | N | N | N | No explicit watch mode system found. |
| Auto-camera director | N | N | N | N | No director system found. |
| Moments log + session summary | N | N | N | N | No UI or storage found; activity feed appears unused. |
| God mode + tools | Y | Y | Y | Y | Needs mobile tap target + focus verification. |
| Nests/territory/migration | Y | N | Y | Y | Migration exists; territory/nest systems not implemented. |
| UI navigation/condensed menus | Y | Y | Y | N | UI panels exist; no persisted UI state. |
| Help/hints lifecycle | Y | Y | Y | N | Tutorial overlay lifecycle needs verification; no persistent dismissal on save. |
| Save/load schema versioning + migrations | Y | N | N | Y | Version migrations present; needs regression validation. |
| Performance guardrails (throttling, spatial partitioning) | Y | N | Y | N | Throttling/spatial grids exist; needs perf validation. |
