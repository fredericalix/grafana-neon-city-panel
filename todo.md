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
- [x] Shaders: PyramidBeamShader, MonitorTubeShader, HologramShader

## TODO

### 1. Champs avances (priorite haute)

Propager les champs de BuildingState vers les prefabs dans `CityEngine.updateStates()`.

- [ ] text1/text2/text3 -> DisplayA.updateText1/2/3(), TowerA.updateTowerText()
- [ ] towerBText -> TowerB.updateRingText()
- [ ] ringCount -> DisplayA.updateRingCount()
- [ ] cpuUsage/ramUsage -> (future DataCenter ou MonitorTube bands)
- [ ] amount/quantity -> Bank (deja supporte en interne)

### 2. Tooltip au hover (priorite haute)

- [ ] Raycasting Three.js sur les batiments
- [ ] Overlay HTML positionne en CSS au-dessus du canvas
- [ ] Afficher: nom, status, activity, metriques si presentes
- [ ] Fichiers: `engine/TooltipManager.ts` + update dans `CityPanel.tsx`

### 3. Layout editor drag & drop (priorite haute)

La plus grosse piece restante (~30% du travail).

- [ ] Bouton "Edit Layout" dans le panel
- [ ] Vue top-down (camera orthographique)
- [ ] Palette laterale avec les 8 types de batiments
- [ ] Drag from palette -> place on grid
- [ ] Drag on grid -> move
- [ ] Select -> panel proprietes (name, type, rotation)
- [ ] Delete (touche Suppr ou bouton)
- [ ] Serialization JSON -> panel options via onOptionsChange
- [ ] Undo/Redo

Fichiers: `editor/LayoutEditor.tsx`, `editor/BuildingPalette.tsx`, `editor/PropertyPanel.tsx`, `editor/GridHelper.ts`

### 4. Polish (priorite moyenne)

- [ ] Theme Grafana (dark/light mode awareness)
- [ ] WebGL context loss recovery (test en conditions reelles)
- [ ] Memory leak audit (dispose textures, geometries, materials)
- [ ] Dashboard demo plus complet

### 5. Publication (priorite basse)

- [ ] README avec screenshots
- [ ] CHANGELOG complet
- [ ] Plugin validator (`npx @grafana/plugin-validator`)
- [ ] Tests e2e (remplacer les tests template)
- [ ] Soumission marketplace Grafana
