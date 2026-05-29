# GOD — Agentic Development Harness for Creature Sandbox

GOD is the project's built-in high-discipline agent workflow system. It enforces the same rigorous "Issues → Root Causes → Fixes → Verification" standard used in the main CHANGELOG and release process.

## Quick Start

```bash
# 1. Read the entry points
cat GOD/GOD_BOOT.md
cat GOD/GOD/START.md

# 2. Load the core mental model
cat GOD/GOD/CORE.md
cat GOD/GOD/RUN.md
cat GOD/GOD/CHECKS.md
cat GOD/GOD/OUTPUT.md
```

Then follow the Intake → Plan → Patch → Verify → Report loop described in START.md.

## Key Concepts

- **Everything is evidenced.** No change lands without smoke proof, tests, or explicit verification notes.
- **Changelog discipline is mandatory** for any GOD session that touches behavior, performance, or process.
- **The harness is self-hosting.** GOD scripts and templates live in this folder and can be improved by GOD runs themselves.

## Important Files

- `GOD_BOOT.md` — first thing every agent session should read
- `GOD/GOD/START.md` + `CORE.md` + `RUN.md` — the actual workflow
- `GOD/GOD/adapters/` — templates for different agent "personalities" and frameworks
- `scripts/` — shell helpers for gating, reporting, and CI shadow work
- `GOD/GOD/MEMORY.md` — persistent context across runs
- `GOD/GOD/CHANGELOG.md` — history of GOD improvements

## Running a GOD Session (Typical Flow)

1. Human (or previous agent) writes a clear task into a scratch file or issue.
2. Agent boots using the GOD templates + project AGENTS.md + AGENT.md.
3. Agent produces a plan, then patches, then runs the full local proof (`npm run proof:release` etc.).
4. Agent writes a structured report + updates CHANGELOG.md with Planned + Implemented sections.
5. Human reviews evidence artifacts in `output/`.

## Contributing to GOD Itself

Improvements to the harness (better scripts, clearer docs, new adapters) are encouraged and should follow the same evidence-based process.

See also the top-level [AGENTS.md](../AGENTS.md) and [AGENT.md](../AGENT.md) for project-wide rules that GOD sessions must obey.

---

**GOD exists so the Creature Sandbox can keep evolving at high quality even when humans are offline.** Use it responsibly.
