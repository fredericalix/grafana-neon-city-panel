# Changelog

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
