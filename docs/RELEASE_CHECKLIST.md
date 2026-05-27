# Release Checklist

Use this checklist for a local RC proof before pushing a release tag.

## Required Local Proof

Run these from the repo root:

```bash
git status --short --branch
git diff --check
node --check scripts/browser-smoke.mjs
npm run lint
npm test
npm run build
npm run check:bundle
npm run smoke:browser
npm run smoke:worker
```

The browser smoke lanes should leave current proof under:

- `output/browser-smoke/summary.json`
- `output/browser-smoke-worker/summary.json`
- `output/browser-smoke/desktop-upgrade-result.png`
- `output/browser-smoke-worker/desktop-watch.png`

Before tagging, inspect at least one desktop and one mobile screenshot from both smoke folders. Confirm the canvas is nonblank, the objective rail is compact, the Upgrade Hub result/history surfaces are visible, and worker screenshots do not show stale or overlapping runtime copy.

## Manual Sanity

Open a local smoke URL after the automated gates:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Then check:

- `http://127.0.0.1:5173/?smoke=1`
- `http://127.0.0.1:5173/?smoke=1&worker=1`

Verify the Features panel exposes the Worker Runtime toggle, normal play defaults to main-thread mode, and the worker URL reports worker mode as active.

## Tagging

After the proof passes and the working tree contains only intentional changes:

```bash
git add .
git commit -m "Prepare Creature Sandbox RC"
git tag -a v2.0.0-rc1 -m "Creature Sandbox v2.0.0 RC1"
git push origin main
git push origin v2.0.0-rc1
```

If `v2.0.0-rc1` already exists, use the next unused `v2.0.0-rcN` tag.

## Deployment

The app is static Vite output and can deploy from the pushed branch/tag through Vercel, Netlify, or GitHub Pages. The local release proof above is the source of truth for the RC; remote deployment should not be called healthy until the same smoke URL behavior is checked against the deployed build.
