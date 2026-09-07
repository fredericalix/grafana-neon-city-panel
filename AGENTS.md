# AGENTS.md — Neon City Panel

Guidance for AI coding agents working in this repository. The reader is assumed to know nothing about the project.

## Project overview

**Neon City Panel** (`whooktown-neoncity-panel`, version 1.1.1) is a **Grafana panel plugin** that renders a cyberpunk 3D city with Three.js, where each building represents a monitored service. Building appearance — color, glow, animation speed — reacts in real time to status and metric data from Grafana queries.

Features: 11 building types, 3 custom GLSL shaders (PyramidBeam, Hologram, MonitorTube), animated road traffic (Tron-style light cycles and data packets), hover tooltips and click-to-open detail popups, floating labels, and a drag-and-drop visual layout editor built into the panel options.

- Plugin ID: `whooktown-neoncity-panel`, plugin type: `panel` (both in `src/plugin.json`)
- Grafana requirement: >= 13.1.4 (`grafanaDependency` in `src/plugin.json`)
- License: Apache-2.0
- Repository: https://github.com/fredericalix/grafana-neon-city-panel

## Grafana plugin rules (critical)

This repository was scaffolded with `@grafana/create-plugin`. Read `.config/AGENTS/instructions.md` before making changes. Key rules from it:

