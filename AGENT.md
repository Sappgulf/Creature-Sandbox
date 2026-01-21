# Creature Sandbox Agent Rules

## Mission
- Prefer additive improvements over rewrites.
- Preserve the core loop: load → create/edit → spawn → interact → save/load.
- Ship small, verifiable changes.

## Safety & Quality
- Avoid heavy per-frame allocations and work.
- If unsure about unused code, deprecate with comments instead of deleting.
- Do not introduce new dependencies unless necessary.
- Never commit secrets.

## Workflow Expectations
- Update `PLAN.md` every session.
- Update `README.md` and `CHANGELOG.md` when behavior changes.
- Provide explicit verification steps for every change.

## Verification
- Run existing scripts where possible (`npm test`, `npm run lint`).
- If a script cannot run, document the blocker and next action.
