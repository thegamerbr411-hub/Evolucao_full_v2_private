const assert = require('node:assert/strict');
const { startServer } = require('../server');

function buildUrl(port, route) {
  return `http://127.0.0.1:${port}${route}`;
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { payload, response };
}

async function run() {
  process.env.ADMIN_USER = 'admin';
  process.env.ADMIN_PASS = 'pass123';
  process.env.JWT_SECRET = 'test-secret';

  const server = startServer(0);
  const port = server.address().port;

  try {
    const login = await httpJson(buildUrl(port, '/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', pass: 'pass123' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.payload.ok, true);
    assert.ok(login.payload.token);

    const clientToken = await httpJson(buildUrl(port, '/token/client'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${login.payload.token}`,
      },
      body: JSON.stringify({ clientId: 'tenant-a' }),
    });
    assert.equal(clientToken.response.status, 200);
    assert.equal(clientToken.payload.ok, true);
    assert.ok(clientToken.payload.token);

    const log = await httpJson(buildUrl(port, '/api/log'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'content-type': 'application/json',
        'x-client-id': 'tenant-a',
      },
      body: JSON.stringify({
        message: 'Network error 500',
        screen: 'Home',
        stack: 'Error: fail\nat node_modules/x.js\nat Home.js:20',
      }),
    });
    assert.equal(log.response.status, 201);

    const bugs = await httpJson(buildUrl(port, '/api/bugs?limit=5'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'x-client-id': 'tenant-a',
      },
    });
    assert.equal(bugs.response.status, 200);
    assert.ok(Array.isArray(bugs.payload));
    assert.ok(bugs.payload.length >= 1);
    assert.equal(bugs.payload[0].severity, 'HIGH');
    assert.equal(String(bugs.payload[0].stack || '').includes('node_modules'), false);

    const batch = await httpJson(buildUrl(port, '/api/analyze-batch'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'content-type': 'application/json',
        'x-client-id': 'tenant-a',
      },
      body: JSON.stringify([{ message: 'axios undefined network' }]),
    });
    assert.equal(batch.response.status, 200);
    assert.ok(Array.isArray(batch.payload));
    assert.equal(batch.payload[0].suggestion, 'Instale axios ou verifique import');

    console.log('api-test:ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error('api-test:fail', error.message);
  process.exit(1);
});
