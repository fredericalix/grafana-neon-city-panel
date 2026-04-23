# Changelog

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
