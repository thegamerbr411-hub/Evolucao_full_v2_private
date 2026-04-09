const axios = require('axios');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'fe123456$@';
const CLIENT_ID = process.env.CLIENT_ID || 'admin';

async function run() {
  try {
    const health = await axios.get(`${BASE}/health`);
    if (!health.data?.ok) {
      throw new Error('healthcheck_failed');
    }
    console.log('login flow: health ok');

    const login = await axios.post(`${BASE}/login`, {
      user: ADMIN_USER,
      pass: ADMIN_PASS,
    });
    const adminToken = login.data.token;
    if (!adminToken) {
      throw new Error('missing_admin_token');
    }
    console.log('login flow: admin token ok');

    const client = await axios.post(
      `${BASE}/token/client`,
      { clientId: CLIENT_ID },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    const clientToken = client.data.token;
    if (!clientToken) {
      throw new Error('missing_client_token');
    }
    console.log('login flow: client token ok');

    const bugs = await axios.get(`${BASE}/api/bugs`, {
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'x-client-id': CLIENT_ID,
      },
    });

    if (!Array.isArray(bugs.data)) {
      throw new Error('invalid_bugs_response');
    }

    console.log('login flow: api/bugs ok');
    console.log('test-flow:ok');
  } catch (error) {
    const details = error?.response?.data || error.message;
    console.error('test-flow:fail', details);
    process.exit(1);
  }
}

run();