- **Do not modify anything inside `.config/`** — it is managed by Grafana plugin tools. Build, lint, Jest, Prettier, and TypeScript configs at the repo root all delegate to `.config/`.
- **Do not change the plugin ID or plugin type** in `src/plugin.json`.
- Any modification to `src/plugin.json` requires a **restart of the Grafana server** — remind the user of this.
- Use webpack (config in `.config/webpack/`) for frontend builds; do not substitute another bundler.
- To extend webpack/prettier/eslint config, use the `.config/` files as a base (see https://grafana.com/developers/plugin-tools/how-to-guides/extend-configurations.md).
- Use `@grafana/plugin-e2e` for end-to-end testing.
- Your training data about the Grafana plugin API is likely outdated — fetch current docs from grafana.com. The documentation index is at https://grafana.com/developers/plugin-tools/llms.txt; any page is available as plain text by appending `.md` to the URL path.

A detailed project-specific reference lives in `docs/grafana-plugin-guide.md` (PanelPlugin API, PanelProps, data frames, plugin.json schema, build/sign/publish, testing, troubleshooting).

## Technology stack

- **Language**: TypeScript 5.9 (strict, via `@grafana/tsconfig`); Node >= 22 (`.nvmrc`), npm 11 as package manager
- **UI**: React 18 + `@grafana/ui`, `@grafana/data`, `@grafana/runtime` v13 (these are webpack externals, provided by the Grafana host at runtime)
- **3D**: Three.js 0.184 (`@types/three` for typings)
- **Build**: webpack 5 + swc-loader, config in `.config/webpack/webpack.config.ts` (do not edit)
- **Unit tests**: Jest 29 + @swc/jest + Testing Library (jsdom); Three.js is mocked via `src/__mocks__/three.ts`
- **E2E tests**: Playwright + `@grafana/plugin-e2e`
- **Lint/format**: ESLint 9 (`@grafana/eslint-config` via `eslint.config.mjs`) + Prettier (printWidth 120, single quotes, semicolons, trailing commas es5, 2-space indent)

## Build and test commands

```bash
npm install            # install dependencies (npm ci in CI)
npm run dev            # webpack watch mode with livereload → dist/
npm run build          # production build → dist/
npm run server         # docker compose up --build: Grafana 13.1.4 with the plugin mounted
npm run test           # Jest watch mode (--onlyChanged)
npm run test:ci        # Jest CI mode (--passWithNoTests --maxWorkers 4)
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint (cached)
npm run lint:fix       # ESLint --fix + Prettier --write
npm run e2e            # Playwright E2E (needs Grafana running, e.g. via npm run server)
npm run sign           # sign the plugin with @grafana/sign-plugin (needs access policy token)
```

The standard local loop is: `npm run dev` in one terminal, `npm run server` in another, then open http://localhost:3000 (admin/admin). Provisioned dashboards and datasources in `provisioning/` are loaded automatically.

## Code organization

### Data flow

```
Grafana query (table data)
  → src/components/CityPanel.tsx (React component, lifecycle hooks)
    → src/data/dataMapper.ts (table rows → BuildingState[])
      → src/engine/CityEngine.ts (Three.js scene manager)
        → Prefab instances (one per building, each a Three.js Group)
```

### Key source paths

| Path                                   | Role                                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/module.tsx`                       | Plugin entry — registers `CityPanel` wrapped in `ErrorBoundary`, defines panel options and the migration handler (normalizes options saved by older plugin versions)                                             |
| `src/plugin.json`                      | Plugin metadata. `%VERSION%` / `%TODAY%` placeholders are replaced at build time                                                                                                                                 |
| `src/types.ts`                         | All shared types: `Building`, `BuildingState`, `BuildingType`, `CityLayout`, `CityOptions`, `DEFAULT_OPTIONS`. `IMPLEMENTED_BUILDING_TYPES` is the single source of truth for the editor palette                 |
| `src/components/CityPanel.tsx`         | React↔engine bridge: initializes the engine, syncs layout, maps data, handles resize                                                                                                                             |
| `src/components/ErrorBoundary.tsx`     | Catches Three.js crashes, shows a Grafana `Alert` fallback                                                                                                                                                       |
| `src/components/DiagnosticOverlay.tsx` | Surfaces common data-mapping issues for onboarding                                                                                                                                                               |
| `src/components/editors/`              | Visual layout editor: `LayoutEditor`, `LayoutGrid`, `BuildingPalette`, `BuildingProperties`, `useLayoutEditor`                                                                                                   |
| `src/data/dataMapper.ts`               | Maps Grafana `PanelData` → `BuildingState[]`; field lookup matches `config.displayName`/`state.displayName` so columns renamed via Grafana transformations are recognized                                        |
| `src/data/diagnostics.ts`              | Data-mapping diagnostics used by the overlay                                                                                                                                                                     |
| `src/engine/CityEngine.ts`             | Three.js scene, renderer, camera, OrbitControls, lights, animation loop, prefab lifecycle; renders only while the panel is visible (page + viewport)                                                             |
| `src/engine/InteractionManager.ts`     | Raycasting hover/select, tooltip and detail popup triggers                                                                                                                                                       |
| `src/engine/RoadNetwork.ts`            | Road grid mesh generated from the binary road layout strings in `CityLayout.roads`                                                                                                                               |
| `src/engine/traffic/`                  | `TrafficManager`, `LightCycle`, `VehicleBase`, `PathGenerator`, `TrailSystem`, `DataPacket`, `TrafficConfig`                                                                                                     |
| `src/prefabs/BasePrefab.ts`            | Abstract base class: group, status/activity/data updates, pulse animation, dispose                                                                                                                               |
| `src/prefabs/index.ts`                 | `createPrefab()` factory — registers all building types                                                                                                                                                          |
| `src/prefabs/materials.ts`             | `COLORS` palette, material factories, status→color mapping                                                                                                                                                       |
| `src/prefabs/*.ts`                     | Concrete prefabs: Windmill, TowerA, TowerB, Pyramid, DisplayA, DisplayAGiant, Bank, MonitorTube, MonitorTubeGiant, LedFacade, FarmSilo                                                                           |
| `src/prefabs/shaders/`                 | Custom GLSL ShaderMaterials: `PyramidBeamShader`, `HologramShader`, `MonitorTubeShader`                                                                                                                          |
| `src/ui/`                              | `TooltipManager`, `LabelManager`, `PopupLineManager`, `styles.ts`                                                                                                                                                |
| `tests/panel.spec.ts`                  | Playwright E2E test                                                                                                                                                                                              |
| `provisioning/`                        | Dashboards and datasources auto-provisioned into the dev/demo Grafana                                                                                                                                            |
| `demo/`                                | Self-contained docker-compose demo stack ("Neon Noodle Bar"): HA web app behind Traefik + PostgreSQL, monitored by Prometheus + Grafana, every container rendered as a building                                  |
| `archive/threejs-scene/`               | Original standalone Three.js app the prefabs were ported from; contains 12 more building types and effects (fireworks) not yet ported. See `archive/threejs-scene/assets_3d_list.md` for specs of all 23 prefabs |
| `dist/`                                | Build output — do not edit; regenerated by `npm run build`                                                                                                                                                       |

### Status & activity model

- **Status** (`online | offline | warning | critical`) controls color, glow intensity, and pulse speed. It is resolved from data either by text matching ("online"/"up"/"ok" → online, etc.) or by numeric thresholds (`options.thresholds`, which must satisfy `online >= warning >= critical`; violations produce a console warning, deduped by threshold key).
- **Activity** (`slow | normal | fast`) controls animation speed (rotation, particles, scrolling).

### Adding a new building type

1. Create `src/prefabs/NewPrefab.ts` extending `BasePrefab`; implement `build()`, `onStatusChange()`, `onActivityChange()`, and optionally `updateData(state)`.
2. Add the type to the `BuildingType` union in `src/types.ts`.
3. Register it in the `createPrefab()` switch in `src/prefabs/index.ts`.
4. Add it to `IMPLEMENTED_BUILDING_TYPES` in `src/types.ts` so the layout editor palette picks it up.

Prefabs receive the full `BuildingState` via `updateData(state)` called from `CityEngine.updateStates()`; each prefab extracts only the fields it consumes (e.g. DisplayA consumes `text1..text3` and `ringCount`, Bank consumes `bankQuantity`/`bankAmount`, FarmSilo consumes `siloFillLevel`, MonitorTube consumes `monitorBands`).

## Development conventions

- Match the existing code style: TypeScript with explicit types, single quotes, semicolons, 120-char lines (enforced by Prettier/ESLint — run `npm run lint:fix` before committing).
- Keep comments minimal and explanatory; the codebase uses JSDoc on public classes/functions and section-banner comments in large files like `src/types.ts`.
- **Resource disposal matters**: every Three.js object (geometries, materials, textures, `CanvasTexture`s, render targets) must be disposed in `dispose()` — the panel lives inside long-running Grafana sessions and GPU memory leaks accumulate (see CHANGELOG 1.1.1).
- Avoid `innerHTML` — use DOM APIs (`TooltipManager` was hardened this way).
- Prefer warnings over silent failure for configuration problems (duplicate building names, unknown `BuildingType`, misordered thresholds all `console.warn` with the `[neon-city-panel]` prefix).
- Keep `CHANGELOG.md` up to date under an `## Unreleased` heading when making user-visible changes.

## Testing instructions

- **Unit tests** (Jest) live next to the code as `*.test.ts`: `src/data/` (dataMapper, diagnostics), `src/engine/` (CityEngine, RoadNetwork), `src/engine/traffic/` (TrafficManager, PathGenerator, TrafficConfig, DataPacket), `src/prefabs/` (BasePrefab, index, materials, neonPalette), `src/ui/` (TooltipManager + LabelManager XSS contract). Three.js is mocked (`src/__mocks__/three.ts`, plus `src/__mocks__/three/examples/jsm/controls/OrbitControls.js.ts` for OrbitControls) so engine/render code can be tested in jsdom without WebGL. The mock's `clone()` returns new instances with their own `dispose` spies — keep it that way or dispose tests go blind. Timezone is pinned to UTC in `jest.config.js`.
- **E2E tests** (Playwright, `@grafana/plugin-e2e`) live in `tests/`. They need a running Grafana with the plugin (`npm run server`) and run in headless Chromium without WebGL — keep E2E assertions free of actual 3D rendering. The dev Grafana auto-loads provisioned dashboards from `provisioning/dashboards/`.
- CI runs `typecheck` → `lint` → `test:ci` → `build`, then packages and validates the plugin zip, then runs the Playwright suite against a matrix of Grafana versions.

## CI/CD and release

- **CI** (`.github/workflows/ci.yml`): on push/PR to `main`/`master` — typecheck, lint, unit tests, build, plugin packaging and validation (`grafana/plugin-validator-cli`), optional signing (if `GRAFANA_ACCESS_POLICY_TOKEN` secret is set), and Playwright E2E against resolved Grafana versions. Backend steps (Go/mage) are conditional on a `Magefile.go` existing — this plugin is frontend-only.
- **Release** (`.github/workflows/release.yml`): pushing a `v*` tag builds and publishes the plugin via `grafana/plugin-actions/build-plugin`. Version is taken from `package.json`.
- Versioning is manual: bump `version` in `package.json` and update `CHANGELOG.md`, then tag `vX.Y.Z`.

## Security considerations

- The plugin is unsigned for local installs; users must allow it via `allow_loading_unsigned_plugins = whooktown-neoncity-panel`. Signing uses `npm run sign` with a Grafana access policy token (never commit tokens).
- Never log or expose credentials; this plugin has no backend and no `secureJsonData` — if credentials are ever needed, use `secureJsonData` (not `jsonData`) per Grafana rules.
- Do not use `innerHTML` with data-derived strings; build DOM nodes instead to avoid XSS from query results rendered in tooltips/popups.
- `node_modules`, `dist/`, and Playwright artifacts are git-ignored and excluded from ESLint; don't commit build output.
