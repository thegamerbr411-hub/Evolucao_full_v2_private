const assert = require('node:assert/strict');
const { startServer } = require('../server');

async function httpJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { payload, response };
}

async function run() {
  process.env.ADMIN_USER = process.env.ADMIN_USER || 'admin';
  process.env.ADMIN_PASS = process.env.ADMIN_PASS || 'pass123';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-secret';
  process.env.CLIENT_API_KEYS = process.env.CLIENT_API_KEYS || JSON.stringify({ admin: '123456' });

  const server = startServer(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await httpJson(`${base}/health`);
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.status, 'ok');
    assert.equal(typeof health.payload.uptime, 'number');
    assert.equal(typeof health.payload.timestamp, 'string');

    const login = await httpJson(`${base}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: process.env.ADMIN_USER, pass: process.env.ADMIN_PASS }),
    });
    assert.equal(login.response.status, 200);

    const token = login.payload.token;
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-api-key': '123456',
    };

    const log = await httpJson(`${base}/api/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'smoke network error',
        screen: 'smoke-screen',
        stack: 'Error: smoke',
      }),
    });
    assert.equal(log.response.status, 200);

    const bugs = await httpJson(`${base}/api/bugs?limit=5`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-key': '123456',
      },
    });
    assert.equal(bugs.response.status, 200);
    assert.ok(Array.isArray(bugs.payload));

    const batch = await httpJson(`${base}/api/analyze-batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ message: 'axios failed' }]),
    });
    assert.equal(batch.response.status, 200);
    assert.ok(Array.isArray(batch.payload));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .then(() => {
    console.log('smoke-test:ok');
  })
  .catch((error) => {
    console.error('smoke-test:fail', error.message);
    process.exit(1);
  });
