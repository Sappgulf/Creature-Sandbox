# Creature Sandbox Reboot Blueprint

## North star

Creature Sandbox should feel like a living field journal: the player observes an ecosystem, makes one meaningful nudge, discovers an adaptation, and preserves the story as a seed worth revisiting.

The reboot is a product-layer overhaul, not an engine replacement. The worker-first simulation, deterministic fallback, versioned saves, manifest asset keys, and release proof lanes remain product invariants.

## First vertical slice: Field Guide

The first slice makes the current product easier to read before adding new systems:

- `Observe` — read the field and choose a creature, habitat, or scenario.
- `Influence` — make one small intervention such as painting food, spawning a balanced creature, or placing a calm zone.
- `Discover` — follow a family line, mutation, migration, or pressure event.
- `Preserve` — save a seed, postcard, or completed scenario for later.

The existing objective rail is the first expression of this loop. It is updated at the existing one-second upgrade-controller cadence, so the reboot does not add simulation work to the render hot path.

### Guided expedition tranche: Herd Rescue

The stable `first_ecosystem` scenario ID now presents as **Herd Rescue**. Its first run is a two-minute, stress-aware expedition with three explicit moves: inspect the herd, paint a food trail, and place a calm zone. The scenario snapshot carries those steps into Scenario Lab so the teaching surface and completion contract share one definition. Existing saves and smoke hooks continue to address the original ID.

## Verified audit priorities

The independent visual, gameplay, and runtime audits converged on three high-leverage issues:

1. **Worker visual identity gap:** the worker path loaded authored sprite sheets but routed proxy creatures through the triangle fallback in `renderer-creatures.js`. This was verified in code and in the live gameplay screenshot. The first asset slice now adds a shared worker/main creature-presentation bridge; the remaining art work is to deepen silhouette identity and cover the compact worker fields.
2. **Impossible scenario contract:** `mutation_showcase` asked for five variants while the current objective metric can count only aquatic, flying, and burrowing variants. This was a verified completion blocker; the scenario now targets all three roles and a definition validator guards future targets.
3. **Scale and proof headroom:** worker desktop evidence is healthy at about 22.5 ms average / 33.4 ms p95, but forced-worker non-draw work is about 1.558 ms against a 1.5 ms threshold, and the main gzip bundle has only about 201 bytes of recorded headroom. Snapshot allocation, culling scans, eager sprite-sheet loading, and optional UI boundaries are the next performance investigation targets.

Other verified product risks include prop-playground wording that does not match its completion predicate, lineage goals that use a global generation metric instead of a founder-rooted line, campaign secondary objectives that are data-only, and overlapping progression/achievement/goal sources of truth. These are roadmap work, not assumptions to silently change in the visual slice.

## Visual direction

The working direction is **Field Journal / Bioluminescent Wilderness**:

- deep forest and obsidian surfaces instead of generic blue glass;
- lime, aqua, and sun accents with semantic pressure colors;
- compact instrument panels with fewer pill-shaped layers;
- warm, concise naturalist language instead of dashboard labels;
- stronger creature and food contrast on the playfield, with the first sprite bridge now in place and further silhouette work staged next.

The current batch uses the existing scenario-card SVG strip and stable asset URLs. New sprites should be generated only after one approved seed frame establishes silhouette, palette, anchor, and animation rules.

## Upgrade roadmap

### Quick wins

- Finish the Field Guide HUD and align the empty inspector with one next action.
- Replace emoji-only controls with consistent icon geometry while preserving accessible labels.
- Fix the impossible variant target and add a validator for every scenario objective definition.
- Add a readable creature-focus mode with larger silhouettes and a bounded camera framing.
- Capture before/after desktop and narrow-mobile screenshots for the home page, first sandbox, menu, scenario start, and empty inspector.

### High-leverage rework

- Implement a shared worker/main creature-presentation bridge so normal gameplay shows recognizable authored silhouettes in both runtime modes.
- Reorganize the toolbox into three player verbs: Observe, Nudge, Remember.
- Turn the current scenario and session-goal systems into a short expedition flow with explicit setup, pressure, and preserve states.
- Make the playfield communicate habitat zones, family lines, and food pressure with a small number of stable visual cues.
- Make every displayed objective map to its exact completion predicate, including props, variants, generations, campaign secondary goals, and risk guidance.

### Longer-term visual, gameplay, and performance work

- Establish an approved sprite sheet pipeline with stable keys, normalized anchors, and whole-strip animation generation.
- Add authored biome sets and creature silhouettes that remain legible at the lowest supported viewport.
- Introduce intervention tradeoffs: every nudge should solve one pressure while creating an observable consequence.
- Unify Campaign, Scenario Director, Achievements, Challenge, Unlockable Achievements, Progression, and Upgrade Hub around one player-facing progression model.
- Add explicit God Power resources, unlocks, and consequences instead of exposing inert or unreachable tools.
- Instrument snapshot sequence/age, unpack time, allocations, query candidate counts, asset-cache pressure, draw counts, and quality transitions.
- Expand balance and browser lanes to cover every playable scenario at worker and main-thread parity.

## Asset policy

The repository already has a manifest-driven SVG pipeline with stable keys, frame dimensions, fps, anchors, tint support, and bounded zoom caches. Preserve keys such as `creature_*`, `food_*`, `prop_*`, `environment_*`, and `particle_*`.

For new art:

1. Approve one canonical seed frame per species, age, and movement family.
2. Generate a complete animation strip from that seed with fixed identity, palette, proportions, transparent background, and no baked text.
3. Normalize frames to the existing dimensions and shared bottom-center anchor.
4. Validate frame bounds, anchors, transparency, stable keys, and silhouette consistency.
5. Prove worker/main parity and cache behavior before adding the next asset family.

No new binary assets were added in the first slice.

## Evidence status

- Verified locally: repository architecture, existing scenario/objective systems, manifest-driven SVG assets, worker/main paths, and the current test/build/bundle baseline.
- Verified by independent audits: worker triangle fallback, impossible mutation target, prop/lineage/campaign contract gaps, snapshot/culling/asset scale risks, and stale production-proof limitations.
- Verified locally and in the in-app browser: Field Guide home/gameplay shell, worker sprite bridge, desktop/mobile responsive layout, keyboard pause semantics, Scenario Lab Run Now/End Active, and clean sampled console.
- Verified in release proof: local worker shipping-default, main-thread fallback, candidate worker, scenario balance, build, and bundle gates.
- Verified guided expedition: the save-compatible `first_ecosystem` ID presents as Herd Rescue with a 120-second stress-aware objective and three ordered Observe/Influence/Preserve steps in Scenario Lab.
- Unverified by design: final binary art packs, production vitals, 500+/1,000-creature soak, heap profile, full screen-reader audit, and any balance change. Those belong to later slices and require their own evidence.
- Production browser/Web Vitals artifacts remain stale/missing and point at an older deployment SHA; no production claim is made.
