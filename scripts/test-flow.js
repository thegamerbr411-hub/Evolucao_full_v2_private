const axios = require('axios');
const { startServer } = require('../dashboard/server');

const DEFAULT_BASE = 'http://127.0.0.1:3000';
const BASE = process.env.BASE_URL || DEFAULT_BASE;
const QA_CLIENT_ID = process.env.QA_CLIENT_ID || 'night-local';

function buildQaHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-qa-local': '1',
    'x-qa-client-id': QA_CLIENT_ID,
    ...extra,
  };
}

async function canReach(baseUrl) {
  try {
    const response = await axios.get(`${baseUrl}/health`, { timeout: 1500 });
    return response?.data?.status === 'ok';
  } catch {
    return false;
  }
}

async function createServerFallback(baseUrl) {
  if (process.env.BASE_URL || baseUrl !== DEFAULT_BASE) {
    return { baseUrl, server: null };
  }

  const server = startServer(0);
  const port = server.address()?.port || 3000;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    server,
  };
}

async function run() {
  let fallbackServer = null;

  try {
    const resolved = await createServerFallback(BASE);
    const activeBase = resolved.baseUrl;
    fallbackServer = resolved.server;

    const health = await axios.get(`${activeBase}/health`);
    if (health.data?.status !== 'ok' || health.data?.service !== 'qa-dashboard-local') {
      throw new Error('healthcheck_failed');
    }
    console.log('smoke flow: health ok');

    const log = await axios.post(
      `${activeBase}/api/log`,
      {
        message: 'qa smoke log',
        screen: 'SmokeFlow',
        stack: 'Error: qa smoke',
        synthetic: true,
        syntheticTag: 'qa_smoke',
        syntheticReason: 'qa_validation_signal',
      },
      {
        headers: buildQaHeaders(),
      }
    );
    if (!log.data?.ok) {
      throw new Error('log_failed');
    }
    console.log('smoke flow: api/log ok');

    const event = await axios.post(
      `${activeBase}/api/events`,
      {
        event: 'tap',
        screen: 'MainTabs',
        meta: {
          domain: 'navigation',
          id: 'tab-home',
        },
      },
      {
        headers: buildQaHeaders(),
      }
    );
    if (!event.data?.ok) {
      throw new Error('event_failed');
    }
    console.log('smoke flow: api/events ok');

    const heatmap = await axios.get(`${activeBase}/api/heatmap`, {
      headers: buildQaHeaders(),
    });
    if (typeof heatmap.data?.['tab-home'] !== 'number') {
      throw new Error('heatmap_failed');
    }
    console.log('smoke flow: api/heatmap ok');

    const applyFix = await axios.post(
      `${activeBase}/api/apply-fix`,
      {
        file: 'src/screens/HomeScreen.js',
        change: 'Revisar CTA dinamico da home',
      },
      {
        headers: buildQaHeaders(),
      }
    );
    if (!applyFix.data?.ok) {
      throw new Error('apply_fix_failed');
    }
    console.log('smoke flow: api/apply-fix ok');

    const insights = await axios.get(`${activeBase}/api/insights?limit=5`, {
      headers: buildQaHeaders(),
    });

    if (!Array.isArray(insights.data?.insights)) {
      throw new Error('invalid_insights_response');
    }

    console.log('smoke flow: api/insights ok');
    console.log('test-flow:ok');
  } catch (error) {
    const details = error?.response?.data || error.message;
    console.error('test-flow:fail', details);
    process.exitCode = 1;
  } finally {
    if (fallbackServer) {
      await new Promise((resolve) => fallbackServer.close(resolve));
    }
  }
}

run();
