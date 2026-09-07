import express from 'express';
import { pool } from './db.js';
import { metricsMiddleware, metricsHandler, ordersTotal, alertsReceived } from './metrics.js';
import { chaosMiddleware, chaosStatus, startErrors, startSlow, startCpu, startDbFlood, resetChaos } from './chaos.js';

const app = express();
const INSTANCE = process.env.INSTANCE ?? 'backend';
const PORT = Number(process.env.PORT ?? 8080);

// Express 4 does not catch rejected promises from async handlers — route DB
// failures to the error middleware (500) instead of hanging the request.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.use(express.json());
app.use(metricsMiddleware);
app.use('/api', chaosMiddleware);

app.get('/api/menu', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, price_cents FROM menu ORDER BY id');
  res.json({ instance: INSTANCE, menu: rows });
}));

app.post('/api/orders', wrap(async (req, res) => {
  const itemId = Number.parseInt(req.body?.itemId, 10);
  const quantity = Math.min(Math.max(Number.parseInt(req.body?.quantity, 10) || 1, 1), 10);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ error: 'itemId required', instance: INSTANCE });
  }
  const { rows } = await pool.query(
    'INSERT INTO orders (item_id, quantity, served_by) VALUES ($1, $2, $3) RETURNING id, created_at',
    [itemId, quantity, INSTANCE]
  );
  ordersTotal.inc();
  res.status(201).json({ instance: INSTANCE, order: rows[0] });
}));

app.get('/api/orders', wrap(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const { rows } = await pool.query(
    `SELECT o.id, m.name, o.quantity, o.served_by, o.created_at
     FROM orders o JOIN menu m ON m.id = o.item_id
     ORDER BY o.created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ instance: INSTANCE, orders: rows });
}));

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', instance: INSTANCE });
  } catch (err) {
    res.status(503).json({ status: 'db unreachable', instance: INSTANCE, error: err.message });
  }
});

app.get('/metrics', metricsHandler);

// Chaos control plane (used by demo/chaos.sh)
app.post('/chaos/errors', (req, res) => res.json(startErrors(req.query)));
app.post('/chaos/slow', (req, res) => res.json(startSlow(req.query)));
app.post('/chaos/cpu', (req, res) => res.json(startCpu(req.query)));
app.post('/chaos/db-flood', async (req, res) => res.json(await startDbFlood(req.query)));
app.post('/chaos/reset', async (_req, res) => res.json(await resetChaos()));
app.get('/chaos/status', (_req, res) => res.json(chaosStatus()));

// Grafana alerting webhook contact point
app.post('/hooks/alerts', (req, res) => {
  const status = req.body?.status ?? 'unknown';
  alertsReceived.inc({ status });
  for (const alert of req.body?.alerts ?? []) {
    console.log(`[alert-webhook] ${alert.status}: ${alert.labels?.alertname} (${alert.labels?.name ?? '-'})`);
  }
  res.json({ received: true });
});

app.use((err, _req, res, _next) => {
  console.error('[backend] error:', err.message);
  res.status(500).json({ error: err.message, instance: INSTANCE });
});

app.listen(PORT, () => {
  console.log(`[backend] ${INSTANCE} listening on :${PORT}`);
});
