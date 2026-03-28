# Neon City Panel

A Grafana panel plugin that renders a **cyberpunk 3D city** where each building represents a monitored service. Building appearance — color, glow, animation speed — reacts in real time to data from your Grafana queries.

Built with [Three.js](https://threejs.org/). Features 11 building types, 3 custom GLSL shaders, animated road traffic, interactive tooltips & detail popups, floating labels, and a visual layout editor.

![City Overview](https://raw.githubusercontent.com/fredericalix/grafana-neon-city-panel/main/src/img/screenshot-overview.png)

## Features

- **11 cyberpunk building types** — Windmill, Tower A, Tower B, Pyramid, Display A, Display A Giant, Bank, Monitor Tube, Monitor Tube Giant, LED Facade, Farm Silo
- **Data-driven visuals** — status (online/warning/critical/offline) controls colors and glow; activity (slow/normal/fast) controls animation speed
- **Road network with traffic** — animated Tron-style light cycles and data packets traveling along configurable road grids
- **Interactive** — hover for tooltip, click for detail popup with animated neon connector lines
- **Visual layout editor** — drag-and-drop building placement and road editing directly in the panel options
- **Advanced data fields** — CRT text displays, holographic numbers, vault fill levels, gauge rings, silo fill gauges, monitor bands with scrolling messages
- **3 custom GLSL shaders** — PyramidBeam, Hologram, MonitorTube
- **Configurable thresholds** — numeric-to-status mapping with customizable ranges

![Building Detail Popup](https://raw.githubusercontent.com/fredericalix/grafana-neon-city-panel/main/src/img/screenshot-detail-popup.png)

## Requirements

- Grafana >= 12.3.0
- A modern browser with WebGL support

## Getting Started

1. Install the plugin from the Grafana plugin catalog, or download the latest release from [GitHub](https://github.com/fredericalix/grafana-neon-city-panel/releases).
2. If installing manually, extract the archive into your Grafana plugins directory and allow the unsigned plugin:
   ```ini
   [plugins]
   allow_loading_unsigned_plugins = whooktown-neoncity-panel
   ```
3. Restart Grafana.
4. Create a new panel and select **Neon-City-Panel** as the visualization.
5. Configure a data source that returns table data with at least `name` and `status` fields.
6. Open the panel options to place buildings using the **Layout Editor**.

![Layout Editor](https://raw.githubusercontent.com/fredericalix/grafana-neon-city-panel/main/src/img/screenshot-layout-editor.png)

## Documentation

See the **[User Manual](https://github.com/fredericalix/grafana-neon-city-panel/blob/main/docs/USER_MANUAL.md)** for complete installation instructions, data format reference, building type details, configuration options, and data source examples (TestData, Prometheus).

## License

Apache-2.0 — see [LICENSE](https://github.com/fredericalix/grafana-neon-city-panel/blob/main/LICENSE).
