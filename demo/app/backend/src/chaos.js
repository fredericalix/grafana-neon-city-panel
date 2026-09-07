import pg from 'pg';

// Chaos state machine: every effect auto-reverts when its deadline passes.
const state = {
  errorRate: 0,
  errorsUntil: 0,
  slowMs: 0,
  slowUntil: 0,
  cpuUntil: 0,
  floodClients: [],
  floodUntil: 0,
};

const now = () => Date.now();
const clampSeconds = (value, fallback, max) => {
  const s = Number.parseInt(value, 10);
  return Number.isFinite(s) && s > 0 ? Math.min(s, max) : fallback;
};

export function chaosStatus() {
  return {
    instance: process.env.INSTANCE ?? 'backend',
    errors: state.errorsUntil > now() ? { rate: state.errorRate, remainingSec: Math.round((state.errorsUntil - now()) / 1000) } : null,
    slow: state.slowUntil > now() ? { ms: state.slowMs, remainingSec: Math.round((state.slowUntil - now()) / 1000) } : null,
    cpu: state.cpuUntil > now() ? { remainingSec: Math.round((state.cpuUntil - now()) / 1000) } : null,
    dbFlood: state.floodUntil > now() ? { connections: state.floodClients.length, remainingSec: Math.round((state.floodUntil - now()) / 1000) } : null,
  };
}

export function startErrors(query) {
  const seconds = clampSeconds(query.seconds, 120, 3600);
  const rate = Math.min(Math.max(Number.parseFloat(query.rate) || 0.7, 0), 1);
  state.errorRate = rate;
  state.errorsUntil = now() + seconds * 1000;
  return { chaos: 'errors', rate, seconds };
}

export function startSlow(query) {
  const seconds = clampSeconds(query.seconds, 120, 3600);
  const ms = clampSeconds(query.ms, 900, 10000);
  state.slowMs = ms;
  state.slowUntil = now() + seconds * 1000;
  return { chaos: 'slow', ms, seconds };
}

export function startCpu(query) {
  // Default outlasts the HighCPU alert's "for: 1m" so the demo alert fires.
  const seconds = clampSeconds(query.seconds, 180, 600);
  state.cpuUntil = now() + seconds * 1000;
  burnLoop();
  return { chaos: 'cpu', seconds };
}

// ~80% duty cycle busy loop on the event loop until the deadline.
function burnLoop() {
  if (now() >= state.cpuUntil) {
    return;
  }
  const start = now();
  while (now() - start < 80) {
    Math.sqrt(Math.random());
  }
  setTimeout(burnLoop, 20);
}

export async function startDbFlood(query) {
  const connections = clampSeconds(query.connections, 80, 90);
  const seconds = clampSeconds(query.seconds, 120, 600);
  await stopDbFlood();
  state.floodUntil = now() + seconds * 1000;
  const opened = [];
  for (let i = 0; i < connections; i++) {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await c.connect();
      opened.push(c);
    } catch {
      break; // max_connections reached — keep what we got
    }
  }
  state.floodClients = opened;
  setTimeout(() => {
    if (now() >= state.floodUntil) {
      stopDbFlood();
    }
  }, seconds * 1000 + 100);
  return { chaos: 'db-flood', connections: opened.length, seconds };
}

async function stopDbFlood() {
  const clients = state.floodClients;
  state.floodClients = [];
  state.floodUntil = 0;
  await Promise.allSettled(clients.map((c) => c.end()));
}

export async function resetChaos() {
  state.errorRate = 0;
  state.errorsUntil = 0;
  state.slowMs = 0;
  state.slowUntil = 0;
  state.cpuUntil = 0;
  await stopDbFlood();
  return { chaos: 'reset' };
}

// Applied to /api/* only: inject latency and/or 500s while chaos is active.
export function chaosMiddleware(req, res, next) {
  const proceed = () => {
    if (state.errorsUntil > now() && Math.random() < state.errorRate) {
      return res.status(500).json({ error: 'chaos: synthetic failure', instance: process.env.INSTANCE });
    }
    next();
  };
  if (state.slowUntil > now()) {
    setTimeout(proceed, state.slowMs);
  } else {
    proceed();
  }
}
