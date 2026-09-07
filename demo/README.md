# Neon Noodle Bar — demo stack for the Neon City panel

A self-contained docker-compose demo: a small HA web application (frontend + backend + PostgreSQL behind Traefik), monitored by Prometheus + Grafana with alerting — and the whole infrastructure rendered live as a cyberpunk 3D city by the **whooktown-neoncity-panel** plugin. Every container is a building; incidents turn buildings red and fire Grafana alerts.

```
                       ┌────────────┐
        loadgen ──────▶│  traefik   │:8088          Grafana :3001 ── neon-city panel
     (sinusoidal RPS)  │ (HA LB v3) │               Prometheus :9090
                       └─────┬──────┘                     ▲
                   /         │        \ /api              │ scrape (5s)
            ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
            │frontend-1│ │frontend-2│ │backend-1 │ │backend-2 │ ...all services
            └──────────┘ └──────────┘ └────┬─────┘ └────┬─────┘
                                           └─────┬──────┘
                                           ┌─────▼─────┐   ┌───────────────────┐
                                           │ postgres  │◀──│ postgres-exporter │
                                           └───────────┘   └───────────────────┘
                                           + cadvisor (container CPU/RAM)
```

## Buildings ↔ containers

| Building (type) | Container | Live data shown |
|---|---|---|
| `display_a_giant` / `display_a` | frontend-1 / frontend-2 | text1=req/s · text2=p95 ms · text3=err % |
| `tower_a` ×2 (twin towers) | backend-1 / backend-2 | CPU/RAM gauges, req/s, p95, err % |
| `bank` | *orders* (virtual) | amount = total ramen orders |
| `farm_silo` | postgres | fill = % of connection slots used |
| `monitor_tube` | traefik | bands: edge req/s · 5xx % · connections |
| `monitor_tube_giant` | prometheus | bands: targets up % · ingest rate · series |
| `pyramid` | grafana | self-scraped |
| `windmill` | loadgen | spins while traffic flows |
| `led_facade` | cadvisor | container-metrics source |

Status comes from the `neon:health` recording rule (0–100): a killed container drops to 0 (**critical**, dark building), sustained 5xx or slow p95 drops backends to 45–80 (**warning/critical**). Road traffic density follows the real HTTP request rate.

## Run it

> Full install/configuration/usage guide (français) : [INSTALL.md](INSTALL.md)

```bash
# 1. Build the plugin once (the compose mounts ../dist into Grafana)
npm install && npm run build        # at the repo root

# 2. Start the stack
cd demo
docker compose up -d --build
```

| URL | What |
|---|---|
| http://localhost:3001 | **Grafana** (anonymous admin) — home = the Neon City dashboard |
| http://localhost:8088 | Neon Noodle Bar app (via Traefik, HA load-balanced) |
| http://localhost:9090 | Prometheus (check `neon:*` recording rules) |
| http://localhost:8081 / 8082 | backend-1 / backend-2 direct (chaos endpoints) |

The dev stack (`npm run server`, port 3000) is untouched and can run at the same time.

## Chaos playbook

Trigger incidents and watch the city + the provisioned Grafana alerts (folder **Neon City**, webhook delivered to backend-1 `/hooks/alerts`):

| Command | What you see in the city | Alert |
|---|---|---|
| `./chaos.sh kill backend-1` | one twin tower goes dark, its sibling keeps serving — the app stays up (HA) | `ReplicaDown` |
| `./chaos.sh kill postgres` | the silo goes dark, both backend towers degrade (orders fail) | `PostgresDown`, then `HighErrorRate` |
| `./chaos.sh errors` | backend towers glow warning → critical while traffic keeps flowing | `HighErrorRate` |
| `./chaos.sh slow` | p95 text climbs on the towers | `HighLatency` |
| `./chaos.sh cpu` | backend-1's CPU gauge maxes out | `HighCPU` |
| `./chaos.sh db-flood` | the postgres silo visibly fills up | `PgConnectionsHigh` |
| `./chaos.sh restore` | the whole city returns to cyan | alerts resolve |

`./chaos.sh status` shows container + chaos state.

## How the data reaches the city

1. Every Prometheus scrape target carries a `name` label equal to its building name in the panel layout (`demo/prometheus/prometheus.yml`).
2. Recording rules (`demo/prometheus/rules/neon-city.rules.yml`) compute all city series: `neon:health`, `neon:cpu`, `neon:ram`, `neon:fill`, `neon:amount`, `neon:reqps`, `neon:p95ms`, `neon:errpct`, `neon:band1..3`, `neon:traffic`.
3. The dashboard (`demo/grafana/provisioning/dashboards/neon-city.json`) runs one instant table query per series and chains three transformations — `filterFieldsByName` (drops `Time` and `__name__` so rows can join), `merge`, then `organize` (renames `Value #A..L` to the plugin's columns) — to produce the plugin's table format (`name, value, cpu, ram, fill, amount, text1..3, band1..3, traffic`).

To adapt this to your own infra: relabel your targets with `name`, reuse the recording rules, and edit the panel layout in the plugin's visual layout editor.

## Notes

- **Grafana version**: `${GRAFANA_VERSION:-13.1.4}` (same as the dev stack).
- **cAdvisor on macOS / Docker Desktop**: CPU and working-set memory work; some filesystem metrics don't. The demo only uses CPU + memory.
- Data is ephemeral except Postgres (`pgdata` volume). `docker compose down -v` wipes everything.
