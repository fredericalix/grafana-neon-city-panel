# INSTALL — Neon Noodle Bar demo

Guide d'installation, de configuration et d'utilisation de la stack de démo qui met en scène le plugin **whooktown-neoncity-panel** : une application web HA (frontend + backend + PostgreSQL derrière Traefik), supervisée par Prometheus + Grafana avec alerting, et dont chaque conteneur est un bâtiment d'une ville 3D cyberpunk.

---

## 1. Prérequis

| Outil | Version | Vérifier avec |
|---|---|---|
| Docker + Docker Compose v2 | Docker Desktop récent (macOS/Windows) ou Docker Engine + plugin compose (Linux) | `docker compose version` |
| Node.js | ≥ 22 (voir `.nvmrc` à la racine) | `node --version` |
| npm | livré avec Node | `npm --version` |

Ressources conseillées : ~2,5 Go de RAM libres pour Docker (12 conteneurs, limités par `mem_limit`) et ~2 Go de disque pour les images.

Ports utilisés sur la machine hôte (doivent être libres) :

| Port | Service |
|---|---|
| **3001** | Grafana (celui de la démo — le Grafana de dev `npm run server` garde le 3000) |
| **8088** | L'application Noodle Bar, via Traefik (load-balancé) |
| **9090** | Prometheus |
| **8081 / 8082** | backend-1 / backend-2 en accès direct (endpoints chaos) |

## 2. Installation

Tout se passe depuis la racine du dépôt :

```bash
# 1. Builder le plugin — le compose de la démo monte ../dist dans Grafana
npm install
npm run build          # produit dist/ (obligatoire avant le premier lancement)

# 2. Démarrer la stack
cd demo
docker compose up -d --build
```

Le premier lancement télécharge les images (Postgres, Prometheus, Grafana, Traefik, cAdvisor…) et builde les trois images Node (frontend, backend, loadgen) : compter 2 à 5 minutes.

### Vérifier que tout est monté

```bash
docker compose ps          # tous les conteneurs "Up", backends/postgres "healthy"

# L'app répond via Traefik (l'instance change à chaque appel = load-balancing OK)
curl -s localhost:8088/api/menu | head -c 120

# Les séries de la ville existent (11 bâtiments, valeur 100 = online)
curl -s 'localhost:9090/api/v1/query?query=neon:health'

# Grafana est prêt
curl -s localhost:3001/api/health
```

Puis ouvre **http://localhost:3001** : le dashboard « Neon City — Noodle Bar Infra » est la page d'accueil (auth anonyme en Admin, rien à saisir). Laisse-lui quelques secondes de scrapes pour que tous les bâtiments passent online.

## 3. Configuration

La démo fonctionne sans aucune configuration. Ce qui est ajustable :

### Version de Grafana

```bash
GRAFANA_VERSION=13.1.4 docker compose up -d    # défaut : 13.1.4
```

### Intensité du trafic

Dans `docker-compose.yml`, service `loadgen` :

- `BASE_RPS` (défaut `3`) : requêtes/s de base. Le débit réel oscille en sinusoïde de ±50 % sur 4 minutes — c'est ce qui fait varier l'activité et le trafic routier de la ville.
- `TARGET_URL` (défaut `http://traefik`) : cible du générateur.

Après modification : `docker compose up -d loadgen`.

### Le contrat de données ville ↔ Prometheus

Si tu veux adapter la démo à ta propre infra, la chaîne est :

1. **`prometheus/prometheus.yml`** — chaque cible scrapée porte un label `name` **égal au nom du bâtiment** dans le layout du panel, et un label `service` qui regroupe les replicas HA.
2. **`prometheus/rules/neon-city.rules.yml`** — les recording rules `neon:*` calculent tout ce que la ville affiche : `neon:health` (0–100 → online/warning/critical/offline via les seuils 90/70/0), `neon:cpu`, `neon:ram`, `neon:fill`, `neon:amount`, `neon:reqps`, `neon:p95ms`, `neon:errpct`, `neon:band1..3`, `neon:traffic`. C'est le seul endroit où vit du PromQL.
3. **`grafana/provisioning/dashboards/neon-city.json`** — 12 requêtes *instant* en format table + 3 transformations : `filterFieldsByName` (exclut `Time` et `__name__`, sinon le merge ne joint pas les lignes), `merge`, puis `organize` (renomme `Value #A..L` en `value`, `cpu`, `ram`…). Le layout des bâtiments s'édite visuellement dans l'éditeur du panel (options du panel → City Layout).

Pour ajouter un service : scrape-le avec un label `name`, ajoute-le aux recording rules si besoin, puis place un bâtiment du même nom dans le layout.

### Alerting

