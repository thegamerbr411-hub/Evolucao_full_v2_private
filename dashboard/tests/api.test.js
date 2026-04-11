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
  process.env.CLIENT_API_KEYS = JSON.stringify({ admin: '123456' });
  process.env.ENABLE_QA_LOCAL_BYPASS = '1';
  const qaClientId = `night-qa-${Date.now()}`;

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

    const log = await httpJson(buildUrl(port, '/api/log'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'content-type': 'application/json',
        'x-api-key': '123456',
      },
      body: JSON.stringify({
        message: 'Network error 500',
        screen: 'Home',
        stack: 'Error: fail\nat node_modules/x.js\nat Home.js:20',
      }),
    });
    assert.equal(log.response.status, 200);
    assert.equal(log.payload.ok, true);

    const event = await httpJson(buildUrl(port, '/api/events'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
      body: JSON.stringify({
        event: 'tap',
        meta: {
          domain: 'navigation',
          id: 'tab-treino',
        },
        screen: 'MainTabs',
      }),
    });
    assert.equal(event.response.status, 200);
    assert.equal(event.payload.ok, true);

    const heatmap = await httpJson(buildUrl(port, '/api/heatmap'), {
      headers: {
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
    });
    assert.equal(heatmap.response.status, 200);
    assert.equal(typeof heatmap.payload, 'object');

    const applyFix = await httpJson(buildUrl(port, '/api/apply-fix'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-qa-client-id': qaClientId,
        'x-qa-local': '1',
      },
      body: JSON.stringify({
        file: 'src/screens/HomeScreen.js',
        change: 'Adicionar loading state no CTA principal',
      }),
    });
    assert.equal(applyFix.response.status, 200);
    assert.equal(applyFix.payload.ok, true);

    const bugs = await httpJson(buildUrl(port, '/api/bugs?limit=5'), {
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'x-api-key': '123456',
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
        authorization: `Bearer ${login.payload.token}`,
        'content-type': 'application/json',
        'x-api-key': '123456',
      },
      body: JSON.stringify([{ message: 'axios undefined network' }]),
    });
    assert.equal(batch.response.status, 200);
    assert.ok(Array.isArray(batch.payload));
    assert.equal(batch.payload[0].suggestion, 'Instale axios ou verifique import');

    const clientToken = await httpJson(buildUrl(port, '/token/client'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${login.payload.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ clientId: 'admin' }),
    });
    assert.equal(clientToken.response.status, 200);
    assert.ok(clientToken.payload.token);

    const insights = await httpJson(buildUrl(port, '/api/insights?limit=5'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(insights.response.status, 200);
    assert.equal(insights.payload.clientId, 'admin');
    assert.ok(Array.isArray(insights.payload.insights));
    assert.ok(insights.payload.insights[0].priorityLabel);

    const retests = await httpJson(buildUrl(port, '/api/retests?limit=5'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(retests.response.status, 200);
    assert.ok(Array.isArray(retests.payload.history));

    const targetBug = Array.isArray(bugs.payload) && bugs.payload.length ? bugs.payload[0] : null;
    assert.ok(targetBug);

    const staleDecision = await httpJson(buildUrl(port, '/api/bug-decision'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fingerprint: targetBug.fingerprint,
        decision: 'resolver',
        expectedStatus: 'inexistente',
        expectedCount: Number(targetBug.count || 0),
      }),
    });
    assert.equal(staleDecision.response.status, 409);
    assert.equal(staleDecision.payload.error, 'stale_bug_state');

    const artifacts = await httpJson(buildUrl(port, '/api/maintenance/artifacts?limit=10'), {
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
      },
    });
    assert.equal(artifacts.response.status, 200);
    assert.equal(artifacts.payload.ok, true);
    assert.ok(Array.isArray(artifacts.payload.folders));
    assert.equal(typeof artifacts.payload.total, 'number');

    const cleanup = await httpJson(buildUrl(port, '/api/maintenance/cleanup'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clientToken.payload.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        retentionDays: 0,
        keepLatestDetox: 3,
      }),
    });
    assert.equal(cleanup.response.status, 200);
    assert.equal(cleanup.payload.ok, true);
    assert.equal(typeof cleanup.payload.bugs, 'object');
    assert.equal(typeof cleanup.payload.detox, 'object');
    assert.ok(cleanup.payload.timestamp);

    console.log('api-test:ok');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error('api-test:fail', error.message);
  process.exit(1);
});
