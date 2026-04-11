const net = require('net');

process.env.ADMIN_USER = process.env.ADMIN_USER || 'admin';
process.env.ADMIN_PASS = process.env.ADMIN_PASS || 'pass123';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'detox-secret';
process.env.CLIENT_API_KEYS = process.env.CLIENT_API_KEYS || JSON.stringify({ admin: '123456' });
process.env.ENABLE_QA_LOCAL_BYPASS = process.env.ENABLE_QA_LOCAL_BYPASS || '1';

const { startServer } = require('../dashboard/server');

let qaServer = null;
let ownsServer = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readHealthcheck() {
  try {
    const response = await fetch('http://127.0.0.1:3000/health');
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function waitForHealthcheck() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const payload = await readHealthcheck();
    if (payload?.service === 'qa-dashboard-local' && payload?.status === 'ok') {
      return true;
    }

    await wait(500);
  }

  throw new Error('qa_server_healthcheck_failed');
}

beforeAll(async () => {
  jest.setTimeout(240000);

  const existingHealth = await readHealthcheck();
  if (existingHealth?.service === 'qa-dashboard-local' && existingHealth?.status === 'ok') {
    console.log('[e2e] QA server already running on port 3000');
    return;
  }

  if (await isPortOpen(3000)) {
    throw new Error('port_3000_in_use_by_non_qa_service');
  }

  qaServer = startServer(3000);
  ownsServer = true;
  await waitForHealthcheck();
  console.log('[e2e] QA server started on port 3000');
});

afterAll(async () => {
  if (!ownsServer || !qaServer) {
    return;
  }

  await new Promise((resolve) => qaServer.close(resolve));
  qaServer = null;
  ownsServer = false;
});