- Règles : `grafana/provisioning/alerting/rules.yml` (dossier « Neon City », 7 règles).
- Notifications : `contact-points.yml` envoie un webhook à `http://traefik/hooks/alerts` — routé vers les backends survivants, qui loggent `[alert-webhook] firing/resolved: …`. Remplace l'URL par ton Slack/email/etc. pour une vraie intégration.
- Les fichiers d'alerting ne sont relus qu'au démarrage : `docker compose restart grafana` après modification.

## 4. Utilisation

### URLs

| URL | Quoi |
|---|---|
| http://localhost:3001 | Grafana — dashboard ville (home) + « Noodle Bar — Classic Metrics » |
| http://localhost:8088 | L'app : commande des ramens, le feed montre quel backend a servi |
| http://localhost:9090 | Prometheus (Status → Rules pour voir les `neon:*`) |

### Lire la ville

| Bâtiment | Conteneur | Ce qu'il montre |
|---|---|---|
| Écrans géant / petit (`display_a_giant` / `display_a`) | frontend-1 / frontend-2 | text1 = req/s, text2 = p95 ms, text3 = erreurs % |
| Tours jumelles (`tower_a`) | backend-1 / backend-2 | jauges CPU/RAM + req/s, p95, err % |
| Banque (`bank`) | orders (virtuel) | montant = total de commandes |
| Silo (`farm_silo`) | postgres | remplissage = % des slots de connexions |
| Tube (`monitor_tube`) | traefik | bands : req/s edge, 5xx %, connexions |
| Tube géant (`monitor_tube_giant`) | prometheus | bands : cibles up %, ingestion, séries |
| Pyramide (`pyramid`) | grafana | auto-scrapé |
| Moulin (`windmill`) | loadgen | tourne tant que le trafic coule |
| Façade LED (`led_facade`) | cadvisor | source des métriques conteneurs |

Statuts : un conteneur tué → santé 0 → bâtiment **critical** (rouge). Un backend qui sert des 5xx ou devient lent perd des points de santé → **warning** puis **critical**, tout en restant debout. Survole un bâtiment pour le tooltip, clique pour le détail.

### Playbook chaos

Depuis `demo/` (garde le dashboard ouvert à côté) :

| Commande | Effet dans la ville | Alerte (délai ~1–3 min) |
|---|---|---|
| `./chaos.sh kill backend-1` | une tour s'éteint, sa jumelle encaisse tout, l'app reste up | `ReplicaDown` |
| `./chaos.sh kill postgres` | le silo s'éteint, les deux tours se dégradent en cascade | `PostgresDown` puis `HighErrorRate` |
| `./chaos.sh errors [s]` | les tours passent warning → critical sous le trafic | `HighErrorRate` |
| `./chaos.sh slow [s]` | le p95 grimpe sur les écrans des tours | `HighLatency` |
| `./chaos.sh cpu [s]` | la jauge CPU de backend-1 sature | `HighCPU` |
| `./chaos.sh db-flood [n]` | le silo postgres se remplit à vue d'œil | `PgConnectionsHigh` |
| `./chaos.sh restore` | tout redevient cyan, les alertes se résolvent | — |
| `./chaos.sh status` | état des conteneurs + chaos actif sur les backends | — |

Les webhooks d'alerte sont visibles dans `docker compose logs -f backend-1 backend-2` (lignes `[alert-webhook]`).

### Arrêter / nettoyer

```bash
docker compose down        # stoppe la stack (les commandes en base sont conservées)
docker compose down -v     # + supprime le volume Postgres : remise à zéro complète
```

## 5. Dépannage

- **Grafana : « panel not found » ou panel vide au premier écran** — `dist/` manque ou est vieux : `npm run build` à la racine puis recharge la page. Après un rebuild du plugin, le navigateur peut garder l'ancien bundle en cache jusqu'à 1 h (`module.js?_cache=<version>`) : vide le cache ou fais un hard-reload (⌘⇧R).
- **Les bâtiments restent gris/offline alors que Prometheus a les données** — vérifie que les noms de bâtiments du layout correspondent exactement au label `name` des séries (`curl -s 'localhost:9090/api/v1/query?query=neon:health'`), et que le plugin est ≥ cette version du dépôt (le fix de matching des colonnes renommées par transformations est requis).
- **Panels lents à apparaître juste après le démarrage** — contention SQLite de Grafana pendant la première minute (erreurs `database is locked` dans les logs) ; ça se stabilise tout seul.
- **cAdvisor sur macOS / Docker Desktop** — CPU et mémoire fonctionnent (c'est tout ce que la démo utilise) ; certaines métriques filesystem ne remontent pas, c'est attendu.
- **Port déjà pris** — change le port hôte dans `docker-compose.yml` (ex. `3001:3000` → `3002:3000`).
- **La stack de dev en parallèle** — `npm run server` (port 3000) et la démo (port 3001) cohabitent sans conflit ; les conteneurs de la démo sont préfixés `neon-demo-*`.
