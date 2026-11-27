const express = require('express');
const { Pool, Client } = require('pg');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const DB = {
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'appdb',
};

// Writes (and normal reads) go to the primary.
const pool = new Pool({
  ...DB,
  host: process.env.DB_HOST || 'localhost',
  max: 5,
  connectionTimeoutMillis: 3000,
  query_timeout: 4000,
});
pool.on('error', (e) => console.error('pool error:', e.message));

// Read-only fallback: the postgres-read service only routes to Ready pods,
// so when the primary is down it reaches the replica.
const readPool = new Pool({
  ...DB,
  host: process.env.DB_READ_HOST || 'postgres-read',
  max: 2,
  connectionTimeoutMillis: 2000,
  query_timeout: 3000,
});
readPool.on('error', (e) => console.error('read pool error:', e.message));

// Pods shown on the status panel, and the headless service used for DNS
// when the Kubernetes API is not available.
const PODS = (process.env.DB_PODS || 'postgres-0,postgres-1').split(',');
const HEADLESS = process.env.DB_HEADLESS || 'postgres-headless';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- schema
async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id         INT PRIMARY KEY,
      enabled    BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await pool.query(
    'INSERT INTO app_state (id, enabled) VALUES (1, FALSE) ON CONFLICT (id) DO NOTHING'
  );
}

// The app owns its schema; retry until the primary is reachable.
async function ensureSchema() {
  for (;;) {
    try {
      await createSchema();
      console.log('schema ready');
      return;
    } catch (e) {
      console.log('waiting for database:', e.message);
      await sleep(3000);
    }
  }
}

// Run a query on the primary. If the table vanished (database was recreated
// while the app kept running), recreate it once and retry.
async function q(sql, params) {
  try {
    return await pool.query(sql, params);
  } catch (e) {
    if (e.code === '42P01') {
      await createSchema();
      return pool.query(sql, params);
    }
    throw e;
  }
}

// ------------------------------------------------------- database status
const SA_DIR = '/var/run/secrets/kubernetes.io/serviceaccount';

