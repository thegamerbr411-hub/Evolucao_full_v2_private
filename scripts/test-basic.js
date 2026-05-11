const { spawn } = require('child_process');

const PORT = 3201;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function waitServerReady(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const health = await request('/health');
      if (health.status === 200 && health.data?.ok === true) return true;
    } catch {
      // no-op
    }
    await wait(150);
  }
  return false;
}

function expectStatus(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}_expected_${expected}_got_${actual}`);
  }
}

async function run() {
  const backend = spawn('node', ['backend/server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(PORT),
      JWT_SECRET: process.env.JWT_SECRET || 'basic-test-secret',
      ENABLE_QA_ENDPOINTS: '0',
    },
  });

  let cleaningUp = false;
  const cleanup = async () => {
    if (cleaningUp || backend.killed) return;
    cleaningUp = true;

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          if (!backend.killed) backend.kill('SIGKILL');
        } catch {
          // best effort
        }
        resolve();
      }, 2000);

      backend.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });

      try {
        backend.kill('SIGTERM');
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  };

  try {
    const ready = await waitServerReady();
    if (!ready) throw new Error('backend_not_ready');

    const health = await request('/health');
    expectStatus(health.status, 200, 'health');

    const healthApi = await request('/api/health');
    expectStatus(healthApi.status, 200, 'api_health');

    const loginPassword = await request('/auth/login-password', {
      method: 'POST',
      body: {},
    });
    expectStatus(loginPassword.status, 400, 'auth_login_password_validation');

    const loginPasswordApi = await request('/api/auth/login-password', {
      method: 'POST',
      body: {},
    });
    expectStatus(loginPasswordApi.status, 400, 'api_auth_login_password_validation');

    const sendCode = await request('/auth/send-code', {
      method: 'POST',
      body: {},
    });
    expectStatus(sendCode.status, 400, 'auth_send_code_validation');

    const sendCodeApi = await request('/api/auth/send-code', {
      method: 'POST',
      body: {},
    });
    expectStatus(sendCodeApi.status, 400, 'api_auth_send_code_validation');

    console.log('[test:basic] ok');
    await cleanup();
    process.exitCode = 0;
  } catch (error) {
    console.error('[test:basic] fail', String(error?.message || error));
    await cleanup();
    process.exitCode = 1;
  }
}

run();
