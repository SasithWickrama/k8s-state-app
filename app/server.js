const express = require('express');
const { Pool } = require('pg');
const os = require('os');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'appdb',
  max: 5,
  connectionTimeoutMillis: 3000,
});
pool.on('error', (e) => console.error('pool error:', e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The app owns its schema; retry until the primary is reachable.
async function ensureSchema() {
  for (;;) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id         INT PRIMARY KEY,
          enabled    BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query(
        'INSERT INTO app_state (id, enabled) VALUES (1, FALSE) ON CONFLICT (id) DO NOTHING'
      );
      console.log('schema ready');
      return;
    } catch (e) {
      console.log('waiting for database:', e.message);
      await sleep(3000);
    }
  }
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT enabled, updated_at FROM app_state WHERE id = 1');
    res.json({ ...rows[0], pod: os.hostname() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/toggle', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE app_state SET enabled = NOT enabled, updated_at = now() WHERE id = 1 RETURNING enabled, updated_at'
    );
    res.json({ ...rows[0], pod: os.hostname() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
  process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));
});
