import http from 'node:http';
import client from 'prom-client';

const TARGET = process.env.TARGET_URL ?? 'http://traefik';
const BASE_RPS = Number(process.env.BASE_RPS ?? 3);
const PORT = Number(process.env.PORT ?? 8080);

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requestsTotal = new client.Counter({
  name: 'loadgen_requests_total',
  help: 'Requests sent by the load generator',
  labelNames: ['target', 'outcome'],
  registers: [register],
});

const currentRps = new client.Gauge({
  name: 'loadgen_current_rps',
  help: 'Current target requests per second',
  registers: [register],
});

// Weighted traffic mix: mostly reads, ~1 in 6 places an order.
const ACTIONS = [
  { name: 'home', weight: 3, run: () => fetch(`${TARGET}/`) },
  { name: 'menu', weight: 3, run: () => fetch(`${TARGET}/api/menu`) },
  { name: 'orders-list', weight: 2, run: () => fetch(`${TARGET}/api/orders?limit=10`) },
  {
    name: 'order',
    weight: 2,
    run: () =>
      fetch(`${TARGET}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: 1 + Math.floor(Math.random() * 7), quantity: 1 + Math.floor(Math.random() * 3) }),
      }),
  },
];

const totalWeight = ACTIONS.reduce((sum, a) => sum + a.weight, 0);

function pickAction() {
  let roll = Math.random() * totalWeight;
  for (const action of ACTIONS) {
    roll -= action.weight;
    if (roll <= 0) {
      return action;
    }
  }
  return ACTIONS[0];
}

async function fire() {
  const action = pickAction();
  try {
    const res = await action.run();
    requestsTotal.inc({ target: action.name, outcome: res.ok ? 'ok' : `http_${res.status}` });
  } catch {
    requestsTotal.inc({ target: action.name, outcome: 'network_error' });
  }
}

// RPS breathes on a 4-minute sine wave (±50%) with jitter, so city traffic varies.
function tick() {
  const t = Date.now() / 1000;
  const rps = Math.max(0.2, BASE_RPS * (1 + 0.5 * Math.sin((2 * Math.PI * t) / 240)) + (Math.random() - 0.5));
  currentRps.set(Math.round(rps * 10) / 10);
  const delayMs = 1000 / rps;
  fire();
  setTimeout(tick, delayMs);
}

http
  .createServer((req, res) => {
    if (req.url === '/metrics') {
      register.metrics().then((body) => {
        res.writeHead(200, { 'Content-Type': register.contentType });
        res.end(body);
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', target: TARGET }));
    }
  })
  .listen(PORT, () => console.log(`[loadgen] hitting ${TARGET}, metrics on :${PORT}`));

tick();