// Pod list from the Kubernetes API. Resolves to null when the API is not
// reachable or the service account has no permission (status then falls
// back to DNS + direct probes only).
function k8sPods() {
  return new Promise((resolve) => {
    let token, ca, ns;
    try {
      token = fs.readFileSync(`${SA_DIR}/token`, 'utf8');
      ca = fs.readFileSync(`${SA_DIR}/ca.crt`);
      ns = fs.readFileSync(`${SA_DIR}/namespace`, 'utf8').trim();
    } catch {
      return resolve(null);
    }
    const req = https.request(
      {
        host: process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc',
        port: Number(process.env.KUBERNETES_SERVICE_PORT || 443),
        path: `/api/v1/namespaces/${ns}/pods?labelSelector=app%3Dpostgres`,
        headers: { Authorization: `Bearer ${token}` },
        ca,
        timeout: 2000,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(body).items);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}

function podInfo(p) {
  const cs = (p.status.containerStatuses || [])[0] || {};
  const st = cs.state || {};
  return {
    phase: p.status.phase,
    ip: p.status.podIP || null,
    ready: !!cs.ready,
    restarts: cs.restartCount || 0,
    terminating: !!p.metadata.deletionTimestamp,
    reason: (st.waiting && st.waiting.reason) || (st.terminated && st.terminated.reason) || null,
  };
}

// Connect straight to one Postgres pod and ask it a few questions.
async function probe(host) {
  const c = new Client({
    ...DB,
    host,
    connectionTimeoutMillis: 1500,
    query_timeout: 2000,
  });
  c.on('error', () => {});
  let connected = false;
  const t0 = Date.now();
  try {
    await c.connect();
    connected = true;
    const r = await c.query('SELECT pg_is_in_recovery() AS replica');
    const out = { ok: true, ms: Date.now() - t0, role: r.rows[0].replica ? 'replica' : 'primary' };
    try {
      const d = await c.query('SELECT enabled FROM app_state WHERE id = 1');
      if (d.rows[0]) out.enabled = d.rows[0].enabled;
    } catch {}
    if (out.role === 'primary') {
      try {
        const s = await c.query("SELECT count(*)::int AS n FROM pg_stat_replication WHERE state = 'streaming'");
        out.streaming = s.rows[0].n;
      } catch {}
    }
    return out;
  } catch (e) {
    return { ok: false, code: e.code, error: e.message };
  } finally {
    if (connected) c.end().catch(() => {});
  }
}

// Turn what Kubernetes and the probe told us into one of:
// working | restarting | down | unreachable
function derive(k8sOk, k, pr) {
  if (k8sOk && !k) return ['down', 'Pod does not exist (scaled down or deleted)'];
  if (k) {
    if (k.terminating) return ['restarting', 'Pod is shutting down'];
    if (['CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull', 'CreateContainerConfigError'].includes(k.reason))
      return ['down', k.reason];
    if (k.phase === 'Failed') return ['down', 'Pod failed'];
    if (k.phase === 'Pending' || ['ContainerCreating', 'PodInitializing'].includes(k.reason))
      return ['restarting', k.reason || 'Pod is starting'];
  }
  if (pr.ok) return ['working', k && !k.ready ? 'Answering, not marked ready yet' : 'Accepting connections'];
  if (pr.code === '57P03') return ['restarting', 'Database is starting up'];
  if (k && !k.ready) return ['restarting', 'Pod is up, database not ready yet'];
  if (!k && pr.code === 'ENOTFOUND') return ['down', 'Pod not found in DNS'];
  return ['unreachable', pr.error || 'No response'];
}

async function computeStatus() {
  const items = await k8sPods();
  const byName = items ? Object.fromEntries(items.map((p) => [p.metadata.name, p])) : null;
  const nodes = await Promise.all(
    PODS.map(async (name) => {
      const p = byName ? byName[name] : undefined;
      const k = p ? podInfo(p) : null;
      const host = k ? k.ip : byName ? null : `${name}.${HEADLESS}`;
      const pr = host ? await probe(host) : { ok: false, error: 'No address' };
      const [status, detail] = derive(byName !== null, k, pr);
      return {
        name,
        expectedRole: name.endsWith('-0') ? 'primary' : 'replica',
        status,
        detail,
        role: pr.role || null,
        restarts: k ? k.restarts : null,
        enabled: pr.enabled === undefined ? null : pr.enabled,
        streaming: pr.streaming === undefined ? null : pr.streaming,
        latencyMs: pr.ok ? pr.ms : null,
      };
    })
  );
  return { nodes, k8s: byName !== null, checkedAt: new Date().toISOString(), servedBy: os.hostname() };
}

// Share one result between all viewers for a moment so polling stays cheap.
let cache = { t: 0, v: null, p: null };
function getStatus() {
  if (cache.v && Date.now() - cache.t < 1500) return Promise.resolve(cache.v);
  if (cache.p) return cache.p;
  cache.p = computeStatus().then((v) => {
    cache = { t: Date.now(), v, p: null };
    return v;
  });
  return cache.p;
}

// ------------------------------------------------------------------ app
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const STATE_SQL = 'SELECT enabled, updated_at FROM app_state WHERE id = 1';

app.get('/api/state', async (_req, res) => {
  try {
    const { rows } = await q(STATE_SQL);
    res.json({ ...rows[0], pod: os.hostname(), readOnly: false });
  } catch (e) {
    try {
      const { rows } = await readPool.query(STATE_SQL);
      if (rows[0]) return res.json({ ...rows[0], pod: os.hostname(), readOnly: true });
    } catch {}
    res.status(503).json({ error: e.message });
  }
});

app.post('/api/toggle', async (_req, res) => {
  try {
    const { rows } = await q(
      'UPDATE app_state SET enabled = NOT enabled, updated_at = now() WHERE id = 1 RETURNING enabled, updated_at'
    );
    res.json({ ...rows[0], pod: os.hostname(), readOnly: false });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

app.get('/api/status', async (_req, res) => {
  try {
    res.json(await getStatus());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Liveness: process is up. Deliberately does NOT touch the database,
// so a DB outage never causes Kubernetes to restart the frontend pods.
app.get('/livez', (_req, res) => res.send('ok'));

// Readiness: only receive traffic when the database is reachable.
app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send('ok');
  } catch (e) {
    res.status(503).send('db unavailable');
  }
});

const port = Number(process.env.PORT || 3000);
ensureSchema().then(() => {
  const server = app.listen(port, () => console.log(`listening on ${port}`));
  process.on('SIGTERM', () =>
    server.close(() => Promise.all([pool.end(), readPool.end()]).then(() => process.exit(0)))
  );
});
