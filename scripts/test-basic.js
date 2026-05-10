const { spawn } = require('child_process');

const PORT = 3201;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { status: response.status, ok: response.ok, data: json };
}

function buildFakeGoogleToken(email) {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      name: 'Basic Test User',
      sub: `basic-${Date.now()}`,
    })
  ).toString('base64url');

  return `x.${payload}.y`;
}

async function waitServerReady(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const health = await requestJson('/health');
      if (health.ok) {
        return true;
      }
    } catch {
      // no-op
    }
    await wait(150);
  }
  return false;
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
    if (cleaningUp || backend.killed) {
      return;
    }

    cleaningUp = true;

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          if (!backend.killed) {
            backend.kill('SIGKILL');
          }
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

  process.on('SIGINT', () => {
    cleanup().finally(() => {
      process.exitCode = 1;
    });
  });

  try {
    const ready = await waitServerReady();
    if (!ready) {
      throw new Error('backend_not_ready');
    }

    const login = await requestJson('/auth/google', {
      method: 'POST',
      body: {
        token: buildFakeGoogleToken('basic-test@evolucao.app'),
      },
    });

    if (!login.ok || !login.data?.accessToken) {
      throw new Error(`login_failed:${login.status}`);
    }

    const accessToken = login.data.accessToken;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const saveWorkout = await requestJson('/workouts', {
      method: 'POST',
      headers: authHeaders,
      body: {
        exercise: 'Supino Reto Barra',
        weight: 60,
        reps: 10,
        sets: 3,
      },
    });

    if (!saveWorkout.ok) {
      throw new Error(`save_workout_failed:${saveWorkout.status}`);
    }

    const history = await requestJson('/workouts?limit=10', {
      headers: authHeaders,
    });

    if (!history.ok || !Array.isArray(history.data?.workouts) || history.data.workouts.length < 1) {
      throw new Error(`history_failed:${history.status}`);
    }

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
