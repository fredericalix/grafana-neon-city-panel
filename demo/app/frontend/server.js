import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import client from 'prom-client';

const app = express();
const INSTANCE = process.env.INSTANCE ?? 'frontend';
const PORT = Number(process.env.PORT ?? 8080);
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

app.use((req, res, next) => {
  if (req.path === '/metrics') {
    return next();
  }
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: req.path, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
});

// /api is routed to the backends by Traefik, never reaches this server.
app.use(express.static(publicDir));

app.get('/healthz', (_req, res) => res.json({ status: 'ok', instance: INSTANCE }));

app.get('/whoami', (_req, res) => res.json({ instance: INSTANCE }));

app.get('/metrics', (_req, res) => {
  register
    .metrics()
    .then((body) => res.type(register.contentType).send(body))
    .catch((err) => res.status(500).send(String(err)));
});

app.listen(PORT, () => {
  console.log(`[frontend] ${INSTANCE} listening on :${PORT}`);
});
