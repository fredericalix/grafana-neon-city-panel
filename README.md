# Neon City Panel

A Grafana panel plugin that renders a cyberpunk 3D city where each building represents a monitored service. Building appearance — color, glow, animation speed — reacts in real time to data from your Grafana queries.

Built with Three.js. Features 11 building types, 3 custom shaders, animated road traffic, interactive tooltips & detail popups, floating labels, and a visual layout editor.

<!-- ![Neon City Panel](docs/screenshot.png) -->

## Features

- **11 cyberpunk building types** — Windmill, Tower A, Tower B, Pyramid, Display A, Display A Giant, Bank, Monitor Tube, Monitor Tube Giant, LED Facade, Farm Silo
- **Data-driven visuals** — status (online/warning/critical/offline) controls colors and glow; activity (slow/normal/fast) controls animation speed
- **Road network with traffic** — animated light cycles traveling along configurable road grids
- **Interactive** — hover for tooltip, click for detail popup with animated neon connector lines
- **Visual layout editor** — drag-and-drop building placement and road editing directly in the panel options
- **Advanced data fields** — CRT text displays, holographic numbers, vault fill levels, gauge rings

## Quick Install

1. Download the latest `.zip` from [Releases](https://github.com/fredericalix/grafana-neon-city-panel/releases).
2. Extract into your Grafana plugins directory:
   ```bash
   unzip whooktown-neoncity-panel-*.zip -d /var/lib/grafana/plugins/
   ```
3. Allow the unsigned plugin — add to `grafana.ini`:
   ```ini
   [plugins]
   allow_loading_unsigned_plugins = whooktown-neoncity-panel
   ```
   Or set the environment variable:
   ```bash
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=whooktown-neoncity-panel
   ```
4. Restart Grafana.

## Requirements

- Grafana >= 12.3.0
- A modern browser with WebGL support

## Documentation

See the **[User Manual](docs/USER_MANUAL.md)** for complete installation instructions, data format reference, building type details, configuration options, and data source examples (TestData, Prometheus).

## License

Apache-2.0 — see [LICENSE](LICENSE).
