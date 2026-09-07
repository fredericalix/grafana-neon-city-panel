import pg from 'pg';
import client from 'prom-client';
import { register } from './metrics.js';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[db] idle client error:', err.message);
});

new client.Gauge({
  name: 'pg_pool_total_connections',
  help: 'Clients in the pool',
  registers: [register],
  collect() {
    this.set(pool.totalCount);
  },
});

new client.Gauge({
  name: 'pg_pool_idle_connections',
  help: 'Idle clients in the pool',
  registers: [register],
  collect() {
    this.set(pool.idleCount);
  },
});

new client.Gauge({
  name: 'pg_pool_waiting_requests',
  help: 'Queries waiting for a client',
  registers: [register],
  collect() {
    this.set(pool.waitingCount);
  },
});
