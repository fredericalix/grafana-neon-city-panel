# 3D Building Assets - Three.js Client

Liste des prefabs 3D disponibles dans le client Three.js de whooktown.

## Types de batiments

| Type ID | Classe | Description |
|---------|--------|-------------|
| `windmill` | WindmillPrefab | Turbine d'energie cyberpunk |
| `house_a` | HousePrefab | Module d'habitation compact |
| `house_b` | HousePrefab | Gratte-ciel moyen (8 etages) |
| `house_c` | HousePrefab | Grand gratte-ciel (15 etages) |
| `bakery` | BakeryPrefab | Boulangerie futuriste |
| `bank` | BankPrefab | Coffre-fort high-tech |
| `farm_building_a` | FarmPrefab | Serre hydroponique |
| `farm_building_b` | FarmPrefab | Centre de traitement |
| `farm_silo` | FarmPrefab | Silo de stockage d'energie |
| `farm_field_a` | FarmPrefab | Champ holographique |
| `farm_field_b` | FarmPrefab | Champ de pods neon |
| `farm_cattle_a` | FarmPrefab | Enclos de betail synthetique |
| `tree` | TreePrefab | Arbre holographique |
| `traffic_light` | TrafficLightPrefab | Feu de circulation |
| `display_a` | DisplayAPrefab | Tour d'affichage holographique |
| `tower_a` | TowerAPrefab | Gratte-ciel geant avec ecrans CRT (2x2) |
| `tower_b` | TowerBPrefab | Tour octogonale avec danseuse holographique |

---

## Details des prefabs

---

### windmill

**Turbine d'energie cyberpunk**

- Base hexagonale avec anneau neon
- Tour conique metallique avec panneaux d'accent
- 3 pales d'energie rotatives avec panneaux lumineux
- Anneaux neon cyan/magenta le long de la tour
- Coeur d'energie pulsant au centre
- Particules d'energie en spirale autour

**Dimensions:** ~0.7 x 1.05 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Neons brillants (opacity 0.8-0.9), coeur pulse, particules visibles, pales en rotation |
| `offline` | Anneaux neon attenues (opacity 0.15), aretes neon (opacity 0.2), coeur attenue (opacity 0.2), particules cachees, pales arretees |
| `failure` | Anneaux neon **rouges**, coeur d'energie **rouge**, corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Rotation pales lente (x0.5), particules spirale lente |
| `normal` | Rotation pales normale (x1.0), particules normales |
| `fast` | Rotation pales rapide (x2.0), particules spirale rapide |

#### Animations continues (online)
- Pales: rotation sur axe Z (vitesse = activity * 3)
- Particules: spirale ascendante autour de la tour
- Coeur: pulse opacity (0.6 - 0.9) a 4Hz
- Anneaux neon: pulse opacity (0.6 - 0.9) a 3Hz

---

### house_a

**Module d'habitation compact (pod futuriste)**

- Corps hexagonal sombre metallique
- Dome superieur arrondi
- Bande de fenetres lumineuses (tore cyan)
- Porte avec cadre magenta
- Anneaux neon a la base et au sommet

**Dimensions:** ~0.7 x 0.55 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Fenetres brillantes (opacity 0.7), aretes neon actives (opacity 0.9) |
| `offline` | Fenetres attenuees (opacity 0.1), aretes neon attenuees (opacity 0.2) |
| `failure` | Corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Scintillement fenetres lent |
| `normal` | Scintillement fenetres normal |
| `fast` | Scintillement fenetres rapide |

#### Animations continues (online)
- Fenetres: scintillement cyberpunk (variation opacity 0.6-0.9 avec phases decalees)

---

### house_b

**Gratte-ciel moyen cyberpunk (8 etages)**

- Tour rectangulaire metallique sombre
- Bandes d'accent laterales
- Aretes neon style Tron (**cyan**)
- Grille de fenetres lumineuses aleatoires
- Antenne avec pointe brillante

**Dimensions:** 0.5 x 1.2 x 0.4 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Fenetres brillantes (opacity 0.7), aretes cyan actives (opacity 0.9) |
| `offline` | Fenetres attenuees (opacity 0.1), aretes attenuees (opacity 0.2) |
| `failure` | Corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Scintillement fenetres lent |
| `normal` | Scintillement fenetres normal |
| `fast` | Scintillement fenetres rapide |

