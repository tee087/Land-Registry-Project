import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Set env BEFORE the app is imported (static imports are hoisted, so use dynamic import).
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
const { default: app } = await import('../src/app.js');
const { sequelize } = await import('../src/config/database.js');

after(async () => {
  await sequelize.close();
});

test('GET /api/health returns the standard envelope (200 if DB up, 503 if down)', async () => {
  const res = await request(app).get('/api/health');
  assert.ok([200, 503].includes(res.status));
  assert.equal(typeof res.body.success, 'boolean');
  assert.ok(res.body.requestId);
  assert.ok(res.body.timestamp);
  const info = res.status === 200 ? res.body.data : res.body.error.details;
  assert.equal(info.service, 'land-registry-backend');
  assert.ok(['up', 'down'].includes(info.checks.database));
});

test('unknown routes return a structured 404', async () => {
  const res = await request(app).get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
});

test('liveness endpoint does not depend on the database', async () => {
  const res = await request(app).get('/api/health/live');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'ok');
});

test('protected registry endpoints require authentication', async () => {
  for (const path of ['/api/parcels', '/api/parcels/search?q=TEST', '/api/audit-logs', '/api/notifications']) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, `${path} should require auth`);
    assert.equal(res.body.error.code, 'AUTHENTICATION_REQUIRED');
  }
});

test('malformed JSON returns 400, not a stack trace', async () => {
  const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{bad json');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_JSON');
  assert.equal(res.body.error.details, undefined);
});

test('oversized bodies are rejected with 413', async () => {
  const big = JSON.stringify({ blob: 'x'.repeat(2 * 1024 * 1024) });
  const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send(big);
  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('security headers are set and X-Powered-By is hidden', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.ok(res.headers['x-request-id']);
});

test('CORS allows approved origins', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
});

test('CORS blocks unapproved origins', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CORS_FORBIDDEN');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('bad URL encoding returns 400, not 500', async () => {
  const res = await request(app).get('/api/%E0%A4%A');
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});
