# neon-city-panel - TODO

## Done

- [x] Scaffolding (create-plugin, Three.js, webpack)
- [x] CityEngine (scene, renderer, lights, fog, ground, OrbitControls)
- [x] CityPanel.tsx (React lifecycle, resize, data binding)
- [x] dataMapper.ts (table Grafana -> BuildingState[])
- [x] Panel options (nameField, statusField, valueField, thresholds)
- [x] Docker compose avec Grafana OSS
- [x] Dashboard demo provisionne (TestData)
- [x] Prefab: windmill (propeller, particules, neon rings)
- [x] Prefab: tower_a (CRT screens, scrolling text)
- [x] Prefab: tower_b (octagonal tower, hologram rabbit, HologramShader)
- [x] Prefab: pyramid (ziggurat, volumetric beam shader)
- [x] Prefab: led_facade (animated LED canvas patterns)
- [x] Prefab: monitor_tube (ring gauge bands, hologram cylinder)
- [x] Prefab: bank (holographic gold bars, amount display)
- [x] Prefab: display_a (3 holographic text rings, circuit patterns)
- [x] Prefab: display_a_giant (~5x scale variant of DisplayA)
- [x] Prefab: monitor_tube_giant (2x scale variant with scrolling text bands)
- [x] Shaders: PyramidBeamShader, MonitorTubeShader, HologramShader
- [x] Traffic system (TrafficManager, LightCycle, PathGenerator, TrailSystem, DataPacket)
- [x] InteractionManager (raycasting hover/select, tooltip, detail popup)
- [x] TooltipManager + PopupLineManager (hover tooltip, click detail popup, neon connector lines)
- [x] LabelManager (floating building labels)
- [x] Layout editor (building palette, grid, properties panel, roads tab)
- [x] Advanced data fields propagation (text1/2/3, ringCount, cpuUsage, ramUsage, bankAmount, monitorBands, monitorMessages)
- [x] ErrorBoundary React (catches Three.js crashes, shows Grafana Alert fallback)
- [x] Unit tests for dataMapper (74 tests)
- [x] Plugin metadata (description, keywords, links in plugin.json)

## TODO

### 1. Polish (priorite moyenne)

- [ ] Theme Grafana (dark/light mode awareness)
- [ ] WebGL context loss recovery (test en conditions reelles)
- [ ] Memory leak audit (dispose textures, geometries, materials)
- [ ] Dashboard demo plus complet

### 2. Robustesse (priorite moyenne)

- [ ] Validation + error handling dans dataMapper (try-catch, messages d'erreur clairs)
- [ ] Audit dispose des textures (canvas textures dans DisplayA, Bank, TowerA)
- [ ] Tests unitaires pour les prefabs (create/dispose/status change)

### 3. Publication (priorite basse)

- [ ] README avec screenshots
- [ ] CHANGELOG complet (documenter toutes les features de la 1.0.0)
- [ ] Plugin validator (`npx @grafana/plugin-validator`)
- [ ] Tests E2E reels (remplacer les tests template par des tests specifiques au panel)
- [ ] Soumission marketplace Grafana
