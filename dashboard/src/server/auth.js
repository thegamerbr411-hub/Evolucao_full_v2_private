const jwt = require('jsonwebtoken');
const { normalizeClientId } = require('./storage');

function createAuth(config = {}) {
  const secret = String(config.secret || 'supersecret');
  const adminUser = String(config.adminUser || 'admin');
  const adminPass = String(config.adminPass || '123456');
  const defaultClientId = normalizeClientId(config.defaultClientId || 'default');
  const clientKeyMap = parseClientKeyMap(config.clientKeyMap);

  function parseClientKeyMap(rawValue) {
    if (!rawValue) {
      return {};
    }

    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      return rawValue;
    }

    try {
      const parsed = JSON.parse(String(rawValue));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function extractBearerToken(req, errorCode) {
    const authHeader = String(req.headers.authorization || '').trim();
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: { ok: false, error: errorCode } };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return { error: { ok: false, error: errorCode } };
    }

    return { token };
  }

  function verifyJwtToken(token, errorCode) {
    try {
      return { decoded: jwt.verify(token, secret) };
    } catch {
      return { error: { ok: false, error: errorCode } };
    }
  }

  function issueAdminToken() {
    const payload = {
      user: adminUser,
      role: 'admin',
      clientId: 'admin',
    };
    return jwt.sign(payload, secret, { expiresIn: '6h' });
  }

  function issueClientToken(clientId) {
    return jwt.sign(
      {
        role: 'client',
        clientId: normalizeClientId(clientId),
      },
      secret,
      { expiresIn: '7d' }
    );
  }

  function validateJWT(req, res, next) {
    const extracted = extractBearerToken(req, 'unauthorized_client');
    if (extracted.error) {
      return res.status(401).json(extracted.error);
    }

    const verified = verifyJwtToken(extracted.token, 'unauthorized_client');
    if (verified.error) {
      return res.status(401).json(verified.error);
    }

    req.auth = verified.decoded;
    return next();
  }

  function validateClient(req, res, next) {
    const apiKey = String(req.headers['x-api-key'] || '').trim();

    if (!apiKey) {
      return res.status(401).json({ ok: false, error: 'missing_api_key' });
    }

    const clientId = Object.entries(clientKeyMap).find(([, value]) => String(value) === apiKey)?.[0];

    if (!clientId) {
      return res.status(401).json({ ok: false, error: 'unauthorized_client' });
    }

    req.clientId = normalizeClientId(clientId || defaultClientId);
    return next();
  }

  function authenticateAdmin(req, res, next) {
    const extracted = extractBearerToken(req, 'unauthorized_admin');
    if (extracted.error) {
      return res.status(401).json(extracted.error);
    }

    const verified = verifyJwtToken(extracted.token, 'unauthorized_admin');
    if (verified.error) {
      return res.status(401).json(verified.error);
    }

    const decoded = verified.decoded;
    if (decoded.role !== 'admin') {
      return res.status(401).json({ ok: false, error: 'unauthorized_admin' });
    }

    req.auth = decoded;
    return next();
  }

  function authenticateClient(req, res, next) {
    return validateJWT(req, res, () => validateClient(req, res, next));
  }

  function handleLogin(req, res) {
    const username = String(req.body?.user || req.body?.email || '').trim();
    const password = String(req.body?.pass || req.body?.password || '').trim();

    if (username !== adminUser || password !== adminPass) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    }

    const token = issueAdminToken();
    return res.json({ ok: true, token });
  }

  function handleClientToken(req, res) {
    const requestedClientId = normalizeClientId(req.body?.clientId || defaultClientId);
    const token = issueClientToken(requestedClientId);
    return res.json({ ok: true, token, clientId: requestedClientId });
  }

  return {
    authenticateAdmin,
    authenticateClient,
    handleClientToken,
    handleLogin,
    validateClient,
    validateJWT,
  };
}

module.exports = {
  createAuth,
};
