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

**Grafana panel plugin** that renders a cyberpunk 3D city (Three.js) where each building represents a monitored service. Building appearance and animation react to data from Grafana queries.

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
| `src/module.ts` | Plugin entry — registers CityPanel, defines panel options |
| `src/components/CityPanel.tsx` | React bridge: init engine, sync layout, map data, handle resize |
| `src/data/dataMapper.ts` | Maps Grafana `PanelData` → `BuildingState[]` (status/activity/metrics) |
| `src/engine/CityEngine.ts` | Three.js scene, renderer, camera, lights, animation loop, prefab management |
| `src/prefabs/BasePrefab.ts` | Abstract base: group, status/activity updates, pulse animation, dispose |
| `src/prefabs/materials.ts` | Color palette (`COLORS`), material factories, status→color mapping |
| `src/prefabs/*.ts` | Concrete prefabs: Windmill, TowerA, TowerB, Pyramid, DisplayA, Bank, MonitorTube, LedFacade |
| `src/prefabs/shaders/` | Custom GLSL: `PyramidBeamShader`, `HologramShader`, `MonitorTubeShader` |
| `src/types.ts` | All interfaces: `Building`, `BuildingState`, `BuildingType`, `CityLayout`, `CityOptions` |

### Prefab system

All buildings extend `BasePrefab`. To add a new building type:
1. Create `src/prefabs/NewPrefab.ts` extending `BasePrefab`
2. Implement `build()`, `onStatusChange()`, `onActivityChange()`
3. Add the type to `BuildingType` union in `src/types.ts`
4. Register in the `createPrefab()` switch in `src/prefabs/index.ts`

### Status & activity model

- **Status** (`online | offline | warning | critical`): controls color, glow intensity, pulse speed
- **Activity** (`slow | normal | fast`): controls animation speed (rotation, particles, scrolling)
- Status is resolved from data via text matching ("online"/"up"/"ok" → online) or numeric thresholds

### Shaders

Three custom `ShaderMaterial` implementations with preset factories:
- **PyramidBeamShader**: volumetric light beam (scanlines, noise, pulse)
- **HologramShader**: holographic effect (scanlines, chromatic aberration, fresnel, glitch)
- **MonitorTubeShader**: CRT ring gauge / hologram cylinder

### Asset archive — `archive/threejs-scene/`

Original standalone Three.js app (whooktown-threejs) from which all current prefabs were ported. Contains 23 building types total — 8 ported, 15 available for future use.

- **Building specs:** `archive/threejs-scene/assets_3d_list.md` — detailed doc of all 23 prefabs (properties, animations, visuals)
- **Prefab source:** `archive/threejs-scene/src/scene/prefabs/` — all building implementations
- **Shaders:** `archive/threejs-scene/src/scene/prefabs/shaders/` — includes SupervisorShader, DataCenterShader not yet ported

**Prefabs not yet ported:** HouseA, HouseB, HouseC, Bakery, Tree, TrafficLight, FarmBuildingA, FarmBuildingB, FarmSilo, FarmFieldA, FarmFieldB, FarmCattleA, Supervisor, Arcade, DataCenter, Spire, DiamondTower, TwinTowers

**Systems not yet ported:**
- `src/scene/traffic/` — TrafficManager, LightCycle vehicles, PathGenerator, TrailSystem
- `src/scene/CameraController.ts` — orbit / FPS / flyover camera modes
- `src/scene/InteractionManager.ts` — mouse/keyboard building interactions
- `src/scene/effects/FireworkManager.ts` — particle firework effects
- `src/ui/TooltipManager.ts` — hover tooltips over buildings
- `src/ui/LabelManager.ts` — floating building labels
