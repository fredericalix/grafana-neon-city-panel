# Changelog

## Unreleased

### Fixes

- Field lookup now also matches `config.displayName` / `state.displayName`, so columns renamed with Grafana's organize/rename transformations (the standard way to shape Prometheus results into the panel's table format) are recognized. Previously such columns were ignored and buildings stayed `offline`.
- Traffic no longer allocates and disposes vehicles in an endless loop when the road network is too small or fragmented to produce a valid path; spawning is suspended after repeated failures (with a `[neon-city-panel]` warning) until roads change
- Windmill neon rings keep their original cyan/magenta alternation instead of turning all-cyan after the first data refresh
- Guard against zero-width `measureText` results in the scrolling text of DisplayA, DisplayAGiant and TowerB, which could hang the dashboard with an infinite draw loop
- Empty or non-numeric `cpu`, `ram` and `amount` cells no longer display as "NaN%" in detail popups, and a non-numeric ring count no longer silently forces 3 rings
- The road editor no longer injects the literal string "undefined" into road rows when toggling cells on a layout with heterogeneous row lengths
- Roads are properly removed from the scene when a layout without roads replaces one that had them
- FarmSilo fill level animates via scaling instead of recreating its cylinder geometry every frame
- MonitorTube halo no longer keeps pulsing from stale gauge values while the building is offline
- The layout editor now exposes "Display Text" for DisplayAGiant and "Neon Color" for MonitorTube (both prefabs already consumed these options), and FarmSilo has its own color in the editor grid
- MonitorTube and MonitorTubeGiant freeze their band rotation, gauge interpolation and teleprinter animations while offline, matching the other prefabs
- Query errors (`LoadingState.Error`) get a dedicated diagnostic message in the overlay instead of the misleading "No data received"
- Bank gold particles orbit at uniform angular speed (elliptic `atan2` correction), and the amount display skips its costly canvas repaint when the value is unchanged

### Performance

- TrailSystem trail points use a preallocated ring buffer instead of cloning `Vector3`s and `unshift()`ing every frame (~6,000 allocations/s avoided at 50 vehicles)
- Vehicle direction smoothing is framerate-independent (`1 - exp(-k·dt)`), so cornering looks the same at 120 Hz and 60 Hz
- Detail popups no longer force a synchronous reflow every frame: popup dimensions are cached and all layout reads are batched before style writes; popup connecting lines use engine-computed anchors instead of per-frame `getBoundingClientRect()` calls
- The popup line canvas skips its per-frame `clearRect` when no popup is open
- Labels are no longer rebuilt (DOM destroy/recreate) on every editor drag mousemove — `LabelManager.setBuildings()` only rebuilds when the building set actually changes
- Renaming a building in the layout editor no longer disposes and rebuilds its 3D prefab on every keystroke: buildings now have a stable 3D identity (`LayoutBuilding.id`), and query data joins by building name (case-insensitive) in the engine

### Quality

- Removed dead code: `VehicleBase.reset()`, `TRAIL_CONFIG.updateInterval`, `PERFORMANCE_LIMITS`, `PathSegment`, the unused `uTime` uniform of the trail shader, the per-vertex `size` attribute of DataPacket particles, `TowerA.updateTowerText()`, `TowerB.updateHologramEnabled()`, MonitorTube's unreachable band-color branch
- Pyramid, Bank and LedFacade use the `createCanvasTexture()` helper (explicit error) instead of `getContext('2d')!` assertions
- Building ids in the layout editor use `crypto.randomUUID()` instead of `Date.now()` (collision-safe)
- `console.error` in the error boundary carries the `[neon-city-panel]` prefix like all other logs

### Testing

- The Three.js mock now provides `Fog`, `MeshPhysicalMaterial`, a real `clone()` (new instances with their own dispose spies — dispose tests can no longer go blind), `Vector3.project/crossVectors`, `getWorldPosition`, `BufferAttribute` accessors, and an OrbitControls mock; the canvas 2D context is created per-canvas instead of shared across tests
- New unit tests: `CityEngine` (dispose idempotence, start/pause on visibility, name-based data join, rename without rebuild, type-change rebuild), `TrafficManager` (spawn suspension, disposal), and the XSS contract of tooltips/labels against malicious building names and data strings
- `test:ci` no longer passes `--passWithNoTests`, which could have hidden a test-discovery regression

### Demo

- New `demo/` self-contained docker-compose stack ("Neon Noodle Bar"): HA frontend/backend behind Traefik + PostgreSQL, monitored by Prometheus + Grafana with provisioned alerting, the city dashboard fed by `neon:*` recording rules, a sinusoidal load generator and a `chaos.sh` incident toolbox

## 1.1.1

### Reliability

- Dispose `CanvasTexture` resources for TowerA and Bank prefabs on unmount to prevent GPU memory accumulation over long sessions
- MonitorTube ring bands are now released cleanly when `bandCount` changes at runtime

### Quality

- Warn (instead of silently aliasing) when a layout contains duplicate building names, or when the panel options specify an unknown `BuildingType`
- Warn when status thresholds are not strictly ordered (`online ≥ warning ≥ critical`)
- Hardened `InteractionManager` raycasting against non-string `userData.buildingId`
- Replaced the last two `innerHTML` writes in `TooltipManager` with DOM APIs
- Traffic path queries reuse the cached `pathLength` instead of recomputing it per frame, per vehicle
- Branchless color interpolation in `MonitorTube` ring-band and `Hologram` chromatic aberration shaders

## 1.1.0

### Fixes

- **Traffic density** — fix density value not updating from the traffic density data field at runtime
- **Tower A CPU/RAM visuals** — CRT screen now reacts correctly to `cpu` and `ram` fields (flicker, noise, edge aberration, bar gauges)
- **Numeric status handling** — float values like `1.0` / `0.0000001` from Prometheus `up` metrics after transformations are now interpreted correctly
- **Detail popup real-time updates** — click-to-open popups now refresh their content when the underlying building state changes

## 1.0.1

- Diagnostic overlay surfaces common data-mapping issues for onboarding
- E2E test simplified for cross-version Grafana compatibility and headless Chromium (no WebGL)

## 1.0.0 (Unreleased)

### Features

- **11 cyberpunk building types** — Windmill, Tower A, Tower B, Pyramid, Display A, Display A Giant, Bank, Monitor Tube, Monitor Tube Giant, LED Facade, Farm Silo
- **Data-driven visuals** — status (online/warning/critical/offline) controls color and glow; activity (slow/normal/fast) controls animation speed
- **Advanced data fields** — CRT text displays, holographic numbers, vault fill levels, gauge rings, silo fill gauges, monitor bands with scrolling messages
- **Road network with animated traffic** — Tron-style light cycles and data packets traveling along configurable road grids, with density and speed controllable via data fields
- **Interactive** — hover tooltips, click-to-select detail popups with animated neon connector lines, floating building labels
- **Visual layout editor** — drag-and-drop building placement and road grid editing directly in panel options
- **3 custom GLSL shaders** — PyramidBeam (volumetric light beam), Hologram (CRT scanlines, chromatic aberration, glitch), MonitorTube (ring gauge / hologram cylinder)
- **Per-building neon color presets** for Monitor Tube Giant
- **Configurable thresholds** for numeric-to-status mapping (online, warning, critical ranges)
- **Error boundary** for graceful Three.js crash recovery
- **3 example dashboards** included for quick start with TestData
