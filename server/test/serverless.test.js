/** index.js, the entry point Vercel runs. No database needed: the connection is stubbed. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const request = require('supertest');

process.env.CE_SKIP_DOTENV = '1';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const db = require('../src/config/db');

let connectError = null;
let connectCalls = 0;
db.connectDB = async () => {
  connectCalls += 1;
  if (connectError) throw connectError;
};

const app = require('../index');

test('exports the Express app itself, as Vercel requires', () => {
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');
});

test('connects to the database, then hands the request to the API', async () => {
  connectError = null;
  const before = connectCalls;
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.service, 'ceylon-energy-api');
  assert.equal(connectCalls, before + 1);
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('answers 503 while the database cannot be reached, and recovers', async () => {
  connectError = new Error('connect ECONNREFUSED');
  const down = await request(app).get('/api/projects');
  assert.equal(down.status, 503);
  assert.equal(down.body.ok, false);

  connectError = null;
  const up = await request(app).get('/api/health');
  assert.equal(up.status, 200);
});

test('lists missing settings instead of crashing the function', () => {
  const script = `
    require('supertest')(require('./index.js'))
      .get('/api/health')
      .then((res) => process.stdout.write(JSON.stringify({ status: res.status, body: res.body })));
  `;
  const { MONGODB_URI, JWT_SECRET, ...rest } = process.env;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { ...rest, CE_SKIP_DOTENV: '1', NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const { status, body } = JSON.parse(child.stdout);
  assert.equal(status, 500);
  assert.equal(body.ok, false);
  assert.ok(body.problems.some((p) => p.startsWith('MONGODB_URI is missing')));
  assert.ok(body.problems.some((p) => p.startsWith('JWT_SECRET is missing')));
});
