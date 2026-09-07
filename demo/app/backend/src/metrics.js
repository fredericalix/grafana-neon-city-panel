import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const ordersTotal = new client.Counter({
  name: 'noodlebar_orders_total',
  help: 'Ramen orders placed',
  registers: [register],
});

export const alertsReceived = new client.Counter({
  name: 'noodlebar_alerts_received_total',
  help: 'Grafana alert webhooks received',
  labelNames: ['status'],
  registers: [register],
});

// Times request handling and counts it; /metrics itself is excluded.
export function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}

export function metricsHandler(_req, res) {
  register
    .metrics()
    .then((body) => res.type(register.contentType).send(body))
    .catch((err) => res.status(500).send(String(err)));
}
