# Creature Sandbox

A browser-based ecosystem sandbox where autonomous creatures forage, reproduce, inherit traits, and respond to a changing world.

**[Open Creature Sandbox](https://creature-sandbox.vercel.app)** · [Report an issue](https://github.com/Sappgulf/Creature-Sandbox/issues)

## Explore the ecosystem

Watch an evolving population, inspect an individual creature, or shape the world with food, props, and optional god-mode tools.

- Follow genetic traits, family relationships, life stages, and remembered locations.
- Explore predator-prey behavior, seasons, biomes, and population dynamics.
- Inspect population and trait trends through the analytics panels.
- Experiment freely or try campaign scenarios and session goals.
- Save and restore worlds, export snapshots, and share gene codes.

## Getting started

Open the hosted app and follow its first-run tutorial. Select a creature to inspect it, use the camera to explore, and open the More menu for additional panels and tools.

- **Space:** pause or resume.
- **Mouse wheel:** zoom.
- **Middle-click or Alt-drag:** pan; **arrow keys** move the camera and **R** recenters.
- **Drag a creature:** move or throw it.
- **X / F / S / E / P:** inspect, food, spawn, erase, or props.
- **?**: open shortcut help.
- **Ctrl/⌘ + S / O:** save to file or load from file.

On touch screens, use the quick-action controls and More menu. Reduced motion is available in the Features panel.

## Run locally

```sh
git clone https://github.com/Sappgulf/Creature-Sandbox.git
cd Creature-Sandbox
npm install
npm run dev
```

Open the URL printed by Vite, normally **http://localhost:8000**. Use the repository's Node version configuration for development.

## Development checks

```sh
npm test
npm run lint
npm run build
npm run preview
```

Browser and scenario checks are separate:

```sh
npm run smoke:browser
npm run smoke:main
npm run smoke:scenarios
```

These commands describe the available checks; results depend on the revision and environment. See the [release checklist](docs/RELEASE_CHECKLIST.md) before publishing a build.

## Architecture

The application uses JavaScript ES modules, Canvas 2D, and Vite.

- `creature-sim/src/world-*.js`: world state, environment, ecosystem, and simulation systems.
- `creature-sim/src/creature*.js`: creature behavior, traits, needs, and presentation.
- `creature-sim/src/renderer*.js`: drawing and camera-related presentation.
- `creature-sim/src/ui-controller*.js`: panels, controls, and interaction flows.
- `creature-sim/src/save-*.js`: save handling and migration.
- `scripts/`: tests, browser checks, and release tooling.

The simulation uses spatial grids, cached lineage data, and a worker runtime with a main-thread fallback. Rendering performance varies with the device, population, and enabled features.

## Contributing

For a bug report, include your browser, device, reproduction steps, and whether the issue occurs in a fresh world or a saved one. Avoid attaching saves that contain information you do not want made public.

## Detailed reference

See the [project guide](PROJECT_GUIDE.md) for mechanics, tools, customization, and module structure, and the [changelog](CHANGELOG.md) for project history.
