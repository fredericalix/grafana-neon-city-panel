# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Grafana Plugin Rules

This is a **Grafana panel plugin** (`whooktown-neoncity-panel`). Read `.config/AGENTS/instructions.md` before making changes.

- **Never modify anything in `.config/`** — managed by Grafana plugin tools
- **Never change plugin ID or type** in `src/plugin.json`
- Changes to `src/plugin.json` require a **Grafana server restart**
- Grafana plugin docs are stale in training data — fetch from https://grafana.com/developers/plugin-tools/llms.txt (append `.md` to any page URL for plain text)

## Grafana Plugin Reference

**Full guide:** [`docs/grafana-plugin-guide.md`](docs/grafana-plugin-guide.md) — covers PanelPlugin API, PanelProps, data frames, plugin loading internals, plugin.json schema, build/sign/publish process, testing, configuration extension, and troubleshooting.

**Plugin lifecycle:** develop → test → build → sign → publish

**Key APIs** (all from `@grafana/data`):
- `PanelPlugin<T>(Component)` — plugin registration with `.setPanelOptions()`, `.useFieldConfig()`, `.setMigrationHandler()`
- `PanelProps<T>` — React props: `data`, `options`, `width`, `height`, `eventBus`, `replaceVariables`, `onOptionsChange`
- `PanelData.series: DataFrame[]` — query results as columnar data (fields with name, type, values)
- `EventBus` — subscribe to `RefreshEvent`, `DataHoverEvent` etc. (always unsubscribe on unmount)

## Commands

```bash
npm run dev          # Webpack watch mode with livereload
npm run build        # Production build → dist/
npm run server       # Docker Compose: runs Grafana OSS with the plugin mounted
npm run test         # Jest watch (--onlyChanged)
npm run test:ci      # Jest CI mode
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run lint:fix     # ESLint --fix + Prettier
npm run e2e          # Playwright E2E tests
```

Node >= 22 required (see `.nvmrc`).

## Architecture

**Grafana panel plugin** that renders a cyberpunk 3D city (Three.js) where each building represents a monitored service. Building appearance and animation react to data from Grafana queries. 11 building types, 3 custom shaders, traffic system, interactive tooltips/popups, floating labels, and a visual layout editor.

### Data flow

```
Grafana query (table data)
  → CityPanel.tsx (React component, lifecycle hooks)
    → dataMapper.ts (table rows → BuildingState[])
      → CityEngine.ts (Three.js scene manager)
        → Prefab instances (one per building, each a Three.js Group)
```

### Key source paths

| Path | Role |
|------|------|
| `src/module.tsx` | Plugin entry — registers CityPanel wrapped in ErrorBoundary, defines panel options |
| `src/components/CityPanel.tsx` | React bridge: init engine, sync layout, map data, handle resize |
| `src/components/ErrorBoundary.tsx` | React error boundary — catches Three.js crashes, shows Grafana Alert fallback |
| `src/data/dataMapper.ts` | Maps Grafana `PanelData` → `BuildingState[]` (status/activity/metrics) |
| `src/data/dataMapper.test.ts` | Unit tests for dataMapper (74 tests covering all formats and edge cases) |
| `src/engine/CityEngine.ts` | Three.js scene, renderer, camera, lights, animation loop, prefab management |
| `src/engine/InteractionManager.ts` | Raycasting hover/select, tooltip and detail popup triggers |
| `src/engine/RoadNetwork.ts` | Road grid mesh generation from binary layout |
| `src/engine/traffic/` | TrafficManager, LightCycle vehicles, PathGenerator, TrailSystem, DataPacket |
| `src/prefabs/BasePrefab.ts` | Abstract base: group, status/activity/data updates, pulse animation, dispose |
| `src/prefabs/materials.ts` | Color palette (`COLORS`), material factories, status→color mapping |
| `src/prefabs/*.ts` | Concrete prefabs: Windmill, TowerA, TowerB, Pyramid, DisplayA, DisplayAGiant, Bank, MonitorTube, MonitorTubeGiant, LedFacade, FarmSilo |
| `src/prefabs/shaders/` | Custom GLSL: `PyramidBeamShader`, `HologramShader`, `MonitorTubeShader` |
| `src/ui/` | TooltipManager, LabelManager, PopupLineManager, styles |
| `src/types.ts` | All interfaces: `Building`, `BuildingState`, `BuildingType`, `CityLayout`, `CityOptions` |

### Prefab system

All buildings extend `BasePrefab`. To add a new building type:
1. Create `src/prefabs/NewPrefab.ts` extending `BasePrefab`
2. Implement `build()`, `onStatusChange()`, `onActivityChange()`, optionally `updateData(state)`
3. Add the type to `BuildingType` union in `src/types.ts`
4. Register in the `createPrefab()` switch in `src/prefabs/index.ts`

### Advanced data fields

Prefabs receive the full `BuildingState` via `updateData(state)` called from `CityEngine.updateStates()`. Each prefab overrides `updateData` to extract the fields it needs:

| Prefab | Fields consumed |
|--------|----------------|
| DisplayA / DisplayAGiant | `text1`, `text2`, `text3`, `ringCount` |
| TowerA | `text1`, `text2`, `text3`, `cpuUsage`, `ramUsage` |
| TowerB | `text1` (ring text) |
| Bank | `bankQuantity`, `bankAmount` |
| MonitorTube | `monitorBands` |
| MonitorTubeGiant | `monitorBands`, `monitorMessages` |
| FarmSilo | `siloFillLevel` |

### Status & activity model

- **Status** (`online | offline | warning | critical`): controls color, glow intensity, pulse speed
- **Activity** (`slow | normal | fast`): controls animation speed (rotation, particles, scrolling)
- Status is resolved from data via text matching ("online"/"up"/"ok" → online) or numeric thresholds

### Shaders

Three custom `ShaderMaterial` implementations with preset factories:
- **PyramidBeamShader**: volumetric light beam (scanlines, noise, pulse)
- **HologramShader**: holographic effect (scanlines, chromatic aberration, fresnel, glitch)
- **MonitorTubeShader**: CRT ring gauge / hologram cylinder

### Error handling

`CityPanel` is wrapped in a React `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) that catches Three.js crashes and displays a Grafana `Alert` fallback instead of crashing the panel.

### Asset archive — `archive/threejs-scene/`

Original standalone Three.js app (whooktown-threejs) from which current prefabs were ported. Contains 23 building types total — 11 ported, 12 available for future use.

- **Building specs:** `archive/threejs-scene/assets_3d_list.md` — detailed doc of all 23 prefabs (properties, animations, visuals)
- **Prefab source:** `archive/threejs-scene/src/scene/prefabs/` — all building implementations
- **Shaders:** `archive/threejs-scene/src/scene/prefabs/shaders/` — includes SupervisorShader, DataCenterShader not yet ported

**Prefabs not yet ported:** HouseA, HouseB, HouseC, Bakery, Tree, TrafficLight, FarmBuildingA, FarmBuildingB, FarmFieldA, FarmFieldB, FarmCattleA, Supervisor, Arcade, DataCenter, Spire, DiamondTower, TwinTowers

**Systems not yet ported:**
- `src/scene/effects/FireworkManager.ts` — particle firework effects
