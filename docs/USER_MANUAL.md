# Neon City Panel - User Manual

A Grafana panel plugin that renders a tron like 3D city using Three.js. Each building in the city represents a monitored service, and its appearance — color, glow, animation speed — reacts in real time to data from your Grafana queries.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Data Format](#data-format)
- [Panel Options Reference](#panel-options-reference)
- [Layout Editor](#layout-editor)
- [Building Types](#building-types)
- [Interaction](#interaction)
- [Data Source Examples](#data-source-examples)
- [Troubleshooting](#troubleshooting)

---

## Requirements

- **Grafana** >= 12.3.0
- A modern browser with **WebGL** support (Chrome, Firefox, Edge, Safari)

---

## Installation

### From GitHub Releases

1. Go to the [Releases page](https://github.com/fredericalix/grafana-neon-city-panel/releases).
2. Download the `.zip` archive for the version you want.
3. Extract it into your Grafana plugins directory:

```bash
unzip whooktown-neoncity-panel-<version>.zip -d /var/lib/grafana/plugins/
```

4. The plugin is **unsigned**. Configure Grafana to allow it.

   In `grafana.ini`:
   ```ini
   [plugins]
   allow_loading_unsigned_plugins = whooktown-neoncity-panel
   ```

   Or as an environment variable:
   ```bash
   GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=whooktown-neoncity-panel
   ```

5. **Restart Grafana.**

### Docker

Use a Docker Compose setup that mounts the plugin and sets the unsigned-plugin variable:

```yaml
services:
  grafana:
    image: grafana/grafana:12.3.2
    ports:
      - "3000:3000"
    environment:
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: whooktown-neoncity-panel
    volumes:
      - ./whooktown-neoncity-panel:/var/lib/grafana/plugins/whooktown-neoncity-panel
```

After `docker compose up`, Grafana is available at `http://localhost:3000`.

---

## Quick Start

1. Open Grafana and create a new dashboard.
2. Add a panel and select **Neon-City-Panel** as the visualization.
3. Add a data source query that returns a table. For a quick test, use the **TestData** data source with the **Raw Frames** scenario and paste the JSON below.
4. The panel should render the default cyberpunk city with 8 buildings.

### Sample TestData raw frame

```json
[
  {
    "columns": [
      { "text": "name", "type": "string" },
      { "text": "status", "type": "string" },
      { "text": "activity", "type": "string" },
      { "text": "text1", "type": "string" },
      { "text": "text2", "type": "string" },
      { "text": "text3", "type": "string" },
      { "text": "cpu", "type": "number" },
      { "text": "ram", "type": "number" },
      { "text": "quantity", "type": "string" },
      { "text": "amount", "type": "number" },
      { "text": "band1", "type": "number" },
      { "text": "band2", "type": "number" },
      { "text": "band3", "type": "number" },
      { "text": "band4", "type": "number" },
      { "text": "band5", "type": "number" },
      { "text": "fill", "type": "number" }
    ],
    "rows": [
      ["database",     "online",  "normal", "PRIMARY-DB-01", "PostgreSQL 16", "Uptime: 45d", null, null, null,   null,  null, null, null, null, null, null],
      ["cache",        "warning", "fast",   "REDIS-CLUSTER", null,            null,          null, null, null,   null,  null, null, null, null, null, null],
      ["api-gateway",  "online",  "fast",   "GATEWAY-v3.2",  "REST API",      "192.168.1.50", 85, 72,   null,   null,  null, null, null, null, null, null],
      ["web-server",   "online",  "normal", "NGINX-PROD",    null,            null,          null, null, null,   null,  null, null, null, null, null, null],
      ["display",      "online",  "fast",   "SYS-STATUS",    "ALL SYSTEMS",   "NOMINAL",     null, null, null,   null,  null, null, null, null, null, null],
      ["cdn",          "online",  "fast",   "CLOUDFLARE",    null,            null,          null, null, null,   null,  null, null, null, null, null, null],
      ["monitoring",   "online",  "normal", "PROMETHEUS",    null,            null,          null, null, null,   null,  92,   65,   38,   80,   15,   null],
      ["vault",        "online",  "slow",   "VAULT-PROD",    null,            null,          null, null, "full", 42750, null, null, null, null, null, null],
      ["energy-silo",  "online",  "normal", null,            null,            null,          null, null, null,   null,  null, null, null, null, null, 72]
    ]
  }
]
```

The `name` column values must match the building names configured in the [Layout Editor](#layout-editor). The default layout includes buildings named `database`, `cache`, `api-gateway`, `web-server`, `display`, `cdn`, `monitoring`, `vault`, and `energy-silo`.

---

## Data Format

The plugin expects **table data** where each row represents one building. The only required column is a name/identifier that matches a building name in the layout.

### Status from text

If you configure a **Status field** (default: `status`), the plugin maps text values to a building status:

| Text value (case-insensitive) | Status | Color |
|------|--------|-------|
| `online`, `up`, `ok`, `healthy`, `running`, `1` | online | green `#00ff88` |
| `warning`, `warn`, `degraded` | warning | orange `#ffaa00` |
| `critical`, `error`, `failure`, `down` | critical | red `#ff4444` |
| `offline`, `stopped`, `0` | offline | gray `#666688` |
| anything else | offline | gray `#666688` |

### Status from numeric thresholds

If no status text field is found but a **Value field** (default: `value`) exists, the plugin compares the numeric value against thresholds:

| Condition | Status |
|-----------|--------|
| value >= **online** threshold (default 90) | online |
| value >= **warning** threshold (default 70) | warning |
| value >= **critical** threshold (default 0) | critical |
| below all thresholds | offline |

### Activity

The optional `activity` column controls animation speed:

| Value | Effect |
|-------|--------|
| `slow` | Animations run at 0.5x speed |
| `normal` | Animations run at normal speed (default) |
| `fast` | Animations run at 2x speed |

### Advanced data fields

These optional columns drive specific building visuals. Column name matching is case-insensitive.

| Column | Type | Description | Used by |
|--------|------|-------------|---------|
| `text1` | string | Primary display text (overrides layout display text) | Tower A (CRT line 1), Tower B (hologram ring), Display A (top ring) |
| `text2` | string | Secondary display text | Tower A (CRT line 2), Display A (middle ring) |
| `text3` | string | Tertiary display text | Tower A (CRT line 3), Display A (bottom ring, visible when ringCount=3) |
| `cpu` | number (0-100) | CPU usage percentage | Tower A (CRT flicker & noise intensity) |
| `ram` | number (0-100) | RAM usage percentage | Tower A (CRT chromatic aberration & scanline opacity) |
| `band1`…`band7` | number (0-100) | Ring band gauge values | Monitor Tube, Monitor Tube Giant (one ring per band column; 3-7 bands) |
| `msg1`…`msg7` | string | Scrolling text messages for ring bands | Monitor Tube Giant (one message per ring, scrolls over the gauge fill) |
| `quantity` | string | Vault fill level: `none`, `low`, `medium`, `full` | Bank (gold bar display) |
| `amount` | number | Numeric amount display | Bank (floating holographic number) |
| `ringCount` | number | Number of display rings: `2` or `3` | Display A |
| `fill` or `level` | number (0-100) | Silo fill gauge percentage | Farm Silo |

### Traffic fields

Two optional panel options control the road traffic animation. These reference column names in your data:

| Option | Column type | Values | Default |
|--------|-------------|--------|---------|
| Traffic density field | number | 0-100 (clamped) | 50 if field not configured |
| Traffic speed field | string or number | `slow`/`normal`/`fast`, or 0-100 (< 33 = slow, 33-66 = normal, > 66 = fast) | `normal` if field not configured |

---

## Panel Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| City Layout | custom editor | 8 default buildings | Visual editor for building placement and road network. See [Layout Editor](#layout-editor). |
| Name field | text | `name` | Column name that identifies each building. Must match building names in the layout. |
| Status field | text | `status` | Column name for status text (`online`, `warning`, `critical`, `offline`). |
| Value field | text | `value` | Column name for numeric value (used with thresholds when no status text field is present). |
| Online threshold | number | `90` | Value >= this = online (green). |
| Warning threshold | number | `70` | Value >= this = warning (orange). |
| Critical threshold | number | `0` | Value >= this = critical (red). Below = offline. |
| Traffic density field | text | (empty) | Column name for traffic density (0-100). Leave empty for default 50%. |
| Traffic speed field | text | (empty) | Column name for traffic speed (`slow`/`normal`/`fast` or 0-100 numeric). |
| Enable interaction | boolean | `true` | When enabled, hover shows a tooltip and click opens a detail popup. |
| Show building labels | boolean | `false` | When enabled, floating name labels appear above each building. |

---

## Layout Editor

Open the layout editor from the panel options sidebar under **City Layout**.

### Buildings tab

- **Add a building**: Select a type from the dropdown palette and click the **+** button. A new building appears at the center of the grid.
- **Select a building**: Click it on the grid. The properties panel appears on the right.
- **Move a building**: Drag it on the grid. Position snaps to integer coordinates.
- **Edit properties**: When a building is selected, you can change its **name**, **type**, **display text**, **neon color** (Monitor Tube Giant only), **x**, **z**, and **rotation**.
- **Delete a building**: Select it, then click the **Delete** button in the properties panel.

The **name** field is critical — it is the key used to match rows in your query data to buildings in the city.

The **Display Text** field (visible for Tower A, Tower B, and Display A) sets a custom default text for the building. If left empty, the building displays "WHOOKTOWN". This text can be overridden at runtime by data query fields (`text1`, `text2`, `text3`). Priority: **data query > display text > "WHOOKTOWN"**.

### Roads tab

Switch to the **Roads** tab to edit the road network.

- Click grid cells to toggle road segments on/off.
- Roads are stored as a binary grid (rows of `0`s and `1`s).
- Light cycles (traffic animation) travel along connected road segments.

---

## Building Types

The plugin ships with 11 building types (9 standard + 2 giant variants). Unknown types fall back to Windmill.

### Windmill

Cyberpunk energy turbine with a conical tower, 3 rotating blades, neon rings, and spiral energy particles. Blade rotation speed is controlled by the activity level.

### Tower A

Massive skyscraper with 4 CRT display screens on each facade. Screens show animated scanlines and optional text. When only `text1` is provided, it is displayed large and centered. When `text2` or `text3` are also provided, the screen switches to a multi-line layout.

The `cpu` and `ram` fields drive real-time CRT degradation effects:

| Field | Effect at 0 | Effect at 100 |
|-------|-------------|---------------|
| `cpu` | Minimal flicker (5% chance), low noise | Heavy flicker (40% chance, stronger intensity), frequent noise lines (30%) |
| `ram` | Thin scanlines (10% opacity), minimal chromatic aberration (±1px), narrow edge strips | Thick scanlines (35% opacity), strong chromatic aberration (±6px), wide edge strips |

- **Data fields**: `text1` (CRT line 1; overrides display text), `text2` (CRT line 2), `text3` (CRT line 3), `cpu` (0-100, flicker & noise), `ram` (0-100, aberration & scanlines)
- **Display Text**: Configurable per building in the layout editor. Defaults to "WHOOKTOWN" if not set. Overridden by `text1` from data.

### Tower B

Octagonal tower with a rotating holographic text ring and a holographic rabbit on the rooftop. The text ring displays scrolling text from the `text1` column.

- **Data fields**: `text1` (scrolling hologram text; overrides display text)
- **Display Text**: Configurable per building in the layout editor. Defaults to "WHOOKTOWN" if not set. Overridden by `text1` from data.

### Pyramid

Multi-tiered ziggurat with a volumetric light beam projecting upward from the apex. Neon edge lines on each tier pulse faster in warning/critical states. Holographic windows between tiers.

### Display A

Holographic display tower with up to 3 rotating text rings. Each ring scrolls text from `text1`, `text2`, and `text3`. The third ring is only visible when `ringCount` is 3.

- **Data fields**: `text1` (top ring; overrides display text), `text2` (middle ring), `text3` (bottom ring), `ringCount` (2 or 3; default: 3)
- **Display Text**: Configurable per building in the layout editor. Sets the top ring default text. Defaults to "WHOOKTOWN" if not set. Overridden by `text1` from data.

### Display A Giant

A ~5x scale variant of Display A, matching the height of Monitor Tube Giant (~11.5 units). Same tower structure with circuit patterns, neon edges, top beacon, and 2-3 holographic text rings, but much larger for commanding visual presence.

Uses the same data fields as Display A. The larger canvas and font size make scrolling text highly readable even at distance.

- **Data fields**: `text1` (top ring; overrides display text), `text2` (middle ring), `text3` (bottom ring), `ringCount` (2 or 3; default: 3)
- **Display Text**: Configurable per building in the layout editor. Sets the top ring default text. Defaults to "WHOOKTOWN" if not set. Overridden by `text1` from data.
- **Neon Color**: Configurable per building in the layout editor. Same 6 presets as Monitor Tube Giant (Cyan, Magenta, Green, Blue, Orange, Red). Defaults to Cyan.

### Bank

Cyberpunk vault with a circular door, security shield dome, and data flow particles. Displays gold bars based on the `quantity` field and a floating holographic number from the `amount` field.

- **Data fields**: `quantity` (`none`/`low`/`medium`/`full`), `amount` (number shown as holographic display)

### Monitor Tube

Cylindrical structure with rotating gauge ring bands around a holographic core. Hexagonal base with animated grid floor and an outer shell with circuit patterns.

The number of ring bands is driven by how many `band1`…`band7` columns are present in the data (minimum 3, maximum 7, default 5). Each band value (0-100) controls:

- **Gauge fill**: the arc fill of the ring
- **Ring radius**: scales from 0.5x (value 0) to 1.5x (value 100) the default radius
- **Halo intensity**: the base halo ring brightness follows the average of all band values

Bands alternate between cyan/green and magenta/orange color schemes. When the band count changes between data refreshes, rings are rebuilt dynamically.

- **Data fields**: `band1`…`band7` (0-100 each; number of columns present determines the ring count)

### Monitor Tube Giant

A 2x scale variant of Monitor Tube designed for displaying scrolling text messages on each ring band. Same holographic core, hexagonal base, and outer shell, but twice as wide and tall for improved readability.

Each ring has two layers:

- **Background gauge**: same shader-based arc fill as Monitor Tube (driven by `band1`…`band7`)
- **Text overlay**: a scrolling neon marquee (driven by `msg1`…`msg7`) rendered over the gauge

When a `msgN` column is present for a ring, the text scrolls continuously around the ring with a glow effect. Rings without messages show only the gauge fill. Text scroll speed follows the building's activity level.

This prefab is ideal for displaying alert messages from Grafana Alerting or log lines from Loki. Use Grafana transformations to reshape query results into `msg1`…`msg7` columns.

#### Neon Color

The base neon color of the Monitor Tube Giant can be configured per building in the layout editor via the **Neon Color** dropdown. Available presets:

| Preset | Hex | Description |
|--------|-----|-------------|
| Cyan (default) | `#00ffff` | Tron/Matrix style |
| Magenta | `#ff00ff` | Cyberpunk pink/purple |
| Green | `#33ff66` | Classic terminal phosphor |
| Blue | `#4488ff` | Blade Runner / JARVIS |
| Orange | `#ffaa00` | Warm amber |
| Red | `#ff4444` | Alert / danger |

The chosen color applies to the ticker bands (background, text glow, scanlines), the holographic cylinder, the inner core, and the grid floor. Status overrides still apply: warning shifts to orange, critical shifts to red, and offline dims to gray — regardless of the chosen base color.

- **Data fields**: `band1`…`band7` (0-100, gauge fill), `msg1`…`msg7` (scrolling text per ring)
- **Neon Color**: Configurable per building in the layout editor. Defaults to Cyan.

### Farm Silo

Cyberpunk energy storage silo — a dark metallic cylinder with 5 rotating energy rings (alternating cyan/magenta), a dome top, and a glowing beacon. Inside, a translucent luminous cylinder acts as a fill gauge showing storage level.

The fill level is driven by the `fill` (or `level`) data column (0-100). The inner cylinder grows from the base upward, with color changing based on level: green (0-33%), cyan (34-66%), magenta (67-100%). The fill animates smoothly between values.

Ring rotation speed follows the activity level. In warning/critical status, the fill cylinder and rings change to orange/red. When offline, everything dims.

- **Data fields**: `fill` or `level` (0-100, fill gauge percentage)
- **Scale**: ~2x standard size for visibility

### LED Facade

Rectangular tower with animated LED facade panels on all 4 sides. Cycles through wave, bar, pulse, and digital rain patterns. Displays a warning pattern (orange stripes) or alert pattern (red flash + "ALERT" text) based on status.

### Status and activity effects

All building types respond to status and activity:

| Status | Visual effect |
|--------|---------------|
| online | Full brightness, all animations active, cyan/green glow |
| warning | Orange glow, faster pulse, increased flicker |
| critical | Red glow, maximum pulse speed, body emissive glow |
| offline | Dimmed (10-30% opacity), animations paused, particles hidden |

| Activity | Animation speed |
|----------|-----------------|
| slow | 0.5x |
| normal | 1.0x |
| fast | 2.0x |

---

## Interaction

When **Enable interaction** is on (default), the panel supports hover and click interactions.

### Hover tooltip

Move the mouse over a building to see a small tooltip with the building name and a colored status dot.

### Detail popup

Click a building to open a detail popup showing:

- Building name and type
- Status (with colored dot)
- Activity level
- Values from `text1`, `text2`, `text3` (if present in data)
- CPU and RAM usage (if present in data)

An animated neon line connects the popup to its building. Popups are **draggable** by their header bar. Up to **4 detail popups** can be open simultaneously; opening a 5th closes the oldest.

Click a building again to close its popup. Each popup also has a close button.

### Floating labels

Toggle **Show building labels** in the panel options to display floating name labels above each building. Labels fade out at distance and are hidden when the building is behind the camera.

---

## Data Source Examples

### TestData (quick start)

The simplest way to test the panel. Use the built-in **TestData** data source:

1. In the panel query editor, select the **TestData** data source.
2. Set the scenario to **Raw Frames**.
3. Paste the [sample JSON from the Quick Start section](#sample-testdata-raw-frame).
4. The city renders immediately with status colors and animations.

### Prometheus

A realistic setup monitoring backend services with Prometheus.

**Goal**: Build a table with `name`, `status`, `cpu`, and `ram` columns where each row is a service.

#### Query A — Service availability (status)

```promql
up{job=~"database|cache|api-gateway|web-server|cdn|monitoring|vault"}
```

Set the query **Format** to **Table**. This gives you columns like `job`, `instance`, `Value`.

#### Query B — CPU usage

```promql
rate(process_cpu_seconds_total{job=~"database|cache|api-gateway|web-server|cdn|monitoring|vault"}[5m]) * 100
```

Format: **Table**.

#### Query C — Memory usage

```promql
process_resident_memory_bytes{job=~"database|cache|api-gateway|web-server|cdn|monitoring|vault"} / 1e9
```

Format: **Table**.

#### Transformations

Use Grafana **Transformations** to combine the three queries into a single table:

1. **Outer join** — Join all queries on the `job` field.
2. **Organize fields** — Rename columns:
   - `job` to `name`
   - Query A `Value` to `value` (for threshold-based status) or map it to a text column
   - Query B `Value` to `cpu`
   - Query C `Value` to `ram`
3. **Remove** any unwanted columns (`instance`, `__name__`, etc.).

#### Panel options

- **Name field**: `name`
- **Value field**: `value` (the `up` metric: 1 = online, 0 = offline)
- **Thresholds**: online = 1, warning = 0.5, critical = 0

Or, if you prefer text-based status, add a transformation that maps 1 to `"online"` and 0 to `"offline"`, then configure the **Status field** instead.

Make sure the building **names** in the layout editor match the Prometheus `job` labels (e.g., `database`, `cache`, `api-gateway`).

---

## Troubleshooting

**Plugin not found after installation**

Check that the plugin files are in the correct directory. The `dist/` or extracted zip contents should be at `<plugins-dir>/whooktown-neoncity-panel/`. Restart Grafana after adding the plugin.

**"Unsigned plugin" error**

Add `whooktown-neoncity-panel` to the `allow_loading_unsigned_plugins` setting in `grafana.ini` or set the `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` environment variable. Restart Grafana.

**No buildings visible**

- Verify the layout has buildings configured (check the Layout Editor).
- Ensure the `name` column values in your query data match the building names in the layout exactly (case-sensitive).

**Status not updating / all buildings offline**

- Check that the **Status field** or **Value field** option matches a column name in your query results.
- Verify the query returns table-format data (not time series).
- Check the status text values match the [recognized patterns](#status-from-text).

**Black screen or WebGL error**

- Ensure your browser supports WebGL (test at [get.webgl.org](https://get.webgl.org)).
- Enable hardware acceleration in your browser settings.
- Try reducing the number of buildings if the GPU is under heavy load.
- If the 3D engine crashes, the panel displays a "3D rendering error" alert instead of a blank screen. Check the browser console for details.

**Detail tooltip not appearing on click**

- Verify **Enable interaction** is turned on in panel options.
- Click directly on the building geometry, not on empty space.

**Traffic not animating**

- Ensure roads are configured in the Layout Editor (Roads tab).
- If using data-driven traffic, verify the traffic density/speed field names match columns in your query.
