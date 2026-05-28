# Release Checklist

Use this checklist for a local RC proof before pushing a release tag.

## Required Local Proof

Run these from the repo root:

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
npm run smoke:production:vitals
npm run evidence:release
```

The browser smoke lanes should leave current proof under:

- `output/browser-smoke/summary.json`
- `output/browser-smoke/target.json`
- `output/browser-smoke/runtime-readiness.json`
- `output/browser-smoke-main/summary.json`
- `output/browser-smoke-main/target.json`
- `output/browser-smoke-main/runtime-readiness.json`
- `output/browser-smoke-worker/summary.json`
- `output/browser-smoke-worker/target.json`
- `output/browser-smoke-worker/runtime-readiness.json`
- `output/scenario-balance/summary.json`
- `output/release-evidence-board.json`
- `output/release-evidence-board.md`
- `output/release-summary.md`
- `output/browser-smoke-production/runtime-readiness.json`
- `output/production-vitals/summary.json`
- `output/release-proof/summary.json`
- `output/vercel-deploy-proof/summary.json` (when `npm run proof:vercel` is run)
- `output/browser-smoke/desktop-upgrade-result.png`
- `output/browser-smoke-worker/desktop-watch.png`

Before tagging, inspect at least one desktop and one mobile screenshot from the default, main-fallback, forced-worker, production smoke, and production vitals folders. Confirm the canvas is nonblank, the objective rail is compact, the Upgrade Hub result/history surfaces are visible, and screenshots do not show stale or overlapping runtime copy. Confirm `output/browser-smoke/runtime-readiness.json` reports `shippingDefault: "worker"`, `status: "shipping-default"`, `defaultReadiness.safeToDefaultWorker: true`, and `completedScenarioResultFlow.passed: true`. Confirm the same readiness artifact includes `layoutGuardPassed: true`, startup CLS at or below `0.1` for worker/default lanes and `0.15` for explicit main fallback, and mobile touch targets at or above 40px. Confirm `output/browser-smoke-main/runtime-readiness.json` reports `status: "fallback-proof"`. Confirm `output/browser-smoke-production/runtime-readiness.json` reports `status: "shipping-default"` and finite frame metrics in the release evidence board. Confirm `output/production-vitals/summary.json` reports `passed: true`, at least desktop/mobile contexts, matching `/build-info.json` SHA, bounded FCP/CLS/long-task metrics, worker ready, and zero pending worker messages. Confirm `output/scenario-balance/summary.json` includes at least two runs of `stress_sanctuary` and `scavenger_bridge` with pass-rate `1` variance; use `npm run smoke:scenarios:variance` for the 5-run manual lane before a larger release. Confirm `output/release-summary.md` lists no missing or blocked proof before treating the build as release-ready. The release evidence board only counts production smoke and production vitals when their `/build-info.json` SHA matches the current `HEAD` and their gates pass.

## Manual Sanity

Open a local smoke URL after the automated gates:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Then check:

- `http://127.0.0.1:5173/?smoke=1`
- `http://127.0.0.1:5173/?smoke=1&worker=0`
- `http://127.0.0.1:5173/?smoke=1&worker=1`

Verify the Features panel exposes the Worker Runtime toggle, normal play defaults to worker mode, the main fallback URL reports main-thread mode as active, and the forced worker URL reports worker mode as active.

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

For Vercel proof, confirm the CLI is available before deploying:

```bash
vercel --version
vercel inspect https://creature-sandbox.vercel.app --timeout 20s
curl -I -L --max-time 20 https://creature-sandbox.vercel.app
curl -fsS https://creature-sandbox.vercel.app/build-info.json
npm run proof:vercel
npm run smoke:production
npm run smoke:production:vitals
npm run evidence:release
```

If a production deployment is bad, use the Vercel dashboard or `vercel rollback` to return the alias to the previous healthy deployment, then rerun `npm run proof:vercel`, `npm run smoke:production`, `npm run smoke:production:vitals`, and `npm run evidence:release`.
