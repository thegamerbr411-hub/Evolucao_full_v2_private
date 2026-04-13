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
  process.env.ENABLE_QA_LOCAL_BYPASS = process.env.ENABLE_QA_LOCAL_BYPASS || '1';
  const qaClientId = `smoke-local-${Date.now()}`;

  const server = startServer(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await httpJson(`${base}/health`);
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.status, 'ok');
    assert.equal(typeof health.payload.uptime, 'number');
    assert.equal(typeof health.payload.timestamp, 'string');

    const qaHeaders = {
      'content-type': 'application/json',
      'x-qa-client-id': qaClientId,
      'x-qa-local': '1',
    };

    const log = await httpJson(`${base}/api/log`, {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify({
        message: 'smoke network error',
        screen: 'smoke-screen',
        stack: 'Error: smoke',
      }),
    });
    assert.equal(log.response.status, 200);

    const event = await httpJson(`${base}/api/events`, {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify({
        event: 'tap',
        screen: 'MainTabs',
        meta: {
          domain: 'navigation',
          id: 'tab-home',
        },
      }),
    });
    assert.equal(event.response.status, 200);

    const events = await httpJson(`${base}/api/events?limit=10`, {
      headers: {
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
    });
    assert.equal(events.response.status, 200);
    assert.ok(Array.isArray(events.payload));
    assert.ok(events.payload.length >= 1);

    const heatmap = await httpJson(`${base}/api/heatmap`, {
      headers: {
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
    });
    assert.equal(heatmap.response.status, 200);
    assert.equal(heatmap.payload['tab-home'], 1);

    const applyFix = await httpJson(`${base}/api/apply-fix`, {
      method: 'POST',
      headers: qaHeaders,
      body: JSON.stringify({
        file: 'src/screens/HomeScreen.js',
        change: 'Garantir loading state no CTA da home',
      }),
    });
    assert.equal(applyFix.response.status, 200);

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

    const bugs = await httpJson(`${base}/api/bugs?limit=5`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-key': '123456',
      },
    });
    assert.equal(bugs.response.status, 200);
    assert.ok(Array.isArray(bugs.payload));

    const clientToken = await httpJson(`${base}/token/client`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'admin' }),
    });
    assert.equal(clientToken.response.status, 200);

    const insights = await httpJson(`${base}/api/insights?limit=5`, {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(insights.response.status, 200);
    assert.ok(Array.isArray(insights.payload.insights));

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
