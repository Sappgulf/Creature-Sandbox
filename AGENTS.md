# AGENTS.md — Creature Sandbox

This document is the primary orientation for AI agents and human contributors working in this repository.

## Quick Start for Agents

1. **Always work from the repo root** (`/Users/austinbeatty/dev/Creature-Sandbox` after the 2026-05 workspace consolidation).
2. Read the existing [AGENT.md](./AGENT.md) first — it contains the non-negotiable rules of engagement (stability, measurable changes, required workflow, forbidden actions).
3. Before any commit that touches runtime, UI, or simulation behavior, you **must** run the local proof steps (see below).

## Project at a Glance

- Advanced real-time evolution sandbox in vanilla JS + Canvas (worker + main-thread fallback).
- ~56k LOC across 130+ focused modules.
- Strong emphasis on determinism, performance proof, and release evidence.
- Features: genetics, personality/quirks, family bonds, memory & learning, seasons, god powers, playable scenarios, Upgrade Hub, achievements, sandbox props, full save/load.
- Shipping default: Web Worker simulation. Explicit, well-tested main-thread fallback remains available.

Key directories:

- `creature-sim/src/` — all application source (many `creature-*.js`, `world-*.js`, `renderer*.js`, `ui-*.js` splits)
- `creature-sim/` — index.html, styles, assets, manifest, sw.js
- `scripts/` — smoke tests, proof runners, evidence board, balance soaks, bundle guard
- `docs/` — ROADMAP, KNOWN_ISSUES, RELEASE_CHECKLIST, FEATURE_MATRIX, BALANCE, etc. (archive/ contains older historical notes)
- `GOD/` — sophisticated agentic self-improvement harness (see GOD section below)
- `output/` — generated smoke artifacts, release evidence, screenshots (gitignored for large files)

## Release Discipline (Non-Negotiable)

This project has an unusually rigorous release process. **Never push to main without a clean local proof.**

### Minimum local gate before any push (run from repo root)

```bash
git status --short --branch
git diff --check
node --check scripts/browser-smoke.mjs
node --check scripts/scenario-balance-smoke.mjs
node --check scripts/production-vitals-smoke.mjs
node --check scripts/release-evidence-board.mjs
node --check vite.config.js
npm run lint
npm test
npm run build
npm run check:bundle
npm run smoke:browser
npm run smoke:main
npm run smoke:worker
npm run smoke:scenarios
npm run proof:release
npm run smoke:production:vitals   # optional but recommended
npm run evidence:release
```

See the full [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) and the GitHub Action `.github/workflows/release-smoke.yml`.

Artifacts that matter:

- `output/browser-smoke*/` (frame pacing, runtime-readiness.json, screenshots)
- `output/scenario-balance/`
- `output/release-evidence-board.json` + `.md`
- `output/release-summary.md`
- `output/production-vitals/`

The CI will also run the full matrix after push and wait for the Vercel production alias to serve the new SHA before running production smokes.

## GOD — Agentic Development Harness

The `GOD/` directory contains a meta-layer for autonomous, high-discipline agent work on this codebase (planning, patching, verification, reporting).

- Start with `GOD/GOD_BOOT.md` → `GOD/GOD/START.md` → `GOD/GOD/CORE.md`, `RUN.md`, etc.
- There are helper scripts in `GOD/scripts/`.
- GOD runs are expected to produce the same rigorous "Issues → Root Causes → Fixes → Verification" style used in CHANGELOG.md.
- When doing agent work, update CHANGELOG.md with both **Planned** and **Implemented** sections for the session.

Treat GOD as a first-class part of the project.

## Current Technical Direction (2026-05+)

- **Barrel exports**: Several `src/*/index.js` barrels exist (`core`, `game`, `input`, `render`, `ui`, `platform`). New code and refactors should import through them where practical. We are gradually migrating hot paths.
- **Worker is default**: `simulation-proxy.js` + `worker-simulation.js` are the primary runtime. Main-thread fallback must stay green.
- **Save schema**: Versioned migrations live in `save-migration.js`. Never break roundtrips without a migration.
- **Performance proof**: Every non-trivial perf change requires before/after numbers from the smoke lanes (especially `smoke:main` for fallback).
- **Changelog style**: Every significant session must follow the strict template in CHANGELOG.md (even for agent work).

## Useful Commands

```bash
npm run dev                 # Vite dev server (port 8000)
npm run build
npm run preview
npm test
npm run lint
npm run lint:fix
npm run format              # (added 2026-05) Prettier
npm run format:check

npm run smoke:browser
npm run smoke:main          # explicit main-thread fallback proof
npm run smoke:worker
npm run smoke:scenarios
npm run smoke:scenarios:variance
npm run smoke:production    # against live Vercel alias
npm run proof:release
npm run evidence:release
npm run check:bundle
npm run analyze             # visualizer
```

## What Good Agent Work Looks Like Here

- Small, focused diffs with clear invariants.
- Evidence (logs, smoke JSON, screenshots, metrics) attached to the change.
- Updated docs and CHANGELOG when behavior or process changes.
- Respect for the worker/main contract and save/load guarantees.
- No "it works on my machine" — if it touches runtime or rendering, it must survive the smoke matrix.

## After Workspace Moves or Major Refactors

- Update this file and any paths in docs/ that hardcode old locations.
- Re-run the full local proof before the next push.
- Consider whether GOD adapters/templates need refreshing.

---

**Enjoy evolving the creatures responsibly.** 🧬

When in doubt, re-read AGENT.md + this file, run the proof commands, and keep the evidence.