#### Animations continues (online)
- Fenetres: scintillement individuel (chaque fenetre a sa propre phase)

---

### house_c

**Grand gratte-ciel cyberpunk (15 etages)**

- Meme structure que house_b mais plus grand
- Aretes neon **magenta** (au lieu de cyan)
- Plus de fenetres animees

**Dimensions:** 0.6 x 2.0 x 0.5 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Fenetres brillantes (opacity 0.7), aretes magenta actives (opacity 0.9) |
| `offline` | Fenetres attenuees (opacity 0.1), aretes attenuees (opacity 0.2) |
| `failure` | Corps avec lueur emissive rouge |

#### Activity

Identique a house_b

#### Animations continues (online)
Identique a house_b

---

### bakery

**Boulangerie futuriste**

- Corps angulaire metallique sombre
- Grande vitrine holographique orange
- Porte avec cadre neon magenta
- Cheminee d'energie avec fumee plasma
- Anneau holographique avec pain wireframe flottant

**Dimensions:** 0.6 x 0.48 x 0.5 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Aretes orange brillantes (opacity 0.9), vitrine active (opacity 0.7), fumee visible, hologramme rotatif |
| `offline` | Aretes attenuees (opacity 0.2), vitrine attenuee (opacity 0.1), fumee cachee |
| `failure` | Fumee cachee, corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Fumee monte lentement (x0.2), hologramme rotation lente |
| `normal` | Fumee monte normalement (x0.4), hologramme rotation normale |
| `fast` | Fumee monte rapidement (x0.8), hologramme rotation rapide |

#### Animations continues (online)
- Fumee plasma: particules orange/jaune montant de la cheminee
- Hologramme: anneau cyan rotatif (rotation Z a 2 rad/s)
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz

---

### bank

**Coffre-fort high-tech**

- Plateforme surelevee avec corps fortifie
- Porte de coffre circulaire avec cadre vert lumineux
- Colonnes de securite avec anneaux cyan
- Bouclier de securite semi-transparent (dome)
- Flux de donnees (particules verticales)
- Projecteurs holographiques magenta
- **Indicateur de stock d'or** (lingots holographiques sur le cote)
- **Affichage du montant** (nombre holographique flottant au-dessus)

**Dimensions:** 0.75 x 0.84 x 0.55 unites (+ 0.25 pour le stock d'or sur le cote)

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Aretes cyan brillantes (opacity 0.9), bouclier pulse (opacity 0.03-0.05), flux donnees actif, projecteurs rotatifs |
| `offline` | Aretes attenuees (opacity 0.2), bouclier invisible (opacity 0), flux donnees cache, **or attenue** (opacity 30%), **montant attenue** |
| `failure` | Aretes **rouges**, bouclier **rouge** (opacity 0.15), corps lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Flux donnees lent (x0.3), projecteurs rotation lente |
| `normal` | Flux donnees normal (x0.6), projecteurs rotation normale |
| `fast` | Flux donnees rapide (x1.2), projecteurs rotation rapide |

#### Quantity (propriete specifique bank)

Controle l'affichage des lingots d'or holographiques sur le cote droit de la banque.

| Quantity | Effet visuel |
|----------|--------------|
| `none` | Aucun lingot visible (plateforme vide) |
| `low` | 6 lingots (couche inferieure uniquement) |
| `medium` | 10 lingots (couches inferieure + moyenne) |
| `full` | 12 lingots (toutes les couches, pyramide complete) |

**Visuel des lingots:**
- Style wireframe holographique dore (#ffd700)
- Coeur lumineux orange (#ffaa00)
- Disposes en pyramide sur plateforme avec bordure neon doree
- Animation: pulse en vague (phases decalees par lingot)

#### Amount (propriete specifique bank)

Affiche un nombre au-dessus de la banque en style holographique.

| Amount | Effet visuel |
|--------|--------------|
| `null` / non defini | Affichage cache |
| nombre | Nombre affiche avec effet glow dore, flottant au-dessus de la banque |

**Visuel du montant:**
- Police monospace bold
- Triple couche de rendu: glow externe (#ffaa00), glow interne (#ffd700), texte blanc
- Position: Y = 1.0 (au-dessus du toit)
- Animation: leger flottement vertical + pulse opacity

#### Animations continues (online)
- Flux de donnees: particules cyan/vert oscillant verticalement (certaines montent, d'autres descendent)
- Projecteurs holographiques: rotation alternee (sens horaire/anti-horaire a 2 rad/s)
- Bouclier: pulse opacity (0.03 - 0.05) a 2Hz
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz
- **Lingots d'or**: pulse opacity en vague (2.5Hz, phases decalees)
- **Montant**: flottement vertical (1.5Hz) + pulse opacity (2Hz)

---

### farm_building_a

**Serre hydroponique**

- Plateforme de base avec dome en verre vert transparent
- Corps semi-transparent avec armature metallique
- 3 lampes de croissance magenta horizontales
- Rangees de pods de plantes hydroponiques (15 pods)
- Particules de flux de nutriments

**Dimensions:** 0.75 x 0.45 x 0.55 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Aretes cyan brillantes (opacity 0.9), lampes magenta actives, pods visibles, particules actives |
| `offline` | Aretes attenuees (opacity 0.2), lampes attenuees, pods attenues, particules cachees |
| `failure` | Meme que offline (pas de traitement specifique) |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Pods pulsent lentement, particules montent lentement |
| `normal` | Pods pulsent normalement, particules montent normalement |
| `fast` | Pods pulsent rapidement, particules montent rapidement |

#### Animations continues (online)
- Pods hydroponiques: pulse scale Y (variation 1.0 - 1.15)
- Particules: mouvement ascendant (vitesse = activity * 0.3)
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz

---

### farm_building_b

**Centre de traitement agricole**

- Structure compacte metallique sombre
- Fenetre de traitement orange
- 2 cheminees d'echappement avec anneaux orange
- Particules de donnees orange

**Dimensions:** 0.5 x 0.43 x 0.45 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Aretes cyan brillantes, fenetre orange active (opacity 0.6), anneaux orange actifs, particules visibles |
| `offline` | Aretes attenuees (opacity 0.2), fenetre attenuee, anneaux attenues, particules cachees |
| `failure` | Meme que offline |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Particules montent lentement |
| `normal` | Particules montent normalement |
| `fast` | Particules montent rapidement |

#### Animations continues (online)
- Particules orange: mouvement ascendant
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz

---

### farm_silo

**Silo de stockage d'energie**

- Tour cylindrique metallique sombre
- 5 anneaux d'energie rotatifs (cyan/magenta alternes)
- Dome superieur avec balise d'energie cyan
- Indicateur de niveau vertical vert

**Dimensions:** 0.4 (diametre) x 0.92 (hauteur) unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Anneaux brillants (opacity 0.8), balise active (opacity 0.9), indicateur vert actif, anneaux rotatifs |
| `offline` | Anneaux attenues (opacity ~0.1), balise attenuee, indicateur attenue, rotation arretee |
| `failure` | Meme que offline |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Anneaux rotation lente (x0.5) |
| `normal` | Anneaux rotation normale (x1.0) |
| `fast` | Anneaux rotation rapide (x2.0) |

#### Animations continues (online)
- Anneaux d'energie: rotation alternee (pairs sens horaire, impairs sens anti-horaire)
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz

---

### farm_field_a

**Champ de cultures holographiques**

- Plateforme au sol avec grille neon cyan
- 25 tiges de cultures wireframe vertes
- Effet holographique semi-transparent

**Dimensions:** 0.8 x 0.8 unites (au sol)

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Grille cyan visible (opacity 0.4), tiges vertes wireframe actives (opacity 0.5) |
| `offline` | Grille attenuee, tiges attenuees (opacity ~0.1) |
| `failure` | Meme que offline |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Tiges oscillent lentement, scintillement lent |
| `normal` | Tiges oscillent normalement, scintillement normal |
| `fast` | Tiges oscillent rapidement, scintillement rapide |

#### Animations continues (online)
- Tiges holographiques: oscillation (rotation X: ±0.1, rotation Z: ±0.08)
- Effet holographique: scintillement opacity (0.4 - 0.6)

---

### farm_field_b

**Champ de pods neon**

- Plateforme au sol avec bordure magenta
- Grille 4x4 de pods de plantes (16 pods)
- Bases metalliques avec spheres lumineuses vert/cyan

**Dimensions:** 0.8 x 0.8 unites (au sol)

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Bordure magenta brillante (opacity 0.8), spheres vert/cyan actives (opacity 0.7) |
| `offline` | Bordure attenuee (opacity 0.2), spheres attenuees (opacity ~0.1) |
| `failure` | Meme que offline |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Spheres pulsent lentement |
| `normal` | Spheres pulsent normalement |
| `fast` | Spheres pulsent rapidement |

#### Animations continues (online)
- Spheres: pulse scale (1.0 - 1.1) avec phases decalees

---

### farm_cattle_a

**Enclos de betail synthetique**

- Plateforme au sol sombre
- 8 poteaux de cloture avec tetes cyan
- Rayons d'energie horizontaux (cloture laser)
- 3 vaches synthetiques wireframe cyan avec coeur vert

**Dimensions:** 0.75 x 0.75 unites (au sol)

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Poteaux cyan brillants (opacity 0.8), rayons actifs (opacity 0.6), coeurs verts actifs, vaches animees |
| `offline` | Poteaux attenues, rayons attenues (opacity 0.2), coeurs attenues, vaches immobiles |
| `failure` | Meme que offline |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Vaches se deplacent lentement |
| `normal` | Vaches se deplacent normalement |
| `fast` | Vaches se deplacent rapidement |

#### Animations continues (online)
- Vaches synthetiques: leger mouvement lateral (oscillation position X)
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz

---

### tree

**Arbre holographique**

- Base hexagonale avec projecteur (plateforme neon cyan)
- Tronc wireframe cyan avec coeur vert
- 3 couches de feuillage coniques wireframe vertes
- Anneaux neon le long du tronc (cyan/magenta)
- Balise octaedre au sommet
- Particules de donnees flottantes

**Dimensions:** ~0.44 x 0.7 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Feuillage visible (opacity 0.5/0.15), anneaux actifs (opacity 0.7), tronc visible (opacity 0.6), particules actives |
| `offline` | Feuillage tres attenue (opacity 0.05), anneaux attenues (opacity 0.1), tronc attenue (opacity 0.1), particules cachees |
| `failure` | Meme que offline (pas de traitement specifique) |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Oscillation lente, particules montent lentement |
| `normal` | Oscillation normale, particules montent normalement |
| `fast` | Oscillation rapide, particules montent rapidement |

#### Animations continues (online)
- Feuillage: oscillation douce (rotation Y: ±0.05, rotation X: ±0.02) + pulse opacity
- Anneaux neon: rotation (pairs sens horaire 0.5 rad/s, impairs anti-horaire 0.3 rad/s)
- Particules: spirale ascendante (vitesse Y: 0.1, rotation: 0.5 rad/s)
- Tronc: pulse opacity (0.5 - 0.7) a 3Hz

---

### traffic_light

**Feu de circulation**

- Poteau metallique mince
- Boitier de signal noir avec visiere
- 3 feux circulaires: rouge, jaune, vert

**Dimensions:** ~0.1 x 0.65 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Cycle normal des feux (voir ci-dessous) |
| `offline` | Tous les feux eteints (opacity 0.1) |
| `failure` | **Jaune clignotant uniquement** (autres feux eteints) |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Cycle des feux ralenti (x0.5) |
| `normal` | Cycle des feux normal (x1.0) |
| `fast` | Cycle des feux accelere (x2.0) |

#### Cycle normal (online)
| Phase | Duree | Feu actif |
|-------|-------|-----------|
| 1 | 3s | Vert (opacity 1.0), autres (opacity 0.2) |
| 2 | 1s | Jaune (opacity 1.0), autres (opacity 0.2) |
| 3 | 3s | Rouge (opacity 1.0), autres (opacity 0.2) |

**Cycle total:** 7 secondes (modifie par activity)

#### Mode failure
- Jaune clignote a 4Hz (sin wave)
- Rouge et vert fixes a opacity 0.2

---

### display_a

**Tour d'affichage holographique (style Tron Legacy)**

- Tour cylindrique elancee metallique sombre
- Motifs de circuits lumineux sur la surface
- Aretes neon cyan/magenta
- 2 ou 3 anneaux holographiques rotatifs avec texte defilant
- Reflets sur sol mouille (scene globale)

**Dimensions:** ~0.3 (diametre) x 1.8 (hauteur) unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Aretes cyan/magenta brillantes (opacity 0.9), anneaux holographiques actifs avec texte defilant, motifs circuits visibles |
| `offline` | Aretes attenuees (opacity 0.2), anneaux attenues (opacity 0.15), texte attenue |
| `failure` | Corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Rotation anneaux lente (x0.5), defilement texte lent |
| `normal` | Rotation anneaux normale (x1.0), defilement texte normal |
| `fast` | Rotation anneaux rapide (x2.0), defilement texte rapide |

#### RingCount (propriete specifique display_a)

Controle le nombre d'anneaux holographiques affiches.

| RingCount | Effet visuel |
|-----------|--------------|
| `2` | 2 anneaux holographiques (haut et bas) |
| `3` | 3 anneaux holographiques (haut, milieu, bas) |

**Type:** `2 | 3`

#### Text1, Text2, Text3 (proprietes specifiques display_a)

Controle le texte defilant sur chaque anneau holographique.

| Propriete | Description |
|-----------|-------------|
| `text1` | Texte affiche sur l'anneau du haut |
| `text2` | Texte affiche sur l'anneau du milieu |
| `text3` | Texte affiche sur l'anneau du bas (visible uniquement si ringCount=3) |

**Visuel du texte:**
- Style marquee horizontal (defilement de droite a gauche)
- Police monospace bold
- Couleur cyan avec glow magenta externe
- Texture canvas mise a jour dynamiquement
- Effet de transparence holographique

**Valeurs par defaut:**
- text1: "WHOOKTOWN"
- text2: "SYSTEM ONLINE"
- text3: "STATUS OK"

#### Animations continues (online)
- Anneaux: rotation autour de la tour (vitesse selon activity)
- Texte: defilement horizontal continu (vitesse selon activity)
- Aretes neon: pulse opacity (0.7 - 1.0) a 3Hz
- Motifs circuits: scintillement aleatoire

### Utilisation via messages SSE/WebSocket

Le backend peut envoyer les proprietes display_a dans les messages sensor:

```json
{
  "event": "sensors",
  "data": {
    "id": "display-001",
    "status": "online",
    "activity": "normal",
    "ringCount": 3,
    "text1": "ALERTE SYSTEME",
    "text2": "SERVEUR #42",
    "text3": "CPU: 87%"
  }
}
```

### Appel direct (si acces au prefab)

```typescript
const displayPrefab = prefab as DisplayAPrefab;
displayPrefab.updateRingCount(2);
displayPrefab.updateText1("NOUVEAU MESSAGE");
displayPrefab.updateText2("STATUS: OK");
displayPrefab.updateText3("TEMP: 42C");
```

---

### tower_a

**Gratte-ciel geant style Tron avec ecrans CRT (2x2 cellules)**

- Tour carree massive (4 unites de haut)
- Base metallique avec bordure neon
- 4 ecrans CRT geants sur chaque face
- Effets CRT: scanlines, flicker, ghosting chromatic
- Piliers aux 4 coins avec accents lumineux
- Bandes horizontales neon le long de la tour
- Antennes et balises au sommet
- Anneau neon rotatif au sommet
- **Occupe 2x2 cellules dans le builder**

**Dimensions:** ~1.6 x 1.6 x 4.0 unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Ecrans CRT actifs avec texte, scanlines animees, flicker aleatoire, neons brillants (opacity 0.9) |
| `offline` | Ecrans attenues (opacity 0.3), neons attenues (opacity 0.2) |
| `failure` | Neons **rouges**, corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Scanlines lentes, flicker rare |
| `normal` | Scanlines normales, flicker occasionnel |
| `fast` | Scanlines rapides, flicker frequent |

#### TowerText (propriete specifique tower_a)

Controle le texte affiche sur les 4 ecrans CRT de la tour.

| Propriete | Description |
|-----------|-------------|
| `towerText` | Texte affiche sur tous les ecrans CRT (identique sur les 4 faces) |

**Type:** `string`

**Effets visuels du texte:**
- Police monospace bold avec glow
- Effet ghosting chromatic (cyan/magenta)
- Scanlines horizontales defilantes
- Flicker aleatoire d'intensite
- Lignes d'interference occasionnelles
- Aberration chromatique sur les bords

**Valeur par defaut:** "WHOOKTOWN"

#### Animations continues (online)
- Scanlines: defilement vertical continu
- Flicker: variations d'intensite aleatoires
- Neons verticaux: pulse opacity magenta (0.7 - 1.0) a 3Hz
- Ecrans: pulse luminosite (0.9 - 1.0) a 2Hz
- Balises sommitales: clignotement

### Utilisation via messages SSE/WebSocket (tower_a)

```json
{
  "event": "sensors",
  "data": {
    "id": "tower-001",
    "status": "online",
    "activity": "fast",
    "towerText": "ALERTE ROUGE"
  }
}
```

### Appel direct (si acces au prefab)

```typescript
const towerPrefab = prefab as TowerAPrefab;
towerPrefab.updateTowerText("NOUVEAU MESSAGE");
```

---

### tower_b

**Tour octogonale avec danseuse holographique style Blade Runner**

- Base octogonale avec anneau neon cyan
- Tour octogonale (3 unites de haut) avec bandes horizontales lumineuses
- Anneau holographique de texte rotatif autour du milieu de la tour
- Danseuse cyborg holographique sur le toit (3 unites de haut)
- Silhouette feminine semi-transparente neon cyan
- Animation de danse sensuelle style club
- Effet de projection holographique avec flicker
- **Occupe 1x1 cellule dans le builder**

**Dimensions:** ~0.8 (diametre) x 6.0 (hauteur avec danseuse) unites

#### Status

| Status | Effet visuel |
|--------|--------------|
| `online` | Aretes neon brillantes (opacity 0.8), anneau texte actif avec rotation, danseuse animee avec flicker holographique |
| `offline` | Aretes attenuees (opacity 0.2), anneau texte attenue (opacity 0.3), danseuse cachee |
| `failure` | Aretes **rouges**, corps avec lueur emissive rouge |

#### Activity

| Activity | Effet |
|----------|-------|
| `slow` | Rotation anneau lente (x0.5), danse lente, defilement texte lent |
| `normal` | Rotation anneau normale (x1.0), danse normale, defilement texte normal |
| `fast` | Rotation anneau rapide (x2.0), danse rapide, defilement texte rapide |

#### TowerBText (propriete specifique tower_b)

Controle le texte affiche sur l'anneau holographique rotatif autour de la tour.

| Propriete | Description |
|-----------|-------------|
| `towerBText` | Texte affiche sur l'anneau holographique central |

**Type:** `string`

**Visuel du texte:**
- Style holographique avec glow cyan
- Defilement horizontal continu
- Scanlines pour effet retro
- Police monospace bold

**Valeur par defaut:** "WHOOKTOWN"

#### DancerEnabled (propriete specifique tower_b)

Controle l'activation/desactivation de la danseuse holographique.

| Propriete | Description |
|-----------|-------------|
| `dancerEnabled` | Active (`true`) ou desactive (`false`) la danseuse holographique |

**Type:** `boolean`

**Valeur par defaut:** `true`

#### Visuel de la danseuse

**Style Blade Runner:**
- Silhouette feminine cyborg semi-transparente
- Couleur cyan neon avec glow
- Opacity variable (0.35-0.45) avec effet flicker
- Hauteur: 3 unites (projection au-dessus du toit)

**Corps:**
- Tete spherique
- Cou et torse anatomiques
- Poitrine proeminente (2 spheres)
- Taille fine
- Hanches arrondies
- Bras et jambes articules
- Cheveux flottants

**Animation de danse:**
- Balancement lateral du corps
- Rotation des hanches sensuelle
- Bras montant au-dessus de la tete
- Mouvement des jambes (transfert de poids)
- Rotation lente sur elle-meme
- Oscillation de la poitrine
- Cheveux qui suivent le mouvement

**Effets holographiques:**
- Flicker aleatoire d'intensite
- Anneau de projection a la base
- Cone de faisceau de projection
- Coeur lumineux interne

#### Animations continues (online)

- Anneau texte: rotation autour de la tour (vitesse selon activity)
- Texte: defilement horizontal (UV offset)
- Danseuse: animation de danse complete (voir ci-dessus)
- Neons verticaux: pulse opacity (0.6 - 0.8) a 3Hz
- Bandes horizontales: pulse opacity (0.5 - 0.7) a 2Hz
- Hologramme: flicker aleatoire (0.35 - 0.45)

### Utilisation via messages SSE/WebSocket (tower_b)

```json
{
  "event": "sensors",
  "data": {
    "id": "towerb-001",
    "status": "online",
    "activity": "normal",
    "towerBText": "BIENVENUE AU CLUB",
    "dancerEnabled": true
  }
}
```

Pour desactiver la danseuse:

```json
{
  "event": "sensors",
  "data": {
    "id": "towerb-001",
    "dancerEnabled": false
  }
}
```

### Appel direct (si acces au prefab)

```typescript
const towerBPrefab = prefab as TowerBPrefab;
towerBPrefab.updateRingText("NOUVEAU MESSAGE");
towerBPrefab.updateDancerEnabled(false); // Desactive la danseuse
```

---

## Resume des comportements par status

### Status: `online`

| Element | Comportement |
|---------|--------------|
| Neons/aretes | Brillants (opacity 0.7-0.9), pulse actif |
| Particules | Visibles et animees |
| Animations | Toutes actives (vitesse selon activity) |
| Couleurs | Normales (cyan, magenta, vert, orange) |

### Status: `offline`

| Element | Comportement |
|---------|--------------|
| Neons/aretes | Tres attenues (opacity 0.1-0.2) |
| Particules | Cachees |
| Animations | Arretees |
| Couleurs | Inchangees mais sombres |

### Status: `failure`

| Element | Comportement |
|---------|--------------|
| Neons/aretes | **Rouges** (pour bank, windmill) ou attenues |
| Corps | Lueur emissive rouge (0x330000) |
| Elements speciaux | Bouclier rouge (bank), coeur rouge (windmill), jaune clignotant (feu) |
| Particules | Cachees (bakery) ou visibles |

---

## Resume des effets par activity

| Activity | Multiplicateur | Usage |
|----------|----------------|-------|
| `slow` | x0.5 | Systeme en veille, faible charge |
| `normal` | x1.0 | Fonctionnement standard |
| `fast` | x2.0 | Haute activite, charge elevee |

**Elements affectes:**
- Rotation (pales windmill, anneaux silo, projecteurs bank)
- Vitesse particules (fumee, flux donnees, spirales)
- Frequence pulse (fenetres, neons)
- Vitesse cycle (feu de circulation)
- Oscillation (plantes, arbres, betail)

---

## Palette de couleurs

| Nom | Hex | Constante | Usage |
|-----|-----|-----------|-------|
| Cyan | `#00ffff` | `COLORS.glow.cyan` | Aretes principales, energie, eau |
| Magenta | `#ff00ff` | `COLORS.glow.magenta` | Accents secondaires, portes |
| Green | `#00ff88` | `COLORS.glow.green` | Vegetation, indicateurs OK, securite |
| Orange | `#ff8800` | `COLORS.glow.orange` | Chaleur, traitement, boulangerie |
| Red | `#ff0044` | `COLORS.glow.red` | Erreurs, alertes, status failure |
| Dark | `#0a0a0f` | `COLORS.building.dark` | Corps des batiments |
| Secondary | `#1a1a2e` | `COLORS.building.secondary` | Panneaux d'accent |
| Metal | `#2a2a3a` | `COLORS.building.metal` | Elements metalliques |

---

## Ajout d'un nouveau type

Pour ajouter un nouveau type de batiment:

1. Creer une classe dans `src/scene/prefabs/NouveauPrefab.ts` qui etend `BasePrefab`
2. Implementer les methodes:
   - `protected build(): void` - construction 3D
   - `protected onStatusChange(status: BuildingStatus): void` - reactions aux status
   - `protected onActivityChange(activity: BuildingActivity): void` - reactions a l'activite
   - `override update(deltaTime: number): void` - animations continues
3. Ajouter le type dans `src/types/index.ts` (optionnel)
4. Ajouter le cas dans `src/scene/prefabs/index.ts`

## Ajout d'un nouveau status

Pour ajouter un nouveau status (ex: `warning`):

1. Ajouter au type dans `src/types/index.ts`:
   ```typescript
   export type BuildingStatus = 'online' | 'offline' | 'failure' | 'warning';
   ```

2. Gerer dans chaque prefab `onStatusChange()`:
   ```typescript
   if (status === 'warning') {
     // Neons orange, pulse rapide, etc.
   }
   ```

## Ajout d'une nouvelle activity

Pour ajouter une nouvelle activity (ex: `critical`):

1. Ajouter au type dans `src/types/index.ts`:
   ```typescript
   export type BuildingActivity = 'slow' | 'normal' | 'fast' | 'critical';
   ```

2. Modifier `getActivitySpeed()` dans `BasePrefab.ts`:
   ```typescript
   protected getActivitySpeed(): number {
     switch (this.activity) {
       case 'slow': return 0.5;
       case 'normal': return 1.0;
       case 'fast': return 2.0;
       case 'critical': return 4.0;
       default: return 1.0;
     }
   }
   ```

## Proprietes specifiques (bank, display_a)

Certains prefabs disposent de proprietes supplementaires:

### Bank

### BankQuantity

Type: `'none' | 'low' | 'medium' | 'full'`

Controle le niveau de stock d'or affiche sur le cote de la banque.

```typescript
// Dans types/index.ts
export type BankQuantity = 'none' | 'low' | 'medium' | 'full';

// Dans SensorData
export interface SensorData {
  id: string;
  status?: BuildingStatus;
  activity?: BuildingActivity;
  quantity?: BankQuantity;  // Specifique bank
  amount?: number;          // Specifique bank
  [key: string]: unknown;
}
```

### Utilisation via messages SSE/WebSocket

Le backend peut envoyer les proprietes `quantity` et `amount` dans les messages sensor:

```json
{
  "event": "sensors",
  "data": {
    "id": "bank-001",
    "status": "online",
    "activity": "normal",
    "quantity": "medium",
    "amount": 1234567
  }
}
```

### Appel direct (si acces au prefab)

```typescript
const bankPrefab = prefab as BankPrefab;
bankPrefab.updateQuantity('full');
bankPrefab.updateAmount(9999999);
```

### DisplayA

#### DisplayRingCount

Type: `2 | 3`

Controle le nombre d'anneaux holographiques sur la tour d'affichage.

```typescript
// Dans types/index.ts
export type DisplayRingCount = 2 | 3;

// Dans SensorData
export interface SensorData {
  id: string;
  status?: BuildingStatus;
  activity?: BuildingActivity;
  ringCount?: DisplayRingCount;  // Specifique display_a
  text1?: string;                // Specifique display_a
  text2?: string;                // Specifique display_a
  text3?: string;                // Specifique display_a
  [key: string]: unknown;
}
```

#### Text1, Text2, Text3

Type: `string`

Texte defilant affiche sur chaque anneau holographique:
- `text1`: Anneau du haut
- `text2`: Anneau du milieu
- `text3`: Anneau du bas (visible uniquement si `ringCount=3`)

### Utilisation via messages SSE/WebSocket (display_a)

```json
{
  "event": "sensors",
  "data": {
    "id": "display-001",
    "status": "online",
    "activity": "fast",
    "ringCount": 3,
    "text1": "ALERTE CPU",
    "text2": "SERVEUR: SRV-042",
    "text3": "TEMP: 78C"
  }
}
```

### Appel direct (si acces au prefab)

```typescript
const displayPrefab = prefab as DisplayAPrefab;
displayPrefab.updateRingCount(2);
displayPrefab.updateText1("NOUVEAU TEXTE");
displayPrefab.updateText2("DEUXIEME LIGNE");
displayPrefab.updateText3("TROISIEME LIGNE");
```

### TowerB

#### TowerBText

Type: `string`

Controle le texte affiche sur l'anneau holographique rotatif de la tour.

#### DancerEnabled

Type: `boolean`

Active ou desactive la danseuse holographique sur le toit de la tour.

```typescript
// Dans types/index.ts
// Dans SensorData
export interface SensorData {
  id: string;
  status?: BuildingStatus;
  activity?: BuildingActivity;
  towerBText?: string;      // Specifique tower_b
  dancerEnabled?: boolean;  // Specifique tower_b
  [key: string]: unknown;
}
```

### Utilisation via messages SSE/WebSocket (tower_b)

```json
{
  "event": "sensors",
  "data": {
    "id": "towerb-001",
    "status": "online",
    "activity": "fast",
    "towerBText": "BIENVENUE",
    "dancerEnabled": true
  }
}
```

### Appel direct (si acces au prefab)

```typescript
const towerBPrefab = prefab as TowerBPrefab;
towerBPrefab.updateRingText("NOUVEAU TEXTE");
towerBPrefab.updateDancerEnabled(false);
```
